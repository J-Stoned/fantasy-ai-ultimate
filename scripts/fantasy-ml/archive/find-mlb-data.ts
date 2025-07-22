#!/usr/bin/env tsx
/**
 * Find MLB data in the database
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MLB_TEAMS = [
  'Diamondbacks', 'Braves', 'Orioles', 'Red Sox', 'Cubs', 'White Sox', 
  'Reds', 'Guardians', 'Tigers', 'Astros', 'Royals', 'Angels', 
  'Dodgers', 'Marlins', 'Brewers', 'Twins', 'Mets', 'Yankees', 
  'Athletics', 'Phillies', 'Pirates', 'Padres', 'Giants', 'Mariners', 
  'Cardinals', 'Rays', 'Rangers', 'Blue Jays', 'Nationals', 'Rockies'
];

async function findMLBData() {
  console.log(chalk.cyan('🔍 Finding MLB Data\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Check teams table
    console.log(chalk.yellow('🏟️ Checking teams table for MLB teams:'));
    const teamsQuery = `
      SELECT id, name, abbreviation, sport_id
      FROM teams
      WHERE name ILIKE ANY(ARRAY[${MLB_TEAMS.map(t => `'%${t}%'`).join(',')}])
      ORDER BY name;
    `;
    const teams = await client.query(teamsQuery);
    console.log(`Found ${teams.rows.length} MLB teams:`);
    teams.rows.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation}) - Sport ID: ${team.sport_id}`);
    });
    
    if (teams.rows.length > 0) {
      // Get players from these teams
      const mlbTeamIds = teams.rows.map(t => t.id);
      console.log(chalk.yellow('\n⚾ Checking players from MLB teams:'));
      const playersQuery = `
        SELECT 
          COUNT(*) as player_count,
          COUNT(DISTINCT p.team_id) as team_count,
          STRING_AGG(DISTINCT t.name, ', ' LIMIT 5) as sample_teams
        FROM players p
        JOIN teams t ON p.team_id = t.id
        WHERE p.team_id = ANY($1);
      `;
      const players = await client.query(playersQuery, [mlbTeamIds]);
      const stats = players.rows[0];
      console.log(`  Players: ${stats.player_count}`);
      console.log(`  Teams: ${stats.team_count}`);
      console.log(`  Sample teams: ${stats.sample_teams}`);
      
      // Check game logs for these players
      console.log(chalk.yellow('\n📊 Checking game logs for MLB players:'));
      const gameLogsQuery = `
        SELECT 
          COUNT(*) as log_count,
          AVG(pgl.fantasy_points) as avg_points,
          MIN(pgl.fantasy_points) as min_points,
          MAX(pgl.fantasy_points) as max_points
        FROM player_game_logs pgl
        JOIN players p ON pgl.player_id = p.id
        WHERE p.team_id = ANY($1)
        AND pgl.fantasy_points > 0;
      `;
      const gameLogs = await client.query(gameLogsQuery, [mlbTeamIds]);
      const logStats = gameLogs.rows[0];
      console.log(`  Game logs: ${logStats.log_count}`);
      console.log(`  Fantasy points: ${logStats.min_points} - ${logStats.max_points} (avg: ${Number(logStats.avg_points).toFixed(1)})`);
      
      // Sample some MLB players
      console.log(chalk.yellow('\n👥 Sample MLB players:'));
      const sampleQuery = `
        SELECT 
          p.firstname,
          p.lastname,
          p.position,
          t.name as team,
          AVG(pgl.fantasy_points) as avg_points
        FROM players p
        JOIN teams t ON p.team_id = t.id
        LEFT JOIN player_game_logs pgl ON p.id = pgl.player_id
        WHERE p.team_id = ANY($1)
        GROUP BY p.id, p.firstname, p.lastname, p.position, t.name
        HAVING AVG(pgl.fantasy_points) > 10
        ORDER BY AVG(pgl.fantasy_points) DESC
        LIMIT 10;
      `;
      const samples = await client.query(sampleQuery, [mlbTeamIds]);
      samples.rows.forEach(player => {
        console.log(`  ${player.firstname} ${player.lastname} (${player.team}) - ${player.position} - ${Number(player.avg_points).toFixed(1)} pts`);
      });
    }
    
    // Check if game logs have any recognizable MLB players
    console.log(chalk.yellow('\n🎮 Checking game logs for known MLB players:'));
    const knownPlayers = ['Judge', 'Ohtani', 'Acuna', 'Trout', 'Betts', 'Freeman'];
    const knownQuery = `
      SELECT DISTINCT
        p.firstname,
        p.lastname,
        t.name as team,
        COUNT(pgl.id) as games,
        AVG(pgl.fantasy_points) as avg_points
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.lastname ILIKE ANY(ARRAY[${knownPlayers.map(n => `'%${n}%'`).join(',')}])
      GROUP BY p.id, p.firstname, p.lastname, t.name
      ORDER BY AVG(pgl.fantasy_points) DESC
      LIMIT 10;
    `;
    const known = await client.query(knownQuery);
    if (known.rows.length > 0) {
      console.log('Found known MLB players:');
      known.rows.forEach(player => {
        console.log(`  ${player.firstname} ${player.lastname} (${player.team}) - ${player.games} games, ${Number(player.avg_points).toFixed(1)} avg pts`);
      });
    } else {
      console.log('No known MLB players found in game logs');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

findMLBData().catch(console.error);