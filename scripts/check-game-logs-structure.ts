#!/usr/bin/env tsx
/**
 * Check the structure of player_game_logs table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGameLogsStructure() {
  console.log(chalk.bold.blue('\n📊 PLAYER GAME LOGS STRUCTURE CHECK\n'));
  
  // Get sample logs
  const { data: sampleLogs } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(5);
  
  console.log(chalk.yellow('Sample logs:'));
  if (sampleLogs && sampleLogs.length > 0) {
    console.log(JSON.stringify(sampleLogs[0], null, 2));
  }
  
  // Check total by checking if player has a sport_id
  console.log(chalk.yellow('\n📈 CHECKING BY PLAYER SPORT:'));
  
  // Get NFL player IDs
  const { data: nflPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'nfl');
  
  const nflPlayerIds = nflPlayers?.map(p => p.id) || [];
  console.log(chalk.white(`NFL players: ${nflPlayerIds.length}`));
  
  // Count logs for NFL players
  const { count: nflLogsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('player_id', nflPlayerIds.slice(0, 1000)); // Limit to first 1000 to avoid query size issues
  
  console.log(chalk.white(`NFL logs (first 1000 players): ${nflLogsCount}`));
  
  // Check games with NFL teams
  console.log(chalk.yellow('\n🏈 CHECKING BY GAME:'));
  
  // Get NFL team IDs
  const { data: nflTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport_id', 'nfl');
  
  const nflTeamIds = nflTeams?.map(t => t.id) || [];
  console.log(chalk.white(`NFL teams: ${nflTeamIds.length}`));
  
  // Get NFL game IDs
  const { data: nflGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport_id', 'nfl')
    .limit(100);
  
  const nflGameIds = nflGames?.map(g => g.id) || [];
  console.log(chalk.white(`Sample NFL games: ${nflGameIds.length}`));
  
  // Count logs for NFL games
  if (nflGameIds.length > 0) {
    const { count: nflGameLogsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', nflGameIds);
    
    console.log(chalk.white(`Logs for sample NFL games: ${nflGameLogsCount}`));
  }
  
  // Get breakdown by checking a few records
  console.log(chalk.yellow('\n📊 SPORT DETECTION:'));
  
  const { data: randomLogs } = await supabase
    .from('player_game_logs')
    .select('player_id, game_id')
    .limit(100);
  
  if (randomLogs && randomLogs.length > 0) {
    const sportCounts: { [key: string]: number } = {};
    
    for (const log of randomLogs) {
      // Get player sport
      const { data: player } = await supabase
        .from('players')
        .select('sport_id')
        .eq('id', log.player_id)
        .single();
      
      if (player?.sport_id) {
        sportCounts[player.sport_id] = (sportCounts[player.sport_id] || 0) + 1;
      }
    }
    
    console.log('Sport breakdown from 100 random logs:');
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(chalk.white(`   ${sport.toUpperCase()}: ${count}`));
    });
  }
}

checkGameLogsStructure().catch(console.error);