#!/usr/bin/env tsx
/**
 * 🚀 10X BULK FANTASY POINTS RECALCULATION - CLEAN DATABASE VERSION
 * 
 * This version assumes the database is already clean (duplicates removed)
 * Optimized for maximum speed on your Ryzen 5 7600X!
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

interface SportBatch {
  sport: string;
  records: any[];
  totalCount: number;
}

class TenXBulkRecalculatorClean {
  private readonly CPU_CORES = 6;
  private readonly RAM_GB = 32;
  
  // Position mappings for non-standard positions
  private readonly POSITION_MAPPINGS: { [key: string]: { [key: string]: string } } = {
    NFL: {
      'PK': 'K', 'defensive': 'DST', 'receiving': 'WR', 'rushing': 'RB', 
      'passing': 'QB', 'kicking': 'K', 'punting': 'K', 'fumbles': 'FLEX',
      'kickReturns': 'FLEX', 'puntReturns': 'FLEX', 'KR': 'FLEX', 'PR': 'FLEX',
      '-': 'FLEX', 'FLEX': 'FLEX'  // Keep FLEX as FLEX
    },
    MLB: {
      '1': '1B', '2': 'C', '3': '1B', '4': '2B', '5': '3B', '6': 'SS',
      '7': 'LF', '8': 'CF', '9': 'RF', '10': 'DH',
      'TWP': 'P', 'IF': 'UTIL', 'O': 'OF', 'UTIL': 'UTIL'
    },
    NBA: {
      'G-F': 'G', 'C-F': 'C', 'F-G': 'F', 
      'NA': 'UTIL', 'ATH': 'UTIL', 'UN': 'UTIL', 'UTIL': 'UTIL'
    },
    NHL: {
      'UTIL': 'UTIL'
    }
  };
  
  constructor() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║         🚀 10X BULK RECALCULATION - CLEAN VERSION 🚀         ║
    ║                                                              ║
    ║  CPU: Ryzen 5 7600X (${this.CPU_CORES} cores)                              ║
    ║  RAM: ${this.RAM_GB}GB DDR5                                          ║
    ║  Database: Already cleaned and pristine! ✨                  ║
    ╚══════════════════════════════════════════════════════════════╝
    `));
  }

  async execute() {
    const startTime = Date.now();
    
    try {
      // Step 1: Load data by sport  
      console.log(chalk.cyan.bold('\n📥 STEP 1: LOADING CLEAN DATA INTO RAM...\n'));
      const sportBatches = await this.loadAllDataIntoMemory();
      
      // Step 2: Calculate fantasy points
      console.log(chalk.cyan.bold('\n⚡ STEP 2: CALCULATING FANTASY POINTS...\n'));
      await this.calculateInParallel(sportBatches);
      
      // Step 3: Bulk update with proper handling
      console.log(chalk.cyan.bold('\n💾 STEP 3: BULK UPDATING DATABASE...\n'));
      await this.bulkUpdateDatabase(sportBatches);
      
      // Final stats
      const duration = (Date.now() - startTime) / 1000;
      const totalRecords = sportBatches.reduce((sum, batch) => sum + batch.totalCount, 0);
      
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                   ✅ RECALCULATION COMPLETE!                 ║
    ║                                                              ║
    ║  Total Records: ${totalRecords.toLocaleString().padEnd(44)}║
    ║  Time: ${(duration / 60).toFixed(1)} minutes                                       ║
    ║  Speed: ${(totalRecords / duration).toFixed(0).padEnd(43)}records/sec║
    ║                                                              ║
    ║  🎯 Fantasy points calculated for ALL records! 🎯            ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ FAILED:'), error);
      throw error;
    }
  }

  /**
   * 📥 LOAD ALL DATA INTO MEMORY
   */
  private async loadAllDataIntoMemory(): Promise<SportBatch[]> {
    const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
    const batches: SportBatch[] = [];
    
    for (const sport of sports) {
      console.log(chalk.yellow(`Loading ${sport} data...`));
      
      const query = `
        SELECT 
          pgl.id,
          pgl.stats,
          p.position,
          p.sport
        FROM player_game_logs pgl
        JOIN players p ON p.id = pgl.player_id
        WHERE p.sport = $1
        AND pgl.stats IS NOT NULL
        AND pgl.stats != '{}'
        AND pgl.stats != ''
      `;
      
      const result = await pgPool.query(query, [sport]);
      
      console.log(chalk.green(`  ✓ Loaded ${result.rows.length.toLocaleString()} ${sport} records`));
      
      batches.push({
        sport,
        records: result.rows,
        totalCount: result.rows.length
      });
    }
    
    const totalMemoryMB = batches.reduce((sum, batch) => {
      const size = JSON.stringify(batch.records).length / 1024 / 1024;
      return sum + size;
    }, 0);
    
    console.log(chalk.blue(`\n📊 Total memory usage: ${totalMemoryMB.toFixed(0)}MB of ${this.RAM_GB * 1024}MB available`));
    
    return batches;
  }

  /**
   * 🔧 NORMALIZE POSITION
   */
  private normalizePosition(position: string, sport: string): string {
    if (!position) return sport === 'NFL' ? 'FLEX' : 'UTIL';
    
    const mappings = this.POSITION_MAPPINGS[sport];
    if (mappings && mappings[position]) {
      return mappings[position];
    }
    return position;
  }

  /**
   * ⚡ CALCULATE FANTASY POINTS IN PARALLEL
   */
  private async calculateInParallel(batches: SportBatch[]) {
    const { createUniversalScoringEngine } = await import('./universal-fantasy-scoring-engine');
    const engine = createUniversalScoringEngine();
    
    for (const batch of batches) {
      if (batch.records.length === 0) {
        console.log(chalk.gray(`\nSkipping ${batch.sport} - no records`));
        continue;
      }
      
      console.log(chalk.yellow(`\nCalculating ${batch.sport} fantasy points...`));
      const startTime = Date.now();
      
      const chunkSize = Math.ceil(batch.records.length / 10);
      let errorCount = 0;
      let calculatedCount = 0;
      
      for (let i = 0; i < batch.records.length; i += chunkSize) {
        const chunk = batch.records.slice(i, i + chunkSize);
        
        chunk.forEach(record => {
          try {
            const stats = typeof record.stats === 'string' ? JSON.parse(record.stats) : record.stats;
            const normalizedPosition = this.normalizePosition(record.position, batch.sport);
            
            // Calculate for all platforms
            record.dk_points = engine.calculateFantasyPoints(stats, batch.sport as any, normalizedPosition, 'draftkings');
            record.fd_points = engine.calculateFantasyPoints(stats, batch.sport as any, normalizedPosition, 'fanduel');
            record.yahoo_points = engine.calculateFantasyPoints(stats, batch.sport as any, normalizedPosition, 'yahoo');
            
            // Store the primary (DK) score
            record.fantasy_points = record.dk_points;
            calculatedCount++;
          } catch (error) {
            errorCount++;
            if (errorCount < 10) {
              console.error(chalk.red(`Error calculating for ID ${record.id}:`), error);
            }
            // Default to 0 on error
            record.dk_points = 0;
            record.fd_points = 0;
            record.yahoo_points = 0;
            record.fantasy_points = 0;
          }
        });
        
        const progress = Math.min(100, ((i + chunkSize) / batch.records.length) * 100);
        process.stdout.write(`\r  Progress: ${progress.toFixed(0)}%`);
      }
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green(`\n  ✓ Calculated ${calculatedCount.toLocaleString()} records in ${duration.toFixed(1)}s`));
      if (errorCount > 0) {
        console.log(chalk.yellow(`  ⚠️  ${errorCount} errors during calculation`));
      }
    }
  }

  /**
   * 💾 BULK UPDATE DATABASE - EFFICIENT VERSION
   */
  private async bulkUpdateDatabase(batches: SportBatch[]) {
    for (const batch of batches) {
      if (batch.records.length === 0) {
        console.log(chalk.gray(`\nSkipping ${batch.sport} database update - no records`));
        continue;
      }
      
      console.log(chalk.yellow(`\nUpdating ${batch.sport} in database...`));
      const startTime = Date.now();
      
      const batchSize = 5000; // Smaller batches for stability
      let updated = 0;
      
      for (let i = 0; i < batch.records.length; i += batchSize) {
        const chunk = batch.records.slice(i, i + batchSize);
        
        // Build the fantasy scores
        const values = chunk.map((record, idx) => {
          const id = record.id;
          const fantasyPoints = record.fantasy_points || 0;
          const fantasyScores = JSON.stringify({
            draftkings: record.dk_points || 0,
            fanduel: record.fd_points || 0,
            yahoo: record.yahoo_points || 0
          });
          
          return `(${id}, ${fantasyPoints}, '${fantasyScores}'::jsonb)`;
        }).join(',');
        
        // Use a temporary table approach for efficiency
        const tempTable = `temp_fantasy_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          // Create temporary table
          await pgPool.query(`
            CREATE TEMP TABLE ${tempTable} (
              id numeric,
              fantasy_points numeric,
              fantasy_scores jsonb
            )
          `);
          
          // Insert data
          await pgPool.query(`
            INSERT INTO ${tempTable} (id, fantasy_points, fantasy_scores)
            VALUES ${values}
          `);
          
          // Update main table
          const result = await pgPool.query(`
            UPDATE player_game_logs pgl
            SET 
              fantasy_points = t.fantasy_points,
              computed_metrics = COALESCE(computed_metrics::jsonb, '{}'::jsonb) || 
                                jsonb_build_object('fantasy_scores', t.fantasy_scores),
              updated_at = CURRENT_TIMESTAMP
            FROM ${tempTable} t
            WHERE pgl.id = t.id
          `);
          
          updated += result.rowCount || 0;
          
        } finally {
          // Clean up temp table
          try {
            await pgPool.query(`DROP TABLE IF EXISTS ${tempTable}`);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        const progress = (updated / batch.records.length) * 100;
        process.stdout.write(`\r  Progress: ${progress.toFixed(0)}% (${updated.toLocaleString()} records)`);
      }
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green(`\n  ✓ Updated ${updated.toLocaleString()} records in ${duration.toFixed(1)}s`));
    }
  }
}

// RUN IT!
if (require.main === module) {
  (async () => {
    try {
      const recalculator = new TenXBulkRecalculatorClean();
      await recalculator.execute();
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXBulkRecalculatorClean };