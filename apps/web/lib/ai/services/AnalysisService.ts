import { PlayerService, Player, PlayerStats, PlayerWithStats, ScoringSystem } from './PlayerService'
import { mlEngine } from '../../ml/MLPredictionEngine'
import { z } from 'zod'

// Analysis result types
export interface PlayerComparison {
  player1: PlayerWithStats
  player2: PlayerWithStats
  winner: string
  confidence: number
  reasoning: string[]
  statistics: {
    category: string
    player1Value: number
    player2Value: number
    advantage: string
  }[]
}

export interface TradeAnalysis {
  givingPlayers: PlayerWithStats[]
  receivingPlayers: PlayerWithStats[]
  givingValue: number
  receivingValue: number
  fairness: 'fair' | 'slightly_unfair' | 'very_unfair'
  recommendation: 'accept' | 'reject' | 'negotiate'
  reasoning: string[]
  valueGap: number
}

export interface LineupRecommendation {
  starters: PlayerWithStats[]
  bench: PlayerWithStats[]
  projectedPoints: number
  reasoning: Map<string, string>
  alternativeLineups?: {
    lineup: PlayerWithStats[]
    projectedPoints: number
    description: string
  }[]
}

export interface PlayerProjection {
  player: Player
  projectedPoints: number
  floor: number
  ceiling: number
  confidence: number
  factors: {
    factor: string
    impact: 'positive' | 'negative' | 'neutral'
    description: string
  }[]
}

export interface TrendAnalysis {
  player: PlayerWithStats
  trend: 'improving' | 'declining' | 'stable'
  trendScore: number // -1 to 1
  recentAverage: number
  seasonAverage: number
  insights: string[]
}

export class AnalysisService {
  private playerService: PlayerService
  
  constructor() {
    this.playerService = new PlayerService()
  }
  
  /**
   * Compare two players head-to-head
   */
  async comparePerformance(
    player1Id: string, 
    player2Id: string,
    weeks: number = 5,
    scoring: ScoringSystem = ScoringSystem.PPR
  ): Promise<PlayerComparison> {
    // Fetch both players with stats
    const [player1, player2] = await Promise.all([
      this.playerService.getPlayerWithStats(player1Id, undefined, weeks),
      this.playerService.getPlayerWithStats(player2Id, undefined, weeks)
    ])
    
    if (!player1 || !player2) {
      throw new Error('One or both players not found')
    }
    
    // Calculate averages
    const player1Avg = this.calculateAveragePoints(player1.stats, scoring)
    const player2Avg = this.calculateAveragePoints(player2.stats, scoring)
    
    // Detailed statistics comparison
    const statistics = [
      {
        category: 'Average Points',
        player1Value: player1Avg,
        player2Value: player2Avg,
        advantage: player1Avg > player2Avg ? player1.firstName : player2.firstName
      },
      {
        category: 'Consistency',
        player1Value: this.calculateConsistency(player1.stats),
        player2Value: this.calculateConsistency(player2.stats),
        advantage: this.calculateConsistency(player1.stats) > this.calculateConsistency(player2.stats) 
          ? player1.firstName : player2.firstName
      },
      {
        category: 'Recent Trend',
        player1Value: this.calculateTrend(player1.stats),
        player2Value: this.calculateTrend(player2.stats),
        advantage: this.calculateTrend(player1.stats) > this.calculateTrend(player2.stats) 
          ? player1.firstName : player2.firstName
      }
    ]
    
    // Determine winner
    const player1Score = player1Avg + this.calculateConsistency(player1.stats) * 10 + this.calculateTrend(player1.stats) * 5
    const player2Score = player2Avg + this.calculateConsistency(player2.stats) * 10 + this.calculateTrend(player2.stats) * 5
    
    const winner = player1Score > player2Score ? player1.firstName + ' ' + player1.lastName : player2.firstName + ' ' + player2.lastName
    const confidence = Math.abs(player1Score - player2Score) / Math.max(player1Score, player2Score)
    
    // Generate reasoning
    const reasoning = this.generateComparisonReasoning(player1, player2, statistics, scoring)
    
    return {
      player1,
      player2,
      winner,
      confidence,
      reasoning,
      statistics
    }
  }
  
