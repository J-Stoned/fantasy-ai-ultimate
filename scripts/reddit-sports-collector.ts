import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Reddit doesn't require authentication for public read-only access
const REDDIT_BASE_URL = 'https://www.reddit.com';

// Popular sports subreddits
const SPORTS_SUBREDDITS = [
  'nba',
  'nfl', 
  'baseball',
  'hockey',
  'soccer',
  'mma',
  'boxing',
  'tennis',
  'golf',
  'olympics',
  'sports',
  'fantasyfootball',
  'fantasybball',
  'fantasybaseball',
  'sportsbook',
  'sportsbetting'
];

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    created_utc: number;
    score: number;
    num_comments: number;
    subreddit: string;
    url: string;
    permalink: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
    after?: string;
  };
}

let stats = {
  posts: 0,
  comments: 0,
  insights: 0,
  errors: 0,
  runtime: Date.now()
};

async function collectSubredditPosts(subreddit: string, after?: string) {
  try {
    const url = `${REDDIT_BASE_URL}/r/${subreddit}/hot.json?limit=100${after ? `&after=${after}` : ''}`;
    
    const response = await axios.get<RedditResponse>(url, {
      headers: {
        'User-Agent': 'Fantasy AI Ultimate Data Collector 1.0'
      }
    });

    const posts = response.data.data.children;
    const newsArticles = [];
    const insights = [];

    for (const post of posts) {
      const { data } = post;
      
      // Skip posts that are too short or likely not sports content
      if (data.title.length < 10) continue;

      // Store as news article
      newsArticles.push({
        external_id: `reddit_${data.id}`,
        title: data.title,
        content: data.selftext || data.title,
        summary: `${data.title.substring(0, 200)}...`,
        author: data.author,
        source: `r/${data.subreddit}`,
        url: `https://reddit.com${data.permalink}`,
        published_at: new Date(data.created_utc * 1000).toISOString(),
        sentiment_score: calculateSentiment(data.title + ' ' + data.selftext),
        metadata: {
          score: data.score,
          comments: data.num_comments,
          subreddit: data.subreddit
        }
      });

      // Create insight from high-engagement posts
      if (data.score > 100 || data.num_comments > 50) {
        insights.push({
          type: 'reddit_trending',
          content: `Popular discussion on r/${data.subreddit}: "${data.title}" with ${data.score} upvotes and ${data.num_comments} comments`,
          confidence: Math.min(0.9, (data.score + data.num_comments) / 1000),
          source: 'reddit',
          metadata: {
            post_id: data.id,
            engagement: data.score + data.num_comments
          }
        });
      }
    }

    // Insert news articles
    if (newsArticles.length > 0) {
      const { error } = await supabase
        .from('news_articles')
        .upsert(newsArticles, { onConflict: 'external_id' });
      
      if (error) throw error;
      stats.posts += newsArticles.length;
    }

    // Insert insights
    if (insights.length > 0) {
      const { error } = await supabase
        .from('ai_insights')
        .insert(insights);
      
      if (error) throw error;
      stats.insights += insights.length;
    }

    return response.data.data.after; // For pagination
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log(chalk.yellow(`Rate limited on r/${subreddit}, waiting...`));
      await delay(60000); // Wait 1 minute
    } else {
      console.error(chalk.red(`Error collecting from r/${subreddit}:`, error.message));
      stats.errors++;
    }
    return null;
  }
}

async function collectComments(subreddit: string, postId: string) {
  try {
    const url = `${REDDIT_BASE_URL}/r/${subreddit}/comments/${postId}.json?limit=100`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Fantasy AI Ultimate Data Collector 1.0'
      }
    });

    const comments = response.data[1]?.data?.children || [];
    const insights = [];

    for (const comment of comments) {
      if (comment.kind !== 't1') continue;
      const { data } = comment;
      
      // Skip deleted/removed comments
      if (!data.body || data.body === '[deleted]' || data.body === '[removed]') continue;

      // Look for highly upvoted comments as insights
      if (data.score > 50) {
        insights.push({
          type: 'reddit_comment',
          content: data.body.substring(0, 500),
          confidence: Math.min(0.8, data.score / 100),
          source: 'reddit_comments',
          metadata: {
            comment_id: data.id,
            post_id: postId,
            score: data.score
          }
        });
        stats.comments++;
      }
    }

    if (insights.length > 0) {
      const { error } = await supabase
        .from('ai_insights')
        .insert(insights);
      
      if (error) throw error;
    }
  } catch (error: any) {
    // Silently skip comment errors - they're less critical
  }
}

function calculateSentiment(text: string): number {
  // Simple sentiment calculation based on keywords
  const positive = ['great', 'amazing', 'excellent', 'win', 'victory', 'best', 'champion', 'success'];
  const negative = ['bad', 'terrible', 'loss', 'fail', 'worst', 'injury', 'suspended', 'controversy'];
  
  const lowerText = text.toLowerCase();
  let score = 0;
  
  positive.forEach(word => {
    if (lowerText.includes(word)) score += 0.1;
  });
  
  negative.forEach(word => {
    if (lowerText.includes(word)) score -= 0.1;
  });
  
  return Math.max(-1, Math.min(1, score));
}

async function displayStats() {
  const runtime = Math.floor((Date.now() - stats.runtime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;
  
  console.clear();
  console.log(chalk.bold.cyan('\n🌐 REDDIT SPORTS COLLECTOR'));
  console.log(chalk.gray('=' .repeat(30)));
  console.log(chalk.white(`\n⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.yellow(`📊 Collection rate: ${Math.floor(stats.posts / (runtime || 1))} posts/sec`));
  
  console.log(chalk.white('\n📈 Stats:'));
  console.log(chalk.green(`  📝 Posts: ${stats.posts.toLocaleString()}`));
  console.log(chalk.blue(`  💬 Comments: ${stats.comments.toLocaleString()}`));
  console.log(chalk.magenta(`  💡 Insights: ${stats.insights.toLocaleString()}`));
  console.log(chalk.red(`  ❌ Errors: ${stats.errors}`));
  
  console.log(chalk.yellow(`\n🔥 Total collected: ${(stats.posts + stats.insights).toLocaleString()}`));
  
  console.log(chalk.gray('\n📡 Monitoring Reddit for sports content...'));
}

async function collectAllSubreddits() {
  console.log(chalk.green('🚀 Starting Reddit sports collection...'));
  
  // Continuous collection
  while (true) {
    for (const subreddit of SPORTS_SUBREDDITS) {
      // Collect hot posts
      await collectSubredditPosts(subreddit);
      
      // Small delay between subreddits
      await delay(2000);
      
      displayStats();
    }
    
    // Wait before next cycle
    console.log(chalk.gray('\n⏳ Waiting 5 minutes before next cycle...'));
    await delay(300000); // 5 minutes
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down Reddit collector...'));
  displayStats();
  process.exit(0);
});

// Start collection
collectAllSubreddits().catch(console.error);