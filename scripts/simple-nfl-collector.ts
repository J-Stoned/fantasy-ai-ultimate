#!/usr/bin/env tsx
/**
 * Simple NFL collector - just get real games into the database
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

async function collectNFL() {
  console.log(chalk.blue.bold('🏈 COLLECTING REAL NFL 2024 GAMES\n'));
  
  let totalGames = 0;
  let savedGames = 0;
  
  // Collect weeks 1-18
  for (let week = 1; week <= 18; week++) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2024`
      );
      
      const events = response.data.events || [];
      let weekSaved = 0;
      
      for (const event of events) {
        totalGames++;
        
        // Only completed games
        if (!event.status?.type?.completed) continue;
        
        const comp = event.competitions[0];
        const home = comp.competitors.find((c: any) => c.homeAway === 'home');
        const away = comp.competitors.find((c: any) => c.homeAway === 'away');
        
        if (!home || !away) continue;
        
        try {
          // Simple game data
          const gameData = {
            id: Math.floor(Math.random() * 1000000), // Random ID to avoid conflicts
            sport_id: 'nfl',
            season: 2024,
            week: week,
            start_time: event.date,
            home_team_id: home.team.id,
            away_team_id: away.team.id,
            home_score: parseInt(home.score),
            away_score: parseInt(away.score),
            status: 'completed'
          };
          
          const { error } = await supabase
            .from('games')
            .insert(gameData);
            
          if (!error) {
            weekSaved++;
            savedGames++;
          } else {
            console.log(chalk.red(`   Error saving game: ${error.message}`));
          }
          
        } catch (err) {
          // Skip
        }
      }
      
      console.log(`Week ${week}: ${weekSaved}/${events.length} games saved`);
      
    } catch (error) {
      console.error(chalk.red(`Week ${week} failed`));
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(chalk.green(`\n✅ Saved ${savedGames}/${totalGames} NFL games`));
  
  // Show sample
  const { data: sample } = await supabase
    .from('games')
    .select('*')
    .eq('sport_id', 'nfl')
    .order('start_time', { ascending: false })
    .limit(5);
    
  if (sample && sample.length > 0) {
    console.log('\nSample games:');
    sample.forEach(game => {
      const date = new Date(game.start_time).toLocaleDateString();
      console.log(`  ${date}: Team ${game.away_team_id} @ Team ${game.home_team_id} (${game.away_score}-${game.home_score})`);
    });
  }
}

collectNFL().catch(console.error);