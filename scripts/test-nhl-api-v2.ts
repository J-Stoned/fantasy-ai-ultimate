#!/usr/bin/env tsx
/**
 * 🧪 TEST NHL API V2 - Find working endpoints
 */

import axios from 'axios';
import chalk from 'chalk';

async function testNHLApis() {
  console.log(chalk.bold.blue('🏒 Testing Various NHL API Endpoints\n'));
  
  const apis = [
    {
      name: 'NHL Stats API',
      url: 'https://api-web.nhle.com/v1/teams',
      description: 'Official NHL API'
    },
    {
      name: 'NHL Old API Teams',
      url: 'https://statsapi.web.nhl.com/api/v1/teams',
      description: 'Old NHL Stats API'
    },
    {
      name: 'ESPN NHL Teams',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams',
      description: 'ESPN NHL Teams'
    },
    {
      name: 'ESPN NHL Roster (Rangers)',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/20/roster',
      description: 'ESPN Team Roster'
    }
  ];
  
  for (const api of apis) {
    console.log(chalk.yellow(`\nTesting ${api.name}...`));
    console.log(chalk.gray(`URL: ${api.url}`));
    
    try {
      const response = await axios.get(api.url, { timeout: 5000 });
      console.log(chalk.green(`✅ ${api.name} works!`));
      
      // Show what we got
      if (api.name.includes('ESPN') && api.name.includes('Teams')) {
        const teams = response.data.sports?.[0]?.leagues?.[0]?.teams || [];
        console.log(`   Found ${teams.length} teams`);
        if (teams.length > 0) {
          console.log(`   Sample: ${teams[0].team.displayName} (ID: ${teams[0].team.id})`);
        }
      } else if (api.name.includes('ESPN') && api.name.includes('Roster')) {
        const athletes = response.data.athletes || [];
        console.log(`   Found ${athletes.length} players`);
        if (athletes.length > 0) {
          const player = athletes[0];
          console.log(`   Sample: ${player.fullName} - ${player.position?.abbreviation}`);
        }
      } else if (api.name.includes('Old API')) {
        const teams = response.data.teams || [];
        console.log(`   Found ${teams.length} teams`);
        if (teams.length > 0) {
          console.log(`   Sample: ${teams[0].name} (${teams[0].abbreviation})`);
        }
      }
      
    } catch (error: any) {
      console.log(chalk.red(`❌ ${api.name} failed`));
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
  }
  
  // If ESPN works, get all team IDs
  console.log(chalk.cyan('\n\nGetting ESPN NHL team IDs...'));
  try {
    const teamsResponse = await axios.get('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams');
    const teams = teamsResponse.data.sports?.[0]?.leagues?.[0]?.teams || [];
    
    console.log(chalk.green(`\nESPN NHL Teams (${teams.length}):`));
    teams.forEach((t: any) => {
      console.log(`  ${t.team.id}: ${t.team.displayName} (${t.team.abbreviation})`);
    });
  } catch (error) {
    console.error('Failed to get ESPN teams');
  }
}

testNHLApis().catch(console.error);