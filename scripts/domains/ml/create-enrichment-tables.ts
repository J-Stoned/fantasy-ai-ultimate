#!/usr/bin/env tsx
/**
 * Create enrichment tables for Vegas, Weather, etc.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL_LOCAL || 'postgresql://postgres:postgres@172.30.176.1:5432/fantasy_ai_local';

const pgPool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function createEnrichmentTables() {
  console.log(chalk.cyan.bold('📊 Creating Enrichment Tables...\n'));
  
  try {
    // Vegas Lines
    console.log(chalk.yellow('Creating vegas_lines table...'));
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS vegas_lines (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(100),
        game_date DATE,
        sport VARCHAR(10),
        home_team VARCHAR(50),
        away_team VARCHAR(50),
        spread DECIMAL(3,1),
        total DECIMAL(4,1),
        home_moneyline INTEGER,
        away_moneyline INTEGER,
        implied_home_score DECIMAL(4,1),
        implied_away_score DECIMAL(4,1),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(game_id)
      )
    `);
    console.log(chalk.green('✅ Created vegas_lines'));
    
    // Weather Data
    console.log(chalk.yellow('Creating weather_data table...'));
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS weather_data (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(100),
        game_date DATE,
        temperature INTEGER,
        wind_speed INTEGER,
        precipitation DECIMAL(3,1),
        humidity INTEGER,
        conditions VARCHAR(50),
        dome BOOLEAN DEFAULT FALSE,
        overall_impact DECIMAL(3,2),
        passing_impact DECIMAL(3,2),
        rushing_impact DECIMAL(3,2),
        kicking_impact DECIMAL(3,2),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(game_id)
      )
    `);
    console.log(chalk.green('✅ Created weather_data'));
    
    // Injury Reports
    console.log(chalk.yellow('Creating injury_reports table...'));
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS injury_reports (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(50),
        player_name VARCHAR(100),
        team VARCHAR(10),
        status VARCHAR(20),
        injury_type VARCHAR(100),
        body_part VARCHAR(50),
        game_date DATE,
        impact_score DECIMAL(3,2),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(player_id, game_date)
      )
    `);
    console.log(chalk.green('✅ Created injury_reports'));
    
    // Create indexes
    console.log(chalk.yellow('\nCreating indexes...'));
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_vegas_game_date ON vegas_lines(game_date)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_weather_game_date ON weather_data(game_date)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_injury_player ON injury_reports(player_id)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_injury_date ON injury_reports(game_date)');
    console.log(chalk.green('✅ Created all indexes'));
    
    // Add some mock data for testing
    console.log(chalk.yellow('\nAdding mock data for testing...'));
    
    // Mock Vegas lines
    await pgPool.query(`
      INSERT INTO vegas_lines (game_id, game_date, sport, home_team, away_team, spread, total, 
        home_moneyline, away_moneyline, implied_home_score, implied_away_score)
      VALUES 
        ('NFL_KC_BUF_20250126', '2025-01-26', 'nfl', 'KC', 'BUF', -3.5, 52.5, -170, 150, 28.0, 24.5),
        ('NFL_GB_SF_20250126', '2025-01-26', 'nfl', 'SF', 'GB', -7.0, 48.0, -280, 230, 27.5, 20.5)
      ON CONFLICT (game_id) DO NOTHING
    `);
    
    // Mock weather data
    await pgPool.query(`
      INSERT INTO weather_data (game_id, game_date, temperature, wind_speed, precipitation, 
        humidity, conditions, dome, overall_impact, passing_impact, rushing_impact, kicking_impact)
      VALUES 
        ('NFL_KC_BUF_20250126', '2025-01-26', 35, 15, 0.0, 60, 'Cold/Windy', false, -0.1, -0.15, 0.05, -0.2),
        ('NFL_GB_SF_20250126', '2025-01-26', 65, 5, 0.0, 50, 'Clear', false, 0.0, 0.0, 0.0, 0.0)
      ON CONFLICT (game_id) DO NOTHING
    `);
    
    console.log(chalk.green('✅ Added mock data'));
    
    console.log(chalk.green('\n✅ All enrichment tables created successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  } finally {
    await pgPool.end();
  }
}

createEnrichmentTables();