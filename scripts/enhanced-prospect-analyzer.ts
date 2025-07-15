#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🎯 ENHANCED PROSPECT ANALYZER');
console.log('⚾ Leveraging YouTube + Database for Prospect Intelligence\n');

interface ProspectIntel {
  name: string;
  mentions: number;
  sources: string[];
  promotion_signals: string[];
  team: string;
  level: string;
  confidence: number;
  fantasy_impact: string;
  timeline: string;
}

class EnhancedProspectAnalyzer {
  
  async analyzeProspects(query: string): Promise<ProspectIntel[]> {
    console.log(`🔍 Analyzing prospects for: "${query}"\n`);
    
    // Step 1: Get fresh YouTube content about prospects
    const youtubeData = await this.scrapeProspectContent();
    
    // Step 2: Query existing database
    const databaseData = await this.queryProspectDatabase();
    
    // Step 3: Use Anthropic to analyze all data
    const prospects = await this.analyzeWithAI(youtubeData, databaseData, query);
    
    return prospects;
  }

  async scrapeProspectContent(): Promise<any[]> {
    console.log('📺 Scraping latest prospect content from YouTube...\n');
    
    const searches = [
      'MLB prospects call ups July 2025 all star break',
      'minor league pitchers ready for promotion 2025',
      'fantasy baseball prospect stash July 2025',
      'MLB prospect rankings pitchers 2025 all star',
      'minor league call ups second half 2025',
      'fantasy baseball prospect watch July',
      'MLB farm system pitchers promotion ready',
      'fantasy prospect sleepers all star break'
    ];
    
    const allContent: any[] = [];
    
    for (const search of searches) {
      const videos = await this.searchYouTube(search);
      allContent.push(...videos);
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }
    
    console.log(`✅ Scraped ${allContent.length} prospect-focused videos\n`);
    return allContent;
  }

