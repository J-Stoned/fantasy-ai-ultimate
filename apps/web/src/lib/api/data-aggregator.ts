/**
 * Data Aggregator
 * 
 * Combines data from all FREE APIs into unified insights
 */

import { espnAPI } from './espn-free';
import { espnFantasyAPI } from './espn-fantasy';
import { weatherAPI } from './weather';
import { oddsAPI } from './odds';
import { redditAPI } from './reddit';
import { sleeperAPI } from './sleeper';
import { nflAPI } from './nfl-official';
import { twitterAPI } from './twitter';
import { sportsDataAPI } from './sportsdata-io';

export interface AggregatedPlayerData {
  player: {
    id: string;
    name: string;
    team: string;
    position: string;
  };
  stats: {
    current: Record<string, number>;
    projected: Record<string, number>;
  };
  sentiment: {
    reddit: {
      score: number;
      mentions: number;
      topics: string[];
    };
    trending: boolean;
  };
  matchup: {
    opponent: string;
    gameTime: Date;
    weather?: {
      impact: number;
      conditions: string;
    };
    odds?: {
      spread: number;
      total: number;
      props?: any[];
    };
  };
  insights: string[];
  confidenceScore: number; // 0-100
}

export class DataAggregator {
  /**
   * Get comprehensive player analysis
   */
  async getPlayerAnalysis(playerName: string, playerId?: string): Promise<AggregatedPlayerData | null> {
    try {
      // Fetch data from multiple sources in parallel
      const promises: Promise<any>[] = [
        redditAPI.getPlayerSentiment(playerName),
      ];

      // Add Twitter if configured
      if (twitterAPI.isConfigured()) {
        promises.push(twitterAPI.searchPlayerTweets(playerName, 20));
      }

      // Add ESPN Fantasy data if we have a player ID
      if (playerId) {
        promises.push(espnFantasyAPI.getProjections([parseInt(playerId)]));
      }

      // Add SportsData.io if configured
      if (sportsDataAPI.isConfigured() && playerId) {
        promises.push(sportsDataAPI.getPlayer(parseInt(playerId)));
      }

      const results = await Promise.allSettled(promises);
      
      // Extract successful results
      const redditSentiment = results[0].status === 'fulfilled' ? results[0].value : null;
      const twitterData = results[1]?.status === 'fulfilled' ? results[1].value : null;
      const espnProjections = results[2]?.status === 'fulfilled' ? results[2].value : null;
      const sportsDataPlayer = results[3]?.status === 'fulfilled' ? results[3].value : null;

      // Combine insights from all sources
      const insights = this.generateInsights({
        sentiment: redditSentiment,
        twitter: twitterData,
        projections: espnProjections,
        sportsData: sportsDataPlayer,
      });

      // Calculate confidence score based on available data
      const dataPoints = results.filter(r => r.status === 'fulfilled').length;
      const confidenceScore = this.calculateConfidence({
        dataPoints,
        sentimentScore: redditSentiment?.score || 0,
        twitterUrgency: twitterData?.urgency,
      });

      return {
        player: {
          id: playerId || '',
          name: playerName,
          team: sportsDataPlayer?.Team || '',
          position: sportsDataPlayer?.Position || '',
        },
        stats: {
          current: {},
          projected: espnProjections?.[0] ? {
            points: espnProjections[0].projectedPoints,
            pointsPPR: espnProjections[0].projectedStats?.FantasyPointsPPR,
          } : {},
        },
        sentiment: {
          reddit: redditSentiment ? {
            score: redditSentiment.score,
            mentions: redditSentiment.mentions,
            topics: redditSentiment.topics,
          } : { score: 0, mentions: 0, topics: [] },
          trending: (redditSentiment?.mentions || 0) > 50 || twitterData?.urgency === 'breaking',
        },
        matchup: {
          opponent: '',
          gameTime: new Date(),
        },
        insights,
        confidenceScore,
      };
    } catch (error) {
      console.error('Error aggregating player data:', error);
      return null;
    }
  }

