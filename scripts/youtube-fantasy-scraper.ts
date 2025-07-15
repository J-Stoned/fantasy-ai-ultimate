#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('📺 YOUTUBE FANTASY SPORTS SCRAPER');
console.log('🎯 Collecting insights from top fantasy channels\n');

// YouTube channels to scrape
const FANTASY_CHANNELS = [
  { name: 'FantasyPros', channelId: 'UC7ogIh5Vi7NqHcyN0b0JD6w' },
  { name: 'The Fantasy Footballers', channelId: 'UCxwLHbSJYoHLj7re3OmhQYA' },
  { name: 'ESPN Fantasy', searchTerm: 'ESPN Fantasy Football' },
  { name: 'NFL Fantasy Football', searchTerm: 'NFL Fantasy Football official' }
];

// Player name patterns to extract
const PLAYER_PATTERNS = [
  /([A-Z][a-z]+ [A-Z][a-z]+(?:\s+(?:Jr\.|Sr\.|III|II|IV))?)/g, // Basic player names with suffixes
  /(?:start|sit|bench|play|fade|add|drop|pickup)\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi,
  /([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:injury|questionable|doubtful|out|limited)/gi,
  /([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:\d+\s*(?:yards|touchdowns|catches|receptions|carries|targets))/gi,
  /([A-Z]\.\s*[A-Z][a-z]+\s+[A-Z][a-z]+)/g, // Names like "T. Lawrence"
  /([A-Z][a-z]+\s+[A-Z]'[A-Z][a-z]+)/g // Names with apostrophes like "D'Andre"
];

// Fantasy keywords
const FANTASY_KEYWORDS = {
  positive: ['sleeper', 'breakout', 'start', 'must-start', 'smash play', 'upgrade', 'buy low'],
  negative: ['bust', 'sit', 'bench', 'fade', 'avoid', 'downgrade', 'sell high'],
  injury: ['injury', 'questionable', 'doubtful', 'out', 'limited', 'DNP'],
  stats: ['yards', 'touchdowns', 'receptions', 'targets', 'carries', 'touches']
};

interface VideoInsight {
  video_id: string;
  title: string;
  channel: string;
  published_at: string;
  players_mentioned: string[];
  positive_mentions: string[];
  negative_mentions: string[];
  injury_mentions: string[];
  key_insights: string[];
  url: string;
  metadata: any;
}

// Use YouTube Data API v3 (requires API key)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'YOUR_YOUTUBE_API_KEY';
const youtubeApi = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3',
  params: {
    key: YOUTUBE_API_KEY,
    part: 'snippet',
    maxResults: 25
  }
});

async function searchYouTubeVideos(query: string, channelId?: string) {
  try {
    const params: any = {
      q: query,
      type: 'video',
      order: 'date',
      videoDuration: 'medium' // 4-20 minutes
    };
    
    if (channelId) {
      params.channelId = channelId;
    }
    
    const response = await youtubeApi.get('/search', { params });
    return response.data.items || [];
  } catch (error: any) {
    console.error('YouTube API error:', error.message);
    return [];
  }
}

async function getVideoDetails(videoId: string) {
  try {
    const response = await youtubeApi.get('/videos', {
      params: {
        id: videoId,
        part: 'snippet,contentDetails,statistics'
      }
    });
    
    return response.data.items?.[0];
  } catch (error) {
    return null;
  }
}

// Alternative: Scrape without API
async function scrapeYouTubeSearch(searchTerm: string) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm + ' fantasy sports today')}`;
    
    console.log(`🔍 Searching: ${searchTerm}`);
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const videos: any[] = [];
    
    // Extract video data from page
    const scriptData = $('script').filter((i, el) => {
      return $(el).html()?.includes('var ytInitialData');
    }).html();
    
    if (scriptData) {
      // Parse video data from YouTube's initial data
      const match = scriptData.match(/var ytInitialData = ({.*?});/s);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          
          // Navigate through YouTube's data structure
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
          
          if (contents) {
            contents.forEach((section: any) => {
              const items = section?.itemSectionRenderer?.contents;
              if (items) {
                items.forEach((item: any) => {
                  const videoData = item.videoRenderer;
                  if (videoData) {
                    videos.push({
                      id: { videoId: videoData.videoId },
                      snippet: {
                        title: videoData.title?.runs?.[0]?.text || '',
                        description: videoData.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || '',
                        publishedAt: videoData.publishedTimeText?.simpleText || new Date().toISOString(),
                        channelId: videoData.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
                        channelTitle: videoData.ownerText?.runs?.[0]?.text,
                        thumbnails: {
                          medium: {
                            url: videoData.thumbnail?.thumbnails?.[0]?.url
                          }
                        }
                      }
                    });
                  }
                });
              }
            });
          }
          
          console.log(`Parsed ${videos.length} videos from page`);
        } catch (e) {
          console.error('Failed to parse YouTube data:', e);
        }
      }
    }
    
    return videos;
  } catch (error: any) {
    console.error('Scraping error:', error.message);
    return [];
  }
}

function extractInsights(title: string, description: string = ''): Partial<VideoInsight> {
  const originalText = `${title} ${description}`;
  const lowerText = originalText.toLowerCase();
  const insights: Partial<VideoInsight> = {
    players_mentioned: [],
    positive_mentions: [],
    negative_mentions: [],
    injury_mentions: [],
    key_insights: []
  };
  
  // Extract player names from original text (preserves capitalization)
  const playerSet = new Set<string>();
  PLAYER_PATTERNS.forEach(pattern => {
    const matches = originalText.matchAll(new RegExp(pattern.source, pattern.flags || 'g'));
    for (const match of matches) {
      if (match[1] && match[1].length > 3) { // Filter out very short matches
        const playerName = match[1].trim();
        // Basic validation - should have at least first and last name
        if (playerName.split(/\s+/).length >= 2) {
          playerSet.add(playerName);
        }
      }
    }
  });
  insights.players_mentioned = Array.from(playerSet);
  
  // Extract positive mentions
  FANTASY_KEYWORDS.positive.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      const context = lowerText.match(new RegExp(`[^.]*${keyword}[^.]*`, 'i'));
      if (context) {
        insights.positive_mentions!.push(context[0].trim());
      }
    }
  });
  
  // Extract negative mentions
  FANTASY_KEYWORDS.negative.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      const context = lowerText.match(new RegExp(`[^.]*${keyword}[^.]*`, 'i'));
      if (context) {
        insights.negative_mentions!.push(context[0].trim());
      }
    }
  });
  
  // Extract injury mentions
  FANTASY_KEYWORDS.injury.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      const context = lowerText.match(new RegExp(`[^.]*${keyword}[^.]*`, 'i'));
      if (context) {
        insights.injury_mentions!.push(context[0].trim());
      }
    }
  });
  
  // Key insights (simplified)
  if (lowerText.includes('waiver') || lowerText.includes('pickup')) {
    insights.key_insights!.push('Waiver wire recommendations');
  }
  if (lowerText.includes('start') && lowerText.includes('sit')) {
    insights.key_insights!.push('Start/Sit advice');
  }
  if (lowerText.includes('trade')) {
    insights.key_insights!.push('Trade recommendations');
  }
  if (lowerText.includes('dfs') || lowerText.includes('daily')) {
    insights.key_insights!.push('DFS advice');
  }
  
  return insights;
}

async function processAndStoreVideo(video: any, channel: string) {
  const videoId = typeof video.id === 'string' ? video.id : video.id?.videoId;
  if (!videoId) return;
  
  const snippet = video.snippet;
  const insights = extractInsights(snippet.title, snippet.description);
  
  const videoInsight: VideoInsight = {
    video_id: videoId,
    title: snippet.title,
    channel: channel,
    published_at: snippet.publishedAt,
    players_mentioned: insights.players_mentioned || [],
    positive_mentions: insights.positive_mentions || [],
    negative_mentions: insights.negative_mentions || [],
    injury_mentions: insights.injury_mentions || [],
    key_insights: insights.key_insights || [],
    url: `https://www.youtube.com/watch?v=${videoId}`,
    metadata: {
      thumbnail: snippet.thumbnails?.medium?.url,
      channel_id: snippet.channelId,
      tags: snippet.tags || []
    }
  };
  
  // Store in database
  const { error } = await supabase
    .from('youtube_fantasy_insights')
    .upsert(videoInsight, { onConflict: 'video_id' });
    
  if (error) {
    console.error('Database error:', error.message);
  } else {
    console.log(`✅ Saved: ${snippet.title.substring(0, 60)}...`);
  }
  
  return videoInsight;
}

