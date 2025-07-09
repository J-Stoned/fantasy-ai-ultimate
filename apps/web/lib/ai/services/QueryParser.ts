import { z } from 'zod'

// Intent types that our agents can handle
export enum QueryIntent {
  // Player Analysis intents
  PLAYER_STATS = 'player_stats',
  PLAYER_COMPARISON = 'player_comparison',
  INJURY_STATUS = 'injury_status',
  PLAYER_TRENDS = 'player_trends',
  PLAYER_PROJECTION = 'player_projection',
  ROOKIE_ANALYSIS = 'rookie_analysis',
  
  // Team Management intents
  LINEUP_OPTIMIZATION = 'lineup_optimization',
  TRADE_ANALYSIS = 'trade_analysis',
  WAIVER_PICKUP = 'waiver_pickup',
  DROP_CANDIDATE = 'drop_candidate',
  DRAFT_ADVICE = 'draft_advice',
  
  // Market Analysis intents
  NEWS_UPDATE = 'news_update',
  SOCIAL_SENTIMENT = 'social_sentiment',
  BETTING_ODDS = 'betting_odds',
  WEATHER_IMPACT = 'weather_impact',
  SCHEDULE_ANALYSIS = 'schedule_analysis',
  
  // Game Prediction intents
  MATCHUP_ANALYSIS = 'matchup_analysis',
  DFS_OPTIMIZATION = 'dfs_optimization',
  PLAYOFF_PREDICTION = 'playoff_prediction',
  GAME_PREDICTION = 'game_prediction',
  
  // General
  GENERAL_HELP = 'general_help',
  UNKNOWN = 'unknown'
}

// Entities that can be extracted from queries
export interface QueryEntities {
  players: string[]
  teams: string[]
  positions: string[]
  timeframe?: {
    week?: number
    season?: number
    dateRange?: { start: Date; end: Date }
  }
  scoringSystem?: 'ppr' | 'standard' | 'half_ppr'
  leagueSize?: number
  statCategories?: string[]
  tradeDetails?: {
    giving: string[]
    receiving: string[]
  }
}

// Intent classification result
export interface IntentClassification {
  intent: QueryIntent
  confidence: number
  entities: QueryEntities
  originalQuery: string
}

export class QueryParser {
  // Keywords mapped to intents
  private intentKeywords: Map<QueryIntent, string[]> = new Map([
    [QueryIntent.PLAYER_STATS, ['stats', 'statistics', 'numbers', 'performance', 'how many', 'yards', 'touchdowns', 'points']],
    [QueryIntent.PLAYER_COMPARISON, ['compare', 'versus', 'vs', 'better', 'or', 'comparison']],
    [QueryIntent.INJURY_STATUS, ['injury', 'injured', 'hurt', 'status', 'healthy', 'questionable', 'doubtful', 'out']],
    [QueryIntent.PLAYER_TRENDS, ['trending', 'trend', 'hot', 'cold', 'streak', 'recent', 'lately']],
    [QueryIntent.PLAYER_PROJECTION, ['project', 'projection', 'predict', 'forecast', 'expect', 'will score']],
    [QueryIntent.ROOKIE_ANALYSIS, ['rookie', 'draft pick', 'first year', 'debut']],
    
    [QueryIntent.LINEUP_OPTIMIZATION, ['lineup', 'start', 'sit', 'bench', 'optimize', 'best lineup', 'who to start']],
    [QueryIntent.TRADE_ANALYSIS, ['trade', 'swap', 'deal', 'offer', 'exchange', 'fair trade', 'should i trade']],
    [QueryIntent.WAIVER_PICKUP, ['waiver', 'pickup', 'add', 'available', 'free agent', 'wire']],
    [QueryIntent.DROP_CANDIDATE, ['drop', 'cut', 'release', 'worst player']],
    [QueryIntent.DRAFT_ADVICE, ['draft', 'pick', 'round', 'adp', 'draft strategy']],
    
    [QueryIntent.NEWS_UPDATE, ['news', 'latest', 'update', 'report', 'breaking']],
    [QueryIntent.SOCIAL_SENTIMENT, ['twitter', 'social', 'buzz', 'sentiment', 'talking about']],
    [QueryIntent.BETTING_ODDS, ['odds', 'betting', 'spread', 'over under', 'line', 'vegas']],
    [QueryIntent.WEATHER_IMPACT, ['weather', 'rain', 'wind', 'snow', 'dome', 'conditions']],
    [QueryIntent.SCHEDULE_ANALYSIS, ['schedule', 'matchup', 'opponent', 'ros', 'rest of season']],
    
    [QueryIntent.MATCHUP_ANALYSIS, ['matchup', 'facing', 'against', 'defense', 'vs defense']],
    [QueryIntent.DFS_OPTIMIZATION, ['dfs', 'daily', 'draftkings', 'fanduel', 'salary', 'gpp']],
    [QueryIntent.PLAYOFF_PREDICTION, ['playoff', 'championship', 'playoffs', 'clinch']],
    [QueryIntent.GAME_PREDICTION, ['game', 'win', 'lose', 'score prediction', 'final score']],
  ])
  
