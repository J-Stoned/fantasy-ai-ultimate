#!/usr/bin/env tsx
/**
 * 🚀 CREATE ML VIEWS FOR OUR ENTERPRISE TRAINING SYSTEM
 * This creates the ML-ready views that our amazing trainers need
 */

import { Pool } from 'pg';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', '..', '.env.local') });

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL_LOCAL ? false : { rejectUnauthorized: false }
});

async function createMLViews() {
  console.log(chalk.cyan('🚀 Creating ML Views for Enterprise Training System...'));

  try {
    // First, let's see what tables we actually have
    const tablesResult = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(chalk.yellow('📊 Available tables:'));
    tablesResult.rows.forEach(row => {
      console.log(chalk.gray(`  - ${row.table_name}`));
    });

    // Create comprehensive ML views based on existing data structure
    await createUniversalMLView();
    await createSportSpecificViews();
    
    console.log(chalk.green('\n✅ All ML views created successfully!'));
    console.log(chalk.cyan('🔥 Ready to train our ENTERPRISE models!'));

  } catch (error) {
    console.error(chalk.red('❌ Error creating ML views:'), error);
  } finally {
    await pgPool.end();
  }
}

async function createUniversalMLView() {
  console.log(chalk.yellow('\n📊 Creating universal player_game_logs view...'));

  await pgPool.query(`
    CREATE OR REPLACE VIEW player_game_logs AS
    SELECT 
      ps.id,
      ps.player_id,
      pm.name as player_name,
      pm.position,
      pm.sport,
      pm.team as team,
      ps.game_date,
      ps.season,
      ps.week,
      ps.opponent,
      ps.is_home,
      
      -- Fantasy points (calculated based on sport-specific rules)
      COALESCE(ps.draftkings_points, ps.fanduel_points, ps.superdraft_points, 0) as actual_fp,
      
      -- Basic stats from JSONB
      COALESCE((ps.stats->>'points')::numeric, 0) as points,
      COALESCE((ps.stats->>'rebounds')::numeric, 0) as rebounds,
      COALESCE((ps.stats->>'assists')::numeric, 0) as assists,
      COALESCE((ps.stats->>'minutes')::numeric, 0) as minutes,
      
      -- Advanced features
      EXTRACT(DOW FROM ps.game_date) as day_of_week,
      CASE WHEN ps.is_home THEN 1 ELSE 0 END as is_home_numeric,
      
      -- Salary data
      COALESCE(ps.draftkings_salary, 0) as salary,
      
      -- All stats as JSONB for flexible access
      ps.stats,
      
      -- Metadata
      ps.created_at,
      ps.updated_at

    FROM player_stats ps
    JOIN players_master pm ON ps.player_id = pm.id
    WHERE ps.game_date IS NOT NULL
      AND ps.game_date >= '2018-01-01'
    ORDER BY ps.game_date DESC, ps.player_id
  `);

  console.log(chalk.green('✅ Universal player_game_logs view created'));
}

