#!/usr/bin/env node
import axios from 'axios';
import * as cheerio from 'cheerio';

console.log('⚾ MLB FANTASY CONTENT ANALYZER');
console.log('🎯 Finding real player mentions and advice\n');

// Real MLB player names to look for
const KNOWN_MLB_PLAYERS = [
  // Top fantasy players
  'Ronald Acuna', 'Mookie Betts', 'Juan Soto', 'Aaron Judge', 'Shohei Ohtani',
  'Mike Trout', 'Freddie Freeman', 'Trea Turner', 'Jose Ramirez', 'Vladimir Guerrero',
  'Fernando Tatis', 'Rafael Devers', 'Marcus Semien', 'Julio Rodriguez', 'Bobby Witt',
  
  // Top pitchers
  'Gerrit Cole', 'Spencer Strider', 'Shane Bieber', 'Jacob deGrom', 'Corbin Burnes',
  'Sandy Alcantara', 'Zack Wheeler', 'Max Scherzer', 'Dylan Cease', 'Luis Castillo',
  
  // Popular waiver targets
  'Jose Soriano', 'Evan Carter', 'Elly De La Cruz', 'Gunnar Henderson', 'Corbin Carroll',
  'Jackson Chourio', 'Jordan Walker', 'Anthony Volpe', 'Grayson Rodriguez', 'Mason Miller'
];

async function searchMLBContent(query: string) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    console.log(`🔍 Searching: ${query}`);
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const videos: any[] = [];
    
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
                  if (videoData && videos.length < 3) { // Top 3 results
                    videos.push({
                      title: videoData.title?.runs?.[0]?.text || '',
                      channel: videoData.ownerText?.runs?.[0]?.text,
                      published: videoData.publishedTimeText?.simpleText || 'Unknown',
                      views: videoData.viewCountText?.simpleText || 'Unknown',
                      url: `https://www.youtube.com/watch?v=${videoData.videoId}`,
                      description: videoData.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || ''
                    });
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
    
    return videos;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function findPlayerMentions(text: string): string[] {
  const foundPlayers: string[] = [];
  const textLower = text.toLowerCase();
  
  // Check for known players
  KNOWN_MLB_PLAYERS.forEach(player => {
    if (textLower.includes(player.toLowerCase())) {
      foundPlayers.push(player);
    }
  });
  
  // Also look for pattern-based names
  const patterns = [
    // Names in video titles are often formatted clearly
    /(?:waiver|add|pickup|stream|start)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:HR|RBI|K|ERA|WHIP)/g,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:injury|IL|DTD)/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !foundPlayers.includes(match[1])) {
        foundPlayers.push(match[1]);
      }
    }
  });
  
  return foundPlayers;
}

function analyzeContent(video: any) {
  const analysis = {
    players: findPlayerMentions(video.title + ' ' + video.description),
    actionType: '',
    insights: [] as string[],
    urgency: 'normal' as 'urgent' | 'high' | 'normal'
  };
  
  const lowerTitle = video.title.toLowerCase();
  
  // Determine action type
  if (lowerTitle.includes('waiver') || lowerTitle.includes('add') || lowerTitle.includes('pickup')) {
    analysis.actionType = 'ADD';
    analysis.insights.push('Waiver wire target');
  }
  if (lowerTitle.includes('drop') || lowerTitle.includes('cut')) {
    analysis.actionType = 'DROP';
    analysis.insights.push('Consider dropping');
  }
  if (lowerTitle.includes('start') || lowerTitle.includes('stream')) {
    analysis.actionType = 'START';
    analysis.insights.push('Streaming option');
  }
  if (lowerTitle.includes('sit') || lowerTitle.includes('bench')) {
    analysis.actionType = 'SIT';
    analysis.insights.push('Bench recommendation');
  }
  if (lowerTitle.includes('trade') || lowerTitle.includes('buy') || lowerTitle.includes('sell')) {
    analysis.actionType = 'TRADE';
    analysis.insights.push('Trade target');
  }
  
  // Check urgency
  if (lowerTitle.includes('urgent') || lowerTitle.includes('breaking') || lowerTitle.includes('injury')) {
    analysis.urgency = 'urgent';
  } else if (lowerTitle.includes('hot') || lowerTitle.includes('must')) {
    analysis.urgency = 'high';
  }
  
  // Extract specific insights
  if (lowerTitle.includes('two-start') || lowerTitle.includes('2-start')) {
    analysis.insights.push('Two-start pitcher');
  }
  if (lowerTitle.includes('call up') || lowerTitle.includes('promoted')) {
    analysis.insights.push('Recent call-up');
  }
  if (lowerTitle.includes('closer') || lowerTitle.includes('saves')) {
    analysis.insights.push('Closer situation');
  }
  if (lowerTitle.includes('hot streak') || lowerTitle.includes('heating up')) {
    analysis.insights.push('Hot player');
  }
  
  return analysis;
}

