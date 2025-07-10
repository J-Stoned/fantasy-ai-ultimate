#!/usr/bin/env tsx
/**
 * Analyze game ID issues in player_stats
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeGameIds() {
  console.log(chalk.bold.cyan('\n🔍 ANALYZING GAME ID ISSUES\n'));
  
  // Get game ID range
  const { data: gameRange } = await supabase
    .from('games')
    .select('id')
    .order('id', { ascending: true })
    .limit(1);
    
  const { data: gameRangeMax } = await supabase
    .from('games')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
    
  const minGameId = gameRange?.[0]?.id || 0;
  const maxGameId = gameRangeMax?.[0]?.id || 0;
  
  console.log(chalk.yellow(`Game ID range: ${minGameId} - ${maxGameId}`));
  
  // Get player ID range
  const { data: playerRange } = await supabase
    .from('players')
    .select('id')
    .order('id', { ascending: true })
    .limit(1);
    
  const { data: playerRangeMax } = await supabase
    .from('players')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
    
  const minPlayerId = playerRange?.[0]?.id || 0;
  const maxPlayerId = playerRangeMax?.[0]?.id || 0;
  
  console.log(chalk.yellow(`Player ID range: ${minPlayerId} - ${maxPlayerId}`));
  
  // Check for stats with game_id in player range
  console.log(chalk.cyan('\n🔄 Checking for potential ID swaps...'));
  
  const { data: suspiciousStats, count } = await supabase
    .from('player_stats')
    .select('game_id, player_id, stat_type', { count: 'exact' })
    .gte('game_id', minPlayerId)
    .lte('game_id', maxPlayerId)
    .limit(10);
    
  if (count && count > 0) {
    console.log(chalk.red(`\n⚠️  Found ${count} stats where game_id is in player ID range!`));
    
    if (suspiciousStats) {
      for (const stat of suspiciousStats) {
        // Check if game_id is actually a player
        const { data: player } = await supabase
          .from('players')
          .select('firstname, lastname, sport_id')
          .eq('id', stat.game_id)
          .single();
          
        // Check if player_id is actually a game
        const { data: game } = await supabase
          .from('games')
          .select('external_id, sport_id')
          .eq('id', stat.player_id)
          .single();
          
        if (player && game) {
          console.log(chalk.red('\n🚨 CONFIRMED ID SWAP:'));
          console.log(`  game_id=${stat.game_id} is actually player: ${player.firstname} ${player.lastname}`);
          console.log(`  player_id=${stat.player_id} is actually game: ${game.external_id}`);
        }
      }
    }
  } else {
    console.log(chalk.green('✓ No obvious ID swaps found'));
  }
  
  // Check for orphaned stats (game_id not in games table)
  console.log(chalk.cyan('\n🔍 Checking for orphaned stats...'));
  
  const { data: allStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);
    
  if (allStats) {
    const uniqueGameIds = [...new Set(allStats.map(s => s.game_id))];
    
    const { data: validGames } = await supabase
      .from('games')
      .select('id')
      .in('id', uniqueGameIds);
      
    const validGameIds = new Set(validGames?.map(g => g.id) || []);
    const orphanedIds = uniqueGameIds.filter(id => !validGameIds.has(id));
    
    if (orphanedIds.length > 0) {
      console.log(chalk.red(`\n⚠️  Found ${orphanedIds.length} orphaned game IDs in stats!`));
      console.log('Examples:', orphanedIds.slice(0, 5));
      
      // Check if these are player IDs
      for (const orphanId of orphanedIds.slice(0, 3)) {
        const { data: player } = await supabase
          .from('players')
          .select('firstname, lastname')
          .eq('id', orphanId)
          .single();
          
        if (player) {
          console.log(chalk.red(`  ${orphanId} is player: ${player.firstname} ${player.lastname}`));
        }
      }
    } else {
      console.log(chalk.green('✓ All stats have valid game IDs'));
    }
  }
  
  // Get recent stats to see if issue is ongoing
  console.log(chalk.cyan('\n📅 Checking recent stats...'));
  
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('game_id, player_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (recentStats) {
    console.log('\nMost recent stats:');
    for (const stat of recentStats.slice(0, 5)) {
      const validGame = stat.game_id >= minGameId && stat.game_id <= maxGameId;
      const validPlayer = stat.player_id >= minPlayerId && stat.player_id <= maxPlayerId;
      
      console.log(`  Created: ${stat.created_at}`);
      console.log(`    Game ID: ${stat.game_id} ${validGame ? '✓' : '✗ INVALID'}`);
      console.log(`    Player ID: ${stat.player_id} ${validPlayer ? '✓' : '✗ INVALID'}`);
    }
  }
}

analyzeGameIds().catch(console.error);