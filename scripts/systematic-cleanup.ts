#!/usr/bin/env tsx
/**
 * SYSTEMATIC CLEANUP - Step by step approach
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function systematicCleanup() {
  console.log(chalk.bold.cyan('🔧 SYSTEMATIC FAKE DATA CLEANUP\n'));
  
  // STEP 1: Understand the current state
  console.log(chalk.yellow('STEP 1: Current Database State'));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: nullGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total games: ${totalGames}`);
  console.log(`Games with NULL external_id: ${nullGames}`);
  console.log(`Total players: ${totalPlayers}`);
  
  // STEP 2: Test deletion on small batch
  console.log(chalk.yellow('\nSTEP 2: Testing deletion with 1 game'));
  
  // Get one NULL external_id game
  const { data: testGame } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
    .limit(1)
    .single();
    
  if (testGame) {
    console.log(`Test game ID: ${testGame.id}`);
    
    // Check for constraints
    const { count: relatedLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', testGame.id);
      
    console.log(`This game has ${relatedLogs} related game logs`);
    
    // Try to delete
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', testGame.id);
      
    if (error) {
      console.log(chalk.red('Delete failed:'), error.message);
      console.log(chalk.yellow('Trying cascade delete...'));
      
      // Delete related data first
      await supabase
        .from('player_game_logs')
        .delete()
        .eq('game_id', testGame.id);
        
      // Try again
      const { error: retry } = await supabase
        .from('games')
        .delete()
        .eq('id', testGame.id);
        
      if (retry) {
        console.log(chalk.red('Still failed:'), retry.message);
      } else {
        console.log(chalk.green('✅ Successfully deleted test game!'));
      }
    } else {
      console.log(chalk.green('✅ Successfully deleted test game!'));
    }
  }
  
  // STEP 3: Check if we can proceed
  const { count: remainingNull } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  if (remainingNull !== nullGames) {
    console.log(chalk.green('\n✅ Deletion is working! Can proceed with bulk delete.'));
    
    // STEP 4: Bulk delete in manageable chunks
    console.log(chalk.yellow('\nSTEP 4: Bulk deletion'));
    
    let totalDeleted = 0;
    const chunkSize = 100; // Small chunks to avoid timeouts
    
    while (true) {
      // Get chunk of NULL games
      const { data: chunk } = await supabase
        .from('games')
        .select('id')
        .is('external_id', null)
        .limit(chunkSize);
        
      if (!chunk || chunk.length === 0) {
        console.log(chalk.green('No more NULL games found!'));
        break;
      }
      
      const ids = chunk.map(g => g.id);
      
      // Delete related logs first
      await supabase
        .from('player_game_logs')
        .delete()
        .in('game_id', ids);
        
      // Delete games
      const { error, count } = await supabase
        .from('games')
        .delete()
        .in('id', ids);
        
      if (error) {
        console.error(chalk.red('Batch delete error:'), error.message);
        break;
      }
      
      if (count) {
        totalDeleted += count;
        console.log(chalk.gray(`Deleted ${count} games. Total: ${totalDeleted}`));
      }
      
      // Safety check
      if (totalDeleted > 100000) {
        console.log(chalk.yellow('Safety limit reached'));
        break;
      }
    }
    
    console.log(chalk.bold.green(`\n✅ DELETED ${totalDeleted} FAKE GAMES!`));
  } else {
    console.log(chalk.red('\n❌ Deletion not working. May need different approach.'));
    
    // Try using RPC or checking permissions
    console.log(chalk.yellow('\nChecking database permissions...'));
    
    // Test if we can create a simple function
    const { error } = await supabase.rpc('version');
    if (error) {
      console.log(chalk.red('RPC error:'), error.message);
    } else {
      console.log(chalk.green('RPC is working'));
    }
  }
  
  // STEP 5: Final summary
  console.log(chalk.cyan('\nFINAL SUMMARY:'));
  
  const { count: finalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: finalNull } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  console.log(`Total games: ${finalGames}`);
  console.log(`NULL games remaining: ${finalNull}`);
  console.log(`Games deleted: ${(nullGames || 0) - (finalNull || 0)}`);
}

systematicCleanup().catch(console.error);