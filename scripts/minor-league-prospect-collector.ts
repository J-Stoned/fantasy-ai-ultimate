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

console.log('⚾ MINOR LEAGUE PROSPECT DATA COLLECTOR');
console.log('🎯 Gathering comprehensive prospect intelligence\n');

interface ProspectData {
  name: string;
  team: string;
  level: string;
  position: string;
  age: number;
  stats: any;
  ranking: number;
  eta: string;
  fantasy_notes: string;
  source: string;
}

class MinorLeagueProspectCollector {
  
  async collectProspectData(): Promise<ProspectData[]> {
    console.log('🔍 Collecting prospect data from multiple sources...\n');
    
    const allProspects: ProspectData[] = [];
    
    // Collect from multiple sources
    const baseballProspectsData = await this.scrapeBaseballProspects();
    const fantasyProsProspectsData = await this.scrapeFantasyProsProspects();
    const pipelineReportsData = await this.scrapePipelineReports();
    const youtubeProspectsData = await this.scrapeYouTubeProspectContent();
    
    allProspects.push(...baseballProspectsData);
    allProspects.push(...fantasyProsProspectsData);
    allProspects.push(...pipelineReportsData);
    allProspects.push(...youtubeProspectsData);
    
    console.log(`✅ Collected ${allProspects.length} total prospect records\n`);
    return allProspects;
  }

