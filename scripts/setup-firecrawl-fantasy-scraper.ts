#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Firecrawl API setup
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'YOUR_FIRECRAWL_API_KEY';
const firecrawlApi = axios.create({
  baseURL: 'https://api.firecrawl.dev/v0',
  headers: {
    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🔥 FIRECRAWL FANTASY SPORTS SCRAPER');
console.log('📺 Scraping YouTube & Podcasts for Fantasy Insights\n');

// Target sources for fantasy sports content
const FANTASY_SOURCES = {
  youtube_channels: [
    'https://www.youtube.com/@FantasyPros',
    'https://www.youtube.com/@TheFantasyFootballers',
    'https://www.youtube.com/@ESPN',
    'https://www.youtube.com/@NFLFantasy',
    'https://www.youtube.com/@FantasyBaseballToday',
    'https://www.youtube.com/@LockedOnFantasyFootball'
  ],
  
  podcast_sites: [
    'https://www.fantasypros.com/nfl/podcast/',
    'https://thefantasyfootballers.com/episodes/',
    'https://establishtherun.com/category/podcasts/',
    'https://www.rotoworld.com/podcast',
    'https://www.espn.com/fantasy/football/story/_/page/podcast'
  ],
  
  expert_sites: [
    'https://www.fantasypros.com/nfl/rankings/',
    'https://www.rotoballer.com/',
    'https://www.4for4.com/',
    'https://fantasydata.com/',
    'https://www.thescore.com/news'
  ]
};

// Keywords to look for in content
const FANTASY_KEYWORDS = [
  'sleeper', 'bust', 'waiver wire', 'start sit', 'dfs', 'daily fantasy',
  'injury report', 'player news', 'trade', 'rankings', 'projections',
  'breakout', 'regression', 'targets', 'usage', 'snap count', 'red zone',
  'touchdown', 'yards', 'receptions', 'carries', 'opportunities'
];

interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  metadata: any;
  extracted_insights: string[];
  scraped_at: Date;
}

async function scrapeWithFirecrawl(url: string, options = {}) {
  try {
    console.log(`🔍 Scraping: ${url}`);
    
    const response = await firecrawlApi.post('/scrape', {
      url,
      ...options,
      // Extract specific content
      extractorOptions: {
        mode: 'llm-extraction',
        extractionPrompt: `Extract the following from this fantasy sports content:
          1. Player names mentioned
          2. Injury updates
          3. Start/sit recommendations
          4. Statistical insights
          5. Trade advice
          6. Waiver wire pickups
          7. Key quotes from experts
          Format as JSON with these fields.`,
        extractionSchema: {
          players: ['string'],
          injuries: ['string'],
          recommendations: ['string'],
          stats: ['string'],
          trades: ['string'],
          waivers: ['string'],
          quotes: ['string']
        }
      },
      pageOptions: {
        includeHtml: false,
        onlyMainContent: true,
        waitFor: 2000
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error(`❌ Error scraping ${url}:`, error.message);
    return null;
  }
}

async function scrapeYouTubeTranscript(videoUrl: string) {
  // YouTube video URLs need special handling
  const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?]*)/)?.[1];
  
  if (!videoId) {
    console.error('Invalid YouTube URL');
    return null;
  }
  
  // You can use youtube-transcript library or scrape the transcript
  console.log(`📺 Extracting transcript for video: ${videoId}`);
  
  // For now, scrape the video page
  return await scrapeWithFirecrawl(videoUrl, {
    pageOptions: {
      includeHtml: true,
      waitFor: 3000
    }
  });
}

async function processAndStore(scrapedData: any, source: string) {
  if (!scrapedData || !scrapedData.data) return;
  
  const content = scrapedData.data;
  
  // Extract insights using keywords
  const insights: string[] = [];
  const text = content.markdown || content.content || '';
  
  FANTASY_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`[^.]*${keyword}[^.]*\\.`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      insights.push(...matches.slice(0, 3)); // Top 3 mentions
    }
  });
  
  // Store in database
  const record: ScrapedContent = {
    url: content.url || source,
    title: content.title || 'Untitled',
    content: text.substring(0, 5000), // Limit content size
    metadata: {
      source_type: source.includes('youtube') ? 'youtube' : 'podcast',
      extracted_data: content.llm_extraction || {},
      word_count: text.split(' ').length,
      keywords_found: insights.length
    },
    extracted_insights: insights,
    scraped_at: new Date()
  };
  
  // Save to Supabase
  const { error } = await supabase
    .from('fantasy_content_scrapes')
    .insert(record);
    
  if (error) {
    console.error('Error saving to database:', error);
  } else {
    console.log(`✅ Saved: ${record.title}`);
  }
  
  return record;
}

