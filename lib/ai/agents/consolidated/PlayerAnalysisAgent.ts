import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent'
import { PlayerService } from '../../services/PlayerService'
import { QueryParser, QueryIntent } from '../../services/QueryParser'
import { AnalysisService } from '../../services/AnalysisService'
import { createAgentLogger } from '../../../utils/logger'

/**
 * PlayerAnalysisAgent - Consolidated agent for all player-related queries
 * 
 * Handles:
 * - Player statistics and performance
 * - Injury analysis
 * - Trend analysis
 * - Player comparisons
 * - Rookie analysis
 * - Historical performance
 */
export class PlayerAnalysisAgent extends BaseAgent {
  private playerService: PlayerService
  private queryParser: QueryParser
  private analysisService: AnalysisService
  private logger = createAgentLogger('PlayerAnalysisAgent')
  
  constructor() {
    super(
      'Player Analysis Expert',
      'Comprehensive player analysis including stats, injuries, trends, and comparisons',
      [] // Keywords handled by QueryParser
    )
    
    this.playerService = new PlayerService()
    this.queryParser = new QueryParser()
    this.analysisService = new AnalysisService()
  }
  
  /**
   * Check if this agent can handle the query
   */
  canHandle(query: string): boolean {
    const { intent } = this.queryParser.parseQuery(query)
    
    return [
      QueryIntent.PLAYER_STATS,
      QueryIntent.PLAYER_COMPARISON,
      QueryIntent.INJURY_STATUS,
      QueryIntent.PLAYER_TRENDS,
      QueryIntent.PLAYER_PROJECTION,
      QueryIntent.ROOKIE_ANALYSIS
    ].includes(intent)
  }
  
  /**
   * Process the query
   */
  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    const { intent, entities } = this.queryParser.parseQuery(query)
    
