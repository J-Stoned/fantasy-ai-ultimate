#!/usr/bin/env tsx
/**
 * Fix database by clearing ALL games and collecting fresh real data
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

async function fixDatabase() {
  console.log(chalk.red.bold('🔧 FIXING DATABASE PROPERLY\n'));
  
  // 1. Clear ALL games
  console.log(chalk.yellow('1. Clearing ALL games...'));
  
  try {
    let deleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batch } = await supabase
        .from('games')
        .select('id')
        .limit(100);
        
      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }
      
      const ids = batch.map(g => g.id);
      await supabase
        .from('games')
        .delete()
        .in('id', ids);
        
      deleted += ids.length;
      process.stdout.write(`\r   Deleted ${deleted} games...`);
    }
    
    console.log(chalk.green(`\n   ✓ Cleared ${deleted} games`));
    
  } catch (error) {
    console.log(chalk.red('   Could not clear games'));
  }
  
  // 2. Collect REAL NFL games from 2024 season
  console.log(chalk.yellow('\n2. Collecting REAL NFL 2024 games...'));
  
  let collected = 0;
  
  // Get weeks 1-17 of 2024 season
  for (let week = 1; week <= 17; week++) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2024`
      );
      
      const events = response.data.events || [];
      
      for (const event of events) {
        // Only save completed games
        if (!event.status?.type?.completed) continue;
        
        const competition = event.competitions?.[0];
        if (!competition) continue;
        
        const home = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const away = competition.competitors?.find((c: any) => c.homeAway === 'away');
        
        if (!home || !away) continue;
        
        // Ensure teams exist
        await ensureNFLTeam(home.team);
        await ensureNFLTeam(away.team);
        
        // Save game
        const gameData = {
          id: parseInt(event.id),
          sport_id: 'nfl',
          season: 2024,
          season_type: 2,
          week: week,
          start_time: event.date,
          status: 'completed',
          home_team_id: parseInt(home.team.id),
          away_team_id: parseInt(away.team.id),
          home_score: parseInt(home.score || 0),
          away_score: parseInt(away.score || 0),
          venue: competition.venue?.fullName || null,
          attendance: competition.attendance || null
        };
        
        const { error } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'id' });
          
        if (!error) {
          collected++;
        }
      }
      
      console.log(`   Week ${week}: ${events.filter((e: any) => e.status?.type?.completed).length} games`);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(chalk.red(`   Error on week ${week}`));
    }
  }
  
  console.log(chalk.green(`\n   ✓ Collected ${collected} real NFL games`));
  
  // 3. Show sample of real data
  console.log(chalk.yellow('\n3. Verifying real data...'));
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(5);
    
  console.log('\nSample games:');
  for (const game of sampleGames || []) {
    const { data: homeTeam } = await supabase
      .from('teams')
      .select('name, abbreviation')
      .eq('id', game.home_team_id)
      .single();
      
    const { data: awayTeam } = await supabase
      .from('teams')
      .select('name, abbreviation')
      .eq('id', game.away_team_id)
      .single();
      
    const date = new Date(game.start_time).toLocaleDateString();
    console.log(`  ${date}: ${awayTeam?.abbreviation || game.away_team_id} @ ${homeTeam?.abbreviation || game.home_team_id} (${game.away_score}-${game.home_score})`);
  }
  
  console.log(chalk.green.bold('\n✅ Database fixed with real data!'));
}

async function ensureNFLTeam(teamData: any) {
  const team = {
    id: parseInt(teamData.id),
    name: teamData.displayName,
    city: teamData.location || teamData.displayName.split(' ').slice(0, -1).join(' '),
    abbreviation: teamData.abbreviation,
    sport_id: 'nfl',
    league_id: 'NFL',
    logo_url: teamData.logos?.[0]?.href || null,
    metadata: {
      color: teamData.color,
      alternateColor: teamData.alternateColor
    }
  };
  
  await supabase
    .from('teams')
    .upsert(team, { onConflict: 'id' });
}

fixDatabase().catch(console.error);