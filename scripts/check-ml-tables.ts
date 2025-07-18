#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLTables() {
  console.log(chalk.cyan('\n🔍 Checking ML-related tables...\n'));
  
  // Check various table names
  const tables = [
    'advanced_metrics',
    'game_metrics', 
    'team_metrics',
    'player_metrics',
    'performance_metrics',
    'ml_features',
    'game_features'
  ];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('count')
      .limit(0);
      
    if (!error) {
      console.log(chalk.green(`✅ ${table} exists`));
    } else {
      console.log(chalk.red(`❌ ${table} does not exist`));
    }
  }
  
  // Check what we do have
  console.log(chalk.yellow('\n📊 ML Data Tables We Have:'));
  
  const { count: weatherCount } = await supabase
    .from('weather_data')
    .select('*', { count: 'exact', head: true });
    
  const { count: bettingCount } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true });
    
  const { count: injuryCount } = await supabase
    .from('player_injuries')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.blue(`weather_data: ${weatherCount || 0} records`));
  console.log(chalk.blue(`betting_lines: ${bettingCount || 0} records`));
  console.log(chalk.blue(`player_injuries: ${injuryCount || 0} records`));
}

checkMLTables().catch(console.error);