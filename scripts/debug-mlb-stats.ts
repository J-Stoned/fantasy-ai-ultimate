#!/usr/bin/env tsx
/**
 * Debug MLB stats extraction
 */

import axios from 'axios';
import chalk from 'chalk';

async function debugMLBStats() {
  console.log(chalk.blue('🔍 DEBUG MLB STATS EXTRACTION\n'));

  try {
    // Test with a known game
    const gameId = '401228507';
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
    console.log(chalk.yellow(`Fetching game ${gameId}...`));
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (!data.boxscore?.players) {
      console.log(chalk.red('No boxscore.players found!'));
      return;
    }
    
    console.log(chalk.green(`Found ${data.boxscore.players.length} teams`));
    
    // Check first team
    const team = data.boxscore.players[0];
    console.log(chalk.cyan(`\nTeam: ${team.team.displayName}`));
    console.log(chalk.gray(`Home/Away: ${team.homeAway}`));
    console.log(chalk.gray(`Statistics groups: ${team.statistics?.length || 0}`));
    
    if (team.statistics) {
      for (let i = 0; i < team.statistics.length; i++) {
        const statGroup = team.statistics[i];
        console.log(chalk.yellow(`\n  Stat Group ${i + 1}:`));
        console.log(`    Name: ${statGroup.name}`);
        console.log(`    Type: ${statGroup.type}`);
        console.log(`    Labels: ${statGroup.labels?.join(', ') || 'N/A'}`);
        console.log(`    Names: ${statGroup.names?.join(', ') || 'N/A'}`);
        console.log(`    Athletes: ${statGroup.athletes?.length || 0}`);
        
        if (statGroup.athletes && statGroup.athletes.length > 0) {
          const firstAthlete = statGroup.athletes[0];
          console.log(chalk.cyan(`\n    First Athlete:`));
          console.log(`      Name: ${firstAthlete.athlete?.displayName}`);
          console.log(`      ID: ${firstAthlete.athlete?.id}`);
          console.log(`      Stats: ${firstAthlete.stats?.join(', ')}`);
          
          // Try to map stats with labels
          if (statGroup.labels && firstAthlete.stats) {
            console.log(chalk.green('\n    Mapped Stats:'));
            statGroup.labels.forEach((label: string, idx: number) => {
              if (firstAthlete.stats[idx]) {
                console.log(`      ${label}: ${firstAthlete.stats[idx]}`);
              }
            });
          }
        }
      }
    }
    
    // Check raw structure
    console.log(chalk.magenta('\n\nRaw Structure Check:'));
    console.log('team.statistics exists?', !!team.statistics);
    console.log('team.statistics length:', team.statistics?.length);
    
    if (team.statistics && team.statistics.length > 0) {
      const stat = team.statistics[0];
      console.log('\nFirst stat group keys:', Object.keys(stat));
      console.log('athletes exists?', !!stat.athletes);
      console.log('athletes is array?', Array.isArray(stat.athletes));
      console.log('athletes length:', stat.athletes?.length);
    }
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
  }
}

debugMLBStats();