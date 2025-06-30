import { supabase } from '../../supabase/client';
import axios from 'axios';
import { cronLogger } from '../../utils/logger';

interface NewsArticle {
  title: string;
  summary: string;
  content: string;
  source: string;
  url: string;
  author?: string;
  published_at: string;
  players_mentioned: string[];
  teams_mentioned: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  category: 'injury' | 'trade' | 'performance' | 'general';
}

export class NewsCollector {
  private newsApiKey: string | undefined;

  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY;
  }

  async collectSportsNews() {
    cronLogger.info('Collecting sports news');
    
    try {
      const articles = await this.getMockNewsArticles();
      
      for (const article of articles) {
        // Extract player and team mentions
        const mentions = await this.extractMentions(article.content);
        
        await supabase
          .from('news_articles')
          .upsert({
            title: article.title,
            summary: article.summary,
            content: article.content,
            source: article.source,
            url: article.url,
            author: article.author,
            published_at: article.published_at,
            players_mentioned: mentions.players,
            teams_mentioned: mentions.teams,
            sentiment: article.sentiment,
            category: article.category,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'url',
          });
      }
      
      cronLogger.info('Collected news articles', { count: articles.length });
    } catch (error) {
      cronLogger.error('News collection failed', error);
      throw error;
    }
  }

  async collectSocialMentions() {
    cronLogger.info('Collecting social media mentions');
    
    try {
      const mentions = await this.getMockSocialMentions();
      
      for (const mention of mentions) {
        await supabase
          .from('social_mentions')
          .upsert({
            player_id: mention.player_id,
            platform: mention.platform,
            content: mention.content,
            author: mention.author,
            url: mention.url,
            engagement_score: mention.engagement_score,
            sentiment: mention.sentiment,
            posted_at: mention.posted_at,
          }, {
            onConflict: 'url',
          });
      }
      
      cronLogger.info('Collected social mentions', { count: mentions.length });
    } catch (error) {
      cronLogger.error('Social mention collection failed', error);
      throw error;
    }
  }

  private async extractMentions(content: string): Promise<{ players: string[], teams: string[] }> {
    // Get all players and teams from database
    const { data: players } = await supabase
      .from('players')
      .select('id, full_name')
      .limit(1000); // For performance

    const { data: teams } = await supabase
      .from('teams_master')
      .select('id, name, city');

    const playerMentions: string[] = [];
    const teamMentions: string[] = [];

    // Simple mention extraction (in production, use NLP)
    if (players) {
      for (const player of players) {
        if (content.toLowerCase().includes(player.full_name.toLowerCase())) {
          playerMentions.push(player.id);
        }
      }
    }

    if (teams) {
      for (const team of teams) {
        if (content.toLowerCase().includes(team.name.toLowerCase()) ||
            content.toLowerCase().includes(`${team.city} ${team.name}`.toLowerCase())) {
          teamMentions.push(team.id);
        }
      }
    }

    return { players: playerMentions, teams: teamMentions };
  }

  private async getMockNewsArticles(): Promise<NewsArticle[]> {
    return [
      {
        title: 'Star Quarterback Returns from Injury',
        summary: 'Team gets major boost as franchise QB is cleared to play',
        content: 'The New England Patriots received great news today as their star quarterback has been cleared to return from injury. The team has struggled in his absence...',
        source: 'ESPN',
        url: 'https://example.com/article1',
        author: 'John Smith',
        published_at: new Date().toISOString(),
        players_mentioned: [],
        teams_mentioned: [],
        sentiment: 'positive',
        category: 'injury',
      },
      {
        title: 'Trade Deadline Buzz: Big Names on the Move',
        summary: 'Multiple star players could be traded before the deadline',
        content: 'As the trade deadline approaches, several big names are rumored to be available. The Lakers and Celtics are both active in discussions...',
        source: 'The Athletic',
        url: 'https://example.com/article2',
        author: 'Jane Doe',
        published_at: new Date().toISOString(),
        players_mentioned: [],
        teams_mentioned: [],
        sentiment: 'neutral',
        category: 'trade',
      },
    ];
  }

  private async getMockSocialMentions() {
    return [
      {
        player_id: 'player-001',
        platform: 'twitter',
        content: 'Amazing performance tonight! 300+ yards and 3 TDs 🔥',
        author: '@sportsfan123',
        url: 'https://twitter.com/example/status/123',
        engagement_score: 1500,
        sentiment: 'positive',
        posted_at: new Date().toISOString(),
      },
      {
        player_id: 'nba-player-001',
        platform: 'instagram',
        content: 'Triple-double alert! What a game! 🏀',
        author: 'nbafanpage',
        url: 'https://instagram.com/p/abc123',
        engagement_score: 3200,
        sentiment: 'positive',
        posted_at: new Date().toISOString(),
      },
    ];
  }
}