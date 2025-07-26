/**
 * 🔥 Unified API Service - Elite Orchestration System
 * 
 * Master orchestrator for all API services with:
 * - Intelligent service routing
 * - Parallel API coordination
 * - Smart caching strategies
 * - Error resilience
 * - Performance optimization
 * - Real-time synchronization
 * 
 * @version 2025.1.0
 */

import { logger } from '../../logging/logger';
import { fcmService, NotificationType, NotificationPriority } from '../notifications/fcm-service';
import { ga4Service } from '../../analytics/ga4-service';
import { geminiService, FantasyContext, GeminiInsight } from '../ai/gemini-service';
import { youtubeService, VideoIntelligence } from '../youtube/enhanced-youtube-service';
import { cloudflareCDNService } from '../cdn/cloudflare-service';
import { supabase } from '../../supabase/client';
import { createClient } from 'redis';

// Existing services (to be imported)
// import { espnService } from '../sports/espn-service';
// import { weatherService } from '../weather/weather-service';
// import { injuryService } from '../injury/injury-service';

// Player Intelligence
export interface PlayerIntelligence {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  
  // Statistical Analysis
  currentProjection: number;
  seasonAverage: number;
  recentForm: number[];
  consistency: number; // 0-1
  
  // AI Insights
  aiAnalysis?: GeminiInsight;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidenceScore: number;
  
  // Media Intelligence
  youtubePresence: {
    mentionCount: number;
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    recentVideos: VideoIntelligence[];
    trendingScore: number;
  };
  
  // External Factors
  injuryStatus?: {
    status: string;
    description: string;
    impactScore: number;
  };
  weatherImpact?: {
    condition: string;
    performanceModifier: number;
  };
  
  // Recommendations
  dfsRecommendation: 'strong_play' | 'value_play' | 'leverage_play' | 'fade' | 'neutral';
  ownership: {
    projected: number;
    leverageScore: number;
  };
  
  // Metadata
  lastUpdated: Date;
  dataQuality: number; // 0-1
}

// Contest Intelligence
export interface ContestIntelligence {
  contestId: string;
  platform: 'draftkings' | 'fanduel' | 'yahoo';
  contestType: 'gpp' | 'cash' | 'h2h';
  
  // Contest Details
  entryFee: number;
  maxEntries: number;
  prizePool: number;
  currentEntries: number;
  
  // Strategic Analysis
  expectedROI: number;
  difficultyScore: number;
  optimalStrategy: string;
  
  // Player Pool Analysis
  chalkyPlayers: string[];
  leveragePlays: string[];
  correlationPlays: Array<{
    players: string[];
    correlation: number;
  }>;
  
  // AI Recommendations
  aiStrategy?: GeminiInsight;
  recommendedExposure: number; // % of bankroll
}

// Service Health
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastCheck: Date;
  errorRate: number;
}

// Cache Configuration
const CACHE_CONFIG = {
  playerIntelligence: 5 * 60 * 1000,      // 5 minutes
  contestIntelligence: 10 * 60 * 1000,    // 10 minutes
  videoAnalysis: 30 * 60 * 1000,          // 30 minutes
  aiInsights: 15 * 60 * 1000,             // 15 minutes
  weatherData: 60 * 60 * 1000             // 1 hour
};

// Service Priority
enum ServicePriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4
}

/**
 * Elite Unified API Service
 */
export class UnifiedAPIService {
  private static instance: UnifiedAPIService;
  private redisClient?: ReturnType<typeof createClient>;
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private requestQueue: Map<string, Promise<any>> = new Map();
  private analyticsBuffer: any[] = [];
  private analyticsTimer?: NodeJS.Timeout;

  private constructor() {
    this.initializeRedis();
    this.startHealthMonitoring();
  }

  static getInstance(): UnifiedAPIService {
    if (!UnifiedAPIService.instance) {
      UnifiedAPIService.instance = new UnifiedAPIService();
    }
    return UnifiedAPIService.instance;
  }

