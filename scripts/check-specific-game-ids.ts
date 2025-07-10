#!/usr/bin/env tsx
/**
 * Check specific game IDs mentioned by user
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSpecificIds() {
  console.log(chalk.bold.cyan('\n🔍 CHECKING SPECIFIC GAME IDs\n'));
  
  // The IDs mentioned by user
  const suspectIds = [3583195, 3697518];
  
  for (const gameId of suspectIds) {
    console.log(chalk.yellow(`\nChecking game_id: ${gameId}`));
    
    // Check if it exists in games table
    const { data: game } = await supabase
      .from('games')
      .select('id, external_id, sport_id, home_score, away_score, start_time')
      .eq('id', gameId)
      .single();
      
    if (game) {
      console.log(chalk.green('✓ Found in games table:'));
      console.log(`  External ID: ${game.external_id}`);
      console.log(`  Sport: ${game.sport_id}`);
      console.log(`  Score: ${game.home_score} - ${game.away_score}`);
      console.log(`  Date: ${game.start_time}`);
    } else {
      console.log(chalk.red('✗ NOT found in games table'));
      
      // Check if it's a player ID
      const { data: player } = await supabase
        .from('players')
        .select('id, firstname, lastname, sport_id')
        .eq('id', gameId)
        .single();
        
      if (player) {
        console.log(chalk.red(`⚠️  This is a PLAYER ID: ${player.firstname} ${player.lastname} (${player.sport_id})`));
      }
    }
    
    // Check stats for this game_id
    const { data: stats, count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: false })
      .eq('game_id', gameId)
      .limit(5);
      
    console.log(chalk.cyan(`  Stats with this game_id: ${count || 0}`));
    
    if (stats && stats.length > 0) {
      console.log(chalk.yellow('  Sample stats:'));
      for (const stat of stats) {
        const { data: player } = await supabase
          .from('players')
          .select('firstname, lastname')
          .eq('id', stat.player_id)
          .single();
          
        console.log(`    Player: ${player?.firstname} ${player?.lastname}, Type: ${stat.stat_type}, Value: ${stat.stat_value}`);
      }
    }
  }
  
  // Let's check if there's a pattern where player_id and game_id are swapped
  console.log(chalk.bold.cyan('\n\n🔄 CHECKING FOR SWAPPED IDs\n'));
  
  const { data: swappedStats } = await supabase
    .from('player_stats')
    .select('game_id, player_id')
    .in('game_id', suspectIds)
    .limit(10);
    
  if (swappedStats && swappedStats.length > 0) {
    for (const stat of swappedStats) {
      // Check if the player_id is actually a valid game
      const { data: possibleGame } = await supabase
        .from('games')
        .select('id, external_id')
        .eq('id', stat.player_id)
        .single();
        
      if (possibleGame) {
        console.log(chalk.red(`⚠️  FOUND SWAPPED IDs!`));
        console.log(`  Stat has game_id=${stat.game_id} (which is a player) and player_id=${stat.player_id} (which is game ${possibleGame.external_id})`);
      }
    }
  }
}

checkSpecificIds().catch(console.error);