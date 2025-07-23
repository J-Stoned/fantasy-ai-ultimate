// Memory Optimizer - Efficient data storage and retrieval optimization

import {
  LeagueMemory,
  SeasonMemory,
  Transaction,
  Trade,
  DraftResult,
  WaiverClaim,
  LineupDecision,
  ChatMessage,
  ManagerProfile
} from './types';

export class MemoryOptimizer {
  private readonly CACHE_SIZE = 100; // MB
  private readonly COMPRESSION_THRESHOLD = 0.8; // 80% of cache size
  private readonly INDEX_UPDATE_INTERVAL = 100; // transactions
  
  private cache: Map<string, any> = new Map();
  private accessFrequency: Map<string, number> = new Map();
  private lastAccessed: Map<string, Date> = new Map();
  private indices: {
    managerIndex: Map<string, Set<string>>;
    playerIndex: Map<string, Set<string>>;
    dateIndex: Map<string, Set<string>>;
    typeIndex: Map<string, Set<string>>;
  };

  constructor() {
    this.indices = {
      managerIndex: new Map(),
      playerIndex: new Map(),
      dateIndex: new Map(),
      typeIndex: new Map()
    };
  }

  // Optimize memory structure for efficient storage
  optimizeMemory(memory: LeagueMemory): LeagueMemory {
    // Build indices
    this.buildIndices(memory);

    // Compress old data
    const optimized = this.compressHistoricalData(memory);

    // Optimize data structures
    this.optimizeDataStructures(optimized);

    // Cache frequently accessed data
    this.cacheFrequentData(optimized);

    return optimized;
  }

  // Build indices for fast lookup
  private buildIndices(memory: LeagueMemory): void {
    let transactionCount = 0;

    for (const season of memory.seasons) {
      // Index transactions
      for (const transaction of season.transactions) {
        this.indexTransaction(transaction, `t_${transaction.transactionId}`);
        transactionCount++;
        
        if (transactionCount % this.INDEX_UPDATE_INTERVAL === 0) {
          this.optimizeIndices();
        }
      }

      // Index trades
      for (const trade of season.trades) {
        this.indexTrade(trade, `tr_${trade.tradeId}`);
      }

      // Index draft results
      for (const pick of season.draftResults) {
        this.indexDraftPick(pick, `d_${season.year}_${pick.pick}`);
      }

      // Index waiver claims
      for (const claim of season.waiverClaims) {
        this.indexWaiverClaim(claim, `w_${claim.timestamp.getTime()}`);
      }
    }

    this.optimizeIndices();
  }

  // Index transaction for fast lookup
  private indexTransaction(transaction: Transaction, key: string): void {
    // Manager index
    if (!this.indices.managerIndex.has(transaction.managerId)) {
      this.indices.managerIndex.set(transaction.managerId, new Set());
    }
    this.indices.managerIndex.get(transaction.managerId)!.add(key);

    // Player index
    for (const player of transaction.players) {
      if (!this.indices.playerIndex.has(player.playerId)) {
        this.indices.playerIndex.set(player.playerId, new Set());
      }
      this.indices.playerIndex.get(player.playerId)!.add(key);
    }

    // Date index (by week)
    const weekKey = this.getWeekKey(transaction.timestamp);
    if (!this.indices.dateIndex.has(weekKey)) {
      this.indices.dateIndex.set(weekKey, new Set());
    }
    this.indices.dateIndex.get(weekKey)!.add(key);

    // Type index
    if (!this.indices.typeIndex.has(transaction.type)) {
      this.indices.typeIndex.set(transaction.type, new Set());
    }
    this.indices.typeIndex.get(transaction.type)!.add(key);
  }

  // Index trade for fast lookup
  private indexTrade(trade: Trade, key: string): void {
    // Manager indices
    const managers = [trade.team1.managerId, trade.team2.managerId];
    for (const managerId of managers) {
      if (!this.indices.managerIndex.has(managerId)) {
        this.indices.managerIndex.set(managerId, new Set());
      }
      this.indices.managerIndex.get(managerId)!.add(key);
    }

    // Player indices
    const players = [
      ...trade.team1.playersGiven,
      ...trade.team1.playersReceived,
      ...trade.team2.playersGiven,
      ...trade.team2.playersReceived
    ];
    
    for (const playerId of players) {
      if (!this.indices.playerIndex.has(playerId)) {
        this.indices.playerIndex.set(playerId, new Set());
      }
      this.indices.playerIndex.get(playerId)!.add(key);
    }

    // Date index
    const weekKey = this.getWeekKey(trade.timestamp);
    if (!this.indices.dateIndex.has(weekKey)) {
      this.indices.dateIndex.set(weekKey, new Set());
    }
    this.indices.dateIndex.get(weekKey)!.add(key);

    // Type index
    if (!this.indices.typeIndex.has('trade')) {
      this.indices.typeIndex.set('trade', new Set());
    }
    this.indices.typeIndex.get('trade')!.add(key);
  }