  /**
   * Initialize Redis for caching
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err) => logger.error('Redis error:', err));
      this.redisClient.on('connect', () => logger.info('Redis connected'));

      await this.redisClient.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      // Continue without cache
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Monitor service health every minute
    setInterval(() => this.checkServicesHealth(), 60 * 1000);
  }

  /**
   * Get comprehensive player intelligence
   */
  async getPlayerIntelligence(
    playerId: string,
    playerName: string,
    options?: {
      includeAI?: boolean;
      includeYouTube?: boolean;
      includeWeather?: boolean;
      forceRefresh?: boolean;
    }
  ): Promise<PlayerIntelligence> {
    const startTime = Date.now();
    const cacheKey = `player:${playerId}`;

    try {
      // Check cache unless force refresh
      if (!options?.forceRefresh) {
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;
      }

      // Prevent duplicate requests
      const existingRequest = this.requestQueue.get(cacheKey);
      if (existingRequest) return existingRequest;

      // Create new request
      const request = this.buildPlayerIntelligence(playerId, playerName, options);
      this.requestQueue.set(cacheKey, request);

      const result = await request;
      this.requestQueue.delete(cacheKey);

      // Cache result
      await this.setCached(cacheKey, result, CACHE_CONFIG.playerIntelligence);

      // Track analytics
      this.trackAnalytics('player_intelligence_fetched', {
        player_id: playerId,
        response_time: Date.now() - startTime,
        data_quality: result.dataQuality,
        cache_hit: false
      });

      return result;

    } catch (error) {
      logger.error('Failed to get player intelligence:', error);
      this.requestQueue.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Build player intelligence
   */
  private async buildPlayerIntelligence(
    playerId: string,
    playerName: string,
    options?: any
  ): Promise<PlayerIntelligence> {
    
    // Parallel data fetching
    const [
      playerStats,
      youtubeData,
      aiAnalysis,
      injuryData,
      weatherData
    ] = await Promise.allSettled([
      this.getPlayerStats(playerId),
      options?.includeYouTube ? this.getYouTubeIntelligence(playerName) : null,
      options?.includeAI ? this.getAIAnalysis(playerName, playerId) : null,
      this.getInjuryStatus(playerId),
      options?.includeWeather ? this.getWeatherImpact(playerId) : null
    ]);

    // Extract results
    const stats = playerStats.status === 'fulfilled' ? playerStats.value : this.getDefaultStats();
    const youtube = youtubeData?.status === 'fulfilled' ? youtubeData.value : null;
    const ai = aiAnalysis?.status === 'fulfilled' ? aiAnalysis.value : null;
    const injury = injuryData.status === 'fulfilled' ? injuryData.value : null;
    const weather = weatherData?.status === 'fulfilled' ? weatherData.value : null;

    // Calculate derived metrics
    const sentiment = this.calculateOverallSentiment(stats, youtube, ai);
    const confidenceScore = this.calculateConfidenceScore(stats, youtube, ai, injury);
    const recommendation = this.generateRecommendation(stats, sentiment, confidenceScore, injury);
    const ownership = this.projectOwnership(stats, youtube, sentiment);

    return {
      playerId,
      playerName,
      team: stats.team,
      position: stats.position,
      
      currentProjection: stats.projection,
      seasonAverage: stats.average,
      recentForm: stats.recentScores,
      consistency: stats.consistency,
      
      aiAnalysis: ai,
      sentiment,
      confidenceScore,
      
      youtubePresence: youtube || {
        mentionCount: 0,
        sentiment: 'neutral',
        recentVideos: [],
        trendingScore: 0
      },
      
      injuryStatus: injury,
      weatherImpact: weather,
      
      dfsRecommendation: recommendation,
      ownership,
      
      lastUpdated: new Date(),
      dataQuality: this.assessDataQuality({ stats, youtube, ai, injury, weather })
    };
  }

  /**
   * Get YouTube intelligence for player
   */
  private async getYouTubeIntelligence(playerName: string): Promise<any> {
    try {
      const videos = await youtubeService.getPlayerVideos(playerName, 5);
      
      let totalMentions = 0;
      let sentimentScores = { positive: 0, negative: 0, neutral: 0 };
      
      videos.forEach(video => {
        const playerMention = video.playerMentions.find(
          m => m.playerName.toLowerCase().includes(playerName.toLowerCase())
        );
        
        if (playerMention) {
          totalMentions += playerMention.mentionCount;
          sentimentScores[playerMention.sentiment]++;
        }
      });

      // Calculate overall sentiment
      const totalSentiments = sentimentScores.positive + sentimentScores.negative + sentimentScores.neutral;
      let overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
      
      if (totalSentiments > 0) {
        if (sentimentScores.positive / totalSentiments > 0.6) {
          overallSentiment = 'positive';
        } else if (sentimentScores.negative / totalSentiments > 0.6) {
          overallSentiment = 'negative';
        } else if (sentimentScores.positive > 0 && sentimentScores.negative > 0) {
          overallSentiment = 'mixed';
        }
      }

      // Calculate trending score
      const recentViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
      const avgViews = videos.length > 0 ? recentViews / videos.length : 0;
      const trendingScore = Math.min(avgViews / 100000, 1); // Normalize to 0-1

      return {
        mentionCount: totalMentions,
        sentiment: overallSentiment,
        recentVideos: videos,
        trendingScore
      };

    } catch (error) {
      logger.error('YouTube intelligence error:', error);
      return null;
    }
  }

  /**
   * Get AI analysis for player
   */
  private async getAIAnalysis(playerName: string, playerId: string): Promise<GeminiInsight | null> {
    try {
      // Get player context
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (!playerData) return null;

      const context: FantasyContext = {
        sport: this.mapSportType(playerData.sport),
        playerStats: [{
          playerId,
          name: playerName,
          team: playerData.team,
          position: playerData.position,
          projectedPoints: playerData.projected_points || 0,
          salary: playerData.salary || 0
        }]
      };

      const question = `What is your fantasy outlook for ${playerName} this week? Consider recent performance, matchup, and any relevant factors.`;
      
      return await geminiService.getLineupAdvice(question, context);

    } catch (error) {
      logger.error('AI analysis error:', error);
      return null;
    }
  }

  /**
   * Get contest intelligence
   */
  async getContestIntelligence(
    contestId: string,
    platform: 'draftkings' | 'fanduel' | 'yahoo'
  ): Promise<ContestIntelligence> {
    const cacheKey = `contest:${platform}:${contestId}`;

    try {
      // Check cache
      const cached = await this.getCached(cacheKey);
      if (cached) return cached;

      // Build contest intelligence
      const intelligence = await this.buildContestIntelligence(contestId, platform);

      // Cache result
      await this.setCached(cacheKey, intelligence, CACHE_CONFIG.contestIntelligence);

      return intelligence;

    } catch (error) {
      logger.error('Failed to get contest intelligence:', error);
      throw error;
    }
  }

  /**
   * Build contest intelligence
   */
  private async buildContestIntelligence(
    contestId: string,
    platform: string
  ): Promise<ContestIntelligence> {
    // This would integrate with DFS platform APIs
    // For now, return mock data
    
    const mockContest = {
      contestId,
      platform: platform as any,
      contestType: 'gpp' as const,
      entryFee: 20,
      maxEntries: 150,
      prizePool: 100000,
      currentEntries: 75000,
      expectedROI: 15.5,
      difficultyScore: 0.75,
      optimalStrategy: 'Balanced approach with 2-3 leverage plays',
      chalkyPlayers: ['Patrick Mahomes', 'Justin Jefferson', 'Christian McCaffrey'],
      leveragePlays: ['Tank Dell', 'Rachaad White', 'Dallas Goedert'],
      correlationPlays: [
        { players: ['Josh Allen', 'Stefon Diggs'], correlation: 0.65 },
        { players: ['Dak Prescott', 'CeeDee Lamb'], correlation: 0.72 }
      ],
      recommendedExposure: 5
    };

    // Get AI strategy if available
    try {
      const aiStrategy = await geminiService.getDFSStrategy(
        mockContest.contestType,
        mockContest.entryFee * 10, // Assume 10 entry budget
        { sport: 'nfl' }
      );
      
      return {
        ...mockContest,
        aiStrategy
      };
    } catch {
      return mockContest;
    }
  }

  /**
   * Real-time lineup optimization
   */
  async optimizeLineup(
    players: Array<{ playerId: string; name: string; salary: number; position: string }>,
    constraints: {
      salaryCap: number;
      positions: Record<string, number>;
      sport: 'nfl' | 'nba' | 'mlb' | 'nhl';
      contestType: 'gpp' | 'cash';
    }
  ): Promise<{
    lineup: any[];
    projectedScore: number;
    confidence: number;
    insights: string[];
  }> {
    const startTime = Date.now();

    try {
      // Get intelligence for all players in parallel
      const playerIntelligence = await Promise.all(
        players.map(p => this.getPlayerIntelligence(p.playerId, p.name, {
          includeAI: true,
          includeYouTube: true
        }))
      );

      // Use existing optimizer logic here
      // This is a placeholder for the actual optimization
      const optimizedLineup = this.runOptimizationAlgorithm(
        playerIntelligence,
        constraints
      );

      // Get AI insights on the lineup
      const context: FantasyContext = {
        sport: constraints.sport,
        lineup: optimizedLineup.lineup.map(p => ({
          playerId: p.playerId,
          name: p.playerName,
          position: p.position,
          salary: p.salary,
          projectedPoints: p.currentProjection
        }))
      };

      const aiInsight = await geminiService.getLineupAdvice(
        'Analyze this DFS lineup and provide strategic insights',
        context
      );

      // Track analytics
      this.trackAnalytics('lineup_optimized', {
        sport: constraints.sport,
        contest_type: constraints.contestType,
        player_count: optimizedLineup.lineup.length,
        projected_score: optimizedLineup.projectedScore,
        optimization_time: Date.now() - startTime
      });

      return {
        lineup: optimizedLineup.lineup,
        projectedScore: optimizedLineup.projectedScore,
        confidence: optimizedLineup.confidence,
        insights: [
          ...aiInsight.recommendations,
          `Lineup leverages ${optimizedLineup.leveragePlayCount} contrarian plays`,
          `Expected ownership: ${optimizedLineup.avgOwnership.toFixed(1)}%`
        ]
      };

    } catch (error) {
      logger.error('Lineup optimization failed:', error);
      throw error;
    }
  }

  /**
   * Send smart notifications
   */
  async sendSmartNotification(
    userId: string,
    type: 'injury' | 'lineup' | 'news' | 'price',
    data: any
  ): Promise<void> {
    try {
      let notification;

      switch (type) {
        case 'injury':
          notification = {
            type: NotificationType.INJURY_UPDATE,
            priority: NotificationPriority.HIGH,
            title: `🏥 ${data.playerName} Injury Update`,
            body: data.status,
            data: {
              playerId: data.playerId,
              status: data.status,
              impact: data.impact
            }
          };
          break;

        case 'lineup':
          notification = {
            type: NotificationType.LINEUP_ALERT,
            priority: NotificationPriority.NORMAL,
            title: '📋 Lineup Optimization Available',
            body: `New insights for your ${data.sport.toUpperCase()} lineup`,
            data: {
              sport: data.sport,
              leagueId: data.leagueId
            }
          };
          break;

        case 'news':
          notification = {
            type: NotificationType.PLAYER_NEWS,
            priority: data.breaking ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
            title: data.breaking ? '🚨 Breaking News' : '📰 Player Update',
            body: data.headline,
            data: {
              players: data.players,
              url: data.url
            }
          };
          break;

        case 'price':
          notification = {
            type: NotificationType.PRICE_CHANGE,
            priority: NotificationPriority.LOW,
            title: '💰 Price Movement',
            body: `${data.playerName}: ${data.oldPrice} → ${data.newPrice}`,
            data: {
              playerId: data.playerId,
              change: data.newPrice - data.oldPrice
            }
          };
          break;

        default:
          return;
      }

      await fcmService.sendToUser(userId, notification);

      // Track notification
      this.trackAnalytics('smart_notification_sent', {
        user_id: userId,
        notification_type: type,
        priority: notification.priority
      });

    } catch (error) {
      logger.error('Failed to send smart notification:', error);
    }
  }

  /**
   * Monitor player for updates
   */
  async monitorPlayer(
    userId: string,
    playerId: string,
    playerName: string,
    options: {
      injuryAlerts: boolean;
      newsAlerts: boolean;
      priceAlerts: boolean;
      thresholds?: {
        priceChange?: number;
        projectionChange?: number;
      };
    }
  ): Promise<void> {
    try {
      // Subscribe to player topic
      await fcmService.subscribeToTopic(`player_${playerId}`);

      // Store monitoring preferences
      await supabase
        .from('player_monitors')
        .upsert({
          user_id: userId,
          player_id: playerId,
          player_name: playerName,
          injury_alerts: options.injuryAlerts,
          news_alerts: options.newsAlerts,
          price_alerts: options.priceAlerts,
          thresholds: options.thresholds,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,player_id'
        });

      // Track analytics
      this.trackAnalytics('player_monitoring_started', {
        user_id: userId,
        player_id: playerId,
        alert_types: Object.entries(options)
          .filter(([k, v]) => k.includes('Alerts') && v)
          .map(([k]) => k)
      });

    } catch (error) {
      logger.error('Failed to set up player monitoring:', error);
      throw error;
    }
  }

  // Helper methods

  /**
   * Get player stats
   */
  private async getPlayerStats(playerId: string): Promise<any> {
    try {
      const { data } = await supabase
        .from('player_stats_current')
        .select('*')
        .eq('player_id', playerId)
        .single();

      return {
        team: data?.team || 'FA',
        position: data?.position || 'FLEX',
        projection: data?.projected_points || 0,
        average: data?.season_average || 0,
        recentScores: data?.recent_scores || [],
        consistency: data?.consistency_rating || 0.5
      };
    } catch (error) {
      return this.getDefaultStats();
    }
  }

  /**
   * Get default stats
   */
  private getDefaultStats(): any {
    return {
      team: 'FA',
      position: 'FLEX',
      projection: 0,
      average: 0,
      recentScores: [],
      consistency: 0.5
    };
  }

  /**
   * Get injury status
   */
  private async getInjuryStatus(playerId: string): Promise<any> {
    try {
      const { data } = await supabase
        .from('injury_reports')
        .select('*')
        .eq('player_id', playerId)
        .order('reported_at', { ascending: false })
        .limit(1)
        .single();

      if (!data) return null;

      return {
        status: data.status,
        description: data.description,
        impactScore: this.calculateInjuryImpact(data.status)
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate injury impact
   */
  private calculateInjuryImpact(status: string): number {
    const impactMap: Record<string, number> = {
      'out': 1.0,
      'doubtful': 0.8,
      'questionable': 0.3,
      'probable': 0.1
    };
    return impactMap[status.toLowerCase()] || 0;
  }

  /**
   * Get weather impact
   */
  private async getWeatherImpact(playerId: string): Promise<any> {
    // This would integrate with weather service
    // Placeholder for now
    return null;
  }

  /**
   * Calculate overall sentiment
   */
  private calculateOverallSentiment(stats: any, youtube: any, ai: any): 'bullish' | 'bearish' | 'neutral' {
    let score = 0;

    // Stats contribution
    if (stats.consistency > 0.7) score += 1;
    if (stats.recentForm?.length > 0) {
      const recentAvg = stats.recentForm.reduce((a: number, b: number) => a + b, 0) / stats.recentForm.length;
      if (recentAvg > stats.average) score += 1;
    }

    // YouTube contribution
    if (youtube?.sentiment === 'positive') score += 2;
    else if (youtube?.sentiment === 'negative') score -= 2;

    // AI contribution
    if (ai?.confidence > 0.8) score += 1;

    if (score >= 2) return 'bullish';
    if (score <= -1) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(stats: any, youtube: any, ai: any, injury: any): number {
    let score = 0.5; // Base score

    // Stats reliability
    if (stats.recentScores?.length >= 3) score += 0.1;
    
    // YouTube signal
    if (youtube?.mentionCount > 10) score += 0.1;
    
    // AI confidence
    if (ai?.confidence) {
      score = (score + ai.confidence) / 2;
    }

    // Injury penalty
    if (injury?.impactScore) {
      score *= (1 - injury.impactScore * 0.5);
    }

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    stats: any,
    sentiment: string,
    confidence: number,
    injury: any
  ): 'strong_play' | 'value_play' | 'leverage_play' | 'fade' | 'neutral' {
    
    if (injury?.impactScore > 0.5) return 'fade';
    
    if (sentiment === 'bullish' && confidence > 0.8) return 'strong_play';
    if (sentiment === 'bullish' && confidence > 0.6) return 'value_play';
    if (sentiment === 'bearish' && confidence > 0.7) return 'fade';
    
    if (stats.consistency < 0.5 && confidence > 0.6) return 'leverage_play';
    
    return 'neutral';
  }

  /**
   * Project ownership
   */
  private projectOwnership(stats: any, youtube: any, sentiment: string): any {
    let baseOwnership = 10; // Default 10%

    // Price-based adjustment
    if (stats.projection && stats.salary) {
      const value = stats.projection / (stats.salary / 1000);
      if (value > 3) baseOwnership += 15;
      else if (value > 2.5) baseOwnership += 10;
      else if (value > 2) baseOwnership += 5;
    }

    // YouTube buzz adjustment
    if (youtube?.trendingScore > 0.7) baseOwnership += 10;
    else if (youtube?.trendingScore > 0.5) baseOwnership += 5;

    // Sentiment adjustment
    if (sentiment === 'bullish') baseOwnership += 5;
    else if (sentiment === 'bearish') baseOwnership -= 5;

    const projected = Math.min(Math.max(baseOwnership, 1), 50);
    const leverageScore = projected < 15 ? 0.8 : projected > 30 ? 0.2 : 0.5;

    return { projected, leverageScore };
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(data: any): number {
    let quality = 0;
    let factors = 0;

    if (data.stats?.recentScores?.length > 0) { quality += 1; factors++; }
    if (data.youtube?.mentionCount > 0) { quality += 1; factors++; }
    if (data.ai) { quality += 1; factors++; }
    if (data.injury !== null) { quality += 1; factors++; }
    if (data.weather) { quality += 1; factors++; }

    return factors > 0 ? quality / factors : 0.5;
  }

  /**
   * Map sport type
   */
  private mapSportType(sport: string): 'nfl' | 'nba' | 'mlb' | 'nhl' {
    const sportMap: Record<string, any> = {
      'football': 'nfl',
      'basketball': 'nba',
      'baseball': 'mlb',
      'hockey': 'nhl'
    };
    return sportMap[sport.toLowerCase()] || 'nfl';
  }

  /**
   * Run optimization algorithm
   */
  private runOptimizationAlgorithm(
    players: PlayerIntelligence[],
    constraints: any
  ): any {
    // This would implement actual optimization logic
    // For now, return mock optimized lineup
    
    const lineup = players
      .sort((a, b) => b.currentProjection - a.currentProjection)
      .slice(0, 9);

    const projectedScore = lineup.reduce((sum, p) => sum + p.currentProjection, 0);
    const avgOwnership = lineup.reduce((sum, p) => sum + p.ownership.projected, 0) / lineup.length;
    const leveragePlayCount = lineup.filter(p => p.ownership.leverageScore > 0.7).length;

    return {
      lineup,
      projectedScore,
      confidence: 0.75,
      avgOwnership,
      leveragePlayCount
    };
  }

  /**
   * Check services health
   */
  private async checkServicesHealth(): Promise<void> {
    const services = [
      { name: 'firebase', check: () => this.checkFirebaseHealth() },
      { name: 'youtube', check: () => this.checkYouTubeHealth() },
      { name: 'gemini', check: () => this.checkGeminiHealth() },
      { name: 'supabase', check: () => this.checkSupabaseHealth() },
      { name: 'cloudflare', check: () => this.checkCloudflareHealth() }
    ];

    for (const service of services) {
      const startTime = Date.now();
      try {
        await service.check();
        this.serviceHealth.set(service.name, {
          service: service.name,
          status: 'healthy',
          latency: Date.now() - startTime,
          lastCheck: new Date(),
          errorRate: 0
        });
      } catch (error) {
        this.serviceHealth.set(service.name, {
          service: service.name,
          status: 'down',
          latency: Date.now() - startTime,
          lastCheck: new Date(),
          errorRate: 1
        });
      }
    }
  }

  /**
   * Service health checks
   */
  private async checkFirebaseHealth(): Promise<void> {
    // Check if FCM token exists
    if (!fcmService.getToken()) throw new Error('No FCM token');
  }

  private async checkYouTubeHealth(): Promise<void> {
    // Try a simple search
    await youtubeService.searchVideos('nfl', undefined);
  }

  private async checkGeminiHealth(): Promise<void> {
    // Try a simple chat
    await geminiService.chat('system', 'ping');
  }

  private async checkSupabaseHealth(): Promise<void> {
    // Try a simple query
    await supabase.from('players').select('id').limit(1);
  }

  private async checkCloudflareHealth(): Promise<void> {
    // Check CDN performance
    const metrics = await cloudflareCDNService.getPerformanceAnalytics('hour');
    if (!metrics || metrics.cacheHitRate < 10) throw new Error('CDN unhealthy');
  }

  /**
   * Get service health
   */
  getServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Optimize image URL through CDN
   */
  optimizeImageUrl(
    url: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'auto' | 'webp' | 'avif';
    }
  ): string {
    return cloudflareCDNService.getOptimizedImageUrl(url, {
      quality: options?.quality || 85,
      format: options?.format || 'auto',
      resize: options?.width || options?.height ? {
        width: options.width,
        height: options.height,
        fit: 'cover'
      } : undefined
    });
  }

  /**
   * Track analytics with batching
   */
  private trackAnalytics(event: string, params: any): void {
    this.analyticsBuffer.push({ event, params, timestamp: Date.now() });

    if (!this.analyticsTimer) {
      this.analyticsTimer = setTimeout(() => this.flushAnalytics(), 1000);
    }
  }

  /**
   * Flush analytics buffer
   */
  private flushAnalytics(): void {
    if (this.analyticsBuffer.length === 0) return;

    const events = [...this.analyticsBuffer];
    this.analyticsBuffer = [];
    this.analyticsTimer = undefined;

    events.forEach(({ event, params }) => {
      ga4Service.trackEvent(event, params);
    });
  }

  /**
   * Cache helpers
   */
  private async getCached(key: string): Promise<any> {
    if (!this.redisClient) return null;

    try {
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  private async setCached(key: string, value: any, ttl: number): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.setEx(
        key,
        Math.floor(ttl / 1000),
        JSON.stringify(value)
      );
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    if (this.analyticsTimer) {
      clearTimeout(this.analyticsTimer);
      this.flushAnalytics();
    }
  }
}

// Export singleton instance
export const unifiedAPIService = UnifiedAPIService.getInstance();