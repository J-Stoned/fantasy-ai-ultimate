#!/usr/bin/env tsx
/**
 * 🏆 Create Enhanced Sport Views with ML Enrichment Data
 * Integrates weather, referee, situational, and injury data
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

async function createEnhancedViews() {
  console.log(chalk.cyan.bold('\n🏆 Creating Enhanced Sport Views with ML Enrichment...\n'));
  
  try {
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Drop existing enhanced views
      console.log(chalk.yellow('🗑️  Dropping existing enhanced views...'));
      await client.query('DROP VIEW IF EXISTS v_nfl_enhanced CASCADE');
      await client.query('DROP VIEW IF EXISTS v_nba_enhanced CASCADE');
      await client.query('DROP VIEW IF EXISTS v_mlb_enhanced CASCADE');
      await client.query('DROP VIEW IF EXISTS v_nhl_enhanced CASCADE');
      await client.query('DROP VIEW IF EXISTS v_ml_player_features_enhanced CASCADE');
      console.log(chalk.green('✅ Old views dropped'));
      
      // 1. Enhanced NFL View
      console.log(chalk.cyan('🏈 Creating enhanced NFL view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nfl_enhanced AS
        SELECT 
          pgs.*,
          p.name as player_name,
          
          -- Weather enrichment (outdoor games)
          CASE 
            WHEN t.stadium_type != 'dome' THEN wd.temperature
            ELSE NULL 
          END as game_temperature,
          CASE 
            WHEN t.stadium_type != 'dome' THEN wd.wind_speed
            ELSE 0 
          END as wind_speed,
          COALESCE(wd.is_dome, t.stadium_type = 'dome') as is_dome,
          
          -- Referee enrichment
          rp.penalty_rate,
          rp.home_field_advantage as ref_home_advantage,
          
          -- Situational performance
          sp.home_performance,
          sp.road_performance,
          sp.redzone_targets,
          sp.redzone_touchdowns,
          sp.redzone_efficiency,
          sp.rest_advantage,
          
          -- Injury status
          ir.status as injury_status,
          ir.body_part as injury_body_part,
          COALESCE(ir.availability_percentage, 100) as health_percentage,
          
          -- Strength of schedule
          sos.strength_rank as opponent_strength_rank,
          sos.point_differential as opponent_point_diff
          
        FROM v_nfl_player_stats pgs
        JOIN players p ON pgs.player_id = p.id
        LEFT JOIN teams t ON pgs.team_id = t.id
        LEFT JOIN games_master gm ON pgs.game_date = gm.game_date 
          AND (pgs.team_id = gm.home_team_id OR pgs.team_id = gm.away_team_id)
        
        -- Weather data
        LEFT JOIN weather_data wd ON gm.id = wd.game_id
        
        -- Referee data
        LEFT JOIN game_referee_assignments gra ON gm.id = gra.game_id
        LEFT JOIN referee_profiles rp ON gra.referee_id = rp.id
        
        -- Situational performance
        LEFT JOIN situational_performance sp ON pgs.player_id = sp.player_id 
          AND pgs.sport = sp.sport
          
        -- Injury reports
        LEFT JOIN injury_reports ir ON pgs.player_id = ir.player_id
          AND pgs.game_date BETWEEN ir.report_date AND COALESCE(ir.return_date, CURRENT_DATE)
          
        -- Opponent strength
        LEFT JOIN strength_of_schedule sos ON pgs.opponent_id = sos.team_id
      `);
      console.log(chalk.green('✅ Enhanced NFL view created'));
      
      // 2. Enhanced NBA View
      console.log(chalk.cyan('🏀 Creating enhanced NBA view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nba_enhanced AS
        SELECT 
          pgs.*,
          p.name as player_name,
          
          -- Rest days calculation
          LAG(pgs.game_date) OVER (PARTITION BY pgs.player_id ORDER BY pgs.game_date) as prev_game_date,
          pgs.game_date - LAG(pgs.game_date) OVER (PARTITION BY pgs.player_id ORDER BY pgs.game_date) as days_rest,
          
          -- Referee enrichment
          rp.foul_rate,
          rp.pace_factor,
          rp.home_field_advantage as ref_home_advantage,
          
          -- Situational performance
          sp.home_performance,
          sp.road_performance,
          sp.clutch_points,
          sp.fourth_quarter_points,
          sp.back_to_back_performance,
          
          -- Injury status
          ir.status as injury_status,
          COALESCE(ir.availability_percentage, 100) as health_percentage,
          
          -- Opponent strength
          sos.strength_rank as opponent_strength_rank,
          sos.avg_points_against as opponent_defensive_rating
          
        FROM v_nba_player_stats pgs
        JOIN players p ON pgs.player_id = p.id
        LEFT JOIN games_master gm ON pgs.game_date = gm.game_date 
          AND (pgs.team_id = gm.home_team_id OR pgs.team_id = gm.away_team_id)
        
        -- Referee data
        LEFT JOIN game_referee_assignments gra ON gm.id = gra.game_id
        LEFT JOIN referee_profiles rp ON gra.referee_id = rp.id
        
        -- Situational performance
        LEFT JOIN situational_performance sp ON pgs.player_id = sp.player_id 
          AND pgs.sport = sp.sport
          
        -- Injury reports
        LEFT JOIN injury_reports ir ON pgs.player_id = ir.player_id
          AND pgs.game_date BETWEEN ir.report_date AND COALESCE(ir.return_date, CURRENT_DATE)
          
        -- Opponent strength
        LEFT JOIN strength_of_schedule sos ON pgs.opponent_id = sos.team_id
      `);
      console.log(chalk.green('✅ Enhanced NBA view created'));
      
      // 3. Enhanced MLB View
      console.log(chalk.cyan('⚾ Creating enhanced MLB view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_mlb_enhanced AS
        SELECT 
          pgs.*,
          p.name as player_name,
          
          -- Weather enrichment (always outdoor)
          wd.temperature as game_temperature,
          wd.wind_speed,
          wd.wind_direction,
          
          -- Umpire enrichment
          up.strike_zone_size,
          up.low_strike_rate,
          up.high_strike_rate,
          up.home_advantage as ump_home_advantage,
          
          -- Situational performance
          sp.home_performance,
          sp.road_performance,
          sp.risp_avg,
          sp.risp_rbi,
          sp.clutch_hitting,
          sp.ballpark_factor,
          
          -- Injury status
          ir.status as injury_status,
          COALESCE(ir.availability_percentage, 100) as health_percentage,
          
          -- Opponent pitcher/batter matchup info
          sos.strength_rank as opponent_strength_rank
          
        FROM v_mlb_player_stats pgs
        JOIN players p ON pgs.player_id = p.id
        LEFT JOIN games_master gm ON pgs.game_date = gm.game_date 
          AND (pgs.team_id = gm.home_team_id OR pgs.team_id = gm.away_team_id)
        
        -- Weather data
        LEFT JOIN weather_data wd ON gm.id = wd.game_id
        
        -- Umpire data
        LEFT JOIN game_umpire_assignments gua ON gm.id::VARCHAR = REPLACE(gua.game_id, 'MLB_', '')
        LEFT JOIN umpire_profiles up ON gua.homeplate_umpire_id = up.id
        
        -- Situational performance
        LEFT JOIN situational_performance sp ON pgs.player_id = sp.player_id 
          AND pgs.sport = sp.sport
          
        -- Injury reports
        LEFT JOIN injury_reports ir ON pgs.player_id = ir.player_id
          AND pgs.game_date BETWEEN ir.report_date AND COALESCE(ir.return_date, CURRENT_DATE)
          
        -- Opponent strength
        LEFT JOIN strength_of_schedule sos ON pgs.opponent_id = sos.team_id
      `);
      console.log(chalk.green('✅ Enhanced MLB view created'));
      
      // 4. Enhanced NHL View
      console.log(chalk.cyan('🏒 Creating enhanced NHL view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_nhl_enhanced AS
        SELECT 
          pgs.*,
          p.name as player_name,
          
          -- Referee enrichment
          rp.penalty_rate,
          rp.home_field_advantage as ref_home_advantage,
          
          -- Situational performance
          sp.home_performance,
          sp.road_performance,
          sp.rest_advantage,
          
          -- Injury status
          ir.status as injury_status,
          COALESCE(ir.availability_percentage, 100) as health_percentage,
          
          -- Opponent strength
          sos.strength_rank as opponent_strength_rank,
          sos.avg_points_against as opponent_defensive_rating
          
        FROM v_nhl_player_stats pgs
        JOIN players p ON pgs.player_id = p.id
        LEFT JOIN games_master gm ON pgs.game_date = gm.game_date 
          AND (pgs.team_id = gm.home_team_id OR pgs.team_id = gm.away_team_id)
        
        -- Referee data
        LEFT JOIN game_referee_assignments gra ON gm.id = gra.game_id
        LEFT JOIN referee_profiles rp ON gra.referee_id = rp.id
        
        -- Situational performance
        LEFT JOIN situational_performance sp ON pgs.player_id = sp.player_id 
          AND pgs.sport = sp.sport
          
        -- Injury reports
        LEFT JOIN injury_reports ir ON pgs.player_id = ir.player_id
          AND pgs.game_date BETWEEN ir.report_date AND COALESCE(ir.return_date, CURRENT_DATE)
          
        -- Opponent strength
        LEFT JOIN strength_of_schedule sos ON pgs.opponent_id = sos.team_id
      `);
      console.log(chalk.green('✅ Enhanced NHL view created'));
      
      // 5. Enhanced ML Features View
      console.log(chalk.cyan('🤖 Creating enhanced ML features view...'));
      await client.query(`
        CREATE OR REPLACE VIEW v_ml_player_features_enhanced AS
        SELECT 
          mf.*,
          
          -- Aggregate enrichment stats
          AVG(sp.home_performance) as avg_home_performance,
          AVG(sp.road_performance) as avg_road_performance,
          AVG(sp.rest_advantage) as avg_rest_advantage,
          
          -- Recent injury history
          COUNT(DISTINCT ir.id) as injury_count_last_year,
          MAX(ir.report_date) as last_injury_date,
          
          -- Weather impact (NFL/MLB only)
          CASE 
            WHEN mf.sport IN ('NFL', 'MLB') THEN 
              AVG(CASE WHEN wd.temperature < 40 THEN 1 ELSE 0 END)
            ELSE NULL
          END as cold_weather_game_pct,
          
          -- Referee/Umpire impact
          CASE 
            WHEN mf.sport = 'MLB' THEN AVG(up.strike_zone_size)
            WHEN mf.sport IN ('NFL', 'NBA', 'NHL') THEN AVG(rp.home_field_advantage)
            ELSE NULL
          END as avg_official_impact
          
        FROM v_ml_player_features mf
        
        -- Situational performance
        LEFT JOIN situational_performance sp ON mf.player_id = sp.player_id 
          AND mf.sport = sp.sport
          
        -- Injury history
        LEFT JOIN injury_reports ir ON mf.player_id = ir.player_id
          AND ir.report_date >= CURRENT_DATE - INTERVAL '1 year'
          
        -- Weather data (through games)
        LEFT JOIN player_game_stats pgs ON mf.player_id = pgs.player_id
        LEFT JOIN games_master gm ON pgs.game_id = gm.id
        LEFT JOIN weather_data wd ON gm.id = wd.game_id
        
        -- Officials data
        LEFT JOIN game_referee_assignments gra ON gm.id = gra.game_id
        LEFT JOIN referee_profiles rp ON gra.referee_id = rp.id
        LEFT JOIN game_umpire_assignments gua ON gm.id::VARCHAR = REPLACE(gua.game_id, 'MLB_', '')
        LEFT JOIN umpire_profiles up ON gua.homeplate_umpire_id = up.id
        
        GROUP BY 
          mf.player_id, mf.sport, mf.position, mf.team_id, mf.total_games,
          mf.avg_fantasy_points, mf.std_fantasy_points, mf.min_fantasy_points,
          mf.max_fantasy_points, mf.avg_last_3, mf.avg_last_5, mf.avg_last_10,
          mf.home_avg, mf.away_avg, mf.player_name, mf.team_name, mf.team_abbr,
          mf.consistency_score, mf.recent_trend
      `);
      console.log(chalk.green('✅ Enhanced ML features view created'));
      
      await client.query('COMMIT');
      console.log(chalk.green.bold('\n✅ All enhanced views created successfully!\n'));
      
      // Test the views
      console.log(chalk.cyan('📊 Testing enhanced views...'));
      
      const viewTests = [
        { name: 'Enhanced NFL', view: 'v_nfl_enhanced' },
        { name: 'Enhanced NBA', view: 'v_nba_enhanced' },
        { name: 'Enhanced MLB', view: 'v_mlb_enhanced' },
        { name: 'Enhanced NHL', view: 'v_nhl_enhanced' },
        { name: 'Enhanced ML Features', view: 'v_ml_player_features_enhanced' }
      ];
      
      for (const test of viewTests) {
        try {
          const result = await client.query(`SELECT COUNT(*) as count FROM ${test.view} LIMIT 1`);
          console.log(chalk.green(`✅ ${test.name}: View ready`));
        } catch (error) {
          console.log(chalk.red(`❌ ${test.name}: Failed - ${error.message}`));
        }
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error creating enhanced views:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run the script
createEnhancedViews().catch(console.error);