#!/usr/bin/env tsx
/**
 * 🎮 COLLECT STATS FOR MISSING GAMES
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
});

const apiLimit = pLimit(20);

async function collectMissingStats() {
  console.log(chalk.cyan.bold('\n🎮 Collecting Stats for Missing Games\n'));
  
  try {
    // Get missing games
    const missingGames = await pool.query(`
      SELECT 
        g.*,
        g.sport,
        ht.espn_id as home_espn_id,
        at.espn_id as away_espn_id
      FROM games_master g
      JOIN teams_master ht ON g.home_team_id = ht.id
      JOIN teams_master at ON g.away_team_id = at.id
      WHERE g.sport IN ('NBA', 'NHL')
      AND g.status = 'STATUS_FINAL'
      AND g.espn_game_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM player_game_stats pgs 
        WHERE pgs.game_id = g.id
      )
      ORDER BY g.sport, g.game_date
    `);
    
    console.log(chalk.yellow(`Found ${missingGames.rows.length} games without stats:\n`));
    
    for (const game of missingGames.rows) {
      console.log(chalk.gray(`  ${game.sport} - Game ${game.espn_game_id} on ${game.game_date}`));
      
      if (game.sport === 'NBA') {
        await collectNBAGameStats(game);
      } else if (game.sport === 'NHL') {
        await collectNHLGameStats(game);
      }
    }
    
    console.log(chalk.green.bold('\n✅ Missing game stats collected!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pool.end();
  }
}

async function collectNBAGameStats(game: any) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.espn_game_id}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore?.players) {
      console.log(chalk.red(`    No boxscore data for NBA game ${game.espn_game_id}`));
      return;
    }
    
    const stats: any[] = [];
    
    for (const teamData of response.data.boxscore.players) {
      const teamId = teamData.team.id === game.home_espn_id 
        ? game.home_team_id 
        : game.away_team_id;
      
      for (const category of teamData.statistics || []) {
        for (const player of category.athletes || []) {
          if (!player.stats || player.stats.length < 13) continue;
          
          const values = player.stats;
          const playerStats = {
            player_id: await getOrCreatePlayer(player.athlete, teamId, 'NBA'),
            game_id: game.id,
            team_id: teamId,
            opponent_id: teamId === game.home_team_id ? game.away_team_id : game.home_team_id,
            sport: 'NBA',
            season: game.season,
            position: player.athlete?.position?.abbreviation || 'F',
            played: true,
            started: player.starter || false,
            stats: {
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
            },
            data_source: 'espn_api',
            confidence_score: 0.95
          };
          
          if (playerStats.player_id) {
            stats.push(playerStats);
          }
        }
      }
    }
    
    if (stats.length > 0) {
      await insertStats(stats);
      console.log(chalk.green(`    ✅ Collected ${stats.length} NBA stats`));
    }
    
  } catch (error: any) {
    console.log(chalk.red(`    Failed to collect NBA game ${game.espn_game_id}: ${error.message}`));
  }
}

async function collectNHLGameStats(game: any) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.espn_game_id}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore?.players) {
      console.log(chalk.red(`    No boxscore data for NHL game ${game.espn_game_id}`));
      return;
    }
    
    const stats: any[] = [];
    
    for (const teamData of response.data.boxscore.players) {
      const teamId = teamData.team.id === game.home_espn_id 
        ? game.home_team_id 
        : game.away_team_id;
      
      for (const category of teamData.statistics || []) {
        for (const player of category.athletes || []) {
          if (!player.stats) continue;
          
          const values = player.stats;
          const keys = category.keys;
          let playerStats: any = null;
          
          if (category.name === 'forwards' || category.name === 'defenses') {
            // Skater stats
            const statsObj: any = {};
            keys.forEach((key: string, index: number) => {
              const value = values[index];
              switch(key) {
                case 'goals': statsObj.goals = parseInt(value) || 0; break;
                case 'assists': statsObj.assists = parseInt(value) || 0; break;
                case 'shotsTotal': statsObj.shots = parseInt(value) || 0; break;
                case 'blockedShots': statsObj.blocks = parseInt(value) || 0; break;
                case 'hits': statsObj.hits = parseInt(value) || 0; break;
                case 'plusMinus': statsObj.plus_minus = parseInt(value) || 0; break;
                case 'penaltyMinutes': statsObj.pim = parseInt(value) || 0; break;
                case 'timeOnIce': statsObj.time_on_ice = value || '0:00'; break;
              }
            });
            statsObj.points = (statsObj.goals || 0) + (statsObj.assists || 0);
            
            playerStats = {
              stats: statsObj,
              position: player.athlete?.position?.abbreviation || (category.name === 'forwards' ? 'F' : 'D')
            };
          } else if (category.name === 'goalies') {
            // Goalie stats
            playerStats = {
              stats: {
                goals_against: parseInt(values[0]) || 0,
                shots_against: parseInt(values[1]) || 0,
                saves: parseInt(values[4]) || 0,
                save_percentage: parseFloat(values[5]) || 0,
                time_on_ice: values[9] || '0:00',
                wins: values[11]?.includes('W') ? 1 : 0,
                losses: values[11]?.includes('L') ? 1 : 0,
                overtime_losses: values[11]?.includes('OT') ? 1 : 0
              },
              position: 'G'
            };
          }
          
          if (playerStats) {
            const fullStats = {
              player_id: await getOrCreatePlayer(player.athlete, teamId, 'NHL'),
              game_id: game.id,
              team_id: teamId,
              opponent_id: teamId === game.home_team_id ? game.away_team_id : game.home_team_id,
              sport: 'NHL',
              season: game.season,
              position: playerStats.position,
              played: true,
              started: player.starter || false,
              stats: playerStats.stats,
              data_source: 'espn_api',
              confidence_score: 0.95
            };
            
            if (fullStats.player_id) {
              stats.push(fullStats);
            }
          }
        }
      }
    }
    
    if (stats.length > 0) {
      await insertStats(stats);
      console.log(chalk.green(`    ✅ Collected ${stats.length} NHL stats`));
    }
    
  } catch (error: any) {
    console.log(chalk.red(`    Failed to collect NHL game ${game.espn_game_id}: ${error.message}`));
  }
}

async function getOrCreatePlayer(athlete: any, teamId: number, sport: string): Promise<number | null> {
  if (!athlete?.id || !athlete?.displayName) return null;
  
  try {
    // Check if player exists
    const existing = await pool.query(
      'SELECT id FROM players_master WHERE espn_id = $1',
      [parseInt(athlete.id)]
    );
    
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }
    
    // Create new player
    const result = await pool.query(`
      INSERT INTO players_master (
        our_player_id, name, sport, team_id, position, espn_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, [
      `${sport}_${athlete.id}`,
      athlete.displayName,
      sport,
      teamId,
      athlete.position?.abbreviation || 'F',
      parseInt(athlete.id),
      'active'
    ]);
    
    return result.rows[0].id;
    
  } catch (error) {
    console.error('Failed to create player:', error);
    return null;
  }
}

async function insertStats(stats: any[]) {
  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;
  
  stats.forEach(stat => {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
    values.push(
      stat.game_id,
      stat.player_id,
      stat.team_id,
      stat.opponent_id,
      stat.sport,
      stat.season,
      stat.position,
      stat.played,
      stat.started,
      stat.stats,
      stat.data_source,
      stat.confidence_score
    );
  });
  
  await pool.query(`
    INSERT INTO player_game_stats (
      game_id, player_id, team_id, opponent_id, sport, season,
      position, played, started, stats, data_source, confidence_score
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (game_id, player_id) DO NOTHING
  `, values);
}

// Run the collector
collectMissingStats().catch(console.error);