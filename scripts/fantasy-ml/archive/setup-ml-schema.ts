#!/usr/bin/env tsx
/**
 * 🗄️ Setup ML-Compatible Database Schema
 * Creates all necessary tables and columns for the ML system
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

async function setupMLSchema() {
  console.log(chalk.cyan.bold('\n🚀 Setting up ML-Compatible Database Schema...\n'));
  
  try {
    // Start transaction
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Create game_logs table
      console.log(chalk.cyan('📊 Creating game_logs table...'));
      await client.query(`
        CREATE TABLE IF NOT EXISTS game_logs (
          id SERIAL PRIMARY KEY,
          player_id VARCHAR(255) REFERENCES players(id),
          game_date DATE NOT NULL,
          season INT NOT NULL,
          week INT,
          team VARCHAR(10),
          opponent VARCHAR(10),
          is_home BOOLEAN DEFAULT true,
          
          -- Performance metrics
          minutes_played DECIMAL(5,2),
          fantasy_points DECIMAL(6,2),
          actual_points DECIMAL(6,2),
          
          -- Sport-specific stats (stored as JSONB for flexibility)
          stats JSONB,
          
          -- DFS specific
          dk_salary INT,
          fd_salary INT,
          dk_points DECIMAL(6,2),
          fd_points DECIMAL(6,2),
          
          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- Indexes
          UNIQUE(player_id, game_date)
        );
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_game_logs_player_date 
        ON game_logs(player_id, game_date DESC);
      `);
      
      console.log(chalk.green('✅ game_logs table created'));
      
      // 2. Create injuries table
      console.log(chalk.cyan('🏥 Creating injuries table...'));
      await client.query(`
        CREATE TABLE IF NOT EXISTS injuries (
          id SERIAL PRIMARY KEY,
          player_id VARCHAR(255) REFERENCES players(id),
          injury_date DATE NOT NULL,
          injury_type VARCHAR(100),
          injury_location VARCHAR(100),
          status VARCHAR(50), -- 'Out', 'Questionable', 'Doubtful', 'Day-to-Day'
          expected_return DATE,
          games_missed INT DEFAULT 0,
          
          -- Impact metrics
          fantasy_impact_score DECIMAL(3,2), -- 0-1 scale
          playing_probability DECIMAL(3,2), -- 0-1 scale
          
          -- Metadata
          source VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- Indexes
          UNIQUE(player_id, injury_date)
        );
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_injuries_player_status 
        ON injuries(player_id, status);
      `);
      
      console.log(chalk.green('✅ injuries table created'));
      
      // 3. Add ML-specific columns to player_stats if they don't exist
      console.log(chalk.cyan('🔧 Adding ML columns to player_stats...'));
      
      const columnsToAdd = [
        { name: 'is_home', type: 'BOOLEAN DEFAULT true' },
        { name: 'dk_salary', type: 'INT' },
        { name: 'fd_salary', type: 'INT' },
        { name: 'dk_points', type: 'DECIMAL(6,2)' },
        { name: 'fd_points', type: 'DECIMAL(6,2)' },
        { name: 'weather_temp', type: 'INT' },
        { name: 'weather_wind', type: 'INT' },
        { name: 'weather_condition', type: 'VARCHAR(50)' },
        { name: 'vegas_total', type: 'DECIMAL(5,2)' },
        { name: 'vegas_spread', type: 'DECIMAL(5,2)' },
        { name: 'opponent_rank_vs_position', type: 'INT' },
        { name: 'rest_days', type: 'INT DEFAULT 7' }
      ];
      
      for (const col of columnsToAdd) {
        try {
          await client.query(`
            ALTER TABLE player_stats 
            ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
          `);
          console.log(chalk.green(`  ✓ Added ${col.name}`));
        } catch (error) {
          console.log(chalk.yellow(`  ⚠️  Column ${col.name} might already exist`));
        }
      }
      
      // 4. Create DFS-specific tables
      console.log(chalk.cyan('💰 Creating DFS tables...'));
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS dfs_contests (
          id SERIAL PRIMARY KEY,
          platform VARCHAR(20) NOT NULL, -- 'DraftKings', 'FanDuel'
          sport VARCHAR(10) NOT NULL,
          contest_id VARCHAR(100) UNIQUE,
          contest_name VARCHAR(255),
          contest_type VARCHAR(50), -- 'GPP', 'Cash', 'Satellite'
          entry_fee DECIMAL(10,2),
          total_prizes DECIMAL(12,2),
          max_entries INT,
          salary_cap INT,
          start_time TIMESTAMP,
          
          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS dfs_ownership (
          id SERIAL PRIMARY KEY,
          contest_id INT REFERENCES dfs_contests(id),
          player_id VARCHAR(255) REFERENCES players(id),
          ownership_pct DECIMAL(5,2),
          salary INT,
          projected_points DECIMAL(6,2),
          actual_points DECIMAL(6,2),
          
          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- Indexes
          UNIQUE(contest_id, player_id)
        );
      `);
      
      console.log(chalk.green('✅ DFS tables created'));
      
      // 5. Create ML model tracking table
      console.log(chalk.cyan('🤖 Creating ML model tracking table...'));
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS ml_models (
          id SERIAL PRIMARY KEY,
          model_name VARCHAR(100) NOT NULL,
          model_type VARCHAR(50), -- 'player_prediction', 'dfs_optimization', 'prop_analysis'
          version VARCHAR(20),
          sport VARCHAR(10),
          
          -- Performance metrics
          accuracy DECIMAL(5,4),
          mae DECIMAL(6,2),
          rmse DECIMAL(6,2),
          
          -- Training info
          training_date TIMESTAMP,
          training_samples INT,
          features JSONB,
          hyperparameters JSONB,
          
          -- Model storage
          model_path VARCHAR(255),
          is_active BOOLEAN DEFAULT false,
          
          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log(chalk.green('✅ ML model tracking table created'));
      
      // 6. Create helper views
      console.log(chalk.cyan('👁️  Creating helper views...'));
      
      await client.query(`
        CREATE OR REPLACE VIEW v_player_ml_features AS
        SELECT 
          p.id as player_id,
          p.name,
          p.sport,
          p.position,
          p.team,
          
          -- Recent performance
          AVG(ps.fantasy_points) FILTER (WHERE ps.game_date > CURRENT_DATE - INTERVAL '10 games') as avg_last_10,
          AVG(ps.fantasy_points) FILTER (WHERE ps.game_date > CURRENT_DATE - INTERVAL '5 games') as avg_last_5,
          AVG(ps.fantasy_points) FILTER (WHERE ps.game_date > CURRENT_DATE - INTERVAL '3 games') as avg_last_3,
          
          -- Volatility
          STDDEV(ps.fantasy_points) FILTER (WHERE ps.game_date > CURRENT_DATE - INTERVAL '10 games') as std_last_10,
          
          -- Home/Away splits
          AVG(ps.fantasy_points) FILTER (WHERE ps.is_home = true) as home_avg,
          AVG(ps.fantasy_points) FILTER (WHERE ps.is_home = false) as away_avg,
          
          -- DFS value
          AVG(ps.fantasy_points / NULLIF(ps.dk_salary, 0) * 1000) as dk_value,
          AVG(ps.fantasy_points / NULLIF(ps.fd_salary, 0) * 1000) as fd_value
          
        FROM players p
        LEFT JOIN player_stats ps ON p.id = ps.player_id
        GROUP BY p.id, p.name, p.sport, p.position, p.team;
      `);
      
      console.log(chalk.green('✅ Helper views created'));
      
      // Commit transaction
      await client.query('COMMIT');
      console.log(chalk.green.bold('\n✅ ML schema setup complete!\n'));
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    // Show final statistics
    const tables = await pgPool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('players', 'player_stats', 'teams', 'game_logs', 'injuries', 'dfs_contests', 'dfs_ownership', 'ml_models')
      ORDER BY tablename
    `);
    
    console.log(chalk.cyan('📊 Available ML tables:'));
    tables.rows.forEach(row => {
      console.log(chalk.green(`  ✓ ${row.tablename}`));
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error setting up ML schema:'), error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Run setup
setupMLSchema();