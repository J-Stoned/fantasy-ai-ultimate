#!/usr/bin/env tsx
/**
 * 🏆 Create Sport-Specific Data Views
 * Handles different data formats across sports
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

console.log(chalk.gray('Loading from:', path.join(__dirname, '../../.env.local')));
console.log(chalk.gray('DATABASE_URL_LOCAL exists:', !!process.env.DATABASE_URL_LOCAL));

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
});

async function createSportViews() {
  console.log(chalk.cyan.bold('\n🏆 Creating Sport-Specific Data Views...\n'));
  
  try {
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Drop existing views first to avoid column order conflicts
      console.log(chalk.yellow('🗑️  Dropping existing views if they exist...'));
      await client.query('DROP VIEW IF EXISTS v_ml_player_features CASCADE');
      await client.query('DROP VIEW IF EXISTS v_nfl_player_stats CASCADE');
      await client.query('DROP VIEW IF EXISTS v_nba_player_stats CASCADE');
      await client.query('DROP VIEW IF EXISTS v_mlb_player_stats CASCADE');
      await client.query('DROP VIEW IF EXISTS v_nhl_player_stats CASCADE');
      console.log(chalk.green('✅ Old views dropped'));
      
      // 1. NFL View
      console.log(chalk.cyan('🏈 Creating NFL view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nfl_player_stats AS
        SELECT 
          p.id as player_id,
          p.name,
          p.position,
          p.team,
          COALESCE(t2.abbreviation, t2.name, pgs.opponent_id::TEXT) as opponent,
          t2.abbreviation as opponent_abbr,
          pgs.game_date::DATE as game_date,
          pgs.is_home,
          pgs.stats::JSONB as stats,
          -- Extract key NFL stats from JSONB
          (pgs.stats::JSONB->>'passing_yards')::INT as passing_yards,
          (pgs.stats::JSONB->>'passing_touchdowns')::INT as passing_touchdowns,
          (pgs.stats::JSONB->>'rushing_yards')::INT as rushing_yards,
          (pgs.stats::JSONB->>'rushing_touchdowns')::INT as rushing_touchdowns,
          (pgs.stats::JSONB->>'receptions')::INT as receptions,
          (pgs.stats::JSONB->>'receiving_yards')::INT as receiving_yards,
          (pgs.stats::JSONB->>'receiving_touchdowns')::INT as receiving_touchdowns,
          (pgs.stats::JSONB->>'targets')::INT as targets,
          -- Fantasy points calculation
          COALESCE((pgs.stats::JSONB->>'passing_yards')::FLOAT * 0.04, 0) +
          COALESCE((pgs.stats::JSONB->>'passing_touchdowns')::FLOAT * 4, 0) +
          COALESCE((pgs.stats::JSONB->>'rushing_yards')::FLOAT * 0.1, 0) +
          COALESCE((pgs.stats::JSONB->>'rushing_touchdowns')::FLOAT * 6, 0) +
          COALESCE((pgs.stats::JSONB->>'receptions')::FLOAT * 1, 0) + -- PPR
          COALESCE((pgs.stats::JSONB->>'receiving_yards')::FLOAT * 0.1, 0) +
          COALESCE((pgs.stats::JSONB->>'receiving_touchdowns')::FLOAT * 6, 0) as calculated_fantasy_points
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        LEFT JOIN teams t2 ON pgs.opponent_id = t2.id
        WHERE p.sport = 'NFL'
        AND pgs.stats IS NOT NULL
      `);
      console.log(chalk.green('✅ NFL view created'));
      
      // 2. NBA View
      console.log(chalk.cyan('🏀 Creating NBA view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nba_player_stats AS
        SELECT 
          p.id as player_id,
          p.name,
          p.position,
          p.team,
          COALESCE(t2.abbreviation, t2.name, pgs.opponent_id::TEXT) as opponent,
          pgs.game_date::DATE as game_date,
          pgs.is_home,
          pgs.stats::JSONB as stats,
          -- Extract key NBA stats
          (pgs.stats::JSONB->>'points')::INT as points,
          (pgs.stats::JSONB->>'rebounds')::INT as rebounds,
          (pgs.stats::JSONB->>'assists')::INT as assists,
          (pgs.stats::JSONB->>'steals')::INT as steals,
          (pgs.stats::JSONB->>'blocks')::INT as blocks,
          (pgs.stats::JSONB->>'turnovers')::INT as turnovers,
          (pgs.stats::JSONB->>'minutes_played')::FLOAT as minutes_played,
          -- DraftKings fantasy points
          COALESCE((pgs.stats::JSONB->>'points')::FLOAT * 1, 0) +
          COALESCE((pgs.stats::JSONB->>'rebounds')::FLOAT * 1.25, 0) +
          COALESCE((pgs.stats::JSONB->>'assists')::FLOAT * 1.5, 0) +
          COALESCE((pgs.stats::JSONB->>'steals')::FLOAT * 2, 0) +
          COALESCE((pgs.stats::JSONB->>'blocks')::FLOAT * 2, 0) +
          COALESCE((pgs.stats::JSONB->>'turnovers')::FLOAT * -0.5, 0) as dk_fantasy_points
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        LEFT JOIN teams t2 ON pgs.opponent_id = t2.id
        WHERE p.sport IN ('NBA', 'NCAA_BB')
        AND pgs.stats IS NOT NULL
      `);
      console.log(chalk.green('✅ NBA/NCAA_BB view created'));
      
      // 3. MLB View
      console.log(chalk.cyan('⚾ Creating MLB view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_mlb_player_stats AS
        SELECT 
          p.id as player_id,
          p.name,
          p.position,
          p.team,
          ps.created_at::DATE as game_date,
          ps.stat_type,
          ps.stat_value::JSONB as stat_value,
          ps.fantasy_points,
          -- Batting stats from stat_value JSONB
          CASE WHEN ps.stat_type = 'batting' THEN
            (ps.stat_value::JSONB->>'hits')::INT
          END as hits,
          CASE WHEN ps.stat_type = 'batting' THEN
            (ps.stat_value::JSONB->>'runs')::INT
          END as runs,
          CASE WHEN ps.stat_type = 'batting' THEN
            (ps.stat_value::JSONB->>'rbis')::INT
          END as rbis,
          CASE WHEN ps.stat_type = 'batting' THEN
            (ps.stat_value::JSONB->>'home_runs')::INT
          END as home_runs,
          CASE WHEN ps.stat_type = 'batting' THEN
            (ps.stat_value::JSONB->>'stolen_bases')::INT
          END as stolen_bases,
          -- Pitching stats
          CASE WHEN ps.stat_type = 'pitching' THEN
            (ps.stat_value::JSONB->>'innings_pitched')::FLOAT
          END as innings_pitched,
          CASE WHEN ps.stat_type = 'pitching' THEN
            (ps.stat_value::JSONB->>'strikeouts')::INT
          END as strikeouts,
          CASE WHEN ps.stat_type = 'pitching' THEN
            (ps.stat_value::JSONB->>'wins')::INT
          END as wins,
          CASE WHEN ps.stat_type = 'pitching' THEN
            (ps.stat_value::JSONB->>'earned_runs')::INT
          END as earned_runs
        FROM players p
        JOIN player_stats ps ON p.id = ps.player_id
        WHERE p.sport IN ('MLB', 'MILB', 'NCAA_BASEBALL')
        AND ps.stat_value IS NOT NULL
      `);
      console.log(chalk.green('✅ MLB/MILB/NCAA_BASEBALL view created'));
      
      // 4. NHL View
      console.log(chalk.cyan('🏒 Creating NHL view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nhl_player_stats AS
        SELECT 
          p.id as player_id,
          p.name,
          p.position,
          p.team,
          COALESCE(t2.abbreviation, t2.name, pgs.opponent_id::TEXT) as opponent,
          pgs.game_date::DATE as game_date,
          pgs.is_home,
          pgs.stats::JSONB as stats,
          -- Extract key NHL stats
          (pgs.stats::JSONB->>'goals')::INT as goals,
          (pgs.stats::JSONB->>'assists')::INT as assists,
          (pgs.stats::JSONB->>'shots')::INT as shots,
          (pgs.stats::JSONB->>'blocked_shots')::INT as blocked_shots,
          (pgs.stats::JSONB->>'plus_minus')::INT as plus_minus,
          (pgs.stats::JSONB->>'penalty_minutes')::INT as penalty_minutes,
          -- Goalie stats
          (pgs.stats::JSONB->>'saves')::INT as saves,
          (pgs.stats::JSONB->>'goals_against')::INT as goals_against,
          (pgs.stats::JSONB->>'shots_against')::INT as shots_against,
          -- DraftKings fantasy points
          COALESCE((pgs.stats::JSONB->>'goals')::FLOAT * 3, 0) +
          COALESCE((pgs.stats::JSONB->>'assists')::FLOAT * 2, 0) +
          COALESCE((pgs.stats::JSONB->>'shots')::FLOAT * 0.5, 0) +
          COALESCE((pgs.stats::JSONB->>'blocked_shots')::FLOAT * 0.5, 0) +
          COALESCE((pgs.stats::JSONB->>'saves')::FLOAT * 0.2, 0) +
          COALESCE((pgs.stats::JSONB->>'goals_against')::FLOAT * -1, 0) as dk_fantasy_points
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        LEFT JOIN teams t2 ON pgs.opponent_id = t2.id
        WHERE p.sport IN ('NHL', 'NCAA_HKY')
        AND pgs.stats IS NOT NULL
      `);
      console.log(chalk.green('✅ NHL/NCAA_HKY view created'));
      
      // 5. Unified ML Features View
      console.log(chalk.cyan('🤖 Creating unified ML features view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_ml_player_features AS
        WITH recent_stats AS (
          -- NFL features
          SELECT 
            player_id,
            'NFL' as sport,
            game_date,
            calculated_fantasy_points as fantasy_points,
            ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) as game_recency
          FROM v_nfl_player_stats
          
          UNION ALL
          
          -- NBA features  
          SELECT 
            player_id,
            'NBA' as sport,
            game_date,
            dk_fantasy_points as fantasy_points,
            ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) as game_recency
          FROM v_nba_player_stats
          -- Fix: should filter by sport, not position
          
          
          UNION ALL
          
          -- MLB features
          SELECT 
            player_id,
            'MLB' as sport,
            game_date::DATE,  -- Cast to DATE for consistency
            fantasy_points,
            ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) as game_recency
          FROM v_mlb_player_stats
          WHERE fantasy_points IS NOT NULL
          
          UNION ALL
          
          -- NHL features
          SELECT 
            player_id,
            'NHL' as sport,
            game_date,
            dk_fantasy_points as fantasy_points,
            ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) as game_recency
          FROM v_nhl_player_stats
        )
        SELECT 
          player_id,
          sport,
          COUNT(*) as total_games,
          AVG(fantasy_points) as avg_fantasy_points,
          STDDEV(fantasy_points) as std_fantasy_points,
          MIN(fantasy_points) as min_fantasy_points,
          MAX(fantasy_points) as max_fantasy_points,
          AVG(fantasy_points) FILTER (WHERE game_recency <= 3) as avg_last_3,
          AVG(fantasy_points) FILTER (WHERE game_recency <= 5) as avg_last_5,
          AVG(fantasy_points) FILTER (WHERE game_recency <= 10) as avg_last_10,
          MAX(game_date) as last_game_date
        FROM recent_stats
        GROUP BY player_id, sport
        HAVING COUNT(*) >= 5
      `);
      console.log(chalk.green('✅ Unified ML features view created'));
      
      // 6. Create indexes for performance
      console.log(chalk.cyan('📊 Creating performance indexes...'));
      
      // Check if indexes exist before creating
      const indexQueries = [
        `CREATE INDEX IF NOT EXISTS idx_pgl_player_sport ON player_game_logs(player_id, game_date) WHERE stats IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_ps_player_sport ON player_stats(player_id, created_at) WHERE stat_value IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_players_sport ON players(sport) WHERE sport IS NOT NULL`
      ];
      
      for (const query of indexQueries) {
        await client.query(query);
      }
      
      console.log(chalk.green('✅ Indexes created'));
      
      await client.query('COMMIT');
      console.log(chalk.green.bold('\n✅ All sport-specific views created successfully!\n'));
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    // Show view statistics
    console.log(chalk.cyan('📊 Checking view data...'));
    
    const viewStats = await pgPool.query(`
      SELECT 
        'NFL' as sport,
        COUNT(*) as record_count,
        COUNT(DISTINCT player_id) as player_count
      FROM v_nfl_player_stats
      UNION ALL
      SELECT 
        'NBA' as sport,
        COUNT(*) as record_count,
        COUNT(DISTINCT player_id) as player_count
      FROM v_nba_player_stats
      UNION ALL
      SELECT 
        'MLB' as sport,
        COUNT(*) as record_count,
        COUNT(DISTINCT player_id) as player_count
      FROM v_mlb_player_stats
      UNION ALL
      SELECT 
        'NHL' as sport,
        COUNT(*) as record_count,
        COUNT(DISTINCT player_id) as player_count
      FROM v_nhl_player_stats
    `);
    
    console.log(chalk.yellow('\nView Statistics:'));
    viewStats.rows.forEach(row => {
      console.log(`  ${row.sport}: ${parseInt(row.record_count).toLocaleString()} records, ${parseInt(row.player_count).toLocaleString()} players`);
    });
    
    // Check ML features
    const mlFeatures = await pgPool.query(`
      SELECT 
        sport,
        COUNT(*) as player_count,
        AVG(total_games) as avg_games,
        AVG(avg_fantasy_points) as avg_points
      FROM v_ml_player_features
      GROUP BY sport
      ORDER BY player_count DESC
    `);
    
    console.log(chalk.yellow('\nML Features by Sport:'));
    mlFeatures.rows.forEach(row => {
      console.log(`  ${row.sport}: ${row.player_count} players, ${parseFloat(row.avg_games).toFixed(1)} avg games, ${parseFloat(row.avg_points).toFixed(1)} avg points`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error creating views:'), error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

createSportViews();