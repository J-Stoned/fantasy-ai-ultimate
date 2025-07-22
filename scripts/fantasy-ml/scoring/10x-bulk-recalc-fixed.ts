#!/usr/bin/env tsx
/**
 * 🚀 10X BULK FANTASY POINTS RECALCULATION - FIXED VERSION
 * 
 * NOW WITH:
 * - Proper numeric ID handling
 * - Duplicate ID handling
 * - Better position normalization
 * - Smarter batch processing
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

interface SportBatch {
  sport: string;
  records: any[];
  totalCount: number;
}

class TenXBulkRecalculatorFixed {
  private readonly CPU_CORES = 6;
  private readonly RAM_GB = 32;
  private readonly CHUNK_SIZE = 100000;
  
  // Position mappings for non-standard positions
  private readonly POSITION_MAPPINGS: { [key: string]: { [key: string]: string } } = {
    NFL: {
      'PK': 'K', // Placekicker
      'defensive': 'DST',
      'receiving': 'WR',
      'rushing': 'RB', 
      'passing': 'QB',
      'kicking': 'K',
      'punting': 'P',
      'fumbles': 'FLEX',
      'kickReturns': 'FLEX',
      'puntReturns': 'FLEX',
      'KR': 'FLEX',
      '-': 'FLEX'
    },
    MLB: {
      '1': '1B', '2': 'C', '3': '1B', '4': '2B', '5': '3B', '6': 'SS',
      '7': 'LF', '8': 'CF', '9': 'RF', '10': 'DH',
      'TWP': 'P', 'IF': 'UTIL', 'O': 'OF'
    },
    NBA: {
      'G-F': 'G', 'C-F': 'C', 'F-G': 'F', 
      'NA': 'UTIL', 'ATH': 'UTIL', 'UN': 'UTIL'
    },
    NHL: {}
  };
  
  constructor() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║           🚀 10X BULK RECALCULATION ENGINE - FIXED 🚀        ║
    ║                                                              ║
    ║  CPU: Ryzen 5 7600X (${this.CPU_CORES} cores)                              ║
    ║  RAM: ${this.RAM_GB}GB DDR5                                          ║
    ║  NOW HANDLES: Duplicate IDs, Numeric types, All positions   ║
    ╚══════════════════════════════════════════════════════════════╝
    `));
  }

  /**
   * 🏃‍♂️ RUN THE FIXED RECALCULATION
   */
  async execute() {
    const startTime = Date.now();
    
    try {
      // Step 1: Clean duplicates
      console.log(chalk.cyan.bold('\n🧹 STEP 1: CLEANING DUPLICATE IDS...\n'));
      await this.cleanDuplicateIds();
      
      // Step 2: Load data by sport
      console.log(chalk.cyan.bold('\n📥 STEP 2: LOADING DATA INTO RAM...\n'));
      const sportBatches = await this.loadAllDataIntoMemory();
      
      // Step 3: Calculate fantasy points
      console.log(chalk.cyan.bold('\n⚡ STEP 3: CALCULATING FANTASY POINTS...\n'));
      await this.calculateInParallel(sportBatches);
      
      // Step 4: Bulk update with proper handling
      console.log(chalk.cyan.bold('\n💾 STEP 4: BULK UPDATING DATABASE...\n'));
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
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ FAILED:'), error);
      throw error;
    }
  }

  /**
   * 🧹 CLEAN DUPLICATE IDS
   */
  private async cleanDuplicateIds() {
    console.log(chalk.yellow('Finding and removing duplicate IDs...'));
    
    // Keep the first occurrence of each ID
    const cleanupQuery = `
      DELETE FROM player_game_logs
      WHERE ctid NOT IN (
        SELECT MIN(ctid)
        FROM player_game_logs
        GROUP BY id
      )
    `;
    
    const result = await pgPool.query(cleanupQuery);
    console.log(chalk.green(`✅ Removed ${result.rowCount} duplicate records`));
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
          pgl.id::bigint as id,
          pgl.stats,
          p.position,
          p.sport
        FROM player_game_logs pgl
        JOIN players p ON p.id = pgl.player_id
        WHERE p.sport = $1
        AND pgl.stats IS NOT NULL
        AND pgl.stats != '{}'
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
      console.log(chalk.yellow(`\nCalculating ${batch.sport} fantasy points...`));
      const startTime = Date.now();
      
      const chunkSize = Math.ceil(batch.records.length / 10);
      let errorCount = 0;
      
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
      console.log(chalk.green(`\n  ✓ Calculated ${batch.records.length.toLocaleString()} records in ${duration.toFixed(1)}s`));
      if (errorCount > 0) {
        console.log(chalk.yellow(`  ⚠️  ${errorCount} errors during calculation`));
      }
    }
  }

  /**
   * 💾 BULK UPDATE DATABASE - FIXED VERSION
   */
  private async bulkUpdateDatabase(batches: SportBatch[]) {
    for (const batch of batches) {
      console.log(chalk.yellow(`\nUpdating ${batch.sport} in database...`));
      const startTime = Date.now();
      
      const chunkSize = 50000;
      let updated = 0;
      
      for (let i = 0; i < batch.records.length; i += chunkSize) {
        const chunk = batch.records.slice(i, i + chunkSize);
        
        // Use UNNEST for efficient bulk update
        const ids: number[] = [];
        const fantasyPoints: number[] = [];
        const dkPoints: number[] = [];
        const fdPoints: number[] = [];
        const yahooPoints: number[] = [];
        
        chunk.forEach(record => {
          ids.push(record.id);
          fantasyPoints.push(record.fantasy_points);
          dkPoints.push(record.dk_points);
          fdPoints.push(record.fd_points);
          yahooPoints.push(record.yahoo_points);
        });
        
        // Build the fantasy scores JSON
        const fantasyScores = chunk.map((_, idx) => ({
          draftkings: dkPoints[idx],
          fanduel: fdPoints[idx],
          yahoo: yahooPoints[idx]
        }));
        
        // Use a more efficient update approach
        const updateQuery = `
          UPDATE player_game_logs
          SET 
            fantasy_points = updates.fantasy_points,
            computed_metrics = COALESCE(computed_metrics::jsonb, '{}'::jsonb) || updates.fantasy_scores::jsonb,
            updated_at = CURRENT_TIMESTAMP
          FROM (
            SELECT 
              UNNEST($1::numeric[]) as id,
              UNNEST($2::numeric[]) as fantasy_points,
              UNNEST($3::jsonb[]) as fantasy_scores
          ) AS updates
          WHERE player_game_logs.id = updates.id
        `;
        
        await pgPool.query(updateQuery, [
          ids,
          fantasyPoints,
          fantasyScores.map(fs => JSON.stringify(fs))
        ]);
        
        updated += chunk.length;
        const progress = (updated / batch.records.length) * 100;
        process.stdout.write(`\r  Progress: ${progress.toFixed(0)}% (${updated.toLocaleString()} records)`);
      }
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green(`\n  ✓ Updated ${batch.records.length.toLocaleString()} records in ${duration.toFixed(1)}s`));
    }
  }
}

// RUN IT!
if (require.main === module) {
  (async () => {
    try {
      const recalculator = new TenXBulkRecalculatorFixed();
      await recalculator.execute();
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXBulkRecalculatorFixed };