/**
 * Real-Time Market Data Feed System for DFS
 * WebSocket connections to DK/FD with comprehensive market monitoring
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface MarketDataConfig {
  platforms: PlatformConfig[];
  redis: {
    url: string;
    keyPrefix: string;
  };
  newsFeeds: NewsFeedConfig[];
  weatherApi: WeatherConfig;
  updateIntervals: {
    ownership: number;
    contests: number;
    news: number;
    weather: number;
    injuries: number;
  };
  thresholds: MarketThresholds;
}

interface PlatformConfig {
  name: 'DraftKings' | 'FanDuel' | 'Yahoo' | 'SuperDraft';
  apiBaseUrl: string;
  wsUrl: string;
  authConfig: {
    type: 'oauth' | 'session' | 'apikey';
    credentials: any;
  };
  endpoints: {
    contests: string;
    ownership: string;
    lineups: string;
    live: string;
  };
  rateLimits: {
    requests: number;
    window: number;
  };
}

interface NewsFeedConfig {
  name: string;
  url: string;
  type: 'rss' | 'api' | 'scrape';
  sports: string[];
  keywords: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface WeatherConfig {
  apiKey: string;
  baseUrl: string;
  locations: string[];
}

interface MarketThresholds {
  ownershipShift: number;
  contestFillRate: number;
  newsImpact: number;
  weatherSeverity: number;
  overlayThreshold: number;
}

interface OwnershipData {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  salary: number;
  ownership: number;
  projectedOwnership: number;
  ownershipTrend: 'UP' | 'DOWN' | 'STABLE';
  changePercent: number;
  timestamp: Date;
  platform: string;
  contestType: string;
}

interface ContestData {
  contestId: string;
  platform: string;
  name: string;
  sport: string;
  entryFee: number;
  totalPrize: number;
  maxEntries: number;
  currentEntries: number;
  fillRate: number;
  isOverlay: boolean;
  overlayValue?: number;
  startTime: Date;
  status: 'UPCOMING' | 'FILLING' | 'LIVE' | 'COMPLETED';
  payoutStructure: PayoutTier[];
}

interface PayoutTier {
  minRank: number;
  maxRank: number;
  payout: number;
  percentage: number;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  timestamp: Date;
  sport: string;
  players: string[];
  teams: string[];
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  keywords: string[];
  confidence: number;
}

interface InjuryReport {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  status: 'QUESTIONABLE' | 'DOUBTFUL' | 'OUT' | 'IR' | 'HEALTHY';
  injury: string;
  expectedReturn?: Date;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lastUpdated: Date;
  source: string;
}

interface WeatherAlert {
  location: string;
  stadium: string;
  game: string;
  conditions: {
    temperature: number;
    windSpeed: number;
    windDirection: string;
    precipitation: number;
    humidity: number;
    visibility: number;
  };
  forecast: WeatherForecast[];
  alerts: string[];
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
  affectedGames: string[];
}

interface WeatherForecast {
  time: Date;
  temperature: number;
  windSpeed: number;
  precipitation: number;
  conditions: string;
}

interface LineupChange {
  playerId: string;
  playerName: string;
  team: string;
  changeType: 'ADDED' | 'REMOVED' | 'POSITION_CHANGE' | 'SALARY_CHANGE';
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  platform: string;
  contestIds: string[];
}

export class MarketDataFeed extends EventEmitter {
  private redis: Redis;
  private config: MarketDataConfig;
  private platformConnections: Map<string, PlatformConnection>;
  private newsFeeds: Map<string, NewsFeedMonitor>;
  private weatherMonitor: WeatherMonitor;
  private injuryMonitor: InjuryMonitor;
  private ownershipCache: Map<string, OwnershipData>;
  private contestCache: Map<string, ContestData>;
  private updateIntervals: Map<string, NodeJS.Timeout>;
  private isRunning: boolean = false;

  constructor(config: MarketDataConfig) {
    super();
    this.config = config;
    this.redis = new Redis(config.redis.url);
    this.platformConnections = new Map();
    this.newsFeeds = new Map();
    this.ownershipCache = new Map();
    this.contestCache = new Map();
    this.updateIntervals = new Map();
    
    // Initialize components
    this.weatherMonitor = new WeatherMonitor(config.weatherApi, this.redis);
    this.injuryMonitor = new InjuryMonitor(this.redis);
    
    // Setup event handlers
    this.setupEventHandlers();
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log('Starting Market Data Feed...');
    this.isRunning = true;
    
    // Initialize platform connections
    await this.initializePlatformConnections();
    
    // Initialize news feeds
    await this.initializeNewsFeeds();
    
    // Start monitoring services
    await this.weatherMonitor.start();
    await this.injuryMonitor.start();
    
    // Start update intervals
    this.startUpdateIntervals();
    
    console.log('Market Data Feed started successfully');
    this.emit('started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log('Stopping Market Data Feed...');
    this.isRunning = false;
    
    // Stop all intervals
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();
    
    // Close platform connections
    for (const connection of this.platformConnections.values()) {
      await connection.disconnect();
    }
    
    // Stop monitoring services
    await this.weatherMonitor.stop();
    await this.injuryMonitor.stop();
    
    // Close Redis connection
    await this.redis.quit();
    
    console.log('Market Data Feed stopped');
    this.emit('stopped');
  }

  private async initializePlatformConnections(): Promise<void> {
    for (const platformConfig of this.config.platforms) {
      try {
        const connection = new PlatformConnection(platformConfig, this.redis);
        await connection.connect();
        
        // Setup event listeners
        connection.on('ownershipUpdate', (data) => this.handleOwnershipUpdate(data));
        connection.on('contestUpdate', (data) => this.handleContestUpdate(data));
        connection.on('lineupChange', (data) => this.handleLineupChange(data));
        connection.on('error', (error) => this.handleConnectionError(platformConfig.name, error));
        
        this.platformConnections.set(platformConfig.name, connection);
        console.log(`Connected to ${platformConfig.name}`);
        
      } catch (error) {
        console.error(`Failed to connect to ${platformConfig.name}:`, error);
      }
    }
  }

  private async initializeNewsFeeds(): Promise<void> {
    for (const feedConfig of this.config.newsFeeds) {
      try {
        const feed = new NewsFeedMonitor(feedConfig, this.redis);
        feed.on('newsItem', (item) => this.handleNewsItem(item));
        feed.on('error', (error) => this.handleNewsFeedError(feedConfig.name, error));
        
        await feed.start();
        this.newsFeeds.set(feedConfig.name, feed);
        console.log(`News feed ${feedConfig.name} started`);
        
      } catch (error) {
        console.error(`Failed to start news feed ${feedConfig.name}:`, error);
      }
    }
  }

  private setupEventHandlers(): void {
    // Weather event handlers
    this.weatherMonitor.on('weatherAlert', (alert) => this.handleWeatherAlert(alert));
    this.weatherMonitor.on('weatherUpdate', (data) => this.handleWeatherUpdate(data));
    
    // Injury event handlers
    this.injuryMonitor.on('injuryUpdate', (report) => this.handleInjuryUpdate(report));
    this.injuryMonitor.on('statusChange', (change) => this.handlePlayerStatusChange(change));
  }

  private startUpdateIntervals(): void {
    // Ownership monitoring
    this.updateIntervals.set('ownership', setInterval(() => {
      this.updateOwnershipData();
    }, this.config.updateIntervals.ownership));
    
    // Contest monitoring
    this.updateIntervals.set('contests', setInterval(() => {
      this.updateContestData();
    }, this.config.updateIntervals.contests));
    
    // News monitoring
    this.updateIntervals.set('news', setInterval(() => {
      this.updateNewsFeeds();
    }, this.config.updateIntervals.news));
    
    // Weather monitoring
    this.updateIntervals.set('weather', setInterval(() => {
      this.weatherMonitor.update();
    }, this.config.updateIntervals.weather));
    
    // Injury monitoring
    this.updateIntervals.set('injuries', setInterval(() => {
      this.injuryMonitor.update();
    }, this.config.updateIntervals.injuries));
  }

  private async updateOwnershipData(): Promise<void> {
    for (const [platform, connection] of this.platformConnections) {
      try {
        const ownershipData = await connection.getOwnershipData();
        for (const data of ownershipData) {
          await this.processOwnershipData(data);
        }
      } catch (error) {
        console.error(`Error updating ownership for ${platform}:`, error);
      }
    }
  }

  private async processOwnershipData(data: OwnershipData): Promise<void> {
    const key = `${data.platform}:${data.playerId}:${data.contestType}`;
    const existing = this.ownershipCache.get(key);
    
    if (existing) {
      // Calculate trend and change
      const change = data.ownership - existing.ownership;
      data.changePercent = existing.ownership > 0 ? (change / existing.ownership) * 100 : 0;
      
      if (Math.abs(change) > this.config.thresholds.ownershipShift) {
        data.ownershipTrend = change > 0 ? 'UP' : 'DOWN';
        
        // Emit significant ownership shift
        this.emit('ownershipShift', {
          player: data,
          change,
          significance: Math.abs(data.changePercent)
        });
      } else {
        data.ownershipTrend = 'STABLE';
      }
    }
    
    // Update cache
    this.ownershipCache.set(key, data);
    
    // Store in Redis
    await this.redis.setex(
      `${this.config.redis.keyPrefix}:ownership:${key}`,
      3600, // 1 hour TTL
      JSON.stringify(data)
    );
    
    // Emit update
    this.emit('ownershipUpdate', data);
  }

  private async updateContestData(): Promise<void> {
    for (const [platform, connection] of this.platformConnections) {
      try {
        const contests = await connection.getContestData();
        for (const contest of contests) {
          await this.processContestData(contest);
        }
      } catch (error) {
        console.error(`Error updating contests for ${platform}:`, error);
      }
    }
  }

  private async processContestData(contest: ContestData): Promise<void> {
    const existing = this.contestCache.get(contest.contestId);
    
    // Calculate fill rate
    contest.fillRate = (contest.currentEntries / contest.maxEntries) * 100;
    
    // Check for overlay
    const expectedEntries = contest.maxEntries * (this.config.thresholds.contestFillRate / 100);
    if (contest.currentEntries < expectedEntries && contest.fillRate < this.config.thresholds.overlayThreshold) {
      contest.isOverlay = true;
      contest.overlayValue = contest.totalPrize - (contest.currentEntries * contest.entryFee);
      
      // Emit overlay alert
      this.emit('overlayAlert', {
        contest,
        overlayValue: contest.overlayValue,
        fillRate: contest.fillRate
      });
    }
    
    // Check for significant fill rate changes
    if (existing && Math.abs(contest.fillRate - existing.fillRate) > 5) {
      this.emit('fillRateChange', {
        contest,
        previousFillRate: existing.fillRate,
        currentFillRate: contest.fillRate
      });
    }
    
    // Update cache
    this.contestCache.set(contest.contestId, contest);
    
    // Store in Redis
    await this.redis.setex(
      `${this.config.redis.keyPrefix}:contest:${contest.contestId}`,
      7200, // 2 hour TTL
      JSON.stringify(contest)
    );
    
    // Emit update
    this.emit('contestUpdate', contest);
  }

  private async updateNewsFeeds(): Promise<void> {
    for (const [name, feed] of this.newsFeeds) {
      try {
        await feed.checkForUpdates();
      } catch (error) {
        console.error(`Error updating news feed ${name}:`, error);
      }
    }
  }

  private handleOwnershipUpdate(data: OwnershipData): void {
    this.processOwnershipData(data);
  }

  private handleContestUpdate(data: ContestData): void {
    this.processContestData(data);
  }

  private handleLineupChange(change: LineupChange): void {
    // Store lineup change
    this.redis.lpush(
      `${this.config.redis.keyPrefix}:lineup_changes`,
      JSON.stringify(change)
    );
    
    // Emit change
    this.emit('lineupChange', change);
    
    // Check if this affects high-ownership players
    this.checkLineupChangeImpact(change);
  }

  private async checkLineupChangeImpact(change: LineupChange): Promise<void> {
    // Get player ownership data
    const ownershipKeys = await this.redis.keys(
      `${this.config.redis.keyPrefix}:ownership:*:${change.playerId}:*`
    );
    
    for (const key of ownershipKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const ownership = JSON.parse(data) as OwnershipData;
        if (ownership.ownership > 20) { // High ownership threshold
          this.emit('highOwnershipLineupChange', {
            change,
            ownership: ownership.ownership,
            impact: 'HIGH'
          });
        }
      }
    }
  }

  private handleNewsItem(item: NewsItem): void {
    // Store news item
    this.redis.lpush(
      `${this.config.redis.keyPrefix}:news`,
      JSON.stringify(item)
    );
    
    // Trim to keep only recent items
    this.redis.ltrim(`${this.config.redis.keyPrefix}:news`, 0, 999);
    
    // Emit news
    this.emit('news', item);
    
    // Check for high-impact news
    if (item.impact === 'HIGH' || item.impact === 'CRITICAL') {
      this.emit('criticalNews', item);
      this.analyzeNewsImpact(item);
    }
  }

  private async analyzeNewsImpact(item: NewsItem): Promise<void> {
    // Analyze which players/games might be affected
    const affectedPlayers = await this.findAffectedPlayers(item);
    const affectedContests = await this.findAffectedContests(item);
    
    if (affectedPlayers.length > 0 || affectedContests.length > 0) {
      this.emit('newsImpactAnalysis', {
        news: item,
        affectedPlayers,
        affectedContests,
        recommendedActions: this.generateNewsRecommendations(item, affectedPlayers)
      });
    }
  }

  private async findAffectedPlayers(item: NewsItem): Promise<string[]> {
    // Use NLP to extract player names and match against roster
    const playerNames = item.players;
    const matchedPlayers: string[] = [];
    
    for (const playerName of playerNames) {
      // Search for players in ownership data
      const keys = await this.redis.keys(`${this.config.redis.keyPrefix}:ownership:*`);
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const ownership = JSON.parse(data) as OwnershipData;
          if (ownership.playerName.toLowerCase().includes(playerName.toLowerCase())) {
            matchedPlayers.push(ownership.playerId);
          }
        }
      }
    }
    
    return matchedPlayers;
  }

  private async findAffectedContests(item: NewsItem): Promise<string[]> {
    // Find contests for the affected sport/teams
    const affectedContests: string[] = [];
    
    for (const [contestId, contest] of this.contestCache) {
      if (contest.sport === item.sport && item.teams.length > 0) {
        // Check if any teams match
        affectedContests.push(contestId);
      }
    }
    
    return affectedContests;
  }

  private generateNewsRecommendations(item: NewsItem, affectedPlayers: string[]): string[] {
    const recommendations: string[] = [];
    
    if (item.impact === 'CRITICAL') {
      recommendations.push('Consider avoiding affected players');
      recommendations.push('Monitor ownership shifts closely');
      recommendations.push('Review lineup exposure');
    }
    
    if (item.sentiment === 'NEGATIVE') {
      recommendations.push('Potential fade opportunity');
      recommendations.push('Look for contrarian plays');
    } else if (item.sentiment === 'POSITIVE') {
      recommendations.push('Consider increased exposure');
      recommendations.push('Monitor for chalk potential');
    }
    
    return recommendations;
  }

  private handleWeatherAlert(alert: WeatherAlert): void {
    // Store weather alert
    this.redis.setex(
      `${this.config.redis.keyPrefix}:weather:${alert.location}`,
      7200, // 2 hours
      JSON.stringify(alert)
    );
    
    // Emit alert
    this.emit('weatherAlert', alert);
    
    // Check severity
    if (alert.impact === 'HIGH' || alert.impact === 'SEVERE') {
      this.emit('severeWeatherAlert', alert);
      this.analyzeWeatherImpact(alert);
    }
  }

  private async analyzeWeatherImpact(alert: WeatherAlert): Promise<void> {
    // Find affected games and players
    const affectedGames = alert.affectedGames;
    const recommendations: string[] = [];
    
    if (alert.conditions.windSpeed > 15) {
      recommendations.push('Consider fading passing games');
      recommendations.push('Target rushing/defense plays');
    }
    
    if (alert.conditions.precipitation > 50) {
      recommendations.push('Target ground game');
      recommendations.push('Avoid outdoor kickers');
    }
    
    this.emit('weatherImpactAnalysis', {
      alert,
      affectedGames,
      recommendations
    });
  }

  private handleWeatherUpdate(data: any): void {
    this.emit('weatherUpdate', data);
  }

  private handleInjuryUpdate(report: InjuryReport): void {
    // Store injury report
    this.redis.setex(
      `${this.config.redis.keyPrefix}:injury:${report.playerId}`,
      86400, // 24 hours
      JSON.stringify(report)
    );
    
    // Emit update
    this.emit('injuryUpdate', report);
    
    // Check impact level
    if (report.impactLevel === 'HIGH' || report.impactLevel === 'CRITICAL') {
      this.emit('criticalInjuryUpdate', report);
      this.analyzeInjuryImpact(report);
    }
  }

  private async analyzeInjuryImpact(report: InjuryReport): Promise<void> {
    // Get player ownership data
    const ownershipKeys = await this.redis.keys(
      `${this.config.redis.keyPrefix}:ownership:*:${report.playerId}:*`
    );
    
    const ownershipData: OwnershipData[] = [];
    for (const key of ownershipKeys) {
      const data = await this.redis.get(key);
      if (data) {
        ownershipData.push(JSON.parse(data));
      }
    }
    
    const recommendations: string[] = [];
    
    if (report.status === 'OUT') {
      recommendations.push('Remove from all lineups');
      recommendations.push('Look for replacement options');
      recommendations.push('Monitor teammate usage bump');
    } else if (report.status === 'QUESTIONABLE') {
      recommendations.push('Reduce exposure');
      recommendations.push('Have backup options ready');
      recommendations.push('Monitor for game-time decision');
    }
    
    this.emit('injuryImpactAnalysis', {
      report,
      ownershipData,
      recommendations
    });
  }

  private handlePlayerStatusChange(change: any): void {
    this.emit('playerStatusChange', change);
  }

  private handleConnectionError(platform: string, error: Error): void {
    console.error(`Connection error for ${platform}:`, error);
    this.emit('connectionError', { platform, error });
    
    // Attempt to reconnect
    setTimeout(() => {
      this.reconnectPlatform(platform);
    }, 5000);
  }

  private async reconnectPlatform(platform: string): Promise<void> {
    try {
      const connection = this.platformConnections.get(platform);
      if (connection) {
        await connection.disconnect();
        await connection.connect();
        console.log(`Reconnected to ${platform}`);
      }
    } catch (error) {
      console.error(`Failed to reconnect to ${platform}:`, error);
    }
  }

  private handleNewsFeedError(feed: string, error: Error): void {
    console.error(`News feed error for ${feed}:`, error);
    this.emit('newsFeedError', { feed, error });
  }

  // Public API methods
  public async getOwnershipData(platform?: string, sport?: string): Promise<OwnershipData[]> {
    const pattern = platform 
      ? `${this.config.redis.keyPrefix}:ownership:${platform}:*`
      : `${this.config.redis.keyPrefix}:ownership:*`;
    
    const keys = await this.redis.keys(pattern);
    const data: OwnershipData[] = [];
    
    for (const key of keys) {
      const ownershipData = await this.redis.get(key);
      if (ownershipData) {
        const parsed = JSON.parse(ownershipData) as OwnershipData;
        if (!sport || parsed.playerName.includes(sport)) {
          data.push(parsed);
        }
      }
    }
    
    return data.sort((a, b) => b.ownership - a.ownership);
  }

  public async getContestData(platform?: string): Promise<ContestData[]> {
    if (platform) {
      return Array.from(this.contestCache.values()).filter(c => c.platform === platform);
    }
    return Array.from(this.contestCache.values());
  }

  public async getNewsItems(limit: number = 50): Promise<NewsItem[]> {
    const items = await this.redis.lrange(`${this.config.redis.keyPrefix}:news`, 0, limit - 1);
    return items.map(item => JSON.parse(item));
  }

  public async getWeatherAlerts(): Promise<WeatherAlert[]> {
    const keys = await this.redis.keys(`${this.config.redis.keyPrefix}:weather:*`);
    const alerts: WeatherAlert[] = [];
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        alerts.push(JSON.parse(data));
      }
    }
    
    return alerts;
  }

  public async getInjuryReports(): Promise<InjuryReport[]> {
    const keys = await this.redis.keys(`${this.config.redis.keyPrefix}:injury:*`);
    const reports: InjuryReport[] = [];
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        reports.push(JSON.parse(data));
      }
    }
    
    return reports.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  public isConnected(platform: string): boolean {
    const connection = this.platformConnections.get(platform);
    return connection ? connection.isConnected() : false;
  }

  public getConnectionStatus(): { [platform: string]: boolean } {
    const status: { [platform: string]: boolean } = {};
    for (const [platform, connection] of this.platformConnections) {
      status[platform] = connection.isConnected();
    }
    return status;
  }
}

// Platform Connection Handler
class PlatformConnection extends EventEmitter {
  private config: PlatformConfig;
  private redis: Redis;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private lastHeartbeat: Date = new Date();
  private rateLimiter: RateLimiter;

  constructor(config: PlatformConfig, redis: Redis) {
    super();
    this.config = config;
    this.redis = redis;
    this.rateLimiter = new RateLimiter(config.rateLimits.requests, config.rateLimits.window);
  }

  public async connect(): Promise<void> {
    try {
      // Establish WebSocket connection
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.on('open', () => {
        console.log(`WebSocket connected to ${this.config.name}`);
        this.connected = true;
        this.lastHeartbeat = new Date();
        this.emit('connected');
      });
      
      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data);
      });
      
      this.ws.on('close', () => {
        console.log(`WebSocket disconnected from ${this.config.name}`);
        this.connected = false;
        this.emit('disconnected');
      });
      
      this.ws.on('error', (error) => {
        console.error(`WebSocket error for ${this.config.name}:`, error);
        this.connected = false;
        this.emit('error', error);
      });
      
      // Start heartbeat monitoring
      this.startHeartbeat();
      
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  private handleWebSocketMessage(data: any): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'ownership_update':
          this.emit('ownershipUpdate', message.data);
          break;
        case 'contest_update':
          this.emit('contestUpdate', message.data);
          break;
        case 'lineup_change':
          this.emit('lineupChange', message.data);
          break;
        case 'heartbeat':
          this.lastHeartbeat = new Date();
          break;
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private startHeartbeat(): void {
    setInterval(() => {
      if (this.connected) {
        const timeSinceHeartbeat = Date.now() - this.lastHeartbeat.getTime();
        if (timeSinceHeartbeat > 60000) { // 1 minute timeout
          console.warn(`No heartbeat received from ${this.config.name} for ${timeSinceHeartbeat}ms`);
          this.emit('heartbeatTimeout');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  public async getOwnershipData(): Promise<OwnershipData[]> {
    if (!this.rateLimiter.allow()) {
      throw new Error('Rate limit exceeded');
    }
    
    try {
      const response = await axios.get(
        `${this.config.apiBaseUrl}${this.config.endpoints.ownership}`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000
        }
      );
      
      return this.parseOwnershipData(response.data);
    } catch (error) {
      console.error(`Error fetching ownership data from ${this.config.name}:`, error);
      return [];
    }
  }

  public async getContestData(): Promise<ContestData[]> {
    if (!this.rateLimiter.allow()) {
      throw new Error('Rate limit exceeded');
    }
    
    try {
      const response = await axios.get(
        `${this.config.apiBaseUrl}${this.config.endpoints.contests}`,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000
        }
      );
      
      return this.parseContestData(response.data);
    } catch (error) {
      console.error(`Error fetching contest data from ${this.config.name}:`, error);
      return [];
    }
  }

  private getAuthHeaders(): any {
    // Implementation depends on platform authentication method
    switch (this.config.authConfig.type) {
      case 'oauth':
        return {
          'Authorization': `Bearer ${this.config.authConfig.credentials.token}`
        };
      case 'apikey':
        return {
          'X-API-Key': this.config.authConfig.credentials.apiKey
        };
      case 'session':
        return {
          'Cookie': this.config.authConfig.credentials.sessionCookie
        };
      default:
        return {};
    }
  }

  private parseOwnershipData(data: any): OwnershipData[] {
    // Platform-specific parsing logic
    return [];
  }

  private parseContestData(data: any): ContestData[] {
    // Platform-specific parsing logic
    return [];
  }
}

// News Feed Monitor
class NewsFeedMonitor extends EventEmitter {
  private config: NewsFeedConfig;
  private redis: Redis;
  private lastCheck: Date = new Date(0);

  constructor(config: NewsFeedConfig, redis: Redis) {
    super();
    this.config = config;
    this.redis = redis;
  }

  public async start(): Promise<void> {
    console.log(`Starting news feed monitor: ${this.config.name}`);
  }

  public async checkForUpdates(): Promise<void> {
    try {
      let items: NewsItem[] = [];
      
      switch (this.config.type) {
        case 'rss':
          items = await this.fetchRSSFeed();
          break;
        case 'api':
          items = await this.fetchAPIFeed();
          break;
        case 'scrape':
          items = await this.scrapeFeed();
          break;
      }
      
      // Filter new items
      const newItems = items.filter(item => 
        item.timestamp > this.lastCheck &&
        this.matchesKeywords(item)
      );
      
      for (const item of newItems) {
        this.emit('newsItem', item);
      }
      
      this.lastCheck = new Date();
      
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async fetchRSSFeed(): Promise<NewsItem[]> {
    // RSS feed parsing implementation
    return [];
  }

  private async fetchAPIFeed(): Promise<NewsItem[]> {
    // API feed fetching implementation
    return [];
  }

  private async scrapeFeed(): Promise<NewsItem[]> {
    // Web scraping implementation
    return [];
  }

  private matchesKeywords(item: NewsItem): boolean {
    const content = `${item.title} ${item.content}`.toLowerCase();
    return this.config.keywords.some(keyword => 
      content.includes(keyword.toLowerCase())
    );
  }
}

// Weather Monitor
class WeatherMonitor extends EventEmitter {
  private config: WeatherConfig;
  private redis: Redis;

  constructor(config: WeatherConfig, redis: Redis) {
    super();
    this.config = config;
    this.redis = redis;
  }

  public async start(): Promise<void> {
    console.log('Starting weather monitor');
  }

  public async stop(): Promise<void> {
    console.log('Stopping weather monitor');
  }

  public async update(): Promise<void> {
    for (const location of this.config.locations) {
      try {
        const weatherData = await this.fetchWeatherData(location);
        await this.processWeatherData(location, weatherData);
      } catch (error) {
        console.error(`Error updating weather for ${location}:`, error);
      }
    }
  }

  private async fetchWeatherData(location: string): Promise<any> {
    const response = await axios.get(
      `${this.config.baseUrl}/current?key=${this.config.apiKey}&q=${location}`
    );
    return response.data;
  }

  private async processWeatherData(location: string, data: any): Promise<void> {
    // Process weather data and create alerts if necessary
    const alert: WeatherAlert = {
      location,
      stadium: location,
      game: '', // Would be determined from schedule
      conditions: {
        temperature: data.current.temp_f,
        windSpeed: data.current.wind_mph,
        windDirection: data.current.wind_dir,
        precipitation: data.current.precip_in,
        humidity: data.current.humidity,
        visibility: data.current.vis_miles
      },
      forecast: [],
      alerts: data.alerts ? data.alerts.map((a: any) => a.headline) : [],
      impact: this.calculateWeatherImpact(data),
      affectedGames: []
    };
    
    this.emit('weatherAlert', alert);
  }

  private calculateWeatherImpact(data: any): WeatherAlert['impact'] {
    let impact: WeatherAlert['impact'] = 'LOW';
    
    if (data.current.wind_mph > 20 || data.current.precip_in > 0.5) {
      impact = 'MEDIUM';
    }
    
    if (data.current.wind_mph > 30 || data.current.precip_in > 1.0) {
      impact = 'HIGH';
    }
    
    if (data.alerts && data.alerts.length > 0) {
      impact = 'SEVERE';
    }
    
    return impact;
  }
}

// Injury Monitor
class InjuryMonitor extends EventEmitter {
  private redis: Redis;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  public async start(): Promise<void> {
    console.log('Starting injury monitor');
  }

  public async stop(): Promise<void> {
    console.log('Stopping injury monitor');
  }

  public async update(): Promise<void> {
    // Fetch injury reports from various sources
    try {
      const reports = await this.fetchInjuryReports();
      for (const report of reports) {
        this.emit('injuryUpdate', report);
      }
    } catch (error) {
      console.error('Error updating injury reports:', error);
    }
  }

  private async fetchInjuryReports(): Promise<InjuryReport[]> {
    // Implementation would fetch from ESPN, NFL.com, etc.
    return [];
  }
}

// Rate Limiter
class RateLimiter {
  private requests: number[];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.requests = [];
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public allow(): boolean {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if we can make another request
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }
}

export default MarketDataFeed;