import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent'
import { PlayerService, ScoringSystem } from '../../services/PlayerService'
import { QueryParser, QueryIntent } from '../../services/QueryParser'
import { AnalysisService } from '../../services/AnalysisService'
import { mlEngine } from '../../../ml/MLPredictionEngine'
import { supabase } from '../../../supabase/client-browser'
import { createAgentLogger } from '../../../utils/logger'

/**
 * GamePredictionAgent - Consolidated agent for game and contest predictions
 * 
 * Handles:
 * - Matchup analysis
 * - DFS optimization
 * - Playoff predictions
 * - Game outcome predictions
 * - Contest optimization
 */
export class GamePredictionAgent extends BaseAgent {
  private playerService: PlayerService
  private queryParser: QueryParser
  private logger = createAgentLogger('GamePredictionAgent')
  private analysisService: AnalysisService
  
  constructor() {
    super(
      'Game Prediction Expert',
      'Comprehensive game predictions including matchups, DFS, playoffs, and contests',
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
      QueryIntent.MATCHUP_ANALYSIS,
      QueryIntent.DFS_OPTIMIZATION,
      QueryIntent.PLAYOFF_PREDICTION,
      QueryIntent.GAME_PREDICTION
    ].includes(intent)
  }
  
  /**
   * Process the query
   */
  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    const { intent, entities } = this.queryParser.parseQuery(query)
    
