#!/usr/bin/env tsx
/**
 * Debug NBA collection issue - all stats are 0
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
  console.log(chalk.cyan.bold('\n🔍 Debugging NBA Collection Issue\n'));
  
  try {
    // Get a sample game that was collected
    const sampleGame = await pool.query(`
      SELECT DISTINCT
        g.espn_game_id,
        g.game_date,
        COUNT(pgs.id) as stats_count
      FROM games_master g
      JOIN player_game_stats pgs ON pgs.game_id = g.id
      WHERE pgs.sport = 'NBA'
      AND pgs.created_at > NOW() - INTERVAL '2 hours'
      GROUP BY g.espn_game_id, g.game_date
      LIMIT 1
    `);
    
    if (sampleGame.rows.length === 0) {
      console.log(chalk.red('No recent NBA games found'));
      return;
    }
    
    const game = sampleGame.rows[0];
    console.log(chalk.yellow(`Testing with NBA game ${game.espn_game_id} from ${game.game_date}`));
    console.log(chalk.gray(`  Currently has ${game.stats_count} stats in DB`));
    
    // Fetch the game data from ESPN API
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.espn_game_id}`;
    console.log(chalk.gray(`\n  Fetching: ${url}`));
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore?.players) {
      console.log(chalk.red('No boxscore data in API response'));
      return;
    }
    
    console.log(chalk.green('\n✅ Got boxscore data'));
    
    // Check first team's data
    const firstTeam = response.data.boxscore.players[0];
    console.log(chalk.yellow(`\nFirst team: ${firstTeam.team.displayName}`));
    console.log(chalk.gray(`  Statistics categories: ${firstTeam.statistics?.length || 0}`));
    
    if (firstTeam.statistics && firstTeam.statistics.length > 0) {
      const firstCategory = firstTeam.statistics[0];
      console.log(chalk.gray(`\n  First category: ${firstCategory.name}`));
      console.log(chalk.gray(`  Athletes: ${firstCategory.athletes?.length || 0}`));
      
      if (firstCategory.athletes && firstCategory.athletes.length > 0) {
        const firstPlayer = firstCategory.athletes[0];
        console.log(chalk.cyan(`\n  First player: ${firstPlayer.athlete?.displayName}`));
        console.log(chalk.gray(`  Position: ${firstPlayer.athlete?.position?.abbreviation}`));
        console.log(chalk.gray(`  Stats array length: ${firstPlayer.stats?.length}`));
        
        if (firstPlayer.stats) {
          console.log(chalk.yellow('\n  Raw stats values:'));
          firstPlayer.stats.forEach((stat: any, index: number) => {
            console.log(chalk.gray(`    [${index}]: ${stat}`));
          });
          
          // Show what the collect script would parse
          console.log(chalk.yellow('\n  Parsed stats object:'));
          const values = firstPlayer.stats;
          const parsedStats = {
            minutes: values[0] || '0',
            field_goals_made: parseInt(values[1]) || 0,
            field_goals_attempted: parseInt(values[2]) || 0,
            three_pointers_made: parseInt(values[3]) || 0,
            three_pointers_attempted: parseInt(values[4]) || 0,
            free_throws_made: parseInt(values[5]) || 0,
            free_throws_attempted: parseInt(values[6]) || 0,
            offensive_rebounds: parseInt(values[7]) || 0,
            defensive_rebounds: parseInt(values[8]) || 0,
            rebounds: parseInt(values[9]) || 0,
            assists: parseInt(values[10]) || 0,
            steals: parseInt(values[11]) || 0,
            blocks: parseInt(values[12]) || 0,
            turnovers: parseInt(values[13]) || 0,
            personal_fouls: parseInt(values[14]) || 0,
            points: parseInt(values[15]) || 0
          };
          console.log(JSON.stringify(parsedStats, null, 2));
        }
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

debugNBA().catch(console.error);