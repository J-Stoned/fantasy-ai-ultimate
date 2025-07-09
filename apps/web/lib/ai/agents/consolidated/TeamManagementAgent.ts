import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent'
import { PlayerService, ScoringSystem } from '../../services/PlayerService'
import { QueryParser, QueryIntent } from '../../services/QueryParser'
import { AnalysisService } from '../../services/AnalysisService'
import { supabase } from '../../../supabase/client-browser'
import { createAgentLogger } from '../../../utils/logger'

/**
 * TeamManagementAgent - Consolidated agent for all team management queries
 * 
 * Handles:
 * - Lineup optimization
 * - Trade analysis
 * - Waiver wire recommendations
 * - Drop candidates
 * - Draft advice
 * - Coaching decisions
 */
export class TeamManagementAgent extends BaseAgent {
  private playerService: PlayerService
  private queryParser: QueryParser
  private analysisService: AnalysisService
  private logger = createAgentLogger('TeamManagementAgent')
  
  constructor() {
    super(
      'Team Management Expert',
      'Comprehensive team management including lineups, trades, waivers, and strategy',
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
      QueryIntent.LINEUP_OPTIMIZATION,
      QueryIntent.TRADE_ANALYSIS,
      QueryIntent.WAIVER_PICKUP,
      QueryIntent.DROP_CANDIDATE,
      QueryIntent.DRAFT_ADVICE
    ].includes(intent)
  }
  
  /**
   * Process the query
   */
  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    const { intent, entities } = this.queryParser.parseQuery(query)
    