async function getMLBFantasyIntelligence() {
  // Search for different types of content
  const searches = [
    'fantasy baseball waiver wire pickups today 2025',
    'MLB players to add drop today',
    'fantasy baseball streaming pitchers today',
    'MLB injury report fantasy impact',
    'fantasy baseball hot players July 2025'
  ];
  
  const allContent: any[] = [];
  const playerMentions = new Map<string, number>();
  const recommendations = new Map<string, string[]>();
  
  for (const search of searches) {
    const videos = await searchMLBContent(search);
    
    videos.forEach(video => {
      const analysis = analyzeContent(video);
      
      // Track player mentions
      analysis.players.forEach(player => {
        playerMentions.set(player, (playerMentions.get(player) || 0) + 1);
        
        if (analysis.actionType) {
          const recs = recommendations.get(player) || [];
          recs.push(`${analysis.actionType} (${video.channel})`);
          recommendations.set(player, recs);
        }
      });
      
      allContent.push({ video, analysis });
    });
    
    await new Promise(r => setTimeout(r, 1500)); // Rate limit
  }
  
  // Display intelligence report
  console.log('\n📊 MLB FANTASY INTELLIGENCE REPORT\n');
  console.log('=' .repeat(60));
  
  // Most mentioned players
  if (playerMentions.size > 0) {
    console.log('\n🔥 TRENDING PLAYERS:');
    const sorted = Array.from(playerMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sorted.forEach(([player, count]) => {
      const recs = recommendations.get(player) || [];
      console.log(`\n${player} (${count} mentions)`);
      if (recs.length > 0) {
        console.log(`   Recommendations: ${recs.join(', ')}`);
      }
    });
  }
  
  // Recent content
  console.log('\n\n📺 LATEST CONTENT:\n');
  allContent.slice(0, 10).forEach((item, i) => {
    const { video, analysis } = item;
    console.log(`${i + 1}. ${video.title}`);
    console.log(`   Channel: ${video.channel} | ${video.published} | ${video.views}`);
    
    if (analysis.players.length > 0) {
      console.log(`   Players: ${analysis.players.join(', ')}`);
    }
    if (analysis.actionType) {
      console.log(`   Action: ${analysis.actionType} ${analysis.insights.join(', ')}`);
    }
    if (analysis.urgency !== 'normal') {
      console.log(`   ⚠️  Urgency: ${analysis.urgency.toUpperCase()}`);
    }
    console.log(`   URL: ${video.url}\n`);
  });
  
  // Summary insights
  console.log('\n💡 KEY TAKEAWAYS:\n');
  console.log('• Top waiver targets being discussed across multiple sources');
  console.log('• Injury news and its fantasy impact');
  console.log('• Streaming pitcher recommendations for upcoming matchups');
  console.log('• Players on hot streaks worth targeting');
  console.log('• Trade buy-low and sell-high candidates\n');
}

// Main
async function main() {
  await getMLBFantasyIntelligence();
}

if (require.main === module) {
  main().catch(console.error);
}