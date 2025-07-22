#!/usr/bin/env tsx
/**
 * ⚡ FAST SCHEMA SETUP - Parallel execution
 */

import { pgPool } from '../fantasy-ml/config/database';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

async function fastSetup() {
  const startTime = Date.now();
  console.log(chalk.cyan.bold('\n⚡ FAST SCHEMA SETUP - Parallel Execution\n'));
  
  try {
    // 1. Drop all old tables in one transaction
    console.log(chalk.yellow('🗑️  Dropping old tables...'));
    await pgPool.query('BEGIN');
    
    const dropQueries = [
      'DROP TABLE IF EXISTS player_props CASCADE',
      'DROP TABLE IF EXISTS betting_lines CASCADE',
      'DROP TABLE IF EXISTS player_game_stats CASCADE',
      'DROP TABLE IF EXISTS players_master CASCADE',
      'DROP TABLE IF EXISTS games_master CASCADE',
      'DROP TABLE IF EXISTS teams_master CASCADE',
      'DROP TABLE IF EXISTS player_game_logs CASCADE',
      'DROP TABLE IF EXISTS player_stats CASCADE',
      'DROP TABLE IF EXISTS games CASCADE',
      'DROP TABLE IF EXISTS game_logs CASCADE',
      'DROP TABLE IF EXISTS patterns CASCADE',
      'DROP TABLE IF EXISTS ml_training_data CASCADE',
      'DROP TABLE IF EXISTS ml_predictions CASCADE',
      'DROP TABLE IF EXISTS fantasy_projections CASCADE'
    ];
    
    for (const query of dropQueries) {
      await pgPool.query(query);
    }
    
    await pgPool.query('COMMIT');
    console.log(chalk.green('✓ Dropped old tables'));
    
    // 2. Create all tables in parallel
    console.log(chalk.yellow('\n📊 Creating tables...'));
    
    const tablePromises = [
      // Teams master
      pgPool.query(`
        CREATE TABLE teams_master (
          id SERIAL PRIMARY KEY,
          our_team_id VARCHAR(50) UNIQUE NOT NULL,
          sport VARCHAR(20) NOT NULL,
          league VARCHAR(50),
          name VARCHAR(100) NOT NULL,
          city VARCHAR(50),
          abbreviation VARCHAR(10),
          espn_id VARCHAR(50),
          mlb_api_id VARCHAR(50),
          ncaa_id VARCHAR(50),
          yahoo_id VARCHAR(50),
          cbs_id VARCHAR(50),
          sleeper_id VARCHAR(50),
          dk_id VARCHAR(50),
          fd_id VARCHAR(50),
          conference VARCHAR(50),
          division VARCHAR(50),
          parent_org_id INTEGER,
          venue_name VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `),
      
      // Games master
      pgPool.query(`
        CREATE TABLE games_master (
          id SERIAL PRIMARY KEY,
          our_game_id VARCHAR(50) UNIQUE NOT NULL,
          sport VARCHAR(20) NOT NULL,
          league VARCHAR(50),
          season INTEGER NOT NULL,
          game_date TIMESTAMP NOT NULL,
          home_team_id INTEGER,
          away_team_id INTEGER,
          home_score INTEGER,
          away_score INTEGER,
          status VARCHAR(20),
          period INTEGER,
          time_remaining VARCHAR(10),
          espn_game_id VARCHAR(50),
          mlb_game_id VARCHAR(50),
          ncaa_game_id VARCHAR(50),
          venue VARCHAR(100),
          attendance INTEGER,
          weather JSONB,
          opening_spread DECIMAL(4,1),
          opening_spread_odds INTEGER,
          closing_spread DECIMAL(4,1),
          closing_spread_odds INTEGER,
          opening_total DECIMAL(5,1),
          opening_total_over_odds INTEGER,
          opening_total_under_odds INTEGER,
          closing_total DECIMAL(5,1),
          closing_total_over_odds INTEGER,
          closing_total_under_odds INTEGER,
          boxscore_urls JSONB,
          data_sources JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `),
      
      // Players master
      pgPool.query(`
        CREATE TABLE players_master (
          id SERIAL PRIMARY KEY,
          our_player_id VARCHAR(50) UNIQUE NOT NULL,
          sport VARCHAR(20) NOT NULL,
          name VARCHAR(100) NOT NULL,
          first_name VARCHAR(50),
          last_name VARCHAR(50),
          position VARCHAR(20),
          jersey_number VARCHAR(5),
          height VARCHAR(10),
          weight INTEGER,
          birth_date DATE,
          birth_place VARCHAR(100),
          college VARCHAR(100),
          draft_year INTEGER,
          draft_round INTEGER,
          draft_pick INTEGER,
          years_pro INTEGER,
          status VARCHAR(20),
          team_id INTEGER,
          espn_id VARCHAR(50),
          mlb_id VARCHAR(50),
          ncaa_id VARCHAR(50),
          yahoo_id VARCHAR(50),
          cbs_id VARCHAR(50),
          sleeper_id VARCHAR(50),
          dk_id VARCHAR(50),
          fd_id VARCHAR(50),
          headshot_url VARCHAR(500),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `),
      
      // Player game stats
      pgPool.query(`
        CREATE TABLE player_game_stats (
          id SERIAL PRIMARY KEY,
          game_id INTEGER NOT NULL,
          player_id INTEGER NOT NULL,
          team_id INTEGER,
          opponent_id INTEGER,
          home_away VARCHAR(10),
          started BOOLEAN,
          minutes_played DECIMAL(5,2),
          dk_points DECIMAL(6,2),
          fd_points DECIMAL(6,2),
          yahoo_points DECIMAL(6,2),
          espn_points DECIMAL(6,2),
          cbs_points DECIMAL(6,2),
          sleeper_points DECIMAL(6,2),
          stats JSONB NOT NULL,
          advanced_stats JSONB,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(game_id, player_id)
        )
      `),
      
      // Betting lines
      pgPool.query(`
        CREATE TABLE betting_lines (
          id SERIAL PRIMARY KEY,
          game_id INTEGER NOT NULL,
          book VARCHAR(50) NOT NULL,
          line_type VARCHAR(20) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          spread_home DECIMAL(4,1),
          spread_away DECIMAL(4,1),
          spread_home_odds INTEGER,
          spread_away_odds INTEGER,
          total DECIMAL(5,1),
          over_odds INTEGER,
          under_odds INTEGER,
          ml_home INTEGER,
          ml_away INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `),
      
      // Player props
      pgPool.query(`
        CREATE TABLE player_props (
          id SERIAL PRIMARY KEY,
          game_id INTEGER NOT NULL,
          player_id INTEGER NOT NULL,
          book VARCHAR(50) NOT NULL,
          prop_type VARCHAR(50) NOT NULL,
          line DECIMAL(6,2),
          over_odds INTEGER,
          under_odds INTEGER,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
    ];
    
    await Promise.all(tablePromises);
    console.log(chalk.green('✓ Created all tables'));
    
    // 3. Create indexes in parallel
    console.log(chalk.yellow('\n🔍 Creating indexes...'));
    
    const indexPromises = [
      // Team indexes
      pgPool.query('CREATE INDEX idx_teams_sport ON teams_master(sport)'),
      pgPool.query('CREATE INDEX idx_teams_league ON teams_master(league)'),
      pgPool.query('CREATE INDEX idx_teams_our_id ON teams_master(our_team_id)'),
      
      // Game indexes
      pgPool.query('CREATE INDEX idx_games_date ON games_master(game_date)'),
      pgPool.query('CREATE INDEX idx_games_season_sport ON games_master(season, sport)'),
      pgPool.query('CREATE INDEX idx_games_teams ON games_master(home_team_id, away_team_id)'),
      
      // Player indexes
      pgPool.query('CREATE INDEX idx_players_sport ON players_master(sport)'),
      pgPool.query('CREATE INDEX idx_players_team ON players_master(team_id)'),
      pgPool.query('CREATE INDEX idx_players_name ON players_master(name)'),
      
      // Stats indexes
      pgPool.query('CREATE INDEX idx_stats_game ON player_game_stats(game_id)'),
      pgPool.query('CREATE INDEX idx_stats_player ON player_game_stats(player_id)'),
      pgPool.query('CREATE INDEX idx_stats_player_game ON player_game_stats(player_id, game_id)'),
      
      // Betting indexes
      pgPool.query('CREATE INDEX idx_betting_game_time ON betting_lines(game_id, timestamp)'),
      pgPool.query('CREATE INDEX idx_props_player_game ON player_props(player_id, game_id)')
    ];
    
    const indexResults = await Promise.allSettled(indexPromises);
    const successfulIndexes = indexResults.filter(r => r.status === 'fulfilled').length;
    console.log(chalk.green(`✓ Created ${successfulIndexes}/${indexPromises.length} indexes`));
    
    // 4. Add foreign keys (must be done after tables exist)
    console.log(chalk.yellow('\n🔗 Adding foreign keys...'));
    await pgPool.query('ALTER TABLE games_master ADD FOREIGN KEY (home_team_id) REFERENCES teams_master(id)');
    await pgPool.query('ALTER TABLE games_master ADD FOREIGN KEY (away_team_id) REFERENCES teams_master(id)');
    await pgPool.query('ALTER TABLE players_master ADD FOREIGN KEY (team_id) REFERENCES teams_master(id)');
    await pgPool.query('ALTER TABLE player_game_stats ADD FOREIGN KEY (game_id) REFERENCES games_master(id)');
    await pgPool.query('ALTER TABLE player_game_stats ADD FOREIGN KEY (player_id) REFERENCES players_master(id)');
    console.log(chalk.green('✓ Added foreign keys'));
    
    const totalTime = Date.now() - startTime;
    console.log(chalk.green.bold(`\n✅ SCHEMA SETUP COMPLETE in ${(totalTime/1000).toFixed(1)}s!\n`));
    
    // Verify
    const tables = await pgPool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE '%master%' OR tablename LIKE '%stats%'
      ORDER BY tablename
    `);
    
    console.log(chalk.cyan('📊 Created tables:'));
    tables.rows.forEach(row => {
      console.log(chalk.green(`  ✓ ${row.tablename}`));
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run it!
fastSetup().catch(console.error);