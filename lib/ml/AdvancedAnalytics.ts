import * as tf from '@tensorflow/tfjs';
import { prisma } from '../prisma';
import { cache } from '../cache/RedisCache';

interface CorrelationResult {
  factor: string;
  correlation: number;
  pValue: number;
  sampleSize: number;
}

interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  magnitude: number;
  confidence: number;
  projectedNext: number;
}

interface AnomalyDetection {
  isAnomaly: boolean;
  score: number;
  reason?: string;
  expectedRange: { min: number; max: number };
}

export class AdvancedAnalytics {
  // Statistical correlation analysis
  async analyzeCorrelations(playerId: string): Promise<CorrelationResult[]> {
    const cacheKey = `correlations:${playerId}`;
    const cached = await cache.get<CorrelationResult[]>(cacheKey);
    if (cached) return cached;

    const playerStats = await prisma.playerStat.findMany({
      where: { player_id: playerId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    if (playerStats.length < 10) {
      return [];
    }

    const correlations: CorrelationResult[] = [];
    const fantasyPoints = playerStats.map(s => s.fantasy_points_ppr || 0);

    // Analyze various factors
    const factors = [
      {
        name: 'Snap Count',
        values: playerStats.map(s => s.snap_count || 0),
      },
      {
        name: 'Targets',
        values: playerStats.map(s => s.targets || 0),
      },
      {
        name: 'Red Zone Usage',
        values: playerStats.map(s => s.red_zone_touches || 0),
      },
      {
        name: 'Opponent Rank',
        values: playerStats.map(s => 32 - (s.opponent_defense_rank || 16)),
      },
      {
        name: 'Home/Away',
        values: playerStats.map(s => s.is_home ? 1 : 0),
      },
      {
        name: 'Days Rest',
        values: this.calculateDaysRest(playerStats),
      },
    ];

    for (const factor of factors) {
      const result = this.calculateCorrelation(fantasyPoints, factor.values);
      correlations.push({
        factor: factor.name,
        correlation: result.correlation,
        pValue: result.pValue,
        sampleSize: fantasyPoints.length,
      });
    }

    // Sort by absolute correlation strength
    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    await cache.set(cacheKey, correlations, 3600);
    return correlations;
  }

  private calculateCorrelation(x: number[], y: number[]): { correlation: number; pValue: number } {
    const n = x.length;
    if (n !== y.length || n < 3) {
      return { correlation: 0, pValue: 1 };
    }

    // Calculate means
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    // Calculate correlation coefficient
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const correlation = denomX && denomY ? numerator / Math.sqrt(denomX * denomY) : 0;

    // Calculate p-value (simplified t-test)
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const pValue = this.tDistributionPValue(Math.abs(t), n - 2);

    return { correlation, pValue };
  }

  private tDistributionPValue(t: number, df: number): number {
    // Simplified p-value calculation
    // In production, use a proper statistics library
    const x = df / (df + t * t);
    return Math.min(1, 2 * (1 - this.betaIncomplete(df / 2, 0.5, x)));
  }

  private betaIncomplete(a: number, b: number, x: number): number {
    // Simplified beta incomplete function
    // This is a rough approximation
    return Math.pow(x, a) * Math.pow(1 - x, b);
  }

  private calculateDaysRest(stats: any[]): number[] {
    const daysRest: number[] = [];
    
    for (let i = 0; i < stats.length; i++) {
      if (i === stats.length - 1) {
        daysRest.push(7); // Assume 7 days for the first game
      } else {
        const currentDate = new Date(stats[i].created_at);
        const previousDate = new Date(stats[i + 1].created_at);
        const days = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
        daysRest.push(Math.min(days, 14)); // Cap at 14 days
      }
    }
    
    return daysRest;
  }

  // Time series trend analysis
  async analyzeTrend(
    playerId: string,
    metric: string = 'fantasy_points_ppr',
    window: number = 10
  ): Promise<TrendAnalysis> {
    const stats = await prisma.playerStat.findMany({
      where: { player_id: playerId },
      orderBy: { week: 'desc' },
      take: window,
    });

    if (stats.length < 3) {
      return {
        direction: 'stable',
        magnitude: 0,
        confidence: 0,
        projectedNext: 0,
      };
    }

    const values = stats.map(s => (s as any)[metric] || 0).reverse();
    
    // Calculate moving averages
    const ma3 = this.movingAverage(values, 3);
    const ma5 = Math.min(5, Math.floor(values.length / 2)) > 1 
      ? this.movingAverage(values, Math.min(5, Math.floor(values.length / 2)))
      : ma3;

    // Determine trend direction
    const recentTrend = ma3[ma3.length - 1] - ma3[Math.max(0, ma3.length - 4)];
    const longerTrend = ma5[ma5.length - 1] - ma5[0];

    let direction: 'up' | 'down' | 'stable';
    if (recentTrend > values[0] * 0.1) direction = 'up';
    else if (recentTrend < -values[0] * 0.1) direction = 'down';
    else direction = 'stable';

    // Calculate trend magnitude and confidence
    const magnitude = Math.abs(recentTrend / (ma3[0] || 1));
    const consistency = this.calculateTrendConsistency(values);
    const confidence = consistency * 100;

    // Project next value using linear regression
    const projectedNext = this.projectNextValue(values);

    return {
      direction,
      magnitude,
      confidence: Math.round(confidence),
      projectedNext: Math.max(0, projectedNext),
    };
  }

  private movingAverage(values: number[], window: number): number[] {
    const result: number[] = [];
    
    for (let i = window - 1; i < values.length; i++) {
      const sum = values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
    
    return result;
  }

  private calculateTrendConsistency(values: number[]): number {
    if (values.length < 3) return 0;

    let consistentMoves = 0;
    let totalMoves = 0;

    for (let i = 2; i < values.length; i++) {
      const prev = values[i - 1] - values[i - 2];
      const curr = values[i] - values[i - 1];
      
      if (prev !== 0 && curr !== 0) {
        totalMoves++;
        if (Math.sign(prev) === Math.sign(curr)) {
          consistentMoves++;
        }
      }
    }

    return totalMoves > 0 ? consistentMoves / totalMoves : 0;
  }

  private projectNextValue(values: number[]): number {
    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return slope * n + intercept;
  }

  // Anomaly detection
  async detectAnomalies(
    playerId: string,
    metric: string = 'fantasy_points_ppr',
    threshold: number = 2.5
  ): Promise<AnomalyDetection[]> {
    const stats = await prisma.playerStat.findMany({
      where: { player_id: playerId },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    if (stats.length < 5) {
      return [];
    }

    const values = stats.map(s => (s as any)[metric] || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    const anomalies: AnomalyDetection[] = [];

    for (let i = 0; i < stats.length; i++) {
      const value = values[i];
      const zScore = stdDev > 0 ? Math.abs((value - mean) / stdDev) : 0;
      
      const expectedRange = {
        min: Math.max(0, mean - threshold * stdDev),
        max: mean + threshold * stdDev,
      };

      if (zScore > threshold) {
        let reason = '';
        
        if (value > expectedRange.max) {
          reason = `Exceptionally high performance (${Math.round((value / mean - 1) * 100)}% above average)`;
        } else if (value < expectedRange.min) {
          reason = `Unusually low performance (${Math.round((1 - value / mean) * 100)}% below average)`;
        }

        // Check for context
        const stat = stats[i];
        if (stat.injury_status) {
          reason += ` - Player was ${stat.injury_status}`;
        }

        anomalies.push({
          isAnomaly: true,
          score: zScore,
          reason,
          expectedRange,
        });
      }
    }

    return anomalies;
  }

  // Player similarity analysis using ML
  async findSimilarPlayers(
    playerId: string,
    limit: number = 10
  ): Promise<Array<{ playerId: string; similarity: number; name: string }>> {
    const cacheKey = `similar_players:${playerId}`;
    const cached = await cache.get<any[]>(cacheKey);
    if (cached) return cached;

    // Get target player stats
    const targetPlayer = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        stats: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!targetPlayer || !targetPlayer.stats.length) {
      return [];
    }

    // Get all players of the same position
    const candidates = await prisma.player.findMany({
      where: {
        position: targetPlayer.position,
        id: { not: playerId },
      },
      include: {
        stats: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    // Calculate feature vectors
    const targetVector = this.createFeatureVector(targetPlayer.stats);
    const similarities: Array<{ playerId: string; similarity: number; name: string }> = [];

    for (const candidate of candidates) {
      if (candidate.stats.length >= 5) {
        const candidateVector = this.createFeatureVector(candidate.stats);
        const similarity = this.cosineSimilarity(targetVector, candidateVector);
        
        similarities.push({
          playerId: candidate.id,
          similarity,
          name: candidate.name,
        });
      }
    }

    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    const result = similarities.slice(0, limit);

    await cache.set(cacheKey, result, 7200); // 2 hour cache
    return result;
  }

  private createFeatureVector(stats: any[]): number[] {
    const features: number[] = [];
    
    // Average stats
    const avgPoints = this.average(stats.map(s => s.fantasy_points_ppr || 0));
    const avgYards = this.average(stats.map(s => 
      (s.passing_yards || 0) + (s.rushing_yards || 0) + (s.receiving_yards || 0)
    ));
    const avgTouchdowns = this.average(stats.map(s => 
      (s.passing_touchdowns || 0) + (s.rushing_touchdowns || 0) + (s.receiving_touchdowns || 0)
    ));
    
    features.push(avgPoints, avgYards, avgTouchdowns);
    
    // Consistency
    features.push(this.calculateConsistency(stats.map(s => s.fantasy_points_ppr || 0)));
    
    // Usage metrics
    features.push(this.average(stats.map(s => s.snap_count || 0)));
    features.push(this.average(stats.map(s => s.targets || 0)));
    features.push(this.average(stats.map(s => s.carries || 0)));
    
    // Normalize features
    const magnitude = Math.sqrt(features.reduce((sum, f) => sum + f * f, 0));
    return magnitude > 0 ? features.map(f => f / magnitude) : features;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    
    return dotProduct; // Vectors are already normalized
  }

  private average(arr: number[]): number {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  private calculateConsistency(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = this.average(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? 1 - (stdDev / mean) : 0;
  }

  // Schedule strength analysis
  async analyzeScheduleStrength(
    teamId: string,
    weeks: number[]
  ): Promise<{ week: number; difficulty: number; opponent: string }[]> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        games: {
          where: {
            week: { in: weeks },
          },
          include: {
            home_team: true,
            away_team: true,
          },
        },
      },
    });

    if (!team) return [];

    const results = [];

    for (const game of team.games) {
      const opponent = game.home_team_id === teamId ? game.away_team : game.home_team;
      
      // Get opponent's defensive stats
      const defenseStats = await prisma.teamStat.findFirst({
        where: {
          team_id: opponent.id,
          season: new Date().getFullYear(),
        },
        orderBy: { created_at: 'desc' },
      });

      const difficulty = defenseStats?.defense_ranking || 16;
      
      results.push({
        week: game.week,
        difficulty: (32 - difficulty) / 32, // Normalize 0-1, higher = harder
        opponent: opponent.name,
      });
    }

    return results.sort((a, b) => a.week - b.week);
  }
}