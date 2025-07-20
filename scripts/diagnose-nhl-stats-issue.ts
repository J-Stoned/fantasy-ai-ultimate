#!/usr/bin/env tsx
/**
 * 🔍 NHL STATS DIAGNOSTIC TOOL
 * 
 * Diagnoses why NHL stats collection is returning 0 stats
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

async function diagnoseNHLStats() {
  console.log(chalk.bold.cyan('🔍 NHL STATS DIAGNOSTIC TOOL\n'));
  
  // 1. Get a sample NHL game
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'NHL')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26')
    .limit(5);
  
  if (!games || games.length === 0) {
    console.error(chalk.red('No NHL games found!'));
    return;
  }
  
  console.log(chalk.yellow(`Found ${games.length} sample games\n`));
  
  // 2. Load players and teams
  const { data: players } = await supabase
    .from('players')
    .select('id, external_id, name')
    .eq('sport', 'NHL')
    .limit(100);
    
  const playerMap = new Map(
    players?.map(p => [p.external_id, p]) || []
  );
  
  console.log(chalk.green(`Loaded ${playerMap.size} NHL players\n`));
  
  // 3. Try to get stats for each game
  for (const game of games) {
    console.log(chalk.bold.yellow(`\n${'='.repeat(70)}`));
    console.log(chalk.bold.yellow(`GAME: ${game.external_id}`));
    console.log(chalk.bold.yellow('='.repeat(70)));
    
    const gameId = game.external_id.split('_').pop();
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
    
    console.log(chalk.gray(`URL: ${url}`));
    
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const data = response.data;
      
      // Check if boxscore exists
      if (!data.boxscore) {
        console.log(chalk.red('❌ No boxscore in response!'));
        console.log(chalk.gray('Response keys:', Object.keys(data)));
        continue;
      }
      
      if (!data.boxscore.players) {
        console.log(chalk.red('❌ No players in boxscore!'));
        console.log(chalk.gray('Boxscore keys:', Object.keys(data.boxscore)));
        continue;
      }
      
      console.log(chalk.green(`✅ Found boxscore with ${data.boxscore.players.length} teams`));
      
      // Analyze first team
      const team = data.boxscore.players[0];
      console.log(chalk.cyan(`\nTeam: ${team.team.displayName} (${team.team.id})`));
      console.log(chalk.gray(`Home/Away: ${team.homeAway}`));
      
      if (!team.statistics || team.statistics.length === 0) {
        console.log(chalk.red('❌ No statistics array!'));
        continue;
      }
      
      console.log(chalk.green(`✅ Found ${team.statistics.length} stat groups`));
      
      // Analyze first stat group
      const statGroup = team.statistics[0];
      console.log(chalk.cyan(`\nStat Group: "${statGroup.name}"`));
      console.log(chalk.gray(`Labels:`, statGroup.labels || statGroup.names || 'NO LABELS'));
      
      if (!statGroup.athletes || statGroup.athletes.length === 0) {
        console.log(chalk.red('❌ No athletes in stat group!'));
        continue;
      }
      
      console.log(chalk.green(`✅ Found ${statGroup.athletes.length} athletes`));
      
      // Analyze first athlete
      const athlete = statGroup.athletes[0];
      console.log(chalk.cyan(`\nFirst Athlete:`));
      console.log(chalk.gray(`  ID: ${athlete.athlete?.id}`));
      console.log(chalk.gray(`  Name: ${athlete.athlete?.displayName}`));
      console.log(chalk.gray(`  Jersey: ${athlete.athlete?.jersey}`));
      
      // Check player mapping
      const espnPlayerId = athlete.athlete?.id;
      if (espnPlayerId) {
        const playerExternalId = `espn_nhl_${espnPlayerId}`;
        const dbPlayer = playerMap.get(playerExternalId);
        
        if (dbPlayer) {
          console.log(chalk.green(`✅ Player found in DB: ${dbPlayer.name} (ID: ${dbPlayer.id})`));
        } else {
          console.log(chalk.red(`❌ Player NOT found in DB!`));
          console.log(chalk.yellow(`   Looking for: ${playerExternalId}`));
          
          // Check if player exists with different format
          const alternativeIds = [
            `espn_hockey_${espnPlayerId}`,
            `nhl_${espnPlayerId}`,
            espnPlayerId
          ];
          
          for (const altId of alternativeIds) {
            if (playerMap.has(altId)) {
              console.log(chalk.yellow(`   ⚠️  Found with alternative ID: ${altId}`));
              break;
            }
          }
        }
      }
      
      // Check stats array
      console.log(chalk.cyan(`\nStats Array:`));
      if (!athlete.stats) {
        console.log(chalk.red('❌ No stats array!'));
      } else if (athlete.stats.length === 0) {
        console.log(chalk.red('❌ Empty stats array!'));
      } else {
        console.log(chalk.green(`✅ Stats array length: ${athlete.stats.length}`));
        console.log(chalk.gray(`   Stats:`, athlete.stats));
        
        // Check if all stats are empty/zero
        const hasNonZeroStats = athlete.stats.some((stat: any) => 
          stat !== null && stat !== undefined && stat !== '' && stat !== '0' && stat !== 0 && stat !== '-'
        );
        
        if (!hasNonZeroStats) {
          console.log(chalk.yellow('⚠️  All stats are zero or empty!'));
        }
      }
      
      // Show how stats would be parsed
      if (statGroup.name?.toLowerCase().includes('skater') && athlete.stats?.length >= 13) {
        console.log(chalk.cyan('\nParsed stats would be:'));
        console.log(chalk.gray(`  goals: ${athlete.stats[0]}`));
        console.log(chalk.gray(`  assists: ${athlete.stats[1]}`));
        console.log(chalk.gray(`  points: ${athlete.stats[2]}`));
        console.log(chalk.gray(`  plus_minus: ${athlete.stats[3]}`));
        console.log(chalk.gray(`  penalty_minutes: ${athlete.stats[4]}`));
        console.log(chalk.gray(`  shots_on_goal: ${athlete.stats[12]}`));
      }
      
      // Check all stat groups
      console.log(chalk.cyan('\nAll stat groups in this team:'));
      team.statistics.forEach((sg: any, index: number) => {
        const athleteCount = sg.athletes?.length || 0;
        const hasStats = sg.athletes?.some((a: any) => a.stats && a.stats.length > 0) || false;
        console.log(chalk.gray(`  ${index + 1}. "${sg.name}" - ${athleteCount} athletes, has stats: ${hasStats}`));
      });
      
      break; // Just analyze first game for now
      
    } catch (error: any) {
      console.error(chalk.red('API Error:'), error.message);
      if (error.response) {
        console.error(chalk.red('Response status:'), error.response.status);
      }
    }
  }
  
  // 4. Check if we have the right player external_id format
  console.log(chalk.bold.yellow(`\n${'='.repeat(70)}`));
  console.log(chalk.bold.yellow('PLAYER ID FORMAT CHECK'));
  console.log(chalk.bold.yellow('='.repeat(70)));
  
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('external_id, name')
    .eq('sport', 'NHL')
    .limit(10);
  
  console.log(chalk.cyan('\nSample NHL player external_ids:'));
  samplePlayers?.forEach(p => {
    console.log(chalk.gray(`  ${p.external_id} - ${p.name}`));
  });
  
  // 5. Summary
  console.log(chalk.bold.cyan(`\n${'='.repeat(70)}`));
  console.log(chalk.bold.cyan('DIAGNOSTIC SUMMARY'));
  console.log(chalk.bold.cyan('='.repeat(70)));
  
  console.log(chalk.yellow(`
Possible issues:
1. Player external_id format mismatch (check the format above)
2. Empty or zero stats being returned by ESPN
3. Stat group name doesn't match 'skater'
4. Stats array has different structure than expected
5. Athletes missing from stat groups
  `));
}

diagnoseNHLStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });