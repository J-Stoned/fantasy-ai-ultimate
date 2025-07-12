/**
 * 🤝 VOICE-SYNERGY BRIDGE SERVICE
 * Connects voice commands to player synergy data (10,675 synergies from 6,743 games)
 * Enables natural language queries for player correlation insights
 */

import { enhancedDb } from '../../../../lib/services/enhanced-database-service'
import { VoicePatternBridge } from './voice-pattern-bridge'
import chalk from 'chalk'

export interface PlayerSynergy {
  id: string
  player1_id: number
  player2_id: number
  player1_name?: string
  player2_name?: string
  synergy_type: string
  synergy_score: number
  games_together: number
  total_fantasy_points: number
  sample_size: number
  season: number
  created_at: string
  updated_at: string
  avg_fantasy_points?: number // calculated field
}

export interface SynergyQuery {
  player1?: string
  player2?: string
  team?: string
  position?: string
  sport?: string
  minGames?: number
  sortBy?: 'synergy_score' | 'correlation' | 'fantasy_points' | 'games'
  limit?: number
}

export interface SynergyResult {
  synergies: PlayerSynergy[]
  summary: string
  insights: string[]
  recommendations: string[]
  voiceNarrative: string
}

export class VoiceSynergyBridge {
  private patternBridge: VoicePatternBridge

  constructor() {
    this.patternBridge = new VoicePatternBridge()
    console.log(chalk.cyan('🤝 Voice-Synergy Bridge initialized'))
  }

  /**
   * Process natural language synergy queries
   */
  async processSynergyQuery(query: string): Promise<SynergyResult> {
    console.log(chalk.blue(`🔍 Processing synergy query: "${query}"`))
    
    const parsedQuery = this.parseQuery(query)
    
    try {
      // Query our player_synergies table
      const synergies = await this.queryPlayerSynergies(parsedQuery)
      
      // Format for voice response
      return this.formatSynergyResult(synergies, query, parsedQuery)
      
    } catch (error) {
      console.error(chalk.red('❌ Synergy query error:'), error)
      return this.getErrorResponse(query)
    }
  }

