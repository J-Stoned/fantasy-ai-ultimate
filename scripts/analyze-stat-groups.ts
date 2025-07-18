#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE STAT GROUPS
 * 
 * Deep dive into ESPN API stat structure to maximize collection
 */

import axios from 'axios';
import chalk from 'chalk';
import { InMemoryCache } from './utils/memory-cache';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStatGroups() {
  console.log(chalk.bold.cyan('🔍 DEEP STAT GROUP ANALYSIS\n'));
  
  // Get a couple of games for analysis
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2023-01-01')
    .limit(3);
    
  if (!games) return;
  
  const statGroupDetails: Record<string, any> = {};
  
  for (const game of games) {
    const espnGameId = game.external_id?.split('_').pop();
    if (!espnGameId) continue;
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
      const response = await axios.get(url, { timeout: 10000 });
      const gameData = response.data;
      
      console.log(chalk.cyan(`📊 Game: ${game.external_id} (${game.start_time})`));
      
      if (gameData.boxscore?.players) {
        for (const [teamIndex, team] of gameData.boxscore.players.entries()) {
          console.log(chalk.yellow(`\n  Team ${teamIndex + 1}: ${team.team?.displayName}`));
          
          for (const [groupIndex, statGroup] of (team.statistics || []).entries()) {
            const groupName = statGroup.name;
            const athleteCount = (statGroup.athletes || []).length;
            const labels = statGroup.labels || statGroup.names || [];
            
            console.log(chalk.white(`    ${groupIndex + 1}. ${groupName}:`));
            console.log(chalk.gray(`       Athletes: ${athleteCount}`));
            console.log(chalk.gray(`       Labels: [${labels.join(', ')}]`));
            
            // Collect details for summary
            if (!statGroupDetails[groupName]) {
              statGroupDetails[groupName] = {
                totalAthletes: 0,
                labels: new Set(),
                gamesFound: 0
              };
            }
            
            statGroupDetails[groupName].totalAthletes += athleteCount;
            statGroupDetails[groupName].gamesFound++;
            labels.forEach((label: string) => statGroupDetails[groupName].labels.add(label));
            
            // Show sample athlete stats
            if (statGroup.athletes && statGroup.athletes.length > 0) {
              const sampleAthlete = statGroup.athletes[0];
              const stats = sampleAthlete.stats || [];
              console.log(chalk.gray(`       Sample: ${sampleAthlete.athlete?.displayName} - [${stats.join(', ')}]`));
            }
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`Error processing game: ${error}`));
    }
  }
  
  // Summary analysis
  console.log(chalk.bold.green('\n📈 STAT GROUP SUMMARY:\n'));
  
  Object.entries(statGroupDetails)
    .sort(([,a], [,b]) => b.totalAthletes - a.totalAthletes)
    .forEach(([groupName, details]) => {
      console.log(chalk.cyan(`${groupName}:`));
      console.log(chalk.white(`  Total athletes: ${details.totalAthletes}`));
      console.log(chalk.white(`  Games found: ${details.gamesFound}`));
      console.log(chalk.white(`  Unique labels: ${details.labels.size}`));
      console.log(chalk.gray(`  Labels: ${Array.from(details.labels).join(', ')}\n`));
    });
    
  // Calculate potential
  const totalPotentialStats = Object.values(statGroupDetails).reduce((sum: number, details: any) => 
    sum + details.totalAthletes, 0
  );
  
  console.log(chalk.bold.yellow(`🎯 POTENTIAL ANALYSIS:`));
  console.log(chalk.white(`Total potential stats per game: ~${Math.round(totalPotentialStats / games.length)}`));
  console.log(chalk.white(`Currently collecting: 43 stats per game`));
  console.log(chalk.white(`Missing opportunity: ~${Math.round(totalPotentialStats / games.length) - 43} stats per game`));
}

analyzeStatGroups().catch(console.error);