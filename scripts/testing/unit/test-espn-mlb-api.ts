#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';

async function testESPNApi() {
  const espnGameId = '401570151';
  const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnGameId}`;
  
  console.log(chalk.bold.yellow('Testing ESPN MLB API...'));
  console.log('URL:', url);
  
  try {
    const response = await axios.get(url);
    console.log(chalk.green('Status:', response.status));
    console.log('Has boxscore:', !!response.data.boxscore);
    console.log('Teams:', response.data.boxscore?.players?.length);
    
    if (response.data.boxscore?.players?.[0]) {
      const team = response.data.boxscore.players[0];
      console.log('\n' + chalk.cyan('Team:', team.team.displayName));
      console.log('Statistics types:', team.statistics?.map((s: any) => s.name || s.type));
      
      const batting = team.statistics?.find((s: any) => s.name === 'batting' || s.type === 'batting');
      console.log('Batting athletes:', batting?.athletes?.length);
      
      if (batting?.athletes?.[0]) {
        console.log('\n' + chalk.yellow('Sample player:', batting.athletes[0].athlete.displayName));
        console.log('Stats array length:', batting.athletes[0].stats?.length);
        console.log('Stats:', batting.athletes[0].stats);
        
        // Check stat labels
        if (batting.labels) {
          console.log('\nStat labels:', batting.labels);
        }
      }
    }
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  }
}

testESPNApi();