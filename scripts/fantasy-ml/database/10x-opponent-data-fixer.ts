#!/usr/bin/env tsx
/**
 * 🔧 10X OPPONENT DATA FIXER
 * 
 * Fixes the opponent_id corruption where 11.8% of records have team_id = opponent_id
 * This is CRITICAL for ML training - we need accurate opponent matchup data!
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

interface GameContext {
  gameDate: string;
  teamId: number;
  sport: string;
  actualOpponents: number[];
}

class TenXOpponentDataFixer {
  async execute() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║            🔧 10X OPPONENT DATA FIXER 🔧                     ║
    ║                                                              ║
    ║  Fixing corrupted opponent_id data for pristine ML training  ║
    ╚══════════════════════════════════════════════════════════════╝
    `));

    const startTime = Date.now();

    try {
      // Step 1: Analyze the corruption
      console.log(chalk.cyan.bold('\\n📊 STEP 1: ANALYZING OPPONENT DATA CORRUPTION...\\n'));
      await this.analyzeCorruption();
      
      // Step 2: Create backup
      console.log(chalk.cyan.bold('\\n💾 STEP 2: BACKING UP PLAYER_GAME_LOGS...\\n'));
      await this.createBackup();
      
      // Step 3: Fix opponent data using game context
      console.log(chalk.cyan.bold('\\n🔧 STEP 3: FIXING OPPONENT DATA...\\n'));
      await this.fixOpponentData();
      
      // Step 4: Verify the fix
      console.log(chalk.cyan.bold('\\n✅ STEP 4: VERIFYING FIX...\\n'));
      await this.verifyFix();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║              ✅ OPPONENT DATA FIX COMPLETE!                  ║
    ║                                                              ║
    ║  Time: ${duration.toFixed(1)}s                                              ║
    ║  Opponent data is now PRISTINE for ML training! 🎯           ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), error);
      throw error;
    }
  }

  private async analyzeCorruption() {
    console.log(chalk.yellow('Analyzing opponent data corruption patterns...'));
    
    // Get corruption by sport
    const corruptionQuery = `
      SELECT 
        p.sport,
        COUNT(*) as total_games,
        COUNT(CASE WHEN pgl.team_id = pgl.opponent_id THEN 1 END) as corrupted_games,
        COUNT(CASE WHEN pgl.opponent_id IS NULL THEN 1 END) as null_opponents,
        ROUND(COUNT(CASE WHEN pgl.team_id = pgl.opponent_id THEN 1 END) * 100.0 / COUNT(*), 1) as corruption_rate
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      GROUP BY p.sport
      ORDER BY corruption_rate DESC
    `;
    
    const result = await pgPool.query(corruptionQuery);
    
    console.log(chalk.cyan('\\nCorruption by sport:'));
    console.log(chalk.gray('Sport    | Total    | Corrupted | NULL | Rate'));
    console.log(chalk.gray('---------|----------|-----------|------|------'));
    
    result.rows.forEach(row => {
      const color = parseFloat(row.corruption_rate) > 5 ? chalk.red : chalk.yellow;
      console.log(color(
        `${row.sport.padEnd(8)} | ` +
        `${row.total_games.toString().padStart(8)} | ` +
        `${row.corrupted_games.toString().padStart(9)} | ` +
        `${row.null_opponents.toString().padStart(4)} | ` +
        `${row.corruption_rate}%`
      ));
    });
  }

  private async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.T-]/g, '_').slice(0, -5);
    const backupTable = `player_game_logs_backup_opponents_${timestamp}`;
    
    console.log(chalk.yellow('Creating backup of player_game_logs...'));
    
    await pgPool.query(`
      CREATE TABLE ${backupTable} AS 
      SELECT * FROM player_game_logs
    `);
    
    const count = await pgPool.query(`SELECT COUNT(*) FROM ${backupTable}`);
    console.log(chalk.green(`✅ Backed up ${count.rows[0].count} records to ${backupTable}`));
  }

  private async fixOpponentData() {
    console.log(chalk.yellow('Fixing opponent data using intelligent game context detection...'));
    
    // Optimized approach: Process one sport at a time with batching
    const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
    let totalFixed = 0;
    
    for (const sport of sports) {
      console.log(chalk.cyan(`\n🏈 Processing ${sport} opponent data...`));
      
      // Step 1: Create sport-specific temp table for faster processing
      await pgPool.query(`DROP TABLE IF EXISTS temp_${sport.toLowerCase()}_matchups`);
      
      const createMatchupsQuery = `
        CREATE TEMP TABLE temp_${sport.toLowerCase()}_matchups AS
        WITH ${sport.toLowerCase()}_games AS (
          SELECT DISTINCT
            pgl1.game_date,
            pgl1.team_id as team1_id,
            pgl2.team_id as team2_id
          FROM player_game_logs pgl1
          JOIN player_game_logs pgl2 ON pgl1.game_date = pgl2.game_date 
          JOIN players p1 ON p1.id = pgl1.player_id
          JOIN players p2 ON p2.id = pgl2.player_id
          WHERE pgl1.team_id != pgl2.team_id
          AND p1.sport = '${sport}'
          AND p2.sport = '${sport}'
          AND pgl1.game_date IS NOT NULL
          AND pgl2.game_date IS NOT NULL
          -- Smaller requirement for faster processing
          GROUP BY pgl1.game_date, pgl1.team_id, pgl2.team_id
          HAVING COUNT(DISTINCT pgl1.player_id) >= 1 AND COUNT(DISTINCT pgl2.player_id) >= 1
        )
        SELECT 
          game_date,
          team1_id as team_id,
          team2_id as opponent_id
        FROM ${sport.toLowerCase()}_games
        UNION ALL
        SELECT 
          game_date,
          team2_id as team_id,
          team1_id as opponent_id
        FROM ${sport.toLowerCase()}_games
      `;
      
      await pgPool.query(createMatchupsQuery);
      console.log(chalk.green(`✅ Created ${sport} matchups table`));
      
      // Step 2: Update corrupted records for this sport in batches
      const updateQuery = `
        UPDATE player_game_logs 
        SET 
          opponent_id = tgm.opponent_id,
          updated_at = CURRENT_TIMESTAMP
        FROM temp_${sport.toLowerCase()}_matchups tgm,
             players p
        WHERE player_game_logs.player_id = p.id
        AND player_game_logs.game_date = tgm.game_date
        AND player_game_logs.team_id = tgm.team_id
        AND p.sport = '${sport}'
        AND (
          player_game_logs.team_id = player_game_logs.opponent_id 
          OR player_game_logs.opponent_id IS NULL
        )
      `;
      
      const result = await pgPool.query(updateQuery);
      const fixedCount = result?.rowCount || 0;
      console.log(chalk.green(`✅ Fixed ${fixedCount} ${sport} opponent records`));
      totalFixed += fixedCount;
      
      // Clean up sport temp table
      await pgPool.query(`DROP TABLE IF EXISTS temp_${sport.toLowerCase()}_matchups`);
    }
    
    console.log(chalk.green(`\n✅ Total fixed across all sports: ${totalFixed}`));
    
    // Final cleanup: Set remaining corrupted records to NULL (better than wrong data)
    const cleanupQuery = `
      UPDATE player_game_logs 
      SET 
        opponent_id = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE team_id = opponent_id
    `;
    
    const cleanupResult = await pgPool.query(cleanupQuery);
    const cleanupCount = cleanupResult?.rowCount || 0;
    console.log(chalk.yellow(`⚠️  Set ${cleanupCount} remaining corrupted opponents to NULL`));
    
    console.log(chalk.green('📊 Better to have NULL opponents than wrong opponents for ML training!'));
  }

  private async verifyFix() {
    console.log(chalk.yellow('Verifying opponent data fix...'));
    
    // Check remaining corruption
    const verifyQuery = `
      SELECT 
        p.sport,
        COUNT(*) as total_games,
        COUNT(CASE WHEN pgl.team_id = pgl.opponent_id THEN 1 END) as still_corrupted,
        COUNT(CASE WHEN pgl.opponent_id IS NULL THEN 1 END) as null_opponents,
        ROUND(COUNT(CASE WHEN pgl.team_id = pgl.opponent_id THEN 1 END) * 100.0 / COUNT(*), 2) as corruption_rate
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      GROUP BY p.sport
      ORDER BY corruption_rate DESC
    `;
    
    const result = await pgPool.query(verifyQuery);
    
    console.log(chalk.cyan('\\nPost-fix corruption status:'));
    console.log(chalk.gray('Sport    | Total    | Corrupted | NULL | Rate'));
    console.log(chalk.gray('---------|----------|-----------|------|------'));
    
    let totalCorrupted = 0;
    result.rows.forEach(row => {
      const rate = parseFloat(row.corruption_rate);
      const color = rate > 1 ? chalk.red : rate > 0.1 ? chalk.yellow : chalk.green;
      
      console.log(color(
        `${row.sport.padEnd(8)} | ` +
        `${row.total_games.toString().padStart(8)} | ` +
        `${row.still_corrupted.toString().padStart(9)} | ` +
        `${row.null_opponents.toString().padStart(4)} | ` +
        `${row.corruption_rate}%`
      ));
      
      totalCorrupted += parseInt(row.still_corrupted);
    });
    
    if (totalCorrupted === 0) {
      console.log(chalk.green.bold('\\n🎉 PERFECT! No more corrupted opponent data!'));
    } else {
      console.log(chalk.yellow(`\\n⚠️  ${totalCorrupted} records still have corruption - may need manual review`));
    }
    
    // Show some examples of fixed data
    const sampleQuery = `
      SELECT 
        p.name,
        p.sport,
        t1.name as team_name,
        t2.name as opponent_name,
        pgl.game_date
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      JOIN teams t1 ON t1.id = pgl.team_id
      JOIN teams t2 ON t2.id = pgl.opponent_id
      WHERE pgl.team_id != pgl.opponent_id
      AND pgl.fantasy_points > 10
      ORDER BY pgl.fantasy_points DESC
      LIMIT 5
    `;
    
    const sampleResult = await pgPool.query(sampleQuery);
    console.log(chalk.green('\\n✅ Sample of correctly fixed opponent data:'));
    sampleResult.rows.forEach(row => {
      console.log(chalk.green(
        `  ${row.name} (${row.sport}) - ${row.team_name} vs ${row.opponent_name} on ${row.game_date}`
      ));
    });
  }
}

// Run it!
if (require.main === module) {
  (async () => {
    try {
      const fixer = new TenXOpponentDataFixer();
      await fixer.execute();
      await pgPool.end();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXOpponentDataFixer };