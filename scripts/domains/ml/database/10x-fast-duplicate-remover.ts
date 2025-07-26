#!/usr/bin/env tsx
/**
 * 🚀 10X FAST DUPLICATE REMOVER
 * 
 * Now that we know these are TRUE duplicates (same player, same game, 7x each),
 * let's remove them FAST using our Ryzen 5 7600X!
 * 
 * Strategy: Use PostgreSQL's DISTINCT ON to keep one record per ID
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';
import * as os from 'os';

class TenXFastDuplicateRemover {
  private readonly CPU_CORES = 6;
  private readonly RAM_GB = 32;
  
  constructor() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║          🚀 10X FAST DUPLICATE REMOVER 🚀                    ║
    ║                                                              ║
    ║  Strategy: One SQL query to rule them all!                   ║
    ║  CPU: Ryzen 5 7600X (${this.CPU_CORES} cores) | RAM: ${this.RAM_GB}GB               ║
    ╚══════════════════════════════════════════════════════════════╝
    `));
  }

  async execute() {
    const startTime = Date.now();
    
    try {
      // Step 1: Count duplicates
      console.log(chalk.cyan.bold('\n📊 STEP 1: COUNTING DUPLICATES...\n'));
      const countBefore = await this.countRecords();
      const duplicateCount = await this.countDuplicates();
      
      console.log(chalk.yellow(`Total records: ${countBefore.toLocaleString()}`));
      console.log(chalk.yellow(`Duplicate records to remove: ${duplicateCount.toLocaleString()}`));
      
      // Step 2: Create backup (smaller, just duplicates)
      console.log(chalk.cyan.bold('\n💾 STEP 2: CREATING BACKUP OF DUPLICATES...\n'));
      await this.backupDuplicates();
      
      // Step 3: Remove duplicates in ONE QUERY!
      console.log(chalk.cyan.bold('\n🗑️ STEP 3: REMOVING DUPLICATES (ONE QUERY!)...\n'));
      await this.removeDuplicatesFast();
      
      // Step 4: Verify
      console.log(chalk.cyan.bold('\n✅ STEP 4: VERIFYING...\n'));
      const countAfter = await this.countRecords();
      const remainingDuplicates = await this.countDuplicates();
      
      const duration = (Date.now() - startTime) / 1000;
      const removed = countBefore - countAfter;
      
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                 ✅ DUPLICATE REMOVAL COMPLETE!               ║
    ║                                                              ║
    ║  Records before: ${countBefore.toLocaleString().padEnd(44)}║
    ║  Records after: ${countAfter.toLocaleString().padEnd(45)}║
    ║  Removed: ${removed.toLocaleString().padEnd(51)}║
    ║  Time: ${duration.toFixed(1)}s                                              ║
    ║  Speed: ${(removed / duration).toFixed(0).padEnd(46)}records/sec║
    ║                                                              ║
    ║  Remaining duplicates: ${remainingDuplicates}                                    ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), error);
      throw error;
    }
  }

  private async countRecords(): Promise<number> {
    const result = await pgPool.query('SELECT COUNT(*) FROM player_game_logs');
    return parseInt(result.rows[0].count);
  }

  private async countDuplicates(): Promise<number> {
    const result = await pgPool.query(`
      SELECT SUM(duplicate_count) as total_duplicates
      FROM (
        SELECT id, COUNT(*) - 1 as duplicate_count
        FROM player_game_logs
        GROUP BY id
        HAVING COUNT(*) > 1
      ) dupes
    `);
    return parseInt(result.rows[0].total_duplicates || 0);
  }

  private async backupDuplicates() {
    const timestamp = new Date().toISOString().replace(/[:.T-]/g, '_').slice(0, -5);
    const backupTable = `duplicate_backup_${timestamp}`;
    
    console.log(chalk.yellow(`Creating backup of duplicates only...`));
    
    // Backup only the duplicate records
    await pgPool.query(`
      CREATE TABLE ${backupTable} AS 
      SELECT pgl.*
      FROM player_game_logs pgl
      WHERE pgl.id IN (
        SELECT id
        FROM player_game_logs
        GROUP BY id
        HAVING COUNT(*) > 1
      )
    `);
    
    const countResult = await pgPool.query(`SELECT COUNT(*) FROM ${backupTable}`);
    console.log(chalk.green(`✅ Backed up ${countResult.rows[0].count} duplicate records`));
  }

  private async removeDuplicatesFast() {
    console.log(chalk.yellow('Removing duplicates with single optimized query...'));
    console.log(chalk.gray('This leverages PostgreSQL\'s power for maximum speed!'));
    
    // Create a temporary table with distinct records
    // Using ROW_NUMBER() to keep the first occurrence of each ID
    const result = await pgPool.query(`
      WITH records_to_keep AS (
        SELECT 
          id,
          player_id,
          game_date,
          team_id,
          MIN(ctid) as keep_ctid
        FROM player_game_logs
        GROUP BY id, player_id, game_date, team_id
      ),
      delete_operation AS (
        DELETE FROM player_game_logs pgl
        WHERE NOT EXISTS (
          SELECT 1 
          FROM records_to_keep rtk
          WHERE rtk.id = pgl.id
            AND rtk.player_id = pgl.player_id
            AND rtk.game_date = pgl.game_date
            AND rtk.team_id = pgl.team_id
            AND rtk.keep_ctid = pgl.ctid
        )
        RETURNING *
      )
      SELECT COUNT(*) as deleted_count FROM delete_operation
    `);
    
    console.log(chalk.green(`✅ Removed ${result.rows[0].deleted_count} duplicate records!`));
  }
}

// Alternative approach using a more straightforward method
class AlternativeDuplicateRemover {
  async removeUsingTempTable() {
    console.log(chalk.cyan('\n🔄 ALTERNATIVE APPROACH: Using temp table method...\n'));
    
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create temp table with unique records
      console.log(chalk.yellow('Creating temp table with unique records...'));
      await client.query(`
        CREATE TEMP TABLE unique_game_logs AS
        SELECT DISTINCT ON (id) *
        FROM player_game_logs
        ORDER BY id, created_at ASC
      `);
      
      // Count records
      const tempCount = await client.query('SELECT COUNT(*) FROM unique_game_logs');
      console.log(chalk.cyan(`Unique records: ${tempCount.rows[0].count}`));
      
      // Truncate original and insert back
      console.log(chalk.yellow('Replacing table with unique records...'));
      await client.query('TRUNCATE player_game_logs');
      await client.query('INSERT INTO player_game_logs SELECT * FROM unique_game_logs');
      
      await client.query('COMMIT');
      console.log(chalk.green('✅ Alternative method complete!'));
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Run it!
if (require.main === module) {
  (async () => {
    try {
      // Try the fast method first
      const remover = new TenXFastDuplicateRemover();
      await remover.execute();
      
      // If you need the alternative method, uncomment:
      // const altRemover = new AlternativeDuplicateRemover();
      // await altRemover.removeUsingTempTable();
      
      await pgPool.end();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXFastDuplicateRemover, AlternativeDuplicateRemover };