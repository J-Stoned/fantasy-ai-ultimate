import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function ultraSmallCleanup() {
  console.log(chalk.bold.red('\n🔥 ULTRA SMALL BATCH CLEANUP\n'));
  
  let totalDeleted = 0;
  let iteration = 0;
  const BATCH_SIZE = 10; // Super small batches
  
  while (totalDeleted < 1000) { // Just do 1000 for now
    iteration++;
    
    // Get just 10 fake game IDs
    const { data: fakeGames, error: fetchError } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .limit(BATCH_SIZE);
      
    if (fetchError || !fakeGames || fakeGames.length === 0) {
      break;
    }
    
    // Delete one by one to avoid timeouts
    for (const game of fakeGames) {
      try {
        // Delete player_stats for this game
        await supabase
          .from('player_stats')
          .delete()
          .eq('game_id', game.id);
        
        // Delete player_game_logs for this game  
        await supabase
          .from('player_game_logs')
          .delete()
          .eq('game_id', game.id);
        
        // Delete the game
        const { error } = await supabase
          .from('games')
          .delete()
          .eq('id', game.id);
          
        if (!error) {
          totalDeleted++;
          if (totalDeleted % 100 === 0) {
            console.log(chalk.green(`Progress: ${totalDeleted} games deleted...`));
          }
        }
      } catch (err) {
        console.error(`Failed to delete game ${game.id}:`, err);
      }
    }
  }
  
  console.log(chalk.bold.green(`\n✅ Deleted ${totalDeleted} fake games!\n`));
  
  // Check remaining
  const { count: remaining } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  console.log(chalk.yellow(`Remaining fake games: ${remaining}`));
  console.log(chalk.cyan('\nRun this script multiple times to continue cleanup.\n'));
}

// Run
ultraSmallCleanup()
  .catch(console.error);