#!/usr/bin/env tsx
/**
 * Debug NBA collection - find a player who actually played
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
});

async function debugNBA() {
  console.log(chalk.cyan.bold('\n🔍 Finding NBA Player Who Actually Played\n'));
  
  try {
    // Get a sample game
    const game = { espn_game_id: '401326988' };
    
    // Fetch the game data from ESPN API
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.espn_game_id}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore?.players) {
      console.log(chalk.red('No boxscore data'));
      return;
    }
    
    // Find a player with actual stats
    for (const teamData of response.data.boxscore.players) {
      console.log(chalk.yellow(`\nTeam: ${teamData.team.displayName}`));
      
      for (const category of teamData.statistics || []) {
        for (const player of category.athletes || []) {
          // Check if player has minutes > 0
          if (player.stats && player.stats[0] && player.stats[0] !== '0' && player.stats[0] !== 'DNP') {
            console.log(chalk.green(`\n✅ Found player who played: ${player.athlete?.displayName}`));
            console.log(chalk.gray(`  Position: ${player.athlete?.position?.abbreviation}`));
            console.log(chalk.gray(`  Minutes: ${player.stats[0]}`));
            
            console.log(chalk.yellow('\n  Raw stats array:'));
            player.stats.forEach((stat: any, index: number) => {
              console.log(chalk.gray(`    [${index}]: "${stat}" (type: ${typeof stat})`));
            });
            
            // Parse FG as "made-attempted"
            const parseFGStat = (stat: string) => {
              if (typeof stat === 'string' && stat.includes('-')) {
                return stat.split('-').map(s => parseInt(s) || 0);
              }
              return [0, 0];
            };
            
            const [fgMade, fgAttempted] = parseFGStat(player.stats[1]);
            const [threeMade, threeAttempted] = parseFGStat(player.stats[2]);
            const [ftMade, ftAttempted] = parseFGStat(player.stats[3]);
            
            console.log(chalk.yellow('\n  Correctly parsed stats:'));
            const parsedStats = {
              minutes: player.stats[0] || '0',
              field_goals_made: fgMade,
              field_goals_attempted: fgAttempted,
              three_pointers_made: threeMade,
              three_pointers_attempted: threeAttempted,
              free_throws_made: ftMade,
              free_throws_attempted: ftAttempted,
              offensive_rebounds: parseInt(player.stats[4]) || 0,
              defensive_rebounds: parseInt(player.stats[5]) || 0,
              rebounds: parseInt(player.stats[6]) || 0,
              assists: parseInt(player.stats[7]) || 0,
              steals: parseInt(player.stats[8]) || 0,
              blocks: parseInt(player.stats[9]) || 0,
              turnovers: parseInt(player.stats[10]) || 0,
              personal_fouls: parseInt(player.stats[11]) || 0,
              points: parseInt(player.stats[12]) || 0,
              plus_minus: parseInt(player.stats[13]) || 0
            };
            console.log(JSON.stringify(parsedStats, null, 2));
            
            await pool.end();
            return;
          }
        }
      }
    }
    
    console.log(chalk.red('No players found who actually played'));
    await pool.end();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

debugNBA().catch(console.error);