  // Position keywords
  private positionKeywords = ['qb', 'quarterback', 'rb', 'running back', 'wr', 'wide receiver', 
                             'te', 'tight end', 'k', 'kicker', 'dst', 'defense', 'flex']
  
  // Time-related keywords
  private timeKeywords = {
    week: ['week', 'wk', 'w'],
    season: ['season', 'year', 'yearly'],
    recent: ['recent', 'last', 'past', 'previous'],
    upcoming: ['next', 'upcoming', 'this week', 'tomorrow']
  }
  
  /**
   * Main method to parse a query and extract intent + entities
   */
  parseQuery(query: string): IntentClassification {
    const cleanQuery = query.toLowerCase().trim()
    
    // Extract entities first
    const entities = this.extractEntities(cleanQuery)
    
    // Classify intent
    const intent = this.classifyIntent(cleanQuery, entities)
    
    return {
      intent: intent.intent,
      confidence: intent.confidence,
      entities,
      originalQuery: query
    }
  }
  
  /**
   * Extract entities from the query
   */
  extractEntities(query: string): QueryEntities {
    return {
      players: this.extractPlayerNames(query),
      teams: this.extractTeamNames(query),
      positions: this.extractPositions(query),
      timeframe: this.extractTimeframe(query),
      scoringSystem: this.extractScoringSystem(query),
      leagueSize: this.extractLeagueSize(query),
      statCategories: this.extractStatCategories(query),
      tradeDetails: this.extractTradeDetails(query)
    }
  }
  
  /**
   * Extract player names from query
   */
  extractPlayerNames(query: string): string[] {
    const players: string[] = []
    
    // Look for capitalized words that could be names
    const words = query.split(/\s+/)
    for (let i = 0; i < words.length - 1; i++) {
      const word = words[i]
      const nextWord = words[i + 1]
      
      // Check if this could be a first name + last name
      if (this.isCapitalized(word) && this.isCapitalized(nextWord)) {
        players.push(`${word} ${nextWord}`)
        i++ // Skip next word
      }
    }
    
    // Also check for common name patterns after keywords
    const namePatterns = [
      /(?:trade|start|sit|add|drop|compare)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:'s|'s)/g,
    ]
    
    for (const pattern of namePatterns) {
      const matches = query.matchAll(pattern)
      for (const match of matches) {
        if (match[1]) players.push(match[1])
      }
    }
    
