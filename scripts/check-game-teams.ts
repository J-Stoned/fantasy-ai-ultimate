#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';

async function checkGameTeams() {
  const espnGameId = '401584802';
  
  console.log(chalk.bold.cyan(`🔍 Checking teams for ESPN game ${espnGameId}`));
  
  try {
    const response = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    
    const boxscore = response.data.boxscore;
    if (boxscore?.teams) {
      console.log('\nHome Team:', {
        id: boxscore.teams[0].team.id,
        name: boxscore.teams[0].team.displayName,
        abbreviation: boxscore.teams[0].team.abbreviation,
        score: boxscore.teams[0].statistics[0].displayValue
      });
      
      console.log('\nAway Team:', {
        id: boxscore.teams[1].team.id,
        name: boxscore.teams[1].team.displayName,
        abbreviation: boxscore.teams[1].team.abbreviation,
        score: boxscore.teams[1].statistics[0].displayValue
      });
      
      console.log('\nGame Date:', response.data.header.competitions[0].date);
    }
  } catch (error: any) {
    console.error(chalk.red('Error:', error.message));
  }
}

checkGameTeams();