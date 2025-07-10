#!/usr/bin/env tsx
/**
 * DELETE FAKE GAMES PROPERLY - Handle all constraints
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function deleteFakeGamesWithConstraints() {
  console.log(chalk.bold.red('🗑️ DELETING 82,755 FAKE GAMES WITH CONSTRAINTS\n'));
  
  const startTime = Date.now();
  let gamesProcessed = 0;
  let statsDeleted = 0;
  let gamesDeleted = 0;
  
  console.log(chalk.yellow('This will take time but WILL complete!\n'));
  
  while (true) {
    // Get a batch of NULL external_id games
    const { data: gameBatch, error: fetchError } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .limit(50); // Small batches
      
    if (fetchError || !gameBatch || gameBatch.length === 0) {
      console.log(chalk.green('\n✅ No more fake games found!'));
      break;
    }
    
    const gameIds = gameBatch.map(g => g.id);
    gamesProcessed += gameIds.length;
    
    // STEP 1: Delete player_stats for these games
    const { count: statsCount } = await supabase
      .from('player_stats')
      .delete()
      .in('game_id', gameIds);
      
    if (statsCount) {
      statsDeleted += statsCount;
    }
    
    // STEP 2: Delete player_game_logs
    await supabase
      .from('player_game_logs')
      .delete()
      .in('game_id', gameIds);
      
    // STEP 3: Delete any other related data
    await supabase.from('team_stats').delete().in('game_id', gameIds);
    await supabase.from('game_odds').delete().in('game_id', gameIds);
    await supabase.from('game_weather').delete().in('game_id', gameIds);
    
    // STEP 4: Now delete the games
    const { error: deleteError, count: deleteCount } = await supabase
      .from('games')
      .delete()
      .in('id', gameIds);
      
    if (deleteError) {
      console.error(chalk.red('Delete error:'), deleteError.message);
      // Continue anyway - some might succeed
    }
    
    if (deleteCount) {
      gamesDeleted += deleteCount;
    }
    
    // Progress update
    if (gamesProcessed % 1000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (gamesDeleted / (parseInt(elapsed) || 1)).toFixed(1);
      
      console.log(chalk.cyan(
        `Progress: ${gamesProcessed.toLocaleString()} processed | ` +
        `${gamesDeleted.toLocaleString()} deleted | ` +
        `${statsDeleted.toLocaleString()} stats removed | ` +
        `${rate} games/sec`
      ));
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(chalk.bold.green('\n✅ FAKE GAMES DELETION COMPLETE!\n'));
  console.log(chalk.cyan('Results:'));
  console.log(`Games processed: ${gamesProcessed.toLocaleString()}`);
  console.log(`Games deleted: ${gamesDeleted.toLocaleString()}`);
  console.log(`Stats deleted: ${statsDeleted.toLocaleString()}`);
  console.log(`Time: ${elapsed} seconds`);
  
  // Verify
  const { count: remaining } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  console.log(chalk.yellow(`\nGames with NULL external_id remaining: ${remaining}`));
  
  if (remaining === 0) {
    console.log(chalk.bold.green('🎉 ALL FAKE GAMES DELETED!'));
  } else {
    console.log(chalk.yellow('Run again to continue deletion...'));
  }
}

deleteFakeGamesWithConstraints().catch(console.error);