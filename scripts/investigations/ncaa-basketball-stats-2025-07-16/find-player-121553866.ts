#!/usr/bin/env tsx
/**
 * 🔍 FIND SPECIFIC PLAYER 121553866
 * Check where this player is that has NCAA BB stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findPlayer121553866() {
  console.log(chalk.bold.blue('🔍 FINDING PLAYER 121553866 AND SIMILAR\n'));
  
  // These are the player IDs we saw in the NCAA BB stats
  const ncaaStatsPlayerIds = [121553866, 121554921, 121555844, 121555845, 121555846];
  
  console.log('Looking for players with IDs:', ncaaStatsPlayerIds);
  
  // 1. Check if these players exist
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .in('id', ncaaStatsPlayerIds);
  
  if (players && players.length > 0) {
    console.log(chalk.green(`\n✅ Found ${players.length} players:`));
    players.forEach(player => {
      console.log(`\nPlayer: ${player.name}`);
      console.log(`  ID: ${player.id}`);
      console.log(`  Sport: ${player.sport || 'NULL'}`);
      console.log(`  External ID: ${player.external_id || 'none'}`);
      console.log(`  Team ID: ${player.team_id || 'none'}`);
      console.log(`  Created: ${player.created_at}`);
    });
    
    // Check their teams
    const teamIds = players.map(p => p.team_id).filter(Boolean);
    if (teamIds.length > 0) {
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, sport')
        .in('id', teamIds);
      
      console.log('\nTheir teams:');
      teams?.forEach(team => {
        console.log(`  ${team.name} (${team.sport || 'NULL sport'})`);
      });
    }
  } else {
    console.log(chalk.red('❌ These players do not exist!'));
  }
  
  // 2. Check the player ID range around these IDs
  console.log(chalk.yellow('\n📊 Checking player ID range around 121553866:'));
  
  const minId = Math.min(...ncaaStatsPlayerIds) - 100;
  const maxId = Math.max(...ncaaStatsPlayerIds) + 100;
  
  const { data: playersInRange } = await supabase
    .from('players')
    .select('id, name, sport')
    .gte('id', minId)
    .lte('id', maxId)
    .order('id', { ascending: true })
    .limit(20);
  
  if (playersInRange && playersInRange.length > 0) {
    console.log(`\nPlayers in ID range ${minId}-${maxId}:`);
    playersInRange.forEach(player => {
      console.log(`  ${player.id}: ${player.name} (${player.sport || 'NULL'})`);
    });
  }
  
  // 3. Check what's the maximum player ID
  console.log(chalk.yellow('\n📊 Player ID statistics:'));
  
  const { data: maxPlayer } = await supabase
    .from('players')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  
  console.log(`Maximum player ID in database: ${maxPlayer?.[0]?.id}`);
  
  // 4. Count total players
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total players in database: ${totalPlayers?.toLocaleString()}`);
  
  // 5. Check if these IDs exist in player_game_logs
  console.log(chalk.yellow('\n📊 Checking if these player IDs have stats:'));
  
  for (const playerId of ncaaStatsPlayerIds.slice(0, 3)) {
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', playerId);
    
    console.log(`Player ${playerId}: ${count} stats`);
  }
  
  console.log(chalk.bold.red('\n🚨 CONCLUSION:'));
  console.log('The NCAA Basketball stats are trying to use player IDs that don\'t exist yet!');
  console.log(`Current max player ID: ${maxPlayer?.[0]?.id}`);
  console.log(`NCAA BB stats using IDs: ${Math.min(...ncaaStatsPlayerIds)} - ${Math.max(...ncaaStatsPlayerIds)}`);
  console.log('\nThis means the stats collection created new player IDs that weren\'t inserted into the players table!');
}

findPlayer121553866().catch(console.error);