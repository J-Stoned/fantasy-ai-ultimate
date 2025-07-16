#!/usr/bin/env tsx
/**
 * Test alternative NBA APIs to find working roster data
 */

import axios from 'axios';
import chalk from 'chalk';

async function testNBAAlternatives() {
  console.log(chalk.blue.bold('🏀 TESTING NBA API ALTERNATIVES\n'));

  // 1. Test BallDontLie API (Free, no auth)
  try {
    console.log(chalk.yellow('Testing BallDontLie API...'));
    const url = 'https://www.balldontlie.io/api/v1/players?team_ids[]=13&per_page=100';
    const response = await axios.get(url);
    
    const players = response.data.data || [];
    console.log(chalk.green(`✅ BallDontLie: Found ${players.length} players`));
    
    if (players.length > 0) {
      const sample = players[0];
      console.log('Sample player:');
      console.log(`- ID: ${sample.id}`);
      console.log(`- Name: ${sample.first_name} ${sample.last_name}`);
      console.log(`- Position: ${sample.position}`);
      console.log(`- Team: ${sample.team?.abbreviation}`);
      console.log(`- Height: ${sample.height_feet}'${sample.height_inches}"`);
      console.log(`- Weight: ${sample.weight_pounds} lbs`);
    }
  } catch (error: any) {
    console.error(chalk.red(`❌ BallDontLie Error: ${error.message}`));
  }

  console.log();

  // 2. Test ESPN NBA with different approach (all players endpoint)
  try {
    console.log(chalk.yellow('Testing ESPN NBA All Players...'));
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes';
    const response = await axios.get(url, { params: { limit: 50 } });
    
    const athletes = response.data.athletes || [];
    console.log(chalk.green(`✅ ESPN All Players: Found ${athletes.length} players`));
    
    if (athletes.length > 0) {
      const sample = athletes[0];
      console.log('Sample player:');
      console.log(`- ID: ${sample.id}`);
      console.log(`- Name: ${sample.displayName}`);
      console.log(`- Position: ${sample.position?.abbreviation}`);
      console.log(`- Team: ${sample.team?.abbreviation}`);
    }
  } catch (error: any) {
    console.error(chalk.red(`❌ ESPN All Players Error: ${error.message}`));
  }

  console.log();

  // 3. Test nba_api python library alternative (RapidAPI)
  try {
    console.log(chalk.yellow('Testing RapidAPI NBA...'));
    const url = 'https://api-nba-v1.p.rapidapi.com/players';
    const response = await axios.get(url, {
      params: { team: '13', season: '2024' },
      headers: {
        'X-RapidAPI-Key': 'demo-key', // Would need real key
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com'
      }
    });
    
    console.log(chalk.green(`✅ RapidAPI: Response received`));
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log(chalk.yellow('⚠️ RapidAPI: Requires API key (paid service)'));
    } else {
      console.error(chalk.red(`❌ RapidAPI Error: ${error.message}`));
    }
  }

  console.log();

  // 4. Test different season format for NBA.com
  try {
    console.log(chalk.yellow('Testing NBA.com with 2023-24 season...'));
    const url = 'https://stats.nba.com/stats/commonteamroster?TeamID=1610612747&Season=2023-24';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com'
      }
    });
    
    const playerCount = response.data.resultSets?.[0]?.rowSet?.length || 0;
    console.log(playerCount > 0 ? 
      chalk.green(`✅ NBA.com 2023-24: Found ${playerCount} players`) :
      chalk.yellow('⚠️ NBA.com 2023-24: Empty roster')
    );
  } catch (error: any) {
    console.error(chalk.red(`❌ NBA.com 2023-24 Error: ${error.message}`));
  }

  console.log();

  // 5. Test manual Lakers roster (as fallback)
  console.log(chalk.yellow('Manual NBA roster approach:'));
  const manualLakersRoster = [
    { name: 'LeBron James', position: 'SF', jersey: '23' },
    { name: 'Anthony Davis', position: 'PF', jersey: '3' },
    { name: 'Russell Westbrook', position: 'PG', jersey: '0' },
    { name: 'Austin Reaves', position: 'SG', jersey: '15' },
    { name: 'D\'Angelo Russell', position: 'PG', jersey: '1' }
  ];
  
  console.log(chalk.green(`✅ Manual approach: ${manualLakersRoster.length} core players`));
  console.log('Sample players:', manualLakersRoster.slice(0, 2).map(p => p.name).join(', '));

  console.log(chalk.cyan.bold('\n📊 NBA API RECOMMENDATIONS:'));
  console.log('1. BallDontLie API - Best free option if working');
  console.log('2. ESPN All Players - Alternative ESPN approach');
  console.log('3. Manual rosters - Fallback for core players');
  console.log('4. Paid APIs - RapidAPI, SportsData.io for production');
}

testNBAAlternatives();