#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';

async function testESPN() {
  const testIds = [
    { sport: 'nfl', id: '401671628' },
    { sport: 'nba', id: '401766128' }
  ];
  
  for (const test of testIds) {
    console.log(chalk.cyan(`\nTesting ${test.sport.toUpperCase()} game ${test.id}...`));
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/${
      test.sport === 'nfl' ? 'football/nfl' : 'basketball/nba'
    }/summary?event=${test.id}`;
    
    console.log(chalk.gray(`URL: ${url}`));
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      if (response.data) {
        console.log(chalk.green('✓ Success!'));
        console.log(chalk.gray(`  Status: ${response.data.header?.competitions?.[0]?.status?.type?.description || 'Unknown'}`));
        console.log(chalk.gray(`  Teams: ${response.data.header?.competitions?.[0]?.competitors?.map((c: any) => c.team.displayName).join(' vs ')}`));
        
        // Check for boxscore
        if (response.data.boxscore?.players) {
          console.log(chalk.green(`  ✓ Has boxscore data with ${response.data.boxscore.players.length} teams`));
        } else {
          console.log(chalk.yellow('  ⚠️  No boxscore data available'));
        }
      }
    } catch (error: any) {
      console.log(chalk.red('✗ Failed'));
      console.log(chalk.red(`  Error: ${error.message}`));
      if (error.response) {
        console.log(chalk.red(`  Status: ${error.response.status}`));
      }
    }
  }
}

testESPN().catch(console.error);