  /**
   * Get specific player pair synergy using our standardized schema
   */
  async getPlayerPairSynergy(player1: string, player2: string): Promise<SynergyResult> {
    console.log(chalk.blue(`👥 Getting synergy for: ${player1} + ${player2}`))
    
    try {
      // First, find the player IDs using exact match (since ilike doesn't work in our enhancedDb)
      const player1Data = await enhancedDb.batchQuery(
        'players',
        'id, name, sport',
        { name: player1 },
        { limit: 1 }
      )
      
      const player2Data = await enhancedDb.batchQuery(
        'players',
        'id, name, sport',
        { name: player2 },
        { limit: 1 }
      )
      
      // If exact match fails, try to find partial matches by searching all players
      if (player1Data.length === 0 || player2Data.length === 0) {
        console.log(chalk.yellow('Exact match failed, searching all players...'))
        const allPlayers = await enhancedDb.batchQuery('players', 'id, name, sport', {}, { limit: 1000 })
        
        const findPlayer = (searchName: string) => {
          return allPlayers.find(p => 
            p.name.toLowerCase().includes(searchName.toLowerCase()) ||
            searchName.toLowerCase().includes(p.name.toLowerCase())
          )
        }
        
        const foundPlayer1 = player1Data.length > 0 ? player1Data[0] : findPlayer(player1)
        const foundPlayer2 = player2Data.length > 0 ? player2Data[0] : findPlayer(player2)
        
        if (!foundPlayer1 || !foundPlayer2) {
          return {
            synergies: [],
            summary: `I couldn't find one or both players: ${player1}, ${player2}.`,
            insights: ['Try using exact names like they appear in our database'],
            recommendations: ['Available players include: LeBron James, Stephen Curry, Jayson Tatum'],
            voiceNarrative: `I couldn't find ${!foundPlayer1 ? player1 : player2} in our player database. Try using their exact full name as it appears in our records.`
          }
        }
        
        // Update the data arrays
        if (!player1Data.length) player1Data.push(foundPlayer1)
        if (!player2Data.length) player2Data.push(foundPlayer2)
      }

      if (player1Data.length === 0 || player2Data.length === 0) {
        return {
          synergies: [],
          summary: `I couldn't find one or both players: ${player1}, ${player2}.`,
          insights: ['Player names may need to be more specific'],
          recommendations: ['Try using full names like "Joel Embiid" or "Tyrese Maxey"'],
          voiceNarrative: `I couldn't find ${player1} or ${player2} in our player database. Try using their full names.`
        }
      }

      const p1Id = player1Data[0].id
      const p2Id = player2Data[0].id

      // Search for synergies between these players (try both permutations separately)
      console.log(chalk.gray(`Searching for synergies between IDs: ${p1Id} and ${p2Id}`))
      
      // Try first permutation
      const synergies1 = await enhancedDb.batchQuery(
        'player_synergies',
        '*',
        { player1_id: p1Id, player2_id: p2Id },
        { limit: 5, orderBy: 'synergy_score', orderDirection: 'desc' }
      )
      
      // Try second permutation
      const synergies2 = await enhancedDb.batchQuery(
        'player_synergies',
        '*',
        { player1_id: p2Id, player2_id: p1Id },
        { limit: 5, orderBy: 'synergy_score', orderDirection: 'desc' }
      )
      
      // Combine results
      const synergies = [...synergies1, ...synergies2]

      // Add player names to the synergy data
      const enrichedSynergies = synergies.map(s => ({
        ...s,
        player1_name: s.player1_id === p1Id ? player1Data[0].name : player2Data[0].name,
        player2_name: s.player2_id === p2Id ? player2Data[0].name : player1Data[0].name,
        avg_fantasy_points: s.total_fantasy_points / s.games_together
      }))

      return this.formatSynergyResult(enrichedSynergies, `${player1} and ${player2}`, {
        player1,
        player2,
        sortBy: 'synergy_score'
      })

    } catch (error) {
      console.error(chalk.red('❌ Player pair synergy error:'), error)
      return {
        synergies: [],
        summary: `I had trouble looking up synergy data for ${player1} and ${player2}.`,
        insights: ['Database connection issue or data not available'],
        recommendations: ['Try again in a moment'],
        voiceNarrative: `I'm having trouble accessing synergy data for ${player1} and ${player2} right now.`
      }
    }
  }

  /**
   * Get top synergies for a team
   */
  async getTeamSynergies(team: string, sport: string = 'NBA'): Promise<SynergyResult> {
    console.log(chalk.blue(`🏀 Getting team synergies for: ${team}`))
    
    try {
      // Query synergies with team context or player names containing team info
      const synergies = await enhancedDb.batchQuery(
        'player_synergies',
        '*',
        {
          and: [
            { sport: { eq: sport } },
            { team_context: { ilike: `%${team}%` } }
          ]
        },
        { limit: 20, orderBy: 'synergy_score', orderDirection: 'desc' }
      )

      return this.formatSynergyResult(synergies, `${team} team synergies`, {
        team,
        sport,
        sortBy: 'synergy_score',
        limit: 20
      })

    } catch (error) {
      return this.getErrorResponse(`${team} synergies`)
    }
  }

