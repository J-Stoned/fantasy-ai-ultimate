#!/usr/bin/env tsx
/**
 * 🎯 FINAL PUSH TO 78 STATS PER GAME
 * 
 * Current: 63 stats/game
 * Target: 78 stats/game
 * Missing: 15 stats/game
 * 
 * This script will:
 * 1. Analyze what's still missing
 * 2. Find any remaining players
 * 3. Ensure ALL stat groups are captured
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

async function analyzeMissingStats() {
  console.log(chalk.bold.cyan('🎯 FINAL PUSH TO 78 STATS PER GAME\n'));
  console.log(chalk.yellow('Current: 63 stats/game | Target: 78 | Missing: 15\n'));

  // Get a sample 2021 game
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .limit(1)
    .single();

  if (!sampleGame) return;

  // Get current stats for this game
  const { data: currentStats, count } = await supabase
    .from('player_game_logs')
    .select('player_id, metadata', { count: 'exact' })
    .eq('game_id', sampleGame.id);

  console.log(chalk.blue(`Sample game ${sampleGame.external_id}:`));
  console.log(chalk.green(`Current stats in DB: ${count}\n`));

  // Get players in DB
  const { data: players } = await supabase
    .from('players')
    .select('external_id')
    .eq('sport', 'NFL');

  const playerSet = new Set(players?.map(p => p.external_id) || []);

  // Fetch game data from ESPN
  const espnGameId = sampleGame.external_id?.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
  const response = await axios.get(url);
  const gameData = response.data;

  const statGroupCounts: Record<string, { expected: number, found: number }> = {};
  const missingPlayers: any[] = [];
  let totalExpected = 0;

  if (gameData.boxscore?.players) {
    for (const team of gameData.boxscore.players) {
      console.log(chalk.cyan(`\n${team.team.displayName}:`));
      
      for (const statGroup of team.statistics || []) {
        const groupName = statGroup.name;
        
        if (!statGroupCounts[groupName]) {
          statGroupCounts[groupName] = { expected: 0, found: 0 };
        }
        
        for (const athlete of statGroup.athletes || []) {
          totalExpected++;
          statGroupCounts[groupName].expected++;
          
          const playerId = `espn_nfl_${athlete.athlete?.id}`;
          
          if (!playerSet.has(playerId)) {
            missingPlayers.push({
              id: athlete.athlete?.id,
              name: athlete.athlete?.displayName,
              group: groupName
            });
          } else {
            // Check if we have this stat
            const hasStat = currentStats?.some(s => 
              s.player_id === players?.find(p => p.external_id === playerId)?.id
            );
            
            if (hasStat) {
              statGroupCounts[groupName].found++;
            }
          }
        }
      }
    }
  }

  // Show analysis
  console.log(chalk.bold.yellow('\n📊 STAT GROUP ANALYSIS:'));
  Object.entries(statGroupCounts)
    .sort((a, b) => (b[1].expected - b[1].found) - (a[1].expected - a[1].found))
    .forEach(([group, counts]) => {
      const missing = counts.expected - counts.found;
      const percent = Math.round((counts.found / counts.expected) * 100);
      
      if (missing > 0) {
        console.log(chalk.red(`  ${group}: ${counts.found}/${counts.expected} (${percent}%) - Missing ${missing}`));
      } else {
        console.log(chalk.green(`  ${group}: ${counts.found}/${counts.expected} (${percent}%) ✓`));
      }
    });

  console.log(chalk.blue(`\nTotal expected: ${totalExpected}`));
  console.log(chalk.blue(`Total in DB: ${count}`));
  console.log(chalk.red(`Missing: ${totalExpected - (count || 0)}`));

  if (missingPlayers.length > 0) {
    console.log(chalk.bold.red(`\n⚠️  ${missingPlayers.length} players still missing:`));
    missingPlayers.slice(0, 10).forEach(p => {
      console.log(`  ${p.name} (${p.id}) - ${p.group}`);
    });
    if (missingPlayers.length > 10) {
      console.log(`  ... and ${missingPlayers.length - 10} more`);
    }
  }

  // Recommendations
  console.log(chalk.bold.cyan('\n🚀 RECOMMENDATIONS:'));
  
  const missingGroups = Object.entries(statGroupCounts)
    .filter(([_, counts]) => counts.found < counts.expected)
    .map(([group, _]) => group);
    
  if (missingGroups.length > 0) {
    console.log(chalk.yellow(`1. Focus on these stat groups: ${missingGroups.join(', ')}`));
  }
  
  if (missingPlayers.length > 0) {
    console.log(chalk.yellow(`2. Add ${missingPlayers.length} missing players`));
  }
  
  console.log(chalk.yellow('3. Ensure all stat mappings are complete for each group'));
  console.log(chalk.yellow('4. Check for any stat filtering that might skip valid stats'));
  
  return { missingPlayers, statGroupCounts };
}

// Run analysis
analyzeMissingStats().catch(console.error);