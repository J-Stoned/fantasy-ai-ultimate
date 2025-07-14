#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function investigateStatsAnomaly() {
  console.log(chalk.bold.red('\n🔍 INVESTIGATING STATS ANOMALY - 3.6M RECORDS FOR 9 GAMES?\n'));
  console.log(chalk.gray('━'.repeat(60)));
  
  try {
    // 1. Look at actual data samples
    console.log(chalk.yellow('📊 Sample player_stats records:\n'));
    
    const { data: samples } = await supabase
      .from('player_stats')
      .select('*')
      .limit(10);
    
    samples?.forEach((sample, i) => {
      console.log(chalk.cyan(`Record ${i + 1}:`));
      console.log(chalk.white(JSON.stringify(sample, null, 2)));
      console.log(chalk.gray('─'.repeat(40)));
    });
    
    // 2. Get unique game_ids
    console.log(chalk.yellow('\n🎮 Unique game IDs in player_stats:\n'));
    
    const { data: gameIds } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null)
      .order('game_id')
      .limit(100);
    
    const uniqueGameIds = [...new Set(gameIds?.map(g => g.game_id))];
    console.log(chalk.white(`Unique games found: ${uniqueGameIds.length}`));
    console.log(chalk.gray('Game IDs: ' + uniqueGameIds.slice(0, 10).join(', ') + '...'));
    
    // 3. Get unique player_ids
    console.log(chalk.yellow('\n👤 Unique player IDs in player_stats:\n'));
    
    const { data: playerIds } = await supabase
      .from('player_stats')
      .select('player_id')
      .not('player_id', 'is', null)
      .order('player_id')
      .limit(100);
    
    const uniquePlayerIds = [...new Set(playerIds?.map(p => p.player_id))];
    console.log(chalk.white(`Unique players found: ${uniquePlayerIds.length}`));
    console.log(chalk.gray('Player IDs: ' + uniquePlayerIds.slice(0, 10).join(', ') + '...'));
    
    // 4. Check stat_type distribution
    console.log(chalk.yellow('\n📈 Stat type distribution:\n'));
    
    const { data: statTypes } = await supabase
      .from('player_stats')
      .select('stat_type, stat_value')
      .limit(1000);
    
    const typeCount = new Map<string, number>();
    statTypes?.forEach(s => {
      const type = s.stat_type || 'NULL';
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    });
    
    const sorted = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([type, count]) => {
      console.log(chalk.white(`  ${type.padEnd(30)}: ${count}`));
    });
    
    // 5. Check if these are the same records repeated
    console.log(chalk.yellow('\n🔄 Checking for repeated patterns:\n'));
    
    const { data: pattern } = await supabase
      .from('player_stats')
      .select('player_id, game_id, stat_type, stat_value')
      .eq('game_id', uniqueGameIds[0])
      .limit(20);
    
    console.log(chalk.white(`Stats for game ${uniqueGameIds[0]}:`));
    pattern?.forEach(p => {
      console.log(chalk.gray(`  Player ${p.player_id}: ${p.stat_type} = ${p.stat_value}`));
    });
    
    // 6. Check created_at timestamps
    console.log(chalk.yellow('\n📅 Checking timestamps:\n'));
    
    const { data: timestamps } = await supabase
      .from('player_stats')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log(chalk.white('Latest entries created at:'));
    timestamps?.forEach(t => {
      console.log(chalk.gray(`  ${new Date(t.created_at).toISOString()}`));
    });
    
    const { data: oldestTimestamps } = await supabase
      .from('player_stats')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(5);
    
    console.log(chalk.white('\nOldest entries created at:'));
    oldestTimestamps?.forEach(t => {
      console.log(chalk.gray(`  ${new Date(t.created_at).toISOString()}`));
    });
    
    // 7. Look for specific patterns
    console.log(chalk.yellow('\n🎯 Looking for data patterns:\n'));
    
    // Check if stat_value is always the same
    const { data: valueCheck } = await supabase
      .from('player_stats')
      .select('stat_value')
      .limit(100);
    
    const uniqueValues = new Set(valueCheck?.map(v => v.stat_value));
    console.log(chalk.white(`Unique stat values in sample: ${uniqueValues.size}`));
    if (uniqueValues.size < 10) {
      console.log(chalk.gray('Values: ' + Array.from(uniqueValues).join(', ')));
    }
    
    // 8. Check table structure
    console.log(chalk.yellow('\n🏗️ Checking table structure:\n'));
    
    const { data: columns } = await supabase.rpc('get_table_columns', {
      table_name: 'player_stats'
    }).catch(() => ({ data: null }));
    
    if (columns) {
      console.log(chalk.white('Table columns:'));
      columns.forEach((col: any) => {
        console.log(chalk.gray(`  ${col.column_name} (${col.data_type})`));
      });
    }
    
    // 9. Final analysis
    console.log(chalk.gray('\n━'.repeat(60)));
    console.log(chalk.bold.green('\n🎯 ANOMALY ANALYSIS:\n'));
    
    console.log(chalk.yellow('The issue appears to be:'));
    console.log(chalk.white('1. The 3.6M records are concentrated on just 9 games'));
    console.log(chalk.white('2. This suggests either:'));
    console.log(chalk.cyan('   a) Test data that was duplicated many times'));
    console.log(chalk.cyan('   b) A data import error that created millions of duplicates'));
    console.log(chalk.cyan('   c) Real-time data collection that creates many entries per game'));
    console.log(chalk.white('\n3. To make this data ML-accessible, we need to:'));
    console.log(chalk.green('   ✓ Identify and remove duplicates'));
    console.log(chalk.green('   ✓ Aggregate stats properly by player/game'));
    console.log(chalk.green('   ✓ Create a clean, deduplicated dataset'));
    console.log(chalk.green('   ✓ Build proper indexes for efficient queries\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

// Run investigation
investigateStatsAnomaly();