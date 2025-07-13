#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';

async function testESPNAPI() {
  console.log(chalk.cyan('Testing ESPN API endpoints...'));
  
  // Test NBA game
  try {
    const nbaUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401766128';
    console.log(chalk.yellow('\nTesting NBA endpoint:'), nbaUrl);
    
    const response = await axios.get(nbaUrl);
    console.log(chalk.green('✅ NBA API Success!'));
    console.log('Has boxscore:', !!response.data.boxscore);
    console.log('Teams:', response.data.boxscore?.teams?.map((t: any) => t.team.displayName).join(' vs '));
    
    // Check player data
    if (response.data.boxscore?.players) {
      const firstTeam = response.data.boxscore.players[0];
      console.log('First team players:', firstTeam.statistics?.[0]?.athletes?.length || 0);
    }
  } catch (error: any) {
    console.error(chalk.red('NBA API Error:'), error.response?.status, error.message);
  }
  
  // Test current NBA scoreboard
  try {
    const scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
    console.log(chalk.yellow('\nTesting NBA scoreboard:'), scoreboardUrl);
    
    const response = await axios.get(scoreboardUrl);
    console.log(chalk.green('✅ Scoreboard API Success!'));
    console.log('Events today:', response.data.events?.length || 0);
    
    // Get first completed game
    const completedGame = response.data.events?.find((e: any) => e.status.type.completed);
    if (completedGame) {
      console.log('Completed game ID:', completedGame.id);
      console.log('Teams:', completedGame.name);
    }
  } catch (error: any) {
    console.error(chalk.red('Scoreboard API Error:'), error.response?.status, error.message);
  }
}

testESPNAPI().catch(console.error);