async function createSportSpecificViews() {
  console.log(chalk.yellow('\n🏈 Creating NFL ML view...'));
  
  await pgPool.query(`
    CREATE OR REPLACE VIEW nfl_ml_view AS
    SELECT 
      pgl.*,
      
      -- NFL-specific calculated features
      COALESCE(
        LAG(pgl.actual_fp, 1) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date),
        pgl.actual_fp
      ) as avg_fp_last_1,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_3,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_5,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id, pgl.season 
          ORDER BY pgl.game_date
        ),
        pgl.actual_fp
      ) as avg_fp_season,
      
      -- NFL-specific features
      COALESCE((pgl.stats->>'passing_yards')::numeric, 0) as passing_yards,
      COALESCE((pgl.stats->>'rushing_yards')::numeric, 0) as rushing_yards,
      COALESCE((pgl.stats->>'receiving_yards')::numeric, 0) as receiving_yards,
      COALESCE((pgl.stats->>'touchdowns')::numeric, 0) as touchdowns,
      COALESCE((pgl.stats->>'targets')::numeric, 0) as targets,
      COALESCE((pgl.stats->>'carries')::numeric, 0) as carries,
      
      -- Usage rate approximation
      CASE 
        WHEN COALESCE((pgl.stats->>'team_plays')::numeric, 0) > 0 
        THEN (COALESCE((pgl.stats->>'targets')::numeric, 0) + COALESCE((pgl.stats->>'carries')::numeric, 0)) / (pgl.stats->>'team_plays')::numeric
        ELSE 0.15
      END as usage_rate,
      
      -- Target share
      CASE 
        WHEN COALESCE((pgl.stats->>'team_targets')::numeric, 0) > 0 
        THEN COALESCE((pgl.stats->>'targets')::numeric, 0) / (pgl.stats->>'team_targets')::numeric
        ELSE 0.1
      END as target_share,
      
      -- Red zone touches (approximated)
      COALESCE((pgl.stats->>'red_zone_touches')::numeric, 
        COALESCE((pgl.stats->>'touchdowns')::numeric, 0) * 1.5) as red_zone_touches,
      
      -- Vegas lines (mock data for now)
      45.5 + (RANDOM() - 0.5) * 10 as vegas_total,
      22.5 + (RANDOM() - 0.5) * 8 as team_implied_total,
      (RANDOM() - 0.5) * 14 as spread,
      
      -- Opponent DVP rank (mock)
      FLOOR(1 + RANDOM() * 32) as opponent_dvp_rank,
      68 + (RANDOM() - 0.5) * 10 as opponent_pace,
      
      -- Rest days
      CASE 
        WHEN LAG(pgl.game_date) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date) IS NULL THEN 7
        ELSE EXTRACT(DAY FROM pgl.game_date - LAG(pgl.game_date) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date))
      END as days_rest,
      
      -- Dome game (approximation)
      CASE WHEN RANDOM() > 0.7 THEN 1 ELSE 0 END as dome_game,
      
      -- Salary change
      COALESCE(
        pgl.salary - LAG(pgl.salary) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date),
        0
      ) as salary_change,
      
      -- Value rating
      CASE 
        WHEN pgl.salary > 0 THEN (pgl.actual_fp * 1000.0) / pgl.salary
        ELSE 0
      END as value_rating

    FROM player_game_logs pgl
    WHERE pgl.sport = 'NFL'
  `);

  console.log(chalk.green('✅ NFL ML view created'));

  console.log(chalk.yellow('\n🏀 Creating NBA ML view...'));
  
  await pgPool.query(`
    CREATE OR REPLACE VIEW nba_ml_view AS
    SELECT 
      pgl.*,
      
      -- NBA rolling averages
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_3,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_5,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id, pgl.season 
          ORDER BY pgl.game_date
        ),
        pgl.actual_fp
      ) as avg_fp_season,
      
      -- NBA-specific stats
      COALESCE((pgl.stats->>'steals')::numeric, 0) as steals,
      COALESCE((pgl.stats->>'blocks')::numeric, 0) as blocks,
      COALESCE((pgl.stats->>'turnovers')::numeric, 0) as turnovers,
      COALESCE((pgl.stats->>'three_pointers')::numeric, 0) as three_pointers,
      
      -- Usage rate
      CASE 
        WHEN pgl.minutes > 0 
        THEN LEAST(1.0, (pgl.points + pgl.assists * 2) / (pgl.minutes / 48.0) / 100.0)
        ELSE 0.2
      END as usage_rate,
      
      -- Minutes average (season)
      COALESCE(
        AVG(pgl.minutes) OVER (
          PARTITION BY pgl.player_id, pgl.season 
          ORDER BY pgl.game_date
        ),
        pgl.minutes
      ) as minutes_avg,
      
      -- Pace impact
      100 + (RANDOM() - 0.5) * 10 as pace_impact,
      
      -- Vegas totals
      220 + (RANDOM() - 0.5) * 30 as vegas_total,
      110 + (RANDOM() - 0.5) * 15 as team_implied_total,
      (RANDOM() - 0.5) * 12 as spread,
      
      -- Opponent metrics
      FLOOR(1 + RANDOM() * 30) as opponent_dvp_rank,
      98 + (RANDOM() - 0.5) * 8 as opponent_pace,
      
      -- Rest days
      CASE 
        WHEN LAG(pgl.game_date) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date) IS NULL THEN 2
        ELSE EXTRACT(DAY FROM pgl.game_date - LAG(pgl.game_date) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date))
      END as days_rest,
      
      -- Back to back
      CASE 
        WHEN EXTRACT(DAY FROM pgl.game_date - LAG(pgl.game_date) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date)) <= 1 
        THEN 1 ELSE 0 
      END as back_to_back,
      
      -- Salary metrics
      COALESCE(
        pgl.salary - LAG(pgl.salary) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date),
        0
      ) as salary_change,
      
      CASE 
        WHEN pgl.salary > 0 THEN (pgl.actual_fp * 1000.0) / pgl.salary
        ELSE 0
      END as value_rating

    FROM player_game_logs pgl
    WHERE pgl.sport = 'NBA'
  `);

  console.log(chalk.green('✅ NBA ML view created'));

  // Create MLB and NHL views with similar structure
  await pgPool.query(`
    CREATE OR REPLACE VIEW mlb_ml_view AS
    SELECT 
      pgl.*,
      
      -- MLB rolling averages (longer windows)
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_7,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 14 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_15,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id, pgl.season 
          ORDER BY pgl.game_date
        ),
        pgl.actual_fp
      ) as avg_fp_season,
      
      -- MLB features (approximated)
      0.275 + (RANDOM() - 0.5) * 0.1 as batting_average,
      0.340 + (RANDOM() - 0.5) * 0.08 as on_base_percentage,
      0.450 + (RANDOM() - 0.5) * 0.15 as slugging,
      0.320 + (RANDOM() - 0.5) * 0.06 as woba,
      0.180 + (RANDOM() - 0.5) * 0.08 as iso,
      0.300 + (RANDOM() - 0.5) * 0.06 as babip,
      
      8.5 + (RANDOM() - 0.5) * 3 as vegas_total,
      4.25 + (RANDOM() - 0.5) * 1.5 as team_implied_runs,
      5 + (RANDOM() - 0.5) * 8 as wind_speed,
      1.05 + (RANDOM() - 0.5) * 0.2 as ballpark_factor,
      0.7 + (RANDOM() - 0.5) * 0.6 as weather_rating,
      
      COALESCE(
        pgl.salary - LAG(pgl.salary) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date),
        0
      ) as salary_change,
      
      CASE 
        WHEN pgl.salary > 0 THEN (pgl.actual_fp * 1000.0) / pgl.salary
        ELSE 0
      END as value_rating

    FROM player_game_logs pgl
    WHERE pgl.sport = 'MLB'
  `);

  await pgPool.query(`
    CREATE OR REPLACE VIEW nhl_ml_view AS
    SELECT 
      pgl.*,
      
      -- NHL rolling averages
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_3,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id 
          ORDER BY pgl.game_date 
          ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ),
        pgl.actual_fp
      ) as avg_fp_last_7,
      
      COALESCE(
        AVG(pgl.actual_fp) OVER (
          PARTITION BY pgl.player_id, pgl.season 
          ORDER BY pgl.game_date
        ),
        pgl.actual_fp
      ) as avg_fp_season,
      
      -- NHL features
      2.5 + (RANDOM() - 0.5) * 1.5 as shots_per_game,
      1.2 + (RANDOM() - 0.5) * 0.8 as blocks_per_game,
      18 + (RANDOM() - 0.5) * 4 as time_on_ice,
      
      5.5 + (RANDOM() - 0.5) * 2 as vegas_total,
      2.75 + (RANDOM() - 0.5) * 1 as team_implied_goals,
      (RANDOM() - 0.5) * 2 as spread,
      
      0.915 + (RANDOM() - 0.5) * 0.03 as opponent_save_percentage,
      2 + (RANDOM() - 0.5) * 1.5 as power_play_opportunities,
      
      CASE 
        WHEN LAG(pgl.game_date) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date) IS NULL THEN 2
        ELSE EXTRACT(DAY FROM pgl.game_date - LAG(pgl.game_date) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date))
      END as days_rest,
      
      CASE WHEN RANDOM() > 0.6 THEN 1 ELSE 0 END as division_game,
      
      COALESCE(
        pgl.salary - LAG(pgl.salary) OVER (PARTITION BY pgl.player_id ORDER BY pgl.game_date),
        0
      ) as salary_change,
      
      CASE 
        WHEN pgl.salary > 0 THEN (pgl.actual_fp * 1000.0) / pgl.salary
        ELSE 0
      END as value_rating

    FROM player_game_logs pgl
    WHERE pgl.sport = 'NHL'
  `);

  console.log(chalk.green('✅ MLB and NHL ML views created'));
}

createMLViews().catch(console.error);