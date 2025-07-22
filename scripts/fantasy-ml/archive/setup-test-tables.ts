#!/usr/bin/env tsx
/**
 * Create test tables for the master test suite
 */

import { pgPool } from './config/database';
import chalk from 'chalk';

async function setupTestTables() {
  console.log(chalk.cyan('Setting up test tables...'));
  
  try {
    // Create tables
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS historical_ownership (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(100) NOT NULL,
        contest_date DATE NOT NULL,
        actual_ownership DECIMAL(5,4),
        contest_type VARCHAR(20),
        slate_size VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS contest_results (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        username VARCHAR(255),
        sport VARCHAR(10),
        contest_id VARCHAR(100),
        contest_date DATE,
        entry_fee DECIMAL(10,2),
        winnings DECIMAL(10,2),
        finish_position INTEGER,
        total_entries INTEGER,
        last_played TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS contests (
        contest_id VARCHAR(100) PRIMARY KEY,
        contest_type VARCHAR(20),
        entry_fee DECIMAL(10,2),
        total_entries INTEGER,
        paid_spots INTEGER,
        sport VARCHAR(10),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create indexes
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_historical_ownership_player_date ON historical_ownership(player_id, contest_date)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_contest_results_user_sport ON contest_results(user_id, sport)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_contest_results_date ON contest_results(contest_date)');
    
    console.log(chalk.green('✅ Test tables created successfully!'));
    
  } catch (error) {
    console.error(chalk.red('Error creating tables:'), error);
  } finally {
    await pgPool.end();
  }
}

setupTestTables();