#!/usr/bin/env tsx
/**
 * Collect REAL NFL games with correct schema
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function collectRealNFL() {
  console.log(chalk.blue.bold('🏈 COLLECTING REAL NFL 2024 GAMES\n'));
  
  let totalCollected = 0;
  
  // Get completed weeks from 2024 season
  for (let week = 1; week <= 18; week++) {
    process.stdout.write(`Week ${week}...`);
    
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2024`
      );
      
      const events = response.data.events || [];
      let weekSaved = 0;
      
      for (const event of events) {
        // Only save completed games
        if (!event.status?.type?.completed) continue;
        
        const comp = event.competitions[0];
        const home = comp.competitors.find((c: any) => c.homeAway === 'home');
        const away = comp.competitors.find((c: any) => c.homeAway === 'away');
        
        if (!home || !away) continue;
        
        const gameData = {
          home_team_id: parseInt(home.team.id),
          away_team_id: parseInt(away.team.id),
          sport_id: 'nfl',
          start_time: event.date,
          venue: comp.venue?.fullName || `Week ${week} Game`,
          home_score: parseInt(home.score),
          away_score: parseInt(away.score),
          status: 'completed',
          external_id: `nfl_${event.id}`,
          metadata: {
            week: week,
            season: 2024,
            attendance: comp.attendance,
            broadcast: comp.broadcasts?.[0]?.names?.[0]
          }
        };
        
        const { error } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'external_id' });
          
        if (!error) {
          weekSaved++;
          totalCollected++;
        }
      }
      
      console.log(chalk.green(` ✓ ${weekSaved} games`));
      
    } catch (error) {
      console.log(chalk.red(' ✗ Failed'));
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(chalk.green(`\n✅ Total collected: ${totalCollected} NFL games`));
  
  // Show recent games
  const { data: recent } = await supabase
    .from('games')
    .select('*')
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5);
    
  if (recent && recent.length > 0) {
    console.log('\nRecent NFL games:');
    recent.forEach(game => {
      const date = new Date(game.start_time).toLocaleDateString();
      console.log(`  ${date}: Team ${game.away_team_id} @ Team ${game.home_team_id} (${game.away_score}-${game.home_score})`);
    });
  }
}

collectRealNFL().catch(console.error);