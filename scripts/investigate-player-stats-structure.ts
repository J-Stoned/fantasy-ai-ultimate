#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE PLAYER STATS STRUCTURE
 * Check what's actually in the player_stats table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigate() {
  console.log(chalk.bold.blue('\n🔍 INVESTIGATING PLAYER_STATS STRUCTURE\n'));
  
  // Get sample records
  const { data: sampleStats, error } = await supabase
    .from('player_stats')
    .select('*')
    .limit(5);
  
  if (error) {
    console.error('Error fetching player_stats:', error);
    return;
  }
  
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.yellow('📊 Sample player_stats record:'));
    console.log(JSON.stringify(sampleStats[0], null, 2));
    
    console.log(chalk.yellow('\n🔑 Columns in player_stats:'));
    console.log(Object.keys(sampleStats[0]));
    
    // Check if game_id exists
    if ('game_id' in sampleStats[0]) {
      console.log(chalk.green('\n✅ game_id column exists!'));
      
      // Count unique game_ids
      const { data: gameIds } = await supabase
        .from('player_stats')
        .select('game_id')
        .not('game_id', 'is', null);
      
      const uniqueGameIds = new Set(gameIds?.map(g => g.game_id) || []);
      console.log(chalk.white(`Unique game_ids: ${uniqueGameIds.size}`));
    } else {
      console.log(chalk.red('\n❌ game_id column does NOT exist'));
      console.log(chalk.yellow('This table appears to store seasonal stats, not game-by-game stats'));
    }
    
    // Check the stats field structure
    if (sampleStats[0].stats) {
      console.log(chalk.yellow('\n📈 Stats field structure:'));
      console.log(JSON.stringify(sampleStats[0].stats, null, 2));
    }
  } else {
    console.log(chalk.red('No records found in player_stats table'));
  }
  
  // Check recent insertions
  console.log(chalk.yellow('\n⏰ Recent player_stats insertions:'));
  
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('created_at, player_id, season, season_type')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentStats) {
    recentStats.forEach(stat => {
      console.log(chalk.white(`   ${stat.created_at} - Player: ${stat.player_id}, Season: ${stat.season}, Type: ${stat.season_type}`));
    });
  }
  
  // Count by season_type
  console.log(chalk.yellow('\n📊 Stats by season_type:'));
  
  const seasonTypes = ['regular', 'playoffs', 'preseason'];
  for (const type of seasonTypes) {
    const { count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('season_type', type);
    
    console.log(chalk.white(`   ${type}: ${count || 0}`));
  }
}

investigate().catch(console.error);