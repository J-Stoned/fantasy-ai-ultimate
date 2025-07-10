#!/usr/bin/env tsx
/**
 * 🧪 TEST NHL API WITH SINGLE TEAM
 */

import axios from 'axios';
import chalk from 'chalk';

async function testNHLApi() {
  console.log(chalk.bold.blue('🏒 Testing NHL API Endpoints\n'));
  
  // Test different NHL API options
  console.log(chalk.yellow('Testing NHL API...'));
  
  try {
    // NHL API v1
    const teamId = 10; // Maple Leafs
    const url = `https://api-web.nhle.com/v1/roster/${teamId}/20242025`;
    console.log(chalk.gray(`URL: ${url}`));
    
    const response = await axios.get(url);
    
    if (response.data) {
      console.log(chalk.green('✅ NHL API works!'));
      
      const forwards = response.data.forwards || [];
      const defensemen = response.data.defensemen || [];
      const goalies = response.data.goalies || [];
      
      console.log(chalk.cyan(`\nToronto Maple Leafs Roster:`));
      console.log(`  Forwards: ${forwards.length}`);
      console.log(`  Defensemen: ${defensemen.length}`);
      console.log(`  Goalies: ${goalies.length}`);
      
      // Show sample players
      if (forwards.length > 0) {
        console.log(chalk.yellow('\nSample forward:'));
        const player = forwards[0];
        console.log('  ID:', player.id);
        console.log('  Name:', player.firstName?.default, player.lastName?.default);
        console.log('  Jersey:', player.sweaterNumber);
        console.log('  Position:', player.positionCode);
        console.log('  Height:', player.heightInInches);
        console.log('  Weight:', player.weightInPounds);
        console.log('  Birthdate:', player.birthDate);
        console.log('  Headshot:', player.headshot ? 'Available' : 'Not available');
      }
    }
    
    // Test teams endpoint
    console.log(chalk.yellow('\n\nTesting teams endpoint...'));
    const teamsUrl = 'https://api.nhle.com/stats/rest/en/team';
    const teamsResponse = await axios.get(teamsUrl);
    
    if (teamsResponse.data?.data) {
      const teams = teamsResponse.data.data;
      console.log(chalk.green(`✅ Found ${teams.length} teams`));
      
      // Show first few teams
      console.log(chalk.cyan('\nSample teams:'));
      teams.slice(0, 5).forEach((team: any) => {
        console.log(`  ${team.id}: ${team.fullName} (${team.triCode})`);
      });
    }
    
    // Test ESPN NHL API as backup
    console.log(chalk.yellow('\n\nTesting ESPN NHL API...'));
    const espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/13/roster';
    const espnResponse = await axios.get(espnUrl);
    
    if (espnResponse.data) {
      console.log(chalk.green('✅ ESPN NHL API also works!'));
      const athletes = espnResponse.data.athletes || [];
      console.log(`  Found ${athletes.length} players for team 13`);
    }
    
  } catch (error: any) {
    console.log(chalk.red('❌ API failed:'), error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
    }
  }
}

testNHLApi().catch(console.error);