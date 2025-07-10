#!/usr/bin/env tsx
/**
 * Quick Data Collector - Gets data fast for immediate use
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

async function quickCollect() {
  console.log(chalk.blue.bold('⚡ QUICK DATA COLLECTION\n'));
  
  const stats = {
    nfl: 0,
    nba: 0,
    total: 0
  };
  
  // NFL - Last few weeks
  console.log(chalk.yellow('Collecting recent NFL games...'));
  for (let week = 15; week <= 18; week++) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2024`
      );
      
      const events = response.data.events || [];
      
      for (const event of events) {
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
          venue: comp.venue?.fullName || 'Stadium',
          home_score: parseInt(home.score) || 0,
          away_score: parseInt(away.score) || 0,
          status: 'completed',
          external_id: `nfl_${event.id}`,
          metadata: {
            week: week,
            season: 2024
          }
        };
        
        const { error } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'external_id' });
        
        if (!error) stats.nfl++;
      }
    } catch (e) {
      // Skip
    }
  }
  
  // NBA - Recent games
  console.log(chalk.yellow('\nCollecting recent NBA games...'));
  try {
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20250101-20250107'
    );
    
    const events = response.data.events || [];
    
    for (const event of events) {
      if (!event.status?.type?.completed) continue;
      
      const comp = event.competitions[0];
      const home = comp.competitors.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!home || !away) continue;
      
      const gameData = {
        home_team_id: parseInt(home.team.id),
        away_team_id: parseInt(away.team.id),
        sport_id: 'nba',
        start_time: event.date,
        venue: comp.venue?.fullName || 'Arena',
        home_score: parseInt(home.score) || 0,
        away_score: parseInt(away.score) || 0,
        status: 'completed',
        external_id: `nba_${event.id}`,
        metadata: {
          season: 2024
        }
      };
      
      const { error } = await supabase
        .from('games')
        .upsert(gameData, { onConflict: 'external_id' });
      
      if (!error) stats.nba++;
    }
  } catch (e) {
    // Skip
  }
  
  stats.total = stats.nfl + stats.nba;
  
  console.log(chalk.green.bold('\n✅ QUICK COLLECTION COMPLETE!\n'));
  console.log(`NFL games: ${stats.nfl}`);
  console.log(`NBA games: ${stats.nba}`);
  console.log(`Total: ${stats.total}`);
  
  // Check new totals
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  console.log(chalk.yellow(`\nTotal completed games in database: ${count}`));
}

quickCollect().catch(console.error);