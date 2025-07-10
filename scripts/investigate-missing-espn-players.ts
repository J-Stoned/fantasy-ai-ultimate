#!/usr/bin/env tsx
/**
 * Investigate the missing ESPN players
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigate() {
  console.log(chalk.bold.cyan('\n🔍 INVESTIGATING MISSING ESPN PLAYERS\n'));
  
  // Get some stats with these large player IDs
  const { data: problemStats } = await supabase
    .from('player_stats')
    .select('*')
    .gt('player_id', 100000000) // These ESPN IDs seem to be > 100M
    .limit(20);
    
  if (!problemStats || problemStats.length === 0) {
    console.log('No stats found');
    return;
  }
  
  // Group by game to understand the context
  const gameIds = [...new Set(problemStats.map(s => s.game_id))];
  
  console.log(chalk.yellow(`Checking games for these stats...\n`));
  
  for (const gameId of gameIds.slice(0, 5)) {
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
      
    if (game) {
      console.log(chalk.cyan(`\nGame ${gameId}:`));
      console.log(`  External ID: ${game.external_id}`);
      console.log(`  Sport: ${game.sport_id}`);
      console.log(`  Date: ${game.start_time}`);
      console.log(`  Score: ${game.home_score} - ${game.away_score}`);
      
      // Get stats for this game
      const gameStats = problemStats.filter(s => s.game_id === gameId);
      console.log(chalk.yellow(`  Stats with ESPN player IDs: ${gameStats.length}`));
      
      // Sample stat
      if (gameStats.length > 0) {
        const stat = gameStats[0];
        console.log(chalk.gray(`  Example: player_id=${stat.player_id}, type=${stat.stat_type}, value=${stat.stat_value}`));
      }
    }
  }
  
  // Check the player ID range
  const playerIds = problemStats.map(s => s.player_id);
  const minId = Math.min(...playerIds);
  const maxId = Math.max(...playerIds);
  
  console.log(chalk.yellow(`\nESPN Player ID range: ${minId} - ${maxId}`));
  
  // These IDs look like they might be from the NHL collector
  // Let's check if we have any NHL players with similar external IDs
  console.log(chalk.cyan('\nChecking for NHL players...\n'));
  
  const { data: nhlPlayers } = await supabase
    .from('players')
    .select('id, external_id, firstname, lastname')
    .eq('sport_id', 'nhl')
    .like('external_id', '%121%')
    .limit(10);
    
  if (nhlPlayers && nhlPlayers.length > 0) {
    console.log(chalk.green(`Found ${nhlPlayers.length} NHL players with similar external IDs:`));
    nhlPlayers.forEach(p => {
      console.log(`  ${p.firstname} ${p.lastname} - external_id: ${p.external_id}`);
    });
  }
  
  // Let's also check what stat types these are
  console.log(chalk.yellow('\n📊 Stat types for these ESPN IDs:'));
  const statTypes = [...new Set(problemStats.map(s => s.stat_type))];
  console.log(statTypes.join(', '));
  
  // Check when these were created
  const dates = [...new Set(problemStats.map(s => s.created_at?.split('T')[0]))];
  console.log(chalk.yellow('\nCreated on dates:'));
  console.log(dates.join(', '));
}

investigate().catch(console.error);