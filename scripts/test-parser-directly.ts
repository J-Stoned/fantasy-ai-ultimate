#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';
import { SportParsers } from './gpu-stats-collector/parsers/sport-parsers';

async function testParser() {
  console.log(chalk.cyan('Testing ESPN API and Parser directly...\n'));
  
  // Fetch a real NFL game
  const gameId = '401671628';
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
  
  const response = await axios.get(url);
  
  console.log(chalk.green('API Response received'));
  console.log(chalk.gray(`Status: ${response.data.header?.competitions?.[0]?.status?.type?.description}`));
  
  if (response.data.boxscore?.players) {
    console.log(chalk.gray(`\nBoxscore has ${response.data.boxscore.players.length} teams`));
    
    const firstTeam = response.data.boxscore.players[0];
    console.log(chalk.gray(`First team: ${firstTeam.team.displayName}`));
    console.log(chalk.gray(`Statistics categories: ${firstTeam.statistics?.length || 0}`));
    
    if (firstTeam.statistics?.length > 0) {
      console.log(chalk.gray('\nCategories:'));
      firstTeam.statistics.forEach((cat: any, idx: number) => {
        console.log(chalk.gray(`  ${idx}: ${cat.name} - ${cat.athletes?.length || 0} athletes`));
      });
      
      // Show first category structure
      const firstCat = firstTeam.statistics[0];
      console.log(chalk.gray(`\nFirst category (${firstCat.name}) structure:`));
      if (firstCat.athletes?.length > 0) {
        const firstAthlete = firstCat.athletes[0];
        console.log(chalk.gray('  Athlete object keys:', Object.keys(firstAthlete)));
        console.log(chalk.gray('  Has athlete property:', !!firstAthlete.athlete));
        console.log(chalk.gray('  Has stats property:', !!firstAthlete.stats));
        if (firstAthlete.athlete) {
          console.log(chalk.gray('  Athlete name:', firstAthlete.athlete.displayName));
        }
      }
    }
  }
  
  // Now test parser
  console.log(chalk.cyan('\n\nTesting SportParsers.parseNFLGame...'));
  const parsed = SportParsers.parseNFLGame(response.data);
  console.log(chalk.green(`Parsed ${parsed.length} players`));
  
  if (parsed.length > 0) {
    console.log(chalk.gray('\nFirst 3 players:'));
    parsed.slice(0, 3).forEach(p => {
      console.log(chalk.white(`  ${p.playerName}: ${JSON.stringify(p.stats)}`));
    });
  }
}

testParser().catch(console.error);