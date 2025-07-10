#!/usr/bin/env tsx
/**
 * Check for problematic game IDs in player_stats
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBadGameIds() {
  console.log(chalk.bold.cyan('\n🔍 CHECKING FOR BAD GAME IDs\n'));
  
  // Check max game_id in games table
  const { data: maxGame } = await supabase
    .from('games')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
    
  const maxGameId = maxGame?.[0]?.id || 0;
  console.log(chalk.yellow(`Max game ID in games table: ${maxGameId}`));
  
  // Check for stats with game_id > max
  const { data: badStats, count } = await supabase
    .from('player_stats')
    .select('game_id', { count: 'exact', head: true })
    .gt('game_id', maxGameId);
    
  console.log(chalk.red(`\nStats with game_id > ${maxGameId}: ${count || 0}`));
  
  // Get some examples
  if (count && count > 0) {
    const { data: examples } = await supabase
      .from('player_stats')
      .select('id, game_id, player_id, stat_type, created_at')
      .gt('game_id', maxGameId)
      .order('game_id')
      .limit(10);
      
    console.log(chalk.yellow('\nExample bad stats:'));
    examples?.forEach(stat => {
      console.log(`  Game ID: ${stat.game_id}, Player: ${stat.player_id}, Type: ${stat.stat_type}, Created: ${stat.created_at}`);
    });
    
    // Check if these game_ids look like player_ids
    const uniqueBadGameIds = [...new Set(examples?.map(s => s.game_id))];
    console.log(chalk.cyan('\nChecking if bad game_ids are actually player_ids...'));
    
    for (const badId of uniqueBadGameIds.slice(0, 5)) {
      const { data: player } = await supabase
        .from('players')
        .select('id, firstname, lastname, sport_id')
        .eq('id', badId)
        .single();
        
      if (player) {
        console.log(chalk.red(`  ⚠️  Game ID ${badId} is actually player: ${player.firstname} ${player.lastname} (${player.sport_id})`));
      }
    }
  }
  
  // Check for any pattern in the bad IDs
  const { data: badIdSample } = await supabase
    .from('player_stats')
    .select('game_id')
    .gt('game_id', maxGameId)
    .limit(100);
    
  if (badIdSample && badIdSample.length > 0) {
    const badIds = badIdSample.map(s => s.game_id);
    const minBad = Math.min(...badIds);
    const maxBad = Math.max(...badIds);
    
    console.log(chalk.yellow(`\nBad game_id range: ${minBad} - ${maxBad}`));
    
    // Check player ID range
    const { data: playerRange } = await supabase
      .from('players')
      .select('id')
      .gte('id', minBad)
      .lte('id', maxBad)
      .limit(1);
      
    if (playerRange && playerRange.length > 0) {
      console.log(chalk.red('⚠️  Bad game IDs are in the player ID range!'));
    }
  }
  
  // Check when these were created
  const { data: timeline } = await supabase
    .from('player_stats')
    .select('created_at')
    .gt('game_id', maxGameId)
    .order('created_at')
    .limit(1);
    
  if (timeline && timeline.length > 0) {
    console.log(chalk.yellow(`\nFirst bad stat created at: ${timeline[0].created_at}`));
  }
}

checkBadGameIds().catch(console.error);