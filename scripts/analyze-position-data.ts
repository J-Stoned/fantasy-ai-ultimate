#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

console.log(chalk.bold.red('\n🚨 ANALYZING POSITION DATA ISSUES 🚨\n'));

async function analyzePositions() {
  // 1. Check the actual data type of position column
  console.log(chalk.cyan('1. Checking position column data types:'));
  
  const { data: samples } = await supabase
    .from('players')
    .select('id, firstname, lastname, position')
    .limit(20);
  
  if (samples) {
    samples.forEach(s => {
      const posType = typeof s.position;
      const posValue = s.position;
      const isObject = posType === 'object';
      
      if (isObject) {
        console.log(chalk.yellow(`  ${s.firstname} ${s.lastname}: position is ${posType} - ${JSON.stringify(posValue)}`));
      } else {
        console.log(chalk.green(`  ${s.firstname} ${s.lastname}: position = "${posValue}" (${posType})`));
      }
    });
  }
  
  // 2. Check if position might be in game logs metadata
  console.log(chalk.cyan('\n2. Checking game logs for position info:'));
  
  const { data: gameLogs } = await supabase
    .from('player_game_logs')
    .select('player_id, metadata, stats')
    .limit(10);
  
  if (gameLogs) {
    gameLogs.forEach(log => {
      if (log.metadata?.position || log.stats?.position) {
        console.log(chalk.green(`  Player ${log.player_id}:`));
        if (log.metadata?.position) {
          console.log(chalk.gray(`    metadata.position: ${log.metadata.position}`));
        }
        if (log.stats?.position) {
          console.log(chalk.gray(`    stats.position: ${log.stats.position}`));
        }
      }
    });
  }
  
  // 3. Check specific sport positions
  console.log(chalk.cyan('\n3. Checking positions by sport (from metadata):'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  for (const sport of sports) {
    const { data: sportLogs } = await supabase
      .from('player_game_logs')
      .select('player_id, metadata')
      .eq('metadata->>sport', sport)
      .limit(5);
    
    if (sportLogs && sportLogs.length > 0) {
      console.log(chalk.yellow(`\n  ${sport} positions:`));
      const positions = new Set();
      sportLogs.forEach(log => {
        if (log.metadata?.position) {
          positions.add(log.metadata.position);
        }
      });
      positions.forEach(pos => console.log(chalk.gray(`    - ${pos}`)));
    }
  }
  
  // 4. Find players with valid string positions
  console.log(chalk.cyan('\n4. Players with valid position strings:'));
  
  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'PG', 'SG', 'SF', 'PF', 'C', 'P', '1B', '2B', '3B', 'SS', 'OF', 'LW', 'C', 'RW', 'D', 'G'];
  
  for (const pos of validPositions.slice(0, 10)) {
    const { data: players, count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('position', pos);
    
    if (count && count > 0) {
      console.log(chalk.green(`  ${pos}: ${count} players`));
    }
  }
  
  // 5. Check if we need to extract position from somewhere else
  console.log(chalk.cyan('\n5. Checking player_stats table for position info:'));
  
  const { data: playerStats } = await supabase
    .from('player_stats')
    .select('*')
    .limit(10);
  
  if (playerStats) {
    console.log(chalk.gray(`  Sample player_stats records:`));
    playerStats.forEach(stat => {
      console.log(chalk.gray(`    Type: ${stat.stat_type}, Value: ${JSON.stringify(stat.stat_value).substring(0, 100)}`));
    });
  }
}

analyzePositions().catch(console.error);