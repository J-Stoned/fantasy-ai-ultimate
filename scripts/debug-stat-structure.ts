#!/usr/bin/env tsx
import axios from 'axios';
import chalk from 'chalk';

async function debugStatStructure() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401326315';
  
  const response = await axios.get(url);
  const gameData = response.data;
  
  if (gameData.boxscore?.players) {
    const team = gameData.boxscore.players[0];
    const statGroup = team.statistics[0]; // First stat group (passing)
    const athlete = statGroup.athletes[0]; // First athlete
    
    console.log(chalk.cyan('Stat Group Structure:'));
    console.log(chalk.yellow('Name:'), statGroup.name);
    console.log(chalk.yellow('Names array:'), statGroup.names);
    console.log(chalk.yellow('Labels array:'), statGroup.labels);
    
    console.log(chalk.cyan('\nAthlete Structure:'));
    console.log(chalk.yellow('Name:'), athlete.athlete.displayName);
    console.log(chalk.yellow('Stats array:'), athlete.stats);
    
    console.log(chalk.cyan('\nMapping Example:'));
    if (statGroup.names && athlete.stats) {
      statGroup.names.forEach((name: string, index: number) => {
        console.log(chalk.white(`  ${name}: ${athlete.stats[index]}`));
      });
    }
  }
}

debugStatStructure().catch(console.error);