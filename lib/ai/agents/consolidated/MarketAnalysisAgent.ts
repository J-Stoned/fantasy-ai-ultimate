import { BaseAgent, AgentContext, AgentResponse } from '../BaseAgent'
import { PlayerService } from '../../services/PlayerService'
import { QueryParser, QueryIntent } from '../../services/QueryParser'
import { supabase } from '../../../supabase/client-browser'
import { createAgentLogger } from '../../../utils/logger'

/**
 * MarketAnalysisAgent - Consolidated agent for external market data
 * 
 * Handles:
 * - News updates
 * - Social sentiment analysis
 * - Betting odds and lines
 * - Weather impact analysis
 * - Schedule analysis
 */
export class MarketAnalysisAgent extends BaseAgent {
  private playerService: PlayerService
  private queryParser: QueryParser
  private logger = createAgentLogger('MarketAnalysisAgent')
  
  constructor() {
    super(
      'Market Analysis Expert',
      'Comprehensive market analysis including news, social sentiment, betting, and weather',
      [] // Keywords handled by QueryParser
    )
    
    this.playerService = new PlayerService()
    this.queryParser = new QueryParser()
  }
  
  /**
   * Check if this agent can handle the query
   */
  canHandle(query: string): boolean {
    const { intent } = this.queryParser.parseQuery(query)
    
    return [
      QueryIntent.NEWS_UPDATE,
      QueryIntent.SOCIAL_SENTIMENT,
      QueryIntent.BETTING_ODDS,
      QueryIntent.WEATHER_IMPACT,
      QueryIntent.SCHEDULE_ANALYSIS
    ].includes(intent)
  }
  
  /**
   * Process the query
   */
  async process(query: string, context: AgentContext): Promise<AgentResponse> {
    const { intent, entities } = this.queryParser.parseQuery(query)
    
    try {
      switch (intent) {
        case QueryIntent.NEWS_UPDATE:
          return await this.handleNewsUpdate(entities, context)
          
        case QueryIntent.SOCIAL_SENTIMENT:
          return await this.handleSocialSentiment(entities, context)
          
        case QueryIntent.BETTING_ODDS:
          return await this.handleBettingOdds(entities, context)
          
        case QueryIntent.WEATHER_IMPACT:
          return await this.handleWeatherImpact(entities, context)
          
        case QueryIntent.SCHEDULE_ANALYSIS:
          return await this.handleScheduleAnalysis(entities, context)
          
        default:
          return {
            success: false,
            message: "I couldn't understand what market information you're looking for.",
            suggestions: [
              "Ask about news: 'Any news on Dak Prescott?'",
              "Check social buzz: 'What's the Twitter buzz on Justin Herbert?'",
              "Get betting info: 'What are the odds for Cowboys vs Eagles?'",
              "Check weather: 'How's the weather for the Packers game?'"
            ]
          }
      }
    } catch (error) {
      this.logger.error('Market analysis error', error)
      return {
        success: false,
        message: "I encountered an error analyzing market data. Please try again.",
      }
    }
  }
  
  /**
   * Handle news update queries
   */
  private async handleNewsUpdate(entities: any, context: AgentContext): Promise<AgentResponse> {
    // For now, always use stored news
    // TODO: Add real-time news API integration
    
    // Get recent news from database
    const newsQuery = supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(10)
    
    // Filter by player if specified
    if (entities.players.length > 0) {
      const players = await this.playerService.findPlayerByName(entities.players[0])
      if (players.length > 0) {
        newsQuery.or(`player_ids.cs.{${players[0].id}}`)
      }
    }
    
    // Filter by team if specified
    if (entities.teams.length > 0) {
      newsQuery.or(`team_ids.cs.{${entities.teams[0]}}`)
    }
    
    const { data: articles, error } = await newsQuery
    
    if (error || !articles || articles.length === 0) {
      return {
        success: false,
        message: "No recent news found for your query.",
      }
    }
    
    const message = this.formatNewsUpdate(articles, entities)
    
    return {
      success: true,
      message,
      data: { articles },
      confidence: 0.8
    }
  }
  