  // Index draft pick for fast lookup
  private indexDraftPick(pick: DraftResult, key: string): void {
    // Manager index
    if (!this.indices.managerIndex.has(pick.managerId)) {
      this.indices.managerIndex.set(pick.managerId, new Set());
    }
    this.indices.managerIndex.get(pick.managerId)!.add(key);

    // Player index
    if (!this.indices.playerIndex.has(pick.playerId)) {
      this.indices.playerIndex.set(pick.playerId, new Set());
    }
    this.indices.playerIndex.get(pick.playerId)!.add(key);

    // Type index
    if (!this.indices.typeIndex.has('draft')) {
      this.indices.typeIndex.set('draft', new Set());
    }
    this.indices.typeIndex.get('draft')!.add(key);
  }

  // Index waiver claim for fast lookup
  private indexWaiverClaim(claim: WaiverClaim, key: string): void {
    // Manager index
    if (!this.indices.managerIndex.has(claim.managerId)) {
      this.indices.managerIndex.set(claim.managerId, new Set());
    }
    this.indices.managerIndex.get(claim.managerId)!.add(key);

    // Player index
    if (!this.indices.playerIndex.has(claim.playerId)) {
      this.indices.playerIndex.set(claim.playerId, new Set());
    }
    this.indices.playerIndex.get(claim.playerId)!.add(key);

    // Date index
    const weekKey = this.getWeekKey(claim.timestamp);
    if (!this.indices.dateIndex.has(weekKey)) {
      this.indices.dateIndex.set(weekKey, new Set());
    }
    this.indices.dateIndex.get(weekKey)!.add(key);

    // Type index
    if (!this.indices.typeIndex.has('waiver')) {
      this.indices.typeIndex.set('waiver', new Set());
    }
    this.indices.typeIndex.get('waiver')!.add(key);
  }

  // Compress historical data
  private compressHistoricalData(memory: LeagueMemory): LeagueMemory {
    const compressed = { ...memory };
    compressed.seasons = memory.seasons.map((season, index) => {
      const seasonsAgo = memory.seasons.length - index - 1;
      
      if (seasonsAgo > 2) {
        return this.compressSeason(season, seasonsAgo);
      }
      
      return season;
    });

    return compressed;
  }

  // Compress a single season based on age
  private compressSeason(season: SeasonMemory, seasonsAgo: number): SeasonMemory {
    const compressed = { ...season };

    if (seasonsAgo > 5) {
      // Very old seasons - aggressive compression
      compressed.chatMessages = []; // Remove all chat
      compressed.lineupDecisions = this.sampleArray(season.lineupDecisions, 0.1); // Keep 10%
      compressed.transactions = this.sampleArray(season.transactions, 0.3); // Keep 30%
      compressed.waiverClaims = this.sampleArray(season.waiverClaims, 0.3);
    } else if (seasonsAgo > 2) {
      // Moderately old seasons
      compressed.chatMessages = this.sampleArray(season.chatMessages, 0.1); // Keep 10%
      compressed.lineupDecisions = this.sampleArray(season.lineupDecisions, 0.25); // Keep 25%
      compressed.transactions = this.sampleArray(season.transactions, 0.5); // Keep 50%
    }

    return compressed;
  }

  // Sample array to reduce size while maintaining representation
  private sampleArray<T>(array: T[], keepRatio: number): T[] {
    if (keepRatio >= 1) return array;
    if (keepRatio <= 0) return [];

    const keepCount = Math.max(1, Math.floor(array.length * keepRatio));
    const step = Math.floor(array.length / keepCount);

    return array.filter((_, index) => index % step === 0);
  }

  // Optimize data structures for memory efficiency
  private optimizeDataStructures(memory: LeagueMemory): void {
    // Convert repeated strings to references
    const stringPool = new Map<string, number>();
    let stringId = 0;

    // Pool manager IDs
    for (const manager of memory.managers) {
      if (!stringPool.has(manager.managerId)) {
        stringPool.set(manager.managerId, stringId++);
      }
    }

    // Pool player IDs (would implement in real scenario)
    
    // Deduplicate similar objects
    this.deduplicatePatterns(memory);
  }

  // Deduplicate similar patterns
  private deduplicatePatterns(memory: LeagueMemory): void {
    // Deduplicate draft patterns
    if (memory.patterns?.draftPatterns) {
      const uniquePatterns = new Map<string, any>();
      
      for (const pattern of memory.patterns.draftPatterns.positionRuns) {
        const key = `${pattern.position}_${pattern.startRound}_${pattern.endRound}`;
        if (!uniquePatterns.has(key)) {
          uniquePatterns.set(key, pattern);
        }
      }
      
      memory.patterns.draftPatterns.positionRuns = Array.from(uniquePatterns.values());
    }
  }

  // Cache frequently accessed data
  private cacheFrequentData(memory: LeagueMemory): void {
    // Cache current season data
    const currentSeason = memory.seasons[memory.seasons.length - 1];
    if (currentSeason) {
      this.addToCache('current_season', currentSeason);
    }

    // Cache manager profiles
    for (const manager of memory.managers) {
      this.addToCache(`manager_${manager.managerId}`, manager);
    }

    // Cache recent transactions
    const recentTransactions = this.getRecentTransactions(memory, 100);
    this.addToCache('recent_transactions', recentTransactions);
  }

