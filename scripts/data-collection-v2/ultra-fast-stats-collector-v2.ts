#!/usr/bin/env tsx
/**
 * 🚀 ULTRA-FAST STATS COLLECTOR V2 - PROPERLY OPTIMIZED!
 * 
 * FIXES:
 * - Uses pagination (5K games at a time)
 * - Processes 1000 games per batch
 * - Uses all 12 CPU threads
 * - 1000 concurrent API calls
 * - Proper memory management
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { ParallelCollectionEngine } from './phase2-parallel-engine';
import pgPool from './pg-config';
import chalk from 'chalk';
import pLimit from 'p-limit';
import * as os from 'os';
import axios from 'axios';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// PROPERLY OPTIMIZED SETTINGS
const CPU_COUNT = os.cpus().length; // 12 threads
const WORKER_POOL_SIZE = 12; // USE ALL THREADS!
const API_CONCURRENCY = 1000; // MAXIMUM API CALLS
const DB_BATCH_SIZE = 10000; // Massive DB batches
const GAMES_PER_WORKER_BATCH = 1000; // 1K games per batch as requested
const PAGINATION_SIZE = 5000; // Process 5K games at a time

class UltraFastStatsCollectorV2 {
  private engine: ParallelCollectionEngine;
  private workers: Worker[] = [];
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private totalStats: number = 0;
  private startTime: number = Date.now();
  private statsBuffer: any[] = [];
  private playerCache = new Map<string, number>();
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n🚀🚀🚀 ULTRA-FAST STATS COLLECTOR V2 - MAXIMUM PERFORMANCE! 🚀🚀🚀\n'));
    console.log(chalk.yellow(`⚡ CPU: ${CPU_COUNT} threads (ALL CORES!)`));
    console.log(chalk.yellow(`⚡ Workers: ${WORKER_POOL_SIZE} parallel workers`));
    console.log(chalk.yellow(`⚡ API Concurrency: ${API_CONCURRENCY} simultaneous calls`));
    console.log(chalk.yellow(`⚡ Batch Size: ${GAMES_PER_WORKER_BATCH} games/batch`));
    console.log(chalk.yellow(`⚡ Pagination: ${PAGINATION_SIZE} games/page`));
    console.log(chalk.yellow(`⚡ Target: 500+ games/second\n`));
  }
  
  async collect() {
    try {
      // Initialize workers
      await this.initializeWorkers();
      
      // Pre-cache all players
      await this.cacheAllPlayers();
      
      // Count total games needing stats
      const countResult = await pgPool.query(`
        SELECT COUNT(*) as count
        FROM games_master g
        WHERE NOT EXISTS (
          SELECT 1 FROM player_game_stats pgs 
          WHERE pgs.game_id = g.id
        )
      `);
      
      this.totalGames = parseInt(countResult.rows[0].count);
      console.log(chalk.cyan.bold(`📊 FOUND ${this.totalGames.toLocaleString()} GAMES NEEDING STATS!\n`));
      
      // Process games in paginated chunks
      let offset = 0;
      while (offset < this.totalGames) {
        console.log(chalk.yellow(`\n📄 Processing page ${Math.floor(offset / PAGINATION_SIZE) + 1} (${offset}-${Math.min(offset + PAGINATION_SIZE, this.totalGames)} of ${this.totalGames})`));
        
        // Fetch next page of games
        const gamesResult = await pgPool.query(`
          SELECT 
            g.*,
            ht.name as home_team_name,
            ht.espn_id as home_espn_id,
            at.name as away_team_name,
            at.espn_id as away_espn_id
          FROM games_master g
          JOIN teams_master ht ON g.home_team_id = ht.id
          JOIN teams_master at ON g.away_team_id = at.id
          WHERE NOT EXISTS (
            SELECT 1 FROM player_game_stats pgs 
            WHERE pgs.game_id = g.id
          )
          ORDER BY g.sport, g.game_date DESC
          LIMIT ${PAGINATION_SIZE} OFFSET ${offset}
        `);
        
        if (gamesResult.rows.length === 0) break;
        
        // Process this page of games
        await this.processGamesPage(gamesResult.rows);
        
        offset += PAGINATION_SIZE;
        
        // Show progress
        const elapsed = (Date.now() - this.startTime) / 1000;
        const gamesPerSecond = this.processedGames / elapsed;
        const eta = (this.totalGames - this.processedGames) / gamesPerSecond;
        
        console.log(chalk.green(
          `\n📊 Progress: ${this.processedGames.toLocaleString()}/${this.totalGames.toLocaleString()} games | ` +
          `${this.totalStats.toLocaleString()} stats | ` +
          `${gamesPerSecond.toFixed(1)} games/sec | ` +
          `ETA: ${(eta / 60).toFixed(1)} min`
        ));
      }
      
      // Flush any remaining stats
      await this.flushStatsBuffer();
      
      // Cleanup
      await this.terminateWorkers();
      
      const totalTime = (Date.now() - this.startTime) / 1000;
      const finalGamesPerSecond = this.processedGames / totalTime;
      
      console.log(chalk.green.bold(`\n✅ ULTRA-FAST COLLECTION V2 COMPLETE!`));
      console.log(chalk.yellow(`⚡ Time: ${(totalTime / 60).toFixed(1)} minutes`));
      console.log(chalk.yellow(`⚡ Speed: ${finalGamesPerSecond.toFixed(1)} games/second`));
      console.log(chalk.yellow(`⚡ Total Stats: ${this.totalStats.toLocaleString()}\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ Ultra-fast collection failed:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  /**
   * Process a page of games
   */
  async processGamesPage(games: any[]) {
    // Group games by sport for optimal API usage
    const gamesBySport = this.groupGamesBySport(games);
    
    // Process each sport's games in parallel batches
    const promises = [];
    
    for (const [sport, sportGames] of Object.entries(gamesBySport)) {
      console.log(chalk.cyan(`  Processing ${sport}: ${sportGames.length} games`));
      
      // Split games into worker batches
      for (let i = 0; i < sportGames.length; i += GAMES_PER_WORKER_BATCH) {
        const batch = sportGames.slice(i, i + GAMES_PER_WORKER_BATCH);
        const workerId = Math.floor(i / GAMES_PER_WORKER_BATCH) % WORKER_POOL_SIZE;
        
        promises.push(
          this.sendToWorker(workerId, {
            type: 'process_games',
            sport: sport,
            games: batch,
            playerCache: Object.fromEntries(this.playerCache)
          })
        );
      }
    }
    
    // Wait for all batches to complete
    await Promise.all(promises);
  }
  
  /**
   * Initialize worker pool
   */
  async initializeWorkers() {
    console.log(chalk.cyan(`🔧 Initializing ${WORKER_POOL_SIZE} worker threads...\n`));
    
    for (let i = 0; i < WORKER_POOL_SIZE; i++) {
      const workerPath = path.join(__dirname, 'stats-worker.js');
      const worker = new Worker(workerPath, {
        workerData: { 
          workerId: i,
          apiConcurrency: Math.floor(API_CONCURRENCY / WORKER_POOL_SIZE) // Distribute API calls
        }
      });
      
      worker.on('message', (msg) => {
        if (msg.type === 'stats') {
          this.handleWorkerStats(msg.data);
        } else if (msg.type === 'progress') {
          this.processedGames += msg.games;
          this.totalStats += msg.stats;
        } else if (msg.type === 'error') {
          console.error(chalk.red(`Worker ${i} error:`), msg.error);
        }
      });
      
      worker.on('error', (err) => {
        console.error(chalk.red(`Worker ${i} crashed:`), err);
      });
      
      this.workers.push(worker);
    }
  }
  
  /**
   * Cache all players for fast lookup
   */
  async cacheAllPlayers() {
    console.log(chalk.cyan('📦 Pre-caching all players for speed...\n'));
    
    const players = await pgPool.query(`
      SELECT id, our_player_id, espn_id, mlb_id, sport
      FROM players_master
    `);
    
    players.rows.forEach(player => {
      // Cache by multiple keys for fast lookup
      if (player.espn_id) {
        this.playerCache.set(`espn_${player.sport}_${player.espn_id}`, player.id);
      }
      if (player.mlb_id) {
        this.playerCache.set(`mlb_${player.mlb_id}`, player.id);
      }
      this.playerCache.set(player.our_player_id, player.id);
    });
    
    console.log(chalk.green(`✅ Cached ${players.rows.length.toLocaleString()} players\n`));
  }
  
  /**
   * Group games by sport
   */
  groupGamesBySport(games: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const game of games) {
      if (!grouped[game.sport]) {
        grouped[game.sport] = [];
      }
      grouped[game.sport].push(game);
    }
    
    return grouped;
  }
  
  /**
   * Send task to worker
   */
  sendToWorker(workerId: number, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = this.workers[workerId];
      
      const handleMessage = (msg: any) => {
        if (msg.type === 'complete') {
          worker.off('message', handleMessage);
          resolve();
        }
      };
      
      worker.on('message', handleMessage);
      worker.postMessage(data);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        worker.off('message', handleMessage);
        reject(new Error(`Worker ${workerId} timeout`));
      }, 5 * 60 * 1000);
    });
  }
  
  /**
   * Handle stats from worker
   */
  async handleWorkerStats(stats: any[]) {
    this.statsBuffer.push(...stats);
    
    // Flush buffer if it's getting large
    if (this.statsBuffer.length >= DB_BATCH_SIZE) {
      await this.flushStatsBuffer();
    }
  }
  
  /**
   * Flush stats buffer to database
   */
  async flushStatsBuffer() {
    if (this.statsBuffer.length === 0) return;
    
    const stats = [...this.statsBuffer];
    this.statsBuffer = [];
    
    try {
      await this.engine.bulkInsert('player_game_stats', stats, {
        conflictTarget: 'player_id, game_id',
        updateColumns: ['stats', 'played', 'started', 'minutes_played', 'updated_at'],
        batchSize: DB_BATCH_SIZE
      });
      
      console.log(chalk.gray(`  💾 Saved ${stats.length} stats to database`));
    } catch (error) {
      console.error(chalk.red('Error saving stats:'), error);
    }
  }
  
  /**
   * Terminate all workers
   */
  async terminateWorkers() {
    console.log(chalk.yellow('\n🛑 Shutting down workers...'));
    
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );
    
    this.workers = [];
  }
}

// Run if main thread
if (isMainThread && require.main === module) {
  const collector = new UltraFastStatsCollectorV2();
  collector.collect().catch(console.error);
}