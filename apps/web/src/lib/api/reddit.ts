/**
 * Reddit API Integration
 * 
 * Scrapes sports subreddits for sentiment analysis
 * No API key required for public data!
 */

import { redis } from '@/lib/redis';

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'FantasyAI/1.0';
const CACHE_TTL = 600; // 10 minute cache

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  selftext: string;
  url: string;
  flair?: string;
}

export interface PlayerSentiment {
  player: string;
  mentions: number;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics: string[];
  score: number; // -1 to 1
}

export class RedditAPI {
  private async fetchSubreddit(subreddit: string, sort: string = 'hot', limit: number = 25): Promise<any> {
    const cacheKey = `reddit:${subreddit}:${sort}:${limit}`;
    
    // Check cache
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from Reddit
    const url = `${REDDIT_BASE}/r/${subreddit}/${sort}.json?limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache result
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get hot posts from NFL subreddit
   */
  async getNFLPosts(sort: string = 'hot'): Promise<RedditPost[]> {
    const data = await this.fetchSubreddit('nfl', sort);
    return this.parsePosts(data);
  }

  /**
   * Get posts from fantasy football subreddit
   */
  async getFantasyFootballPosts(sort: string = 'hot'): Promise<RedditPost[]> {
    const data = await this.fetchSubreddit('fantasyfootball', sort);
    return this.parsePosts(data);
  }

  /**
   * Get posts from team-specific subreddit
   */
  async getTeamPosts(team: string, sort: string = 'hot'): Promise<RedditPost[]> {
    // Map team names to subreddit names
    const teamSubs: Record<string, string> = {
      'chiefs': 'KansasCityChiefs',
      'bills': 'buffalobills',
      'eagles': 'eagles',
      'cowboys': 'cowboys',
      'packers': 'GreenBayPackers',
      '49ers': '49ers',
      // Add more mappings
    };

    const sub = teamSubs[team.toLowerCase()] || team;
    const data = await this.fetchSubreddit(sub, sort);
    return this.parsePosts(data);
  }

  /**
   * Search for player mentions
   */
  async searchPlayer(playerName: string, limit: number = 50): Promise<RedditPost[]> {
    const query = encodeURIComponent(playerName);
    const url = `${REDDIT_BASE}/r/fantasyfootball/search.json?q=${query}&restrict_sr=on&sort=new&limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return this.parsePosts(data);
  }

  /**
   * Get player sentiment analysis
   */
  async getPlayerSentiment(playerName: string): Promise<PlayerSentiment> {
    const posts = await this.searchPlayer(playerName, 100);
    
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    const topics: string[] = [];

    posts.forEach(post => {
      const text = (post.title + ' ' + post.selftext).toLowerCase();
      
      // Simple sentiment analysis
      if (this.containsPositiveWords(text)) positive++;
      else if (this.containsNegativeWords(text)) negative++;
      else neutral++;

      // Extract topics
      if (text.includes('injur')) topics.push('injury');
      if (text.includes('trade')) topics.push('trade');
      if (text.includes('breakout')) topics.push('breakout');
      if (text.includes('bust')) topics.push('bust');
      if (text.includes('start')) topics.push('start/sit');
    });

    const total = positive + negative + neutral;
    const score = total > 0 ? (positive - negative) / total : 0;

    let sentiment: PlayerSentiment['sentiment'] = 'neutral';
    if (score > 0.2) sentiment = 'positive';
    else if (score < -0.2) sentiment = 'negative';
    else if (positive > 0 && negative > 0) sentiment = 'mixed';

    return {
      player: playerName,
      mentions: posts.length,
      sentiment,
      topics: [...new Set(topics)],
      score,
    };
  }

  /**
   * Get injury rumors
   */
  async getInjuryRumors(): Promise<RedditPost[]> {
    const data = await this.fetchSubreddit('fantasyfootball', 'new', 50);
    const posts = this.parsePosts(data);
    
    return posts.filter(post => {
      const text = (post.title + ' ' + post.selftext).toLowerCase();
      return text.includes('injur') || 
             text.includes('questionable') ||
             text.includes('doubtful') ||
             text.includes('out') ||
             text.includes('limited');
    });
  }

  /**
   * Get trade rumors
   */
  async getTradeRumors(): Promise<RedditPost[]> {
    const data = await this.fetchSubreddit('nfl', 'new', 50);
    const posts = this.parsePosts(data);
    
    return posts.filter(post => {
      const text = (post.title + ' ' + post.selftext).toLowerCase();
      return text.includes('trade') || 
             text.includes('deal') ||
             text.includes('acquire') ||
             text.includes('rumor');
    });
  }

  /**
   * Parse Reddit posts
   */
  private parsePosts(data: any): RedditPost[] {
    if (!data.data?.children) return [];

    return data.data.children
      .filter((child: any) => child.kind === 't3')
      .map((child: any) => ({
        id: child.data.id,
        title: child.data.title,
        author: child.data.author,
        score: child.data.score,
        num_comments: child.data.num_comments,
        created_utc: child.data.created_utc,
        selftext: child.data.selftext || '',
        url: child.data.url,
        flair: child.data.link_flair_text,
      }));
  }

  /**
   * Simple positive word detection
   */
  private containsPositiveWords(text: string): boolean {
    const positiveWords = [
      'great', 'awesome', 'excellent', 'beast', 'stud',
      'breakout', 'boom', 'upside', 'sleeper', 'steal',
      'dominate', 'elite', 'top', 'best', 'fire',
      'league winner', 'must start', 'smash play'
    ];
    
    return positiveWords.some(word => text.includes(word));
  }

  /**
   * Simple negative word detection
   */
  private containsNegativeWords(text: string): boolean {
    const negativeWords = [
      'bust', 'avoid', 'terrible', 'awful', 'bad',
      'injury', 'injured', 'doubtful', 'out', 'benched',
      'struggling', 'fade', 'sit', 'drop', 'droppable',
      'concern', 'worried', 'decline', 'regression'
    ];
    
    return negativeWords.some(word => text.includes(word));
  }

  /**
   * Get trending players
   */
  async getTrendingPlayers(): Promise<string[]> {
    const posts = await this.getFantasyFootballPosts('hot');
    const playerMentions: Record<string, number> = {};

    // Common NFL player name patterns
    const playerPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;

    posts.forEach(post => {
      const text = post.title + ' ' + post.selftext;
      const matches = text.match(playerPattern) || [];
      
      matches.forEach(match => {
        // Filter out common non-player phrases
        if (!this.isCommonPhrase(match)) {
          playerMentions[match] = (playerMentions[match] || 0) + 1;
        }
      });
    });

    // Sort by mention count
    return Object.entries(playerMentions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([player]) => player);
  }

  /**
   * Filter out common non-player phrases
   */
  private isCommonPhrase(phrase: string): boolean {
    const common = [
      'New York', 'San Francisco', 'Los Angeles', 'Kansas City',
      'Green Bay', 'New England', 'Las Vegas', 'Tampa Bay',
      'Fantasy Football', 'NFL RedZone', 'Monday Night',
      'Sunday Night', 'Thursday Night'
    ];
    
    return common.includes(phrase);
  }
}

// Singleton instance
export const redditAPI = new RedditAPI();