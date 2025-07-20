#!/usr/bin/env tsx
/**
 * 🔍 DEBUG NHL STAT PARSING
 * 
 * Shows exactly why stats aren't being collected
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

async function debugStatParsing() {
  console.log(chalk.bold.cyan('🔍 DEBUG NHL STAT PARSING\n'));
  
  // Get one game
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'NHL')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-12')
    .limit(1);
    
  if (!games || games.length === 0) {
    console.error(chalk.red('No games found!'));
    return;
  }
  
  const game = games[0];
  const gameId = game.external_id.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
  
  console.log(chalk.yellow(`Processing game: ${game.external_id}\n`));
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = response.data;
    
    if (!data.boxscore?.players) {
      console.error(chalk.red('No boxscore.players!'));
      return;
    }
    
    // Get first team
    const team = data.boxscore.players[0];
    console.log(chalk.cyan(`Team: ${team.team.displayName}\n`));
    
    // Get first stat group
    const statGroup = team.statistics[0];
    const groupName = statGroup.name?.toLowerCase() || '';
    const labels = statGroup.labels || statGroup.names || [];
    
    console.log(chalk.yellow('Stat Group Details:'));
    console.log(chalk.gray(`  Name: "${statGroup.name}"`));
    console.log(chalk.gray(`  Lowercase: "${groupName}"`));
    console.log(chalk.gray(`  Has labels: ${!!statGroup.labels}`));
    console.log(chalk.gray(`  Has names: ${!!statGroup.names}`));
    console.log(chalk.gray(`  Labels/Names array: ${labels.length > 0 ? labels.join(',') : 'EMPTY'}`));
    
    // Test the condition
    console.log(chalk.yellow('\nCondition Tests:'));
    console.log(chalk.gray(`  sport === 'nhl': true`));
    console.log(chalk.gray(`  groupName.includes('forward'): ${groupName.includes('forward')}`));
    console.log(chalk.gray(`  groupName.includes('defense'): ${groupName.includes('defense')}`));
    console.log(chalk.gray(`  Would match NHL condition: ${groupName.includes('forward') || groupName.includes('defense')}`));
    
    // Get first athlete
    const athlete = statGroup.athletes[0];
    const statValues = athlete.stats || [];
    
    console.log(chalk.yellow('\nFirst Athlete Stats:'));
    console.log(chalk.gray(`  Name: ${athlete.athlete?.displayName}`));
    console.log(chalk.gray(`  Stats array length: ${statValues.length}`));
    console.log(chalk.gray(`  Stats array: [${statValues.slice(0, 10).join(', ')}...]`));
    
    // Simulate stat parsing
    const stats: any = {};
    
    if (groupName.includes('forward') || groupName.includes('defense')) {
      console.log(chalk.green('\n✅ Would parse as NHL skater stats'));
      stats.goals = parseInt(statValues[9]) || 0;
      stats.assists = parseInt(statValues[11]) || 0;
      stats.shots = parseInt(statValues[12]) || 0;
      console.log(chalk.gray(`  Goals: ${stats.goals}, Assists: ${stats.assists}, Shots: ${stats.shots}`));
    } else {
      console.log(chalk.red('\n❌ Would fall through to generic parsing'));
      // Generic parsing
      labels.forEach((label: string, index: number) => {
        const value = statValues[index];
        if (value !== undefined && value !== null && value !== '') {
          stats[label.toLowerCase().replace(/\s+/g, '_')] = value;
        }
      });
    }
    
    console.log(chalk.yellow('\nFinal stats object:'));
    console.log(chalk.gray(`  Keys: ${Object.keys(stats).join(', ')}`));
    console.log(chalk.gray(`  Would be skipped: ${Object.keys(stats).length === 0}`));
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  }
}

debugStatParsing()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });