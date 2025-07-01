/**
 * Twitter/X API Integration
 * 
 * Real-time player updates, injury news, and breaking announcements
 * Requires Twitter Bearer Token from environment
 */

import { redis } from '@/lib/redis';
import pLimit from 'p-limit';

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const CACHE_TTL = 60; // 1 minute cache for real-time data

// Rate limiting: 500,000 tweets per month = ~16,666 per day = ~11.5 per minute
const rateLimiter = pLimit(10); // Conservative: 10 concurrent requests

export interface Tweet {
  id: string;
  text: string;
  author_id: string;
  author_name?: string;
  author_username?: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  entities?: {
    mentions?: Array<{ username: string }>;
    hashtags?: Array<{ tag: string }>;
    urls?: Array<{ url: string; expanded_url: string }>;
  };
  context_annotations?: Array<{
    domain: { name: string };
    entity: { name: string };
  }>;
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  verified: boolean;
  description: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface PlayerTweets {
  player: string;
  tweets: Tweet[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics: string[];
  urgency: 'breaking' | 'recent' | 'normal';
}

export class TwitterAPI {
  private bearerToken: string | undefined;

  constructor() {
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!this.bearerToken || this.bearerToken === 'your-twitter-bearer-token') {
      console.warn('Twitter API: No valid bearer token found');
    }
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!(this.bearerToken && this.bearerToken !== 'your-twitter-bearer-token');
  }

  /**
   * Fetch with authentication and caching
   */
  private async fetchWithAuth(endpoint: string, params?: Record<string, any>): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Twitter API not configured');
    }

    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    const cacheKey = `twitter:${endpoint}${queryString}`;