  async scrapeBaseballProspects(): Promise<ProspectData[]> {
    console.log('⚾ Scraping Baseball America prospect data...');
    
    try {
      // Free prospect content from Baseball America
      const response = await axios.get('https://www.baseballamerica.com/rankings/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const prospects: ProspectData[] = [];
      
      // Extract prospect information from the page
      $('.prospect-card, .player-card, .ranking-item').each((i, element) => {
        const $el = $(element);
        const name = $el.find('.player-name, .prospect-name, h3, h4').first().text().trim();
        const team = $el.find('.team, .organization').text().trim();
        const position = $el.find('.position, .pos').text().trim();
        
        if (name && name.length > 3) {
          prospects.push({
            name,
            team: team || 'Unknown',
            level: 'Minor League',
            position: position || 'Unknown',
            age: 0,
            stats: {},
            ranking: i + 1,
            eta: '2025-2026',
            fantasy_notes: 'Prospect ranking from Baseball America',
            source: 'Baseball America'
          });
        }
      });
      
      console.log(`   ✅ Found ${prospects.length} prospects from Baseball America`);
      return prospects.slice(0, 50); // Top 50
      
    } catch (error) {
      console.log('   ⚠️ Baseball America scraping failed, continuing...');
      return [];
    }
  }

  async scrapeFantasyProsProspects(): Promise<ProspectData[]> {
    console.log('📊 Scraping FantasyPros prospect rankings...');
    
    try {
      const response = await axios.get('https://www.fantasypros.com/mlb/rankings/prospects.php', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const prospects: ProspectData[] = [];
      
      // Extract from FantasyPros prospect table
      $('table tr, .prospect-row, .player-row').each((i, element) => {
        const $el = $(element);
        const name = $el.find('td:first-child, .player-name').text().trim();
        const team = $el.find('td:nth-child(2), .team').text().trim();
        const position = $el.find('td:nth-child(3), .position').text().trim();
        
        if (name && name.length > 3 && !name.includes('Rank')) {
          prospects.push({
            name,
            team: team || 'Unknown',
            level: 'Minor League',
            position: position || 'Unknown',
            age: 0,
            stats: {},
            ranking: i + 1,
            eta: '2025',
            fantasy_notes: 'Fantasy prospect ranking from FantasyPros',
            source: 'FantasyPros'
          });
        }
      });
      
      console.log(`   ✅ Found ${prospects.length} prospects from FantasyPros`);
      return prospects.slice(0, 100);
      
    } catch (error) {
      console.log('   ⚠️ FantasyPros scraping failed, continuing...');
      return [];
    }
  }

  async scrapePipelineReports(): Promise<ProspectData[]> {
    console.log('📈 Collecting pipeline and promotion reports...');
    
    try {
      // Scrape The Athletic, ESPN, or other sources for pipeline reports
      const searches = [
        'https://www.mlb.com/prospects',
        'https://www.espn.com/mlb/insider/story/_/page/mlbprospects'
      ];
      
      const prospects: ProspectData[] = [];
      
      for (const url of searches) {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          const $ = cheerio.load(response.data);
          
          // Extract prospect data from MLB.com or ESPN
          $('.prospect, .player-item, .prospect-card').each((i, element) => {
            const $el = $(element);
            const name = $el.find('.name, .player-name, h3').text().trim();
            const team = $el.find('.team, .org').text().trim();
            
            if (name && name.length > 3) {
              prospects.push({
                name,
                team: team || 'Unknown',
                level: 'Minor League',
                position: 'Pitcher',
                age: 0,
                stats: {},
                ranking: prospects.length + 1,
                eta: '2025',
                fantasy_notes: `Pipeline prospect from ${url.includes('mlb.com') ? 'MLB.com' : 'ESPN'}`,
                source: url.includes('mlb.com') ? 'MLB.com' : 'ESPN'
              });
            }
          });
          
        } catch (error) {
          console.log(`   ⚠️ Failed to scrape ${url}`);
        }
      }
      
      console.log(`   ✅ Found ${prospects.length} prospects from pipeline reports`);
      return prospects;
      
    } catch (error) {
      console.log('   ⚠️ Pipeline scraping failed, continuing...');
      return [];
    }
  }

  async scrapeYouTubeProspectContent(): Promise<ProspectData[]> {
    console.log('📺 Extracting prospects from YouTube content...');
    
    const searches = [
      'MLB top prospects 2025 pitchers',
      'fantasy baseball prospect rankings July 2025',
      'minor league call ups all star break',
      'MLB prospect watch pitchers ready',
      'fantasy baseball prospect stash list'
    ];
    
    const prospects: ProspectData[] = [];
    
    for (const search of searches) {
      try {
        const videos = await this.searchYouTubeForProspects(search);
        
        videos.forEach(video => {
          // Extract prospect names from video titles and descriptions
          const prospectNames = this.extractProspectNames(video.title + ' ' + video.description);
          
          prospectNames.forEach(name => {
            prospects.push({
              name,
              team: 'Unknown',
              level: 'Minor League',
              position: 'Pitcher',
              age: 0,
              stats: {},
              ranking: 0,
              eta: '2025',
              fantasy_notes: `Mentioned in: ${video.title} by ${video.channel}`,
              source: `YouTube: ${video.channel}`
            });
          });
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (error) {
        console.log(`   ⚠️ YouTube search failed for: ${search}`);
      }
    }
    
    console.log(`   ✅ Found ${prospects.length} prospects from YouTube content`);
    return prospects;
  }

  async searchYouTubeForProspects(searchTerm: string): Promise<any[]> {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
      
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
                    if (videoData && videos.length < 3) {
                      videos.push({
                        title: videoData.title?.runs?.[0]?.text || '',
                        channel: videoData.ownerText?.runs?.[0]?.text,
                        description: videoData.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || ''
                      });
                    }
                  });
                }
              });
            }
          } catch (e) {
            // Parse error, continue
          }
        }
      }
      
      return videos;
    } catch (error) {
      return [];
    }
  }

  extractProspectNames(text: string): string[] {
    const names: string[] = [];
    
    // Common prospect name patterns
    const patterns = [
      /([A-Z][a-z]+ [A-Z][a-z]+(?:\s+(?:Jr\.|Sr\.|III|II))?)/g,
      /(?:prospect|pitcher|call.?up)[\s:]+([A-Z][a-z]+ [A-Z][a-z]+)/gi,
      /([A-Z][a-z]+ [A-Z][a-z]+)[\s]+(?:prospect|rookie|call.?up|promotion)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 5) {
          const name = match[1].trim();
          if (!names.includes(name) && this.isLikelyProspectName(name)) {
            names.push(name);
          }
        }
      }
    });
    
    return names;
  }

  isLikelyProspectName(name: string): boolean {
    // Filter out common false positives
    const excludeWords = ['Fantasy Baseball', 'All Star', 'Minor League', 'Major League', 'Home Run', 'World Series'];
    return !excludeWords.some(word => name.includes(word)) && 
           name.split(' ').length >= 2 &&
           /^[A-Z]/.test(name);
  }

  async saveToDatabase(prospects: ProspectData[]): Promise<void> {
    console.log('💾 Saving prospect data to database...\n');
    
    try {
      // Save to news_articles table as prospect reports
      const newsData = prospects.map(prospect => ({
        title: `Prospect Report: ${prospect.name}`,
        content: `${prospect.name} (${prospect.position}) - ${prospect.team}. ${prospect.fantasy_notes}. ETA: ${prospect.eta}`,
        source: prospect.source,
        sport_id: 'MLB',
        tags: ['prospect', 'minor league', 'call up', prospect.position.toLowerCase()],
        published_at: new Date().toISOString(),
        player_ids: [],
        team_ids: []
      }));
      
      // Insert in batches
      const batchSize = 50;
      let inserted = 0;
      
      for (let i = 0; i < newsData.length; i += batchSize) {
        const batch = newsData.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('news_articles')
          .insert(batch);
        
        if (error) {
          console.log(`⚠️ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
        } else {
          inserted += batch.length;
          console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} prospects)`);
        }
      }
      
      // Also save to player_stats as prospect intelligence
      const statsData = prospects.map(prospect => ({
        stat_type: 'prospect_intelligence',
        stat_value: {
          name: prospect.name,
          team: prospect.team,
          level: prospect.level,
          position: prospect.position,
          ranking: prospect.ranking,
          eta: prospect.eta,
          fantasy_notes: prospect.fantasy_notes,
          source: prospect.source,
          analysis_date: new Date().toISOString()
        },
        fantasy_points: prospect.ranking > 0 ? (101 - prospect.ranking) : 50
      }));
      
      for (let i = 0; i < statsData.length; i += batchSize) {
        const batch = statsData.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('player_stats')
          .insert(batch);
        
        if (!error) {
          console.log(`✅ Saved prospect intelligence batch ${Math.floor(i/batchSize) + 1}`);
        }
      }
      
      console.log(`\n🎉 Successfully saved ${inserted} prospect reports to database!`);
      console.log(`📊 Total prospects processed: ${prospects.length}`);
      
    } catch (error) {
      console.error('❌ Database save error:', error);
    }
  }

  displayResults(prospects: ProspectData[]): void {
    console.log('🎯 MINOR LEAGUE PROSPECT COLLECTION RESULTS\n');
    console.log('=' .repeat(70));
    
    // Group by source
    const bySource = prospects.reduce((acc, prospect) => {
      if (!acc[prospect.source]) acc[prospect.source] = [];
      acc[prospect.source].push(prospect);
      return acc;
    }, {} as Record<string, ProspectData[]>);
    
    Object.entries(bySource).forEach(([source, sourceProspects]) => {
      console.log(`\n📊 ${source.toUpperCase()} (${sourceProspects.length} prospects):`);
      sourceProspects.slice(0, 10).forEach((prospect, i) => {
        console.log(`   ${i + 1}. ${prospect.name} (${prospect.position}) - ${prospect.team}`);
        if (prospect.fantasy_notes) {
          console.log(`      Notes: ${prospect.fantasy_notes}`);
        }
      });
    });
    
    console.log('\n=' .repeat(70));
    console.log('📈 Collection Summary:');
    console.log(`• Total prospects collected: ${prospects.length}`);
    console.log(`• Unique sources: ${Object.keys(bySource).length}`);
    console.log(`• Pitchers identified: ${prospects.filter(p => p.position.includes('Pitcher')).length}`);
    console.log(`• Ready for database integration`);
  }
}

// Main execution
async function main() {
  const collector = new MinorLeagueProspectCollector();
  
  try {
    const prospects = await collector.collectProspectData();
    
    if (prospects.length > 0) {
      collector.displayResults(prospects);
      await collector.saveToDatabase(prospects);
    } else {
      console.log('❌ No prospect data collected. Check network connection and sources.');
    }
    
  } catch (error) {
    console.error('❌ Collection failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { MinorLeagueProspectCollector };