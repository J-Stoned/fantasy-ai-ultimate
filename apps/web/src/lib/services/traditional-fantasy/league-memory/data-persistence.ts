// Data Persistence - Cross-season storage and retrieval

import { LeagueMemory, SeasonMemory, Transaction, Trade, DraftResult, WaiverClaim, LineupDecision, ChatMessage } from './types';
import { logger } from '../../../logging/logger';

export class DataPersistence {
  private storageKey: string;
  private compressionEnabled: boolean = true;
  private maxSeasons: number = 10;
  private cache: Map<string, any> = new Map();

  constructor(private leagueId: string) {
    this.storageKey = `league_memory_${leagueId}`;
  }

  // Save complete league memory
  async saveLeagueMemory(memory: LeagueMemory): Promise<void> {
    try {
      // Compress old seasons
      const compressed = this.compressMemory(memory);
      
      // Store in IndexedDB for large data
      await this.saveToIndexedDB(compressed);
      
      // Store metadata in localStorage for quick access
      this.saveMetadata(memory);
      
      // Update cache
      this.cache.set(this.storageKey, memory);
    } catch (error) {
      logger.error('Failed to save league memory:', { error: error });
      // Fallback to localStorage with compression
      this.saveToLocalStorage(memory);
    }
  }

  // Load complete league memory
  async loadLeagueMemory(): Promise<LeagueMemory | null> {
    try {
      // Check cache first
      if (this.cache.has(this.storageKey)) {
        return this.cache.get(this.storageKey);
      }

      // Load from IndexedDB
      const compressed = await this.loadFromIndexedDB();
      if (compressed) {
        const memory = this.decompressMemory(compressed);
        this.cache.set(this.storageKey, memory);
        return memory;
      }

      // Fallback to localStorage
      return this.loadFromLocalStorage();
    } catch (error) {
      logger.error('Failed to load league memory:', { error: error });
      return null;
    }
  }

  // Add new season data
  async addSeasonData(seasonMemory: SeasonMemory): Promise<void> {
    const memory = await this.loadLeagueMemory();
    if (!memory) return;

    // Add new season
    memory.seasons.push(seasonMemory);

    // Maintain season limit
    if (memory.seasons.length > this.maxSeasons) {
      // Archive old seasons
      await this.archiveOldSeasons(memory.seasons.slice(0, -this.maxSeasons));
      memory.seasons = memory.seasons.slice(-this.maxSeasons);
    }

    // Update metadata
    memory.metadata.totalSeasons = memory.seasons.length;
    memory.metadata.lastUpdated = new Date();

    await this.saveLeagueMemory(memory);
  }

  // Real-time transaction logging
  async logTransaction(transaction: Transaction): Promise<void> {
    const memory = await this.loadLeagueMemory();
    if (!memory) return;

    const currentSeason = this.getCurrentSeason(memory);
    if (currentSeason) {
      currentSeason.transactions.push(transaction);
      memory.metadata.totalTransactions++;
      memory.metadata.lastUpdated = new Date();
      await this.saveLeagueMemory(memory);
    }
  }

  // Real-time trade logging
  async logTrade(trade: Trade): Promise<void> {
    const memory = await this.loadLeagueMemory();
    if (!memory) return;

    const currentSeason = this.getCurrentSeason(memory);
    if (currentSeason) {
      currentSeason.trades.push(trade);
      memory.metadata.totalTrades++;
      memory.metadata.lastUpdated = new Date();
      await this.saveLeagueMemory(memory);
    }
  }

  // Real-time chat logging
  async logChatMessage(message: ChatMessage): Promise<void> {
    const memory = await this.loadLeagueMemory();
    if (!memory) return;

    const currentSeason = this.getCurrentSeason(memory);
    if (currentSeason) {
      currentSeason.chatMessages.push(message);
      memory.metadata.totalMessages++;
      memory.metadata.lastUpdated = new Date();
      
      // Only save every 10 messages to reduce writes
      if (memory.metadata.totalMessages % 10 === 0) {
        await this.saveLeagueMemory(memory);
      }
    }
  }

  // Query historical data
  async queryTransactions(
    filter: {
      managerId?: string;
      playerId?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Transaction[]> {
    const memory = await this.loadLeagueMemory();
    if (!memory) return [];

    const transactions: Transaction[] = [];
    
    for (const season of memory.seasons) {
      for (const transaction of season.transactions) {
        if (this.matchesTransactionFilter(transaction, filter)) {
          transactions.push(transaction);
        }
      }
    }

    return transactions;
  }

  // Query trades
  async queryTrades(
    filter: {
      managerId?: string;
      playerId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Trade[]> {
    const memory = await this.loadLeagueMemory();
    if (!memory) return [];

    const trades: Trade[] = [];
    
    for (const season of memory.seasons) {
      for (const trade of season.trades) {
        if (this.matchesTradeFilter(trade, filter)) {
          trades.push(trade);
        }
      }
    }

    return trades;
  }

  // Get manager history
  async getManagerHistory(managerId: string): Promise<{
    transactions: Transaction[];
    trades: Trade[];
    draftPicks: DraftResult[];
    waiverClaims: WaiverClaim[];
    lineupDecisions: LineupDecision[];
  }> {
    const memory = await this.loadLeagueMemory();
    if (!memory) {
      return {
        transactions: [],
        trades: [],
        draftPicks: [],
        waiverClaims: [],
        lineupDecisions: []
      };
    }

    const history = {
      transactions: [] as Transaction[],
      trades: [] as Trade[],
      draftPicks: [] as DraftResult[],
      waiverClaims: [] as WaiverClaim[],
      lineupDecisions: [] as LineupDecision[]
    };

    for (const season of memory.seasons) {
      // Transactions
      history.transactions.push(
        ...season.transactions.filter(t => t.managerId === managerId)
      );

      // Trades
      history.trades.push(
        ...season.trades.filter(t => 
          t.team1.managerId === managerId || t.team2.managerId === managerId
        )
      );

      // Draft picks
      history.draftPicks.push(
        ...season.draftResults.filter(d => d.managerId === managerId)
      );

      // Waiver claims
      history.waiverClaims.push(
        ...season.waiverClaims.filter(w => w.managerId === managerId)
      );

      // Lineup decisions
      history.lineupDecisions.push(
        ...season.lineupDecisions.filter(l => l.managerId === managerId)
      );
    }

    return history;
  }

  // Private helper methods
  private getCurrentSeason(memory: LeagueMemory): SeasonMemory | null {
    const currentYear = new Date().getFullYear();
    return memory.seasons.find(s => s.year === currentYear) || null;
  }

  private compressMemory(memory: LeagueMemory): any {
    if (!this.compressionEnabled) return memory;

    // Compress old seasons more aggressively
    const compressed = { ...memory };
    compressed.seasons = memory.seasons.map((season, index) => {
      const seasonsAgo = memory.seasons.length - index - 1;
      
      if (seasonsAgo > 2) {
        // Compress old seasons
        return this.compressSeason(season);
      }
      
      return season;
    });

    return compressed;
  }

  private compressSeason(season: SeasonMemory): any {
    // Remove less important data from old seasons
    return {
      ...season,
      chatMessages: [], // Remove old chat
      lineupDecisions: season.lineupDecisions.filter((_, i) => i % 4 === 0), // Keep every 4th
      transactions: season.transactions.slice(-100), // Keep last 100
    };
  }

  private decompressMemory(compressed: any): LeagueMemory {
    // Restore full structure
    return compressed as LeagueMemory;
  }

  private async saveToIndexedDB(data: any): Promise<void> {
    const db = await this.openDatabase();
    const transaction = db.transaction(['leagueMemory'], 'readwrite');
    const store = transaction.objectStore('leagueMemory');
    await store.put({ id: this.storageKey, data });
  }

  private async loadFromIndexedDB(): Promise<any> {
    const db = await this.openDatabase();
    const transaction = db.transaction(['leagueMemory'], 'readonly');
    const store = transaction.objectStore('leagueMemory');
    const result = await store.get(this.storageKey);
    return result?.data;
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FantasyLeagueMemory', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('leagueMemory')) {
          db.createObjectStore('leagueMemory', { keyPath: 'id' });
        }
      };
    });
  }

  private saveToLocalStorage(memory: LeagueMemory): void {
    try {
      const compressed = this.compressMemory(memory);
      localStorage.setItem(this.storageKey, JSON.stringify(compressed));
    } catch (error) {
      logger.error('Failed to save to localStorage:', { error: error });
      // Clear old data and try again
      this.clearOldData();
      localStorage.setItem(this.storageKey, JSON.stringify(this.compressMemory(memory)));
    }
  }

  private loadFromLocalStorage(): LeagueMemory | null {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return this.decompressMemory(JSON.parse(data));
      }
      return null;
    } catch (error) {
      logger.error('Failed to load from localStorage:', { error: error });
      return null;
    }
  }

  private saveMetadata(memory: LeagueMemory): void {
    const metadata = {
      leagueId: memory.leagueId,
      platform: memory.platform,
      sport: memory.sport,
      lastUpdated: memory.metadata.lastUpdated,
      totalSeasons: memory.metadata.totalSeasons,
      totalTransactions: memory.metadata.totalTransactions,
      dataQuality: memory.metadata.dataQuality
    };
    
    localStorage.setItem(`${this.storageKey}_metadata`, JSON.stringify(metadata));
  }

  private async archiveOldSeasons(seasons: SeasonMemory[]): Promise<void> {
    // Archive to separate storage
    const archiveKey = `${this.storageKey}_archive`;
    const existingArchive = await this.loadArchive(archiveKey);
    const newArchive = [...(existingArchive || []), ...seasons];
    
    await this.saveArchive(archiveKey, newArchive);
  }

  private async loadArchive(key: string): Promise<SeasonMemory[]> {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private async saveArchive(key: string, seasons: SeasonMemory[]): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(seasons));
    } catch (error) {
      logger.error('Failed to save archive:', { error: error });
    }
  }

  private clearOldData(): void {
    // Clear old data to make space
    const keys = Object.keys(localStorage);
    const oldKeys = keys.filter(k => k.includes('league_memory_') && k !== this.storageKey);
    oldKeys.forEach(k => localStorage.removeItem(k));
  }

  private matchesTransactionFilter(
    transaction: Transaction,
    filter: any
  ): boolean {
    if (filter.managerId && transaction.managerId !== filter.managerId) return false;
    if (filter.type && transaction.type !== filter.type) return false;
    if (filter.startDate && transaction.timestamp < filter.startDate) return false;
    if (filter.endDate && transaction.timestamp > filter.endDate) return false;
    if (filter.playerId) {
      const hasPlayer = transaction.players.some(p => p.playerId === filter.playerId);
      if (!hasPlayer) return false;
    }
    return true;
  }

  private matchesTradeFilter(trade: Trade, filter: any): boolean {
    if (filter.managerId && 
        trade.team1.managerId !== filter.managerId && 
        trade.team2.managerId !== filter.managerId) return false;
    if (filter.startDate && trade.timestamp < filter.startDate) return false;
    if (filter.endDate && trade.timestamp > filter.endDate) return false;
    if (filter.playerId) {
      const hasPlayer = 
        trade.team1.playersGiven.includes(filter.playerId) ||
        trade.team1.playersReceived.includes(filter.playerId) ||
        trade.team2.playersGiven.includes(filter.playerId) ||
        trade.team2.playersReceived.includes(filter.playerId);
      if (!hasPlayer) return false;
    }
    return true;
  }
}