    try {
      switch (intent) {
        case QueryIntent.PLAYER_STATS:
          return await this.handlePlayerStats(entities, context)
          
        case QueryIntent.PLAYER_COMPARISON:
          return await this.handlePlayerComparison(entities, context)
          
        case QueryIntent.INJURY_STATUS:
          return await this.handleInjuryStatus(entities, context)
          
        case QueryIntent.PLAYER_TRENDS:
          return await this.handlePlayerTrends(entities, context)
          
        case QueryIntent.PLAYER_PROJECTION:
          return await this.handlePlayerProjection(entities, context)
          
        case QueryIntent.ROOKIE_ANALYSIS:
          return await this.handleRookieAnalysis(entities, context)
          
        default:
          return {
            success: false,
            message: "I couldn't understand what player information you're looking for.",
            suggestions: [
              "Ask about player stats: 'How many yards does Patrick Mahomes have?'",
              "Compare players: 'Compare Travis Kelce vs Mark Andrews'",
              "Check injuries: 'Is Justin Jefferson injured?'",
              "Analyze trends: 'How is CeeDee Lamb trending?'"
            ]
          }
      }
    } catch (error) {
      this.logger.error('Player analysis error', error)
      return {
        success: false,
        message: "I encountered an error analyzing player data. Please try again.",
      }
    }
  }
  
  /**
   * Handle player stats queries
   */
  private async handlePlayerStats(entities: any, context: AgentContext): Promise<AgentResponse> {
    const playerName = entities.players[0]
    if (!playerName) {
      return {
        success: false,
        message: "Please specify which player's stats you'd like to see.",
      }
    }
    
    // Find player
    const players = await this.playerService.findPlayerByName(playerName)
    if (players.length === 0) {
      return {
        success: false,
        message: `I couldn't find a player named "${playerName}".`,
        suggestions: ["Try the full name or check the spelling"]
      }
    }
    
    const player = players[0]
    const playerData = await this.playerService.getPlayerWithStats(
      player.id,
      entities.timeframe?.season,
      entities.timeframe?.week
    )
    
    if (!playerData || !playerData.stats.length) {
      return {
        success: false,
        message: `No stats available for ${player.firstName} ${player.lastName}.`,
      }
    }
    
    // Format stats response
    const latestStats = playerData.stats[0]
    const avgPoints = this.calculateAveragePoints(playerData.stats)
    
    const statsMessage = this.formatPlayerStats(playerData, latestStats, avgPoints)
    
    return {
      success: true,
      message: statsMessage,
      data: {
        player: playerData,
        averagePoints: avgPoints,
        recentStats: playerData.stats.slice(0, 5)
      },
      confidence: 0.95
    }
  }
  
  /**
   * Handle player comparison queries
   */
  private async handlePlayerComparison(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (entities.players.length < 2) {
      return {
        success: false,
        message: "Please specify two players to compare.",
        suggestions: ["Example: 'Compare Stefon Diggs vs CeeDee Lamb'"]
      }
    }
    
    // Find both players
    const [players1, players2] = await Promise.all([
      this.playerService.findPlayerByName(entities.players[0]),
      this.playerService.findPlayerByName(entities.players[1])
    ])
    
    if (players1.length === 0 || players2.length === 0) {
      return {
        success: false,
        message: "I couldn't find one or both players.",
      }
    }
    
    // Perform comparison
    const comparison = await this.analysisService.comparePerformance(
      players1[0].id,
      players2[0].id,
      5,
      entities.scoringSystem || 'ppr'
    )
    
    const message = this.formatComparison(comparison)
    
    return {
      success: true,
      message,
      data: comparison,
      confidence: comparison.confidence
    }
  }
  
  /**
   * Handle injury status queries
   */
  private async handleInjuryStatus(entities: any, context: AgentContext): Promise<AgentResponse> {
    const playerName = entities.players[0]
    if (!playerName) {
      return {
        success: false,
        message: "Please specify which player's injury status you'd like to check.",
      }
    }
    
    // Find player
    const players = await this.playerService.findPlayerByName(playerName)
    if (players.length === 0) {
      return {
        success: false,
        message: `I couldn't find a player named "${playerName}".`,
      }
    }
    
    const player = players[0]
    const injury = await this.playerService.getPlayerInjuryStatus(player.id)
    
    if (!injury) {
      return {
        success: true,
        message: `✅ ${player.firstName} ${player.lastName} has no reported injuries and appears to be healthy.`,
        data: { player, injuryStatus: 'healthy' },
        confidence: 0.9
      }
    }
    
    const message = this.formatInjuryStatus(player, injury)
    
    return {
      success: true,
      message,
      data: { player, injury },
      confidence: 0.95
    }
  }
  
  /**
   * Handle player trends queries
   */
  private async handlePlayerTrends(entities: any, context: AgentContext): Promise<AgentResponse> {
    const playerName = entities.players[0]
    if (!playerName) {
      return {
        success: false,
        message: "Please specify which player's trends you'd like to analyze.",
      }
    }
    
    // Find player
    const players = await this.playerService.findPlayerByName(playerName)
    if (players.length === 0) {
      return {
        success: false,
        message: `I couldn't find a player named "${playerName}".`,
      }
    }
    
    const trendAnalysis = await this.analysisService.analyzeTrends(players[0].id)
    const message = this.formatTrendAnalysis(trendAnalysis)
    
    return {
      success: true,
      message,
      data: trendAnalysis,
      confidence: 0.85
    }
  }
  
  /**
   * Handle player projection queries
   */
  private async handlePlayerProjection(entities: any, context: AgentContext): Promise<AgentResponse> {
    const playerName = entities.players[0]
    if (!playerName) {
      return {
        success: false,
        message: "Please specify which player you'd like projections for.",
      }
    }
    
    // Find player
    const players = await this.playerService.findPlayerByName(playerName)
    if (players.length === 0) {
      return {
        success: false,
        message: `I couldn't find a player named "${playerName}".`,
      }
    }
    
    const projection = await this.analysisService.projectFuturePerformance(
      players[0].id,
      entities.timeframe?.week || 1
    )
    
    const message = this.formatProjection(projection)
    
    return {
      success: true,
      message,
      data: projection,
      confidence: projection.confidence
    }
  }
  
  /**
   * Handle rookie analysis queries
   */
  private async handleRookieAnalysis(entities: any, context: AgentContext): Promise<AgentResponse> {
    const currentYear = new Date().getFullYear()
    
    // Search for rookies
    const rookies = await this.playerService.searchPlayers({
      isActive: true,
      limit: 20
    })
    
    // Filter to current year rookies
    const currentRookies = rookies.filter(p => p.draftYear === currentYear)
    
    if (currentRookies.length === 0) {
      return {
        success: false,
        message: "No rookie data available for the current season.",
      }
    }
    
    // Get performance data for top rookies
    const rookieData = await Promise.all(
      currentRookies.slice(0, 10).map(async rookie => {
        const stats = await this.playerService.getPlayerWithStats(rookie.id)
        return { rookie, stats }
      })
    )
    
    const message = this.formatRookieAnalysis(rookieData)
    
    return {
      success: true,
      message,
      data: { rookies: rookieData },
      confidence: 0.8
    }
  }
  
  // Formatting helper methods
  
  private calculateAveragePoints(stats: any[]): number {
    if (stats.length === 0) return 0
    const total = stats.reduce((sum, stat) => 
      sum + this.playerService.calculateFantasyPoints(stat.stats), 0
    )
    return Math.round((total / stats.length) * 10) / 10
  }
  
  private formatPlayerStats(player: any, latestStats: any, avgPoints: number): string {
    const position = player.position[0]
    let statsLine = `📊 **${player.firstName} ${player.lastName}** (${position} - ${player.currentTeam?.abbreviation || 'FA'})\n\n`
    
    statsLine += `Season Average: **${avgPoints} PPR points/game**\n`
    
    // Position-specific stats
    if (position === 'QB') {
      statsLine += `Passing: ${latestStats.stats.passingYards || 0} yards, ${latestStats.stats.passingTouchdowns || 0} TDs\n`
    } else if (['RB', 'WR', 'TE'].includes(position)) {
      statsLine += `Rushing: ${latestStats.stats.rushingYards || 0} yards\n`
      statsLine += `Receiving: ${latestStats.stats.receptions || 0} rec, ${latestStats.stats.receivingYards || 0} yards\n`
    }
    
    statsLine += `\nLast ${player.stats.length} games: ${player.stats.map((s: any) => 
      this.playerService.calculateFantasyPoints(s.stats).toFixed(1)
    ).join(', ')} pts`
    
    return statsLine
  }
  
  private formatComparison(comparison: any): string {
    let message = `📊 **Player Comparison**\n\n`
    message += `**${comparison.winner}** is the better choice (${(comparison.confidence * 100).toFixed(0)}% confidence)\n\n`
    
    comparison.statistics.forEach((stat: any) => {
      message += `${stat.category}: ${stat.player1Value.toFixed(1)} vs ${stat.player2Value.toFixed(1)} - `
      message += `Advantage: ${stat.advantage}\n`
    })
    
    message += `\n**Analysis:**\n`
    comparison.reasoning.forEach((reason: string) => {
      message += `• ${reason}\n`
    })
    
    return message
  }
  
  private formatInjuryStatus(player: any, injury: any): string {
    const statusEmoji: Record<string, string> = {
      'out': '🔴',
      'doubtful': '🟠',
      'questionable': '🟡',
      'day-to-day': '🟡',
      'IR': '🔴'
    }
    
    let message = `${statusEmoji[injury.status] || '⚪'} **${player.firstName} ${player.lastName}** - ${injury.status.toUpperCase()}\n\n`
    message += `**Injury:** ${injury.injuryType} (${injury.bodyPart})\n`
    message += `**Details:** ${injury.description}\n`
    message += `**Reported:** ${new Date(injury.reportedDate).toLocaleDateString()}\n\n`
    
    if (injury.status === 'out' || injury.status === 'IR') {
      message += `⚠️ Not recommended for lineup this week`
    } else if (injury.status === 'questionable') {
      message += `⚠️ Monitor practice reports before game time`
    }
    
    return message
  }
  
  private formatTrendAnalysis(analysis: any): string {
    const trendEmoji: Record<string, string> = {
      'improving': '📈',
      'declining': '📉',
      'stable': '➡️'
    }
    
    let message = `${trendEmoji[analysis.trend]} **${analysis.player.firstName} ${analysis.player.lastName}** - ${analysis.trend.toUpperCase()}\n\n`
    message += `**Recent Average:** ${analysis.recentAverage.toFixed(1)} PPR pts/game\n`
    message += `**Season Average:** ${analysis.seasonAverage.toFixed(1)} PPR pts/game\n`
    message += `**Trend Score:** ${(analysis.trendScore * 100).toFixed(0)}%\n\n`
    
    message += `**Insights:**\n`
    analysis.insights.forEach((insight: string) => {
      message += `• ${insight}\n`
    })
    
    return message
  }
  
  private formatProjection(projection: any): string {
    let message = `🔮 **Projection for ${projection.player.firstName} ${projection.player.lastName}**\n\n`
    message += `**Projected Points:** ${projection.projectedPoints.toFixed(1)} PPR\n`
    message += `**Floor:** ${projection.floor.toFixed(1)} pts\n`
    message += `**Ceiling:** ${projection.ceiling.toFixed(1)} pts\n`
    message += `**Confidence:** ${(projection.confidence * 100).toFixed(0)}%\n\n`
    
    message += `**Key Factors:**\n`
    projection.factors.forEach((factor: any) => {
      const icon = factor.impact === 'positive' ? '✅' : 
                   factor.impact === 'negative' ? '❌' : '➖'
      message += `${icon} ${factor.description}\n`
    })
    
    return message
  }
  
  private formatRookieAnalysis(rookieData: any[]): string {
    let message = `🌟 **Top Rookie Performers**\n\n`
    
    rookieData
      .sort((a, b) => {
        const aPoints = this.calculateAveragePoints(a.stats?.stats || [])
        const bPoints = this.calculateAveragePoints(b.stats?.stats || [])
        return bPoints - aPoints
      })
      .slice(0, 5)
      .forEach((data, index) => {
        const avgPoints = this.calculateAveragePoints(data.stats?.stats || [])
        message += `${index + 1}. **${data.rookie.firstName} ${data.rookie.lastName}** `
        message += `(${data.rookie.position[0]} - ${data.rookie.currentTeam?.abbreviation || 'FA'})\n`
        message += `   Draft: Round ${data.rookie.draftRound}, Pick ${data.rookie.draftPick}\n`
        message += `   Avg Points: ${avgPoints.toFixed(1)} PPR/game\n\n`
      })
    
    return message
  }
}