#!/usr/bin/env tsx
/**
 * 🚀 BATCH PROCESSOR
 * Handles parallel API calls with rate limiting and retry logic
 */

import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';

// Simple queue implementation since p-queue has install issues
class SimpleQueue {
  private concurrency: number;
  private running = 0;
  private queue: (() => Promise<any>)[] = [];
  
  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }
  
  private async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const fn = this.queue.shift()!;
    
    try {
      await fn();
    } finally {
      this.running--;
      this.process();
    }
  }
}

export class BatchProcessor {
  private queue: SimpleQueue;
  private client: AxiosInstance;
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retries: 0
  };
  
  constructor(concurrency = 100) {
    this.queue = new SimpleQueue(concurrency);
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }
  
  /**
   * ESPN API endpoints by sport
   */
  private getESPNEndpoint(sport: string, gameId: string): string {
    const endpoints: { [key: string]: string } = {
      nfl: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`,
      nba: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`,
      mlb: `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`,
      nhl: `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`
    };
    
    return endpoints[sport] || endpoints.nfl;
  }
  
  /**
   * Fetch game stats with retry logic
   */
  async fetchGameStats(game: any, maxRetries = 3): Promise<any> {
    // Handle both formats: game from DB or processed game
    const externalId = game.external_id || `${game.sport}_${game.espnId}`;
    const gameId = game.espnId || this.extractGameId(externalId);
    
    if (!gameId) {
      throw new Error(`Invalid game ID from: ${JSON.stringify(game)}`);
    }
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.stats.totalRequests++;
        
        const sport = game.sport_id || game.sport;
        const url = this.getESPNEndpoint(sport, gameId);
        const response = await this.client.get(url);
        
        this.stats.successfulRequests++;
        
        return {
          gameId: game.id,
          espnId: gameId,
          sport: sport, // Use the sport variable that handles both formats
          data: response.data,
          timestamp: new Date().toISOString()
        };
        
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries) {
          this.stats.retries++;
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.sleep(delay);
        }
      }
    }
    
    this.stats.failedRequests++;
    throw new Error(`Failed to fetch stats for game ${game.id} after ${maxRetries} retries: ${lastError?.message}`);
  }
  
  /**
   * Process games in parallel batches
   */
  async processBatch(games: any[]): Promise<any[]> {
    console.log(chalk.cyan(`📦 Processing batch of ${games.length} games...`));
    
    const startTime = Date.now();
    const results: any[] = [];
    const errors: any[] = [];
    
    // Queue all requests
    const promises = games.map(game => 
      this.queue.add(async () => {
        try {
          const result = await this.fetchGameStats(game);
          results.push(result);
          process.stdout.write(chalk.green('.'));
        } catch (error: any) {
          console.error(chalk.red(`\nError for game ${game.id}:`, error.message));
          errors.push({ game, error: error.message });
          process.stdout.write(chalk.red('x'));
        }
      })
    );
    
    // Wait for all to complete
    await Promise.all(promises);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n✓ Batch complete in ${duration}s`));
    console.log(chalk.green(`  Success: ${results.length}`));
    if (errors.length > 0) {
      console.log(chalk.red(`  Failed: ${errors.length}`));
    }
    
    return results;
  }
  
  /**
   * Extract ESPN game ID from external_id
   */
  private extractGameId(externalId: string): string | null {
    // Patterns: "nfl_401547652", "espn_401547652", "401547652"
    const match = externalId.match(/(\d{9,})/);
    return match ? match[1] : null;
  }
  
  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 
        ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
  
  /**
   * Process all games with progress tracking
   */
  async processAllGames(games: any[], batchSize = 100): Promise<any[]> {
    console.log(chalk.bold.cyan(`\n🚀 Processing ${games.length} games in batches of ${batchSize}\n`));
    
    const allResults: any[] = [];
    const totalBatches = Math.ceil(games.length / batchSize);
    
    for (let i = 0; i < games.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = games.slice(i, i + batchSize);
      
      console.log(chalk.yellow(`\n📊 Batch ${batchNumber}/${totalBatches}`));
      
      const batchResults = await this.processBatch(batch);
      allResults.push(...batchResults);
      
      // Show progress
      const progress = ((i + batch.length) / games.length * 100).toFixed(1);
      console.log(chalk.cyan(`Overall progress: ${progress}%`));
    }
    
    return allResults;
  }
}

// Export singleton instance
export const batchProcessor = new BatchProcessor(100);