async function createYouTubeTable() {
  console.log('📋 YouTube insights table schema:\n');
  console.log(`
CREATE TABLE IF NOT EXISTS youtube_fantasy_insights (
  id SERIAL PRIMARY KEY,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  channel TEXT,
  published_at TIMESTAMP,
  players_mentioned TEXT[],
  positive_mentions TEXT[],
  negative_mentions TEXT[],
  injury_mentions TEXT[],
  key_insights TEXT[],
  url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_youtube_video_id ON youtube_fantasy_insights(video_id);
CREATE INDEX idx_youtube_published ON youtube_fantasy_insights(published_at DESC);
CREATE INDEX idx_youtube_players ON youtube_fantasy_insights USING GIN(players_mentioned);
  `);
}

async function scrapeFantasyYouTube() {
  if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
    console.log('⚠️  Using web scraping mode (no API key)');
    console.log('For better results:');
    console.log('1. Get YouTube Data API key: https://console.cloud.google.com');
    console.log('2. Set YOUTUBE_API_KEY environment variable\n');
  }
  
  await createYouTubeTable();
  
  let totalVideos = 0;
  let totalInsights = 0;
  
  // Search each channel
  for (const channel of FANTASY_CHANNELS) {
    console.log(`\n📺 Searching ${channel.name}...`);
    
    let videos = [];
    
    if (YOUTUBE_API_KEY !== 'YOUR_YOUTUBE_API_KEY') {
      // Use API
      const searchQuery = channel.searchTerm || 'fantasy football week';
      videos = await searchYouTubeVideos(searchQuery, channel.channelId);
    } else {
      // Use scraping
      videos = await scrapeYouTubeSearch(channel.searchTerm || channel.name);
    }
    
    console.log(`Found ${videos.length} videos`);
    
    for (const video of videos) {
      const result = await processAndStoreVideo(video, channel.name);
      if (result) {
        totalVideos++;
        totalInsights += result.key_insights.length;
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log('\n✅ YOUTUBE SCRAPING COMPLETE!\n');
  console.log(`📺 Total videos processed: ${totalVideos}`);
  console.log(`💡 Total insights found: ${totalInsights}`);
  
  // Show sample insights
  const { data: samples } = await supabase
    .from('youtube_fantasy_insights')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(5);
    
  if (samples && samples.length > 0) {
    console.log('\n📝 Latest insights:');
    samples.forEach((video, i) => {
      console.log(`\n${i + 1}. ${video.title}`);
      console.log(`   Players: ${video.players_mentioned.slice(0, 3).join(', ')}`);
      console.log(`   Insights: ${video.key_insights.join(', ')}`);
    });
  }
}

// Utility functions
export async function searchPlayerMentions(playerName: string) {
  const { data } = await supabase
    .from('youtube_fantasy_insights')
    .select('*')
    .contains('players_mentioned', [playerName])
    .order('published_at', { ascending: false })
    .limit(10);
    
  return data;
}

export async function getLatestFantasyVideos(limit = 20) {
  const { data } = await supabase
    .from('youtube_fantasy_insights')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);
    
  return data;
}

export async function getInjuryNews() {
  const { data } = await supabase
    .from('youtube_fantasy_insights')
    .select('*')
    .gt('injury_mentions', '{}') // Has injury mentions
    .order('published_at', { ascending: false })
    .limit(20);
    
  return data;
}

// Main
async function main() {
  try {
    require('cheerio');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install cheerio', { stdio: 'inherit' });
  }
  
  await scrapeFantasyYouTube();
}

if (require.main === module) {
  main().catch(console.error);
}