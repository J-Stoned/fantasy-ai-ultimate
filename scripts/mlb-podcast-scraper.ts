#!/usr/bin/env node
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('⚾ MLB PODCAST & CONTENT SCRAPER');
console.log('🎙️ Collecting fantasy baseball insights\n');

// MLB Fantasy sources
const MLB_SOURCES = {
  youtube_searches: [
    'fantasy baseball waiver wire today',
    'MLB fantasy baseball advice',
    'fantasy baseball sleepers 2025',
    'MLB DFS picks today',
    'fantasy baseball injury report',
    'rotoballer fantasy baseball',
    'pitcher list fantasy baseball',
    'CBS fantasy baseball today'
  ],
  
  podcast_channels: [
    'Fantasy Baseball Today',
    'Rotoballer Fantasy Baseball',
    'Pitcher List',
    'Razzball Fantasy Baseball',
    'The Athletic Fantasy Baseball'
  ],
  
  player_keywords: [
    'call up', 'promoted', 'demoted', 'injured', 'IL', 'DTD',
    'hot streak', 'slumping', 'breakout', 'must add', 'drop',
    'streaming', 'two-start', 'saves', 'holds', 'closer'
  ]
};

// MLB player name patterns
const MLB_PLAYER_PATTERNS = [
  /([A-Z][a-z]+ [A-Z][a-z]+(?:\s+(?:Jr\.|Sr\.|III|II))?)/g,
  /(?:add|drop|stream|start|sit|bench)\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi,
  /([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:homer|homered|went|struck out)/gi,
  /([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:\d+[-\/]\d+|\d+ for \d+)/gi, // batting stats
  /([A-Z][a-z]+ [A-Z][a-z]+)\s+(?:\d+ K|[0-9.]+ ERA|[0-9.]+ WHIP)/gi, // pitching stats
  /([A-Z]\.\s?[A-Z][a-z]+)/g // Like "M. Betts" or "R. Acuna"
];

interface MLBContent {
  source: string;
  title: string;
  type: 'youtube' | 'podcast' | 'article';
  url: string;
  published: string;
  channel?: string;
  players_mentioned: string[];
  insights: string[];
  stats_mentioned: string[];
  recommendations: string[];
}

async function scrapeYouTubeMLB(searchTerm: string): Promise<MLBContent[]> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
    console.log(`🔍 Searching: ${searchTerm}`);
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const content: MLBContent[] = [];
    
    // Extract video data
    const scriptData = $('script').filter((i, el) => {
      return $(el).html()?.includes('var ytInitialData');
    }).html();
    
    if (scriptData) {
      const match = scriptData.match(/var ytInitialData = ({.*?});/s);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
          
          if (contents) {
            contents.forEach((section: any) => {
              const items = section?.itemSectionRenderer?.contents;
              if (items) {
                items.forEach((item: any) => {
                  const videoData = item.videoRenderer;
                  if (videoData && content.length < 5) {
                    const title = videoData.title?.runs?.[0]?.text || '';
                    const mlbContent: MLBContent = {
                      source: 'YouTube',
                      title: title,
                      type: 'youtube',
                      url: `https://www.youtube.com/watch?v=${videoData.videoId}`,
                      published: videoData.publishedTimeText?.simpleText || 'Unknown',
                      channel: videoData.ownerText?.runs?.[0]?.text,
                      players_mentioned: extractMLBPlayers(title),
                      insights: extractMLBInsights(title),
                      stats_mentioned: extractStats(title),
                      recommendations: extractRecommendations(title)
                    };
                    content.push(mlbContent);
                  }
                });
              }
            });
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
    
    return content;
  } catch (error) {
    console.error('Scraping error:', error);
    return [];
  }
}

function extractMLBPlayers(text: string): string[] {
  const players = new Set<string>();
  const originalText = text;
  
  MLB_PLAYER_PATTERNS.forEach(pattern => {
    const matches = originalText.matchAll(new RegExp(pattern.source, pattern.flags || 'g'));
    for (const match of matches) {
      if (match[1] && match[1].length > 3) {
        const playerName = match[1].trim();
        // Basic validation
        if (playerName.split(/\s+/).length >= 2 || playerName.includes('.')) {
          players.add(playerName);
        }
      }
    }
  });
  
  return Array.from(players);
}

function extractMLBInsights(text: string): string[] {
  const insights: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Check for specific MLB insights
  if (lowerText.includes('waiver')) {
    insights.push('Waiver wire targets');
  }
  if (lowerText.includes('stream')) {
    insights.push('Streaming options');
  }
  if (lowerText.includes('two-start') || lowerText.includes('2-start')) {
    insights.push('Two-start pitchers');
  }
  if (lowerText.includes('call up') || lowerText.includes('callup') || lowerText.includes('promoted')) {
    insights.push('Prospect call-ups');
  }
  if (lowerText.includes('closer') || lowerText.includes('saves')) {
    insights.push('Closer updates');
  }
  if (lowerText.includes('dfs') || lowerText.includes('daily')) {
    insights.push('DFS recommendations');
  }
  if (lowerText.includes('injury') || lowerText.includes(' il ') || lowerText.includes('dtd')) {
    insights.push('Injury news');
  }
  if (lowerText.includes('hot') || lowerText.includes('streak')) {
    insights.push('Hot players');
  }
  if (lowerText.includes('buy low') || lowerText.includes('sell high')) {
    insights.push('Trade advice');
  }
  
  return insights;
}

function extractStats(text: string): string[] {
  const stats: string[] = [];
  
  // ERA mentions
  const eraMatch = text.match(/([0-9]+\.[0-9]+)\s*ERA/gi);
  if (eraMatch) stats.push(...eraMatch);
  
  // Batting average
  const avgMatch = text.match(/\.[0-9]{3}/g);
  if (avgMatch) stats.push(...avgMatch.map(a => `${a} AVG`));
  
  // Home runs
  const hrMatch = text.match(/(\d+)\s*(HR|homer|homers)/gi);
  if (hrMatch) stats.push(...hrMatch);
  
  // Strikeouts
  const kMatch = text.match(/(\d+)\s*K/gi);
  if (kMatch) stats.push(...kMatch);
  
  // Saves
  const savesMatch = text.match(/(\d+)\s*saves/gi);
  if (savesMatch) stats.push(...savesMatch);
  
  return stats;
}

function extractRecommendations(text: string): string[] {
  const recommendations: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Add/Drop
  if (lowerText.includes('add')) {
    const addMatch = text.match(/add\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
    if (addMatch) recommendations.push(`ADD: ${addMatch[1]}`);
  }
  
  if (lowerText.includes('drop')) {
    const dropMatch = text.match(/drop\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
    if (dropMatch) recommendations.push(`DROP: ${dropMatch[1]}`);
  }
  
  // Start/Sit
  if (lowerText.includes('start')) {
    const startMatch = text.match(/start\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
    if (startMatch) recommendations.push(`START: ${startMatch[1]}`);
  }
  
  if (lowerText.includes('sit') || lowerText.includes('bench')) {
    const sitMatch = text.match(/(?:sit|bench)\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
    if (sitMatch) recommendations.push(`SIT: ${sitMatch[1]}`);
  }
  
  // Stream
  if (lowerText.includes('stream')) {
    recommendations.push('Streaming option');
  }
  
  return recommendations;
}

async function displayResults(content: MLBContent[]) {
  if (content.length === 0) {
    console.log('No content found.\n');
    return;
  }
  
  console.log(`\nFound ${content.length} pieces of content:\n`);
  
  content.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   📺 Channel: ${item.channel || 'Unknown'}`);
    console.log(`   📅 Published: ${item.published}`);
    
    if (item.players_mentioned.length > 0) {
      console.log(`   ⚾ Players: ${item.players_mentioned.join(', ')}`);
    }
    
    if (item.insights.length > 0) {
      console.log(`   💡 Insights: ${item.insights.join(', ')}`);
    }
    
    if (item.stats_mentioned.length > 0) {
      console.log(`   📊 Stats: ${item.stats_mentioned.join(', ')}`);
    }
    
    if (item.recommendations.length > 0) {
      console.log(`   🎯 Recommendations: ${item.recommendations.join(', ')}`);
    }
    
    console.log(`   🔗 URL: ${item.url}\n`);
  });
}

async function scrapeMLBContent() {
  const allContent: MLBContent[] = [];
  
  // Search for MLB fantasy content
  for (const search of MLB_SOURCES.youtube_searches) {
    const content = await scrapeYouTubeMLB(search);
    allContent.push(...content);
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Aggregate insights
  const allPlayers = new Set<string>();
  const allInsights = new Set<string>();
  const allRecommendations: string[] = [];
  
  allContent.forEach(item => {
    item.players_mentioned.forEach(p => allPlayers.add(p));
    item.insights.forEach(i => allInsights.add(i));
    allRecommendations.push(...item.recommendations);
  });
  
  console.log('\n📊 AGGREGATE SUMMARY:\n');
  console.log(`Total content pieces: ${allContent.length}`);
  console.log(`Unique players mentioned: ${allPlayers.size}`);
  console.log(`Types of content: ${Array.from(allInsights).join(', ')}`);
  
  if (allPlayers.size > 0) {
    console.log('\n🔥 Most mentioned players:');
    const playerCounts = new Map<string, number>();
    allContent.forEach(item => {
      item.players_mentioned.forEach(player => {
        playerCounts.set(player, (playerCounts.get(player) || 0) + 1);
      });
    });
    
    const sortedPlayers = Array.from(playerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
      
    sortedPlayers.forEach(([player, count]) => {
      console.log(`   ${player}: ${count} mentions`);
    });
  }
  
  if (allRecommendations.length > 0) {
    console.log('\n🎯 Latest recommendations:');
    const uniqueRecs = [...new Set(allRecommendations)].slice(0, 10);
    uniqueRecs.forEach(rec => console.log(`   ${rec}`));
  }
  
  // Display recent content
  console.log('\n📺 RECENT MLB FANTASY CONTENT:');
  await displayResults(allContent.slice(0, 10));
}

// Main
async function main() {
  await scrapeMLBContent();
  
  console.log('✅ MLB content scraping complete!');
  console.log('\n💡 This data could be used to:');
  console.log('- Track trending waiver wire adds');
  console.log('- Monitor player injuries and call-ups');
  console.log('- Identify streaming pitchers');
  console.log('- Build consensus rankings');
  console.log('- Alert on your players being mentioned');
}

if (require.main === module) {
  main().catch(console.error);
}