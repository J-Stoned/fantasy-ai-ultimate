#!/usr/bin/env tsx
/**
 * Analyze ESPN boxscore structure
 */

import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

async function analyzeBoxscore() {
  const gameId = '401468016'; // Sample game ID
  const url = `${ESPN_BASE}/summary?event=${gameId}`;
  
  console.log(chalk.bold.blue('\n🔍 ANALYZING ESPN BOXSCORE STRUCTURE\n'));
  console.log(chalk.yellow(`Fetching: ${url}\n`));
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Save full response for analysis
    fs.writeFileSync('espn-boxscore-sample.json', JSON.stringify(response.data, null, 2));
    console.log(chalk.green('✅ Saved full response to espn-boxscore-sample.json'));
    
    // Analyze structure
    console.log(chalk.cyan('\nTop-level keys:'));
    console.log(Object.keys(response.data).join(', '));
    
    // Check for boxscore
    if (response.data.boxscore) {
      console.log(chalk.cyan('\nBoxscore keys:'));
      console.log(Object.keys(response.data.boxscore).join(', '));
      
      // Check players
      if (response.data.boxscore.players) {
        console.log(chalk.cyan('\nPlayers structure:'));
        const players = response.data.boxscore.players;
        console.log(`  Array length: ${players.length}`);
        
        if (players[0]) {
          console.log(`\n  First team structure:`);
          console.log(`    Team: ${players[0].team?.displayName}`);
          console.log(`    Statistics: ${players[0].statistics?.length || 0}`);
          
          if (players[0].statistics?.[0]) {
            console.log(`\n    First statistic group:`);
            const stat = players[0].statistics[0];
            console.log(`      Name: ${stat.name}`);
            console.log(`      Athletes: ${stat.athletes?.length || 0}`);
            
            if (stat.athletes?.[0]) {
              const athlete = stat.athletes[0];
              console.log(`\n      First athlete:`);
              console.log(`        Name: ${athlete.athlete?.displayName}`);
              console.log(`        ID: ${athlete.athlete?.id}`);
              console.log(`        Jersey: ${athlete.athlete?.jersey}`);
              console.log(`        Stats array length: ${athlete.stats?.length || 0}`);
              console.log(`        Did not play: ${athlete.didNotPlay}`);
              
              if (athlete.stats) {
                console.log(`\n        Stats values:`);
                athlete.stats.forEach((value: any, idx: number) => {
                  console.log(`          [${idx}]: ${value}`);
                });
              }
            }
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

analyzeBoxscore().catch(console.error);