    return [...new Set(players)] // Remove duplicates
  }
  
  /**
   * Extract team names from query
   */
  extractTeamNames(query: string): string[] {
    const teams: string[] = []
    
    // Common NFL team names and abbreviations
    const teamPatterns = [
      // Full names
      /\b(patriots|bills|dolphins|jets|ravens|bengals|browns|steelers|texans|colts|jaguars|titans|broncos|chiefs|raiders|chargers|cowboys|giants|eagles|commanders|bears|lions|packers|vikings|falcons|panthers|saints|buccaneers|cardinals|rams|49ers|seahawks)\b/g,
      // Abbreviations
      /\b(ne|buf|mia|nyj|bal|cin|cle|pit|hou|ind|jax|ten|den|kc|lv|lac|dal|nyg|phi|was|chi|det|gb|min|atl|car|no|tb|ari|lar|sf|sea)\b/g,
    ]
    
    for (const pattern of teamPatterns) {
      const matches = query.matchAll(pattern)
      for (const match of matches) {
        teams.push(match[1])
      }
    }
    
    return [...new Set(teams)]
  }
  
  /**
   * Extract positions from query
   */
  extractPositions(query: string): string[] {
    const positions: string[] = []
    const cleanQuery = query.toLowerCase()
    
    // Map full names to abbreviations
    const positionMap: Record<string, string> = {
      'quarterback': 'QB',
      'running back': 'RB',
      'wide receiver': 'WR',
      'tight end': 'TE',
      'kicker': 'K',
      'defense': 'DST',
      'qb': 'QB',
      'rb': 'RB',
      'wr': 'WR',
      'te': 'TE',
      'k': 'K',
      'dst': 'DST',
      'flex': 'FLEX'
    }
    
    for (const [keyword, position] of Object.entries(positionMap)) {
      if (cleanQuery.includes(keyword)) {
        positions.push(position)
      }
    }
    
    return [...new Set(positions)]
  }
  
  /**
   * Extract timeframe from query
   */
  extractTimeframe(query: string): QueryEntities['timeframe'] {
    const timeframe: QueryEntities['timeframe'] = {}
    
    // Week extraction
    const weekMatch = query.match(/week\s*(\d+)|wk\s*(\d+)|w(\d+)/i)
    if (weekMatch) {
      timeframe.week = parseInt(weekMatch[1] || weekMatch[2] || weekMatch[3])
    }
    
    // Season/year extraction
    const yearMatch = query.match(/(\d{4})\s*season|season\s*(\d{4})|year\s*(\d{4})/i)
    if (yearMatch) {
      timeframe.season = parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3])
    }
    
    // Current season if not specified
    if (!timeframe.season && (query.includes('this season') || query.includes('current'))) {
      timeframe.season = new Date().getFullYear()
    }
    
    return Object.keys(timeframe).length > 0 ? timeframe : undefined
  }
  
  /**
   * Extract scoring system from query
   */
  extractScoringSystem(query: string): 'ppr' | 'standard' | 'half_ppr' | undefined {
    if (query.includes('ppr') && !query.includes('half')) return 'ppr'
    if (query.includes('half ppr') || query.includes('half-ppr')) return 'half_ppr'
    if (query.includes('standard')) return 'standard'
    return undefined
  }
  
  /**
   * Extract league size from query
   */
  extractLeagueSize(query: string): number | undefined {
    const sizeMatch = query.match(/(\d+)[\s-]*(team|man)\s*league/i)
    return sizeMatch ? parseInt(sizeMatch[1]) : undefined
  }
  
  /**
   * Extract stat categories from query
   */
  extractStatCategories(query: string): string[] {
    const stats: string[] = []
    const statKeywords = [
      'yards', 'touchdowns', 'tds', 'receptions', 'catches', 'targets',
      'carries', 'attempts', 'completions', 'interceptions', 'ints',
      'fumbles', 'sacks', 'field goals', 'points'
    ]
    
    for (const stat of statKeywords) {
      if (query.includes(stat)) {
        stats.push(stat)
      }
    }
    
    return stats
  }
  
  /**
   * Extract trade details from query
   */
  extractTradeDetails(query: string): QueryEntities['tradeDetails'] | undefined {
    // Look for "trade X for Y" pattern
    const tradeMatch = query.match(/trade\s+(.+?)\s+for\s+(.+?)(?:\?|$)/i)
    if (tradeMatch) {
      return {
        giving: [tradeMatch[1].trim()],
        receiving: [tradeMatch[2].trim()]
      }
    }
    
    // Look for "give X get Y" pattern
    const giveGetMatch = query.match(/give\s+(.+?)\s+get\s+(.+?)(?:\?|$)/i)
    if (giveGetMatch) {
      return {
        giving: [giveGetMatch[1].trim()],
        receiving: [giveGetMatch[2].trim()]
      }
    }
    
    return undefined
  }
  
  /**
   * Classify the intent of the query
   */
  private classifyIntent(query: string, entities: QueryEntities): { intent: QueryIntent; confidence: number } {
    const scores = new Map<QueryIntent, number>()
    
    // Score each intent based on keyword matches
    for (const [intent, keywords] of this.intentKeywords) {
      let score = 0
      for (const keyword of keywords) {
        if (query.includes(keyword)) {
          score += 1
        }
      }
      
      // Boost score based on entities
      if (intent === QueryIntent.TRADE_ANALYSIS && entities.tradeDetails) {
        score += 3
      }
      if (intent === QueryIntent.PLAYER_COMPARISON && entities.players.length >= 2) {
        score += 2
      }
      if (intent === QueryIntent.LINEUP_OPTIMIZATION && entities.positions.length > 0) {
        score += 1
      }
      
      scores.set(intent, score)
    }
    
    // Find the highest scoring intent
    let bestIntent = QueryIntent.UNKNOWN
    let bestScore = 0
    
    for (const [intent, score] of scores) {
      if (score > bestScore) {
        bestIntent = intent
        bestScore = score
      }
    }
    
    // Calculate confidence (0-1)
    const confidence = bestScore > 0 ? Math.min(bestScore / 5, 1) : 0
    
    return { intent: bestIntent, confidence }
  }
  
  /**
   * Check if a word is capitalized
   */
  private isCapitalized(word: string): boolean {
    return word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()
  }
}