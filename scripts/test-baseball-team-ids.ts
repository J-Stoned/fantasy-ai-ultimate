#!/usr/bin/env tsx
/**
 * Test baseball team IDs to find correct ones
 */

import axios from 'axios';
import chalk from 'chalk';

async function testTeam(teamId: string, teamName: string) {
  console.log(chalk.yellow(`\nTesting ${teamName} (ID: ${teamId})...`));
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${teamId}/roster`;
    console.log(chalk.gray(`URL: ${url}`));
    
    const response = await axios.get(url);
    console.log(chalk.green(`✅ Success! Found ${response.data.athletes?.length || 0} athletes`));
    return true;
  } catch (error: any) {
    console.log(chalk.red(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`));
    if (error.response?.data?.message) {
      console.log(chalk.red(`   Message: ${error.response.data.message}`));
    }
    return false;
  }
}

async function findCorrectId(teamName: string, startId: number, endId: number) {
  console.log(chalk.cyan(`\nSearching for ${teamName} between IDs ${startId}-${endId}...`));
  
  for (let id = startId; id <= endId; id++) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${id}`;
      const response = await axios.get(url, { timeout: 2000 });
      
      if (response.data?.team?.displayName?.toLowerCase().includes(teamName.toLowerCase())) {
        console.log(chalk.green(`✅ Found ${teamName}! ID: ${id} (${response.data.team.displayName})`));
        return id;
      }
    } catch (error) {
      // Continue searching
    }
  }
  
  console.log(chalk.red(`❌ Could not find ${teamName} in range ${startId}-${endId}`));
  return null;
}

async function main() {
  console.log(chalk.bold.blue('🔍 Testing NCAA Baseball Team IDs\n'));
  
  // Test known working teams
  console.log(chalk.bold.cyan('Testing known working teams:'));
  await testTeam('99', 'LSU');
  await testTeam('61', 'Florida');
  
  // Test failed teams
  console.log(chalk.bold.cyan('\n\nTesting failed teams:'));
  const failedTeams = [
    { id: '8', name: 'Arkansas' },
    { id: '52', name: 'Florida State' },
    { id: '251', name: 'Texas' },
    { id: '2633', name: 'Tennessee' },
    { id: '238', name: 'Vanderbilt' },
    { id: '12', name: 'Arizona' }
  ];
  
  for (const team of failedTeams) {
    await testTeam(team.id, team.name);
  }
  
  // Try to find correct IDs for a couple teams
  console.log(chalk.bold.cyan('\n\nSearching for correct IDs:'));
  
  // Search for Arkansas (try IDs near 8)
  await findCorrectId('Arkansas', 1, 20);
  
  // Search for Texas (try IDs around 251)  
  await findCorrectId('Texas', 240, 260);
}

main().catch(console.error);