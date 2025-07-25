// League Memory - Main orchestrator for the persistent memory system

import {
  LeagueMemory,
  ManagerProfile,
  SeasonMemory,
  Transaction,
  Trade,
  DraftResult,
  WaiverClaim,
  LineupDecision,
  ChatMessage,
  LeaguePatterns,
  LeaguePredictions,
  MemoryInsight
} from './types';

import { DataPersistence } from './data-persistence';
import { PatternAnalyzer } from './pattern-analyzer';
import { ManagerProfiler } from './manager-profiler';
import { PredictionEngine } from './prediction-engine';
import { InsightGenerator } from './insight-generator';
import { PerformanceTracker } from './performance-tracker';
import { MemoryOptimizer } from './memory-optimizer';
import { logger } from '../../../logging/logger';

export class LeagueMemorySystem {
  private persistence: DataPersistence;
  private patternAnalyzer: PatternAnalyzer;
  private managerProfiler: ManagerProfiler;
  private predictionEngine: PredictionEngine;
  private insightGenerator: InsightGenerator;
  private performanceTracker: PerformanceTracker;
  private optimizer: MemoryOptimizer;
  
  private memory: LeagueMemory | null = null;
  private patterns: LeaguePatterns | null = null;
  private predictions: LeaguePredictions | null = null;
  private insights: MemoryInsight[] = [];
  
  private updateQueue: any[] = [];
  private isProcessing: boolean = false;

  constructor(
    private leagueId: string,
    private platform: 'espn' | 'yahoo' | 'sleeper' | 'fleaflicker',
    private sport: string
  ) {
    this.persistence = new DataPersistence(leagueId);
    this.patternAnalyzer = new PatternAnalyzer();
    this.managerProfiler = new ManagerProfiler();
    this.predictionEngine = new PredictionEngine();
    this.insightGenerator = new InsightGenerator();
    this.performanceTracker = new PerformanceTracker();
    this.optimizer = new MemoryOptimizer();
  }

  // Initialize the memory system
  async initialize(): Promise<void> {
    // Load existing memory or create new
    this.memory = await this.persistence.loadLeagueMemory();
    
    if (!this.memory) {
      this.memory = this.createNewMemory();
      await this.persistence.saveLeagueMemory(this.memory);
    }

    // Optimize memory structure
    this.memory = this.optimizer.optimizeMemory(this.memory);

    // Analyze patterns
    await this.analyzePatterns();

    // Generate predictions
    await this.generatePredictions();

    // Generate insights
    await this.generateInsights();
  }

  // Create new memory structure
  private createNewMemory(): LeagueMemory {
    return {
      leagueId: this.leagueId,
      platform: this.platform,
      sport: this.sport,
      seasons: [],
      managers: [],
      patterns: {
        draftPatterns: { positionRuns: [], reachTendencies: [], valueIdentification: [] },
        tradePatterns: { seasonalTrends: [], buyLowSellHigh: [], panicTrades: [] },
        waiverPatterns: { claimTiming: [], bidPatterns: [], priorityUsage: [] },
        behavioralPatterns: { tiltBehavior: [], rivalryIntensity: [], groupThink: [] }
      },
      predictions: {
        draftPredictions: [],
        tradePredictions: [],
        waiverPredictions: [],
        seasonPredictions: [],
        behaviorPredictions: []
      },
      metadata: {
        created: new Date(),
        lastUpdated: new Date(),
        totalSeasons: 0,
        totalTransactions: 0,
        totalTrades: 0,
        totalMessages: 0,
        dataQuality: 0,
        memoryDepth: 0
      }
    };
  }

  // Real-time event logging
  async logTransaction(transaction: Transaction): Promise<void> {
    this.updateQueue.push({ type: 'transaction', data: transaction });
    await this.processUpdateQueue();
  }

  async logTrade(trade: Trade): Promise<void> {
    this.updateQueue.push({ type: 'trade', data: trade });
    await this.processUpdateQueue();
  }

  async logDraftPick(pick: DraftResult): Promise<void> {
    this.updateQueue.push({ type: 'draft', data: pick });
    await this.processUpdateQueue();
  }

  async logWaiverClaim(claim: WaiverClaim): Promise<void> {
    this.updateQueue.push({ type: 'waiver', data: claim });
    await this.processUpdateQueue();
  }

  async logLineupDecision(decision: LineupDecision): Promise<void> {
    this.updateQueue.push({ type: 'lineup', data: decision });
    await this.processUpdateQueue();
  }

  async logChatMessage(message: ChatMessage): Promise<void> {
    this.updateQueue.push({ type: 'chat', data: message });
    // Process chat less frequently
    if (this.updateQueue.filter(u => u.type === 'chat').length >= 10) {
      await this.processUpdateQueue();
    }
  }

  // Process queued updates
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.length === 0) return;
    
    this.isProcessing = true;
    const updates = [...this.updateQueue];
    this.updateQueue = [];

    try {
      for (const update of updates) {
        await this.processUpdate(update);
      }

      // Re-analyze patterns if significant updates
      if (updates.filter(u => u.type !== 'chat').length > 5) {
        await this.analyzePatterns();
        await this.generatePredictions();
        await this.generateInsights();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Process individual update
  private async processUpdate(update: any): Promise<void> {
    if (!this.memory) return;

    const currentSeason = this.getCurrentOrCreateSeason();

    switch (update.type) {
      case 'transaction':
        await this.persistence.logTransaction(update.data);
        currentSeason.transactions.push(update.data);
        this.memory.metadata.totalTransactions++;
        break;
        
      case 'trade':
        await this.persistence.logTrade(update.data);
        currentSeason.trades.push(update.data);
        this.memory.metadata.totalTrades++;
        break;
        
      case 'draft':
        currentSeason.draftResults.push(update.data);
        break;
        
      case 'waiver':
        currentSeason.waiverClaims.push(update.data);
        break;
        
      case 'lineup':
        currentSeason.lineupDecisions.push(update.data);
        break;
        
      case 'chat':
        await this.persistence.logChatMessage(update.data);
        currentSeason.chatMessages.push(update.data);
        this.memory.metadata.totalMessages++;
        break;
    }

    this.memory.metadata.lastUpdated = new Date();
  }

  // Get or create current season
  private getCurrentOrCreateSeason(): SeasonMemory {
    if (!this.memory) throw new Error('Memory not initialized');

    const currentYear = new Date().getFullYear();
    let currentSeason = this.memory.seasons.find(s => s.year === currentYear);

    if (!currentSeason) {
      currentSeason = {
        year: currentYear,
        transactions: [],
        trades: [],
        draftResults: [],
        waiverClaims: [],
        lineupDecisions: [],
        chatMessages: [],
        standings: [],
        playoffs: null as any
      };
      this.memory.seasons.push(currentSeason);
      this.memory.metadata.totalSeasons++;
    }

    return currentSeason;
  }

  // Analyze patterns in the data
  private async analyzePatterns(): Promise<void> {
    if (!this.memory) return;

    this.patterns = this.patternAnalyzer.analyzePatterns(this.memory);
    this.memory.patterns = this.patterns;

    // Update manager profiles
    for (const manager of this.memory.managers) {
      const profile = this.managerProfiler.buildProfile(manager.managerId, this.memory);
      Object.assign(manager, profile);
    }
  }

  // Generate predictions
  private async generatePredictions(): Promise<void> {
    if (!this.memory) return;

    this.predictions = this.predictionEngine.generatePredictions(this.memory);
    this.memory.predictions = this.predictions;
  }

  // Generate insights
  private async generateInsights(): Promise<void> {
    if (!this.memory || !this.patterns || !this.predictions) return;

    this.insights = this.insightGenerator.generateInsights(
      this.memory,
      this.patterns,
      this.predictions
    );
  }

  // Public API methods

  // Get manager profile
  getManagerProfile(managerId: string): ManagerProfile | null {
    if (!this.memory) return null;
    return this.memory.managers.find(m => m.managerId === managerId) || null;
  }

  // Get current insights
  getInsights(): MemoryInsight[] {
    return this.insights;
  }

  // Get predictions
  getPredictions(): LeaguePredictions | null {
    return this.predictions;
  }

  // Get patterns
  getPatterns(): LeaguePatterns | null {
    return this.patterns;
  }

  // Get league performance metrics
  getLeagueMetrics() {
    if (!this.memory) return null;
    return this.performanceTracker.calculateLeagueMetrics(this.memory);
  }

  // Get manager performance
  getManagerPerformance(managerId: string) {
    if (!this.memory) return null;
    return this.performanceTracker.trackManagerPerformance(managerId, this.memory);
  }

  // Query historical data
  async queryTransactions(filter: {
    managerId?: string;
    playerId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.persistence.queryTransactions(filter);
  }

  async queryTrades(filter: {
    managerId?: string;
    playerId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.persistence.queryTrades(filter);
  }

  // Get manager history
  async getManagerHistory(managerId: string) {
    return this.persistence.getManagerHistory(managerId);
  }

  // Fast queries using optimizer
  queryByManager(managerId: string) {
    return this.optimizer.queryByManager(managerId);
  }

  queryByPlayer(playerId: string) {
    return this.optimizer.queryByPlayer(playerId);
  }

  // Add new manager
  async addManager(managerId: string, name: string): Promise<void> {
    if (!this.memory) return;

    const existing = this.memory.managers.find(m => m.managerId === managerId);
    if (!existing) {
      const profile = this.managerProfiler.buildProfile(managerId, this.memory);
      profile.name = name;
      profile.joinDate = new Date();
      this.memory.managers.push(profile);
      await this.persistence.saveLeagueMemory(this.memory);
    }
  }

  // Update standings
  async updateStandings(week: number, rankings: any[]): Promise<void> {
    if (!this.memory) return;

    const currentSeason = this.getCurrentOrCreateSeason();
    currentSeason.standings[week] = {
      week,
      rankings
    };

    await this.persistence.saveLeagueMemory(this.memory);
  }

  // Update playoff results
  async updatePlayoffResults(results: any): Promise<void> {
    if (!this.memory) return;

    const currentSeason = this.getCurrentOrCreateSeason();
    currentSeason.playoffs = results;

    await this.persistence.saveLeagueMemory(this.memory);
  }

  // Get memory statistics
  getMemoryStats() {
    return {
      ...this.optimizer.getMemoryStats(),
      seasons: this.memory?.seasons.length || 0,
      managers: this.memory?.managers.length || 0,
      totalTransactions: this.memory?.metadata.totalTransactions || 0,
      totalTrades: this.memory?.metadata.totalTrades || 0,
      dataQuality: this.memory?.metadata.dataQuality || 0
    };
  }

  // Export memory data
  async exportMemory(): Promise<string> {
    if (!this.memory) return '{}';
    return JSON.stringify(this.memory, null, 2);
  }

  // Import memory data
  async importMemory(data: string): Promise<void> {
    try {
      const imported = JSON.parse(data);
      // Validate structure
      if (imported.leagueId && imported.seasons && imported.managers) {
        this.memory = imported;
        await this.persistence.saveLeagueMemory(this.memory);
        await this.initialize();
      }
    } catch (error) {
      logger.error('Failed to import memory:', { error: error });
      throw new Error('Invalid memory data format');
    }
  }
}