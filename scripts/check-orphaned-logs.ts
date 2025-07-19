#!/usr/bin/env tsx
/**
 * Check orphaned player_game_logs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOrphans() {
  console.log(chalk.bold.yellow('🔍 CHECKING ORPHANED PLAYER_GAME_LOGS\n'));

  // Check different types of orphans
  const checks = await Promise.all([
    supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
      .is('player_id', null),
    supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
      .is('game_id', null),
    supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
      .is('team_id', null),
    supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
      .is('opponent_id', null)
  ]);

  console.table({
    'Logs with NULL player_id': checks[0].count || 0,
    'Logs with NULL game_id': checks[1].count || 0,
    'Logs with NULL team_id': checks[2].count || 0,
    'Logs with NULL opponent_id': checks[3].count || 0
  });

  // The issue is likely NULL team_id or opponent_id
  if (checks[2].count! > 0) {
    console.log(chalk.yellow('\nSample logs with NULL team_id:'));
    const { data: samples } = await supabase
      .from('player_game_logs')
      .select('id, player_id, game_id, team_id, opponent_id')
      .is('team_id', null)
      .limit(5);
    
    console.table(samples);
  }

  // Check if these are valid player/game references
  console.log(chalk.yellow('\n🔍 Checking if these logs have valid references...'));
  
  const { data: sampleLogs } = await supabase
    .from('player_game_logs')
    .select('id, player_id, game_id')
    .is('team_id', null)
    .limit(100);

  if (sampleLogs && sampleLogs.length > 0) {
    // Check if players exist
    const playerIds = sampleLogs.map(log => log.player_id).filter(Boolean);
    const { count: validPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .in('id', playerIds);

    // Check if games exist
    const gameIds = sampleLogs.map(log => log.game_id).filter(Boolean);
    const { count: validGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .in('id', gameIds);

    console.log(`\nOf ${sampleLogs.length} sample orphaned logs:`);
    console.log(`  - ${validPlayers || 0} have valid player references`);
    console.log(`  - ${validGames || 0} have valid game references`);
  }

  // Propose solution
  console.log(chalk.yellow('\n💡 Solution:'));
  console.log('These logs have NULL team_id/opponent_id, which makes them "orphaned".');
  console.log('Options:');
  console.log('1. Delete them if they have no useful data');
  console.log('2. Try to infer team_id from player/game data');
  console.log('3. Keep them with NULL team_id (they still have player/game data)');
}

checkOrphans().catch(console.error);