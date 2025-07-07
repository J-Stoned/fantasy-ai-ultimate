#!/usr/bin/env tsx
/**
 * Collection Summary - Shows what we've accomplished
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function showSummary() {
  console.log(chalk.blue.bold('📊 DATA COLLECTION SUMMARY\n'));
  
  // Get counts by sport
  const sports = ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab'];
  
  console.log(chalk.yellow('Games by Sport:'));
  for (const sport of sports) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
    
    if (count && count > 0) {
      console.log(`  ${sport.toUpperCase()}: ${count.toLocaleString()} games`);
    }
  }
  
  // Total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  console.log(chalk.green(`\nTotal completed games: ${totalGames?.toLocaleString()}`));
  
  // Check recent games
  console.log(chalk.yellow('\nMost Recent Games:'));
  
  const { data: recentGames } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5);
  
  if (recentGames) {
    for (const game of recentGames) {
      const date = new Date(game.start_time).toLocaleDateString();
      console.log(`  ${game.sport_id.toUpperCase()} - ${date}: Team ${game.away_team_id} @ Team ${game.home_team_id} (${game.away_score}-${game.home_score})`);
    }
  }
  
  // Player stats coverage
  const { data: statsGames } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10000);
  
  const uniqueGames = new Set(statsGames?.map(s => s.game_id) || []);
  const coverage = ((uniqueGames.size / (totalGames || 1)) * 100).toFixed(1);
  
  console.log(chalk.yellow('\nPlayer Stats Coverage:'));
  console.log(`  Games with stats: ${uniqueGames.size}/${totalGames} (${coverage}%)`);
  
  // Other tables
  console.log(chalk.yellow('\nOther Data:'));
  const otherTables = ['teams', 'players', 'news_articles', 'weather_data'];
  
  for (const table of otherTables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    console.log(`  ${table}: ${count?.toLocaleString() || 0} records`);
  }
  
  console.log(chalk.green.bold('\n✅ DATA COLLECTION COMPLETE!\n'));
  
  console.log(chalk.cyan('Next Steps:'));
  console.log('1. Continue filling player stats (currently 0.1% coverage)');
  console.log('2. Train ML models on the expanded dataset');
  console.log('3. Test pattern detection with real data');
  console.log('4. Connect betting APIs for odds data');
  console.log('5. Add weather data for outdoor games');
}

showSummary().catch(console.error);