  /**
   * Get game analysis with all factors
   */
  async getGameAnalysis(homeTeam: string, awayTeam: string, venue?: string): Promise<any> {
    try {
      const [
        weather,
        odds,
        redditHome,
        redditAway,
      ] = await Promise.all([
        venue ? weatherAPI.getVenueWeather(venue) : null,
        oddsAPI.getOdds('americanfootball_nfl'),
        redditAPI.getTeamPosts(homeTeam),
        redditAPI.getTeamPosts(awayTeam),
      ]);

      // Find matching game in odds
      const gameOdds = odds?.find(o => 
        (o.homeTeam.includes(homeTeam) || o.awayTeam.includes(awayTeam))
      );

      return {
        teams: {
          home: homeTeam,
          away: awayTeam,
        },
        weather: weather ? {
          conditions: weather.conditions,
          impact: weather.impact,
          insights: weatherAPI.getWeatherInsights(weather),
        } : null,
        betting: gameOdds ? {
          spread: gameOdds.consensus.spread,
          total: gameOdds.consensus.total,
          insights: oddsAPI.getBettingInsights(gameOdds),
        } : null,
        sentiment: {
          home: this.analyzePosts(redditHome),
          away: this.analyzePosts(redditAway),
        },
        recommendations: this.generateGameRecommendations({
          weather,
          odds: gameOdds,
          sentiment: { home: redditHome, away: redditAway },
        }),
      };
    } catch (error) {
      console.error('Error analyzing game:', error);
      return null;
    }
  }

  /**
   * Get trending players across all platforms
   */
  async getTrendingPlayers(): Promise<any[]> {
    try {
      const [
        redditTrending,
        injuries,
        trades,
      ] = await Promise.all([
        redditAPI.getTrendingPlayers(),
        redditAPI.getInjuryRumors(),
        redditAPI.getTradeRumors(),
      ]);

      // Combine and dedupe
      const trending = new Set<string>();
      
      redditTrending.forEach(p => trending.add(p));
      
      injuries.forEach(post => {
        // Extract player names from injury posts
        const playerPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
        const matches = post.title.match(playerPattern) || [];
        matches.forEach(m => trending.add(m));
      });

      return Array.from(trending).map(player => ({
        name: player,
        reason: this.getTrendingReason(player, injuries, trades),
        sentiment: 'analyzing...',
      }));
    } catch (error) {
      console.error('Error getting trending players:', error);
      return [];
    }
  }

