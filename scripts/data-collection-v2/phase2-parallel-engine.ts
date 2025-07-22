#!/usr/bin/env tsx
/**
 * 🚀 PHASE 2: PARALLEL DATA COLLECTION ENGINE
 * 
 * Uses all 6 cores + hyperthreading for maximum speed
 * Smart pagination to bypass 1K query limits
 */

import { Worker } from 'worker_threads';
import * as os from 'os';
import chalk from 'chalk';
import pLimit from 'p-limit';
import pgPool from './pg-config';

// BEAST MODE CONFIGURATION
const CPU_COUNT = os.cpus().length; // 12 threads (6 cores + HT)
const WORKER_POOL_SIZE = 12; // ALL THREADS!
const CONCURRENT_API_CALLS = 200; // BEAST MODE API concurrency
const BATCH_SIZE = 10000; // MEGA BATCHES - 10K records at once

export class ParallelCollectionEngine {
  private workers: Worker[] = [];
  private apiLimit = pLimit(CONCURRENT_API_CALLS);
  private dbLimit = pLimit(20); // BEAST MODE DB connection pool
  
  constructor() {
    console.log(chalk.cyan.bold(`\n🔥 BEAST MODE COLLECTION ENGINE 🔥`));
    console.log(chalk.yellow(`  CPU: ${CPU_COUNT} threads available`));
    console.log(chalk.yellow(`  Workers: ${WORKER_POOL_SIZE} parallel workers`));
    console.log(chalk.yellow(`  API Concurrency: ${CONCURRENT_API_CALLS} calls`));
    console.log(chalk.yellow(`  Batch Size: ${BATCH_SIZE.toLocaleString()} records\n`));
  }
  
