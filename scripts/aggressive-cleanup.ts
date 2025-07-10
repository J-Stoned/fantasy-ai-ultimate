import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function aggressiveCleanup() {
  console.log(chalk.bold.red('\n🚀 AGGRESSIVE BATCH CLEANUP\n'));
  
  let totalDeleted = 0;
  let iteration = 0;
  const BATCH_SIZE = 1000; // Even larger batches
  const TARGET_DELETIONS = 10000; // Delete 10k at a time
  
  while (totalDeleted < TARGET_DELETIONS) {
    iteration++;
    
    // Get batch of fake game IDs
    const { data: fakeGames, error: fetchError } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .limit(BATCH_SIZE);
      
    if (fetchError || !fakeGames || fakeGames.length === 0) {
      console.log(chalk.yellow('No more fake games found or error occurred'));
      break;
    }
    
    const gameIds = fakeGames.map(g => g.id);
    console.log(chalk.gray(`Batch ${iteration}: Deleting ${gameIds.length} games...`));
    
    try {
      // Delete all related data in parallel for speed
      const [statsResult, logsResult, gamesResult] = await Promise.all([
        // Delete player_stats
        supabase
          .from('player_stats')
          .delete()
          .in('game_id', gameIds),
          
        // Delete player_game_logs  
        supabase
          .from('player_game_logs')
          .delete()
          .in('game_id', gameIds),
          
        // Delete games (slight delay to ensure related data deleted first)
        new Promise(resolve => setTimeout(resolve, 100)).then(() =>
          supabase
            .from('games')
            .delete()
            .in('id', gameIds)
        )
      ]);
      
      const gamesDeleted = gamesResult.count || gameIds.length;
      totalDeleted += gamesDeleted;
      
      console.log(chalk.green(`  ✓ Batch ${iteration} complete: ${totalDeleted} total games deleted`));
      
    } catch (err) {
      console.error(chalk.red(`Error in batch ${iteration}:`), err);
      // Continue with next batch even if this one fails
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(chalk.bold.green(`\n✅ Deleted ${totalDeleted} fake games in this run!\n`));
  
  // Check remaining
  const { count: remaining } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  const { count: total } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.cyan('DATABASE STATUS:'));
  console.log(`  Total games: ${total}`);
  console.log(`  Fake games remaining: ${remaining}`);
  console.log(`  Real games: ${(total || 0) - (remaining || 0)}`);
  
  if (remaining && remaining > 0) {
    console.log(chalk.yellow(`\nRun this script ${Math.ceil(remaining / TARGET_DELETIONS)} more times to finish cleanup.\n`));
  } else {
    console.log(chalk.bold.green('\n🎉 ALL FAKE GAMES DELETED! DATABASE IS CLEAN!\n'));
  }
}

// Run
aggressiveCleanup()
  .catch(console.error);