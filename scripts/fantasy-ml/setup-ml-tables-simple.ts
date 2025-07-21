#!/usr/bin/env tsx
/**
 * 🗄️ Setup ML Tables (Simple Version)
 * Creates ML tables without foreign key constraints
 */

import chalk from 'chalk';
import { pgPool } from './config/database';
import fs from 'fs/promises';
import path from 'path';

async function setupMLTablesSimple() {
  console.log(chalk.cyan.bold('\n🚀 Setting up ML Tables (Simple Version)...\n'));
  
  try {
    // Check if fix script exists
    const fixScriptPath = path.join(process.cwd(), 'scripts', 'fix-fantasy-tables.sql');
    try {
      await fs.access(fixScriptPath);
      console.log(chalk.green('✅ Found fix-fantasy-tables.sql'));
      
      // Read and execute the SQL file
      const sqlContent = await fs.readFile(fixScriptPath, 'utf-8');
      
      console.log(chalk.cyan('📊 Executing SQL script...'));
      await pgPool.query(sqlContent);
      
      console.log(chalk.green('✅ Fantasy ML tables created successfully!'));
      
    } catch (fileError) {
      console.log(chalk.yellow('⚠️  fix-fantasy-tables.sql not found, creating tables manually...'));
      
      // Fallback: Create tables without foreign keys
      const client = await pgPool.connect();
      
      try {
        await client.query('BEGIN');
        
        // 1. Create game_logs without FK
        console.log(chalk.cyan('Creating game_logs table...'));
        await client.query(`
          CREATE TABLE IF NOT EXISTS game_logs (
            id SERIAL PRIMARY KEY,
            player_id VARCHAR(255) NOT NULL,
            game_date DATE NOT NULL,
            season INT NOT NULL,
            week INT,
            team VARCHAR(10),
            opponent VARCHAR(10),
            is_home BOOLEAN DEFAULT true,
            minutes_played DECIMAL(5,2),
            fantasy_points DECIMAL(6,2),
            actual_points DECIMAL(6,2),
            stats JSONB,
            dk_salary INT,
            fd_salary INT,
            dk_points DECIMAL(6,2),
            fd_points DECIMAL(6,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, game_date)
          );
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_game_logs_player_date 
          ON game_logs(player_id, game_date DESC);
        `);
        
        console.log(chalk.green('✅ game_logs created'));
        
        // 2. Create injuries without FK
        console.log(chalk.cyan('Creating injuries table...'));
        await client.query(`
          CREATE TABLE IF NOT EXISTS injuries (
            id SERIAL PRIMARY KEY,
            player_id VARCHAR(255) NOT NULL,
            injury_date DATE NOT NULL,
            injury_type VARCHAR(100),
            injury_location VARCHAR(100),
            status VARCHAR(50),
            expected_return DATE,
            games_missed INT DEFAULT 0,
            fantasy_impact_score DECIMAL(3,2),
            playing_probability DECIMAL(3,2),
            source VARCHAR(50),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, injury_date)
          );
        `);
        
        console.log(chalk.green('✅ injuries created'));
        
        // 3. Create DFS tables
        console.log(chalk.cyan('Creating DFS tables...'));
        await client.query(`
          CREATE TABLE IF NOT EXISTS dfs_contests (
            id SERIAL PRIMARY KEY,
            platform VARCHAR(20) NOT NULL,
            sport VARCHAR(10) NOT NULL,
            contest_id VARCHAR(100) UNIQUE,
            contest_name VARCHAR(255),
            contest_type VARCHAR(50),
            entry_fee DECIMAL(10,2),
            total_prizes DECIMAL(12,2),
            max_entries INT,
            salary_cap INT,
            start_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS dfs_ownership (
            id SERIAL PRIMARY KEY,
            contest_id INT,
            player_id VARCHAR(255),
            ownership_pct DECIMAL(5,2),
            salary INT,
            projected_points DECIMAL(6,2),
            actual_points DECIMAL(6,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(contest_id, player_id)
          );
        `);
        
        console.log(chalk.green('✅ DFS tables created'));
        
        // 4. Create ML models table
        console.log(chalk.cyan('Creating ML models table...'));
        await client.query(`
          CREATE TABLE IF NOT EXISTS ml_models (
            id SERIAL PRIMARY KEY,
            model_name VARCHAR(100) NOT NULL,
            model_type VARCHAR(50),
            version VARCHAR(20),
            sport VARCHAR(10),
            accuracy DECIMAL(5,4),
            mae DECIMAL(6,2),
            rmse DECIMAL(6,2),
            training_date TIMESTAMP,
            training_samples INT,
            features JSONB,
            hyperparameters JSONB,
            model_path VARCHAR(255),
            is_active BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        console.log(chalk.green('✅ ML models table created'));
        
        await client.query('COMMIT');
        console.log(chalk.green.bold('\n✅ All ML tables created successfully!\n'));
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    
    // Show created tables
    const tables = await pgPool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('game_logs', 'injuries', 'dfs_contests', 'dfs_ownership', 'ml_models')
      ORDER BY tablename
    `);
    
    console.log(chalk.cyan('\n📊 ML tables created:'));
    tables.rows.forEach(row => {
      console.log(chalk.green(`  ✓ ${row.tablename}`));
    });
    
    // Check row counts
    console.log(chalk.cyan('\n📈 Table sizes:'));
    for (const table of tables.rows) {
      const count = await pgPool.query(`SELECT COUNT(*) FROM ${table.tablename}`);
      console.log(`  ${table.tablename}: ${count.rows[0].count} rows`);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error setting up ML tables:'), error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Run setup
setupMLTablesSimple();