  /**
   * Analyze a trade proposal
   */
  async analyzeTrade(
    givingPlayerIds: string[],
    receivingPlayerIds: string[],
    scoring: ScoringSystem = ScoringSystem.PPR
  ): Promise<TradeAnalysis> {
    // Fetch all players
    const [givingPlayers, receivingPlayers] = await Promise.all([
      Promise.all(givingPlayerIds.map(id => this.playerService.getPlayerWithStats(id))),
      Promise.all(receivingPlayerIds.map(id => this.playerService.getPlayerWithStats(id)))
    ])
    
    // Filter out nulls
    const validGiving = givingPlayers.filter((p): p is PlayerWithStats => p !== null)
    const validReceiving = receivingPlayers.filter((p): p is PlayerWithStats => p !== null)
    
    // Calculate values
    const givingValue = this.calculateTradeValue(validGiving, scoring)
    const receivingValue = this.calculateTradeValue(validReceiving, scoring)
    const valueGap = Math.abs(givingValue - receivingValue)
    const valueRatio = Math.min(givingValue, receivingValue) / Math.max(givingValue, receivingValue)
    
    // Determine fairness
    let fairness: TradeAnalysis['fairness'] = 'fair'
    if (valueRatio < 0.85) fairness = 'slightly_unfair'
    if (valueRatio < 0.70) fairness = 'very_unfair'
    
    // Make recommendation
    let recommendation: TradeAnalysis['recommendation'] = 'accept'
    if (givingValue > receivingValue) {
      if (fairness === 'very_unfair') recommendation = 'reject'
      else if (fairness === 'slightly_unfair') recommendation = 'negotiate'
    }
    
    // Generate reasoning
    const reasoning = this.generateTradeReasoning(validGiving, validReceiving, givingValue, receivingValue, fairness)
    
    return {
      givingPlayers: validGiving,
      receivingPlayers: validReceiving,
      givingValue,
      receivingValue,
      fairness,
      recommendation,
      reasoning,
      valueGap
    }
  }
  
  /**
   * Project future performance for a player
   */
  async projectFuturePerformance(
    playerId: string,
    weeks: number = 1
  ): Promise<PlayerProjection> {
    const player = await this.playerService.getPlayerWithStats(playerId)
    if (!player) throw new Error('Player not found')
    
    // Use ML engine for prediction
    const mlPrediction = await mlEngine.predictPlayerPerformance(
      playerId,
      this.getCurrentWeek() + weeks
    )
    
    if (!mlPrediction) {
      // Fallback to statistical projection
      return this.statisticalProjection(player)
    }
    
    // Calculate floor and ceiling
    const historicalStats = player.stats.map(s => 
      this.playerService.calculateFantasyPoints(s.stats, ScoringSystem.PPR)
    )
    const stdDev = this.calculateStandardDeviation(historicalStats)
    
    const projectedPoints = mlPrediction.predictedPoints
    const floor = Math.max(0, projectedPoints - stdDev)
    const ceiling = projectedPoints + stdDev
    
    // Analyze factors
    const factors = this.analyzeProjectionFactors(player, mlPrediction)
    
    return {
      player,
      projectedPoints,
      floor,
      ceiling,
      confidence: mlPrediction.confidence / 100,
      factors
    }
  }
  
