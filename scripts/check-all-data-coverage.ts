#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllDataTypes() {
  console.log(chalk.bold.cyan('📊 COMPREHENSIVE DATA COVERAGE CHECK\n'));
  
  // Check all data tables
  const tables = [
    'player_game_logs',
    'player_injuries', 
    'weather_data',
    'ml_predictions',
    'news_articles',
    'players',
    'teams',
    'games'
  ];
  
  let grandTotal = 0;
  const tableCounts: Record<string, number> = {};
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
      
    if (!error && count !== null) {
      tableCounts[table] = count;
      grandTotal += count;
      console.log(`${table}: ${chalk.green(count.toLocaleString())}`);
    } else {
      console.log(`${table}: ${chalk.red('ERROR or 0')}`);
    }
  }
  
  console.log(`\n🎯 GRAND TOTAL: ${chalk.yellow(grandTotal.toLocaleString())} records`);
  
  // Check injuries breakdown
  console.log(chalk.bold.cyan('\n🏥 INJURIES BY SPORT:'));
  const injurySports = ['NBA', 'NFL', 'NHL', 'MLB'];
  for (const sport of injurySports) {
    const { count } = await supabase
      .from('player_injuries')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    console.log(`  ${sport}: ${count || 0}`);
  }
  
  // Check weather data
  console.log(chalk.bold.cyan('\n🌤️  WEATHER DATA:'));
  const { data: weatherSample } = await supabase
    .from('weather_data')
    .select('*')
    .limit(5);
  console.log(`  Total records: ${tableCounts['weather_data'] || 0}`);
  if (weatherSample && weatherSample.length > 0) {
    console.log(`  Sample: ${weatherSample[0].game_id} - ${weatherSample[0].temperature}°F`);
  }
  
  // Check ML predictions
  console.log(chalk.bold.cyan('\n🤖 ML PREDICTIONS:'));
  const { count: predCount } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true });
  console.log(`  Total predictions: ${predCount || 0}`);
  
  // Summary
  console.log(chalk.bold.yellow('\n📈 10X DATA EMPIRE:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`Player Game Logs: ${tableCounts['player_game_logs']?.toLocaleString() || 0}`);
  console.log(`Players: ${tableCounts['players']?.toLocaleString() || 0}`);
  console.log(`Games: ${tableCounts['games']?.toLocaleString() || 0}`);
  console.log(`News Articles: ${tableCounts['news_articles']?.toLocaleString() || 0}`);
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.green(`TOTAL DATABASE: ${grandTotal.toLocaleString()} records!`));
}

checkAllDataTypes().catch(console.error);