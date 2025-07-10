#!/usr/bin/env tsx
/**
 * 🧪 TEST NBA COLLECTOR WITH SINGLE TEAM
 */

import axios from 'axios';
import chalk from 'chalk';

async function testNBAApi() {
  console.log(chalk.bold.blue('🏀 Testing NBA API Endpoints\n'));
  
  // Test ESPN NBA API
  console.log(chalk.yellow('Testing ESPN NBA API...'));
  
  try {
    // Test team roster endpoint - Lakers
    const lakersId = '13'; // ESPN ID for Lakers
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${lakersId}/roster`;
    console.log(chalk.gray(`URL: ${url}`));
    
    const response = await axios.get(url);
    
    if (response.data) {
      console.log(chalk.green('✅ ESPN API works!'));
      
      const athletes = response.data.athletes || [];
      console.log(chalk.cyan(`\nFound ${athletes.length} players for Lakers:`));
      
      // Show first few players
      athletes.slice(0, 5).forEach((player: any) => {
        console.log(`  - ${player.fullName} (#${player.jersey || '?'}) - ${player.position?.abbreviation || 'N/A'}`);
      });
      
      // Check data structure
      if (athletes.length > 0) {
        console.log(chalk.yellow('\nSample player structure:'));
        const sample = athletes[0];
        console.log('  ID:', sample.id);
        console.log('  Name:', sample.fullName);
        console.log('  First:', sample.firstName);
        console.log('  Last:', sample.lastName);
        console.log('  Jersey:', sample.jersey);
        console.log('  Position:', sample.position?.abbreviation);
        console.log('  Height:', sample.height);
        console.log('  Weight:', sample.weight);
        console.log('  Birthdate:', sample.dateOfBirth);
        console.log('  Headshot:', sample.headshot?.href ? 'Available' : 'Not available');
      }
    }
  } catch (error: any) {
    console.log(chalk.red('❌ ESPN API failed:'), error.message);
    
    // Try alternative API
    console.log(chalk.yellow('\nTrying balldontlie API...'));
    try {
      const bdlUrl = 'https://www.balldontlie.io/api/v1/teams';
      const bdlResponse = await axios.get(bdlUrl);
      console.log(chalk.green('✅ Balldontlie API works!'));
      console.log(`Found ${bdlResponse.data.data.length} teams`);
    } catch (bdlError) {
      console.log(chalk.red('❌ Balldontlie API also failed'));
    }
  }
  
  // Test all NBA team IDs
  console.log(chalk.yellow('\n\nSearching for valid NBA team IDs...'));
  const validTeams = [];
  
  for (let id = 1; id <= 40; id++) {
    try {
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}`,
        { timeout: 2000 }
      );
      
      if (response.data?.team) {
        const team = response.data.team;
        validTeams.push({
          id: id,
          name: team.displayName,
          abbreviation: team.abbreviation,
          location: team.location
        });
        console.log(chalk.green(`✓ ${id}: ${team.displayName}`));
      }
    } catch (error) {
      // Skip
    }
  }
  
  console.log(chalk.cyan('\n\nValid NBA Teams:'));
  validTeams.forEach(t => {
    console.log(`  ${t.id}: ${t.name} (${t.abbreviation})`);
  });
}

testNBAApi().catch(console.error);