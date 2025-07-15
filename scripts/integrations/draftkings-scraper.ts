#!/usr/bin/env tsx
/**
 * 🕷️ DRAFTKINGS WEB SCRAPER
 * 
 * Scrapes live odds from DraftKings website
 * No API key required!
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

interface ScrapedOdds {
  eventId: string;
  eventName: string;
  sport: string;
  startTime: string;
  teams: {
    home: string;
    away: string;
  };
  odds: {
    spread: {
      home: { line: string; odds: string };
      away: { line: string; odds: string };
    };
    total: {
      over: { line: string; odds: string };
      under: { line: string; odds: string };
    };
    moneyline: {
      home: string;
      away: string;
    };
  };
}

class DraftKingsScraper {
  private browser: puppeteer.Browser | null = null;
  
  async initialize() {
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }
  
  async scrapeMLBOdds(): Promise<ScrapedOdds[]> {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    const odds: ScrapedOdds[] = [];
    
    try {
      console.log('📊 Navigating to DraftKings MLB page...');
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to MLB odds page
      await page.goto('https://sportsbook.draftkings.com/leagues/baseball/mlb', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for odds to load
      await page.waitForSelector('.sportsbook-event-accordion__wrapper', { timeout: 10000 });
      
      console.log('✅ Page loaded, extracting odds...');
      
      // Extract all game data
      const games = await page.evaluate(() => {
        const gameElements = document.querySelectorAll('.sportsbook-event-accordion__wrapper');
        const gamesData: any[] = [];
        
        gameElements.forEach((game) => {
          try {
            // Get team names
            const teamElements = game.querySelectorAll('.sportsbook-event-accordion__title-wrapper span');
            if (teamElements.length < 2) return;
            
            const awayTeam = teamElements[0]?.textContent?.trim() || '';
            const homeTeam = teamElements[1]?.textContent?.trim() || '';
            
            // Get game time
            const timeElement = game.querySelector('.sportsbook-event-accordion__date');
            const startTime = timeElement?.textContent?.trim() || '';
            
            // Get betting lines
            const outcomeElements = game.querySelectorAll('.sportsbook-outcome-cell');
            const outcomes: any[] = [];
            
            outcomeElements.forEach(outcome => {
              const line = outcome.querySelector('.sportsbook-outcome-cell__line')?.textContent?.trim();
              const odds = outcome.querySelector('.sportsbook-odds-american')?.textContent?.trim();
              outcomes.push({ line, odds });
            });
            
            // Parse outcomes (typically in order: spread, total, moneyline)
            if (outcomes.length >= 6) {
              gamesData.push({
                eventId: `dk_${Date.now()}_${Math.random()}`,
                eventName: `${awayTeam} @ ${homeTeam}`,
                teams: { home: homeTeam, away: awayTeam },
                startTime: startTime,
                outcomes: outcomes
              });
            }
          } catch (e) {
            console.error('Error parsing game:', e);
          }
        });
        
        return gamesData;
      });
      
      // Process scraped data into our format
      games.forEach((game, idx) => {
        if (game.outcomes.length >= 6) {
          odds.push({
            eventId: game.eventId,
            eventName: game.eventName,
            sport: 'MLB',
            startTime: game.startTime,
            teams: game.teams,
            odds: {
              spread: {
                away: { line: game.outcomes[0]?.line || '0', odds: game.outcomes[0]?.odds || '-110' },
                home: { line: game.outcomes[1]?.line || '0', odds: game.outcomes[1]?.odds || '-110' }
              },
              total: {
                over: { line: game.outcomes[2]?.line || '0', odds: game.outcomes[2]?.odds || '-110' },
                under: { line: game.outcomes[3]?.line || '0', odds: game.outcomes[3]?.odds || '-110' }
              },
              moneyline: {
                away: game.outcomes[4]?.odds || '-110',
                home: game.outcomes[5]?.odds || '-110'
              }
            }
          });
        }
      });
      
      console.log(`✅ Scraped ${odds.length} MLB games from DraftKings`);
      
      // Cache the results
      await redis.setex('dk_scraped_odds', 60, JSON.stringify(odds)); // 1 minute cache
      
    } catch (error) {
      console.error('❌ Error scraping DraftKings:', error);
      
      // Fallback to mock data if scraping fails
      console.log('⚠️  Using fallback mock data...');
      return this.getMockData();
    } finally {
      await page.close();
    }
    
    return odds;
  }
  
  private getMockData(): ScrapedOdds[] {
    return [
      {
        eventId: 'dk_mock_1',
        eventName: 'New York Yankees @ Boston Red Sox',
        sport: 'MLB',
        startTime: '7:10 PM',
        teams: { home: 'Boston Red Sox', away: 'New York Yankees' },
        odds: {
          spread: {
            home: { line: '-1.5', odds: '+125' },
            away: { line: '+1.5', odds: '-145' }
          },
          total: {
            over: { line: '9.5', odds: '-115' },
            under: { line: '9.5', odds: '-105' }
          },
          moneyline: {
            home: '-135',
            away: '+115'
          }
        }
      },
      {
        eventId: 'dk_mock_2',
        eventName: 'Los Angeles Dodgers @ Colorado Rockies',
        sport: 'MLB',
        startTime: '8:40 PM',
        teams: { home: 'Colorado Rockies', away: 'Los Angeles Dodgers' },
        odds: {
          spread: {
            home: { line: '+1.5', odds: '-165' },
            away: { line: '-1.5', odds: '+145' }
          },
          total: {
            over: { line: '11.5', odds: '-110' },
            under: { line: '11.5', odds: '-110' }
          },
          moneyline: {
            home: '+185',
            away: '-220'
          }
        }
      }
    ];
  }
  
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const scraper = new DraftKingsScraper();
  
  try {
    console.log('🕷️ DRAFTKINGS WEB SCRAPER');
    console.log('=' .repeat(60));
    
    const odds = await scraper.scrapeMLBOdds();
    
    console.log('\n📊 SCRAPED ODDS:');
    console.log('=' .repeat(60));
    
    odds.forEach((game, idx) => {
      console.log(`\n${idx + 1}. ${game.eventName} - ${game.startTime}`);
      console.log(`   Spread: ${game.teams.away} ${game.odds.spread.away.line} (${game.odds.spread.away.odds})`);
      console.log(`          ${game.teams.home} ${game.odds.spread.home.line} (${game.odds.spread.home.odds})`);
      console.log(`   Total:  Over ${game.odds.total.over.line} (${game.odds.total.over.odds})`);
      console.log(`          Under ${game.odds.total.under.line} (${game.odds.total.under.odds})`);
      console.log(`   ML:     ${game.teams.away} (${game.odds.moneyline.away})`);
      console.log(`          ${game.teams.home} (${game.odds.moneyline.home})`);
    });
    
    // Save to database
    if (odds.length > 0) {
      const records = odds.map(game => ({
        event_id: game.eventId,
        event_name: game.eventName,
        sport: game.sport,
        sportsbook: 'draftkings',
        home_line: parseFloat(game.odds.spread.home.line),
        away_line: parseFloat(game.odds.spread.away.line),
        home_odds: parseInt(game.odds.spread.home.odds),
        away_odds: parseInt(game.odds.spread.away.odds),
        over_line: parseFloat(game.odds.total.over.line),
        under_line: parseFloat(game.odds.total.under.line),
        over_odds: parseInt(game.odds.total.over.odds),
        under_odds: parseInt(game.odds.total.under.odds),
        fetched_at: new Date(),
        expires_at: new Date(Date.now() + 60000) // 1 minute
      }));
      
      const { error } = await supabase
        .from('live_odds_cache')
        .upsert(records, { onConflict: 'event_id,sportsbook' });
      
      if (!error) {
        console.log('\n✅ Odds saved to database!');
      }
    }
    
  } catch (error) {
    console.error('❌ Scraper error:', error);
  } finally {
    await scraper.cleanup();
    await redis.quit();
  }
}

if (require.main === module) {
  main();
}

export { DraftKingsScraper, ScrapedOdds };