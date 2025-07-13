#!/usr/bin/env tsx
/**
 * Debug the NFL parser specifically
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { SportParsers } from './gpu-stats-collector/parsers/sport-parsers';

dotenv.config({ path: '.env.local' });

async function debugNFLParser() {
  console.log(chalk.bold.cyan('\n🔍 DEBUGGING NFL PARSER\n'));
  
  // Get the exact same data
  const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401671628';
  const response = await axios.get(url);
  const gameData = response.data;
  
  console.log(chalk.yellow('Has boxscore?'), !!gameData.boxscore);
  console.log(chalk.yellow('Has players?'), !!gameData.boxscore?.players);
  console.log(chalk.yellow('Players length:'), gameData.boxscore?.players?.length || 0);
  
  if (!gameData.boxscore?.players) {
    console.error('No boxscore.players found');
    return;
  }
  
  console.log(chalk.cyan('\nLooping through teams...'));
  
  for (let i = 0; i < gameData.boxscore.players.length; i++) {
    const teamData = gameData.boxscore.players[i];
    console.log(chalk.yellow(`\nTeam ${i + 1}:`));
    console.log('  Team ID:', teamData.team?.id);
    console.log('  Statistics length:', teamData.statistics?.length || 0);
    
    if (!teamData.statistics) {
      console.log('  No statistics found for this team');
      continue;
    }
    
    for (let j = 0; j < teamData.statistics.length; j++) {
      const category = teamData.statistics[j];
      console.log(chalk.cyan(`\n  Category ${j + 1}: ${category.name}`));
      console.log('    Athletes length:', category.athletes?.length || 0);
      
      if (!category.athletes) {
        console.log('    No athletes found for this category');
        continue;
      }
      
      for (let k = 0; k < Math.min(category.athletes.length, 2); k++) {
        const athlete = category.athletes[k];
        console.log(chalk.green(`\n    Athlete ${k + 1}:`));
        console.log('      Has athlete object?', !!athlete.athlete);
        console.log('      ID:', athlete.athlete?.id);
        console.log('      Name:', athlete.athlete?.displayName);
        console.log('      Stats length:', athlete.stats?.length || 0);
        console.log('      Stats:', athlete.stats);
      }
    }
  }
  
  console.log(chalk.cyan('\nNow testing the parser...'));
  const results = SportParsers.parseNFLGame(gameData);
  console.log(chalk.green('Parser returned:'), results.length, 'players');
  
  if (results.length > 0) {
    console.log(chalk.gray('First player:'), JSON.stringify(results[0], null, 2));
  }
}

debugNFLParser().catch(console.error);