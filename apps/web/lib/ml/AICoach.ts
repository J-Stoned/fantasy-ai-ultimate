import { MLPredictionEngine } from './MLPredictionEngine';
import { AdvancedAnalytics } from './AdvancedAnalytics';
import { prisma } from '../prisma';
import { cache } from '../cache/RedisCache';
import { mlLogger } from '../utils/logger';

interface CoachingInsight {
  type: 'lineup' | 'trade' | 'waiver' | 'strategy';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  impact: number; // Projected point impact
  confidence: number;
}

interface WeeklyStrategy {
  teamId: string;
  week: number;
  insights: CoachingInsight[];
  projectedScore: number;
  optimalLineup: any[];
  recommendedMoves: any[];
}

export class AICoach {
  private mlEngine: MLPredictionEngine;
  private analytics: AdvancedAnalytics;

  constructor() {
    this.mlEngine = new MLPredictionEngine();
    this.analytics = new AdvancedAnalytics();
  }

  async initialize() {
    await this.mlEngine.initialize();
    mlLogger.info('AI Coach initialized');
  }

  // Generate comprehensive weekly strategy
  async generateWeeklyStrategy(
    fantasyTeamId: string,
    week: number,
    season: number = new Date().getFullYear()
  ): Promise<WeeklyStrategy> {
    const cacheKey = `coach_strategy:${fantasyTeamId}:${week}:${season}`;
    const cached = await cache.get<WeeklyStrategy>(cacheKey);
    if (cached) return cached;

    mlLogger.info('Generating strategy', { fantasyTeamId, week });

    // Get team data
    const team = await prisma.fantasyTeam.findUnique({
      where: { id: fantasyTeamId },
      include: {
        roster: {
          include: {
            player: true,
          },
        },
        league: {
          include: {
            scoring_settings: true,
          },
        },
      },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const insights: CoachingInsight[] = [];

    // 1. Analyze lineup optimization
    const lineupInsights = await this.analyzeLineup(team, week, season);
    insights.push(...lineupInsights);

    // 2. Identify trade opportunities
    const tradeInsights = await this.analyzeTrades(team, week, season);
    insights.push(...tradeInsights);

    // 3. Waiver wire recommendations
    const waiverInsights = await this.analyzeWaiverWire(team, week, season);
    insights.push(...waiverInsights);

    // 4. Strategic insights
    const strategyInsights = await this.analyzeStrategy(team, week, season);
    insights.push(...strategyInsights);

    // Sort by priority and impact
    insights.sort((a, b) => {
      const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority] * a.impact;
      const bPriority = priorityWeight[b.priority] * b.impact;
      return bPriority - aPriority;
    });

    // Generate optimal lineup
    const optimalLineup = await this.generateOptimalLineup(team, week, season);
    
    // Calculate projected score
    const projectedScore = await this.calculateProjectedScore(optimalLineup, week, season);

    const strategy: WeeklyStrategy = {
      teamId: fantasyTeamId,
      week,
      insights: insights.slice(0, 10), // Top 10 insights
      projectedScore,
      optimalLineup,
      recommendedMoves: await this.getRecommendedMoves(team, insights),
    };

    await cache.set(cacheKey, strategy, 3600); // 1 hour cache
    return strategy;
  }

  private async analyzeLineup(team: any, week: number, season: number): Promise<CoachingInsight[]> {
    const insights: CoachingInsight[] = [];
    const roster = team.roster;

    // Get predictions for all players
    const predictions = await Promise.all(
      roster.map((r: any) => 
        this.mlEngine.predictPlayerPerformance(r.player_id, week, season)
      )
    );

    // Check for injured players in lineup
    const injuredStarters = roster.filter((r: any) => 
      r.lineup_position && r.player.injury_status !== 'healthy'
    );

    if (injuredStarters.length > 0) {
      insights.push({
        type: 'lineup',
        priority: 'high',
        title: '🚨 Injured Players in Lineup',
        description: `You have ${injuredStarters.length} injured player(s) in your starting lineup`,
        actionItems: injuredStarters.map((r: any) => 
          `Replace ${r.player.name} (${r.player.injury_status})`
        ),
        impact: injuredStarters.length * 5,
        confidence: 100,
      });
    }

    // Check for players on bye
    const byeWeekPlayers = await this.checkByeWeeks(roster, week, season);
    if (byeWeekPlayers.length > 0) {
      insights.push({
        type: 'lineup',
        priority: 'high',
        title: '📅 Bye Week Alert',
        description: `${byeWeekPlayers.length} player(s) on bye this week`,
        actionItems: byeWeekPlayers.map((p: any) => `Replace ${p.name}`),
        impact: byeWeekPlayers.length * 10,
        confidence: 100,
      });
    }

    // Identify bench players outscoring starters
    const benchOpportunities = await this.findBenchOpportunities(team, predictions);
    for (const opp of benchOpportunities) {
      insights.push({
        type: 'lineup',
        priority: 'medium',
        title: '💺 Better Option on Bench',
        description: `${opp.benchPlayer.name} projected to outscore ${opp.starter.name}`,
        actionItems: [`Start ${opp.benchPlayer.name} over ${opp.starter.name}`],
        impact: opp.pointDiff,
        confidence: opp.confidence,
      });
    }

    // Flex optimization
    const flexOptimization = await this.optimizeFlex(team, predictions);
    if (flexOptimization) {
      insights.push(flexOptimization);
    }

    return insights;
  }

  private async analyzeTrades(team: any, week: number, season: number): Promise<CoachingInsight[]> {
    const insights: CoachingInsight[] = [];

    // Identify position weaknesses
    const weakPositions = await this.identifyWeakPositions(team);
    
    // Find trade targets for weak positions
    for (const position of weakPositions) {
      const targets = await this.findTradeTargets(team, position, week, season);
      
      if (targets.length > 0) {
        insights.push({
          type: 'trade',
          priority: 'medium',
          title: `🔄 Trade Target: ${position}`,
          description: `Your ${position} position is underperforming. Consider trading for an upgrade.`,
          actionItems: targets.slice(0, 3).map(t => 
            `Target ${t.player.name} from ${t.owner}`
          ),
          impact: targets[0].projectedImprovement,
          confidence: 75,
        });
      }
    }

    // Identify sell-high candidates
    const sellHighCandidates = await this.findSellHighCandidates(team, week, season);
    for (const candidate of sellHighCandidates) {
      insights.push({
        type: 'trade',
        priority: 'low',
        title: `📈 Sell High: ${candidate.player.name}`,
        description: candidate.reason,
        actionItems: [`Shop ${candidate.player.name} for maximum value`],
        impact: 0, // Neutral impact
        confidence: candidate.confidence,
      });
    }

    return insights;
  }

  private async analyzeWaiverWire(team: any, week: number, season: number): Promise<CoachingInsight[]> {
    const insights: CoachingInsight[] = [];

    // Get available players
    const availablePlayers = await prisma.player.findMany({
      where: {
        id: {
          notIn: team.roster.map((r: any) => r.player_id),
        },
        position: {
          in: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'],
        },
      },
      include: {
        stats: {
          where: { season },
          orderBy: { week: 'desc' },
          take: 5,
        },
      },
    });

    // Score each available player
    const scoredPlayers = await Promise.all(
      availablePlayers.map(async (player) => {
        const prediction = await this.mlEngine.predictPlayerPerformance(player.id, week, season);
        const trend = await this.analytics.analyzeTrend(player.id);
        
        return {
          player,
          prediction,
          trend,
          score: this.calculateWaiverScore(player, prediction, trend),
        };
      })
    );

    // Get top waiver adds by position
    const positions = ['RB', 'WR', 'TE'];
    for (const position of positions) {
      const topAdds = scoredPlayers
        .filter(p => p.player.position === position)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (topAdds.length > 0 && topAdds[0].score > 50) {
        insights.push({
          type: 'waiver',
          priority: topAdds[0].score > 80 ? 'high' : 'medium',
          title: `🎯 Waiver Add: ${topAdds[0].player.name}`,
          description: `${topAdds[0].player.name} is trending ${topAdds[0].trend.direction} with high upside`,
          actionItems: [
            `Add ${topAdds[0].player.name}`,
            `Drop your lowest-scoring ${position}`,
          ],
          impact: topAdds[0].prediction?.predictedPoints || 0,
          confidence: topAdds[0].prediction?.confidence || 50,
        });
      }
    }

    // Streaming options (K, DST)
    const streamingInsights = await this.getStreamingOptions(team, week, season);
    insights.push(...streamingInsights);

    return insights;
  }

  private async analyzeStrategy(team: any, week: number, season: number): Promise<CoachingInsight[]> {
    const insights: CoachingInsight[] = [];

    // Analyze opponent's team
    const matchup = await this.getWeeklyMatchup(team.id, week, season);
    if (matchup) {
      const opponentAnalysis = await this.analyzeOpponent(matchup.opponent_id);
      
      insights.push({
        type: 'strategy',
        priority: 'medium',
        title: '🎯 Matchup Strategy',
        description: `Your opponent is weak at ${opponentAnalysis.weakPosition}. Consider starting players facing weak defenses.`,
        actionItems: opponentAnalysis.recommendations,
        impact: 5,
        confidence: 70,
      });
    }

    // Playoff positioning
    if (week > 10) {
      const playoffAnalysis = await this.analyzePlayoffScenarios(team, week, season);
      if (playoffAnalysis.mustWin) {
        insights.push({
          type: 'strategy',
          priority: 'high',
          title: '🏆 Must-Win Game',
          description: 'This game is crucial for your playoff chances',
          actionItems: [
            'Start highest-upside players',
            'Consider risky plays with high ceiling',
            'Stream defense/kicker for best matchups',
          ],
          impact: 10,
          confidence: 90,
        });
      }
    }

    // Weather impact
    const weatherImpact = await this.analyzeWeatherImpact(team.roster, week);
    if (weatherImpact.length > 0) {
      insights.push({
        type: 'strategy',
        priority: 'medium',
        title: '🌧️ Weather Alert',
        description: 'Poor weather conditions may impact some players',
        actionItems: weatherImpact.map(w => w.recommendation),
        impact: -3,
        confidence: 60,
      });
    }

    return insights;
  }

  private async generateOptimalLineup(team: any, week: number, season: number): Promise<any[]> {
    const predictions = await Promise.all(
      team.roster.map(async (r: any) => ({
        ...r,
        prediction: await this.mlEngine.predictPlayerPerformance(r.player_id, week, season),
      }))
    );

    // Group by position
    const byPosition = predictions.reduce((acc, p) => {
      const pos = p.player.position;
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(p);
      return acc;
    }, {} as Record<string, any[]>);

    // Sort each position by predicted points
    for (const pos in byPosition) {
      byPosition[pos].sort((a, b) => 
        (b.prediction?.predictedPoints || 0) - (a.prediction?.predictedPoints || 0)
      );
    }

    // Build optimal lineup based on league settings
    const lineup = [];
    const lineupRequirements = team.league.lineup_settings || {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DST: 1,
    };

    // Fill required positions
    for (const [pos, count] of Object.entries(lineupRequirements)) {
      if (pos === 'FLEX') continue; // Handle flex separately
      
      const players = byPosition[pos] || [];
      lineup.push(...players.slice(0, count as number));
    }

    // Handle FLEX position
    if (lineupRequirements.FLEX) {
      const flexEligible = [
        ...(byPosition.RB || []).slice(lineupRequirements.RB || 0),
        ...(byPosition.WR || []).slice(lineupRequirements.WR || 0),
        ...(byPosition.TE || []).slice(lineupRequirements.TE || 0),
      ].sort((a, b) => 
        (b.prediction?.predictedPoints || 0) - (a.prediction?.predictedPoints || 0)
      );
      
      lineup.push(...flexEligible.slice(0, lineupRequirements.FLEX));
    }

    return lineup;
  }

  private async calculateProjectedScore(lineup: any[], week: number, season: number): Promise<number> {
    let totalScore = 0;
    
    for (const player of lineup) {
      if (player.prediction) {
        totalScore += player.prediction.predictedPoints;
      }
    }
    
    return Math.round(totalScore * 10) / 10;
  }

  private async getRecommendedMoves(team: any, insights: CoachingInsight[]): Promise<any[]> {
    const moves = [];
    
    // Convert high-priority insights to actionable moves
    for (const insight of insights.filter(i => i.priority === 'high')) {
      moves.push({
        type: insight.type,
        action: insight.actionItems[0],
        impact: insight.impact,
        confidence: insight.confidence,
      });
    }
    
    return moves.slice(0, 5); // Top 5 moves
  }

  // Helper methods
  private async checkByeWeeks(roster: any[], week: number, season: number): Promise<any[]> {
    const byePlayers = [];
    
    for (const r of roster) {
      const team = await prisma.team.findFirst({
        where: {
          players: { some: { id: r.player_id } },
        },
      });
      
      if (team && team.bye_week === week) {
        byePlayers.push(r.player);
      }
    }
    
    return byePlayers;
  }

  private async findBenchOpportunities(team: any, predictions: any[]): Promise<any[]> {
    const opportunities = [];
    const starters = team.roster.filter((r: any) => r.lineup_position);
    const bench = team.roster.filter((r: any) => !r.lineup_position);
    
    for (const starter of starters) {
      const starterPred = predictions.find(p => p?.playerId === starter.player_id);
      if (!starterPred) continue;
      
      // Find bench players at same position
      const benchAtPosition = bench.filter((b: any) => 
        b.player.position === starter.player.position ||
        (starter.lineup_position === 'FLEX' && ['RB', 'WR', 'TE'].includes(b.player.position))
      );
      
      for (const benchPlayer of benchAtPosition) {
        const benchPred = predictions.find(p => p?.playerId === benchPlayer.player_id);
        if (!benchPred) continue;
        
        const pointDiff = benchPred.predictedPoints - starterPred.predictedPoints;
        if (pointDiff > 2) {
          opportunities.push({
            starter: starter.player,
            benchPlayer: benchPlayer.player,
            pointDiff,
            confidence: Math.min(starterPred.confidence, benchPred.confidence),
          });
        }
      }
    }
    
    return opportunities;
  }

  private async optimizeFlex(team: any, predictions: any[]): Promise<CoachingInsight | null> {
    const currentFlex = team.roster.find((r: any) => r.lineup_position === 'FLEX');
    if (!currentFlex) return null;
    
    const flexEligible = team.roster.filter((r: any) => 
      ['RB', 'WR', 'TE'].includes(r.player.position) && 
      (!r.lineup_position || r.lineup_position === 'FLEX')
    );
    
    let bestOption = currentFlex;
    let bestPoints = 0;
    
    for (const player of flexEligible) {
      const pred = predictions.find(p => p?.playerId === player.player_id);
      if (pred && pred.predictedPoints > bestPoints) {
        bestPoints = pred.predictedPoints;
        bestOption = player;
      }
    }
    
    if (bestOption.player_id !== currentFlex.player_id) {
      const currentPred = predictions.find(p => p?.playerId === currentFlex.player_id);
      const improvement = bestPoints - (currentPred?.predictedPoints || 0);
      
      return {
        type: 'lineup',
        priority: improvement > 5 ? 'high' : 'medium',
        title: '🔄 FLEX Optimization',
        description: `Start ${bestOption.player.name} in FLEX for +${improvement.toFixed(1)} points`,
        actionItems: [`Move ${bestOption.player.name} to FLEX`],
        impact: improvement,
        confidence: 80,
      };
    }
    
    return null;
  }

  private async identifyWeakPositions(team: any): Promise<string[]> {
    const weakPositions = [];
    const positionScores = new Map<string, number>();
    
    // Calculate average points by position
    for (const r of team.roster) {
      const pos = r.player.position;
      const avgPoints = r.player.stats.reduce((sum: number, s: any) => 
        sum + (s.fantasy_points_ppr || 0), 0
      ) / (r.player.stats.length || 1);
      
      if (!positionScores.has(pos)) {
        positionScores.set(pos, 0);
      }
      positionScores.set(pos, positionScores.get(pos)! + avgPoints);
    }
    
    // Compare to league averages (simplified)
    const leagueAvg = { QB: 20, RB: 15, WR: 12, TE: 8 };
    
    for (const [pos, avgPoints] of positionScores) {
      if (leagueAvg[pos as keyof typeof leagueAvg] && 
          avgPoints < leagueAvg[pos as keyof typeof leagueAvg] * 0.8) {
        weakPositions.push(pos);
      }
    }
    
    return weakPositions;
  }

  private async findTradeTargets(team: any, position: string, week: number, season: number): Promise<any[]> {
    // This would integrate with league data to find actual trade targets
    // Simplified version for demonstration
    return [];
  }

  private async findSellHighCandidates(team: any, week: number, season: number): Promise<any[]> {
    const candidates = [];
    
    for (const r of team.roster) {
      const trend = await this.analytics.analyzeTrend(r.player_id);
      const anomalies = await this.analytics.detectAnomalies(r.player_id);
      
      // Player is overperforming
      if (trend.direction === 'up' && anomalies.some(a => a.reason?.includes('Exceptionally high'))) {
        candidates.push({
          player: r.player,
          reason: 'Player is performing above expectations and may regress',
          confidence: 70,
        });
      }
    }
    
    return candidates;
  }

  private calculateWaiverScore(player: any, prediction: any, trend: any): number {
    let score = 0;
    
    // Base score from predicted points
    if (prediction) {
      score += prediction.predictedPoints * 2;
    }
    
    // Trend bonus
    if (trend.direction === 'up') {
      score += 20;
    }
    
    // Recent performance
    const recentAvg = player.stats.slice(0, 3).reduce((sum: number, s: any) => 
      sum + (s.fantasy_points_ppr || 0), 0
    ) / 3;
    score += recentAvg;
    
    // Consistency bonus
    if (trend.confidence > 70) {
      score += 10;
    }
    
    return score;
  }

  private async getStreamingOptions(team: any, week: number, season: number): Promise<CoachingInsight[]> {
    // Simplified streaming recommendations
    return [];
  }

  private async getWeeklyMatchup(teamId: string, week: number, season: number): Promise<any> {
    // Get matchup data from league
    return null;
  }

  private async analyzeOpponent(opponentId: string): Promise<any> {
    // Analyze opponent's weaknesses
    return {
      weakPosition: 'RB',
      recommendations: ['Target RB matchups'],
    };
  }

  private async analyzePlayoffScenarios(team: any, week: number, season: number): Promise<any> {
    // Calculate playoff scenarios
    return {
      mustWin: week > 11,
    };
  }

  private async analyzeWeatherImpact(roster: any[], week: number): Promise<any[]> {
    // Check weather for outdoor games
    return [];
  }
}