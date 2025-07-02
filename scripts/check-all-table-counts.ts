#!/usr/bin/env tsx
/**
 * Check All Table Record Counts
 * Gets exact counts from all important tables for ML training
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

console.log(chalk.blue.bold('\n📊 DATABASE RECORD COUNTS FOR ML TRAINING'));
console.log(chalk.blue('==========================================\n'));

interface TableCount {
  name: string;
  count: number;
  category: string;
  error?: string;
}

async function getTableCount(tableName: string): Promise<number> {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    throw error;
  }
  
  return count || 0;
}

async function checkAllTableCounts() {
  const results: TableCount[] = [];
  
  const tableCategories = {
    '🏈 Core Game Data': [
      'games',
      'teams',
      'players',
      'player_stats',
      'team_stats',
      'game_stats',
      'game_events'
    ],
    '📰 Context Data': [
      'news_articles',
      'player_news',
      'team_news',
      'injuries',
      'weather_data',
      'betting_odds',
      'public_sentiment',
      'social_sentiment'
    ],
    '🤖 ML & Predictions': [
      'ml_predictions',
      'ml_outcomes',
      'event_predictions',
      'ml_model_performance',
      'correlation_insights',
      'prediction_features',
      'training_data'
    ],
    '🎙️ Voice & Interaction': [
      'voice_commands',
      'voice_training_data',
      'voice_preferences',
      'voice_analytics',
      'voice_sessions'
    ],
    '⚡ GPU & Performance': [
      'gpu_optimization_cache',
      'gpu_training_metrics',
      'gpu_models',
      'gpu_performance_logs'
    ],
    '📡 Real-time & Streaming': [
      'websocket_connections',
      'broadcast_queue',
      'websocket_rooms',
      'real_time_events'
    ],
    '⚙️ System & Analytics': [
      'system_metrics',
      'sla_violations',
      'alert_configs',
      'performance_benchmarks',
      'api_usage_logs'
    ]
  };

  // Check each category
  for (const [category, tables] of Object.entries(tableCategories)) {
    console.log(chalk.yellow(`\n${category}`));
    console.log(chalk.gray('─'.repeat(50)));
    
    for (const tableName of tables) {
      try {
        const count = await getTableCount(tableName);
        results.push({
          name: tableName,
          count,
          category
        });
        
        if (count > 0) {
          console.log(chalk.green(`  ✓ ${tableName.padEnd(25)} ${count.toLocaleString()} records`));
        } else {
          console.log(chalk.yellow(`  ⚠ ${tableName.padEnd(25)} 0 records (empty)`));
        }
      } catch (error: any) {
        if (error.code === '42P01') {
          console.log(chalk.red(`  ✗ ${tableName.padEnd(25)} Table does not exist`));
        } else {
          console.log(chalk.red(`  ✗ ${tableName.padEnd(25)} Error: ${error.message}`));
        }
        results.push({
          name: tableName,
          count: 0,
          category,
          error: error.message
        });
      }
    }
  }

  // Summary statistics
  console.log(chalk.cyan('\n📈 SUMMARY STATISTICS'));
  console.log(chalk.gray('─'.repeat(50)));

  const validResults = results.filter(r => !r.error && r.count > 0);
  const totalRecords = validResults.reduce((sum, r) => sum + r.count, 0);
  
  console.log(chalk.white(`  Total tables checked: ${results.length}`));
  console.log(chalk.green(`  Tables with data: ${validResults.length}`));
  console.log(chalk.yellow(`  Empty tables: ${results.filter(r => !r.error && r.count === 0).length}`));
  console.log(chalk.red(`  Missing tables: ${results.filter(r => r.error?.includes('42P01')).length}`));
  console.log(chalk.blue(`  Total records across all tables: ${totalRecords.toLocaleString()}`));

  // Top tables by record count
  console.log(chalk.cyan('\n🏆 TOP TABLES BY RECORD COUNT'));
  console.log(chalk.gray('─'.repeat(50)));
  
  const topTables = validResults
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  topTables.forEach((table, index) => {
    console.log(chalk.white(`  ${index + 1}. ${table.name.padEnd(25)} ${table.count.toLocaleString()} records`));
  });

  // ML-relevant data summary
  console.log(chalk.magenta('\n🧠 ML TRAINING DATA AVAILABILITY'));
  console.log(chalk.gray('─'.repeat(50)));
  
  const mlRelevantTables = [
    'games',
    'players',
    'player_stats',
    'team_stats',
    'injuries',
    'weather_data',
    'news_articles',
    'betting_odds',
    'ml_predictions',
    'ml_outcomes'
  ];

  for (const tableName of mlRelevantTables) {
    const result = results.find(r => r.name === tableName);
    if (result && !result.error) {
      const status = result.count > 1000 
        ? chalk.green('✓ Good for training')
        : result.count > 100 
        ? chalk.yellow('⚠ Limited data')
        : chalk.red('✗ Insufficient data');
      
      console.log(`  ${tableName.padEnd(20)} ${result.count.toLocaleString().padStart(10)} records  ${status}`);
    }
  }

  // Check date ranges for games
  console.log(chalk.cyan('\n📅 GAMES DATE RANGE'));
  console.log(chalk.gray('─'.repeat(50)));
  
  try {
    const { data: dateRange } = await supabase
      .from('games')
      .select('game_date')
      .order('game_date', { ascending: true })
      .limit(1);
    
    const { data: latestDate } = await supabase
      .from('games')
      .select('game_date')
      .order('game_date', { ascending: false })
      .limit(1);
    
    if (dateRange && dateRange.length > 0 && latestDate && latestDate.length > 0) {
      console.log(`  Earliest game: ${dateRange[0].game_date}`);
      console.log(`  Latest game: ${latestDate[0].game_date}`);
      
      // Count games by status
      const { data: gamesByStatus } = await supabase
        .from('games')
        .select('status')
        .select('status, count', { count: 'exact' });
      
      if (gamesByStatus) {
        const statusCounts = gamesByStatus.reduce((acc: any, game: any) => {
          acc[game.status] = (acc[game.status] || 0) + 1;
          return acc;
        }, {});
        
        console.log('\n  Games by status:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`    ${status}: ${count}`);
        });
      }
    }
  } catch (error) {
    console.log(chalk.red('  Error checking game dates'));
  }

  return results;
}

// Run the check
checkAllTableCounts().catch(console.error);