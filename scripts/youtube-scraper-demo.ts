#!/usr/bin/env node
import axios from 'axios';
import * as cheerio from 'cheerio';

console.log('📺 YOUTUBE FANTASY SCRAPER DEMO');
console.log('🎯 Showing what we can extract\n');

// Fantasy keywords
const FANTASY_KEYWORDS = {
  positive: ['sleeper', 'breakout', 'start', 'must-start', 'smash play', 'upgrade', 'buy low'],
  negative: ['bust', 'sit', 'bench', 'fade', 'avoid', 'downgrade', 'sell high'],
  injury: ['injury', 'questionable', 'doubtful', 'out', 'limited', 'DNP']
};

async function scrapeYouTubeSearch(searchTerm: string) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
    
    console.log(`🔍 Searching: ${searchTerm}\n`);
    
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
                  if (videoData && videos.length < 5) { // Limit to 5 for demo
                    const video = {
                      videoId: videoData.videoId,
                      title: videoData.title?.runs?.[0]?.text || '',
                      channel: videoData.ownerText?.runs?.[0]?.text,
                      publishedTime: videoData.publishedTimeText?.simpleText,
                      views: videoData.viewCountText?.simpleText,
                      url: `https://www.youtube.com/watch?v=${videoData.videoId}`
                    };
                    videos.push(video);
                  }
                });
              }
            });
          }
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

function extractPlayerNames(text: string): string[] {
  const players = new Set<string>();
  
  // Common NFL player name patterns
  const patterns = [
    /(?:Start|Sit|Add|Drop|Pick up)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g,
    /([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:injury|questionable|doubtful)/gi,
    /([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:\d+ yards|\d+ TDs?)/gi,
    /([A-Z]\.\s*[A-Z][a-z]+)/g // Like "J. Jefferson"
  ];
  
  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 3) {
        players.add(match[1].trim());
      }
    }
  });
  
  return Array.from(players);
}

function analyzeVideo(video: any) {
  const title = video.title;
  const analysis = {
    video: video,
    players: extractPlayerNames(title),
    insights: [] as string[],
    keywords: [] as string[]
  };
  
  // Check for keywords
  const lowerTitle = title.toLowerCase();
  
  FANTASY_KEYWORDS.positive.forEach(keyword => {
    if (lowerTitle.includes(keyword)) {
      analysis.keywords.push(`✅ ${keyword}`);
    }
  });
  
  FANTASY_KEYWORDS.negative.forEach(keyword => {
    if (lowerTitle.includes(keyword)) {
      analysis.keywords.push(`❌ ${keyword}`);
    }
  });
  
  FANTASY_KEYWORDS.injury.forEach(keyword => {
    if (lowerTitle.includes(keyword)) {
      analysis.keywords.push(`🏥 ${keyword}`);
    }
  });
  
  // Extract insights
  if (lowerTitle.includes('waiver')) {
    analysis.insights.push('Waiver wire advice');
  }
  if (lowerTitle.includes('start') || lowerTitle.includes('sit')) {
    analysis.insights.push('Start/Sit recommendations');
  }
  if (lowerTitle.includes('dfs')) {
    analysis.insights.push('DFS lineup advice');
  }
  if (lowerTitle.includes('week')) {
    const weekMatch = lowerTitle.match(/week\s*(\d+)/);
    if (weekMatch) {
      analysis.insights.push(`Week ${weekMatch[1]} content`);
    }
  }
  
  return analysis;
}

async function demo() {
  // Search different fantasy channels
  const searches = [
    'fantasypros nfl week 15',
    'fantasy footballers start sit',
    'nfl fantasy waiver wire',
    'espn fantasy football injuries'
  ];
  
  for (const search of searches) {
    const videos = await scrapeYouTubeSearch(search);
    
    if (videos.length > 0) {
      console.log(`Found ${videos.length} videos:\n`);
      
      videos.forEach((video, index) => {
        const analysis = analyzeVideo(video);
        
        console.log(`${index + 1}. ${video.title}`);
        console.log(`   Channel: ${video.channel}`);
        console.log(`   Views: ${video.views || 'N/A'}`);
        console.log(`   Published: ${video.publishedTime || 'N/A'}`);
        
        if (analysis.players.length > 0) {
          console.log(`   Players: ${analysis.players.join(', ')}`);
        }
        
        if (analysis.keywords.length > 0) {
          console.log(`   Keywords: ${analysis.keywords.join(', ')}`);
        }
        
        if (analysis.insights.length > 0) {
          console.log(`   Insights: ${analysis.insights.join(', ')}`);
        }
        
        console.log(`   URL: ${video.url}\n`);
      });
    } else {
      console.log('No videos found for this search.\n');
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('✅ Demo complete!');
  console.log('\n📝 What we can extract:');
  console.log('- Video titles and metadata');
  console.log('- Player names mentioned');
  console.log('- Fantasy keywords (sleeper, bust, injury, etc.)');
  console.log('- Type of content (waiver, start/sit, DFS)');
  console.log('- Direct YouTube URLs for each video');
  console.log('\n💡 With a database, we could:');
  console.log('- Track player sentiment over time');
  console.log('- Alert on injury news');
  console.log('- Aggregate expert opinions');
  console.log('- Build consensus rankings');
}

// Run demo
demo().catch(console.error);