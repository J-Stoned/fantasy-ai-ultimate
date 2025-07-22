#!/usr/bin/env tsx
/**
 * Debug the 2 games that failed
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

async function debugGames() {
  console.log(chalk.cyan.bold('\n🔍 Debugging Failed Games\n'));
  
  try {
    // Check the specific games that failed
    const games = [
      { espn_id: '401272142', sport: 'NHL', date: 'Tue Jan 19 2021' },
      { espn_id: '401558956', sport: 'NHL', date: 'Mon Oct 02 2023' }
    ];
    
    for (const game of games) {
      console.log(chalk.yellow(`\nChecking ${game.sport} game ${game.espn_id} from ${game.date}:`));
      
      // Try to fetch the data
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.espn_id}`;
      console.log(chalk.gray(`  URL: ${url}`));
      
      try {
        const response = await axios.get(url, { 
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        console.log(chalk.green(`  ✅ API responded`));
        
        // Check response structure
        if (response.data.boxscore) {
          console.log(chalk.green(`  ✅ Has boxscore`));
          
          if (response.data.boxscore.players) {
            console.log(chalk.green(`  ✅ Has players data`));
            console.log(chalk.gray(`  Teams: ${response.data.boxscore.players.length}`));
            
            for (const team of response.data.boxscore.players) {
              console.log(chalk.gray(`    ${team.team.displayName}: ${team.statistics?.length || 0} stat categories`));
              
              if (team.statistics) {
                for (const cat of team.statistics) {
                  console.log(chalk.gray(`      ${cat.name}: ${cat.athletes?.length || 0} players`));
                }
              }
            }
          } else {
            console.log(chalk.red(`  ❌ No players data`));
          }
        } else {
          console.log(chalk.red(`  ❌ No boxscore`));
        }
        
        // Check game status
        if (response.data.header?.competitions?.[0]) {
          const comp = response.data.header.competitions[0];
          console.log(chalk.gray(`  Status: ${comp.status?.type?.name}`));
          console.log(chalk.gray(`  Date: ${comp.date}`));
        }
        
      } catch (error: any) {
        console.log(chalk.red(`  ❌ API Error: ${error.message}`));
        if (error.response) {
          console.log(chalk.red(`  Status: ${error.response.status}`));
        }
      }
    }
    
    // Also check if these games exist in our database
    console.log(chalk.yellow('\n\nChecking database records:'));
    for (const game of games) {
      const result = await pool.query(`
        SELECT id, sport, status, game_date, home_team_id, away_team_id
        FROM games_master
        WHERE espn_game_id = $1
      `, [game.espn_id]);
      
      if (result.rows.length > 0) {
        const g = result.rows[0];
        console.log(chalk.gray(`\n${game.sport} ${game.espn_id}:`));
        console.log(chalk.gray(`  DB ID: ${g.id}`));
        console.log(chalk.gray(`  Status: ${g.status}`));
        console.log(chalk.gray(`  Date: ${g.game_date}`));
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

debugGames().catch(console.error);