#!/usr/bin/env tsx
/**
 * Debug schema creation
 */

import { pgPool } from '../fantasy-ml/config/database';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

async function debugSchema() {
  try {
    const schemaFile = path.join(__dirname, 'phase1-create-schema.sql');
    const schemaSql = await fs.readFile(schemaFile, 'utf-8');
    
    // Split into statements
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(chalk.cyan(`Found ${statements.length} statements\n`));
    
    // Show first few statements
    console.log(chalk.yellow('First 10 statements:'));
    statements.slice(0, 10).forEach((stmt, i) => {
      const firstLine = stmt.split('\n')[0];
      console.log(`${i + 1}. ${firstLine}`);
    });
    
    // Try to create just the teams_master table manually
    console.log(chalk.cyan('\nTrying to create teams_master table...'));
    
    const createTeamsTable = `
      CREATE TABLE teams_master (
        id SERIAL PRIMARY KEY,
        our_team_id VARCHAR(50) UNIQUE NOT NULL,
        sport VARCHAR(20) NOT NULL,
        league VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        city VARCHAR(50),
        abbreviation VARCHAR(10),
        
        -- External platform IDs
        espn_id VARCHAR(50),
        mlb_api_id VARCHAR(50),
        ncaa_id VARCHAR(50),
        yahoo_id VARCHAR(50),
        cbs_id VARCHAR(50),
        sleeper_id VARCHAR(50),
        dk_id VARCHAR(50),
        fd_id VARCHAR(50),
        
        -- Additional metadata
        conference VARCHAR(50),
        division VARCHAR(50),
        parent_org_id INTEGER,
        venue_name VARCHAR(100),
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    try {
      await pgPool.query(createTeamsTable);
      console.log(chalk.green('✓ teams_master created successfully!'));
    } catch (error: any) {
      console.log(chalk.red('✗ Failed to create teams_master:'), error.message);
    }
    
    // Check if it exists now
    const check = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'teams_master'
      )
    `);
    
    console.log(chalk.cyan('\nDoes teams_master exist?'), check.rows[0].exists);
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

debugSchema();