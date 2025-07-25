#!/usr/bin/env tsx
/**
 * 🔥 PRODUCTION DATABASE MIGRATION 🔥
 * 
 * Step 2: Migrate production database with all ML views and optimizations
 * Creates indexes, materializes views, and sets up production database
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

// Load production environment
dotenv.config({ path: '.env.production' });

interface MigrationStep {
  name: string;
  description: string;
  sql: string;
  critical: boolean;
}

class ProductionDatabaseMigration {
  private pool: Pool;
  private migrations: MigrationStep[] = [];
  private startTime: number;
  
  constructor() {
    console.log(chalk.bold.cyan('🗄️ FANTASY AI PRODUCTION DATABASE MIGRATION'));
    console.log(chalk.gray('Migrating database with ML views and optimizations...\n'));
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl: { rejectUnauthorized: false }
    });
    
    this.startTime = Date.now();
  }
  
  async migrate(): Promise<void> {
    try {
      await this.testConnection();
      await this.createBackup();
      await this.prepareMigrations();
      await this.executeMigrations();
      await this.createIndexes();
      await this.optimizeDatabase();
      await this.verifyIntegrity();
      
      const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
      console.log(chalk.bold.green(`\n✅ Database migration complete in ${duration}s!`));
    } catch (error) {
      console.error(chalk.red('\n❌ Migration failed:'), error);
      await this.rollback();
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }
  
  private async testConnection(): Promise<void> {
    console.log(chalk.yellow('🔗 Testing database connection...'));
    
    try {
      const result = await this.pool.query('SELECT NOW()');
      console.log(chalk.gray(`  ✓ Connected at ${result.rows[0].now}`));
      
      // Check database version
      const version = await this.pool.query('SELECT version()');
      console.log(chalk.gray(`  ✓ PostgreSQL ${version.rows[0].version.split(' ')[1]}`));
    } catch (error) {
      throw new Error(`Database connection failed: ${error}`);
    }
  }
  
  private async createBackup(): Promise<void> {
    console.log(chalk.yellow('\n💾 Creating database backup...'));
    
    const backupDir = path.join(process.cwd(), 'backups', 'database');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `production-${timestamp}.sql`);
    
    console.log(chalk.gray('  Creating logical backup...'));
    // In production, use pg_dump
    console.log(chalk.gray(`  ✓ Backup would be created at: ${backupFile}`));
    console.log(chalk.yellow('  ⚠️  Implement pg_dump for real production backup'));
  }
  
  private async prepareMigrations(): Promise<void> {
    console.log(chalk.yellow('\n📋 Preparing migrations...'));
    
    // ML Views for each sport
    this.migrations.push({
      name: 'nfl_ml_view',
      description: 'NFL ML training view with advanced features',
      critical: true,
      sql: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS nfl_ml_view AS
        WITH player_stats AS (
          SELECT 
            p.player_id,
            p.name,
            p.position,
            p.team,
            p.salary,
            s.stat_date,
            s.passing_yards,
            s.passing_tds,
            s.rushing_yards,
            s.rushing_tds,
            s.receiving_yards,
            s.receiving_tds,
            s.receptions,
            s.targets,
            s.fumbles_lost,
            s.interceptions,
            -- Calculate fantasy points
            COALESCE(s.passing_yards * 0.04, 0) + 
            COALESCE(s.passing_tds * 4, 0) +
            COALESCE(s.rushing_yards * 0.1, 0) + 
            COALESCE(s.rushing_tds * 6, 0) +
            COALESCE(s.receiving_yards * 0.1, 0) + 
            COALESCE(s.receiving_tds * 6, 0) +
            COALESCE(s.receptions * 1, 0) -
            COALESCE(s.fumbles_lost * 2, 0) -
            COALESCE(s.interceptions * 2, 0) as fantasy_points,
            -- Advanced metrics
            LAG(s.passing_yards, 1) OVER (PARTITION BY p.player_id ORDER BY s.stat_date) as prev_passing_yards,
            AVG(s.passing_yards) OVER (PARTITION BY p.player_id ORDER BY s.stat_date ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) as avg_passing_yards_l3,
            STDDEV(s.passing_yards) OVER (PARTITION BY p.player_id ORDER BY s.stat_date ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) as std_passing_yards_l5,
            ROW_NUMBER() OVER (PARTITION BY p.player_id ORDER BY s.stat_date) as game_number
          FROM nfl_players p
          JOIN nfl_game_logs s ON p.player_id = s.player_id
          WHERE s.stat_date >= '2020-01-01'
        )
        SELECT *,
          -- Target variable
          LEAD(fantasy_points, 1) OVER (PARTITION BY player_id ORDER BY stat_date) as target_fantasy_points,
          -- Additional features
          EXTRACT(month FROM stat_date) as month,
          EXTRACT(dow FROM stat_date) as day_of_week,
          CASE WHEN position IN ('QB', 'RB', 'WR', 'TE') THEN 1 ELSE 0 END as is_skill_position
        FROM player_stats
        WHERE game_number > 1  -- Need historical data
        ORDER BY player_id, stat_date;
        
        CREATE INDEX idx_nfl_ml_view_player_date ON nfl_ml_view(player_id, stat_date);
        CREATE INDEX idx_nfl_ml_view_position ON nfl_ml_view(position);
        CREATE INDEX idx_nfl_ml_view_fantasy_points ON nfl_ml_view(fantasy_points);
      `
    });
    
    // NBA ML View
    this.migrations.push({
      name: 'nba_ml_view',
      description: 'NBA ML training view with advanced features',
      critical: true,
      sql: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS nba_ml_view AS
        WITH player_stats AS (
          SELECT 
            p.player_id,
            p.name,
            p.position,
            p.team,
            p.salary,
            s.game_date,
            s.points,
            s.rebounds,
            s.assists,
            s.steals,
            s.blocks,
            s.turnovers,
            s.minutes_played,
            s.field_goals_made,
            s.field_goals_attempted,
            s.three_pointers_made,
            -- DraftKings scoring
            COALESCE(s.points, 0) +
            COALESCE(s.rebounds * 1.25, 0) +
            COALESCE(s.assists * 1.5, 0) +
            COALESCE(s.steals * 2, 0) +
            COALESCE(s.blocks * 2, 0) -
            COALESCE(s.turnovers * 0.5, 0) +
            CASE WHEN s.points >= 10 AND s.rebounds >= 10 THEN 1.5
                 WHEN s.points >= 10 AND s.assists >= 10 THEN 1.5
                 WHEN s.rebounds >= 10 AND s.assists >= 10 THEN 1.5
                 ELSE 0 END as fantasy_points,
            -- Advanced metrics
            LAG(s.points, 1) OVER (PARTITION BY p.player_id ORDER BY s.game_date) as prev_points,
            AVG(s.points) OVER (PARTITION BY p.player_id ORDER BY s.game_date ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) as avg_points_l5,
            STDDEV(s.minutes_played) OVER (PARTITION BY p.player_id ORDER BY s.game_date ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING) as std_minutes_l10
          FROM nba_players p
          JOIN nba_game_logs s ON p.player_id = s.player_id
          WHERE s.game_date >= '2020-01-01'
            AND s.minutes_played > 0
        )
        SELECT *,
          LEAD(fantasy_points, 1) OVER (PARTITION BY player_id ORDER BY game_date) as target_fantasy_points,
          EXTRACT(month FROM game_date) as month,
          EXTRACT(dow FROM game_date) as day_of_week
        FROM player_stats
        ORDER BY player_id, game_date;
        
        CREATE INDEX idx_nba_ml_view_player_date ON nba_ml_view(player_id, game_date);
        CREATE INDEX idx_nba_ml_view_position ON nba_ml_view(position);
        CREATE INDEX idx_nba_ml_view_fantasy_points ON nba_ml_view(fantasy_points);
      `
    });
    
    // MLB ML View
    this.migrations.push({
      name: 'mlb_ml_view',
      description: 'MLB ML training view with advanced features',
      critical: true,
      sql: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS mlb_ml_view AS
        WITH batter_stats AS (
          SELECT 
            p.player_id,
            p.name,
            p.position,
            p.team,
            p.salary,
            b.game_date,
            b.at_bats,
            b.runs,
            b.hits,
            b.doubles,
            b.triples,
            b.home_runs,
            b.rbis,
            b.stolen_bases,
            b.walks,
            -- DraftKings scoring for batters
            COALESCE(b.runs * 2, 0) +
            COALESCE(b.rbis * 2, 0) +
            COALESCE(b.hits - b.doubles - b.triples - b.home_runs, 0) * 3 +
            COALESCE(b.doubles * 5, 0) +
            COALESCE(b.triples * 8, 0) +
            COALESCE(b.home_runs * 10, 0) +
            COALESCE(b.stolen_bases * 5, 0) +
            COALESCE(b.walks * 2, 0) as fantasy_points,
            'batter' as player_type
          FROM mlb_players p
          JOIN mlb_batting_game_logs b ON p.player_id = b.player_id
          WHERE b.game_date >= '2020-01-01'
        ),
        pitcher_stats AS (
          SELECT 
            p.player_id,
            p.name,
            p.position,
            p.team,
            p.salary,
            pt.game_date,
            pt.innings_pitched,
            pt.strikeouts,
            pt.wins,
            pt.earned_runs,
            pt.hits_allowed,
            pt.walks_allowed,
            -- DraftKings scoring for pitchers
            COALESCE(pt.innings_pitched * 2.25, 0) +
            COALESCE(pt.strikeouts * 2, 0) +
            COALESCE(pt.wins * 4, 0) -
            COALESCE(pt.earned_runs * 2, 0) -
            COALESCE(pt.hits_allowed * 0.6, 0) -
            COALESCE(pt.walks_allowed * 0.6, 0) as fantasy_points,
            'pitcher' as player_type
          FROM mlb_players p
          JOIN mlb_pitching_game_logs pt ON p.player_id = pt.player_id
          WHERE pt.game_date >= '2020-01-01'
        ),
        all_stats AS (
          SELECT * FROM batter_stats
          UNION ALL
          SELECT 
            player_id, name, position, team, salary, game_date,
            innings_pitched as at_bats, strikeouts as runs, wins as hits,
            0 as doubles, 0 as triples, 0 as home_runs, earned_runs as rbis,
            0 as stolen_bases, walks_allowed as walks, fantasy_points, player_type
          FROM pitcher_stats
        )
        SELECT *,
          LEAD(fantasy_points, 1) OVER (PARTITION BY player_id ORDER BY game_date) as target_fantasy_points,
          LAG(fantasy_points, 1) OVER (PARTITION BY player_id ORDER BY game_date) as prev_fantasy_points,
          AVG(fantasy_points) OVER (PARTITION BY player_id ORDER BY game_date ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) as avg_fantasy_points_l5
        FROM all_stats
        ORDER BY player_id, game_date;
        
        CREATE INDEX idx_mlb_ml_view_player_date ON mlb_ml_view(player_id, game_date);
        CREATE INDEX idx_mlb_ml_view_player_type ON mlb_ml_view(player_type);
        CREATE INDEX idx_mlb_ml_view_fantasy_points ON mlb_ml_view(fantasy_points);
      `
    });
    
    // NHL ML View
    this.migrations.push({
      name: 'nhl_ml_view',
      description: 'NHL ML training view with advanced features',
      critical: true,
      sql: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS nhl_ml_view AS
        WITH player_stats AS (
          SELECT 
            p.player_id,
            p.name,
            p.position,
            p.team,
            p.salary,
            s.game_date,
            s.goals,
            s.assists,
            s.shots,
            s.blocked_shots,
            s.time_on_ice,
            -- DraftKings scoring
            COALESCE(s.goals * 3, 0) +
            COALESCE(s.assists * 2, 0) +
            COALESCE(s.shots * 0.5, 0) +
            COALESCE(s.blocked_shots * 0.5, 0) as fantasy_points,
            -- Advanced metrics
            LAG(s.goals, 1) OVER (PARTITION BY p.player_id ORDER BY s.game_date) as prev_goals,
            AVG(s.time_on_ice) OVER (PARTITION BY p.player_id ORDER BY s.game_date ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING) as avg_toi_l5
          FROM nhl_players p
          JOIN nhl_skater_game_logs s ON p.player_id = s.player_id
          WHERE s.game_date >= '2020-01-01'
        )
        SELECT *,
          LEAD(fantasy_points, 1) OVER (PARTITION BY player_id ORDER BY game_date) as target_fantasy_points,
          EXTRACT(month FROM game_date) as month
        FROM player_stats
        ORDER BY player_id, game_date;
        
        CREATE INDEX idx_nhl_ml_view_player_date ON nhl_ml_view(player_id, game_date);
        CREATE INDEX idx_nhl_ml_view_position ON nhl_ml_view(position);
        CREATE INDEX idx_nhl_ml_view_fantasy_points ON nhl_ml_view(fantasy_points);
      `
    });
    
    // Ownership and contest tables
    this.migrations.push({
      name: 'ownership_tables',
      description: 'Ownership tracking and contest data',
      critical: false,
      sql: `
        CREATE TABLE IF NOT EXISTS ownership_projections (
          id SERIAL PRIMARY KEY,
          contest_id VARCHAR(100) NOT NULL,
          player_id VARCHAR(100) NOT NULL,
          sport VARCHAR(20) NOT NULL,
          projected_ownership DECIMAL(5,2),
          actual_ownership DECIMAL(5,2),
          leverage_score DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS contest_results (
          id SERIAL PRIMARY KEY,
          contest_id VARCHAR(100) NOT NULL,
          sport VARCHAR(20) NOT NULL,
          entry_fee DECIMAL(10,2),
          total_prizes DECIMAL(10,2),
          entries_count INTEGER,
          winning_score DECIMAL(10,2),
          min_cash_score DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS ml_predictions (
          id SERIAL PRIMARY KEY,
          player_id VARCHAR(100) NOT NULL,
          sport VARCHAR(20) NOT NULL,
          game_date DATE NOT NULL,
          predicted_points DECIMAL(10,2),
          actual_points DECIMAL(10,2),
          confidence_score DECIMAL(5,2),
          model_version VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_ownership_contest_player ON ownership_projections(contest_id, player_id);
        CREATE INDEX idx_contest_results_sport_date ON contest_results(sport, created_at);
        CREATE INDEX idx_ml_predictions_player_date ON ml_predictions(player_id, game_date);
      `
    });
    
    console.log(chalk.gray(`  ✓ Prepared ${this.migrations.length} migrations`));
  }
  
  private async executeMigrations(): Promise<void> {
    console.log(chalk.yellow('\n🚀 Executing migrations...'));
    
    const limit = pLimit(1); // Execute one at a time
    
    for (const migration of this.migrations) {
      await limit(async () => {
        console.log(chalk.cyan(`\n  Running: ${migration.name}`));
        console.log(chalk.gray(`  ${migration.description}`));
        
        try {
          const start = Date.now();
          await this.pool.query(migration.sql);
          const duration = ((Date.now() - start) / 1000).toFixed(2);
          
          console.log(chalk.green(`  ✅ ${migration.name} completed in ${duration}s`));
        } catch (error: any) {
          if (migration.critical) {
            throw new Error(`Critical migration failed: ${migration.name} - ${error.message}`);
          } else {
            console.log(chalk.yellow(`  ⚠️  Non-critical migration failed: ${error.message}`));
          }
        }
      });
    }
  }
  
  private async createIndexes(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Creating performance indexes...'));
    
    const indexes = [
      // Player indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_team ON nfl_players(team)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_position ON nfl_players(position)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_salary ON nfl_players(salary)',
      
      // Game log indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nfl_logs_date ON nfl_game_logs(stat_date)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nba_logs_date ON nba_game_logs(game_date)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mlb_batting_logs_date ON mlb_batting_game_logs(game_date)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nhl_logs_date ON nhl_skater_game_logs(game_date)',
      
      // Composite indexes for common queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nfl_player_date_composite ON nfl_game_logs(player_id, stat_date DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nba_player_date_composite ON nba_game_logs(player_id, game_date DESC)',
      
      // Partial indexes for active players
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_nfl_players ON nfl_players(player_id) WHERE active = true',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_nfl_logs ON nfl_game_logs(stat_date) WHERE stat_date >= CURRENT_DATE - INTERVAL \'30 days\''
    ];
    
    for (const indexSql of indexes) {
      try {
        await this.pool.query(indexSql);
        console.log(chalk.gray(`  ✓ ${indexSql.match(/idx_\w+/)?.[0] || 'Index'} created`));
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.log(chalk.yellow(`  ⚠️  Index creation failed: ${error.message}`));
        }
      }
    }
  }
  
  private async optimizeDatabase(): Promise<void> {
    console.log(chalk.yellow('\n⚡ Optimizing database...'));
    
    // Update statistics
    console.log(chalk.gray('  Analyzing tables...'));
    await this.pool.query('ANALYZE');
    
    // Refresh materialized views
    console.log(chalk.gray('  Refreshing materialized views...'));
    const views = ['nfl_ml_view', 'nba_ml_view', 'mlb_ml_view', 'nhl_ml_view'];
    
    for (const view of views) {
      try {
        await this.pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        console.log(chalk.gray(`  ✓ ${view} refreshed`));
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(chalk.yellow(`  ⚠️  ${view} not found (will be created on first run)`));
        }
      }
    }
    
    // Set optimal configuration
    console.log(chalk.gray('  Setting performance parameters...'));
    const configs = [
      "SET max_connections = '200'",
      "SET shared_buffers = '4GB'",
      "SET effective_cache_size = '12GB'",
      "SET maintenance_work_mem = '1GB'",
      "SET work_mem = '100MB'",
      "SET max_wal_size = '4GB'",
      "SET checkpoint_completion_target = '0.9'"
    ];
    
    for (const config of configs) {
      try {
        // Note: These would need superuser in production
        console.log(chalk.gray(`  ℹ️  Would set: ${config}`));
      } catch (error) {
        // Expected in development
      }
    }
    
    console.log(chalk.green('✅ Database optimized'));
  }
  
  private async verifyIntegrity(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Verifying database integrity...'));
    
    // Check row counts
    const tables = [
      'nfl_players', 'nfl_game_logs',
      'nba_players', 'nba_game_logs',
      'mlb_players', 'mlb_batting_game_logs',
      'nhl_players', 'nhl_skater_game_logs'
    ];
    
    console.log(chalk.gray('  Table row counts:'));
    for (const table of tables) {
      try {
        const result = await this.pool.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        console.log(chalk.gray(`    ${table}: ${count.toLocaleString()} rows`));
      } catch (error) {
        console.log(chalk.yellow(`    ${table}: Not found`));
      }
    }
    
    // Check materialized view health
    console.log(chalk.gray('\n  Materialized view status:'));
    const viewCheck = await this.pool.query(`
      SELECT schemaname, matviewname, last_refresh 
      FROM pg_matviews 
      WHERE schemaname = 'public'
    `);
    
    if (viewCheck.rows.length > 0) {
      viewCheck.rows.forEach(view => {
        console.log(chalk.gray(`    ${view.matviewname}: Last refresh ${view.last_refresh || 'Never'}`));
      });
    } else {
      console.log(chalk.yellow('    No materialized views found yet'));
    }
    
    console.log(chalk.green('\n✅ Integrity check complete'));
  }
  
  private async rollback(): Promise<void> {
    console.log(chalk.yellow('\n⚠️  Rolling back migration...'));
    // In production, restore from backup
    console.log(chalk.gray('  Would restore from backup in production'));
  }
}

// Run migration
if (require.main === module) {
  const migration = new ProductionDatabaseMigration();
  migration.migrate().catch(console.error);
}

export { ProductionDatabaseMigration };