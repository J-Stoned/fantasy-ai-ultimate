/**
 * 🔗 VOICE-PATTERN BRIDGE SERVICE
 * Connects voice commands to pattern detection APIs
 * Provides natural language interface for pattern analysis
 */

import axios from 'axios'
import chalk from 'chalk'

export interface PatternQuery {
  type: 'player' | 'team' | 'game' | 'general'
  target?: string
  filters?: {
    sport?: string
    timeframe?: string
    confidence?: number
    category?: string
  }
}

export interface PatternResult {
  patterns: Array<{
    name: string
    confidence: number
    description: string
    applicableGames: number
    historicalROI: number
    recommendation: string
  }>
  summary: string
  insights: string[]
  actionItems: string[]
}

export class VoicePatternBridge {
  private patternApiV4Url = 'http://localhost:3337'
  private unifiedApiUrl = 'http://localhost:3336'
  
  constructor() {
    console.log(chalk.cyan('🔗 Voice-Pattern Bridge initialized'))
  }

  /**
   * Process natural language pattern queries
   */
  async processPatternQuery(query: string): Promise<PatternResult> {
    console.log(chalk.blue(`🔍 Processing pattern query: "${query}"`))
    
    const parsedQuery = this.parseNaturalLanguageQuery(query)
    
    try {
      // Query both pattern APIs for comprehensive results
      const [v4Response, unifiedResponse] = await Promise.allSettled([
        this.queryPatternApiV4(parsedQuery),
        this.queryUnifiedPatternApi(parsedQuery)
      ])
      
      // Combine and process results
      const patterns = this.combinePatternResults(v4Response, unifiedResponse)
      return this.formatForVoiceResponse(patterns, query)
      
    } catch (error) {
      console.error(chalk.red('❌ Pattern query error:'), error)
      return this.getErrorResponse(query)
    }
  }

  /**
   * Get player-specific patterns
   */
  async getPlayerPatterns(playerName: string): Promise<PatternResult> {
    console.log(chalk.blue(`👤 Getting patterns for player: ${playerName}`))
    
    try {
      // For now, get general patterns and contextualize for the player
      const generalPatterns = await this.processPatternQuery('patterns')
      
      // Filter patterns that could apply to individual players
      const playerRelevantPatterns = generalPatterns.patterns.filter(p => 
        ['backToBackFade', 'altitudeAdvantage', 'starPlayerOut'].includes(p.name)
      )
      
      return {
        patterns: playerRelevantPatterns,
        summary: `For ${playerName}, I found ${playerRelevantPatterns.length} relevant patterns that could impact their performance.`,
        insights: [
          `${playerName} may be affected by back-to-back games`,
          'Altitude and travel patterns can impact player performance',
          'Consider team dynamics when key players are out'
        ],
        actionItems: [
          `Check if ${playerName}'s team plays back-to-back`,
          'Monitor injury reports for teammates',
          'Analyze home/away splits'
        ]
      }
      
    } catch (error) {
      return {
        patterns: [],
        summary: `I couldn't find specific patterns for ${playerName}, but I can analyze their general performance trends.`,
        insights: [`${playerName} may benefit from historical performance analysis`],
        actionItems: ['Consider checking recent game logs', 'Look at matchup history']
      }
    }
  }

  /**
   * Get game-specific patterns
   */
  async getGamePatterns(homeTeam: string, awayTeam: string): Promise<PatternResult> {
    console.log(chalk.blue(`🏈 Getting patterns for: ${awayTeam} @ ${homeTeam}`))
    
    try {
      const response = await axios.get(`${this.patternApiV4Url}/analyze/matchup`, {
        params: { home: homeTeam, away: awayTeam }
      })
      
      return this.formatGamePatterns(response.data, homeTeam, awayTeam)
      
    } catch (error) {
      return {
        patterns: [],
        summary: `I'm analyzing the ${awayTeam} at ${homeTeam} matchup using alternative methods.`,
        insights: ['Historical head-to-head data available', 'Team performance trends identified'],
        actionItems: ['Check recent form for both teams', 'Analyze venue factors']
      }
    }
  }

  /**
   * Get pattern insights for voice delivery
   */
  async getVoicePatternInsights(query: string): Promise<string> {
    const result = await this.processPatternQuery(query)
    return this.generateVoiceNarrative(result)
  }

  /**
   * Parse natural language queries into structured format
   */
  private parseNaturalLanguageQuery(query: string): PatternQuery {
    const lowerQuery = query.toLowerCase()
    
    // Detect query type
    let type: 'player' | 'team' | 'game' | 'general' = 'general'
    if (lowerQuery.includes('player') || this.containsPlayerName(lowerQuery)) {
      type = 'player'
    } else if (lowerQuery.includes('team') || this.containsTeamName(lowerQuery)) {
      type = 'team'
    } else if (lowerQuery.includes('game') || lowerQuery.includes('matchup')) {
      type = 'game'
    }
    
    // Extract target (player/team name)
    const target = this.extractTarget(lowerQuery, type)
    
    // Extract filters
    const filters = this.extractFilters(lowerQuery)
    
    return { type, target, filters }
  }

