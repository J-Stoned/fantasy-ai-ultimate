#!/usr/bin/env tsx
/**
 * 🏆 Create Sport-Specific Data Views - FIXED VERSION
 * Handles actual database structure with player_game_stats
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
});

async function createSportViews() {
  console.log(chalk.cyan.bold('\n🏆 Creating Sport-Specific Data Views...\n'));
  
  try {
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Drop existing views first
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
          pgs.player_id,
          p.name,
          pgs.position,
          pgs.team_id,
          COALESCE(t2.abbreviation, t2.name, pgs.opponent_id::TEXT) as opponent,
          gm.game_date::DATE as game_date,
          CASE WHEN pgs.home_away = 'home' THEN true ELSE false END as is_home,
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
          -- Fantasy points
          COALESCE(pgs.dk_points, 0) as calculated_fantasy_points,
          pgs.dk_points,
          pgs.fd_points,
          pgs.yahoo_points
        FROM player_game_stats pgs
        JOIN players_master p ON p.id = pgs.player_id
        JOIN games_master gm ON gm.id = pgs.game_id
        LEFT JOIN teams_master t2 ON pgs.opponent_id = t2.id
        WHERE pgs.sport = 'NFL'
        AND pgs.stats IS NOT NULL
      `);
      console.log(chalk.green('✅ NFL view created'));
      
      // 2. NBA View
      console.log(chalk.cyan('🏀 Creating NBA view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nba_player_stats AS
        SELECT 
          pgs.player_id,
          p.name,
          pgs.position,
          pgs.team_id,
          COALESCE(t2.abbreviation, t2.name, pgs.opponent_id::TEXT) as opponent,
          gm.game_date::DATE as game_date,
          CASE WHEN pgs.home_away = 'home' THEN true ELSE false END as is_home,
          pgs.stats::JSONB as stats,
          -- Extract key NBA stats
          (pgs.stats::JSONB->>'points')::INT as points,
          (pgs.stats::JSONB->>'rebounds')::INT as rebounds,
          (pgs.stats::JSONB->>'assists')::INT as assists,
          (pgs.stats::JSONB->>'steals')::INT as steals,
          (pgs.stats::JSONB->>'blocks')::INT as blocks,
          (pgs.stats::JSONB->>'turnovers')::INT as turnovers,
          (pgs.stats::JSONB->>'minutes_played')::FLOAT as minutes_played,
          -- Fantasy points
          COALESCE(pgs.dk_points, 0) as dk_fantasy_points,
          pgs.fd_points,
          pgs.yahoo_points
        FROM player_game_stats pgs
        JOIN players_master p ON p.id = pgs.player_id
        JOIN games_master gm ON gm.id = pgs.game_id
        LEFT JOIN teams_master t2 ON pgs.opponent_id = t2.id
        WHERE pgs.sport IN ('NBA', 'NCAA_BB')
        AND pgs.stats IS NOT NULL
      `);
      console.log(chalk.green('✅ NBA view created'));
      
      // 3. MLB View
      console.log(chalk.cyan('⚾ Creating MLB view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_mlb_player_stats AS
        SELECT 
          pgs.player_id,
          p.name,
          pgs.position,
          pgs.team_id,
          COALESCE(t2.abbreviation, t2.name, pgs.opponent_id::TEXT) as opponent,
          gm.game_date::DATE as game_date,
          CASE WHEN pgs.home_away = 'home' THEN true ELSE false END as is_home,
          pgs.stats::JSONB as stats,
          -- Batting stats
          (pgs.stats::JSONB->>'hits')::INT as hits,
          (pgs.stats::JSONB->>'at_bats')::INT as at_bats,
          (pgs.stats::JSONB->>'runs')::INT as runs,
          (pgs.stats::JSONB->>'rbis')::INT as rbis,
          (pgs.stats::JSONB->>'home_runs')::INT as home_runs,
          (pgs.stats::JSONB->>'stolen_bases')::INT as stolen_bases,
          -- Pitching stats
          (pgs.stats::JSONB->>'innings_pitched')::FLOAT as innings_pitched,
          (pgs.stats::JSONB->>'strikeouts')::INT as strikeouts,
          (pgs.stats::JSONB->>'earned_runs')::INT as earned_runs,
          -- Fantasy points
          COALESCE(pgs.dk_points, 0) as fantasy_points,
          pgs.dk_points,
          pgs.fd_points,
          pgs.yahoo_points
        FROM player_game_stats pgs
        JOIN players_master p ON p.id = pgs.player_id
        JOIN games_master gm ON gm.id = pgs.game_id
        LEFT JOIN teams_master t2 ON pgs.opponent_id = t2.id
        WHERE pgs.sport IN ('MLB', 'MiLB', 'NCAA_Baseball')
        AND pgs.stats IS NOT NULL
      `);
      console.log(chalk.green('✅ MLB view created'));
      
      // 4. NHL View
      console.log(chalk.cyan('🏒 Creating NHL view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nhl_player_stats AS
        SELECT 
          pgs.player_id,
          p.name,
          pgs.position,
          pgs.team_id,
          COALESCE(t2.abbreviation, t2.name, pgs.opponent_id::TEXT) as opponent,
          gm.game_date::DATE as game_date,
          CASE WHEN pgs.home_away = 'home' THEN true ELSE false END as is_home,
          pgs.stats::JSONB as stats,
          -- Skater stats
          (pgs.stats::JSONB->>'goals')::INT as goals,
          (pgs.stats::JSONB->>'assists')::INT as assists,
          (pgs.stats::JSONB->>'shots')::INT as shots,
          (pgs.stats::JSONB->>'hits')::INT as hits,
          (pgs.stats::JSONB->>'blocks')::INT as blocks,
          (pgs.stats::JSONB->>'pim')::INT as penalty_minutes,
          -- Goalie stats
          (pgs.stats::JSONB->>'saves')::INT as saves,
          (pgs.stats::JSONB->>'goals_against')::INT as goals_against,
          -- Fantasy points
          COALESCE(pgs.dk_points, 0) as dk_fantasy_points,
          pgs.fd_points,
          pgs.yahoo_points
        FROM player_game_stats pgs
        JOIN players_master p ON p.id = pgs.player_id
        JOIN games_master gm ON gm.id = pgs.game_id
        LEFT JOIN teams_master t2 ON pgs.opponent_id = t2.id
        WHERE pgs.sport IN ('NHL', 'NCAA_Hockey')
        AND pgs.stats IS NOT NULL
      `);
      console.log(chalk.green('✅ NHL view created'));
      
      // 5. Unified ML Player Features View
      console.log(chalk.cyan('🤖 Creating unified ML features view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_ml_player_features AS
        WITH player_aggregates AS (
          SELECT 
            pgs.player_id,
            pgs.sport,
            pgs.position,
            pgs.team_id,
            COUNT(*) as total_games,
            AVG(COALESCE(pgs.dk_points, 0)) as avg_fantasy_points,
            STDDEV(COALESCE(pgs.dk_points, 0)) as std_fantasy_points,
            MIN(COALESCE(pgs.dk_points, 0)) as min_fantasy_points,
            MAX(COALESCE(pgs.dk_points, 0)) as max_fantasy_points,
            
            -- Recent form calculations
            AVG(CASE WHEN rn.rn <= 3 THEN COALESCE(pgs.dk_points, 0) END) as avg_last_3,
            AVG(CASE WHEN rn.rn <= 5 THEN COALESCE(pgs.dk_points, 0) END) as avg_last_5,
            AVG(CASE WHEN rn.rn <= 10 THEN COALESCE(pgs.dk_points, 0) END) as avg_last_10,
            
            -- Home/Away splits
            AVG(CASE WHEN pgs.home_away = 'home' THEN COALESCE(pgs.dk_points, 0) END) as home_avg,
            AVG(CASE WHEN pgs.home_away = 'away' THEN COALESCE(pgs.dk_points, 0) END) as away_avg
            
          FROM player_game_stats pgs
          JOIN (
            SELECT 
              player_id,
              game_id,
              ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_id DESC) as rn
            FROM player_game_stats
          ) rn ON pgs.player_id = rn.player_id AND pgs.game_id = rn.game_id
          WHERE pgs.played = true
          GROUP BY pgs.player_id, pgs.sport, pgs.position, pgs.team_id
        )
        SELECT 
          pa.*,
          p.name as player_name,
          t.name as team_name,
          t.abbreviation as team_abbr,
          -- Consistency score (lower std dev = more consistent)
          CASE 
            WHEN pa.avg_fantasy_points > 0 
            THEN 1 - (pa.std_fantasy_points / pa.avg_fantasy_points) 
            ELSE 0 
          END as consistency_score,
          -- Recent trend (last 3 vs overall average)
          CASE 
            WHEN pa.avg_fantasy_points > 0 
            THEN (pa.avg_last_3 / pa.avg_fantasy_points) - 1 
            ELSE 0 
          END as recent_trend
        FROM player_aggregates pa
        JOIN players_master p ON pa.player_id = p.id
        LEFT JOIN teams t ON pa.team_id = t.id
        WHERE pa.total_games >= 5
      `);
      console.log(chalk.green('✅ ML features view created'));
      
      await client.query('COMMIT');
      console.log(chalk.green.bold('\n✅ All views created successfully!\n'));
      
      // Test the views
      console.log(chalk.cyan('📊 Testing views...'));
      
      const viewTests = [
        { name: 'NFL', view: 'v_nfl_player_stats' },
        { name: 'NBA', view: 'v_nba_player_stats' },
        { name: 'MLB', view: 'v_mlb_player_stats' },
        { name: 'NHL', view: 'v_nhl_player_stats' },
        { name: 'ML Features', view: 'v_ml_player_features' }
      ];
      
      for (const test of viewTests) {
        try {
          const result = await client.query(`SELECT COUNT(*) as count FROM ${test.view} LIMIT 1`);
          console.log(chalk.green(`✅ ${test.name}: ${result.rows[0].count} records`));
        } catch (error) {
          console.log(chalk.red(`❌ ${test.name}: Failed`));
        }
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error creating views:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run the script
createSportViews().catch(console.error);