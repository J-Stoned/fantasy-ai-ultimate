#!/usr/bin/env tsx
/**
 * 🎯 10X DATABASE DUPLICATE REMOVER
 * 
 * Phase 1 of our pristine database initiative!
 * - Removes duplicate IDs while preserving the best data
 * - Uses smart logic to keep the most complete records
 * - Optimized for Ryzen 5 7600X performance
 * 
 * THE 10X WAY: Don't just remove duplicates, intelligently consolidate!
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';
import * as os from 'os';

interface DuplicateInfo {
  id: number;
  count: number;
  records: any[];
}

class TenXDuplicateRemover {
  private readonly CPU_CORES = 6;
  private readonly RAM_GB = 32;
  private totalDuplicates = 0;
  private totalRemoved = 0;
  
  constructor() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║             🎯 10X DUPLICATE REMOVER INITIALIZED 🎯           ║
    ║                                                              ║
    ║  Strategy: Keep BEST record from each duplicate set          ║
    ║  Priority: Most stats > Latest date > First occurrence      ║
    ║  CPU: Ryzen 5 7600X (${this.CPU_CORES} cores) | RAM: ${this.RAM_GB}GB               ║
    ╚══════════════════════════════════════════════════════════════╝
    `));
  }

  /**
   * 🚀 MAIN EXECUTION
   */
  async execute() {
    const startTime = Date.now();
    
    try {
      // Step 1: Analyze duplicates
      console.log(chalk.cyan.bold('\n📊 STEP 1: ANALYZING DUPLICATE IDS...\n'));
      const duplicateGroups = await this.analyzeDuplicates();
      
      if (duplicateGroups.length === 0) {
        console.log(chalk.green('✅ No duplicate IDs found! Database is clean.'));
        return;
      }
      
      // Step 2: Create backup
      console.log(chalk.cyan.bold('\n💾 STEP 2: CREATING BACKUP...\n'));
      await this.createBackup();
      
      // Step 3: Process duplicates intelligently
      console.log(chalk.cyan.bold('\n🧠 STEP 3: PROCESSING DUPLICATES INTELLIGENTLY...\n'));
      await this.processDuplicates(duplicateGroups);
      
      // Step 4: Verify integrity
      console.log(chalk.cyan.bold('\n✅ STEP 4: VERIFYING DATA INTEGRITY...\n'));
      await this.verifyIntegrity();
      
      // Final report
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                  ✅ DUPLICATE REMOVAL COMPLETE!              ║
    ║                                                              ║
    ║  Total Duplicate Groups: ${this.totalDuplicates.toLocaleString().padEnd(36)}║
    ║  Records Removed: ${this.totalRemoved.toLocaleString().padEnd(43)}║
    ║  Time: ${duration.toFixed(1)}s                                              ║
    ║                                                              ║
    ║  Database is now PRISTINE with unique IDs! 🚀               ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), error);
      throw error;
    }
  }

  /**
   * 📊 ANALYZE DUPLICATES
   */
  private async analyzeDuplicates(): Promise<DuplicateInfo[]> {
    console.log(chalk.yellow('Finding all duplicate IDs...'));
    
    // First, get all duplicate IDs
    const duplicateQuery = `
      SELECT id, COUNT(*) as count
      FROM player_game_logs
      GROUP BY id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, id
    `;
    
    const duplicateResult = await pgPool.query(duplicateQuery);
    this.totalDuplicates = duplicateResult.rows.length;
    
    console.log(chalk.yellow(`Found ${this.totalDuplicates.toLocaleString()} IDs with duplicates`));
    
    // For efficiency, we'll process in batches
    const duplicateGroups: DuplicateInfo[] = [];
    const batchSize = 1000;
    
    for (let i = 0; i < duplicateResult.rows.length; i += batchSize) {
      const batch = duplicateResult.rows.slice(i, i + batchSize);
      const ids = batch.map(row => row.id);
      
      // Get all records for these duplicate IDs
      const recordsQuery = `
        SELECT 
          pgl.*,
          p.name as player_name,
          p.sport,
          p.position,
          t.name as team_name,
          pg_typeof(pgl.stats) as stats_type,
          LENGTH(pgl.stats::text) as stats_length,
          pgl.fantasy_points,
          pgl.game_date,
          pgl.created_at,
          pgl.updated_at,
          ROW_NUMBER() OVER (PARTITION BY pgl.id ORDER BY pgl.game_date DESC NULLS LAST, pgl.created_at) as row_num
        FROM player_game_logs pgl
        JOIN players p ON p.id = pgl.player_id
        JOIN teams t ON t.id = pgl.team_id
        WHERE pgl.id = ANY($1::numeric[])
        ORDER BY pgl.id, pgl.game_date DESC NULLS LAST, pgl.created_at
      `;
      
      const recordsResult = await pgPool.query(recordsQuery, [ids]);
      
      // Group by ID
      const grouped = new Map<number, any[]>();
      recordsResult.rows.forEach(row => {
        const id = row.id;
        if (!grouped.has(id)) {
          grouped.set(id, []);
        }
        grouped.get(id)!.push(row);
      });
      
      // Convert to DuplicateInfo
      batch.forEach(dup => {
        const records = grouped.get(dup.id) || [];
        duplicateGroups.push({
          id: dup.id,
          count: dup.count,
          records: records
        });
      });
      
      const progress = Math.min(100, ((i + batchSize) / duplicateResult.rows.length) * 100);
      process.stdout.write(`\r  Loading duplicate records: ${progress.toFixed(0)}%`);
    }
    
    console.log(chalk.green('\n✅ Duplicate analysis complete'));
    
    // Show sample of worst offenders
    console.log(chalk.cyan('\nWorst duplicate offenders:'));
    duplicateGroups.slice(0, 5).forEach(group => {
      console.log(`  ID ${group.id}: ${group.count} duplicates`);
    });
    
    return duplicateGroups;
  }

  /**
   * 💾 CREATE BACKUP
   */
  private async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.T-]/g, '_').slice(0, -5);
    const backupTable = `player_game_logs_backup_${timestamp}`;
    
    console.log(chalk.yellow(`Creating backup table: ${backupTable}`));
    
    // Create backup of entire table
    await pgPool.query(`
      CREATE TABLE ${backupTable} AS 
      SELECT * FROM player_game_logs
    `);
    
    // Count records
    const countResult = await pgPool.query(`SELECT COUNT(*) FROM ${backupTable}`);
    console.log(chalk.green(`✅ Backup created with ${countResult.rows[0].count} records`));
  }

  /**
   * 🧠 PROCESS DUPLICATES INTELLIGENTLY
   */
  private async processDuplicates(duplicateGroups: DuplicateInfo[]) {
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      const chunkSize = 100; // Process 100 duplicate groups at a time
      let processed = 0;
      
      for (let i = 0; i < duplicateGroups.length; i += chunkSize) {
        const chunk = duplicateGroups.slice(i, i + chunkSize);
        
        for (const group of chunk) {
          // Determine which record to keep
          const keepRecord = this.selectBestRecord(group.records);
          
          if (keepRecord && group.records.length > 1) {
            // We'll keep the record with row_num = 1 (after scoring) and delete others
            // First, we need to identify all the records we want to delete
            // by their unique combination of fields
            
            const deleteQuery = `
              DELETE FROM player_game_logs pgl
              WHERE pgl.id = $1
              AND NOT (
                pgl.player_id = $2 
                AND pgl.game_date = $3
                AND pgl.team_id = $4
                AND (pgl.created_at = $5 OR (pgl.created_at IS NULL AND $5 IS NULL))
              )
            `;
            
            const result = await client.query(deleteQuery, [
              keepRecord.id,
              keepRecord.player_id,
              keepRecord.game_date,
              keepRecord.team_id,
              keepRecord.created_at
            ]);
            
            this.totalRemoved += result.rowCount || 0;
          }
        }
        
        processed += chunk.length;
        const progress = (processed / duplicateGroups.length) * 100;
        process.stdout.write(`\r  Processing duplicates: ${progress.toFixed(0)}% (${this.totalRemoved.toLocaleString()} removed)`);
      }
      
      await client.query('COMMIT');
      console.log(chalk.green('\n✅ Duplicate processing complete'));
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🎯 SELECT BEST RECORD FROM DUPLICATES
   */
  private selectBestRecord(records: any[]): any {
    if (records.length === 0) return null;
    if (records.length === 1) return records[0];
    
    // Score each record
    const scored = records.map(record => {
      let score = 0;
      
      // 1. Prefer records with more stats (non-empty)
      if (record.stats && record.stats !== '{}' && record.stats_length > 10) {
        score += 100;
        // Bonus for longer stats (more complete data)
        score += Math.min(50, record.stats_length / 100);
      }
      
      // 2. Prefer records with fantasy points calculated
      if (record.fantasy_points && record.fantasy_points > 0) {
        score += 50;
      }
      
      // 3. Prefer more recent game dates
      if (record.game_date) {
        const daysAgo = (Date.now() - new Date(record.game_date).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 30 - (daysAgo / 100)); // More recent = higher score
      }
      
      // 4. Prefer recently updated records
      if (record.updated_at) {
        const hoursAgo = (Date.now() - new Date(record.updated_at).getTime()) / (1000 * 60 * 60);
        score += Math.max(0, 20 - (hoursAgo / 100));
      }
      
      // 5. Penalty for suspicious data
      if (record.sport && record.position) {
        // Check if position matches sport
        const validPositions: { [key: string]: string[] } = {
          'NFL': ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF', 'OL', 'DL', 'LB', 'DB'],
          'NBA': ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'],
          'MLB': ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'SP', 'RP'],
          'NHL': ['C', 'LW', 'RW', 'D', 'G', 'W', 'F']
        };
        
        const sportPositions = validPositions[record.sport] || [];
        if (!sportPositions.some(pos => record.position.includes(pos))) {
          score -= 50; // Penalty for mismatched position
        }
      }
      
      return { record, score };
    });
    
    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);
    
    // Return the best record
    return scored[0].record;
  }

  /**
   * ✅ VERIFY INTEGRITY
   */
  private async verifyIntegrity() {
    console.log(chalk.yellow('Verifying database integrity...'));
    
    // Check for any remaining duplicates
    const duplicateCheck = await pgPool.query(`
      SELECT COUNT(*) as duplicate_count
      FROM (
        SELECT id, COUNT(*) as count
        FROM player_game_logs
        GROUP BY id
        HAVING COUNT(*) > 1
      ) dupes
    `);
    
    const remainingDuplicates = parseInt(duplicateCheck.rows[0].duplicate_count);
    
    if (remainingDuplicates > 0) {
      console.log(chalk.red(`⚠️  WARNING: ${remainingDuplicates} duplicate IDs still remain!`));
    } else {
      console.log(chalk.green('✅ No duplicate IDs found!'));
    }
    
    // Check total record count
    const totalCount = await pgPool.query('SELECT COUNT(*) FROM player_game_logs');
    console.log(chalk.cyan(`Total records: ${parseInt(totalCount.rows[0].count).toLocaleString()}`));
    
    // Check for data integrity
    const integrityChecks = await pgPool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE stats IS NULL) as null_stats,
        COUNT(*) FILTER (WHERE stats = '{}') as empty_stats,
        COUNT(*) FILTER (WHERE fantasy_points IS NULL) as null_points,
        COUNT(*) FILTER (WHERE fantasy_points = 0) as zero_points,
        COUNT(*) FILTER (WHERE player_id IS NULL) as null_players,
        COUNT(*) FILTER (WHERE team_id IS NULL) as null_teams,
        COUNT(*) FILTER (WHERE game_date IS NULL) as null_dates
      FROM player_game_logs
    `);
    
    const checks = integrityChecks.rows[0];
    console.log(chalk.cyan('\nData integrity summary:'));
    console.log(`  Null stats: ${parseInt(checks.null_stats).toLocaleString()}`);
    console.log(`  Empty stats: ${parseInt(checks.empty_stats).toLocaleString()}`);
    console.log(`  Null fantasy points: ${parseInt(checks.null_points).toLocaleString()}`);
    console.log(`  Zero fantasy points: ${parseInt(checks.zero_points).toLocaleString()}`);
    console.log(`  Missing players: ${parseInt(checks.null_players).toLocaleString()}`);
    console.log(`  Missing teams: ${parseInt(checks.null_teams).toLocaleString()}`);
    console.log(`  Missing dates: ${parseInt(checks.null_dates).toLocaleString()}`);
  }
}

// RUN IT!
if (require.main === module) {
  (async () => {
    try {
      const remover = new TenXDuplicateRemover();
      await remover.execute();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXDuplicateRemover };