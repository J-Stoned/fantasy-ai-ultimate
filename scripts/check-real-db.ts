#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealDB() {
  console.log(chalk.bold.cyan('🔍 REAL DATABASE CHECK'));
  console.log(chalk.yellow('═'.repeat(50)));
  
  const tables = [
    'games', 
    'teams', 
    'players', 
    'news_articles',
    'player_stats',
    'player_injuries',
    'weather_data',
    'ml_predictions'
  ];
  
  let totalRecords = 0;
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(chalk.red(`❌ ${table}: ERROR - ${error.message}`));
      } else {
        console.log(chalk.green(`✅ ${table}: ${count?.toLocaleString()} records`));
        totalRecords += count || 0;
      }
    } catch (e) {
      console.log(chalk.red(`❌ ${table}: FAILED - ${e.message}`));
    }
  }
  
  console.log(chalk.yellow('\n═'.repeat(50)));
  console.log(chalk.bold.green(`📊 TOTAL: ${totalRecords.toLocaleString()} records`));
  
  // Check a sample game
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .limit(1)
    .single();
  
  if (sampleGame) {
    console.log(chalk.cyan('\n📍 Sample game:'));
    console.log(chalk.gray(JSON.stringify(sampleGame, null, 2).substring(0, 200) + '...'));
  }
}

checkRealDB().catch(console.error);