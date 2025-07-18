#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug2021StatsIssue() {
  console.log(chalk.bold.cyan('🔍 DEBUGGING 2021 NFL STATS ISSUE\n'));
  
  // 1. Get a sample 2021 game
  const { data: sampleGame } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2021-10-01')
    .limit(1)
    .single();
    
  if (!sampleGame) {
    console.log('No sample game found');
    return;
  }
  
  console.log(chalk.yellow('Sample 2021 NFL game:'));
  console.log(chalk.white(`ID: ${sampleGame.id}`));
  console.log(chalk.white(`External ID: ${sampleGame.external_id}`));
  console.log(chalk.white(`Date: ${new Date(sampleGame.start_time).toLocaleDateString()}\n`));
  
  // 2. Check stats for this specific game
  const { data: gameStats, count: statsCount } = await supabase
    .from('player_game_logs')
    .select('id, player_id, game_id, game_date, sport', { count: 'exact' })
    .eq('game_id', sampleGame.id)
    .limit(5);
    
  console.log(chalk.yellow(`Stats for game ${sampleGame.id}:`));
  console.log(chalk.white(`Total count: ${statsCount || 0}`));
  
  if (gameStats && gameStats.length > 0) {
    console.log(chalk.white('\nFirst 5 stats:'));
    gameStats.forEach(stat => {
      console.log(chalk.gray(`  ID: ${stat.id}, Player: ${stat.player_id}, Game: ${stat.game_id}, Date: ${stat.game_date}, Sport: ${stat.sport}`));
    });
  }
  
  // 3. Check overall stats by date
  console.log(chalk.yellow('\n\n3. Checking stats by game_date:'));
  
  const { data: statsByDate, count: dateCount } = await supabase
    .from('player_game_logs')
    .select('game_date', { count: 'exact' })
    .eq('sport', 'NFL')
    .gte('game_date', '2021-09-01')
    .lt('game_date', '2021-10-01')
    .limit(10);
    
  console.log(chalk.white(`Total NFL stats in Sep 2021 (by date): ${dateCount || 0}`));
  
  if (statsByDate && statsByDate.length > 0) {
    const uniqueDates = [...new Set(statsByDate.map(s => s.game_date))];
    console.log(chalk.white(`Unique dates: ${uniqueDates.join(', ')}`));
  }
  
  // 4. Check if it's a data type issue with game_id
  console.log(chalk.yellow('\n\n4. Checking data types:'));
  
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .eq('sport', 'NFL')
    .limit(5);
    
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.white('Sample game_id values from stats:'));
    sampleStats.forEach(s => {
      console.log(chalk.gray(`  game_id: ${s.game_id} (type: ${typeof s.game_id})`));
    });
  }
  
  console.log(chalk.white(`\nSample game.id: ${sampleGame.id} (type: ${typeof sampleGame.id})`));
  
  // 5. Direct count without IN clause
  console.log(chalk.yellow('\n\n5. Direct stats count for 2021:'));
  
  const { count: directCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .gte('game_date', '2021-01-01')
    .lt('game_date', '2022-01-01');
    
  console.log(chalk.white(`Total 2021 NFL stats (direct query): ${directCount || 0}`));
  
  // 6. Check if stats exist but with wrong dates
  console.log(chalk.yellow('\n\n6. Checking for date mismatches:'));
  
  const { data: wrongDateStats } = await supabase
    .from('player_game_logs')
    .select('game_id, game_date')
    .eq('game_id', sampleGame.id)
    .limit(1);
    
  if (wrongDateStats && wrongDateStats.length > 0) {
    const statDate = wrongDateStats[0].game_date;
    const gameDate = sampleGame.start_time;
    console.log(chalk.white(`Game date: ${gameDate}`));
    console.log(chalk.white(`Stat date: ${statDate}`));
    console.log(chalk.white(`Dates match: ${new Date(statDate).toDateString() === new Date(gameDate).toDateString()}`));
  }
}

debug2021StatsIssue().catch(console.error);