    try {
      switch (intent) {
        case QueryIntent.LINEUP_OPTIMIZATION:
          return await this.handleLineupOptimization(entities, context)
          
        case QueryIntent.TRADE_ANALYSIS:
          return await this.handleTradeAnalysis(entities, context)
          
        case QueryIntent.WAIVER_PICKUP:
          return await this.handleWaiverPickup(entities, context)
          
        case QueryIntent.DROP_CANDIDATE:
          return await this.handleDropCandidate(entities, context)
          
        case QueryIntent.DRAFT_ADVICE:
          return await this.handleDraftAdvice(entities, context)
          
        default:
          return {
            success: false,
            message: "I couldn't understand what team management help you need.",
            suggestions: [
              "Ask about lineups: 'Who should I start this week?'",
              "Analyze trades: 'Should I trade Tyreek Hill for Austin Ekeler?'",
              "Find waiver pickups: 'Who should I pick up from waivers?'",
              "Get drop advice: 'Who should I drop from my team?'"
            ]
          }
      }
    } catch (error) {
      this.logger.error('Team management error', error)
      return {
        success: false,
        message: "I encountered an error analyzing your team. Please try again.",
      }
    }
  }
  
  /**
   * Handle lineup optimization queries
   */
  private async handleLineupOptimization(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (!context.fantasyTeamId) {
      return {
        success: false,
        message: "I need to know which fantasy team you're managing. Please specify your team.",
      }
    }
    
    // Get user's roster
    const roster = await this.getUserRoster(context.fantasyTeamId)
    if (!roster || roster.length === 0) {
      return {
        success: false,
        message: "I couldn't find any players on your roster.",
      }
    }
    
    // Get league settings for roster requirements
    const requirements = await this.getLeagueRequirements(context.leagueId)
    
    // Get lineup recommendation
    const recommendation = await this.analysisService.recommendLineup(
      roster.map(p => p.id),
      requirements,
      entities.scoringSystem || ScoringSystem.PPR
    )
    
    const message = this.formatLineupRecommendation(recommendation)
    
    return {
      success: true,
      message,
      data: recommendation,
      suggestions: this.generateLineupSuggestions(recommendation),
      confidence: 0.85
    }
  }
  
  /**
   * Handle trade analysis queries
   */
  private async handleTradeAnalysis(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (!entities.tradeDetails) {
      return {
        success: false,
        message: "Please specify the trade details. Example: 'Should I trade Justin Jefferson for Saquon Barkley?'",
      }
    }
    
    // Parse player names from trade details
    const givingPlayers = await this.parsePlayerNames(entities.tradeDetails.giving)
    const receivingPlayers = await this.parsePlayerNames(entities.tradeDetails.receiving)
    
    if (givingPlayers.length === 0 || receivingPlayers.length === 0) {
      return {
        success: false,
        message: "I couldn't identify all the players in this trade. Please check the names and try again.",
      }
    }
    
    // Analyze trade
    const analysis = await this.analysisService.analyzeTrade(
      givingPlayers.map(p => p.id),
      receivingPlayers.map(p => p.id),
      entities.scoringSystem || ScoringSystem.PPR
    )
    
    const message = this.formatTradeAnalysis(analysis)
    
    return {
      success: true,
      message,
      data: analysis,
      suggestions: this.generateTradeSuggestions(analysis),
      confidence: 0.8
    }
  }
  
  /**
   * Handle waiver pickup queries
   */
  private async handleWaiverPickup(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (!context.leagueId) {
      return {
        success: false,
        message: "I need to know which league you're in to suggest waiver pickups.",
      }
    }
    
    // Get available players
    const availablePlayers = await this.getAvailablePlayers(
      context.leagueId,
      entities.positions
    )
    
    if (availablePlayers.length === 0) {
      return {
        success: false,
        message: "No available players found on waivers matching your criteria.",
      }
    }
    
    // Rank by recent performance and opportunity
    const rankedPlayers = await this.rankWaiverPlayers(availablePlayers)
    
    // Get drop candidates if user has a full roster
    const dropCandidates = context.fantasyTeamId 
      ? await this.getDropCandidates(context.fantasyTeamId)
      : []
    
    const message = this.formatWaiverRecommendations(rankedPlayers, dropCandidates)
    
    return {
      success: true,
      message,
      data: {
        pickups: rankedPlayers.slice(0, 10),
        drops: dropCandidates
      },
      suggestions: this.generateWaiverSuggestions(rankedPlayers),
      confidence: 0.75
    }
  }
  
  /**
   * Handle drop candidate queries
   */
  private async handleDropCandidate(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (!context.fantasyTeamId) {
      return {
        success: false,
        message: "I need to know which team you're managing to suggest drops.",
      }
    }
    
    const dropCandidates = await this.getDropCandidates(context.fantasyTeamId)
    
    if (dropCandidates.length === 0) {
      return {
        success: false,
        message: "Your roster looks solid! I don't see any obvious drop candidates.",
      }
    }
    
    const message = this.formatDropCandidates(dropCandidates)
    
    return {
      success: true,
      message,
      data: { dropCandidates },
      confidence: 0.7
    }
  }
  
  /**
   * Handle draft advice queries
   */
  private async handleDraftAdvice(entities: any, context: AgentContext): Promise<AgentResponse> {
    // Get current draft position info
    const draftPosition = entities.draftPosition || 5 // Default middle pick
    const round = entities.round || 1
    
    // Get best available players by position
    const recommendations = await this.getDraftRecommendations(
      round,
      draftPosition,
      entities.positions,
      entities.scoringSystem || ScoringSystem.PPR
    )
    
    const message = this.formatDraftAdvice(recommendations, round, draftPosition)
    
    return {
      success: true,
      message,
      data: { recommendations, round, draftPosition },
      suggestions: [
        "Consider team needs and positional scarcity",
        "Don't reach for players - follow value",
        "Target players with high upside in middle rounds"
      ],
      confidence: 0.8
    }
  }
  
  // Helper methods
  
  private async getUserRoster(fantasyTeamId: string): Promise<any[]> {
    const { data: roster } = await supabase
      .from('fantasy_rosters')
      .select(`
        player_id,
        players (*)
      `)
      .eq('fantasy_team_id', fantasyTeamId)
      .eq('is_active', true)
    
    return roster?.map(r => r.players) || []
  }
  
  private async getLeagueRequirements(leagueId?: string): Promise<any> {
    if (!leagueId) {
      // Default requirements
      return {
        qb: 1,
        rb: 2,
        wr: 2,
        te: 1,
        flex: 1,
        dst: 1,
        k: 1
      }
    }
    
    const { data: league } = await supabase
      .from('fantasy_leagues')
      .select('roster_settings')
      .eq('id', leagueId)
      .single()
    
    return league?.roster_settings || {
      qb: 1,
      rb: 2,
      wr: 2,
      te: 1,
      flex: 1,
      dst: 1,
      k: 1
    }
  }
  
  private async parsePlayerNames(names: string[]): Promise<any[]> {
    const players = []
    
    for (const name of names) {
      const found = await this.playerService.findPlayerByName(name)
      if (found.length > 0) {
        players.push(found[0])
      }
    }
    
    return players
  }
  
  private async getAvailablePlayers(leagueId: string, positions?: string[]): Promise<any[]> {
    // Get all rostered player IDs
    const { data: rosteredPlayers } = await supabase
      .from('fantasy_rosters')
      .select('player_id')
      .eq('league_id', leagueId)
      .eq('is_active', true)
    
    const rosteredIds = rosteredPlayers?.map(r => r.player_id) || []
    
    // Search for available players
    const criteria: any = {
      isActive: true,
      limit: 100
    }
    
    if (positions && positions.length > 0) {
      criteria.position = positions
    }
    
    const allPlayers = await this.playerService.searchPlayers(criteria)
    
    // Filter out rostered players
    return allPlayers.filter(p => !rosteredIds.includes(p.id))
  }
  
  private async rankWaiverPlayers(players: any[]): Promise<any[]> {
    // Get recent stats for each player
    const playersWithStats = await Promise.all(
      players.map(async player => {
        const stats = await this.playerService.getPlayerWithStats(player.id, undefined, 3)
        return { player, stats }
      })
    )
    
    // Rank by recent performance and opportunity
    return playersWithStats
      .filter(p => p.stats && p.stats.stats.length > 0)
      .sort((a, b) => {
        const aPoints = this.calculateRecentAverage(a.stats?.stats || [])
        const bPoints = this.calculateRecentAverage(b.stats?.stats || [])
        return bPoints - aPoints
      })
      .map(p => p.player)
  }
  
  private async getDropCandidates(fantasyTeamId: string): Promise<any[]> {
    const roster = await this.getUserRoster(fantasyTeamId)
    
    // Get stats for all players
    const playersWithStats = await Promise.all(
      roster.map(async player => {
        const stats = await this.playerService.getPlayerWithStats(player.id, undefined, 5)
        return { player, stats }
      })
    )
    
    // Rank by performance (worst first)
    return playersWithStats
      .sort((a, b) => {
        const aPoints = this.calculateRecentAverage(a.stats?.stats || [])
        const bPoints = this.calculateRecentAverage(b.stats?.stats || [])
        return aPoints - bPoints
      })
      .slice(0, 5)
      .map(p => p.player)
  }
  
  private async getDraftRecommendations(
    round: number,
    pick: number,
    positions?: string[],
    scoring: ScoringSystem = ScoringSystem.PPR
  ): Promise<any[]> {
    // Get top players by ADP
    const topPlayers = await this.playerService.searchPlayers({
      position: positions,
      isActive: true,
      limit: 50
    })
    
    // Filter by appropriate ADP range for the round
    const adpMin = (round - 1) * 12 + pick - 5
    const adpMax = (round - 1) * 12 + pick + 15
    
    // Get projections for filtered players
    const projections = await Promise.all(
      topPlayers.map(async player => {
        const projection = await this.analysisService.projectFuturePerformance(player.id)
        return { player, projection }
      })
    )
    
    // Sort by projected value
    return projections
      .sort((a, b) => b.projection.projectedPoints - a.projection.projectedPoints)
      .map(p => p.player)
      .slice(0, 10)
  }
  
  private calculateRecentAverage(stats: any[]): number {
    if (stats.length === 0) return 0
    const points = stats.map(s => this.playerService.calculateFantasyPoints(s.stats))
    return points.reduce((a, b) => a + b, 0) / points.length
  }
  
  // Formatting methods
  
  private formatLineupRecommendation(recommendation: any): string {
    let message = `🏈 **Optimal Lineup** (Projected: ${recommendation.projectedPoints.toFixed(1)} pts)\n\n`
    message += `**Starters:**\n`
    
    recommendation.starters.forEach((player: any) => {
      const reasoning = recommendation.reasoning.get(`${player.firstName} ${player.lastName}`)
      message += `• ${player.position[0]} - **${player.firstName} ${player.lastName}** `
      message += `(${player.currentTeam?.abbreviation || 'FA'})\n`
      if (reasoning) {
        message += `  → ${reasoning}\n`
      }
    })
    
    message += `\n**Bench:**\n`
    recommendation.bench.slice(0, 5).forEach((player: any) => {
      message += `• ${player.firstName} ${player.lastName} (${player.position[0]})\n`
    })
    
    return message
  }
  
  private formatTradeAnalysis(analysis: any): string {
    const emoji = analysis.recommendation === 'accept' ? '✅' :
                  analysis.recommendation === 'reject' ? '❌' : '🤔'
    
    let message = `${emoji} **Trade Analysis: ${analysis.recommendation.toUpperCase()}**\n\n`
    
    message += `**You Give:** ${analysis.givingPlayers.map((p: any) => 
      `${p.firstName} ${p.lastName}`).join(', ')}\n`
    message += `**You Get:** ${analysis.receivingPlayers.map((p: any) => 
      `${p.firstName} ${p.lastName}`).join(', ')}\n\n`
    
    message += `**Value Analysis:**\n`
    message += `• Giving up: ${analysis.givingValue.toFixed(1)} points of value\n`
    message += `• Receiving: ${analysis.receivingValue.toFixed(1)} points of value\n`
    message += `• Net gain/loss: ${(analysis.receivingValue - analysis.givingValue).toFixed(1)} points\n\n`
    
    message += `**Verdict:** ${analysis.fairness.replace('_', ' ').toUpperCase()}\n\n`
    
    message += `**Reasoning:**\n`
    analysis.reasoning.forEach((reason: string) => {
      message += `• ${reason}\n`
    })
    
    return message
  }
  
  private formatWaiverRecommendations(pickups: any[], drops: any[]): string {
    let message = `🎯 **Top Waiver Wire Targets**\n\n`
    
    pickups.slice(0, 5).forEach((player: any, index: number) => {
      message += `${index + 1}. **${player.firstName} ${player.lastName}** `
      message += `(${player.position[0]} - ${player.currentTeam?.abbreviation || 'FA'})\n`
    })
    
    if (drops.length > 0) {
      message += `\n**Consider Dropping:**\n`
      drops.slice(0, 3).forEach((player: any) => {
        message += `• ${player.firstName} ${player.lastName} (${player.position[0]})\n`
      })
    }
    
    return message
  }
  
  private formatDropCandidates(candidates: any[]): string {
    let message = `🗑️ **Drop Candidates** (ranked worst to best)\n\n`
    
    candidates.forEach((player: any, index: number) => {
      message += `${index + 1}. **${player.firstName} ${player.lastName}** `
      message += `(${player.position[0]} - ${player.currentTeam?.abbreviation || 'FA'})\n`
    })
    
    message += `\n💡 Consider recent performance, upcoming schedule, and team needs before dropping.`
    
    return message
  }
  
  private formatDraftAdvice(players: any[], round: number, pick: number): string {
    let message = `📋 **Draft Advice** (Round ${round}, Pick ${pick})\n\n`
    message += `**Top Available Players:**\n\n`
    
    players.slice(0, 5).forEach((player: any, index: number) => {
      message += `${index + 1}. **${player.firstName} ${player.lastName}** `
      message += `(${player.position[0]} - ${player.currentTeam?.abbreviation || 'FA'})\n`
    })
    
    message += `\n**Strategy Tips:**\n`
    if (round <= 3) {
      message += `• Focus on elite RBs and WRs\n`
      message += `• Don't reach for QBs unless it's elite tier\n`
    } else if (round <= 6) {
      message += `• Target high-upside players\n`
      message += `• Consider positional runs (TE/QB)\n`
    } else {
      message += `• Look for sleepers and handcuffs\n`
      message += `• Don't forget DST and K in later rounds\n`
    }
    
    return message
  }
  
  // Suggestion generators
  
  private generateLineupSuggestions(recommendation: any): string[] {
    const suggestions = []
    
    // Check for injured players
    const injuredStarters = recommendation.starters.filter((p: any) => p.injuries?.length > 0)
    if (injuredStarters.length > 0) {
      suggestions.push("Monitor injury reports before game time")
    }
    
    // Check for Thursday/Monday players
    suggestions.push("Consider game times when setting your lineup")
    
    // Weather considerations
    suggestions.push("Check weather conditions for outdoor games")
    
    return suggestions
  }
  
  private generateTradeSuggestions(analysis: any): string[] {
    const suggestions = []
    
    if (analysis.fairness === 'slightly_unfair' && analysis.recommendation === 'negotiate') {
      suggestions.push("Try negotiating for an additional bench player or future pick")
    }
    
    if (analysis.recommendation === 'accept') {
      suggestions.push("This trade improves your team - accept before they change their mind!")
    }
    
    suggestions.push("Consider your team's positional needs beyond just point values")
    suggestions.push("Check upcoming schedules for all players involved")
    
    return suggestions
  }
  
  private generateWaiverSuggestions(players: any[]): string[] {
    return [
      "Submit multiple waiver claims in priority order",
      "Consider FAAB budget if your league uses it",
      "Check for players with increased opportunity due to injuries",
      "Don't forget to set your lineup after waiver claims process"
    ]
  }
}