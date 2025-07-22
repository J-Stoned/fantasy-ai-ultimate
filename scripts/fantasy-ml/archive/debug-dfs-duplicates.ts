#!/usr/bin/env tsx
/**
 * Debug DFS duplicate player issue
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugDuplicates() {
  console.log(chalk.cyan('🔍 Debugging DFS Duplicates\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Check for duplicate player_ids
    console.log(chalk.yellow('📊 Checking for duplicate player_ids in dfs_salaries:'));
    const dupQuery = `
      SELECT player_id, player_name, COUNT(*) as count
      FROM dfs_salaries
      GROUP BY player_id, player_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10;
    `;
    const dups = await client.query(dupQuery);
    if (dups.rows.length > 0) {
      console.log(chalk.red('❌ Found duplicates:'));
      dups.rows.forEach(row => {
        console.log(`  ${row.player_name} (ID: ${row.player_id}): ${row.count} entries`);
      });
    } else {
      console.log(chalk.green('✅ No duplicates found by player_id'));
    }
    
    // Check unique constraint
    console.log(chalk.yellow('\n🔑 Checking unique constraint:'));
    const constraintQuery = `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'dfs_salaries'::regclass
      AND contype = 'u';
    `;
    const constraints = await client.query(constraintQuery);
    constraints.rows.forEach(row => {
      console.log(`  ${row.conname}: ${row.definition}`);
    });
    
    // Check what we have for Spencer Strider
    console.log(chalk.yellow('\n🎯 Checking Spencer Strider entries:'));
    const striderQuery = `
      SELECT player_id, player_name, position, team, salary, projected_points, platform, game_date
      FROM dfs_salaries
      WHERE player_name LIKE '%Strider%'
      ORDER BY projected_points DESC;
    `;
    const strider = await client.query(striderQuery);
    console.log(`Found ${strider.rows.length} entries for Strider:`);
    strider.rows.forEach(row => {
      console.log(`  ID: ${row.player_id}, ${row.position}, ${row.team}, $${row.salary}, ${row.projected_points} pts, ${row.platform}, ${row.game_date}`);
    });
    
    // Check actual positions in players table
    console.log(chalk.yellow('\n⚾ Checking baseball positions in players table:'));
    const posQuery = `
      SELECT DISTINCT 
        CASE 
          WHEN position IS NULL THEN 'NULL'
          WHEN position::text = '' THEN 'EMPTY'
          ELSE position::text
        END as pos,
        COUNT(*) as count
      FROM players
      WHERE sport_id = '2'
      GROUP BY pos
      ORDER BY count DESC
      LIMIT 20;
    `;
    const positions = await client.query(posQuery);
    console.log('Baseball positions:');
    positions.rows.forEach(row => {
      console.log(`  ${row.pos}: ${row.count} players`);
    });
    
    // Sample player with position
    console.log(chalk.yellow('\n📋 Sample player data:'));
    const sampleQuery = `
      SELECT id, firstname, lastname, position, team_id
      FROM players
      WHERE sport_id = '2'
      AND position IS NOT NULL
      AND position::text != ''
      LIMIT 5;
    `;
    const samples = await client.query(sampleQuery);
    samples.rows.forEach(row => {
      console.log(`  ${row.firstname} ${row.lastname} - Position: ${row.position} (ID: ${row.id})`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

debugDuplicates().catch(console.error);