    // Check cache
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Rate limited fetch
    const data = await rateLimiter(async () => {
      const response = await fetch(`${TWITTER_API_BASE}${endpoint}${queryString}`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twitter API error: ${response.status} - ${error}`);
      }

      return response.json();
    });

    // Cache result
    if (redis && data) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Search for recent tweets about a player
   */
  async searchPlayerTweets(playerName: string, limit: number = 50): Promise<PlayerTweets> {
    try {
      const params = {
        query: `"${playerName}" (injury OR injured OR trade OR breaking OR news) -is:retweet lang:en`,
        max_results: Math.min(limit, 100),
        'tweet.fields': 'created_at,public_metrics,entities,context_annotations',
        'user.fields': 'name,username,verified',
        expansions: 'author_id',
      };

      const data = await this.fetchWithAuth('/tweets/search/recent', params);
      
      const tweets = this.parseTweets(data);
      const analysis = this.analyzePlayerTweets(tweets, playerName);

      return analysis;
    } catch (error) {
      console.error('Error searching player tweets:', error);
      return {
        player: playerName,
        tweets: [],
        sentiment: 'neutral',
        topics: [],
        urgency: 'normal',
      };
    }
  }

  /**
   * Get tweets from verified NFL reporters and insiders
   */
  async getNFLInsiderTweets(): Promise<Tweet[]> {
    const insiders = [
      'AdamSchefter',    // ESPN
      'RapSheet',        // NFL Network
      'JayGlazer',       // FOX
      'MikeGarafolo',    // NFL Network
      'TomPelissero',    // NFL Network
      'FieldYates',      // ESPN
      'MikeReiss',       // ESPN
      'MikeKlis',        // Denver
      'nick_underhill',  // Saints
      'RapSheet',        // Ian Rapoport
    ];

    try {
      const userIds = await this.getUserIds(insiders);
      
      const params = {
        query: `(from:${userIds.join(' OR from:')}) (injury OR trade OR signing OR breaking)`,
        max_results: 100,
        'tweet.fields': 'created_at,public_metrics,entities',
        'user.fields': 'name,username,verified',
        expansions: 'author_id',
      };

      const data = await this.fetchWithAuth('/tweets/search/recent', params);
      return this.parseTweets(data);
    } catch (error) {
      console.error('Error getting insider tweets:', error);
      return [];
    }
  }

  /**
   * Get injury updates from the last hour
   */
  async getBreakingInjuryNews(): Promise<Tweet[]> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const params = {
        query: `(injury OR injured OR questionable OR doubtful OR "ruled out" OR IR) (NFL OR football) -is:retweet lang:en`,
        start_time: oneHourAgo,
        max_results: 100,
        'tweet.fields': 'created_at,public_metrics,entities',
        'user.fields': 'name,username,verified',
        expansions: 'author_id',
      };

      const data = await this.fetchWithAuth('/tweets/search/recent', params);
      const tweets = this.parseTweets(data);

      // Filter for high-engagement or verified accounts
      return tweets.filter(tweet => 
        tweet.public_metrics.retweet_count > 10 ||
        tweet.public_metrics.like_count > 50 ||
        tweet.author_username?.includes('✓')
      );
    } catch (error) {
      console.error('Error getting injury news:', error);
      return [];
    }
  }

  /**
   * Monitor specific team accounts
   */
  async getTeamUpdates(teamHandle: string): Promise<Tweet[]> {
    const teamHandles: Record<string, string> = {
      'chiefs': 'Chiefs',
      'bills': 'BuffaloBills',
      'eagles': 'Eagles',
      'cowboys': 'dallascowboys',
      'packers': 'packers',
      '49ers': '49ers',
      'ravens': 'Ravens',
      'bengals': 'Bengals',
      // Add all 32 teams
    };

    const handle = teamHandles[teamHandle.toLowerCase()] || teamHandle;

    try {
      const userId = await this.getUserId(handle);
      if (!userId) return [];

      const params = {
        max_results: 50,
        'tweet.fields': 'created_at,public_metrics,entities',
        exclude: 'retweets,replies',
      };

      const data = await this.fetchWithAuth(`/users/${userId}/tweets`, params);
      return this.parseTweets(data);
    } catch (error) {
      console.error('Error getting team updates:', error);
      return [];
    }
  }

  /**
   * Get fantasy football trending topics
   */
  async getFantasyTrends(): Promise<string[]> {
    try {
      // Search for trending fantasy football discussions
      const params = {
        query: '(#FantasyFootball OR #FFB OR "fantasy football") -is:retweet',
        max_results: 100,
        'tweet.fields': 'entities',
      };

      const data = await this.fetchWithAuth('/tweets/search/recent', params);
      const tweets = this.parseTweets(data);

      // Extract trending topics
      const topics = new Map<string, number>();
      
      tweets.forEach(tweet => {
        // Extract player names (capitalized words)
        const playerPattern = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
        const matches = tweet.text.match(playerPattern) || [];
        
        matches.forEach(match => {
          if (!this.isCommonPhrase(match)) {
            topics.set(match, (topics.get(match) || 0) + 1);
          }
        });

        // Extract hashtags
        tweet.entities?.hashtags?.forEach(tag => {
          if (tag.tag.toLowerCase() !== 'fantasyfootball' && tag.tag.toLowerCase() !== 'ffb') {
            topics.set(`#${tag.tag}`, (topics.get(`#${tag.tag}`) || 0) + 1);
          }
        });
      });

      // Sort by frequency
      return Array.from(topics.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([topic]) => topic);
    } catch (error) {
      console.error('Error getting fantasy trends:', error);
      return [];
    }
  }

  /**
   * Stream real-time updates (would require filtered stream endpoint)
   */
  async streamPlayerUpdates(players: string[]): Promise<AsyncGenerator<Tweet>> {
    // This would use Twitter's filtered stream API
    // Requires additional setup and different endpoint
    throw new Error('Streaming not implemented - requires filtered stream setup');
  }

  /**
   * Parse tweets from API response
   */
  private parseTweets(data: any): Tweet[] {
    if (!data?.data) return [];

    const users = new Map<string, any>();
    data.includes?.users?.forEach((user: any) => {
      users.set(user.id, user);
    });

    return data.data.map((tweet: any) => {
      const author = users.get(tweet.author_id);
      return {
        id: tweet.id,
        text: tweet.text,
        author_id: tweet.author_id,
        author_name: author?.name,
        author_username: author?.username,
        created_at: tweet.created_at,
        public_metrics: tweet.public_metrics,
        entities: tweet.entities,
        context_annotations: tweet.context_annotations,
      };
    });
  }

  /**
   * Analyze tweets about a player
   */
  private analyzePlayerTweets(tweets: Tweet[], playerName: string): PlayerTweets {
    let positive = 0;
    let negative = 0;
    const topics = new Set<string>();
    let urgency: PlayerTweets['urgency'] = 'normal';

    tweets.forEach(tweet => {
      const text = tweet.text.toLowerCase();
      
      // Sentiment analysis
      if (this.containsPositiveWords(text)) positive++;
      else if (this.containsNegativeWords(text)) negative++;

      // Topic extraction
      if (text.includes('injur')) topics.add('injury');
      if (text.includes('trade')) topics.add('trade');
      if (text.includes('breaking')) topics.add('breaking');
      if (text.includes('sign')) topics.add('signing');
      if (text.includes('practice')) topics.add('practice');

      // Check urgency
      if (text.includes('breaking') || text.includes('just in')) {
        urgency = 'breaking';
      } else if (new Date(tweet.created_at).getTime() > Date.now() - 3600000) {
        urgency = 'recent';
      }
    });

    let sentiment: PlayerTweets['sentiment'] = 'neutral';
    if (positive > negative * 2) sentiment = 'positive';
    else if (negative > positive * 2) sentiment = 'negative';
    else if (positive > 0 && negative > 0) sentiment = 'mixed';

    return {
      player: playerName,
      tweets: tweets.slice(0, 10), // Top 10 most relevant
      sentiment,
      topics: Array.from(topics),
      urgency,
    };
  }

  /**
   * Helper: Get user IDs for handles
   */
  private async getUserIds(handles: string[]): Promise<string[]> {
    try {
      const params = {
        usernames: handles.join(','),
        'user.fields': 'id',
      };

      const data = await this.fetchWithAuth('/users/by', params);
      return data.data?.map((user: any) => user.id) || [];
    } catch (error) {
      console.error('Error getting user IDs:', error);
      return [];
    }
  }

  /**
   * Helper: Get single user ID
   */
  private async getUserId(handle: string): Promise<string | null> {
    const ids = await this.getUserIds([handle]);
    return ids[0] || null;
  }

  /**
   * Helper: Positive word detection
   */
  private containsPositiveWords(text: string): boolean {
    const positiveWords = [
      'great', 'excellent', 'fantastic', 'amazing', 'beast',
      'healthy', 'cleared', 'return', 'practicing', 'full go',
      'breakout', 'career', 'touchdown', 'yards', 'win',
    ];
    return positiveWords.some(word => text.includes(word));
  }

  /**
   * Helper: Negative word detection
   */
  private containsNegativeWords(text: string): boolean {
    const negativeWords = [
      'injury', 'injured', 'hurt', 'out', 'doubtful',
      'questionable', 'limited', 'setback', 'surgery', 'IR',
      'concern', 'struggling', 'benched', 'released', 'cut',
    ];
    return negativeWords.some(word => text.includes(word));
  }

  /**
   * Helper: Filter common phrases
   */
  private isCommonPhrase(phrase: string): boolean {
    const common = [
      'New York', 'San Francisco', 'Los Angeles', 'Kansas City',
      'Monday Night', 'Sunday Night', 'Thursday Night', 'Red Zone',
      'Fantasy Football', 'Breaking News', 'Just In',
    ];
    return common.includes(phrase);
  }
}

// Singleton instance
export const twitterAPI = new TwitterAPI();