  async searchYouTube(searchTerm: string): Promise<any[]> {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
      console.log(`🔍 Searching: ${searchTerm}`);
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const videos: any[] = [];
      
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
                    if (videoData && videos.length < 5) {
                      videos.push({
                        title: videoData.title?.runs?.[0]?.text || '',
                        channel: videoData.ownerText?.runs?.[0]?.text,
                        published: videoData.publishedTimeText?.simpleText || 'Unknown',
                        url: `https://www.youtube.com/watch?v=${videoData.videoId}`,
                        description: videoData.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || '',
                        search_term: searchTerm
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
      console.error('YouTube search error:', error);
      return [];
    }
  }

  async queryProspectDatabase(): Promise<any[]> {
    console.log('🗄️ Querying database for prospect intelligence...\n');
    
    const data: any[] = [];
    
    try {
      // Query news articles for prospect content
      const { data: newsData } = await supabase
        .from('news_articles')
        .select('title, content, source, published_at')
        .or('content.ilike.%prospect%,content.ilike.%call up%,content.ilike.%promotion%,content.ilike.%minor league%')
        .order('published_at', { ascending: false })
        .limit(50);
      
      if (newsData) {
        data.push(...newsData.map(item => ({ ...item, source_type: 'news' })));
      }

      // Query player intelligence for prospect mentions
      const { data: statsData } = await supabase
        .from('player_stats')
        .select('stat_type, stat_value')
        .eq('stat_type', 'fantasy_intelligence')
        .limit(100);
      
      if (statsData) {
        data.push(...statsData.map(item => ({ ...item, source_type: 'intelligence' })));
      }

      // Query social sentiment for prospect buzz
      const { data: socialData } = await supabase
        .from('social_sentiment')
        .select('content, mentions, sentiment, platform')
        .or('content.ilike.%prospect%,content.ilike.%call up%,content.ilike.%minor league%')
        .limit(30);
      
      if (socialData) {
        data.push(...socialData.map(item => ({ ...item, source_type: 'social' })));
      }

    } catch (error) {
      console.error('Database query error:', error);
    }
    
    console.log(`✅ Retrieved ${data.length} database records\n`);
    return data;
  }

  async analyzeWithAI(youtubeData: any[], databaseData: any[], query: string): Promise<ProspectIntel[]> {
    console.log('🤖 Analyzing data with Anthropic AI...\n');
    
    // Retry mechanism for API overload
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🔄 AI Analysis attempt ${attempt}/${maxRetries}...`);
        
        const analysisPrompt = `
You are a fantasy baseball expert specializing in minor league prospects. Analyze the provided data to answer: "${query}"

YouTube Video Content:
${JSON.stringify(youtubeData.slice(0, 20), null, 2)}

Database Records:
${JSON.stringify(databaseData.slice(0, 30), null, 2)}

Your task: Identify the top 5 minor league pitching prospects most likely for promotion after the All-Star break (July 15+).

IMPORTANT: EXCLUDE players who are already in the major leagues! This includes:
- Paul Skenes (already promoted to Pirates)
- Jackson Holliday (already promoted to Orioles) 
- Any player currently on a MLB roster

For each prospect, analyze:
1. How many times mentioned across sources
2. What promotion signals exist (team needs, performance, timeline mentions)
3. What team they're with and current level (MUST be minor league)
4. Confidence level in promotion (1-10)
5. Expected fantasy impact if promoted
6. Likely promotion timeline

Look for these key signals:
- "Ready for the majors"
- "Next in line for call-up"
- "Post all-star break promotion"
- "Team needs rotation help"
- "Dominant at Triple-A"
- Mentions of specific pitcher names in prospect context
- Expert recommendations to "stash" or "watch"
- "Still in the minors" or "awaiting promotion"

ONLY include players who are:
- Currently in Triple-A, Double-A, or other minor league levels
- Not yet promoted to MLB
- Actively being discussed for upcoming promotion

Return ONLY a JSON array of the top 5 prospects in this exact format:
[
  {
    "name": "Prospect Name",
    "mentions": 3,
    "sources": ["Fantasy Baseball Today", "RotoBaller"],
    "promotion_signals": ["Dominant at AAA", "Team needs rotation help"],
    "team": "Team Name",
    "level": "Triple-A",
    "confidence": 8,
    "fantasy_impact": "Expected 4+ K/9 with immediate rotation role",
    "timeline": "Late July - Early August"
  }
]

Focus on ACTUAL prospects mentioned in the data, not generic examples. If fewer than 5 prospects have good data, return only those with solid evidence.
`;

        const response = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2000,
          messages: [{ role: "user", content: analysisPrompt }]
        });

        const responseText = response.content[0].type === 'text' 
          ? response.content[0].text 
          : '';

        // Extract JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const prospects = JSON.parse(jsonMatch[0]);
          console.log(`✅ AI Analysis successful on attempt ${attempt}!`);
          return prospects;
        }
        
        console.log('⚠️ Could not parse AI response as JSON, retrying...');
        
      } catch (error: any) {
        console.log(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (error.status === 529) {
          console.log('🔄 API overloaded, waiting before retry...');
          await new Promise(r => setTimeout(r, 5000 * attempt)); // Exponential backoff
        } else if (attempt === maxRetries) {
          console.error('💀 All retry attempts failed:', error);
          return [];
        }
      }
    }
    
    console.log('❌ AI analysis failed after all retries');
    return [];
  }

  displayResults(prospects: ProspectIntel[]) {
    console.log('🎯 TOP PITCHING PROSPECTS FOR POST ALL-STAR PROMOTION\n');
    console.log('=' .repeat(70));
    
    if (prospects.length === 0) {
      console.log('❌ No prospects found with sufficient data for analysis');
      console.log('💡 This could mean:');
      console.log('   • Limited recent prospect coverage in sources');
      console.log('   • All-star break timing may be too early for speculation');
      console.log('   • Prospects may not be getting YouTube/expert coverage yet');
      return;
    }

    prospects.forEach((prospect, i) => {
      console.log(`${i + 1}. ${prospect.name}`);
      console.log(`   Team: ${prospect.team} | Level: ${prospect.level}`);
      console.log(`   Mentions: ${prospect.mentions} across sources`);
      console.log(`   Sources: ${prospect.sources.join(', ')}`);
      console.log(`   Promotion Signals: ${prospect.promotion_signals.join(', ')}`);
      console.log(`   Confidence: ${prospect.confidence}/10`);
      console.log(`   Fantasy Impact: ${prospect.fantasy_impact}`);
      console.log(`   Timeline: ${prospect.timeline}`);
      console.log();
    });

    console.log('=' .repeat(70));
    console.log('📊 Analysis Summary:');
    console.log(`• Total prospects analyzed: ${prospects.length}`);
    console.log(`• Average confidence: ${(prospects.reduce((sum, p) => sum + p.confidence, 0) / prospects.length).toFixed(1)}/10`);
    console.log(`• Top confidence pick: ${prospects[0]?.name} (${prospects[0]?.confidence}/10)`);
    console.log('\n💡 Fantasy Strategy:');
    console.log('• Stash highest confidence prospects now');
    console.log('• Monitor team rotation needs and injuries');
    console.log('• Set waiver alerts for promotion announcements');
    console.log('• Consider rostering before promotion for maximum value');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const query = args.join(' ') || 'Who are the top 5 pitchers in the minors that could get promoted after the all-star break?';
  
  const analyzer = new EnhancedProspectAnalyzer();
  
  try {
    const prospects = await analyzer.analyzeProspects(query);
    analyzer.displayResults(prospects);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { EnhancedProspectAnalyzer };