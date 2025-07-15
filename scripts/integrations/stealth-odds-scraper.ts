#!/usr/bin/env tsx
/**
 * 🥷 STEALTH ODDS SCRAPER
 * 
 * Advanced techniques to avoid detection:
 * 1. Rotating proxies
 * 2. Random delays
 * 3. Browser fingerprint randomization
 * 4. Mobile API endpoints
 * 5. RSS feeds
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import UserAgent from 'user-agents';

dotenv.config();

puppeteer.use(StealthPlugin());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class StealthOddsScraper {
  private userAgents: string[] = [];
  
  constructor() {
    // Generate random user agents
    for (let i = 0; i < 10; i++) {
      const userAgent = new UserAgent({ deviceCategory: 'desktop' });
      this.userAgents.push(userAgent.toString());
    }
  }
  
  private randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }
  
  async scrapeViaRSS(): Promise<any[]> {
    console.log('\n📡 Method 1: RSS Feeds (Never blocked!)...');
    
    const rssFeeds = [
      'https://www.oddsshark.com/rss/odds',
      'https://www.vegasinsider.com/mlb/odds/rss/',
      'https://www.sportsbookreview.com/rss/odds-mlb.xml'
    ];
    
    const odds = [];
    
    for (const feed of rssFeeds) {
      try {
        await this.randomDelay(500, 1500);
        
        const response = await axios.get(feed, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'application/rss+xml, application/xml, text/xml'
          },
          timeout: 10000
        });
        
        // Parse RSS XML for odds data
        const matches = response.data.match(/<item>[\s\S]*?<\/item>/g) || [];
        console.log(`✅ Found ${matches.length} items in RSS feed`);
        
        // Extract odds from RSS items
        matches.forEach((item: string) => {
          const title = item.match(/<title>(.*?)<\/title>/)?.[1];
          const description = item.match(/<description>(.*?)<\/description>/)?.[1];
          
          if (title && description) {
            // Parse odds from description
            const oddsMatch = description.match(/([+-]\d+)/g);
            if (oddsMatch) {
              odds.push({
                source: 'RSS',
                title,
                odds: oddsMatch
              });
            }
          }
        });
      } catch (error) {
        console.log(`❌ RSS feed ${feed} failed`);
      }
    }
    
    return odds;
  }
  
  async scrapeMobileAPI(): Promise<any[]> {
    console.log('\n📱 Method 2: Mobile API Endpoints...');
    
    // Mobile APIs are often less protected
    const mobileEndpoints = [
      {
        name: 'DraftKings Mobile',
        url: 'https://api.draftkings.com/sportsbook/v1/offers/localized/1?format=json',
        headers: {
          'User-Agent': 'DraftKings/5.0 (iPhone; iOS 15.0; Scale/3.00)',
          'X-Platform': 'ios',
          'X-App-Version': '5.0'
        }
      },
      {
        name: 'FanDuel Mobile', 
        url: 'https://mobile.fanduel.com/api/odds/mlb',
        headers: {
          'User-Agent': 'FanDuel/4.0 (Android; SDK 30)',
          'X-Platform': 'android',
          'X-Device-ID': this.generateDeviceId()
        }
      }
    ];
    
    const odds = [];
    
    for (const endpoint of mobileEndpoints) {
      try {
        await this.randomDelay();
        
        const response = await axios.get(endpoint.url, {
          headers: endpoint.headers,
          timeout: 10000
        });
        
        if (response.data) {
          console.log(`✅ ${endpoint.name} returned data`);
          odds.push({
            source: endpoint.name,
            data: response.data
          });
        }
      } catch (error) {
        console.log(`❌ ${endpoint.name} blocked or unavailable`);
      }
    }
    
    return odds;
  }
  
  async scrapeViaProxy(): Promise<any[]> {
    console.log('\n🌐 Method 3: Proxy Rotation...');
    
    // Free proxy services
    const proxyProviders = [
      'https://www.proxy-list.download/api/v1/get?type=http',
      'https://api.proxyscrape.com/v2/?request=get&protocol=http',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt'
    ];
    
    // Get proxy list
    const proxies = [];
    try {
      const response = await axios.get(proxyProviders[2]);
      const proxyList = response.data.split('\n').slice(0, 5); // Get 5 proxies
      proxies.push(...proxyList.filter((p: string) => p.trim()));
      console.log(`✅ Found ${proxies.length} proxies`);
    } catch (error) {
      console.log('❌ Could not fetch proxy list');
    }
    
    // Try scraping with proxies
    const odds = [];
    for (const proxy of proxies) {
      try {
        const [host, port] = proxy.split(':');
        
        const response = await axios.get('https://www.bovada.lv/services/sports/event/v2/events/A/description/baseball/mlb', {
          proxy: {
            host,
            port: parseInt(port)
          },
          headers: {
            'User-Agent': this.getRandomUserAgent()
          },
          timeout: 5000
        });
        
        if (response.data) {
          console.log(`✅ Successfully scraped via proxy ${proxy}`);
          odds.push(response.data);
          break;
        }
      } catch (error) {
        // Try next proxy
      }
    }
    
    return odds;
  }
  
  async scrapePublicAPIs(): Promise<any[]> {
    console.log('\n🔓 Method 4: Public/Unofficial APIs...');
    
    const publicAPIs = [
      {
        name: 'ESPN Hidden API',
        url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
        parse: (data: any) => {
          const games = [];
          data.events?.forEach((event: any) => {
            games.push({
              name: event.name,
              teams: event.competitions[0].competitors.map((c: any) => c.team.displayName),
              odds: event.competitions[0].odds?.[0]
            });
          });
          return games;
        }
      },
      {
        name: 'Yahoo Sports API',
        url: 'https://api-secure.sports.yahoo.com/v1/editorial/s/scoreboard?leagues=mlb&date=current',
        parse: (data: any) => data.games || []
      },
      {
        name: 'TheScore API',
        url: 'https://api.thescore.com/mlb/games?date=today',
        parse: (data: any) => data || []
      }
    ];
    
    const allOdds = [];
    
    for (const api of publicAPIs) {
      try {
        await this.randomDelay(1000, 2000);
        
        const response = await axios.get(api.url, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'application/json',
            'Referer': api.url.split('/')[2]
          },
          timeout: 10000
        });
        
        if (response.data) {
          const parsed = api.parse(response.data);
          console.log(`✅ ${api.name}: Found ${parsed.length} games`);
          allOdds.push({
            source: api.name,
            games: parsed
          });
        }
      } catch (error) {
        console.log(`❌ ${api.name} failed`);
      }
    }
    
    return allOdds;
  }
  
  async scrapeSocialMedia(): Promise<any[]> {
    console.log('\n🐦 Method 5: Social Media APIs...');
    
    // Twitter/X often has odds posted by sportsbooks
    const socialAPIs = [
      {
        name: 'Twitter Search',
        url: 'https://api.twitter.com/2/tweets/search/recent?query=MLB%20odds%20DraftKings',
        headers: {
          'Authorization': 'Bearer YOUR_TWITTER_BEARER_TOKEN'
        }
      }
    ];
    
    // Reddit has odds discussions
    try {
      const response = await axios.get('https://www.reddit.com/r/sportsbook/search.json?q=MLB+odds&restrict_sr=1&sort=new&limit=10', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OddsScraper/1.0)'
        }
      });
      
      if (response.data?.data?.children) {
        console.log(`✅ Found ${response.data.data.children.length} Reddit posts about odds`);
        return response.data.data.children;
      }
    } catch (error) {
      console.log('❌ Reddit API failed');
    }
    
    return [];
  }
  
  async scrapeWithCloudflareBypass(): Promise<any[]> {
    console.log('\n☁️ Method 6: Cloudflare Bypass...');
    
    const browser = await puppeteer.launch({
      headless: false, // Sometimes non-headless works better
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-setuid-sandbox',
        '--no-sandbox'
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Randomize viewport
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 1080 + Math.floor(Math.random() * 100)
      });
      
      // Add mouse movements to appear human
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });
      });
      
      // Navigate slowly
      await page.goto('https://www.pinnacle.com/en/baseball/mlb/matchups', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Random mouse movements
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 300);
      
      // Wait for Cloudflare
      await this.randomDelay(5000, 8000);
      
      // Check if we passed Cloudflare
      const title = await page.title();
      console.log(`Page title: ${title}`);
      
      if (!title.includes('Just a moment')) {
        console.log('✅ Bypassed Cloudflare!');
        
        // Extract odds
        const odds = await page.evaluate(() => {
          const games = [];
          document.querySelectorAll('[data-test-id="event-row"]').forEach(row => {
            const teams = row.querySelectorAll('[data-test-id="team-name"]');
            const oddsElements = row.querySelectorAll('[data-test-id="odds"]');
            
            if (teams.length >= 2) {
              games.push({
                away: teams[0].textContent,
                home: teams[1].textContent,
                odds: Array.from(oddsElements).map(el => el.textContent)
              });
            }
          });
          return games;
        });
        
        return odds;
      }
    } catch (error) {
      console.log('❌ Cloudflare bypass failed');
    } finally {
      await browser.close();
    }
    
    return [];
  }
  
  private generateDeviceId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  async scrapeAllMethods(): Promise<any> {
    console.log('🥷 STEALTH SCRAPER - TRYING ALL METHODS');
    console.log('=' .repeat(60));
    
    const results = {
      rss: await this.scrapeViaRSS(),
      mobile: await this.scrapeMobileAPI(),
      publicAPIs: await this.scrapePublicAPIs(),
      social: await this.scrapeSocialMedia(),
      // proxy: await this.scrapeViaProxy(), // Commented out - proxies can be slow
      // cloudflare: await this.scrapeWithCloudflareBypass() // Commented out - opens browser
    };
    
    // Count successful methods
    const successCount = Object.values(results).filter(r => r.length > 0).length;
    
    console.log(`\n📊 SUMMARY: ${successCount}/4 methods returned data`);
    
    return results;
  }
}

async function main() {
  const scraper = new StealthOddsScraper();
  
  try {
    const results = await scraper.scrapeAllMethods();
    
    console.log('\n🎯 FINAL RESULTS:');
    console.log('=' .repeat(60));
    
    // Display what we found
    if (results.publicAPIs.length > 0) {
      console.log('\n✅ PUBLIC APIs (Most Reliable):');
      results.publicAPIs.forEach((api: any) => {
        console.log(`   ${api.source}: ${api.games.length} games found`);
      });
    }
    
    if (results.rss.length > 0) {
      console.log(`\n✅ RSS FEEDS: ${results.rss.length} odds found`);
    }
    
    if (results.mobile.length > 0) {
      console.log(`\n✅ MOBILE APIs: ${results.mobile.length} responses`);
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. ESPN API is most reliable (no auth needed)');
    console.log('2. RSS feeds never get blocked');
    console.log('3. The Odds API with free key is best overall');
    console.log('4. Combine multiple sources for redundancy');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main();
}

export { StealthOddsScraper };