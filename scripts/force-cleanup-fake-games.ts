import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function deleteInBatches() {
  console.log(chalk.bold.red('\n🔥 FORCE CLEANUP - DELETING FAKE GAMES\n'));
  
  let totalDeleted = 0;
  let iteration = 0;
  
  while (true) {
    iteration++;
    console.log(chalk.yellow(`\nIteration ${iteration}:`));
    
    // Get batch of fake game IDs
    const { data: fakeGames, error: fetchError } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .limit(100);
      
    if (fetchError) {
      console.error('Error fetching games:', fetchError);
      break;
    }
    
    if (!fakeGames || fakeGames.length === 0) {
      console.log(chalk.green('✅ No more fake games found!'));
      break;
    }
    
    const gameIds = fakeGames.map(g => g.id);
    console.log(`  Found ${gameIds.length} fake games to delete`);
    
    // Delete related player_stats
    const { error: statsError, count: statsDeleted } = await supabase
      .from('player_stats')
      .delete()
      .in('game_id', gameIds);
      
    if (statsError) {
      console.error('Error deleting player_stats:', statsError);
    } else {
      console.log(`  Deleted ${statsDeleted || 0} player_stats records`);
    }
    
    // Delete related player_game_logs
    const { error: logsError, count: logsDeleted } = await supabase
      .from('player_game_logs')
      .delete()
      .in('game_id', gameIds);
      
    if (logsError) {
      console.error('Error deleting player_game_logs:', logsError);
    } else {
      console.log(`  Deleted ${logsDeleted || 0} player_game_logs records`);
    }
    
    // Delete the games
    const { error: gamesError, count: gamesDeleted } = await supabase
      .from('games')
      .delete()
      .in('id', gameIds);
      
    if (gamesError) {
      console.error('Error deleting games:', gamesError);
      break;
    }
    
    console.log(chalk.green(`  ✓ Deleted ${gamesDeleted || 0} games`));
    totalDeleted += (gamesDeleted || 0);
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(chalk.bold.green(`\n✅ CLEANUP COMPLETE! Deleted ${totalDeleted} fake games total.\n`));
  
  // Show final status
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: realGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
    
  console.log(chalk.cyan('FINAL STATUS:'));
  console.log(`  Total games: ${totalGames}`);
  console.log(`  Real games: ${realGames}`);
  console.log(`  Fake games remaining: ${(totalGames || 0) - (realGames || 0)}`);
}

// Run the cleanup
deleteInBatches()
  .then(() => {
    console.log(chalk.cyan('\nCleanup script finished.\n'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Cleanup failed:'), error);
    process.exit(1);
  });