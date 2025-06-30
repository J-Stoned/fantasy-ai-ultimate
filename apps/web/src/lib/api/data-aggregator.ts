/**
 * Data Aggregator
 * 
 * Combines data from all FREE APIs into unified insights
 */

import { espnAPI } from './espn-free';
import { weatherAPI } from './weather';
import { oddsAPI } from './odds';
import { redditAPI } from './reddit';
import { sleeperAPI } from './sleeper';

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
      const [
        redditSentiment,
        // Add other API calls as needed
      ] = await Promise.all([
        redditAPI.getPlayerSentiment(playerName),
        // espnAPI.getPlayer('football', 'nfl', playerId) if we have ID
      ]);

      // Calculate insights
      const insights = this.generateInsights({
        sentiment: redditSentiment,
      });

      // Calculate confidence score
      const confidenceScore = this.calculateConfidence({
        dataPoints: 3, // Number of APIs with data
        sentimentScore: redditSentiment.score,
      });

      return {
        player: {
          id: playerId || '',
          name: playerName,
          team: '', // Would come from ESPN/Sleeper
          position: '', // Would come from ESPN/Sleeper
        },
        stats: {
          current: {},
          projected: {},
        },
        sentiment: {
          reddit: {
            score: redditSentiment.score,
            mentions: redditSentiment.mentions,
            topics: redditSentiment.topics,
          },
          trending: redditSentiment.mentions > 50,
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
}

// Singleton instance
export const dataAggregator = new DataAggregator();