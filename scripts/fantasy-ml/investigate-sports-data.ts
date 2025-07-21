#!/usr/bin/env tsx
/**
 * Investigate what sports data we actually have
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function investigateData() {
  console.log(chalk.cyan('🔍 Investigating Sports Data...\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // 1. Check what sports we have
    console.log(chalk.yellow('🏀 Sports in database:'));
    const sportsQuery = `
      SELECT DISTINCT t.sport_id, t.sport, COUNT(DISTINCT t.id) as teams
      FROM teams t
      GROUP BY t.sport_id, t.sport
      ORDER BY teams DESC;
    `;
    const sportsResult = await client.query(sportsQuery);
    sportsResult.rows.forEach(row => {
      console.log(`  sport_id: ${row.sport_id}, sport: ${row.sport} (${row.teams} teams)`);
    });
    
    // 2. Check game date ranges
    console.log(chalk.yellow('\n📅 Game date ranges:'));
    const dateQuery = `
      SELECT 
        MIN(game_date::date) as earliest_game,
        MAX(game_date::date) as latest_game,
        COUNT(*) as total_games
      FROM player_game_logs
      WHERE game_date IS NOT NULL;
    `;
    const dateResult = await client.query(dateQuery);
    const dates = dateResult.rows[0];
    console.log(`  Earliest: ${dates.earliest_game}`);
    console.log(`  Latest: ${dates.latest_game}`);
    console.log(`  Total games: ${dates.total_games}`);
    
    // 3. Check recent games by sport
    console.log(chalk.yellow('\n🎮 Recent games by sport:'));
    const recentQuery = `
      SELECT 
        t.sport_id, 
        t.sport,
        COUNT(DISTINCT pgl.game_id) as games,
        MAX(pgl.game_date::date) as latest_game
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      JOIN teams t ON p.team_id = t.id
      WHERE pgl.game_date::date > CURRENT_DATE - INTERVAL '365 days'
      GROUP BY t.sport_id, t.sport
      ORDER BY games DESC;
    `;
    const recentResult = await client.query(recentQuery);
    recentResult.rows.forEach(row => {
      console.log(`  ${row.sport || row.sport_id}: ${row.games} games (latest: ${row.latest_game})`);
    });
    
    // 4. Check player_stats data
    console.log(chalk.yellow('\n📊 Player stats by type:'));
    const statsQuery = `
      SELECT stat_type, COUNT(*) as count
      FROM player_stats
      GROUP BY stat_type
      ORDER BY count DESC
      LIMIT 20;
    `;
    const statsResult = await client.query(statsQuery);
    statsResult.rows.forEach(row => {
      console.log(`  ${row.stat_type}: ${row.count}`);
    });
    
    // 5. Sample NBA data if sport_id = 2
    console.log(chalk.yellow('\n🏀 Sample NBA data (sport_id = 2):'));
    const nbaQuery = `
      SELECT 
        p.firstname || ' ' || p.lastname as player,
        t.name as team,
        COUNT(DISTINCT pgl.game_id) as games,
        AVG(CASE WHEN ps.stat_type = 'points' THEN ps.stat_value::numeric END) as avg_points
      FROM players p
      JOIN teams t ON p.team_id = t.id
      JOIN player_game_logs pgl ON p.id = pgl.player_id
      LEFT JOIN player_stats ps ON p.id = ps.player_id AND pgl.game_id = ps.game_id
      WHERE t.sport_id = '2'
      AND pgl.game_date::date > CURRENT_DATE - INTERVAL '365 days'
      GROUP BY p.id, p.firstname, p.lastname, t.name
      HAVING COUNT(DISTINCT pgl.game_id) > 10
      ORDER BY avg_points DESC NULLS LAST
      LIMIT 5;
    `;
    const nbaResult = await client.query(nbaQuery);
    if (nbaResult.rows.length > 0) {
      nbaResult.rows.forEach(row => {
        console.log(`  ${row.player} (${row.team}): ${row.games} games, ${row.avg_points?.toFixed(1) || 'N/A'} ppg`);
      });
    } else {
      console.log(chalk.red('  No NBA players found with sport_id = 2'));
    }
    
    // 6. Check all sport IDs for basketball
    console.log(chalk.yellow('\n🔍 Looking for basketball teams:'));
    const basketballQuery = `
      SELECT id, name, sport_id, sport, abbreviation
      FROM teams
      WHERE LOWER(name) LIKE '%lakers%' 
         OR LOWER(name) LIKE '%celtics%'
         OR LOWER(name) LIKE '%warriors%'
         OR LOWER(sport) LIKE '%basket%'
         OR LOWER(name) LIKE '%nba%'
      LIMIT 10;
    `;
    const basketballResult = await client.query(basketballQuery);
    basketballResult.rows.forEach(row => {
      console.log(`  ${row.name} - sport_id: ${row.sport_id}, sport: ${row.sport}`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

investigateData().catch(console.error);