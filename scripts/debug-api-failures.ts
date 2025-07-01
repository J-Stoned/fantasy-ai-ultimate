#!/usr/bin/env tsx
/**
 * 🔥 API DEBUGGER - Find and fix all broken endpoints
 */

import chalk from 'chalk';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log(chalk.red.bold('\n🔍 DEBUGGING ALL API FAILURES\n'));

async function testAPI(name: string, url: string, options: any = {}) {
  console.log(chalk.yellow(`Testing ${name}...`));
  
  try {
    const response = await axios({
      method: 'GET',
      url,
      ...options,
      validateStatus: () => true // Don't throw on any status
    });
    
    if (response.status === 200) {
      console.log(chalk.green(`✅ ${name} - SUCCESS`));
      console.log(chalk.gray(`   Sample: ${JSON.stringify(response.data).substring(0, 100)}...`));
      return true;
    } else {
      console.log(chalk.red(`❌ ${name} - STATUS ${response.status}`));
      console.log(chalk.red(`   Error: ${response.statusText}`));
      if (response.data) {
        console.log(chalk.red(`   Response: ${JSON.stringify(response.data).substring(0, 200)}`));
      }
      return false;
    }
  } catch (error: any) {
    console.log(chalk.red(`❌ ${name} - FAILED`));
    console.log(chalk.red(`   Error: ${error.message}`));
    if (error.response) {
      console.log(chalk.red(`   Status: ${error.response.status}`));
      console.log(chalk.red(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}`));
    }
    return false;
  }
}

async function debugAPIs() {
  // Test Weather API
  console.log(chalk.cyan('\n🌤️  WEATHER API\n'));
  
  await testAPI(
    'OpenWeather (New York)',
    `https://api.openweathermap.org/data/2.5/weather?q=New York&appid=${process.env.OPENWEATHER_API_KEY}`
  );
  
  // Test Odds API
  console.log(chalk.cyan('\n💰 ODDS API\n'));
  
  await testAPI(
    'The Odds API',
    `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${process.env.THE_ODDS_API_KEY}&regions=us&markets=spreads,totals`
  );
  
  // Test NBA API
  console.log(chalk.cyan('\n🏀 NBA API (BallDontLie)\n'));
  
  await testAPI(
    'BallDontLie Players',
    'https://www.balldontlie.io/api/v1/players',
    {
      headers: {
        'Authorization': process.env.BALLDONTLIE_API_KEY
      }
    }
  );
  
  // Test NFL Official
  console.log(chalk.cyan('\n🏈 NFL OFFICIAL API\n'));
  
  await testAPI(
    'NFL Scores',
    'https://www.nfl.com/feeds-rs/scores/'
  );
  
  await testAPI(
    'NFL Scores (2024)',
    'https://www.nfl.com/feeds-rs/scores/2024'
  );
  
  await testAPI(
    'NFL Teams',
    'https://www.nfl.com/feeds-rs/teams'
  );
  
  // Test ESPN Fantasy
  console.log(chalk.cyan('\n🎮 ESPN FANTASY API\n'));
  
  await testAPI(
    'ESPN Fantasy Rankings',
    'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2024/segments/0/leaguedefaults/3?view=kona_player_info'
  );
  
  await testAPI(
    'ESPN Fantasy Rankings (2025)',
    'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leaguedefaults/3?view=kona_player_info'
  );
  
  // Test alternative endpoints
  console.log(chalk.cyan('\n🔄 ALTERNATIVE ENDPOINTS\n'));
  
  await testAPI(
    'ESPN NFL Teams',
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
  );
  
  await testAPI(
    'ESPN NFL Scoreboard',
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
  );
  
  console.log(chalk.yellow('\n📋 DIAGNOSIS COMPLETE!\n'));
}

debugAPIs().catch(console.error);