  /**
   * Get top overall synergies using standardized schema
   */
  async getTopSynergies(sport: string = 'nba', limit: number = 10): Promise<SynergyResult> {
    console.log(chalk.blue(`🏆 Getting top ${limit} synergies for ${sport}`))
    
    try {
      // Get top synergies with at least 5 games together
      const synergies = await enhancedDb.batchQuery(
        'player_synergies',
        '*',
        { games_together: { gte: 5 } },
        { 
          limit, 
          orderBy: 'synergy_score', 
          orderDirection: 'desc'
        }
      )

      // Get player names for each synergy
      const enrichedSynergies = await Promise.all(
        synergies.map(async (s) => {
          const player1 = await enhancedDb.batchQuery(
            'players',
            'name, sport',
            { id: s.player1_id },
            { limit: 1 }
          )
          const player2 = await enhancedDb.batchQuery(
            'players',
            'name, sport',
            { id: s.player2_id },
            { limit: 1 }
          )

          return {
            ...s,
            player1_name: player1.length > 0 ? player1[0].name : `Player ${s.player1_id}`,
            player2_name: player2.length > 0 ? player2[0].name : `Player ${s.player2_id}`,
            avg_fantasy_points: s.total_fantasy_points / s.games_together,
            sport: player1.length > 0 ? player1[0].sport : 'unknown'
          }
        })
      )

      // Filter by sport if specified and not 'all'
      const filteredSynergies = sport.toLowerCase() === 'all' 
        ? enrichedSynergies 
        : enrichedSynergies.filter(s => s.sport?.toLowerCase() === sport.toLowerCase())

      return this.formatSynergyResult(filteredSynergies, `top ${sport} synergies`, {
        sport,
        sortBy: 'synergy_score',
        limit,
        minGames: 5
      })

    } catch (error) {
      console.error(chalk.red('❌ Top synergies error:'), error)
      return this.getErrorResponse(`top ${sport} synergies`)
    }
  }

  /**
   * Get contrarian (low ownership) synergies
   */
  async getContrarianSynergies(sport: string = 'NBA'): Promise<SynergyResult> {
    console.log(chalk.blue(`💎 Finding contrarian synergies for ${sport}`))
    
    try {
      // Look for high synergy score but lower average fantasy points (contrarian value)
      const synergies = await enhancedDb.batchQuery(
        'player_synergies',
        '*',
        {
          and: [
            { sport: { eq: sport } },
            { synergy_score: { gte: 0.6 } },
            { avg_combined_fantasy_points: { lte: 45 } }, // Lower combined points = less popular
            { games_together: { gte: 3 } }
          ]
        },
        { limit: 15, orderBy: 'correlation_strength', orderDirection: 'desc' }
      )

      return this.formatSynergyResult(synergies, `contrarian ${sport} synergies`, {
        sport,
        sortBy: 'correlation',
        limit: 15
      })

    } catch (error) {
      return this.getErrorResponse(`contrarian ${sport} synergies`)
    }
  }

  /**
   * Parse natural language query into structured format
   */
  private parseQuery(query: string): SynergyQuery {
    const lowerQuery = query.toLowerCase()
    const parsed: SynergyQuery = {
      sortBy: 'synergy_score',
      limit: 10
    }

    // Extract player names (look for capitalized words)
    const playerMatches = query.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g)
    if (playerMatches && playerMatches.length >= 1) {
      parsed.player1 = playerMatches[0]
      if (playerMatches.length >= 2) {
        parsed.player2 = playerMatches[1]
      }
    }

    // Extract team names
    const teamNames = ['lakers', 'celtics', 'warriors', 'nuggets', 'bucks', 'heat', 'sixers', 'nets']
    const foundTeam = teamNames.find(team => lowerQuery.includes(team))
    if (foundTeam) {
      parsed.team = foundTeam
    }

    // Extract sport
    if (lowerQuery.includes('nba') || lowerQuery.includes('basketball')) {
      parsed.sport = 'NBA'
    } else if (lowerQuery.includes('nfl') || lowerQuery.includes('football')) {
      parsed.sport = 'NFL'
    }

    // Extract sorting preference
    if (lowerQuery.includes('correlation')) {
      parsed.sortBy = 'correlation'
    } else if (lowerQuery.includes('points') || lowerQuery.includes('fantasy')) {
      parsed.sortBy = 'fantasy_points'
    } else if (lowerQuery.includes('games')) {
      parsed.sortBy = 'games'
    }

    // Extract limits
    const numberMatch = lowerQuery.match(/top (\d+)|(\d+) best|show (\d+)/)
    if (numberMatch) {
      const num = parseInt(numberMatch[1] || numberMatch[2] || numberMatch[3])
      if (num > 0 && num <= 50) {
        parsed.limit = num
      }
    }