  /**
   * Analyze player trends
   */
  async analyzeTrends(playerId: string, weeks: number = 5): Promise<TrendAnalysis> {
    const player = await this.playerService.getPlayerWithStats(playerId, undefined, weeks)
    if (!player) throw new Error('Player not found')
    
    const recentStats = player.stats.slice(0, Math.min(3, player.stats.length))
    const allStats = player.stats
    
    const recentAverage = this.calculateAveragePoints(recentStats, ScoringSystem.PPR)
    const seasonAverage = this.calculateAveragePoints(allStats, ScoringSystem.PPR)
    const trendScore = this.calculateTrend(allStats)
    
    let trend: TrendAnalysis['trend'] = 'stable'
    if (trendScore > 0.2) trend = 'improving'
    if (trendScore < -0.2) trend = 'declining'
    
    const insights = this.generateTrendInsights(player, recentAverage, seasonAverage, trend)
    
    return {
      player,
      trend,
      trendScore,
      recentAverage,
      seasonAverage,
      insights
    }
  }
  
  /**
   * Recommend optimal lineup
   */
  async recommendLineup(
    playerIds: string[],
    requirements: {
      qb: number
      rb: number
      wr: number
      te: number
      flex: number
      dst: number
      k: number
    },
    scoring: ScoringSystem = ScoringSystem.PPR
  ): Promise<LineupRecommendation> {
    // Fetch all players
    const players = await Promise.all(
      playerIds.map(id => this.playerService.getPlayerWithStats(id))
    )
    const validPlayers = players.filter((p): p is PlayerWithStats => p !== null)
    
    // Get projections for all players
    const projections = await Promise.all(
      validPlayers.map(async p => ({
        player: p,
        projection: await this.projectFuturePerformance(p.id)
      }))
    )
    
    // Sort by projected points
    projections.sort((a, b) => b.projection.projectedPoints - a.projection.projectedPoints)
    
    // Build optimal lineup
    const lineup = this.buildOptimalLineup(projections, requirements)
    
    // Calculate total projected points
    const projectedPoints = lineup.starters.reduce(
      (sum, p) => sum + projections.find(proj => proj.player.id === p.id)!.projection.projectedPoints,
      0
    )
    
    // Generate reasoning for each position
    const reasoning = this.generateLineupReasoning(lineup.starters, projections)
    
    return {
      starters: lineup.starters,
      bench: lineup.bench,
      projectedPoints,
      reasoning
    }
  }
  
  // Helper methods
  
  private calculateAveragePoints(stats: PlayerStats[], scoring: ScoringSystem): number {
    if (stats.length === 0) return 0
    const total = stats.reduce((sum, stat) => 
      sum + this.playerService.calculateFantasyPoints(stat.stats, scoring), 0
    )
    return Math.round((total / stats.length) * 10) / 10
  }
  
  private calculateConsistency(stats: PlayerStats[]): number {
    if (stats.length < 2) return 0
    const points = stats.map(s => this.playerService.calculateFantasyPoints(s.stats, ScoringSystem.PPR))
    const avg = points.reduce((a, b) => a + b, 0) / points.length
    const variance = points.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / points.length
    const stdDev = Math.sqrt(variance)
    return avg > 0 ? 1 - (stdDev / avg) : 0
  }
  
  private calculateTrend(stats: PlayerStats[]): number {
    if (stats.length < 2) return 0
    const points = stats.map(s => this.playerService.calculateFantasyPoints(s.stats, ScoringSystem.PPR))
    
    // Simple linear regression
    const n = points.length
    const sumX = (n * (n - 1)) / 2
    const sumY = points.reduce((a, b) => a + b, 0)
    const sumXY = points.reduce((sum, y, x) => sum + x * y, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    return slope / Math.max(...points) // Normalize by max value
  }
  
  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
    return Math.sqrt(variance)
  }
  
  private calculateTradeValue(players: PlayerWithStats[], scoring: ScoringSystem): number {
    return players.reduce((sum, player) => {
      const avgPoints = this.calculateAveragePoints(player.stats, scoring)
      const consistency = this.calculateConsistency(player.stats)
      const trend = this.calculateTrend(player.stats)
      
      // Value formula: average points + consistency bonus + trend adjustment
      return sum + avgPoints * (1 + consistency * 0.2 + trend * 0.1)
    }, 0)
  }
  
