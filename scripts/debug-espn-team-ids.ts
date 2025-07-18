#!/usr/bin/env tsx
import axios from 'axios';
import chalk from 'chalk';

async function debugESPNTeamIds() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401326315';
  
  const response = await axios.get(url);
  const gameData = response.data;
  
  console.log(chalk.cyan('ESPN API Team IDs:\n'));
  
  if (gameData.boxscore?.players) {
    for (const team of gameData.boxscore.players) {
      console.log(chalk.yellow(`Team: ${team.team.displayName}`));
      console.log(chalk.white(`  ID: ${team.team.id}`));
      console.log(chalk.white(`  Abbreviation: ${team.team.abbreviation}`));
      console.log(chalk.gray(`  Should match: espn_nfl_${team.team.id}\n`));
    }
  }
  
  // Also check game info
  if (gameData.header) {
    console.log(chalk.cyan('Game Header Info:'));
    console.log(chalk.white('Home Team:', gameData.header.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team));
    console.log(chalk.white('\nAway Team:', gameData.header.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team));
  }
}

debugESPNTeamIds().catch(console.error);