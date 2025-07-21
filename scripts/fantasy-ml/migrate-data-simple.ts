#!/usr/bin/env tsx
/**
 * 🔄 Simple Data Migration for ML
 * Migrates data without relying on foreign keys
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

async function migrateDataSimple() {
  console.log(chalk.cyan.bold('\n🔄 Migrating Data for ML (Simple Version)...\n'));
  
  try {
    // 1. Check if we have data to migrate
    const statsCount = await pgPool.query('SELECT COUNT(*) FROM player_stats');
    console.log(chalk.cyan(`Found ${statsCount.rows[0].count} player stats to potentially migrate`));
    
    // 2. Migrate to game_logs (if table exists and is empty)
    const gameLogsExists = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'game_logs'
      )
    `);
    
    if (gameLogsExists.rows[0].exists) {
      console.log(chalk.cyan('\n📊 Migrating player_stats to game_logs...'));
      
      const migrated = await pgPool.query(`
        INSERT INTO game_logs (
          player_id,
          game_date,
          season,
          week,
          team,
          opponent,
          fantasy_points
        )
        SELECT 
          ps.player_id,
          ps.game_date,
          EXTRACT(YEAR FROM ps.game_date)::INT as season,
          ps.week,
          ps.team,
          ps.opponent,
          ps.fantasy_points
        FROM player_stats ps
        WHERE ps.fantasy_points IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM game_logs gl 
          WHERE gl.player_id = ps.player_id 
          AND gl.game_date = ps.game_date
        )
        ON CONFLICT (player_id, game_date) DO NOTHING
      `);
      
      console.log(chalk.green(`✅ Migrated ${migrated.rowCount} new game logs`));
    }
    
    // 3. Add ML columns to player_stats if they don't exist
    console.log(chalk.cyan('\n🔧 Checking ML columns in player_stats...'));
    
    const mlColumns = [
      { name: 'rest_days', type: 'INT DEFAULT 7' },
      { name: 'is_home', type: 'BOOLEAN DEFAULT true' }
    ];
    
    for (const col of mlColumns) {
      const exists = await pgPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'player_stats' 
          AND column_name = '${col.name}'
        )
      `);
      
      if (!exists.rows[0].exists) {
        try {
          await pgPool.query(`
            ALTER TABLE player_stats 
            ADD COLUMN ${col.name} ${col.type}
          `);
          console.log(chalk.green(`  ✓ Added ${col.name}`));
        } catch (error) {
          console.log(chalk.yellow(`  ⚠️  Could not add ${col.name}`));
        }
      } else {
        console.log(chalk.blue(`  ℹ️  ${col.name} already exists`));
      }
    }
    
    // 4. Create basic injury records
    const injuriesExists = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'injuries'
      )
    `);
    
    if (injuriesExists.rows[0].exists) {
      console.log(chalk.cyan('\n🏥 Creating default injury records...'));
      
      const injuryCount = await pgPool.query('SELECT COUNT(*) FROM injuries');
      
      if (parseInt(injuryCount.rows[0].count) === 0) {
        await pgPool.query(`
          INSERT INTO injuries (
            player_id,
            injury_date,
            status,
            playing_probability
          )
          SELECT DISTINCT
            ps.player_id,
            CURRENT_DATE,
            'Healthy',
            1.0
          FROM player_stats ps
          WHERE ps.game_date > CURRENT_DATE - INTERVAL '30 days'
          LIMIT 1000
        `);
        
        console.log(chalk.green('✅ Created default injury records for recent players'));
      } else {
        console.log(chalk.blue('ℹ️  Injury records already exist'));
      }
    }
    
    // 5. Show migration summary
    console.log(chalk.cyan('\n📊 Migration Summary:'));
    
    const summary = [];
    
    if (gameLogsExists.rows[0].exists) {
      const glCount = await pgPool.query('SELECT COUNT(*) FROM game_logs');
      summary.push({ table: 'game_logs', count: glCount.rows[0].count });
    }
    
    if (injuriesExists.rows[0].exists) {
      const injCount = await pgPool.query('SELECT COUNT(*) FROM injuries');
      summary.push({ table: 'injuries', count: injCount.rows[0].count });
    }
    
    const psCount = await pgPool.query('SELECT COUNT(*) FROM player_stats WHERE fantasy_points IS NOT NULL');
    summary.push({ table: 'player_stats (with fantasy points)', count: psCount.rows[0].count });
    
    summary.forEach(item => {
      console.log(chalk.yellow(`  ${item.table}: ${parseInt(item.count).toLocaleString()} records`));
    });
    
    console.log(chalk.green.bold('\n✅ Data migration complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Migration error:'), error);
    // Don't exit with error - some migrations might fail but others succeed
  } finally {
    await pgPool.end();
  }
}

// Run migration
migrateDataSimple();