    return parsed
  }

  /**
   * Query player synergies from database
   */
  private async queryPlayerSynergies(query: SynergyQuery): Promise<PlayerSynergy[]> {
    const filters: any = {}
    
    // Build filters
    if (query.sport) {
      filters.sport = { eq: query.sport }
    }
    
    if (query.minGames) {
      filters.games_together = { gte: query.minGames }
    }

    if (query.player1 && query.player2) {
      // Specific player pair query
      filters.or = [
        {
          and: [
            { player1_name: { ilike: `%${query.player1}%` } },
            { player2_name: { ilike: `%${query.player2}%` } }
          ]
        },
        {
          and: [
            { player1_name: { ilike: `%${query.player2}%` } },
            { player2_name: { ilike: `%${query.player1}%` } }
          ]
        }
      ]
    } else if (query.player1) {
      // Single player query
      filters.or = [
        { player1_name: { ilike: `%${query.player1}%` } },
        { player2_name: { ilike: `%${query.player1}%` } }
      ]
    }

    if (query.team) {
      filters.team_context = { ilike: `%${query.team}%` }
    }

    // Determine sort column
    let orderBy = 'synergy_score'
    switch (query.sortBy) {
      case 'correlation':
        orderBy = 'correlation_strength'
        break
      case 'fantasy_points':
        orderBy = 'avg_combined_fantasy_points'
        break
      case 'games':
        orderBy = 'games_together'
        break
    }

    return await enhancedDb.batchQuery(
      'player_synergies',
      '*',
      filters,
      {
        limit: query.limit || 10,
        orderBy,
        orderDirection: 'desc'
      }
    )
  }

  /**
   * Format synergy results for voice response
   */
  private formatSynergyResult(
    synergies: PlayerSynergy[], 
    originalQuery: string, 
    parsedQuery: SynergyQuery
  ): SynergyResult {
    if (synergies.length === 0) {
      return {
        synergies: [],
        summary: `No synergy data found for ${originalQuery}.`,
        insights: ['Try searching for current teammates or recent player combinations'],
        recommendations: ['Check team rosters for active player pairs'],
        voiceNarrative: `I couldn't find synergy data for ${originalQuery}. Try asking about current teammates or popular player stacks.`
      }
    }

    const topSynergy = synergies[0]
    const avgSynergyScore = synergies.reduce((sum, s) => sum + s.synergy_score, 0) / synergies.length
    const avgFantasyPoints = synergies.reduce((sum, s) => sum + s.avg_combined_fantasy_points, 0) / synergies.length

    // Generate insights
    const insights = this.generateSynergyInsights(synergies, parsedQuery)
    const recommendations = this.generateSynergyRecommendations(synergies, parsedQuery)
    const summary = this.generateSynergySummary(synergies, originalQuery, topSynergy)
    const voiceNarrative = this.generateVoiceNarrative(synergies, topSynergy, originalQuery)

    return {
      synergies,
      summary,
      insights,
      recommendations,
      voiceNarrative
    }
  }

  /**
   * Generate synergy insights using our standardized schema
   */
  private generateSynergyInsights(synergies: PlayerSynergy[], query: SynergyQuery): string[] {
    const insights: string[] = []
    
    if (synergies.length > 0) {
      const topSynergy = synergies[0]
      insights.push(`${topSynergy.player1_name} and ${topSynergy.player2_name} have played ${topSynergy.games_together} games together`)
      
      const avgPoints = topSynergy.avg_fantasy_points || (topSynergy.total_fantasy_points / topSynergy.games_together)
      insights.push(`Their average combined fantasy points is ${avgPoints.toFixed(1)}`)
      
      if (topSynergy.synergy_score > 50) {
        insights.push(`Strong synergy score of ${topSynergy.synergy_score.toFixed(1)} indicates excellent chemistry`)
      } else if (topSynergy.synergy_score > 40) {
        insights.push(`Solid synergy score of ${topSynergy.synergy_score.toFixed(1)} shows good correlation`)
      }

      // Synergy type insight
      if (topSynergy.synergy_type) {
        insights.push(`This is an ${topSynergy.synergy_type} synergy combination`)
      }

      // Sample size insight
      if (topSynergy.sample_size < 10) {
        insights.push('Limited sample size - use with caution in high-stakes decisions')
      }
    }

    return insights
  }

  /**
   * Generate synergy recommendations using standardized schema
   */
  private generateSynergyRecommendations(synergies: PlayerSynergy[], query: SynergyQuery): string[] {
    const recommendations: string[] = []
    
    if (synergies.length > 0) {
      const topSynergy = synergies[0]
      
      if (topSynergy.synergy_score > 50) {
        recommendations.push('Strong stack recommendation for tournament play')
      } else if (topSynergy.synergy_score > 40) {
        recommendations.push('Solid correlation play worth considering')
      }

      const avgPoints = topSynergy.avg_fantasy_points || (topSynergy.total_fantasy_points / topSynergy.games_together)
      if (avgPoints > 50) {
        recommendations.push('High-scoring potential but may have elevated ownership')
      } else if (avgPoints < 40) {
        recommendations.push('Potential contrarian value with lower combined projections')
      }

      if (topSynergy.games_together < 5) {
        recommendations.push('Limited sample size - use with caution')
      } else if (topSynergy.games_together > 20) {
        recommendations.push('Large sample size provides confidence in the correlation')
      }

      if (topSynergy.synergy_type === 'offensive') {
        recommendations.push('Focus on game scripts that favor offensive output')
      }
    }

    return recommendations
  }

  /**
   * Generate summary text
   */
  private generateSynergySummary(synergies: PlayerSynergy[], query: string, topSynergy: PlayerSynergy): string {
    if (synergies.length === 1) {
      return `Found synergy data for ${topSynergy.player1_name} and ${topSynergy.player2_name} with ${topSynergy.synergy_score.toFixed(2)} synergy score.`
    }
    
    return `Found ${synergies.length} synergy combinations for ${query}. Top combination shows ${topSynergy.synergy_score.toFixed(2)} synergy score.`
  }

  /**
   * Generate voice narrative
   */
  private generateVoiceNarrative(synergies: PlayerSynergy[], topSynergy: PlayerSynergy, query: string): string {
    if (synergies.length === 0) {
      return `I don't have synergy data for ${query} yet. Try asking about current teammates or popular stacks.`
    }

    let narrative = `For ${query}, I found ${synergies.length} synergy combination${synergies.length > 1 ? 's' : ''}. `
    
    if (topSynergy.synergy_score > 50) {
      narrative += `The top pairing of ${topSynergy.player1_name} and ${topSynergy.player2_name} shows excellent synergy with a ${topSynergy.synergy_score.toFixed(1)} score. `
    } else if (topSynergy.synergy_score > 40) {
      narrative += `${topSynergy.player1_name} and ${topSynergy.player2_name} have solid correlation with a ${topSynergy.synergy_score.toFixed(1)} synergy score. `
    } else {
      narrative += `${topSynergy.player1_name} and ${topSynergy.player2_name} have a ${topSynergy.synergy_score.toFixed(1)} synergy score. `
    }

    const avgPoints = topSynergy.avg_fantasy_points || (topSynergy.total_fantasy_points / topSynergy.games_together)
    narrative += `They average ${avgPoints.toFixed(1)} combined fantasy points over ${topSynergy.games_together} games together. `

    if (topSynergy.synergy_type === 'offensive') {
      narrative += `This is an offensive synergy, meaning they tend to boost each other's scoring when they play together.`
    }

    if (topSynergy.games_together > 20) {
      narrative += ` With ${topSynergy.games_together} games of data, this is a reliable correlation.`
    } else if (topSynergy.games_together < 10) {
      narrative += ` Note that this is based on only ${topSynergy.games_together} games, so use caution with smaller sample sizes.`
    }

    return narrative
  }

  /**
   * Get error response
   */
  private getErrorResponse(query: string): SynergyResult {
    return {
      synergies: [],
      summary: `I'm having trouble accessing synergy data for ${query} right now.`,
      insights: ['Synergy database temporarily unavailable'],
      recommendations: ['Try again in a moment', 'Use traditional correlation analysis'],
      voiceNarrative: `I'm having trouble accessing the synergy database right now. Let me try a different approach to analyze ${query}.`
    }
  }

  /**
   * Get voice response for synergy query
   */
  async getVoiceSynergyResponse(query: string): Promise<string> {
    const result = await this.processSynergyQuery(query)
    return result.voiceNarrative
  }
}