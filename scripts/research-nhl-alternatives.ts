#!/usr/bin/env tsx
/**
 * 🔬 NHL API ALTERNATIVES RESEARCH
 * 
 * Finding better NHL APIs with complete rosters instead of ESPN's limited data
 */

import axios from 'axios';
import chalk from 'chalk';

async function testNHLAlternatives() {
  console.log(chalk.blue.bold('🏒 TESTING NHL API ALTERNATIVES FOR COMPLETE ROSTERS\n'));

  // 1. Test NHL.com Official API
  try {
    console.log(chalk.yellow('Testing NHL.com Official API...'));
    
    // Test Toronto Maple Leafs (ID: 10)
    const url = 'https://statsapi.web.nhl.com/api/v1/teams/10/roster';
    console.log(`URL: ${url}`);
    
    const response = await axios.get(url);
    
    const roster = response.data.roster || [];
    console.log(chalk.green(`✅ NHL.com API: Found ${roster.length} players`));
    
    if (roster.length > 0) {
      const sample = roster[0];
      console.log('Sample player structure:');
      console.log(`- ID: ${sample.person?.id}`);
      console.log(`- Name: ${sample.person?.fullName}`);
      console.log(`- Position: ${sample.position?.abbreviation}`);
      console.log(`- Jersey: ${sample.jerseyNumber}`);
      console.log(`- JSON: ${JSON.stringify(sample, null, 2).substring(0, 200)}...`);
    }
    
  } catch (error: any) {
    console.error(chalk.red(`❌ NHL.com API Error: ${error.message}`));
  }

  console.log();

  // 2. Test different NHL team IDs
  try {
    console.log(chalk.yellow('Testing multiple NHL teams...'));
    
    const testTeams = [
      { name: 'Toronto Maple Leafs', id: 10 },
      { name: 'Boston Bruins', id: 6 },
      { name: 'Tampa Bay Lightning', id: 14 },
      { name: 'Vegas Golden Knights', id: 54 }
    ];
    
    for (const team of testTeams) {
      try {
        const url = `https://statsapi.web.nhl.com/api/v1/teams/${team.id}/roster`;
        const response = await axios.get(url);
        const rosterSize = response.data.roster?.length || 0;
        
        console.log(`  ${team.name}: ${rosterSize} players`);
        
        if (rosterSize > 0) {
          // Get detailed info for first player
          const firstPlayer = response.data.roster[0];
          if (firstPlayer.person?.id) {
            const playerUrl = `https://statsapi.web.nhl.com/api/v1/people/${firstPlayer.person.id}`;
            const playerResponse = await axios.get(playerUrl);
            const playerDetails = playerResponse.data.people?.[0];
            
            if (playerDetails) {
              console.log(`    Sample: ${playerDetails.fullName} - ${playerDetails.primaryPosition?.abbreviation} - Age: ${playerDetails.currentAge}`);
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
        
      } catch (teamError: any) {
        console.log(`  ${team.name}: ERROR - ${teamError.message}`);
      }
    }
    
  } catch (error: any) {
    console.error(chalk.red(`❌ Multiple teams test error: ${error.message}`));
  }

  console.log();

  // 3. Test expanded roster endpoint
  try {
    console.log(chalk.yellow('Testing NHL.com expanded roster...'));
    
    const url = 'https://statsapi.web.nhl.com/api/v1/teams/10/roster?expand=roster.person&season=20242025';
    const response = await axios.get(url);
    
    const roster = response.data.roster || [];
    console.log(chalk.green(`✅ Expanded roster: Found ${roster.length} players`));
    
    if (roster.length > 0) {
      const sample = roster[0];
      console.log('Expanded player data:');
      console.log(`- Full data available: ${!!sample.person?.birthDate}`);
      console.log(`- Height: ${sample.person?.height}`);
      console.log(`- Weight: ${sample.person?.weight}`);
      console.log(`- Birth Country: ${sample.person?.birthCountry}`);
    }
    
  } catch (error: any) {
    console.error(chalk.red(`❌ Expanded roster error: ${error.message}`));
  }

  console.log();

  // 4. Test TheSportsDB (free API)
  try {
    console.log(chalk.yellow('Testing TheSportsDB API...'));
    
    const url = 'https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?t=Toronto%20Maple%20Leafs';
    const response = await axios.get(url);
    
    const players = response.data.player || [];
    console.log(chalk.green(`✅ TheSportsDB: Found ${players.length} players`));
    
    if (players.length > 0) {
      const sample = players[0];
      console.log('TheSportsDB player structure:');
      console.log(`- Name: ${sample.strPlayer}`);
      console.log(`- Position: ${sample.strPosition}`);
      console.log(`- Height: ${sample.strHeight}`);
      console.log(`- Weight: ${sample.strWeight}`);
    }
    
  } catch (error: any) {
    console.error(chalk.red(`❌ TheSportsDB Error: ${error.message}`));
  }

  console.log();

  // 5. Test current season data from NHL API
  try {
    console.log(chalk.yellow('Testing current season roster data...'));
    
    const url = 'https://statsapi.web.nhl.com/api/v1/teams/10?expand=team.roster&season=20242025';
    const response = await axios.get(url);
    
    const roster = response.data.teams?.[0]?.roster?.roster || [];
    console.log(chalk.green(`✅ Current season: Found ${roster.length} players`));
    
  } catch (error: any) {
    console.error(chalk.red(`❌ Current season error: ${error.message}`));
  }

  console.log();

  // Summary and recommendations
  console.log(chalk.cyan.bold('📊 NHL API ALTERNATIVES SUMMARY:'));
  console.log('1. NHL.com Official API - https://statsapi.web.nhl.com/api/v1/');
  console.log('2. Expanded roster endpoints with detailed player data');
  console.log('3. Season-specific roster queries');
  console.log('4. Individual player detail endpoints');
  console.log('5. TheSportsDB as backup source');
}

testNHLAlternatives();