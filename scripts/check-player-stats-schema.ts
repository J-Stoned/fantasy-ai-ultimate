#!/usr/bin/env tsx
/**
 * Check player_stats table schema and data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerStatsSchema() {
  console.log(chalk.blue('\n=== PLAYER_STATS TABLE INVESTIGATION ===\n'));
  
  // 1. Check if table exists and get sample data
  const { data: sampleData, error: sampleError } = await supabase
    .from('player_stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (sampleError) {
    console.log(chalk.red('Error accessing player_stats:'), sampleError.message);
    console.log(chalk.yellow('\nThis might mean the table has a different schema than expected.'));
  } else {
    console.log(chalk.green(`✓ Found ${sampleData?.length || 0} records in player_stats`));
    
    if (sampleData && sampleData.length > 0) {
      console.log(chalk.cyan('\nSample record structure:'));
      const sample = sampleData[0];
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        const preview = type === 'object' ? JSON.stringify(value).slice(0, 50) + '...' : value;
        console.log(`  ${key}: ${type} - ${preview}`);
      });
      
      // Check specific columns we care about
      console.log(chalk.cyan('\n=== Column Analysis ==='));
      console.log('Has game_id column?', 'game_id' in sample ? chalk.green('YES') : chalk.red('NO'));
      console.log('Has stat_type column?', 'stat_type' in sample ? chalk.green('YES') : chalk.red('NO'));
      console.log('Has stat_value column?', 'stat_value' in sample ? chalk.green('YES') : chalk.red('NO'));
      console.log('Has stats column?', 'stats' in sample ? chalk.green('YES') : chalk.red('NO'));
      console.log('Has season column?', 'season' in sample ? chalk.green('YES') : chalk.red('NO'));
    }
  }
  
  // 2. Check which schema is actually active
  console.log(chalk.cyan('\n=== CHECKING ACTUAL SCHEMA ==='));
  
  // Try to insert a test record to see what columns are expected
  const testRecord = {
    player_id: 1,
    game_id: 1,
    stat_type: 'test',
    stats: { test: true }
  };
  
  const { error: insertError } = await supabase
    .from('player_stats')
    .insert(testRecord)
    .select();
  
  if (insertError) {
    console.log(chalk.yellow('Insert test error (expected):'), insertError.message);
    
    // Parse error to understand schema
    if (insertError.message.includes('violates foreign key')) {
      console.log(chalk.green('✓ Table expects game_id (foreign key constraint)'));
    }
    if (insertError.message.includes('null value in column')) {
      const match = insertError.message.match(/null value in column "(\w+)"/);
      if (match) {
        console.log(chalk.yellow(`Required column: ${match[1]}`));
      }
    }
  }
  
  // 3. Check games that should have stats
  console.log(chalk.cyan('\n=== GAMES WITH STATS CHECK ==='));
  
  const { data: recentGames, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, start_time')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(10);
  
  if (!gamesError && recentGames) {
    console.log(chalk.green(`\nFound ${recentGames.length} recent completed games`));
    
    // Check how many have stats
    for (const game of recentGames.slice(0, 3)) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      console.log(`\nGame ${game.id} (${game.external_id}):`);
      console.log(`  Stats records: ${count || 0}`);
    }
  }
  
  // 4. Look for the actual schema being used
  console.log(chalk.cyan('\n=== MIGRATION HISTORY CHECK ==='));
  
  // Check if there's a season-based schema in use
  const { data: seasonStats, error: seasonError } = await supabase
    .from('player_stats')
    .select('*')
    .not('season', 'is', null)
    .limit(5);
  
  if (!seasonError && seasonStats && seasonStats.length > 0) {
    console.log(chalk.yellow('\n⚠️  Found season-based stats (original schema from 001_initial_schema.sql)'));
    console.log('Sample season stat:', seasonStats[0]);
  }
  
  // Check if there's a game-based schema in use
  const { data: gameStats, error: gameError } = await supabase
    .from('player_stats')
    .select('*')
    .not('game_id', 'is', null)
    .limit(5);
  
  if (!gameError && gameStats && gameStats.length > 0) {
    console.log(chalk.green('\n✓ Found game-based stats (new schema from 20250102_create_missing_tables.sql)'));
    console.log('Sample game stat:', gameStats[0]);
  }
  
  console.log(chalk.blue('\n=== SUMMARY ==='));
  console.log(chalk.yellow('\nIt appears there might be a schema conflict between:'));
  console.log('1. Original schema (001_initial_schema.sql): season-based aggregated stats');
  console.log('2. New schema (20250102_create_missing_tables.sql): game-based individual stats');
  console.log('\nThe database writer is trying to insert game-based stats, but the table might still have the old schema.');
}

checkPlayerStatsSchema().catch(console.error);