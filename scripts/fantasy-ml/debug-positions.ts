#!/usr/bin/env tsx
/**
 * Debug positions in the database
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugPositions() {
  console.log(chalk.cyan('🔍 Debugging Player Positions\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Check position column data type
    console.log(chalk.yellow('📊 Checking position column data type:'));
    const typeQuery = `
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'players' 
      AND column_name = 'position';
    `;
    const typeInfo = await client.query(typeQuery);
    console.log('Position column info:', typeInfo.rows[0]);
    
    // Check sample positions
    console.log(chalk.yellow('\n📋 Sample player positions (raw):'));
    const sampleQuery = `
      SELECT 
        id,
        firstname,
        lastname,
        position,
        position IS NULL as is_null,
        position = '' as is_empty,
        LENGTH(position::text) as length,
        pg_typeof(position) as type
      FROM players
      WHERE position IS NOT NULL
      LIMIT 10;
    `;
    const samples = await client.query(sampleQuery);
    samples.rows.forEach(row => {
      console.log(`  ${row.firstname} ${row.lastname}: position="${row.position}", null=${row.is_null}, empty=${row.is_empty}, length=${row.length}, type=${row.type}`);
    });
    
    // Check if positions are stored elsewhere
    console.log(chalk.yellow('\n🏷️ Checking player_stats for position info:'));
    const statsQuery = `
      SELECT 
        ps.player_id,
        ps.stat_type,
        p.firstname,
        p.lastname,
        p.position
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      WHERE ps.stat_type IN ('batting', 'pitching')
      LIMIT 10;
    `;
    const statsPos = await client.query(statsQuery);
    statsPos.rows.forEach(row => {
      console.log(`  ${row.firstname} ${row.lastname}: stat_type=${row.stat_type}, position="${row.position}"`);
    });
    
    // Check if we can infer positions from stats
    console.log(chalk.yellow('\n⚾ Players by stat type:'));
    const inferQuery = `
      SELECT 
        ps.stat_type,
        COUNT(DISTINCT ps.player_id) as players,
        COUNT(DISTINCT CASE WHEN p.position IS NOT NULL AND p.position != '' THEN ps.player_id END) as with_position
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      WHERE ps.stat_type IN ('batting', 'pitching', 'fielding')
      GROUP BY ps.stat_type;
    `;
    const infer = await client.query(inferQuery);
    infer.rows.forEach(row => {
      console.log(`  ${row.stat_type}: ${row.players} players (${row.with_position} have positions)`);
    });
    
    // Try to find position data in other columns
    console.log(chalk.yellow('\n🔍 Checking all columns in players table:'));
    const colQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'players'
      AND column_name ILIKE '%pos%' OR column_name ILIKE '%role%'
      ORDER BY ordinal_position;
    `;
    const cols = await client.query(colQuery);
    console.log('Position-related columns:');
    cols.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check game logs for position info
    console.log(chalk.yellow('\n📊 Checking if game logs have position data:'));
    const gameLogQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_game_logs'
      AND (column_name ILIKE '%pos%' OR column_name = 'stats')
      ORDER BY ordinal_position;
    `;
    const gameLogCols = await client.query(gameLogQuery);
    console.log('Game log columns:');
    gameLogCols.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if stats JSONB contains position
    console.log(chalk.yellow('\n📦 Checking stats JSONB for position data:'));
    const jsonQuery = `
      SELECT 
        pgl.player_id,
        p.firstname,
        p.lastname,
        pgl.stats,
        jsonb_typeof(pgl.stats) as stats_type
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      WHERE pgl.stats IS NOT NULL
      AND jsonb_typeof(pgl.stats) = 'object'
      LIMIT 3;
    `;
    const jsonStats = await client.query(jsonQuery);
    jsonStats.rows.forEach((row, i) => {
      console.log(`\nPlayer ${i+1}: ${row.firstname} ${row.lastname}`);
      if (row.stats && typeof row.stats === 'object') {
        const keys = Object.keys(row.stats);
        console.log(`  Stats keys: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`);
        // Check for position in stats
        if (row.stats.position) {
          console.log(`  Found position in stats: ${row.stats.position}`);
        }
      }
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

debugPositions().catch(console.error);