    try {
      switch (intent) {
        case QueryIntent.MATCHUP_ANALYSIS:
          return await this.handleMatchupAnalysis(entities, context)
          
        case QueryIntent.DFS_OPTIMIZATION:
          return await this.handleDFSOptimization(entities, context, query)
          
        case QueryIntent.PLAYOFF_PREDICTION:
          return await this.handlePlayoffPrediction(entities, context)
          
        case QueryIntent.GAME_PREDICTION:
          return await this.handleGamePrediction(entities, context)
          
        default:
          return {
            success: false,
            message: "I couldn't understand what game prediction you're looking for.",
            suggestions: [
              "Ask about matchups: 'How will Davante Adams do against the Chiefs?'",
              "Get DFS lineups: 'Build me a DraftKings lineup for $50k'",
              "Playoff predictions: 'What are the Cowboys playoff chances?'",
              "Game predictions: 'Who will win Rams vs 49ers?'"
            ]
          }
      }
    } catch (error) {
      this.logger.error('Game prediction error', error)
      return {
        success: false,
        message: "I encountered an error analyzing game data. Please try again.",
      }
    }
  }
  
  /**
   * Handle matchup analysis queries
   */
  private async handleMatchupAnalysis(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (entities.players.length === 0) {
      return {
        success: false,
        message: "Please specify which player's matchup you'd like to analyze.",
      }
    }
    
    // Find player
    const players = await this.playerService.findPlayerByName(entities.players[0])
    if (players.length === 0) {
      return {
        success: false,
        message: `I couldn't find a player named "${entities.players[0]}".`,
      }
    }
    
    const player = players[0]
    const playerData = await this.playerService.getPlayerWithStats(player.id)
    
    if (!playerData || !playerData.currentTeamId) {
      return {
        success: false,
        message: `Unable to find team information for ${player.firstName} ${player.lastName}.`,
      }
    }
    
    // Get next game
    const { data: nextGame } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*)
      `)
      .or(`home_team_id.eq.${playerData.currentTeamId},away_team_id.eq.${playerData.currentTeamId}`)
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
      .limit(1)
      .single()
    
    if (!nextGame) {
      return {
        success: false,
        message: `No upcoming games found for ${player.firstName} ${player.lastName}.`,
      }
    }
    
    // Analyze matchup
    const matchupAnalysis = await this.analyzePlayerMatchup(playerData, nextGame)
    const message = this.formatMatchupAnalysis(playerData, nextGame, matchupAnalysis)
    
    return {
      success: true,
      message,
      data: { player: playerData, game: nextGame, analysis: matchupAnalysis },
      confidence: 0.8
    }
  }
  
  /**
   * Handle DFS optimization queries
   */
  private async handleDFSOptimization(entities: any, context: AgentContext, query?: string): Promise<AgentResponse> {
    const budget = this.extractBudget(query || '') || 50000 // Default $50k
    const platform = this.extractDFSPlatform(query || '') || 'draftkings'
    
    // Get player pool with salaries
    const playerPool = await this.getDFSPlayerPool(platform, entities.positions)
    
    if (playerPool.length < 20) {
      return {
        success: false,
        message: "Not enough players available for DFS optimization.",
      }
    }
    
    // Optimize lineup
    const optimizedLineup = await this.optimizeDFSLineup(playerPool, budget, platform)
    
    if (!optimizedLineup.valid) {
      return {
        success: false,
        message: "Unable to create a valid lineup within the salary cap.",
      }
    }
    
    const message = this.formatDFSLineup(optimizedLineup, budget, platform)
    
    return {
      success: true,
      message,
      data: optimizedLineup,
      suggestions: [
        "Consider late swap opportunities",
        "Monitor injury reports before lock",
        "Stack QB with pass catchers for tournaments",
        "Fade chalky plays in GPPs"
      ],
      confidence: 0.75
    }
  }
  
  /**
   * Handle playoff prediction queries
   */
  private async handlePlayoffPrediction(entities: any, context: AgentContext): Promise<AgentResponse> {
    // Get team standings
    const { data: standings } = await supabase
      .from('team_standings')
      .select(`
        *,
        team:teams(*)
      `)
      .eq('season', new Date().getFullYear())
      .order('wins', { ascending: false })
    
    if (!standings || standings.length === 0) {
      return {
        success: false,
        message: "No standings data available for playoff predictions.",
      }
    }
    
    // Filter by specified team if any
    let teamStandings = standings
    if (entities.teams.length > 0) {
      teamStandings = standings.filter(s => 
        s.team.abbreviation.toLowerCase() === entities.teams[0].toLowerCase()
      )
    }
    
    // Calculate playoff odds
    const playoffOdds = this.calculatePlayoffOdds(standings, teamStandings)
    const message = this.formatPlayoffPrediction(playoffOdds, entities.teams[0])
    
    return {
      success: true,
      message,
      data: { standings, playoffOdds },
      confidence: 0.7
    }
  }
  
  /**
   * Handle game prediction queries
   */
  private async handleGamePrediction(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (entities.teams.length < 2) {
      // Get upcoming games
      const { data: games } = await supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*)
        `)
        .gte('game_date', new Date().toISOString())
        .lte('game_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('game_date', { ascending: true })
        .limit(5)
      
      if (!games || games.length === 0) {
        return {
          success: false,
          message: "No upcoming games found for predictions.",
        }
      }
      
      const predictions = await this.predictMultipleGames(games)
      const message = this.formatGamePredictions(predictions)
      
      return {
        success: true,
        message,
        data: { predictions },
        confidence: 0.65
      }
    }
    
    // Specific game prediction
    const { data: game } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*)
      `)
      .or(`
        and(home_team.abbreviation.eq.${entities.teams[0]},away_team.abbreviation.eq.${entities.teams[1]}),
        and(home_team.abbreviation.eq.${entities.teams[1]},away_team.abbreviation.eq.${entities.teams[0]})
      `)
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
      .limit(1)
      .single()
    
    if (!game) {
      return {
        success: false,
        message: `No upcoming game found between ${entities.teams[0]} and ${entities.teams[1]}.`,
      }
    }
    
    const prediction = await this.predictSingleGame(game)
    const message = this.formatSingleGamePrediction(game, prediction)
    
    return {
      success: true,
      message,
      data: { game, prediction },
      confidence: prediction.confidence
    }
  }
  
  // Helper methods
  
  private async analyzePlayerMatchup(player: any, game: any): Promise<any> {
    const isHome = game.home_team_id === player.currentTeamId
    const opponent = isHome ? game.away_team : game.home_team
    
    // Get opponent defensive stats
    const { data: defenseStats } = await supabase
      .from('team_defense_stats')
      .select('*')
      .eq('team_id', opponent.id)
      .eq('season', new Date().getFullYear())
      .single()
    
    // Get historical performance vs opponent
    const { data: historicalStats } = await supabase
      .from('player_game_logs')
      .select('*')
      .eq('player_id', player.id)
      .eq('opponent_id', opponent.id)
      .order('game_date', { ascending: false })
      .limit(5)
    
    // ML projection for this matchup
    const projection = await this.analysisService.projectFuturePerformance(player.id)
    
    return {
      opponent,
      isHome,
      defenseRank: defenseStats?.rank_vs_position?.[player.position[0]] || 16,
      historicalAverage: this.calculateHistoricalAverage(historicalStats || []),
      projection: projection.projectedPoints,
      factors: [
        {
          factor: 'Defense Rank',
          impact: defenseStats?.rank_vs_position?.[player.position[0]] > 20 ? 'positive' : 'negative',
          value: defenseStats?.rank_vs_position?.[player.position[0]] || 'Unknown'
        },
        {
          factor: 'Home/Away',
          impact: isHome ? 'positive' : 'neutral',
          value: isHome ? 'Home' : 'Away'
        }
      ]
    }
  }
  
  private extractBudget(query: string): number | null {
    const match = query.match(/\$?(\d+)k?/i)
    if (match) {
      const value = parseInt(match[1])
      return query.includes('k') ? value * 1000 : value
    }
    return null
  }
  
  private extractDFSPlatform(query: string): string {
    if (query.toLowerCase().includes('fanduel')) return 'fanduel'
    if (query.toLowerCase().includes('yahoo')) return 'yahoo'
    return 'draftkings'
  }
  
  private async getDFSPlayerPool(platform: string, positions?: string[]): Promise<any[]> {
    const { data: players } = await supabase
      .from('dfs_salaries')
      .select(`
        *,
        player:players(*)
      `)
      .eq('platform', platform)
      .eq('slate_date', new Date().toISOString().split('T')[0])
      .order('salary', { ascending: false })
      .limit(200)
    
    if (!players) return []
    
    // Filter by positions if specified
    if (positions && positions.length > 0) {
      return players.filter(p => 
        positions.some(pos => p.player.position.includes(pos))
      )
    }
    
    return players
  }
  
  private async optimizeDFSLineup(playerPool: any[], budget: number, platform: string): Promise<any> {
    // Simple greedy optimization - in production use linear programming
    const lineup: any = {
      QB: null,
      RB: [],
      WR: [],
      TE: null,
      FLEX: null,
      DST: null,
      totalSalary: 0,
      projectedPoints: 0,
      valid: false
    }
    
    // Requirements based on platform
    const requirements = {
      draftkings: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, DST: 1 },
      fanduel: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, DST: 1 },
      yahoo: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, DST: 1 }
    }
    
    const reqs = requirements[platform as keyof typeof requirements]
    let remainingBudget = budget
    
    // Get projections for all players
    const playersWithProjections = await Promise.all(
      playerPool.map(async p => {
        const projection = await this.analysisService.projectFuturePerformance(p.player_id)
        return {
          ...p,
          projectedPoints: projection.projectedPoints,
          value: projection.projectedPoints / (p.salary / 1000) // Points per $1k
        }
      })
    )
    
    // Sort by value
    playersWithProjections.sort((a, b) => b.value - a.value)
    
    // Fill lineup greedily by value
    for (const player of playersWithProjections) {
      if (player.salary > remainingBudget) continue
      
      const position = player.position
      
      if (position === 'QB' && !lineup.QB) {
        lineup.QB = player
        remainingBudget -= player.salary
        lineup.projectedPoints += player.projectedPoints
      } else if (position === 'RB' && lineup.RB.length < reqs.RB) {
        lineup.RB.push(player)
        remainingBudget -= player.salary
        lineup.projectedPoints += player.projectedPoints
      } else if (position === 'WR' && lineup.WR.length < reqs.WR) {
        lineup.WR.push(player)
        remainingBudget -= player.salary
        lineup.projectedPoints += player.projectedPoints
      } else if (position === 'TE' && !lineup.TE) {
        lineup.TE = player
        remainingBudget -= player.salary
        lineup.projectedPoints += player.projectedPoints
      } else if (position === 'DST' && !lineup.DST) {
        lineup.DST = player
        remainingBudget -= player.salary
        lineup.projectedPoints += player.projectedPoints
      }
    }
    
    // Fill FLEX with best remaining RB/WR/TE
    const flexEligible = playersWithProjections.filter(p => 
      ['RB', 'WR', 'TE'].includes(p.position) &&
      !lineup.RB.includes(p) &&
      !lineup.WR.includes(p) &&
      p !== lineup.TE &&
      p.salary <= remainingBudget
    )
    
    if (flexEligible.length > 0) {
      lineup.FLEX = flexEligible[0]
      remainingBudget -= lineup.FLEX.salary
      lineup.projectedPoints += lineup.FLEX.projectedPoints
    }
    
    lineup.totalSalary = budget - remainingBudget
    lineup.valid = lineup.QB && lineup.RB.length === 2 && lineup.WR.length === 3 && 
                   lineup.TE && lineup.FLEX && lineup.DST
    
    return lineup
  }
  
  private calculatePlayoffOdds(allStandings: any[], teamStandings: any[]): any {
    // Simplified playoff odds calculation
    const playoffSpots = 7 // Per conference
    
    return teamStandings.map(team => {
      const conferenceStandings = allStandings.filter(s => 
        s.team.conference === team.team.conference
      )
      
      const currentPosition = conferenceStandings.findIndex(s => s.id === team.id) + 1
      const gamesRemaining = 17 - (team.wins + team.losses + team.ties)
      
      // Simple odds based on current position and games remaining
      let odds = 0
      if (currentPosition <= playoffSpots) {
        odds = 0.8 + (playoffSpots - currentPosition) * 0.05
      } else {
        odds = Math.max(0, 0.5 - (currentPosition - playoffSpots) * 0.1)
      }
      
      // Adjust for games remaining
      odds = odds * (1 + gamesRemaining * 0.02)
      
      return {
        team: team.team,
        currentRecord: `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ''}`,
        conferenceRank: currentPosition,
        playoffOdds: Math.min(1, Math.max(0, odds)),
        gamesRemaining
      }
    })
  }
  
  private async predictMultipleGames(games: any[]): Promise<any[]> {
    return Promise.all(games.map(game => this.predictSingleGame(game)))
  }
  
  private async predictSingleGame(game: any): Promise<any> {
    // Get team stats
    const [homeStats, awayStats] = await Promise.all([
      this.getTeamStats(game.home_team_id),
      this.getTeamStats(game.away_team_id)
    ])
    
    // Simple prediction based on stats
    const homePower = homeStats.avgPointsFor + (homeStats.avgPointsAgainst * -0.5)
    const awayPower = awayStats.avgPointsFor + (awayStats.avgPointsAgainst * -0.5)
    
    // Home field advantage
    const homeAdvantage = 3
    const adjustedHomePower = homePower + homeAdvantage
    
    const totalPower = adjustedHomePower + awayPower
    const homeWinProbability = adjustedHomePower / totalPower
    
    // Predict score
    const predictedTotal = (homeStats.avgPointsFor + awayStats.avgPointsFor) * 0.95
    const homeScore = Math.round(predictedTotal * homeWinProbability)
    const awayScore = Math.round(predictedTotal * (1 - homeWinProbability))
    
    return {
      winner: homeWinProbability > 0.5 ? game.home_team : game.away_team,
      confidence: Math.abs(homeWinProbability - 0.5) * 2,
      homeWinProbability,
      predictedScore: { home: homeScore, away: awayScore },
      spread: homeScore - awayScore,
      total: homeScore + awayScore
    }
  }
  
  private async getTeamStats(teamId: string): Promise<any> {
    const { data: stats } = await supabase
      .from('team_stats')
      .select('*')
      .eq('team_id', teamId)
      .eq('season', new Date().getFullYear())
      .single()
    
    return stats || {
      avgPointsFor: 21,
      avgPointsAgainst: 21,
      wins: 0,
      losses: 0
    }
  }
  
  private calculateHistoricalAverage(games: any[]): number {
    if (!games || games.length === 0) return 0
    const total = games.reduce((sum, game) => 
      sum + (game.fantasy_points_ppr || 0), 0
    )
    return total / games.length
  }
  
  // Formatting methods
  
  private formatMatchupAnalysis(player: any, game: any, analysis: any): string {
    const date = new Date(game.game_date).toLocaleDateString()
    
    let message = `🎯 **Matchup Analysis for ${player.firstName} ${player.lastName}**\n\n`
    message += `**Game:** ${game.away_team.name} @ ${game.home_team.name}\n`
    message += `**Date:** ${date}\n`
    message += `**Opponent:** ${analysis.opponent.name}\n\n`
    
    message += `**Matchup Factors:**\n`
    analysis.factors.forEach((factor: any) => {
      const icon = factor.impact === 'positive' ? '✅' : 
                   factor.impact === 'negative' ? '❌' : '➖'
      message += `${icon} ${factor.factor}: ${factor.value}\n`
    })
    
    message += `\n**Projection:** ${analysis.projection.toFixed(1)} PPR points\n`
    
    if (analysis.historicalAverage > 0) {
      message += `**Historical vs ${analysis.opponent.abbreviation}:** ${analysis.historicalAverage.toFixed(1)} PPG\n`
    }
    
    const defRank = analysis.defenseRank
    if (defRank <= 10) {
      message += `\n⚠️ Tough matchup - ${analysis.opponent.abbreviation} ranks ${defRank}th vs ${player.position[0]}`
    } else if (defRank >= 23) {
      message += `\n✅ Favorable matchup - ${analysis.opponent.abbreviation} ranks ${defRank}th vs ${player.position[0]}`
    }
    
    return message
  }
  
  private formatDFSLineup(lineup: any, budget: number, platform: string): string {
    let message = `💰 **${platform.toUpperCase()} Optimal Lineup**\n`
    message += `Budget: $${budget.toLocaleString()} | Used: $${lineup.totalSalary.toLocaleString()}\n`
    message += `Projected Points: ${lineup.projectedPoints.toFixed(1)}\n\n`
    
    message += `**Lineup:**\n`
    if (lineup.QB) {
      message += `QB: ${lineup.QB.player.firstName} ${lineup.QB.player.lastName} - $${lineup.QB.salary.toLocaleString()}\n`
    }
    lineup.RB.forEach((rb: any) => {
      message += `RB: ${rb.player.firstName} ${rb.player.lastName} - $${rb.salary.toLocaleString()}\n`
    })
    lineup.WR.forEach((wr: any) => {
      message += `WR: ${wr.player.firstName} ${wr.player.lastName} - $${wr.salary.toLocaleString()}\n`
    })
    if (lineup.TE) {
      message += `TE: ${lineup.TE.player.firstName} ${lineup.TE.player.lastName} - $${lineup.TE.salary.toLocaleString()}\n`
    }
    if (lineup.FLEX) {
      message += `FLEX: ${lineup.FLEX.player.firstName} ${lineup.FLEX.player.lastName} - $${lineup.FLEX.salary.toLocaleString()}\n`
    }
    if (lineup.DST) {
      message += `DST: ${lineup.DST.player.name} - $${lineup.DST.salary.toLocaleString()}\n`
    }
    
    message += `\n💡 Remaining: $${(budget - lineup.totalSalary).toLocaleString()}`
    
    return message
  }
  
  private formatPlayoffPrediction(playoffOdds: any[], team?: string): string {
    let message = `🏆 **Playoff Predictions**\n\n`
    
    if (team) {
      const teamOdds = playoffOdds[0]
      message += `**${teamOdds.team.name}**\n`
      message += `Current Record: ${teamOdds.currentRecord}\n`
      message += `Conference Rank: #${teamOdds.conferenceRank}\n`
      message += `Playoff Odds: ${(teamOdds.playoffOdds * 100).toFixed(1)}%\n`
      message += `Games Remaining: ${teamOdds.gamesRemaining}\n`
      
      if (teamOdds.playoffOdds > 0.8) {
        message += `\n✅ Strong playoff position`
      } else if (teamOdds.playoffOdds > 0.5) {
        message += `\n🟡 In the hunt`
      } else {
        message += `\n🔴 Playoff hopes fading`
      }
    } else {
      // Top 5 teams by odds
      playoffOdds
        .sort((a, b) => b.playoffOdds - a.playoffOdds)
        .slice(0, 5)
        .forEach((team, index) => {
          message += `${index + 1}. ${team.team.name} - ${(team.playoffOdds * 100).toFixed(1)}% (${team.currentRecord})\n`
        })
    }
    
    return message
  }
  
  private formatGamePredictions(predictions: any[]): string {
    let message = `🏈 **Game Predictions**\n\n`
    
    predictions.forEach(pred => {
      const game = pred.game
      const confidence = (pred.confidence * 100).toFixed(0)
      
      message += `**${game.away_team.name} @ ${game.home_team.name}**\n`
      message += `Winner: ${pred.winner.name} (${confidence}% confidence)\n`
      message += `Predicted Score: ${pred.predictedScore.away} - ${pred.predictedScore.home}\n`
      message += `Spread: ${pred.winner.id === game.home_team_id ? game.home_team.abbreviation : game.away_team.abbreviation} ${Math.abs(pred.spread).toFixed(1)}\n`
      message += `O/U: ${pred.total}\n\n`
    })
    
    return message
  }
  
  private formatSingleGamePrediction(game: any, prediction: any): string {
    const date = new Date(game.game_date).toLocaleDateString()
    const confidence = (prediction.confidence * 100).toFixed(0)
    
    let message = `🏈 **Game Prediction**\n\n`
    message += `**${game.away_team.name} @ ${game.home_team.name}**\n`
    message += `Date: ${date}\n\n`
    
    message += `**Prediction:**\n`
    message += `Winner: **${prediction.winner.name}** (${confidence}% confidence)\n`
    message += `Score: ${game.away_team.abbreviation} ${prediction.predictedScore.away} - ${prediction.predictedScore.home} ${game.home_team.abbreviation}\n`
    message += `Spread: ${prediction.winner.abbreviation} -${Math.abs(prediction.spread).toFixed(1)}\n`
    message += `Total: ${prediction.total} points\n\n`
    
    if (prediction.confidence > 0.7) {
      message += `💪 High confidence pick!`
    } else if (prediction.confidence < 0.3) {
      message += `🎲 This one's a toss-up`
    }
    
    return message
  }
}