  /**
   * Smart pagination that processes 5K+ records in parallel
   */
  async *parallelPaginate<T>(
    query: string, 
    params: any[] = [],
    options: { batchSize?: number } = {}
  ): AsyncGenerator<T[], void, unknown> {
    const batchSize = options.batchSize || BATCH_SIZE;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      // Fetch batch
      const result = await this.dbLimit(async () => {
        return pgPool.query(`${query} LIMIT ${batchSize} OFFSET ${offset}`, params);
      });
      
      if (result.rows.length === 0) {
        hasMore = false;
      } else {
        yield result.rows;
        offset += batchSize;
        
        // Show progress
        if (offset % (batchSize * 10) === 0) {
          console.log(chalk.gray(`  Processed ${offset.toLocaleString()} records...`));
        }
      }
    }
  }
  
  /**
   * Process data in parallel chunks
   */
  async processInParallel<T, R>(
    data: T[],
    processor: (item: T) => Promise<R>,
    options: { concurrency?: number, showProgress?: boolean } = {}
  ): Promise<R[]> {
    const concurrency = options.concurrency || CONCURRENT_API_CALLS;
    const limit = pLimit(concurrency);
    const startTime = Date.now();
    
    if (options.showProgress) {
      console.log(chalk.yellow(`  Processing ${data.length.toLocaleString()} items with ${concurrency} workers...`));
    }
    
    const results = await Promise.all(
      data.map((item, index) => 
        limit(async () => {
          try {
            const result = await processor(item);
            
            // Progress indicator
            if (options.showProgress && (index + 1) % 100 === 0) {
              const progress = ((index + 1) / data.length * 100).toFixed(1);
              process.stdout.write(`\r  Progress: ${progress}% (${index + 1}/${data.length})`);
            }
            
            return result;
          } catch (error) {
            console.error(chalk.red(`\n  Error processing item ${index}:`), error);
            return null;
          }
        })
      )
    );
    
    if (options.showProgress) {
      const duration = Date.now() - startTime;
      const rate = Math.round(data.length / (duration / 1000));
      console.log(chalk.green(`\n  ✓ Completed in ${(duration/1000).toFixed(1)}s (${rate} items/sec)`));
    }
    
    return results.filter(r => r !== null) as R[];
  }
  
  /**
   * Bulk insert with parallel batching and deduplication
   */
  async bulkInsert(
    table: string,
    data: any[],
    options: { 
      conflictTarget?: string,
      updateColumns?: string[],
      batchSize?: number 
    } = {}
  ): Promise<void> {
    // DEDUPLICATE DATA FIRST!
    const uniqueData = this.deduplicateData(data, options.conflictTarget);
    
    if (uniqueData.length === 0) {
      return;
    }
    
    const batchSize = options.batchSize || 10000; // BEAST MODE mega batches
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < uniqueData.length; i += batchSize) {
      batches.push(uniqueData.slice(i, i + batchSize));
    }
    
    console.log(chalk.yellow(`  Inserting ${uniqueData.length.toLocaleString()} records into ${table} (${batches.length} batches)...`));
    
    // Process batches in parallel
    await this.processInParallel(
      batches,
      async (batch) => {
        const columns = Object.keys(batch[0]);
        const values = batch.map((row, i) => 
          columns.map((col, j) => `$${i * columns.length + j + 1}`).join(', ')
        ).join('), (');
        
        const flatValues = batch.flatMap(row => columns.map(col => row[col]));
        
        let query = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES (${values})
        `;
        
        if (options.conflictTarget) {
          if (options.updateColumns && options.updateColumns.length > 0) {
            const updates = options.updateColumns.map(col => 
              `${col} = EXCLUDED.${col}`
            ).join(', ');
            query += ` ON CONFLICT (${options.conflictTarget}) DO UPDATE SET ${updates}`;
          } else {
            query += ` ON CONFLICT (${options.conflictTarget}) DO NOTHING`;
          }
        }
        
        const result = await pgPool.query(query, flatValues);
        console.log(chalk.blue(`    Query result: rowCount=${result.rowCount}, command=${result.command}`));
      },
      { concurrency: 6 } // Use all DB connections
    );
    
    console.log(chalk.green(`  ✓ Inserted ${uniqueData.length.toLocaleString()} records into ${table} (${data.length - uniqueData.length} duplicates removed)`));
  }
  
  /**
   * Deduplicate data before insertion
   */
  private deduplicateData(data: any[], conflictKey?: string): any[] {
    if (!conflictKey || data.length === 0) {
      return data;
    }
    
    const seen = new Set<string>();
    const unique: any[] = [];
    
    // Handle composite keys (e.g., "game_id, player_id")
    const keyColumns = conflictKey.split(',').map(k => k.trim());
    
    for (const item of data) {
      // Build composite key
      const keyValues = keyColumns.map(col => item[col]).filter(v => v !== undefined);
      
      if (keyValues.length === keyColumns.length) {
        const compositeKey = keyValues.join('_');
        if (!seen.has(compositeKey)) {
          seen.add(compositeKey);
          unique.push(item);
        }
      }
    }
    
    return unique;
  }
  
  /**
   * API call with rate limiting and retries
   */
  async apiCall<T>(
    apiFunction: () => Promise<T>,
    options: { retries?: number, delay?: number } = {}
  ): Promise<T | null> {
    const maxRetries = options.retries || 3;
    const delay = options.delay || 1000;
    
    return this.apiLimit(async () => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await apiFunction();
        } catch (error: any) {
          if (attempt === maxRetries) {
            console.error(chalk.red(`  API call failed after ${maxRetries} attempts:`, error.message));
            return null;
          }
          
          // Exponential backoff
          const waitTime = delay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      return null;
    });
  }
  
  /**
   * Create collection tasks that run in parallel
   */
  createCollectionTasks() {
    return {
      // Professional Sports
      nfl: {
        seasons: [2020, 2021, 2022, 2023, 2024, 2025],
        apis: ['espn', 'yahoo', 'cbs', 'sleeper'],
        priority: 1
      },
      nba: {
        seasons: [2020, 2021, 2022, 2023, 2024, 2025],
        apis: ['espn', 'yahoo', 'cbs', 'sleeper'],
        priority: 1
      },
      mlb: {
        seasons: [2020, 2021, 2022, 2023, 2024, 2025],
        apis: ['mlb', 'espn', 'yahoo', 'cbs'],
        priority: 1
      },
      nhl: {
        seasons: [2020, 2021, 2022, 2023, 2024, 2025],
        apis: ['espn', 'yahoo', 'cbs'],
        priority: 1
      },
      
      // Minor League Baseball
      milb: {
        levels: ['AAA', 'AA', 'A+', 'A'],
        seasons: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
        apis: ['milb'],
        priority: 2
      },
      
      // NCAA
      ncaa_basketball: {
        seasons: ['2022-23', '2023-24', '2024-25'],
        apis: ['ncaa', 'espn'],
        priority: 2
      },
      ncaa_baseball: {
        seasons: [2023, 2024, 2025],
        apis: ['ncaa'],
        priority: 3
      },
      ncaa_hockey: {
        seasons: ['2022-23', '2023-24', '2024-25'],
        apis: ['ncaa'],
        priority: 3
      }
    };
  }
  
  /**
   * Show collection summary
   */
  async showSummary() {
    const stats = await pgPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM teams_master) as teams,
        (SELECT COUNT(*) FROM players_master) as players,
        (SELECT COUNT(*) FROM games_master) as games,
        (SELECT COUNT(*) FROM player_game_stats) as stats,
        pg_size_pretty(pg_database_size(current_database())) as db_size
    `);
    
    const row = stats.rows[0];
    console.log(chalk.cyan('\n📊 Collection Summary:'));
    console.log(`  Teams: ${parseInt(row.teams).toLocaleString()}`);
    console.log(`  Players: ${parseInt(row.players).toLocaleString()}`);
    console.log(`  Games: ${parseInt(row.games).toLocaleString()}`);
    console.log(`  Stats: ${parseInt(row.stats).toLocaleString()}`);
    console.log(`  DB Size: ${row.db_size}\n`);
  }
}

// Test the engine
if (require.main === module) {
  const engine = new ParallelCollectionEngine();
  
  (async () => {
    // Show tasks
    const tasks = engine.createCollectionTasks();
    console.log(chalk.cyan('📋 Collection Tasks:'));
    Object.entries(tasks).forEach(([sport, config]) => {
      console.log(`  ${sport}: ${config.seasons.length} seasons`);
    });
    
    // Test pagination
    console.log(chalk.cyan('\n🧪 Testing parallel pagination...'));
    const testQuery = 'SELECT * FROM players';
    let count = 0;
    
    for await (const batch of engine.parallelPaginate(testQuery)) {
      count += batch.length;
    }
    
    console.log(chalk.green(`  ✓ Paginated through ${count.toLocaleString()} players`));
    
    await engine.showSummary();
    await pgPool.end();
  })();
}