  /**
   * Handle social sentiment queries
   */
  private async handleSocialSentiment(entities: any, context: AgentContext): Promise<AgentResponse> {
    if (entities.players.length === 0) {
      return {
        success: false,
        message: "Please specify which player's social sentiment you'd like to analyze.",
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
    
    // Get social sentiment data
    const { data: sentiment } = await supabase
      .from('social_sentiment')
      .select('*')
      .eq('player_id', player.id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single()
    
    if (!sentiment) {
      return {
        success: false,
        message: `No social sentiment data available for ${player.firstName} ${player.lastName}.`,
      }
    }
    
    const message = this.formatSocialSentiment(player, sentiment)
    
    return {
      success: true,
      message,
      data: { player, sentiment },
      confidence: 0.7
    }
  }
  
  /**
   * Handle betting odds queries
   */
  private async handleBettingOdds(entities: any, context: AgentContext): Promise<AgentResponse> {
    // Get games for specified teams
    let gamesQuery = supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*),
        betting_lines(*)
      `)
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
      .limit(10)
    
    if (entities.teams.length > 0) {
      gamesQuery = gamesQuery.or(`home_team.abbreviation.eq.${entities.teams[0]},away_team.abbreviation.eq.${entities.teams[0]}`)
    }
    
    const { data: games, error } = await gamesQuery
    
    if (error || !games || games.length === 0) {
      return {
        success: false,
        message: "No upcoming games found with betting lines.",
      }
    }
    
    const message = this.formatBettingOdds(games)
    
    return {
      success: true,
      message,
      data: { games },
      confidence: 0.75
    }
  }
  
  /**
   * Handle weather impact queries
   */
  private async handleWeatherImpact(entities: any, context: AgentContext): Promise<AgentResponse> {
    // For now, return placeholder weather data
    // TODO: Add real weather API integration
    
    // Get upcoming outdoor games
    const { data: games } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        venue:venues(*)
      `)
      .gte('game_date', new Date().toISOString())
      .lte('game_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('venue.is_dome', false)
      .order('game_date', { ascending: true })
    
    if (!games || games.length === 0) {
      return {
        success: true,
        message: "No outdoor games scheduled in the next week.",
      }
    }
    
    // Get weather data for each game
    const gamesWithWeather = await Promise.all(
      games.map(async game => {
        const { data: weather } = await supabase
          .from('weather_conditions')
          .select('*')
          .eq('game_id', game.id)
          .single()
        
        return { ...game, weather }
      })
    )
    
    const message = this.formatWeatherImpact(gamesWithWeather)
    
    return {
      success: true,
      message,
      data: { games: gamesWithWeather },
      confidence: 0.8
    }
  }
  
  /**
   * Handle schedule analysis queries
   */
  private async handleScheduleAnalysis(entities: any, context: AgentContext): Promise<AgentResponse> {
    let scheduleQuery = supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*)
      `)
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
      .limit(20)
    
    // Filter by team if specified
    if (entities.teams.length > 0) {
      scheduleQuery = scheduleQuery.or(
        `home_team.abbreviation.eq.${entities.teams[0]},away_team.abbreviation.eq.${entities.teams[0]}`
      )
    }
    
    // Filter by player's team if specified
    if (entities.players.length > 0) {
      const players = await this.playerService.findPlayerByName(entities.players[0])
      if (players.length > 0 && players[0].currentTeamId) {
        scheduleQuery = scheduleQuery.or(
          `home_team_id.eq.${players[0].currentTeamId},away_team_id.eq.${players[0].currentTeamId}`
        )
      }
    }
    
    const { data: games, error } = await scheduleQuery
    
    if (error || !games || games.length === 0) {
      return {
        success: false,
        message: "No upcoming games found for your query.",
      }
    }
    
    // Analyze schedule difficulty
    const analysis = await this.analyzeSchedule(games)
    const message = this.formatScheduleAnalysis(games, analysis)
    
    return {
      success: true,
      message,
      data: { games, analysis },
      confidence: 0.85
    }
  }
  
  // Helper methods
  
  private async getStoredNews(entities: any): Promise<AgentResponse> {
    // Fallback to stored news when external API not available
    const recentNews = [
      "Check team websites and ESPN for the latest news",
      "Follow beat reporters on Twitter for breaking updates",
      "Monitor practice reports for injury updates"
    ]
    
    return {
      success: true,
      message: "📰 **News Update**\n\nExternal news feeds are not currently configured. " +
               "Here's how to stay updated:\n\n" + recentNews.join('\n• '),
      confidence: 0.5
    }
  }
  
  private async analyzeSchedule(games: any[]): Promise<any> {
    // Group games by team
    const teamSchedules = new Map<string, any[]>()
    
    games.forEach(game => {
      const homeTeam = game.home_team.abbreviation
      const awayTeam = game.away_team.abbreviation
      
      if (!teamSchedules.has(homeTeam)) teamSchedules.set(homeTeam, [])
      if (!teamSchedules.has(awayTeam)) teamSchedules.set(awayTeam, [])
      
      teamSchedules.get(homeTeam)!.push({ ...game, isHome: true })
      teamSchedules.get(awayTeam)!.push({ ...game, isHome: false })
    })
    
    // Analyze each team's schedule
    const analysis = new Map<string, any>()
    
    for (const [team, schedule] of teamSchedules) {
      const difficulty = await this.calculateScheduleDifficulty(schedule)
      const homeGames = schedule.filter(g => g.isHome).length
      const awayGames = schedule.length - homeGames
      
      analysis.set(team, {
        team,
        games: schedule.length,
        homeGames,
        awayGames,
        difficulty,
        easyGames: schedule.filter(g => g.difficulty === 'easy').length,
        hardGames: schedule.filter(g => g.difficulty === 'hard').length
      })
    }
    
    return analysis
  }
  
  private async calculateScheduleDifficulty(games: any[]): Promise<string> {
    // Simple difficulty calculation based on opponent rankings
    // In production, this would use actual team rankings and defensive stats
    const difficulties = games.map(game => {
      // Mock difficulty assessment
      return Math.random() > 0.5 ? 'hard' : 'easy'
    })
    
    const hardGames = difficulties.filter(d => d === 'hard').length
    const easyGames = difficulties.filter(d => d === 'easy').length
    
    if (hardGames > easyGames * 1.5) return 'difficult'
    if (easyGames > hardGames * 1.5) return 'favorable'
    return 'balanced'
  }
  
  // Formatting methods
  
  private formatNewsUpdate(articles: any[], entities: any): string {
    let message = `📰 **Latest News**`
    
    if (entities.players.length > 0) {
      message += ` for ${entities.players[0]}`
    } else if (entities.teams.length > 0) {
      message += ` for ${entities.teams[0]}`
    }
    
    message += `\n\n`
    
    articles.slice(0, 5).forEach((article, index) => {
      const date = new Date(article.published_at).toLocaleDateString()
      message += `${index + 1}. **${article.headline}**\n`
      message += `   ${article.summary}\n`
      message += `   _${article.source} - ${date}_\n\n`
    })
    
    return message
  }
  
  private formatSocialSentiment(player: any, sentiment: any): string {
    const sentimentEmoji = sentiment.sentiment_score > 0.6 ? '😊' :
                          sentiment.sentiment_score < 0.4 ? '😟' : '😐'
    
    let message = `${sentimentEmoji} **Social Sentiment for ${player.firstName} ${player.lastName}**\n\n`
    message += `**Overall Sentiment:** ${(sentiment.sentiment_score * 100).toFixed(0)}% positive\n`
    message += `**Buzz Level:** ${sentiment.mention_count} mentions in last 24h\n\n`
    
    if (sentiment.top_topics && sentiment.top_topics.length > 0) {
      message += `**Trending Topics:**\n`
      sentiment.top_topics.slice(0, 3).forEach((topic: string) => {
        message += `• ${topic}\n`
      })
    }
    
    if (sentiment.key_tweets && sentiment.key_tweets.length > 0) {
      message += `\n**Notable Mentions:**\n`
      sentiment.key_tweets.slice(0, 2).forEach((tweet: any) => {
        message += `"${tweet.text}" - @${tweet.author}\n`
      })
    }
    
    return message
  }
  
  private formatBettingOdds(games: any[]): string {
    let message = `🎲 **Betting Lines & Odds**\n\n`
    
    games.slice(0, 5).forEach(game => {
      const line = game.betting_lines?.[0]
      if (!line) return
      
      const date = new Date(game.game_date).toLocaleDateString()
      message += `**${game.away_team.name} @ ${game.home_team.name}**\n`
      message += `_${date}_\n`
      
      if (line.spread) {
        message += `• Spread: ${game.home_team.abbreviation} ${line.spread > 0 ? '+' : ''}${line.spread}\n`
      }
      if (line.total) {
        message += `• O/U: ${line.total}\n`
      }
      if (line.home_ml && line.away_ml) {
        message += `• ML: ${game.away_team.abbreviation} ${line.away_ml > 0 ? '+' : ''}${line.away_ml} / `
        message += `${game.home_team.abbreviation} ${line.home_ml > 0 ? '+' : ''}${line.home_ml}\n`
      }
      
      message += `\n`
    })
    
    return message
  }
  
  private formatWeatherImpact(games: any[]): string {
    let message = `🌦️ **Weather Impact Analysis**\n\n`
    
    const impactfulGames = games.filter(g => g.weather && (
      g.weather.wind_speed > 15 ||
      g.weather.precipitation_chance > 50 ||
      g.weather.temperature < 32
    ))
    
    if (impactfulGames.length === 0) {
      message += "No significant weather concerns for upcoming outdoor games."
    } else {
      impactfulGames.forEach(game => {
        const weather = game.weather
        const date = new Date(game.game_date).toLocaleDateString()
        
        message += `**${game.home_team.name} vs ${game.away_team.name}**\n`
        message += `_${date} at ${game.venue.name}_\n`
        
        const impacts = []
        if (weather.wind_speed > 15) {
          impacts.push(`🌬️ Wind: ${weather.wind_speed} mph - May affect passing/kicking`)
        }
        if (weather.precipitation_chance > 50) {
          impacts.push(`🌧️ ${weather.precipitation_chance}% chance of rain - Favors running game`)
        }
        if (weather.temperature < 32) {
          impacts.push(`❄️ Cold: ${weather.temperature}°F - May affect ball handling`)
        }
        
        impacts.forEach(impact => message += `• ${impact}\n`)
        message += `\n`
      })
    }
    
    return message
  }
  
  private formatScheduleAnalysis(games: any[], analysis: Map<string, any>): string {
    let message = `📅 **Schedule Analysis**\n\n`
    
    // If analyzing specific team
    if (analysis.size === 1) {
      const [team, data] = Array.from(analysis)[0]
      message += `**${team} Upcoming Schedule**\n`
      message += `• Next ${data.games} games: ${data.homeGames} home, ${data.awayGames} away\n`
      message += `• Difficulty: ${data.difficulty.toUpperCase()}\n`
      message += `• Easy matchups: ${data.easyGames} | Tough matchups: ${data.hardGames}\n\n`
      
      message += `**Upcoming Games:**\n`
      games.slice(0, 5).forEach(game => {
        const date = new Date(game.game_date).toLocaleDateString()
        const opponent = game.home_team.abbreviation === team ? 
          `vs ${game.away_team.name}` : `@ ${game.home_team.name}`
        message += `• ${date}: ${opponent}\n`
      })
    } else {
      // General schedule overview
      message += `**Upcoming Games:**\n`
      games.slice(0, 10).forEach(game => {
        const date = new Date(game.game_date).toLocaleDateString()
        message += `• ${date}: ${game.away_team.abbreviation} @ ${game.home_team.abbreviation}\n`
      })
    }
    
    return message
  }
}