  private getCurrentWeek(): number {
    const seasonStart = new Date(new Date().getFullYear(), 8, 7) // Sept 7
    const now = new Date()
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    return Math.min(Math.max(1, weeksSinceStart + 1), 18)
  }
  
  private statisticalProjection(player: PlayerWithStats): PlayerProjection {
    const avgPoints = this.calculateAveragePoints(player.stats, ScoringSystem.PPR)
    const stdDev = this.calculateStandardDeviation(
      player.stats.map(s => this.playerService.calculateFantasyPoints(s.stats, ScoringSystem.PPR))
    )
    
    return {
      player,
      projectedPoints: avgPoints,
      floor: Math.max(0, avgPoints - stdDev),
      ceiling: avgPoints + stdDev,
      confidence: 0.7,
      factors: [
        {
          factor: 'Season Average',
          impact: 'neutral',
          description: `Based on ${avgPoints} points per game average`
        }
      ]
    }
  }
  
  private analyzeProjectionFactors(player: PlayerWithStats, mlPrediction: any): PlayerProjection['factors'] {
    const factors: PlayerProjection['factors'] = []
    
    // Add ML insights
    mlPrediction.insights.forEach((insight: string) => {
      const impact = insight.includes('📈') ? 'positive' : 
                    insight.includes('📉') ? 'negative' : 'neutral'
      factors.push({
        factor: 'ML Analysis',
        impact,
        description: insight
      })
    })
    
    // Add injury status
    if (player.injuries && player.injuries.length > 0) {
      const injury = player.injuries[0]
      factors.push({
        factor: 'Injury Status',
        impact: 'negative',
        description: `${injury.status} - ${injury.description}`
      })
    }
    
    return factors
  }
  
  private buildOptimalLineup(
    projections: { player: PlayerWithStats; projection: PlayerProjection }[],
    requirements: any
  ) {
    const starters: PlayerWithStats[] = []
    const bench: PlayerWithStats[] = []
    const used = new Set<string>()
    
    // Fill required positions
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']
    
    for (const pos of positions) {
      const count = requirements[pos.toLowerCase()] || 0
      const eligible = projections.filter(p => 
        p.player.position.includes(pos) && !used.has(p.player.id)
      )
      
      for (let i = 0; i < count && i < eligible.length; i++) {
        starters.push(eligible[i].player)
        used.add(eligible[i].player.id)
      }
    }
    
    // Fill flex positions
    const flexEligible = projections.filter(p => 
      ['RB', 'WR', 'TE'].some(pos => p.player.position.includes(pos)) && 
      !used.has(p.player.id)
    )
    
    for (let i = 0; i < requirements.flex && i < flexEligible.length; i++) {
      starters.push(flexEligible[i].player)
      used.add(flexEligible[i].player.id)
    }
    
    // Rest go to bench
    projections.forEach(p => {
      if (!used.has(p.player.id)) {
        bench.push(p.player)
      }
    })
    
    return { starters, bench }
  }
  
  // Reasoning generation methods
  
  private generateComparisonReasoning(
    player1: PlayerWithStats,
    player2: PlayerWithStats,
    statistics: any[],
    scoring: ScoringSystem
  ): string[] {
    const reasoning: string[] = []
    
    // Overall performance
    const avgDiff = statistics[0].player1Value - statistics[0].player2Value
    if (Math.abs(avgDiff) > 2) {
      reasoning.push(
        `${statistics[0].advantage} averages ${Math.abs(avgDiff).toFixed(1)} more points per game`
      )
    }
    
    // Consistency
    if (statistics[1].player1Value > statistics[1].player2Value) {
      reasoning.push(`${player1.firstName} is the more consistent performer`)
    } else {
      reasoning.push(`${player2.firstName} is the more consistent performer`)
    }
    
    // Trend
    const trend1 = statistics[2].player1Value
    const trend2 = statistics[2].player2Value
    if (trend1 > 0.2 && trend2 < 0.2) {
      reasoning.push(`${player1.firstName} is trending upward while ${player2.firstName} is not`)
    }
    
    return reasoning
  }
  
