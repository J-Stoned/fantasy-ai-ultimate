/**
 * 🔄 DataLoader Pattern Implementation
 * Batches and caches database lookups to prevent N+1 queries
 */

export type BatchLoadFn<K, V> = (keys: K[]) => Promise<V[]>;

export interface DataLoaderOptions<K, V> {
  batchLoadFn: BatchLoadFn<K, V>;
  cacheKeyFn?: (key: K) => string;
  batchSize?: number;
  cache?: boolean;
  cacheTTL?: number; // milliseconds
}

export class DataLoader<K, V> {
  private batchLoadFn: BatchLoadFn<K, V>;
  private batch: Array<{ key: K; resolve: (value: V | null) => void; reject: (error: Error) => void }> = [];
  private cache: Map<string, { value: V | null; expires: number }> = new Map();
  private batchPromise: Promise<void> | null = null;
  
  private cacheKeyFn: (key: K) => string;
  private batchSize: number;
  private cacheEnabled: boolean;
  private cacheTTL: number;

  constructor(options: DataLoaderOptions<K, V>) {
    this.batchLoadFn = options.batchLoadFn;
    this.cacheKeyFn = options.cacheKeyFn || ((key: K) => String(key));
    this.batchSize = options.batchSize || 100;
    this.cacheEnabled = options.cache !== false;
    this.cacheTTL = options.cacheTTL || 60000; // 1 minute default
  }

