#!/usr/bin/env tsx
/**
 * 🔥 STANDARDIZE GAME STATUS VALUES
 * 
 * Fix the mess of having 'scheduled', 'completed', 'STATUS_FINAL' all meaning finished games
 * Standardize everything to 'Final'
 */

import { queryMany, queryOne, getPool } from '../utils/local-db-pool.js';
import chalk from 'chalk';

async function standardizeGameStatus() {
  console.log(chalk.red('🔥 STANDARDIZING GAME STATUS VALUES\n'));
  
  const pool = getPool();
  
  try {
    // First, show current status
    console.log(chalk.yellow('📊 CURRENT STATUS VALUES:'));
    const currentStatus = await queryMany(`
      SELECT status, COUNT(*) as count
      FROM games
      WHERE status IN ('scheduled', 'completed', 'STATUS_FINAL', 'Final')
      GROUP BY status
      ORDER BY count DESC
    `);
    
    currentStatus.forEach(row => {
      console.log(chalk.gray(`  ${row.status}: ${row.count} games`));
    });
    
    // Check if these "scheduled" games are actually finished
    console.log(chalk.yellow('\n🔍 CHECKING "SCHEDULED" GAMES:'));
    const scheduledWithScores = await queryOne(`
      SELECT COUNT(*) as count
      FROM games
      WHERE status = 'scheduled'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        AND home_score > 0
    `);
    
    console.log(chalk.cyan(`  Scheduled games with scores: ${scheduledWithScores.count}`));
    
    // Begin transaction
    console.log(chalk.yellow('\n🚀 STARTING STATUS STANDARDIZATION:'));
    
    await pool.query('BEGIN');
    
    try {
      // 1. Update 'scheduled' games that have scores to 'Final'
      console.log(chalk.gray('\n1. Updating finished games marked as "scheduled"...'));
      const result1 = await pool.query(`
        UPDATE games 
        SET status = 'Final'
        WHERE status = 'scheduled'
          AND home_score IS NOT NULL
          AND away_score IS NOT NULL
          AND (home_score > 0 OR away_score > 0)
      `);
      console.log(chalk.green(`  ✅ Updated ${result1.rowCount} games from 'scheduled' to 'Final'`));
      
      // 2. Update 'completed' to 'Final'
      console.log(chalk.gray('\n2. Updating "completed" to "Final"...'));
      const result2 = await pool.query(`
        UPDATE games 
        SET status = 'Final'
        WHERE status = 'completed'
      `);
      console.log(chalk.green(`  ✅ Updated ${result2.rowCount} games from 'completed' to 'Final'`));
      
      // 3. Update 'STATUS_FINAL' to 'Final'
      console.log(chalk.gray('\n3. Updating "STATUS_FINAL" to "Final"...'));
      const result3 = await pool.query(`
        UPDATE games 
        SET status = 'Final'
        WHERE status = 'STATUS_FINAL'
      `);
      console.log(chalk.green(`  ✅ Updated ${result3.rowCount} games from 'STATUS_FINAL' to 'Final'`));
      
      // 4. Keep truly scheduled games (no scores)
      console.log(chalk.gray('\n4. Keeping truly scheduled games...'));
      const scheduledCount = await queryOne(`
        SELECT COUNT(*) as count
        FROM games
        WHERE status = 'scheduled'
          AND (home_score IS NULL OR away_score IS NULL OR (home_score = 0 AND away_score = 0))
      `);
      console.log(chalk.yellow(`  ⚠️  Keeping ${scheduledCount.count} games as 'scheduled' (no scores)`));
      
      // Commit transaction
      await pool.query('COMMIT');
      console.log(chalk.green('\n✅ TRANSACTION COMMITTED SUCCESSFULLY!'));
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    
    // Show final status
    console.log(chalk.yellow('\n📊 FINAL STATUS VALUES:'));
    const finalStatus = await queryMany(`
      SELECT status, COUNT(*) as count
      FROM games
      GROUP BY status
      ORDER BY count DESC
    `);
    
    finalStatus.forEach(row => {
      console.log(chalk.green(`  ${row.status}: ${row.count} games`));
    });
    
    // Verify 2021 games
    console.log(chalk.yellow('\n✅ 2021 GAMES NOW AVAILABLE:'));
    const verify2021 = await queryMany(`
      SELECT sport, COUNT(*) as count
      FROM games
      WHERE status = 'Final'
        AND start_time >= '2021-01-01'
        AND start_time < '2022-01-01'
      GROUP BY sport
      ORDER BY sport
    `);
    
    verify2021.forEach(row => {
      console.log(chalk.green(`  ${row.sport}: ${row.count} games`));
    });
    
    console.log(chalk.cyan('\n🎯 DATABASE STANDARDIZED! Now we can properly extract 2021 data!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  }
}

standardizeGameStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });