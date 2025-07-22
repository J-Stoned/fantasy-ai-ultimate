#!/usr/bin/env tsx
/**
 * 🔄 Migrate Existing Data to ML Schema
 * Populates game_logs and adds ML features to existing data
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

async function migrateToMLSchema() {
  console.log(chalk.cyan.bold('\n🔄 Migrating Data to ML Schema...\n'));
  
  try {
    // 1. Populate game_logs from player_stats
    console.log(chalk.cyan('📊 Migrating player_stats to game_logs...'));
    
    const migrated = await pgPool.query(`
      INSERT INTO game_logs (
        player_id,
        game_date,
        season,
        week,
        team,
        opponent,
        is_home,
        fantasy_points,
        dk_salary,
        fd_salary,
        stats
      )
      SELECT 
        ps.player_id,
        ps.game_date,
        EXTRACT(YEAR FROM ps.game_date)::INT as season,
        ps.week,
        ps.team,
        ps.opponent,
        COALESCE(ps.is_home, true),
        ps.fantasy_points,
        ps.dk_salary,
        ps.fd_salary,
        jsonb_build_object(
          'points', ps.points,
          'rebounds', ps.rebounds,
          'assists', ps.assists,
          'steals', ps.steals,
          'blocks', ps.blocks,
          'turnovers', ps.turnovers,
          'three_pointers_made', ps.three_pointers_made,
          'field_goals_made', ps.field_goals_made,
          'field_goals_attempted', ps.field_goals_attempted,
          'free_throws_made', ps.free_throws_made,
          'free_throws_attempted', ps.free_throws_attempted,
          'minutes', ps.minutes
        )
      FROM player_stats ps
      WHERE NOT EXISTS (
        SELECT 1 FROM game_logs gl 
        WHERE gl.player_id = ps.player_id 
        AND gl.game_date = ps.game_date
      )
      AND ps.fantasy_points IS NOT NULL
      ON CONFLICT (player_id, game_date) DO NOTHING
    `);
    
    console.log(chalk.green(`✅ Migrated ${migrated.rowCount} game logs`));
    
    // 2. Calculate and update rest days
    console.log(chalk.cyan('📅 Calculating rest days...'));
    
    await pgPool.query(`
      WITH rest_calc AS (
        SELECT 
          id,
          player_id,
          game_date,
          LAG(game_date) OVER (PARTITION BY player_id ORDER BY game_date) as prev_game_date
        FROM player_stats
      )
      UPDATE player_stats ps
      SET rest_days = COALESCE(
        EXTRACT(EPOCH FROM (rc.game_date - rc.prev_game_date)) / 86400,
        7
      )::INT
      FROM rest_calc rc
      WHERE ps.id = rc.id
    `);
    
    console.log(chalk.green('✅ Rest days calculated'));
    
    // 3. Add default injury records for active players
    console.log(chalk.cyan('🏥 Creating default injury records...'));
    
    await pgPool.query(`
      INSERT INTO injuries (
        player_id,
        injury_date,
        status,
        fantasy_impact_score,
        playing_probability,
        source
      )
      SELECT DISTINCT
        p.id,
        CURRENT_DATE,
        'Healthy',
        0.0,
        1.0,
        'System Default'
      FROM players p
      WHERE EXISTS (
        SELECT 1 FROM player_stats ps 
        WHERE ps.player_id = p.id 
        AND ps.game_date > CURRENT_DATE - INTERVAL '30 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM injuries i 
        WHERE i.player_id = p.id
      )
    `);
    
    console.log(chalk.green('✅ Default injury records created'));
    
    // 4. Calculate opponent rankings (simplified)
    console.log(chalk.cyan('🏆 Calculating opponent rankings...'));
    
    await pgPool.query(`
      WITH opp_stats AS (
        SELECT 
          p.sport,
          p.position,
          ps.opponent as team,
          AVG(ps.fantasy_points) as avg_allowed
        FROM player_stats ps
        JOIN players p ON ps.player_id = p.id
        WHERE ps.game_date > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY p.sport, p.position, ps.opponent
      ),
      rankings AS (
        SELECT 
          sport,
          position,
          team,
          RANK() OVER (PARTITION BY sport, position ORDER BY avg_allowed DESC) as rank_vs_position
        FROM opp_stats
      )
      UPDATE player_stats ps
      SET opponent_rank_vs_position = r.rank_vs_position
      FROM players p, rankings r
      WHERE ps.player_id = p.id
      AND p.sport = r.sport
      AND p.position = r.position
      AND ps.opponent = r.team
    `);
    
    console.log(chalk.green('✅ Opponent rankings calculated'));
    
    // 5. Show migration summary
    console.log(chalk.cyan('\n📊 Migration Summary:'));
    
    const summary = await pgPool.query(`
      SELECT 
        'game_logs' as table_name, COUNT(*) as count FROM game_logs
      UNION ALL
      SELECT 'injuries', COUNT(*) FROM injuries
      UNION ALL
      SELECT 'player_stats_with_ml', COUNT(*) FROM player_stats WHERE rest_days IS NOT NULL
      ORDER BY count DESC
    `);
    
    summary.rows.forEach(row => {
      console.log(chalk.yellow(`  ${row.table_name}: ${parseInt(row.count).toLocaleString()} records`));
    });
    
    console.log(chalk.green.bold('\n✅ Data migration complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Migration error:'), error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

// Run migration
migrateToMLSchema();