async function scrapeFantasySources() {
  console.log('🚀 Starting fantasy content scraping...\n');
  
  // First, create the table if it doesn't exist
  await createScrapingTable();
  
  let totalScraped = 0;
  let totalInsights = 0;
  
  // Scrape YouTube channels
  console.log('📺 SCRAPING YOUTUBE CHANNELS:\n');
  for (const channel of FANTASY_SOURCES.youtube_channels) {
    const data = await scrapeWithFirecrawl(channel);
    if (data) {
      const processed = await processAndStore(data, channel);
      if (processed) {
        totalScraped++;
        totalInsights += processed.extracted_insights.length;
      }
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Scrape podcast sites
  console.log('\n🎙️ SCRAPING PODCAST SITES:\n');
  for (const site of FANTASY_SOURCES.podcast_sites) {
    const data = await scrapeWithFirecrawl(site);
    if (data) {
      const processed = await processAndStore(data, site);
      if (processed) {
        totalScraped++;
        totalInsights += processed.extracted_insights.length;
      }
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Summary
  console.log('\n✅ SCRAPING COMPLETE!\n');
  console.log(`📊 Total sources scraped: ${totalScraped}`);
  console.log(`💡 Total insights extracted: ${totalInsights}`);
  console.log(`\n🔍 Check the 'fantasy_content_scrapes' table for results!`);
}

async function createScrapingTable() {
  // This would normally be done in Supabase dashboard
  console.log('📋 Ensuring scraping table exists...\n');
  
  // For now, just document the schema
  console.log('Required table schema:');
  console.log(`
CREATE TABLE IF NOT EXISTS fantasy_content_scrapes (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  metadata JSONB,
  extracted_insights TEXT[],
  scraped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fantasy_scrapes_url ON fantasy_content_scrapes(url);
CREATE INDEX idx_fantasy_scrapes_scraped_at ON fantasy_content_scrapes(scraped_at);
  `);
}

// Example: Scrape specific YouTube video
async function scrapeYouTubeVideo(url: string) {
  console.log(`\n🎥 Scraping specific YouTube video: ${url}\n`);
  
  const data = await scrapeYouTubeTranscript(url);
  if (data) {
    const processed = await processAndStore(data, url);
    if (processed) {
      console.log('\n📝 Extracted insights:');
      processed.extracted_insights.forEach((insight, i) => {
        console.log(`${i + 1}. ${insight}`);
      });
    }
  }
}

// Main execution
async function main() {
  if (FIRECRAWL_API_KEY === 'YOUR_FIRECRAWL_API_KEY') {
    console.log('⚠️  Please set your Firecrawl API key!');
    console.log('1. Sign up at https://firecrawl.dev');
    console.log('2. Get your API key');
    console.log('3. Set FIRECRAWL_API_KEY environment variable\n');
    return;
  }
  
  // Run the scraper
  await scrapeFantasySources();
  
  // Example: Scrape a specific video
  // await scrapeYouTubeVideo('https://www.youtube.com/watch?v=EXAMPLE');
}

// Additional utility functions
export async function searchFantasyContent(query: string) {
  const { data } = await supabase
    .from('fantasy_content_scrapes')
    .select('*')
    .textSearch('content', query)
    .limit(10);
    
  return data;
}

export async function getLatestInsights(limit = 20) {
  const { data } = await supabase
    .from('fantasy_content_scrapes')
    .select('*')
    .order('scraped_at', { ascending: false })
    .limit(limit);
    
  return data;
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}