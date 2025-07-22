#!/usr/bin/env tsx
/**
 * Find MLB players in the database
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function findMLBPlayers() {
  console.log(chalk.cyan('⚾ Finding MLB Players\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // First, let's see what MLB teams we have
    console.log(chalk.yellow('📊 MLB Teams in database:'));
    const mlbTeamsQuery = `
      SELECT DISTINCT id, name, abbreviation
      FROM teams
      WHERE sport_id = 'mlb'
      ORDER BY name
      LIMIT 10;
    `;
    const mlbTeams = await client.query(mlbTeamsQuery);
    console.log(`Found ${mlbTeams.rows.length} MLB teams with sport_id='mlb'`);
    mlbTeams.rows.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation})`);
    });
    
    // Check players table structure
    console.log(chalk.yellow('\n📊 Players table info:'));
    const playersInfoQuery = `
      SELECT 
        COUNT(*) as total_players,
        COUNT(DISTINCT team_id) as total_teams,
        COUNT(DISTINCT sport_id) as total_sports
      FROM players;
    `;
    const playersInfo = await client.query(playersInfoQuery);
    console.log('Players table stats:', playersInfo.rows[0]);
    
    // Check what sports we have in players
    console.log(chalk.yellow('\n🏈 Sports in players table:'));
    const sportsQuery = `
      SELECT sport_id, COUNT(*) as player_count
      FROM players
      WHERE sport_id IS NOT NULL
      GROUP BY sport_id
      ORDER BY player_count DESC
      LIMIT 10;
    `;
    const sports = await client.query(sportsQuery);
    sports.rows.forEach(sport => {
      console.log(`  ${sport.sport_id}: ${sport.player_count} players`);
    });
    
    // Look for baseball players specifically
    console.log(chalk.yellow('\n⚾ Looking for baseball players:'));
    const baseballQuery = `
      SELECT 
        p.id,
        p.firstname,
        p.lastname,
        p.position,
        t.name as team_name,
        t.abbreviation as team_abbr
      FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.sport_id = 'mlb' 
         OR t.sport_id = 'mlb'
         OR p.position IN ('P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH')
      LIMIT 20;
    `;
    const baseball = await client.query(baseballQuery);
    console.log(`Found ${baseball.rows.length} potential baseball players`);
    baseball.rows.forEach(player => {
      console.log(`  ${player.firstname} ${player.lastname} - ${player.position} - ${player.team_name || 'No Team'}`);
    });
    
    // Check game logs for any baseball data
    console.log(chalk.yellow('\n📊 Game logs analysis:'));
    const gameLogsQuery = `
      SELECT 
        sport_name,
        COUNT(*) as log_count,
        COUNT(DISTINCT player_id) as unique_players,
        MIN(game_date) as earliest_game,
        MAX(game_date) as latest_game
      FROM player_game_logs
      WHERE sport_name IS NOT NULL
      GROUP BY sport_name
      ORDER BY log_count DESC
      LIMIT 10;
    `;
    const gameLogs = await client.query(gameLogsQuery);
    console.log('Game logs by sport:');
    gameLogs.rows.forEach(log => {
      console.log(`  ${log.sport_name}: ${log.log_count} logs, ${log.unique_players} players, ${log.earliest_game} to ${log.latest_game}`);
    });
    
    // Check player_stats for baseball
    console.log(chalk.yellow('\n📊 Player stats analysis:'));
    const statsQuery = `
      SELECT 
        ps.stat_type,
        COUNT(DISTINCT ps.player_id) as player_count,
        COUNT(*) as stat_count
      FROM player_stats ps
      WHERE ps.stat_type IN ('batting', 'pitching', 'fielding')
      GROUP BY ps.stat_type
      ORDER BY player_count DESC;
    `;
    const stats = await client.query(statsQuery);
    console.log('Baseball-related stats:');
    stats.rows.forEach(stat => {
      console.log(`  ${stat.stat_type}: ${stat.player_count} players, ${stat.stat_count} records`);
    });
    
    // Sample some batting stats to see what teams they're from
    console.log(chalk.yellow('\n⚾ Sample batting stats with teams:'));
    const sampleBattingQuery = `
      SELECT 
        p.firstname,
        p.lastname,
        t.name as team_name,
        t.abbreviation,
        ps.stat_value
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE ps.stat_type = 'batting'
      AND t.name IS NOT NULL
      ORDER BY p.id
      LIMIT 10;
    `;
    const sampleBatting = await client.query(sampleBattingQuery);
    console.log('Sample batters:');
    sampleBatting.rows.forEach(player => {
      console.log(`  ${player.firstname} ${player.lastname} (${player.team_name}) - Stats: ${player.stat_value}`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

findMLBPlayers().catch(console.error);