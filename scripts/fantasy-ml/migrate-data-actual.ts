#!/usr/bin/env tsx
/**
 * 🔄 Migrate Data Using Actual Schema
 * Works with your real player_stats structure
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

async function migrateDataActual() {
  console.log(chalk.cyan.bold('\n🔄 Migrating Data with Actual Schema...\n'));
  
  try {
    // 1. First, let's understand the game data structure
    console.log(chalk.cyan('🎮 Checking games table...'));
    const gamesInfo = await pgPool.query(`
      SELECT 
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'games'
      ORDER BY ordinal_position
      LIMIT 10
    `);
    
    if (gamesInfo.rows.length > 0) {
      console.log('Games table columns:');
      gamesInfo.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}`);
      });
    }
    
    // 2. Migrate to game_logs using joins
    console.log(chalk.cyan('\n📊 Migrating to game_logs...'));
    
    try {
      const migrated = await pgPool.query(`
        INSERT INTO game_logs (
          player_id,
          game_date,
          season,
          fantasy_points,
          stats
        )
        SELECT 
          ps.player_id::VARCHAR(255),
          DATE(ps.created_at::TIMESTAMP) as game_date,
          EXTRACT(YEAR FROM ps.created_at::TIMESTAMP)::INT as season,
          ps.fantasy_points,
          ps.stat_value::JSONB as stats
        FROM player_stats ps
        WHERE ps.fantasy_points IS NOT NULL
        AND ps.fantasy_points > 0
        AND NOT EXISTS (
          SELECT 1 FROM game_logs gl 
          WHERE gl.player_id = ps.player_id::VARCHAR(255)
          AND gl.game_date = DATE(ps.created_at)
        )
        LIMIT 10000
        ON CONFLICT (player_id, game_date) DO NOTHING
      `);
      
      console.log(chalk.green(`✅ Migrated ${migrated.rowCount} game logs`));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not migrate to game_logs:', error.message));
    }
    
    // 3. Get player information for enrichment
    console.log(chalk.cyan('\n👥 Enriching player data...'));
    
    // Check if we can link to player info
    const playerInfo = await pgPool.query(`
      SELECT 
        p.id,
        p.name,
        p.sport,
        p.position,
        p.team,
        COUNT(ps.id) as stat_count,
        AVG(ps.fantasy_points) as avg_points
      FROM players p
      JOIN player_stats ps ON p.id = ps.player_id
      WHERE ps.fantasy_points IS NOT NULL
      GROUP BY p.id, p.name, p.sport, p.position, p.team
      HAVING COUNT(ps.id) > 5
      LIMIT 10
    `);
    
    console.log(`Found ${playerInfo.rows.length} players with sufficient data`);
    if (playerInfo.rows.length > 0) {
      console.log('\nSample players:');
      playerInfo.rows.slice(0, 3).forEach(p => {
        console.log(`  ${p.name} (${p.sport}/${p.position}): ${p.stat_count} games, ${parseFloat(p.avg_points).toFixed(1)} avg pts`);
      });
    }
    
    // 4. Create a view for ML-ready data
    console.log(chalk.cyan('\n👁️  Creating ML data view...'));
    
    await pgPool.query(`
      CREATE OR REPLACE VIEW v_ml_player_data AS
      SELECT 
        p.id::VARCHAR(255) as player_id,
        p.name,
        p.sport,
        p.position,
        p.team,
        ps.fantasy_points,
        ps.stat_value::JSONB as stats,
        DATE(ps.created_at) as game_date,
        ps.created_at,
        -- Calculate recent averages
        AVG(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.created_at 
          ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING
        ) as avg_last_10,
        AVG(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.created_at 
          ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING
        ) as avg_last_5,
        -- Calculate trend
        AVG(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.created_at 
          ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
        ) - AVG(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.created_at 
          ROWS BETWEEN 10 PRECEDING AND 4 PRECEDING
        ) as trend
      FROM players p
      JOIN player_stats ps ON p.id = ps.player_id
      WHERE ps.fantasy_points IS NOT NULL
    `);
    
    console.log(chalk.green('✅ ML data view created'));
    
    // 5. Show summary
    console.log(chalk.cyan('\n📊 Migration Summary:'));
    
    const summary = await pgPool.query(`
      SELECT 
        'player_stats' as table_name, COUNT(*) as total, COUNT(DISTINCT player_id) as unique_players
      FROM player_stats
      WHERE fantasy_points IS NOT NULL
      UNION ALL
      SELECT 
        'game_logs', COUNT(*), COUNT(DISTINCT player_id)
      FROM game_logs
    `);
    
    summary.rows.forEach(row => {
      console.log(chalk.yellow(`  ${row.table_name}: ${parseInt(row.total).toLocaleString()} records, ${parseInt(row.unique_players).toLocaleString()} players`));
    });
    
    console.log(chalk.green.bold('\n✅ Data migration complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Migration error:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run migration
migrateDataActual();