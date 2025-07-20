#!/usr/bin/env tsx
/**
 * 🔍 DEBUG NHL STATS COLLECTOR
 * 
 * Shows exactly what's happening during collection
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugCollectNHLStats() {
  console.log(chalk.bold.cyan('🔍 DEBUG NHL STATS COLLECTOR\n'));
  
  // Get ONE game to debug
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'NHL')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26')
    .limit(1);
  
  if (!games || games.length === 0) {
    console.error(chalk.red('No NHL games found!'));
    return;
  }
  
  const game = games[0];
  console.log(chalk.yellow(`Processing game: ${game.external_id}\n`));
  
  // Load ALL players with pagination
  let allPlayers: any[] = [];
  let playerOffset = 0;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id, name')
      .eq('sport', 'NHL')
      .range(playerOffset, playerOffset + 999)
      .order('id');
      
    if (!players || players.length === 0) break;
    
    allPlayers = allPlayers.concat(players);
    playerOffset += players.length;
    
    if (players.length < 1000) break;
  }
  
  const players = allPlayers;
    
  const playerMap = new Map(
    players?.map(p => [p.external_id, p]) || []
  );
  
  console.log(chalk.green(`Loaded ${playerMap.size} NHL players`));
  
  // Load teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NHL');
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  console.log(chalk.green(`Loaded ${teamMap.size} NHL teams\n`));
  
  // Make API call
  const gameId = game.external_id.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
  
  console.log(chalk.gray(`Fetching: ${url}`));
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = response.data;
    
    if (!data.boxscore?.players) {
      console.log(chalk.red('❌ No boxscore.players in response'));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${data.boxscore.players.length} teams\n`));
    
    let totalStatsCollected = 0;
    let playersNotFound = 0;
    let teamsNotFound = 0;
    let emptyStats = 0;
    
    for (const team of data.boxscore.players) {
      const espnTeamId = team.team.id;
      const teamId = teamMap.get(String(espnTeamId));
      
      console.log(chalk.cyan(`\nTeam: ${team.team.displayName} (ESPN ID: ${espnTeamId})`));
      
      if (!teamId) {
        console.log(chalk.red(`❌ Team not found in DB!`));
        teamsNotFound++;
        continue;
      }
      
      console.log(chalk.green(`✅ Team found in DB: ID ${teamId}`));
      
      for (const statGroup of team.statistics || []) {
        const groupName = statGroup.name?.toLowerCase() || '';
        console.log(chalk.yellow(`  Stat group: "${groupName}" with ${statGroup.athletes?.length || 0} athletes`));
        
        if (!statGroup.athletes || statGroup.athletes.length === 0) {
          console.log(chalk.red(`  ❌ No athletes in group`));
          continue;
        }
        
        for (const athlete of statGroup.athletes) {
          const playerId = athlete.athlete?.id;
          if (!playerId) {
            console.log(chalk.red(`    ❌ No athlete ID`));
            continue;
          }
          
          const playerExternalId = `espn_nhl_${playerId}`;
          const dbPlayer = playerMap.get(playerExternalId);
          
          if (!dbPlayer) {
            console.log(chalk.red(`    ❌ Player ${playerId} (${athlete.athlete?.displayName}) not found in DB`));
            console.log(chalk.gray(`       Looking for: ${playerExternalId}`));
            playersNotFound++;
            continue;
          }
          
          const statValues = athlete.stats || [];
          if (statValues.length === 0) {
            console.log(chalk.red(`    ❌ Empty stats for ${dbPlayer.name}`));
            emptyStats++;
            continue;
          }
          
          // Check if it's the right stat group
          if (groupName.includes('forward') || groupName.includes('defense')) {
            console.log(chalk.green(`    ✅ ${dbPlayer.name}: ${statValues.length} stats`));
            console.log(chalk.gray(`       Goals: ${statValues[9]}, Assists: ${statValues[11]}, +/-: ${statValues[3]}`));
            totalStatsCollected++;
          } else if (groupName.includes('goalie')) {
            console.log(chalk.green(`    ✅ ${dbPlayer.name} (goalie): ${statValues.length} stats`));
            totalStatsCollected++;
          } else {
            console.log(chalk.yellow(`    ⚠️  Unknown stat group: "${groupName}"`));
          }
        }
      }
    }
    
    console.log(chalk.bold.cyan(`\n${'='.repeat(50)}`));
    console.log(chalk.bold.cyan('SUMMARY'));
    console.log(chalk.bold.cyan('='.repeat(50)));
    console.log(chalk.green(`✅ Stats that would be collected: ${totalStatsCollected}`));
    console.log(chalk.red(`❌ Players not found: ${playersNotFound}`));
    console.log(chalk.red(`❌ Teams not found: ${teamsNotFound}`));
    console.log(chalk.red(`❌ Empty stats: ${emptyStats}`));
    
    // Check player ID format
    console.log(chalk.yellow(`\nChecking player ID formats...`));
    const samplePlayerIds = Array.from(playerMap.keys()).slice(0, 5);
    console.log(chalk.gray('Sample player external_ids in DB:'));
    samplePlayerIds.forEach(id => {
      console.log(chalk.gray(`  ${id}`));
    });
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  }
}

debugCollectNHLStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });