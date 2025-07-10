#!/usr/bin/env tsx
/**
 * 🔥 REAL-TIME TABLE MONITOR
 * Shows exactly what's happening in ALL tables
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function monitorTables() {
  console.clear();
  console.log(chalk.red.bold('\n🔥 REAL-TIME DATABASE MONITOR'));
  console.log(chalk.red('=============================\n'));
  
  // All tables to monitor
  const tables = [
    // Original tables
    { name: 'players', emoji: '🏃', key: true },
    { name: 'teams', emoji: '🏟️', key: true },
    { name: 'games', emoji: '🏈', key: true },
    { name: 'news_articles', emoji: '📰', key: true },
    
    // Tables we're trying to fill
    { name: 'player_stats', emoji: '📊', key: false },
    { name: 'player_injuries', emoji: '🏥', key: false },
    { name: 'player_projections', emoji: '🎯', key: false },
    { name: 'weather_data', emoji: '🌤️', key: false },
    { name: 'betting_odds', emoji: '💰', key: false },
    
    // Social/sentiment tables
    { name: 'social_sentiment', emoji: '💬', key: false },
    { name: 'fantasy_rankings', emoji: '📈', key: false },
    { name: 'trending_players', emoji: '🔥', key: false },
    { name: 'breaking_news', emoji: '🚨', key: false },
    
    // Other data tables
    { name: 'dfs_salaries', emoji: '💎', key: false },
    { name: 'video_content', emoji: '📹', key: false },
    { name: 'api_usage', emoji: '📡', key: false },
  ];
  
  let totalRecords = 0;
  const emptyTables: string[] = [];
  const activeTables: string[] = [];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    if (!error && count !== null) {
      const status = count > 0 ? chalk.green(`${count.toLocaleString()}`) : chalk.red('EMPTY');
      console.log(`${table.emoji} ${table.name}: ${status}`);
      
      totalRecords += count;
      if (count === 0) {
        emptyTables.push(table.name);
      } else {
        activeTables.push(table.name);
      }
    } else {
      console.log(`${table.emoji} ${table.name}: ${chalk.gray('ERROR')}`);
    }
  }
  
  console.log(chalk.yellow(`\n📊 Total Records: ${totalRecords.toLocaleString()}`));
  
  // Show what's working
  console.log(chalk.green(`\n✅ Active Tables (${activeTables.length}):`));
  console.log(chalk.gray(activeTables.join(', ')));
  
  // Show what needs fixing
  if (emptyTables.length > 0) {
    console.log(chalk.red(`\n❌ Empty Tables (${emptyTables.length}):`));
    console.log(chalk.gray(emptyTables.join(', ')));
  }
  
  // Check recent inserts
  console.log(chalk.cyan('\n🕐 Latest Activity:\n'));
  
  // Check weather_data specifically
  const { data: weatherData, error: weatherError } = await supabase
    .from('weather_data')
    .select('location, temperature, conditions, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (weatherData && weatherData.length > 0) {
    console.log(chalk.green('🌤️  Weather Data:'));
    weatherData.forEach(w => {
      console.log(`   ${w.location}: ${w.temperature}°F, ${w.conditions}`);
    });
  } else {
    console.log(chalk.red('🌤️  Weather Data: No data yet'));
  }
  
  // Check betting_odds
  const { data: oddsData } = await supabase
    .from('betting_odds')
    .select('home_team, away_team, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (oddsData && oddsData.length > 0) {
    console.log(chalk.green('\n💰 Betting Odds:'));
    oddsData.forEach(o => {
      console.log(`   ${o.home_team} vs ${o.away_team}`);
    });
  }
  
  // Check player_stats
  const { data: statsData } = await supabase
    .from('player_stats')
    .select('player_id, passing_yards, rushing_yards')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (statsData && statsData.length > 0) {
    console.log(chalk.green('\n📊 Player Stats:'));
    statsData.forEach(s => {
      console.log(`   Player ${s.player_id}: ${s.passing_yards || 0} pass yds, ${s.rushing_yards || 0} rush yds`);
    });
  }
  
  console.log(chalk.yellow('\n🔄 Refreshing in 5 seconds...\n'));
}

// Run monitor every 5 seconds
async function startMonitoring() {
  await monitorTables();
  setInterval(monitorTables, 5000);
}

startMonitoring().catch(console.error);