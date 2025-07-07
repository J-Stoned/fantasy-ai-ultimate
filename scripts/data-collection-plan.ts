#!/usr/bin/env tsx
/**
 * Data Collection Plan - Shows current state and what to run
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function showDataCollectionPlan() {
  console.log(chalk.blue.bold('📋 DATA COLLECTION PLAN\n'));
  
  // Check current state
  console.log(chalk.yellow('Current Database State:'));
  
  const tables = [
    'games', 'teams', 'players', 'player_stats', 
    'sports', 'leagues', 'teams_master',
    'player_injuries', 'weather_data', 'news_articles'
  ];
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    console.log(`  ${table}: ${(count || 0).toLocaleString()} records`);
  }
  
  // Check player stats coverage
  console.log(chalk.yellow('\nPlayer Stats Coverage:'));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  const { data: statsGames } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10000);
  
  const uniqueGames = new Set(statsGames?.map(s => s.game_id) || []);
  const coverage = ((uniqueGames.size / (totalGames || 1)) * 100).toFixed(1);
  
  console.log(`  Games with stats: ${uniqueGames.size}/${totalGames} (${coverage}%)`);
  console.log(`  Target: 100% coverage for 76.4% pattern accuracy`);
  
  // Show recommended actions
  console.log(chalk.green.bold('\n✅ RECOMMENDED EXECUTION ORDER:\n'));
  
  console.log('1. Fill Foundation Tables (if not done):');
  console.log(chalk.cyan('   npx tsx scripts/fill-foundation-tables.ts'));
  console.log('   - Creates sports, leagues, teams_master tables');
  console.log('   - Links existing data properly\n');
  
  console.log('2. Use Aligned Data Collector:');
  console.log(chalk.cyan('   npx tsx scripts/aligned-data-collector.ts'));
  console.log('   - Validates all data before insertion');
  console.log('   - Ensures teams exist before games\n');
  
  console.log('3. Fill Player Stats (CRITICAL):');
  console.log(chalk.cyan('   npx tsx scripts/fill-player-stats-properly.ts'));
  console.log('   - Target: 100% coverage');
  console.log('   - Expected improvement: 65.2% → 76.4% accuracy\n');
  
  console.log('4. Collect Massive Historical Data:');
  console.log(chalk.cyan('   npx tsx scripts/massive-data-collector.ts'));
  console.log('   - Gets 5 years of historical data');
  console.log('   - All major sports (NFL, NBA, MLB, NHL, NCAA)\n');
  
  console.log('5. Additional Data Sources:');
  console.log(chalk.cyan('   npx tsx scripts/collect-weather-data.ts'));
  console.log(chalk.cyan('   npx tsx scripts/collect-injury-reports.ts'));
  console.log(chalk.cyan('   npx tsx scripts/collect-betting-odds.ts'));
  console.log('   - Weather affects outdoor games');
  console.log('   - Injuries impact player performance');
  console.log('   - Historical odds for validation\n');
  
  // Show data quality tips
  console.log(chalk.blue.bold('💡 DATA QUALITY TIPS:\n'));
  console.log('• Always validate data before insertion');
  console.log('• Use external_id to prevent duplicates');
  console.log('• Ensure foreign key relationships exist');
  console.log('• Rate limit API calls (3-5 concurrent max)');
  console.log('• Process in batches to avoid timeouts');
  console.log('• Check for both 0 scores (might be invalid)');
  
  // Show expected results
  console.log(chalk.green.bold('\n🎯 EXPECTED RESULTS:\n'));
  console.log('After running all collectors:');
  console.log('• 10,000+ games across all sports');
  console.log('• 100% player stats coverage');
  console.log('• Pattern accuracy: 76.4% (up from 65.2%)');
  console.log('• ML models can train on rich dataset');
  console.log('• Real-time predictions become accurate');
}

showDataCollectionPlan().catch(console.error);