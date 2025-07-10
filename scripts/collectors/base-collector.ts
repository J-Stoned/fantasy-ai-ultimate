/**
 * 🚀 UNIFIED BASE COLLECTOR
 * Foundation for all sport-specific collectors
 * Matches our exact database schema
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';
import pLimit from 'p-limit';
import * as crypto from 'crypto';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Bloom filter for ultra-fast duplicate detection
export class BloomFilter {
  private bits: Set<number> = new Set();
  private hashCount = 7;
  
  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const hash = crypto.createHash('md5').update(`${item}${i}`).digest('hex');
      this.bits.add(parseInt(hash.substring(0, 8), 16) % 1000000);
    }
  }
  
  mightContain(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const hash = crypto.createHash('md5').update(`${item}${i}`).digest('hex');
      if (!this.bits.has(parseInt(hash.substring(0, 8), 16) % 1000000)) {
        return false;
      }
    }
    return true;
  }
}

// Cache with TTL
export class CacheManager {
  private cache = new Map<string, { data: any, expires: number }>();
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (item && item.expires > Date.now()) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }
  
  set(key: string, data: any, ttlMinutes: number = 5): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMinutes * 60 * 1000
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Base configuration for all collectors
export interface CollectorConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  batchSize?: number;
  concurrentLimit?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// Stats tracking
export interface CollectorStats {
  startTime: number;
  playersCreated: number;
  playersUpdated: number;
  gamesCreated: number;
  gameLogsCreated: number;
  errors: number;
  duplicatesAvoided: number;
  cacheHits: number;
  apiCalls: number;
}

export abstract class BaseCollector {
  protected supabase: SupabaseClient;
  protected bloomFilter: BloomFilter;
  protected cache: CacheManager;
  protected stats: CollectorStats;
  protected config: Required<CollectorConfig>;
  protected rateLimiter: ReturnType<typeof pLimit>;
  
  constructor(config: CollectorConfig = {}) {
    // Initialize with defaults
    this.config = {
      supabaseUrl: config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      batchSize: config.batchSize || 1000,
      concurrentLimit: config.concurrentLimit || 10,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };
    
    // Initialize Supabase client
    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
    
    // Initialize utilities
    this.bloomFilter = new BloomFilter();
    this.cache = new CacheManager();
    this.rateLimiter = pLimit(this.config.concurrentLimit);
    
    // Initialize stats
    this.stats = {
      startTime: Date.now(),
      playersCreated: 0,
      playersUpdated: 0,
      gamesCreated: 0,
      gameLogsCreated: 0,
      errors: 0,
      duplicatesAvoided: 0,
      cacheHits: 0,
      apiCalls: 0
    };
  }
  
  /**
   * Main collection method - must be implemented by subclasses
   */
  abstract collect(): Promise<void>;
  
  /**
   * Get or create a team
   * Returns the integer team ID
   */
  protected async upsertTeam(teamData: {
    name: string;
    city?: string;
    abbreviation?: string;
    sport?: string;
    sport_id?: string;
    league_id?: string;
    logo_url?: string;
  }): Promise<number | null> {
    try {
      const cacheKey = `team_${teamData.name}_${teamData.sport || ''}`;
      
      // Check cache
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      
      // Try to find existing team
      const { data: existing } = await this.supabase
        .from('teams')
        .select('id')
        .eq('name', teamData.name)
        .eq('sport_id', teamData.sport_id || teamData.sport || '')
        .single();
        
      if (existing) {
        this.cache.set(cacheKey, existing.id);
        return existing.id;
      }
      
      // Create new team
      const { data, error } = await this.supabase
        .from('teams')
        .insert({
          name: teamData.name,
          city: teamData.city || null,
          abbreviation: teamData.abbreviation || null,
          sport_id: teamData.sport_id || teamData.sport || null,
          league_id: teamData.league_id || null,
          logo_url: teamData.logo_url || null
        })
        .select('id')
        .single();
        
      if (error) {
        console.error('Team upsert error:', error);
        return null;
      }
      
      if (data) {
        this.cache.set(cacheKey, data.id);
        return data.id;
      }
      
      return null;
    } catch (error) {
      console.error('Team upsert exception:', error);
      return null;
    }
  }
  
  /**
   * Get or create a player matching our schema
   * Returns the integer player ID
   */
  protected async upsertPlayer(playerData: {
    external_id: string;
    firstname: string;
    lastname: string;
    name?: string;
    sport?: string;
    sport_id?: string;
    position?: string[];
    jersey_number?: number;
    heightinches?: number;
    weightlbs?: number;
    birthdate?: string;
    photo_url?: string;
    team?: string;
    team_abbreviation?: string;
    status?: string;
    college?: string;
    metadata?: any;
  }): Promise<number | null> {
    try {
      // Check bloom filter first
      if (this.bloomFilter.mightContain(`player_${playerData.external_id}`)) {
        // Check cache
        const cached = this.cache.get(`player_${playerData.external_id}`);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
      }
      
      // Get or create team if provided
      let team_id: number | null = null;
      if (playerData.team) {
        team_id = await this.upsertTeam({
          name: playerData.team,
          abbreviation: playerData.team_abbreviation,
          sport: playerData.sport,
          sport_id: playerData.sport_id
        });
      }
      
      // Map to our schema (matching actual database columns - all lowercase!)
      const dbPlayer = {
        external_id: playerData.external_id,
        firstname: playerData.firstname,
        lastname: playerData.lastname,
        sport_id: playerData.sport_id || playerData.sport || null,
        position: playerData.position || [],
        team_id: team_id,
        jersey_number: playerData.jersey_number || null,
        heightinches: playerData.heightinches || null,
        weightlbs: playerData.weightlbs || null,
        birthdate: playerData.birthdate || null,
        photo_url: playerData.photo_url || null,
        status: playerData.status || 'active',
        // Additional columns that exist in database
        name: playerData.name || `${playerData.firstname} ${playerData.lastname}`,
        team: playerData.team || null,
        sport: playerData.sport || playerData.sport_id || null,
        college: playerData.college || null,
        metadata: playerData.metadata || {}
      };
      
      // Check if player exists first
      const { data: existing } = await this.supabase
        .from('players')
        .select('id')
        .eq('external_id', playerData.external_id)
        .single();
      
      if (existing) {
        // Update existing player
        const { data, error } = await this.supabase
          .from('players')
          .update(dbPlayer)
          .eq('id', existing.id)
          .select('id')
          .single();
          
        if (!error) {
          this.stats.playersUpdated++;
          this.cache.set(`player_${playerData.external_id}`, existing.id);
          return existing.id;
        }
      } else {
        // Insert new player
        const { data, error } = await this.supabase
          .from('players')
          .insert(dbPlayer)
          .select('id')
          .single();
        
        if (error) {
          console.error('Player insert error:', error);
          this.stats.errors++;
          return null;
        }
        
        if (data) {
          this.stats.playersCreated++;
          this.bloomFilter.add(`player_${playerData.external_id}`);
          this.cache.set(`player_${playerData.external_id}`, data.id);
          return data.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Player upsert exception:', error);
      this.stats.errors++;
      return null;
    }
  }
  
  /**
   * Create a game record
   * Returns the integer game ID
   */
  protected async upsertGame(gameData: {
    external_id: string;
    sport?: string;
    sport_id?: string;
    home_team_id?: number;
    away_team_id?: number;
    start_time: Date;
    status: string;
    venue?: string;
    home_score?: number;
    away_score?: number;
    league?: string;
    metadata?: any;
  }): Promise<number | null> {
    try {
      // Check bloom filter
      if (this.bloomFilter.mightContain(`game_${gameData.external_id}`)) {
        const cached = this.cache.get(`game_${gameData.external_id}`);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
      }
      
      const { data, error } = await this.supabase
        .from('games')
        .upsert({
          external_id: gameData.external_id,
          sport: gameData.sport || gameData.sport_id || null,
          sport_id: gameData.sport_id || gameData.sport || null,
          home_team_id: gameData.home_team_id || null,
          away_team_id: gameData.away_team_id || null,
          start_time: gameData.start_time,
          status: gameData.status,
          venue: gameData.venue || null,
          home_score: gameData.home_score || null,
          away_score: gameData.away_score || null,
          league: gameData.league || null,
          metadata: gameData.metadata || {}
        }, {
          onConflict: 'external_id'
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Game upsert error:', error);
        this.stats.errors++;
        return null;
      }
      
      if (data) {
        this.stats.gamesCreated++;
        this.bloomFilter.add(`game_${gameData.external_id}`);
        this.cache.set(`game_${gameData.external_id}`, data.id);
        return data.id;
      }
      
      return null;
    } catch (error) {
      console.error('Game upsert exception:', error);
      this.stats.errors++;
      return null;
    }
  }
  
  /**
   * Create player game log with stats
   */
  protected async createGameLog(logData: {
    player_id: number;
    game_id: number;
    team_id?: number;
    game_date: Date;
    opponent_id?: number;
    is_home?: boolean;
    minutes_played?: number;
    stats: any;
    fantasy_points: number;
  }): Promise<boolean> {
    try {
      // Check for duplicate
      const logKey = `log_${logData.player_id}_${logData.game_id}`;
      if (this.bloomFilter.mightContain(logKey)) {
        this.stats.duplicatesAvoided++;
        return false;
      }
      
      const { error } = await this.supabase
        .from('player_game_logs')
        .insert({
          player_id: logData.player_id,
          game_id: logData.game_id,
          team_id: logData.team_id || null,
          game_date: logData.game_date,
          opponent_id: logData.opponent_id || null,
          is_home: logData.is_home || null,
          minutes_played: logData.minutes_played || null,
          stats: logData.stats,
          fantasy_points: logData.fantasy_points
        });
      
      if (error) {
        // Check if it's a duplicate key error
        if (error.message?.includes('duplicate')) {
          this.stats.duplicatesAvoided++;
          this.bloomFilter.add(logKey);
          return false;
        }
        console.error('Game log error:', error);
        this.stats.errors++;
        return false;
      }
      
      this.stats.gameLogsCreated++;
      this.bloomFilter.add(logKey);
      return true;
    } catch (error) {
      console.error('Game log exception:', error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * Batch insert game logs for efficiency
   */
  protected async batchInsertGameLogs(logs: any[]): Promise<number> {
    if (logs.length === 0) return 0;
    
    try {
      // Insert in chunks to avoid timeouts
      const chunks = this.chunkArray(logs, this.config.batchSize);
      let totalInserted = 0;
      
      for (const chunk of chunks) {
        const { error, count } = await this.supabase
          .from('player_game_logs')
          .insert(chunk)
          .select('id');
        
        if (error) {
          console.error('Batch insert error:', error);
          this.stats.errors++;
        } else {
          totalInserted += count || 0;
          this.stats.gameLogsCreated += count || 0;
        }
      }
      
      return totalInserted;
    } catch (error) {
      console.error('Batch insert exception:', error);
      this.stats.errors++;
      return 0;
    }
  }
  
  /**
   * Retry logic for API calls
   */
  protected async retryableApiCall<T>(
    fn: () => Promise<T>,
    retries = this.config.retryAttempts
  ): Promise<T | null> {
    for (let i = 0; i < retries; i++) {
      try {
        this.stats.apiCalls++;
        return await fn();
      } catch (error: any) {
        if (i === retries - 1) {
          console.error('API call failed after retries:', error.message);
          this.stats.errors++;
          return null;
        }
        
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return null;
  }
  
  /**
   * Chunk array for batch processing
   */
  protected chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Print collection stats
   */
  protected printStats(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.gameLogsCreated / (elapsed / 60);
    
    console.log(chalk.cyan('\n📊 COLLECTION STATS:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`⏱️  Time: ${elapsed.toFixed(1)}s`);
    console.log(`👤 Players: ${this.stats.playersCreated} created, ${this.stats.playersUpdated} updated`);
    console.log(`🎮 Games: ${this.stats.gamesCreated}`);
    console.log(`📈 Game Logs: ${this.stats.gameLogsCreated} (${rate.toFixed(0)}/min)`);
    console.log(`🔄 API Calls: ${this.stats.apiCalls}`);
    console.log(`💾 Cache Hits: ${this.stats.cacheHits}`);
    console.log(`🚫 Duplicates Avoided: ${this.stats.duplicatesAvoided}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
  }
  
  /**
   * Clean up resources
   */
  protected cleanup(): void {
    this.cache.clear();
  }
}