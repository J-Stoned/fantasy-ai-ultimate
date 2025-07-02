#!/usr/bin/env tsx
/**
 * Check Database Schema
 * Verifies which tables exist and their column structure
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

console.log(chalk.blue.bold('\n🔍 DATABASE SCHEMA CHECK'));
console.log(chalk.blue('========================\n'));

async function checkSchema() {
  try {
    // Get all tables
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables', {
      schema_name: 'public'
    }).select('*');

    if (tablesError) {
      // Fallback method
      console.log(chalk.yellow('Using fallback method to check tables...'));
      
      const requiredTables = {
        'Core Tables': [
          'games',
          'players', 
          'teams',
          'player_stats',
          'news_articles',
          'betting_odds',
          'weather_data',
          'injuries'
        ],
        'ML Tables': [
          'ml_predictions',
          'ml_outcomes',
          'event_predictions',
          'ml_model_performance',
          'correlation_insights'
        ],
        'Voice Tables': [
          'voice_commands',
          'voice_training_data',
          'voice_preferences',
          'voice_analytics'
        ],
        'GPU/Performance Tables': [
          'gpu_optimization_cache',
          'gpu_training_metrics',
          'gpu_models',
          'game_events'
        ],
        'Real-time Tables': [
          'websocket_connections',
          'broadcast_queue',
          'websocket_rooms'
        ],
        'System Tables': [
          'system_metrics',
          'sla_violations',
          'alert_configs',
          'performance_benchmarks'
        ]
      };

      for (const [category, tableList] of Object.entries(requiredTables)) {
        console.log(chalk.yellow(`\n${category}:`));
        
        for (const tableName of tableList) {
          // Try to select from the table
          const { error } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
          
          const exists = !error || error.code !== '42P01'; // 42P01 = table does not exist
          console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
        }
      }
    } else {
      // If RPC works, show detailed info
      console.log(chalk.green('Found tables in database:\n'));
      tables?.forEach((table: any) => {
        console.log(chalk.cyan(`📋 ${table.table_name}`));
      });
    }

    // Check specific table columns
    console.log(chalk.yellow('\n📊 Checking games table structure...'));
    const { data: gamesSample, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .limit(1);

    if (!gamesError && gamesSample && gamesSample.length > 0) {
      console.log(chalk.green('Games table columns:'));
      Object.keys(gamesSample[0]).forEach(col => {
        console.log(`  - ${col}`);
      });
    }

    // Check ML predictions table
    console.log(chalk.yellow('\n🤖 Checking ML predictions table...'));
    const { data: mlSample, error: mlError } = await supabase
      .from('ml_predictions')
      .select('*')
      .limit(1);

    if (!mlError) {
      console.log(chalk.green('✅ ML predictions table exists'));
      if (mlSample && mlSample.length > 0) {
        console.log('Columns:', Object.keys(mlSample[0]).join(', '));
      }
    } else {
      console.log(chalk.red('❌ ML predictions table not found'));
    }

    // Count records in key tables
    console.log(chalk.yellow('\n📈 Record counts:'));
    
    const countTables = ['games', 'players', 'ml_predictions', 'news_articles'];
    for (const table of countTables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`  ${table}: ${count || 0} records`);
      }
    }

  } catch (error: any) {
    console.error(chalk.red('Error checking schema:'), error.message);
  }
}

checkSchema();