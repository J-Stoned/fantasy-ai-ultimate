#!/usr/bin/env tsx
/**
 * Test collecting stats for a single NFL game
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSingleGame() {
  console.log(chalk.bold.cyan('🧪 TESTING SINGLE NFL GAME STATS COLLECTION\n'));
  
  // Get one NFL game
  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .eq('external_id', 'espn_nfl_401326315')
    .single();
    
  if (!game) {
    console.log(chalk.red('Game not found'));
    return;
  }
  
  console.log(chalk.yellow(`Testing with game: ${game.external_id}`));
  console.log(chalk.gray(`  Date: ${new Date(game.start_time).toLocaleDateString()}`));
  console.log(chalk.gray(`  Teams: ${game.home_team_id} vs ${game.away_team_id}\n`));
  
  // Get game stats from ESPN
  const espnGameId = game.external_id.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
  
  console.log(chalk.blue(`Fetching from: ${url}\n`));
  
  try {
    const response = await axios.get(url);
    const gameData = response.data;
    
    console.log(chalk.green('✅ API call successful'));
    console.log(chalk.gray(`  Has boxscore: ${!!gameData.boxscore}`));
    console.log(chalk.gray(`  Has players: ${!!gameData.boxscore?.players}`));
    
    if (gameData.boxscore?.players) {
      console.log(chalk.gray(`  Teams in boxscore: ${gameData.boxscore.players.length}`));
      
      let totalStats = 0;
      for (const team of gameData.boxscore.players) {
        console.log(chalk.yellow(`\n  Team: ${team.team.displayName}`));
        console.log(chalk.gray(`    Home/Away: ${team.homeAway}`));
        console.log(chalk.gray(`    Stat groups: ${team.statistics?.length || 0}`));
        
        for (const statGroup of team.statistics || []) {
          console.log(chalk.cyan(`    ${statGroup.name}:`));
          console.log(chalk.gray(`      Athletes: ${statGroup.athletes?.length || 0}`));
          totalStats += statGroup.athletes?.length || 0;
        }
      }
      
      console.log(chalk.green(`\n✅ Total potential stats: ${totalStats}`));
    }
    
    // Show sample player data
    if (gameData.boxscore?.players?.[0]?.statistics?.[0]?.athletes?.[0]) {
      const sampleAthlete = gameData.boxscore.players[0].statistics[0].athletes[0];
      console.log(chalk.cyan('\nSample athlete data:'));
      console.log(chalk.gray(JSON.stringify(sampleAthlete, null, 2).substring(0, 500) + '...'));
    }
    
  } catch (error: any) {
    console.error(chalk.red('❌ API call failed:'));
    console.error(chalk.red(`  ${error.message}`));
    if (error.response) {
      console.error(chalk.red(`  Status: ${error.response.status}`));
      console.error(chalk.red(`  Data: ${JSON.stringify(error.response.data).substring(0, 200)}`));
    }
  }
}

testSingleGame().catch(console.error);