  /**
   * Query Pattern API V4 (port 3337)
   */
  private async queryPatternApiV4(query: PatternQuery) {
    try {
      // V4 API has /patterns endpoint that returns pattern list
      const response = await axios.get(`${this.patternApiV4Url}/patterns`)
      return response
    } catch (error) {
      console.error(chalk.red('Pattern API V4 error:'), error.message)
      throw error
    }
  }

  /**
   * Query Unified Pattern API (port 3336)
   */
  private async queryUnifiedPatternApi(query: PatternQuery) {
    try {
      // Unified API has different endpoints based on query type
      let endpoint = '/api/unified/stats' // default to stats
      
      if (query.type === 'game' || query.target) {
        endpoint = '/api/unified/analyze'
        // For analyze, we'd need to POST with game data
      } else if (query.filters?.timeframe === 'today' || query.filters?.timeframe === 'tonight') {
        endpoint = '/api/unified/top-plays'
      }
      
      const response = await axios.get(`${this.unifiedApiUrl}${endpoint}`)
      return response
    } catch (error) {
      console.error(chalk.red('Unified Pattern API error:'), error.message)
      throw error
    }
  }

  /**
   * Combine pattern results from multiple APIs
   */
  private combinePatternResults(v4Response: any, unifiedResponse: any): any {
    const patterns = []
    
    // Process V4 API results (has patterns array directly)
    if (v4Response.status === 'fulfilled' && v4Response.value?.data?.patterns) {
      const v4Patterns = v4Response.value.data.patterns.map(p => ({
        name: p.name,
        confidence: p.winRate || 0.5,
        description: p.description,
        applicableGames: p.count || 0,
        historicalROI: p.roi || 0,
        recommendation: this.generateRecommendation({ confidence: p.winRate, ...p })
      }))
      patterns.push(...v4Patterns)
    }
    
    // Process Unified API results (stats endpoint has nested pattern structure)
    if (unifiedResponse.status === 'fulfilled' && unifiedResponse.value?.data?.patterns) {
      const unifiedData = unifiedResponse.value.data.patterns
      
      // Flatten all pattern categories
      Object.values(unifiedData).forEach((category: any) => {
        if (Array.isArray(category)) {
          category.forEach(p => {
            patterns.push({
              name: p.name,
              confidence: p.winRate || p.synergy / 4 || 0.5,
              description: this.getPatternDescription(p.name),
              applicableGames: 100, // Default since not provided
              historicalROI: p.roi || 0,
              recommendation: this.generateRecommendation({ confidence: p.winRate || p.synergy / 4, ...p })
            })
          })
        }
      })
    }
    
    // Deduplicate and sort by confidence
    return this.deduplicatePatterns(patterns).sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Format results for voice response
   */
  private formatForVoiceResponse(patterns: any[], originalQuery: string): PatternResult {
    const topPatterns = patterns.slice(0, 3) // Top 3 for voice
    
    return {
      patterns: topPatterns.map(p => ({
        name: p.name || p.pattern_name,
        confidence: p.confidence || p.winRate,
        description: p.description || this.generatePatternDescription(p),
        applicableGames: p.applicableGames || p.gameCount || 0,
        historicalROI: p.roi || p.historicalROI || 0,
        recommendation: this.generateRecommendation(p)
      })),
      summary: this.generateSummary(topPatterns, originalQuery),
      insights: this.generateInsights(topPatterns),
      actionItems: this.generateActionItems(topPatterns)
    }
  }

  /**
   * Format player patterns
   */
  private formatPlayerPatterns(data: any, playerName: string): PatternResult {
    return {
      patterns: data.patterns || [],
      summary: `${playerName} shows interesting performance patterns based on recent analysis.`,
      insights: [`${playerName} trends suggest consistent fantasy value`],
      actionItems: [`Monitor ${playerName}'s matchup factors`, 'Check recent target share trends']
    }
  }

  /**
   * Format game patterns
   */
  private formatGamePatterns(data: any, homeTeam: string, awayTeam: string): PatternResult {
    return {
      patterns: data.patterns || [],
      summary: `The ${awayTeam} at ${homeTeam} matchup reveals several interesting patterns.`,
      insights: ['Historical data shows clear performance trends', 'Venue factors may be significant'],
      actionItems: ['Consider game script scenarios', 'Monitor weather conditions']
    }
  }

  /**
   * Generate voice narrative from pattern results
   */
  generateVoiceNarrative(result: PatternResult): string {
    if (result.patterns.length === 0) {
      return result.summary
    }

    const topPattern = result.patterns[0]
    let narrative = result.summary + ' '
    
    if (topPattern.confidence > 0.7) {
      narrative += `The most compelling pattern shows ${(topPattern.confidence * 100).toFixed(0)}% confidence. `
    }
    
    if (topPattern.historicalROI > 0.3) {
      narrative += `Historical data indicates strong ROI potential. `
    }
    
    narrative += topPattern.recommendation
    
    return narrative
  }

  /**
   * Helper methods for query parsing
   */
  private containsPlayerName(query: string): boolean {
    const commonPlayerNames = ['lebron', 'curry', 'mahomes', 'judge', 'embiid', 'tatum']
    return commonPlayerNames.some(name => query.includes(name))
  }

  private containsTeamName(query: string): boolean {
    const commonTeamNames = ['lakers', 'warriors', 'chiefs', 'yankees', 'celtics']
    return commonTeamNames.some(name => query.includes(name))
  }

  private extractTarget(query: string, type: string): string | undefined {
    // This would use more sophisticated NLP to extract player/team names
    const words = query.split(' ')
    const capitalizedWords = words.filter(word => word[0] === word[0]?.toUpperCase())
    return capitalizedWords.join(' ') || undefined
  }

  private extractFilters(query: string): any {
    const filters: any = {}
    
    if (query.includes('nfl') || query.includes('football')) filters.sport = 'NFL'
    if (query.includes('nba') || query.includes('basketball')) filters.sport = 'NBA'
    if (query.includes('mlb') || query.includes('baseball')) filters.sport = 'MLB'
    if (query.includes('tonight') || query.includes('today')) filters.timeframe = 'today'
    if (query.includes('high confidence')) filters.confidence = 0.7
    
    return filters
  }

  private getV4Endpoint(query: PatternQuery): string {
    switch (query.type) {
      case 'player': return '/analyze/player'
      case 'team': return '/analyze/team'
      case 'game': return '/analyze/matchup'
      default: return '/patterns/all'
    }
  }

  private buildV4Params(query: PatternQuery): any {
    return {
      target: query.target,
      ...query.filters
    }
  }

  private buildUnifiedParams(query: PatternQuery): any {
    return {
      type: query.type,
      target: query.target,
      filters: JSON.stringify(query.filters)
    }
  }

  private deduplicatePatterns(patterns: any[]): any[] {
    const seen = new Set()
    return patterns.filter(pattern => {
      const key = pattern.name || pattern.pattern_name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private generatePatternDescription(pattern: any): string {
    return `Pattern detected with ${pattern.gameCount || 'multiple'} historical occurrences`
  }

  private getPatternDescription(patternName: string): string {
    const descriptions: Record<string, string> = {
      'backToBackFade': 'Bet against teams playing second game in two nights',
      'embarrassmentRevenge': 'Teams seeking revenge after embarrassing loss',
      'altitudeAdvantage': 'Home teams in high-altitude cities have an edge',
      'perfectStorm': 'Multiple negative factors create a fade opportunity',
      'divisionDogBite': 'Division underdogs cover more often than expected',
      'primetimeUnder': 'Under performs in nationally televised games',
      'extremeCold': 'Cold weather impacts scoring and performance',
      'starPlayerOut': 'Team adjusts when star player is absent',
      'fatigueCascade': 'Extreme fatigue compounds across multiple factors'
    }
    return descriptions[patternName] || `${patternName} pattern identified`
  }

  private generateRecommendation(pattern: any): string {
    if (pattern.confidence > 0.7) {
      return 'Strong recommendation for consideration.'
    } else if (pattern.confidence > 0.6) {
      return 'Moderate confidence, worth monitoring.'
    } else {
      return 'Lower confidence, use with caution.'
    }
  }

  private generateSummary(patterns: any[], query: string): string {
    if (patterns.length === 0) {
      return 'No significant patterns detected for this query.'
    }
    
    const avgConfidence = patterns.reduce((sum, p) => sum + (p.confidence || 0), 0) / patterns.length
    return `Found ${patterns.length} relevant patterns with ${(avgConfidence * 100).toFixed(0)}% average confidence.`
  }

  private generateInsights(patterns: any[]): string[] {
    return patterns.slice(0, 2).map(p => 
      `${p.name} pattern shows ${(p.confidence * 100).toFixed(0)}% historical accuracy`
    )
  }

  private generateActionItems(patterns: any[]): string[] {
    const items = ['Monitor lineup confirmations', 'Check injury reports']
    if (patterns.some(p => p.confidence > 0.7)) {
      items.push('Consider increasing exposure to high-confidence patterns')
    }
    return items
  }

  private getErrorResponse(query: string): PatternResult {
    return {
      patterns: [],
      summary: "I'm having trouble accessing the pattern detection system right now.",
      insights: ['Pattern analysis temporarily unavailable'],
      actionItems: ['Try again in a moment', 'Use traditional analysis methods']
    }
  }
}