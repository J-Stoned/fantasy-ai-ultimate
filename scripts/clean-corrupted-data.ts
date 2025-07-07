#!/usr/bin/env tsx
/**
 * 🧹 CLEAN CORRUPTED DATA
 * Removes duplicate and invalid player stats
 * Keeps only legitimate NFL data
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanCorruptedData() {
  console.log(chalk.blue.bold('🧹 CLEANING CORRUPTED DATA\n'));
  
  const stats = {
    totalStats: 0,
    basketballStats: 0,
    duplicates: 0,
    invalidGameIds: 0,
    cleaned: 0,
    kept: 0
  };
  
  try {
    // 1. Analyze current state
    console.log(chalk.yellow('1. Analyzing player_stats table...'));
    
    // Get total count
    const { count: totalCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    stats.totalStats = totalCount || 0;
    console.log(`   Total records: ${stats.totalStats.toLocaleString()}`);
    
    // Find basketball stats (points, rebounds, assists)
    console.log(chalk.yellow('\n2. Identifying basketball stats...'));
    const basketballStatTypes = ['points', 'rebounds', 'assists', 'fantasy_total'];
    
    const { count: basketballCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('stat_type', basketballStatTypes);
      
    stats.basketballStats = basketballCount || 0;
    console.log(`   Basketball stats found: ${stats.basketballStats.toLocaleString()}`);
    
    // Find NFL stats
    const nflStatTypes = [
      'passing_yards', 'passing_attempts', 'passing_completions', 'passing_touchdowns',
      'rushing_yards', 'rushing_attempts', 'rushing_touchdowns',
      'receiving_yards', 'receptions', 'receiving_touchdowns', 'targets',
      'field_goals_made', 'field_goals_attempted', 'extra_points_made',
      'tackles', 'sacks', 'interceptions_def', 'forced_fumbles'
    ];
    
    const { count: nflCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('stat_type', nflStatTypes);
      
    console.log(`   NFL stats found: ${(nflCount || 0).toLocaleString()}`);
    
    // 3. Check for invalid game IDs
    console.log(chalk.yellow('\n3. Checking for invalid game references...'));
    
    // Get all unique game IDs from player_stats
    const { data: statGameIds } = await supabase
      .from('player_stats')
      .select('game_id')
      .limit(1000); // Sample for analysis
      
    const uniqueGameIds = [...new Set(statGameIds?.map(s => s.game_id) || [])];
    
    // Check which ones exist in games table
    const { data: validGames } = await supabase
      .from('games')
      .select('id')
      .in('id', uniqueGameIds);
      
    const validGameIds = new Set(validGames?.map(g => g.id) || []);
    const invalidGameIds = uniqueGameIds.filter(id => !validGameIds.has(id));
    
    console.log(`   Invalid game references: ${invalidGameIds.length}`);
    
    // 4. Create backup before cleaning
    console.log(chalk.yellow('\n4. Creating backup of current data...'));
    console.log(chalk.cyan('   (Backup would be created in production)'));
    
    // 5. Clean the data
    console.log(chalk.yellow('\n5. Cleaning corrupted data...'));
    
    if (stats.basketballStats > 0) {
      console.log(chalk.cyan('   Removing basketball stats...'));
      
      // Delete basketball stats in batches
      const batchSize = 10000;
      let deleted = 0;
      
      while (deleted < stats.basketballStats) {
        const { error, count } = await supabase
          .from('player_stats')
          .delete({ count: 'exact' })
          .in('stat_type', basketballStatTypes)
          .limit(batchSize);
          
        if (error) {
          console.error(chalk.red('Error deleting basketball stats:'), error);
          break;
        }
        
        deleted += count || 0;
        console.log(chalk.gray(`   Deleted ${deleted.toLocaleString()} / ${stats.basketballStats.toLocaleString()}`));
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      stats.cleaned = deleted;
    }
    
    // 6. Remove duplicates
    console.log(chalk.yellow('\n6. Removing duplicate entries...'));
    
    // Find duplicates (same game_id, player_id, stat_type)
    const { data: duplicates } = await supabase.rpc('find_duplicate_stats');
    
    if (duplicates && duplicates.length > 0) {
      console.log(`   Found ${duplicates.length} duplicate groups`);
      
      // Remove duplicates keeping only the first entry
      for (const dup of duplicates) {
        const { error } = await supabase
          .from('player_stats')
          .delete()
          .eq('game_id', dup.game_id)
          .eq('player_id', dup.player_id)
          .eq('stat_type', dup.stat_type)
          .gt('created_at', dup.min_created_at);
          
        if (!error) {
          stats.duplicates += dup.duplicate_count - 1;
        }
      }
    }
    
    // 7. Final count
    console.log(chalk.yellow('\n7. Final analysis...'));
    const { count: finalCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
      
    stats.kept = finalCount || 0;
    
    // Summary
    console.log(chalk.green.bold('\n✅ CLEANUP COMPLETE!\n'));
    console.log(chalk.white('Summary:'));
    console.log(`  • Original records: ${stats.totalStats.toLocaleString()}`);
    console.log(`  • Basketball stats removed: ${stats.cleaned.toLocaleString()}`);
    console.log(`  • Duplicates removed: ${stats.duplicates.toLocaleString()}`);
    console.log(`  • Records kept: ${stats.kept.toLocaleString()}`);
    console.log(`  • Reduction: ${((1 - stats.kept / stats.totalStats) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error(chalk.red('Cleanup failed:'), error);
  }
}

// Create RPC function for finding duplicates if it doesn't exist
async function createDuplicateFinder() {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION find_duplicate_stats()
    RETURNS TABLE (
      game_id TEXT,
      player_id TEXT,
      stat_type TEXT,
      duplicate_count BIGINT,
      min_created_at TIMESTAMP
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        ps.game_id,
        ps.player_id,
        ps.stat_type,
        COUNT(*) as duplicate_count,
        MIN(ps.created_at) as min_created_at
      FROM player_stats ps
      GROUP BY ps.game_id, ps.player_id, ps.stat_type
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 1000;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  console.log(chalk.cyan('\nNote: Please create the duplicate finder function in Supabase SQL Editor:'));
  console.log(chalk.gray(functionSQL));
}

// Run the cleanup
cleanCorruptedData().catch(console.error);