  // Add item to cache with LRU eviction
  private addToCache(key: string, value: any): void {
    // Update access tracking
    this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
    this.lastAccessed.set(key, new Date());

    // Check cache size
    if (this.getCacheSize() > this.CACHE_SIZE * this.COMPRESSION_THRESHOLD) {
      this.evictFromCache();
    }

    this.cache.set(key, value);
  }

  // Get item from cache
  getCached(key: string): any {
    if (this.cache.has(key)) {
      this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
      this.lastAccessed.set(key, new Date());
      return this.cache.get(key);
    }
    return null;
  }

  // Evict least recently used items from cache
  private evictFromCache(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by access frequency and last accessed
    entries.sort((a, b) => {
      const freqA = this.accessFrequency.get(a[0]) || 0;
      const freqB = this.accessFrequency.get(b[0]) || 0;
      
      if (freqA !== freqB) {
        return freqA - freqB;
      }
      
      const lastA = this.lastAccessed.get(a[0])?.getTime() || 0;
      const lastB = this.lastAccessed.get(b[0])?.getTime() || 0;
      
      return lastA - lastB;
    });

    // Remove bottom 20%
    const removeCount = Math.floor(entries.length * 0.2);
    for (let i = 0; i < removeCount; i++) {
      const key = entries[i][0];
      this.cache.delete(key);
      this.accessFrequency.delete(key);
      this.lastAccessed.delete(key);
    }
  }

  // Get cache size in MB (approximate)
  private getCacheSize(): number {
    let size = 0;
    for (const value of this.cache.values()) {
      size += JSON.stringify(value).length;
    }
    return size / (1024 * 1024);
  }

  // Optimize indices for better performance
  private optimizeIndices(): void {
    // Remove empty index entries
    for (const [key, value] of this.indices.managerIndex) {
      if (value.size === 0) {
        this.indices.managerIndex.delete(key);
      }
    }

    // Convert large sets to arrays for better memory efficiency
    for (const [key, value] of this.indices.playerIndex) {
      if (value.size > 1000) {
        // In a real implementation, would use more efficient data structure
        console.log(`Large index for player ${key}: ${value.size} entries`);
      }
    }
  }

  // Fast query methods using indices
  queryByManager(managerId: string): Set<string> {
    return this.indices.managerIndex.get(managerId) || new Set();
  }

  queryByPlayer(playerId: string): Set<string> {
    return this.indices.playerIndex.get(playerId) || new Set();
  }

  queryByDate(startDate: Date, endDate: Date): Set<string> {
    const results = new Set<string>();
    const startWeek = this.getWeekKey(startDate);
    const endWeek = this.getWeekKey(endDate);

    for (const [weekKey, entries] of this.indices.dateIndex) {
      if (weekKey >= startWeek && weekKey <= endWeek) {
        entries.forEach(e => results.add(e));
      }
    }

    return results;
  }

  queryByType(type: string): Set<string> {
    return this.indices.typeIndex.get(type) || new Set();
  }

  // Batch query optimization
  batchQuery(queries: {
    managers?: string[];
    players?: string[];
    types?: string[];
    dateRange?: { start: Date; end: Date };
  }): Set<string> {
    const results: Set<string>[] = [];

    if (queries.managers) {
      for (const managerId of queries.managers) {
        results.push(this.queryByManager(managerId));
      }
    }

    if (queries.players) {
      for (const playerId of queries.players) {
        results.push(this.queryByPlayer(playerId));
      }
    }

    if (queries.types) {
      for (const type of queries.types) {
        results.push(this.queryByType(type));
      }
    }

    if (queries.dateRange) {
      results.push(this.queryByDate(queries.dateRange.start, queries.dateRange.end));
    }

    // Intersect all results
    if (results.length === 0) return new Set();
    if (results.length === 1) return results[0];

    let intersection = results[0];
    for (let i = 1; i < results.length; i++) {
      intersection = new Set([...intersection].filter(x => results[i].has(x)));
    }

    return intersection;
  }

  // Helper methods
  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}_${week}`;
  }

  private getRecentTransactions(memory: LeagueMemory, count: number): Transaction[] {
    const allTransactions: Transaction[] = [];
    
    for (const season of memory.seasons) {
      allTransactions.push(...season.transactions);
    }

    return allTransactions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);
  }

  // Memory usage statistics
  getMemoryStats(): {
    cacheSize: number;
    indexSize: number;
    totalEntries: number;
    hitRate: number;
  } {
    const totalEntries = 
      this.indices.managerIndex.size +
      this.indices.playerIndex.size +
      this.indices.dateIndex.size +
      this.indices.typeIndex.size;

    let totalIndexEntries = 0;
    for (const index of Object.values(this.indices)) {
      for (const entries of index.values()) {
        totalIndexEntries += entries.size;
      }
    }

    const hits = Array.from(this.accessFrequency.values()).reduce((sum, freq) => sum + freq, 0);
    const hitRate = hits > 0 ? this.cache.size / hits : 0;

    return {
      cacheSize: this.getCacheSize(),
      indexSize: totalIndexEntries,
      totalEntries,
      hitRate
    };
  }
}