  private generateTradeReasoning(
    giving: PlayerWithStats[],
    receiving: PlayerWithStats[],
    givingValue: number,
    receivingValue: number,
    fairness: string
  ): string[] {
    const reasoning: string[] = []
    
    // Value comparison
    const valueDiff = givingValue - receivingValue
    if (Math.abs(valueDiff) < 5) {
      reasoning.push('Trade values are approximately equal')
    } else if (valueDiff > 0) {
      reasoning.push(`You're giving up ${valueDiff.toFixed(1)} more points in value`)
    } else {
      reasoning.push(`You're receiving ${Math.abs(valueDiff).toFixed(1)} more points in value`)
    }
    
    // Player quality
    const bestGiving = giving.reduce((best, p) => 
      this.calculateAveragePoints(p.stats, ScoringSystem.PPR) > 
      this.calculateAveragePoints(best.stats, ScoringSystem.PPR) ? p : best
    )
    const bestReceiving = receiving.reduce((best, p) => 
      this.calculateAveragePoints(p.stats, ScoringSystem.PPR) > 
      this.calculateAveragePoints(best.stats, ScoringSystem.PPR) ? p : best
    )
    
    reasoning.push(
      `Best player given up: ${bestGiving.firstName} ${bestGiving.lastName}`,
      `Best player received: ${bestReceiving.firstName} ${bestReceiving.lastName}`
    )
    
    // Fairness assessment
    if (fairness === 'fair') {
      reasoning.push('This trade appears balanced for both sides')
    } else if (fairness === 'slightly_unfair') {
      reasoning.push('This trade slightly favors one side')
    } else {
      reasoning.push('This trade is significantly unbalanced')
    }
    
    return reasoning
  }
  
  private generateTrendInsights(
    player: PlayerWithStats,
    recentAvg: number,
    seasonAvg: number,
    trend: string
  ): string[] {
    const insights: string[] = []
    
    // Performance comparison
    const diff = recentAvg - seasonAvg
    if (Math.abs(diff) > 2) {
      if (diff > 0) {
        insights.push(`Averaging ${diff.toFixed(1)} more points recently than season average`)
      } else {
        insights.push(`Averaging ${Math.abs(diff).toFixed(1)} fewer points recently than season average`)
      }
    }
    
    // Trend description
    if (trend === 'improving') {
      insights.push('Performance has been steadily improving')
    } else if (trend === 'declining') {
      insights.push('Performance has been declining')
    } else {
      insights.push('Performance has been relatively stable')
    }
    
    // Context from stats
    if (player.stats.length >= 3) {
      const last3Games = player.stats.slice(0, 3).map(s => 
        this.playerService.calculateFantasyPoints(s.stats, ScoringSystem.PPR)
      )
      const highGame = Math.max(...last3Games)
      const lowGame = Math.min(...last3Games)
      
      insights.push(`Recent range: ${lowGame}-${highGame} points`)
    }
    
    return insights
  }
  
  private generateLineupReasoning(
    starters: PlayerWithStats[],
    projections: any[]
  ): Map<string, string> {
    const reasoning = new Map<string, string>()
    
    starters.forEach(starter => {
      const proj = projections.find(p => p.player.id === starter.id)
      if (proj) {
        const position = starter.position[0]
        const points = proj.projection.projectedPoints
        reasoning.set(
          `${starter.firstName} ${starter.lastName}`,
          `Projected for ${points} points at ${position}`
        )
      }
    })
    
    return reasoning
  }
}