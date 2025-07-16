#!/usr/bin/env tsx
/**
 * Debug NBA stats array
 */

import axios from 'axios';
import chalk from 'chalk';

async function debugStatsArray() {
  console.log(chalk.bold.yellow('🔍 Debugging NBA Stats Array\n'));
  
  const gameId = '401468016';
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
  
  const response = await axios.get(url);
  
  if (response.data.boxscore?.players?.[0]?.statistics?.[0]?.athletes?.[0]) {
    const athlete = response.data.boxscore.players[0].statistics[0].athletes[0];
    
    console.log('Athlete:', athlete.athlete?.displayName);
    console.log('Stats array:', athlete.stats);
    console.log('\nStats length:', athlete.stats?.length);
    
    // Check labels
    if (response.data.boxscore.players[0].statistics[0].labels) {
      console.log('\nStat labels:');
      response.data.boxscore.players[0].statistics[0].labels.forEach((label: string, i: number) => {
        console.log(`  [${i}] ${label}: ${athlete.stats?.[i]}`);
      });
    }
    
    // Check for different stat structures
    console.log('\nChecking other fields:');
    console.log('- athlete.min:', athlete.min);
    console.log('- athlete.fg:', athlete.fg);
    console.log('- athlete.pts:', athlete.pts);
  }
}

debugStatsArray().catch(console.error);