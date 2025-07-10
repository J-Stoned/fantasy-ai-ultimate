import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function efficientCleanup() {
  console.log(chalk.bold.cyan('\n🧠 EFFICIENT CLEANUP STRATEGY\n'));
  
  try {
    // Step 1: Get all REAL game IDs (only ~4,000)
    console.log(chalk.yellow('Step 1: Identifying real games...'));
    const { data: realGames, error: realError } = await supabase
      .from('games')
      .select('id')
      .not('external_id', 'is', null);
      
    if (realError) throw realError;
    
    const realGameIds = realGames?.map(g => g.id) || [];
    console.log(chalk.green(`✓ Found ${realGameIds.length} real games to keep`));
    
    // Step 2: Delete player_stats NOT in real games (in chunks)
    console.log(chalk.yellow('\nStep 2: Cleaning player_stats...'));
    let statsDeleted = 0;
    
    // Delete in larger chunks since we're using NOT IN
    while (true) {
      const { count, error } = await supabase
        .from('player_stats')
        .delete()
        .not('game_id', 'in', `(${realGameIds.join(',')})`)
        .limit(10000); // Larger batches
        
      if (error || !count) break;
      
      statsDeleted += count;
      console.log(`  Deleted ${statsDeleted} fake player_stats so far...`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(chalk.green(`✓ Deleted ${statsDeleted} fake player_stats total`));
    
    // Step 3: Delete player_game_logs NOT in real games
    console.log(chalk.yellow('\nStep 3: Cleaning player_game_logs...'));
    const { count: logsDeleted } = await supabase
      .from('player_game_logs')
      .delete()
      .not('game_id', 'in', `(${realGameIds.join(',')})`);
      
    console.log(chalk.green(`✓ Deleted ${logsDeleted || 0} fake player_game_logs`));
    
    // Step 4: Delete fake games
    console.log(chalk.yellow('\nStep 4: Deleting fake games...'));
    const { count: gamesDeleted } = await supabase
      .from('games')
      .delete()
      .is('external_id', null);
      
    console.log(chalk.green(`✓ Deleted ${gamesDeleted || 0} fake games`));
    
    // Final status
    const { count: finalCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
      
    console.log(chalk.bold.green('\n✅ CLEANUP COMPLETE!'));
    console.log(chalk.cyan(`Final game count: ${finalCount}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Alternative: Create a server-side function
async function createCleanupFunction() {
  console.log(chalk.yellow('\nAlternative: Creating database function for cleanup...\n'));
  
  const functionSQL = `
    CREATE OR REPLACE FUNCTION cleanup_fake_games()
    RETURNS TABLE(deleted_games INT, deleted_stats INT) AS $$
    DECLARE
      games_count INT;
      stats_count INT;
    BEGIN
      -- Delete player_stats for fake games
      DELETE FROM player_stats 
      WHERE game_id IN (SELECT id FROM games WHERE external_id IS NULL);
      GET DIAGNOSTICS stats_count = ROW_COUNT;
      
      -- Delete player_game_logs for fake games
      DELETE FROM player_game_logs
      WHERE game_id IN (SELECT id FROM games WHERE external_id IS NULL);
      
      -- Delete fake games
      DELETE FROM games WHERE external_id IS NULL;
      GET DIAGNOSTICS games_count = ROW_COUNT;
      
      RETURN QUERY SELECT games_count, stats_count;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  console.log(chalk.cyan('To use this function in Supabase SQL editor:'));
  console.log(chalk.gray('1. Create the function with the SQL above'));
  console.log(chalk.gray('2. Then run: SELECT * FROM cleanup_fake_games();'));
}

// Run the efficient cleanup
efficientCleanup()
  .then(() => createCleanupFunction())
  .then(() => console.log(chalk.cyan('\nDone!\n')))
  .catch(console.error);