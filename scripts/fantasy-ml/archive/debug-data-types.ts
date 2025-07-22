#!/usr/bin/env tsx
/**
 * Debug data types in the database
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugDataTypes() {
  console.log(chalk.cyan('🔍 Debugging Data Type Issues...\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Check teams table structure
    console.log(chalk.yellow('📊 Teams table column types:'));
    const teamsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'teams'
      AND column_name IN ('id', 'sport_id', 'sport', 'abbreviation')
      ORDER BY ordinal_position;
    `;
    const teamsResult = await client.query(teamsQuery);
    teamsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${chalk.green(col.data_type)}`);
    });
    
    // Check player_stats table structure
    console.log(chalk.yellow('\n📊 Player_stats table column types:'));
    const statsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_stats'
      AND column_name IN ('stat_type', 'stat_value')
      ORDER BY ordinal_position;
    `;
    const statsResult = await client.query(statsQuery);
    statsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${chalk.green(col.data_type)}`);
    });
    
    // Check sample data from player_stats
    console.log(chalk.yellow('\n📊 Sample player_stats data:'));
    const sampleQuery = `
      SELECT DISTINCT stat_type, pg_typeof(stat_value) as value_type
      FROM player_stats
      LIMIT 10;
    `;
    const sampleResult = await client.query(sampleQuery);
    sampleResult.rows.forEach(row => {
      console.log(`  stat_type: ${row.stat_type}, value_type: ${chalk.green(row.value_type)}`);
    });
    
    // Check which sports have data
    console.log(chalk.yellow('\n🏀 Teams by sport_id:'));
    const sportsQuery = `
      SELECT sport_id, COUNT(*) as team_count
      FROM teams
      WHERE sport_id IS NOT NULL
      GROUP BY sport_id
      ORDER BY team_count DESC;
    `;
    const sportsResult = await client.query(sportsQuery);
    sportsResult.rows.forEach(row => {
      console.log(`  sport_id: ${row.sport_id} (${chalk.green(row.team_count)} teams)`);
    });
    
    // Check if we have NBA teams
    console.log(chalk.yellow('\n🏀 Looking for NBA teams:'));
    const nbaQuery = `
      SELECT id, name, abbreviation, sport_id, sport
      FROM teams
      WHERE sport_id = '2' 
         OR sport = 'NBA' 
         OR sport = 'basketball'
         OR LOWER(name) LIKE '%lakers%'
         OR LOWER(name) LIKE '%celtics%'
      LIMIT 10;
    `;
    const nbaResult = await client.query(nbaQuery);
    if (nbaResult.rows.length > 0) {
      nbaResult.rows.forEach(team => {
        console.log(`  ${team.name} (${team.abbreviation}) - sport_id: ${team.sport_id}, sport: ${team.sport}`);
      });
    } else {
      console.log(chalk.red('  No NBA teams found!'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

debugDataTypes().catch(console.error);