  /**
   * Load a single value
   */
  async load(key: K): Promise<V | null> {
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getFromCache(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Add to batch
    return new Promise((resolve, reject) => {
      this.batch.push({ key, resolve, reject });
      
      // Process batch if it's full
      if (this.batch.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.batchPromise) {
        // Schedule batch processing on next tick
        this.batchPromise = Promise.resolve().then(() => {
          process.nextTick(() => this.processBatch());
        });
      }
    });
  }

  /**
   * Load multiple values
   */
  async loadMany(keys: K[]): Promise<Array<V | null>> {
    return Promise.all(keys.map(key => this.load(key)));
  }

  /**
   * Clear specific cache entries
   */
  clear(key: K): void {
    const cacheKey = this.cacheKeyFn(key);
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Prime the cache with known values
   */
  prime(key: K, value: V | null): void {
    if (this.cacheEnabled) {
      const cacheKey = this.cacheKeyFn(key);
      this.cache.set(cacheKey, {
        value,
        expires: Date.now() + this.cacheTTL
      });
    }
  }

  /**
   * Process the current batch
   */
  private async processBatch(): Promise<void> {
    const currentBatch = this.batch;
    this.batch = [];
    this.batchPromise = null;

    if (currentBatch.length === 0) return;

    try {
      const keys = currentBatch.map(item => item.key);
      const values = await this.batchLoadFn(keys);

      // Create a map for quick lookup
      const valueMap = new Map<string, V>();
      keys.forEach((key, index) => {
        const cacheKey = this.cacheKeyFn(key);
        const value = values[index] || null;
        valueMap.set(cacheKey, value);
        
        // Cache the result
        if (this.cacheEnabled && value !== undefined) {
          this.cache.set(cacheKey, {
            value,
            expires: Date.now() + this.cacheTTL
          });
        }
      });

      // Resolve all promises
      currentBatch.forEach(({ key, resolve }) => {
        const cacheKey = this.cacheKeyFn(key);
        const value = valueMap.get(cacheKey) ?? null;
        resolve(value);
      });
    } catch (error) {
      // Reject all promises
      currentBatch.forEach(({ reject }) => {
        reject(error as Error);
      });
    }
  }

  /**
   * Get value from cache
   */
  private getFromCache(key: K): V | null | undefined {
    const cacheKey = this.cacheKeyFn(key);
    const cached = this.cache.get(cacheKey);
    
    if (!cached) return undefined;
    
    // Check if expired
    if (Date.now() > cached.expires) {
      this.cache.delete(cacheKey);
      return undefined;
    }
    
    return cached.value;
  }
}

/**
 * Pre-configured DataLoaders for common entities
 */

import { optimizedDB } from './optimized-database';

// Player DataLoader
export const playerLoader = new DataLoader({
  batchLoadFn: async (playerIds: string[]) => {
    const query = `
      SELECT * FROM fantasy_players 
      WHERE id = ANY($1)
      ORDER BY array_position($1, id)
    `;
    const players = await optimizedDB.query(query, [playerIds]);
    
    // Return in same order as requested
    const playerMap = new Map(players.map(p => [p.id, p]));
    return playerIds.map(id => playerMap.get(id) || null);
  },
  cache: true,
  cacheTTL: 300000 // 5 minutes
});

// League DataLoader
export const leagueLoader = new DataLoader({
  batchLoadFn: async (leagueIds: string[]) => {
    const query = `
      SELECT * FROM fantasy_leagues 
      WHERE id = ANY($1)
      ORDER BY array_position($1, id)
    `;
    const leagues = await optimizedDB.query(query, [leagueIds]);
    
    const leagueMap = new Map(leagues.map(l => [l.id, l]));
    return leagueIds.map(id => leagueMap.get(id) || null);
  },
  cache: true,
  cacheTTL: 600000 // 10 minutes
});

// Contest DataLoader
export const contestLoader = new DataLoader({
  batchLoadFn: async (contestIds: string[]) => {
    const query = `
      SELECT * FROM contests 
      WHERE id = ANY($1)
      ORDER BY array_position($1, id)
    `;
    const contests = await optimizedDB.query(query, [contestIds]);
    
    const contestMap = new Map(contests.map(c => [c.id, c]));
    return contestIds.map(id => contestMap.get(id) || null);
  },
  cache: true,
  cacheTTL: 60000 // 1 minute
});

// Player Stats DataLoader
export const playerStatsLoader = new DataLoader({
  batchLoadFn: async (playerIds: string[]) => {
    const query = `
      SELECT 
        ps.*,
        p.name,
        p.position,
        p.team
      FROM player_stats ps
      JOIN fantasy_players p ON ps.player_id = p.id
      WHERE ps.player_id = ANY($1)
      ORDER BY array_position($1, ps.player_id)
    `;
    const stats = await optimizedDB.query(query, [playerIds]);
    
    const statsMap = new Map(stats.map(s => [s.player_id, s]));
    return playerIds.map(id => statsMap.get(id) || null);
  },
  cache: true,
  cacheTTL: 180000 // 3 minutes
});

// User Lineups DataLoader
export const userLineupsLoader = new DataLoader({
  batchLoadFn: async (userContestPairs: Array<{ userId: string; contestId: string }>) => {
    const userIds = [...new Set(userContestPairs.map(p => p.userId))];
    const contestIds = [...new Set(userContestPairs.map(p => p.contestId))];
    
    const query = `
      SELECT 
        l.*,
        json_agg(
          json_build_object(
            'player_id', lp.player_id,
            'position', lp.position,
            'player_name', p.name,
            'player_team', p.team
          )
        ) as players
      FROM lineups l
      LEFT JOIN lineup_players lp ON l.id = lp.lineup_id
      LEFT JOIN fantasy_players p ON lp.player_id = p.id
      WHERE l.user_id = ANY($1) AND l.contest_id = ANY($2)
      GROUP BY l.id
    `;
    
    const lineups = await optimizedDB.query(query, [userIds, contestIds]);
    
    // Create lookup map
    const lineupMap = new Map(
      lineups.map(l => [`${l.user_id}-${l.contest_id}`, l])
    );
    
    return userContestPairs.map(pair => 
      lineupMap.get(`${pair.userId}-${pair.contestId}`) || null
    );
  },
  cacheKeyFn: (pair) => `${pair.userId}-${pair.contestId}`,
  cache: true,
  cacheTTL: 30000 // 30 seconds
});