  /**
   * Generate insights based on aggregated data
   */
  private generateInsights(data: any): string[] {
    const insights: string[] = [];

    // Reddit sentiment insights
    if (data.sentiment) {
      if (data.sentiment.score > 0.5) {
        insights.push('📈 Very positive community sentiment');
      } else if (data.sentiment.score < -0.5) {
        insights.push('📉 Negative community sentiment');
      }

      if (data.sentiment.topics.includes('injury')) {
        insights.push('⚠️ Injury concerns mentioned');
      }
      if (data.sentiment.topics.includes('breakout')) {
        insights.push('🚀 Breakout potential discussed');
      }
    }

    // Twitter insights
    if (data.twitter) {
      if (data.twitter.urgency === 'breaking') {
        insights.push('🔥 Breaking news on Twitter');
      }
      if (data.twitter.sentiment === 'negative' && data.twitter.topics.includes('injury')) {
        insights.push('🚨 Injury news trending on Twitter');
      }
      if (data.twitter.tweets.length > 10) {
        insights.push('📱 High Twitter activity');
      }
    }

    // ESPN Fantasy projections
    if (data.projections?.[0]) {
      const proj = data.projections[0];
      if (proj.projectedPoints > 20) {
        insights.push('⭐ Projected for 20+ fantasy points');
      } else if (proj.projectedPoints < 5) {
        insights.push('📊 Low projection this week');
      }
    }

    // SportsData.io insights
    if (data.sportsData) {
      if (data.sportsData.InjuryStatus) {
        insights.push(`🏥 ${data.sportsData.InjuryStatus}: ${data.sportsData.InjuryBodyPart || 'Unknown'}`);
      }
      if (data.sportsData.DraftKingsSalary && data.sportsData.DraftKingsSalary > 8000) {
        insights.push('💎 High DFS salary - elite play');
      }
    }

    return insights;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(factors: any): number {
    let score = 50; // Base score

    // More data points = higher confidence
    score += factors.dataPoints * 10;

    // Strong sentiment = higher confidence
    score += Math.abs(factors.sentimentScore) * 20;

    // Breaking news = higher confidence in timeliness
    if (factors.twitterUrgency === 'breaking') {
      score += 15;
    }

    // Multiple sources agreeing = higher confidence
    if (factors.dataPoints >= 3) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Analyze Reddit posts for sentiment
   */
  private analyzePosts(posts: any[]): any {
    const recent = posts.slice(0, 10);
    let positive = 0;
    let negative = 0;

    recent.forEach(post => {
      if (post.score > 100) positive++;
      if (post.title.toLowerCase().includes('concern')) negative++;
    });

    return {
      posts: recent.length,
      sentiment: positive > negative ? 'positive' : 'negative',
      hotTopics: recent.slice(0, 3).map(p => p.title),
    };
  }

  /**
   * Generate game recommendations
   */
  private generateGameRecommendations(data: any): string[] {
    const recs: string[] = [];

    // Weather recommendations
    if (data.weather?.impact.overall < -0.3) {
      recs.push('🌧️ Bad weather: Favor RBs and DEF, fade passing game');
    }

    // Betting recommendations
    if (data.odds?.consensus.total.points < 40) {
      recs.push('📉 Low total: Consider DEF and conservative plays');
    } else if (data.odds?.consensus.total.points > 50) {
      recs.push('📈 High total: Stack QBs with pass catchers');
    }

    // Sentiment recommendations
    if (data.sentiment.home.length > data.sentiment.away.length * 2) {
      recs.push('🔥 Home team generating more buzz');
    }

    return recs;
  }

  /**
   * Determine why a player is trending
   */
  private getTrendingReason(player: string, injuries: any[], trades: any[]): string {
    if (injuries.some(p => p.title.includes(player))) {
      return 'Injury news';
    }
    if (trades.some(p => p.title.includes(player))) {
      return 'Trade rumors';
    }
    return 'High mention volume';
  }

  /**
   * Get comprehensive data from all available sources
   */
  async getAllSourcesData(): Promise<{
    sources: string[];
    nfl: any;
    espnFantasy: any;
    twitter: any;
    sportsData: any;
    timestamp: string;
  }> {
    const sources: string[] = ['reddit', 'espn', 'sleeper', 'weather', 'odds'];
    const results: any = {
      sources,
      timestamp: new Date().toISOString(),
    };

    // Check NFL Official data
    try {
      const nflScores = await nflAPI.getCurrentScores();
      if (nflScores.length > 0) {
        sources.push('nfl_official');
        results.nfl = { scores: nflScores };
      }
    } catch (error) {
      console.log('NFL Official API not available');
    }

    // Check ESPN Fantasy
    try {
      const trending = await espnFantasyAPI.getTrendingPlayers();
      if (trending.mostAdded.length > 0) {
        sources.push('espn_fantasy');
        results.espnFantasy = trending;
      }
    } catch (error) {
      console.log('ESPN Fantasy API not available');
    }

    // Check Twitter
    if (twitterAPI.isConfigured()) {
      try {
        const breakingNews = await twitterAPI.getBreakingInjuryNews();
        if (breakingNews.length > 0) {
          sources.push('twitter');
          results.twitter = { breakingNews };
        }
      } catch (error) {
        console.log('Twitter API error:', error);
      }
    }

    // Check SportsData.io
    if (sportsDataAPI.isConfigured()) {
      try {
        const remaining = await sportsDataAPI.getRemainingCalls();
        sources.push('sportsdata_io');
        results.sportsData = { 
          configured: true,
          remainingCalls: remaining,
        };
      } catch (error) {
        console.log('SportsData.io API error:', error);
      }
    }

    return results;
  }
}

// Singleton instance
export const dataAggregator = new DataAggregator();