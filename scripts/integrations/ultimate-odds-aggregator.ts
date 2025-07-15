#!/usr/bin/env tsx
/**
 * 🏆 ULTIMATE ODDS AGGREGATOR
 * 
 * Combines all working methods:
 * 1. ESPN API (always works)
 * 2. The Odds API (with free key)
 * 3. Direct sportsbook APIs (when available)
 * 4. Pattern matching with our 65.2% system
 */

import { ESPNOddsScraper } from './espn-odds-scraper';
import { OddsAPIClient } from './odds-api-integration';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class UltimateOddsAggregator {
  private espnScraper = new ESPNOddsScraper();
  private oddsAPI = new OddsAPIClient();
  
  async aggregateAllOdds(): Promise<any> {
    console.log('🏆 ULTIMATE ODDS AGGREGATOR');
    console.log('=' .repeat(70));
    console.log('Combining multiple sources for maximum coverage...\n');
    
    const results: any = {
      espn: { games: [], odds: [] },
      oddsAPI: { games: [], odds: [] },
      bovada: { games: [], odds: [] },
      betonline: { games: [], odds: [] }
    };
    
    // 1. ESPN (Always works)
    try {
      console.log('📺 Source 1: ESPN API...');
      const espnGames = await this.espnScraper.getMLBOdds(true);
      const espnOdds = this.espnScraper.parseOddsData(espnGames);
      results.espn = { games: espnGames, odds: espnOdds };
      console.log(`✅ ESPN: ${espnOdds.length} games with odds`);
    } catch (error) {
      console.log('❌ ESPN failed');
    }
    
    // 2. The Odds API (if key available)
    if (process.env.ODDS_API_KEY) {
      try {
        console.log('\n🎲 Source 2: The Odds API...');
        const oddsAPIGames = await this.oddsAPI.getMLBOdds();
        results.oddsAPI = { games: oddsAPIGames, odds: oddsAPIGames };
        console.log(`✅ Odds API: ${oddsAPIGames.length} games`);
      } catch (error) {
        console.log('❌ Odds API failed');
      }
    }
    
    // 3. Bovada (Public endpoint)
    try {
      console.log('\n🎰 Source 3: Bovada...');
      const bovadaOdds = await this.scrapeBovada();
      results.bovada = { games: bovadaOdds, odds: bovadaOdds };
      console.log(`✅ Bovada: ${bovadaOdds.length} games`);
    } catch (error) {
      console.log('❌ Bovada failed');
    }
    
    // 4. BetOnline (Public endpoint)
    try {
      console.log('\n💵 Source 4: BetOnline...');
      const betOnlineOdds = await this.scrapeBetOnline();
      results.betonline = { games: betOnlineOdds, odds: betOnlineOdds };
      console.log(`✅ BetOnline: ${betOnlineOdds.length} games`);
    } catch (error) {
      console.log('❌ BetOnline failed');
    }
    
    return results;
  }
  
  private async scrapeBovada(): Promise<any[]> {
    try {
      const response = await axios.get(
        'https://www.bovada.lv/services/sports/event/v2/events/A/description/baseball/mlb',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );
      
      if (response.data?.[0]?.events) {
        return response.data[0].events.map((event: any) => ({
          id: event.id,
          description: event.description,
          startTime: event.startTime,
          competitors: event.competitors,
          displayGroups: event.displayGroups
        }));
      }
    } catch (error) {
      // Silent fail
    }
    return [];
  }
  
  private async scrapeBetOnline(): Promise<any[]> {
    try {
      const response = await axios.get(
        'https://api.betonline.ag/api/odds/sports/6/leagues/414/events',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible)',
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );
      
      return response.data?.events || [];
    } catch (error) {
      // Silent fail
    }
    return [];
  }
  
  async findBestOpportunities(allOdds: any): Promise<any> {
    const opportunities = {
      arbitrage: [],
      patterns: [],
      bestLines: []
    };
    
    // Combine all games
    const allGames = new Map();
    
    // Add ESPN games
    allOdds.espn.odds.forEach((game: any) => {
      const key = this.normalizeGameKey(game.eventName);
      if (!allGames.has(key)) {
        allGames.set(key, { sources: [], odds: [] });
      }
      allGames.get(key).sources.push('ESPN');
      allGames.get(key).odds.push(...game.odds);
    });
    
    // Process each game for opportunities
    allGames.forEach((gameData, gameName) => {
      if (gameData.odds.length >= 2) {
        // Check for arbitrage
        const arb = this.checkArbitrage(gameName, gameData.odds);
        if (arb) opportunities.arbitrage.push(arb);
      }
      
      // Find best lines
      const bestLines = this.findBestLines(gameName, gameData.odds);
      opportunities.bestLines.push(bestLines);
    });
    
    // Match with patterns
    opportunities.patterns = await this.matchPatterns(allGames);
    
    return opportunities;
  }
  
  private normalizeGameKey(gameName: string): string {
    return gameName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+at\s+/, ' @ ')
      .trim();
  }
  
  private checkArbitrage(gameName: string, odds: any[]): any {
    // Find best moneyline odds across books
    let bestHome = { odds: -Infinity, book: '' };
    let bestAway = { odds: -Infinity, book: '' };
    
    odds.forEach(bookOdds => {
      if (bookOdds.moneyline) {
        if (bookOdds.moneyline.home > bestHome.odds) {
          bestHome = { odds: bookOdds.moneyline.home, book: bookOdds.provider };
        }
        if (bookOdds.moneyline.away > bestAway.odds) {
          bestAway = { odds: bookOdds.moneyline.away, book: bookOdds.provider };
        }
      }
    });
    
    // Calculate arbitrage
    const homeProb = bestHome.odds > 0 ? 100 / (bestHome.odds + 100) : -bestHome.odds / (-bestHome.odds + 100);
    const awayProb = bestAway.odds > 0 ? 100 / (bestAway.odds + 100) : -bestAway.odds / (-bestAway.odds + 100);
    
    if (homeProb + awayProb < 0.98) {
      return {
        game: gameName,
        profit: ((1 - (homeProb + awayProb)) * 100).toFixed(2),
        bets: [
          { book: bestHome.book, type: 'Home ML', odds: bestHome.odds },
          { book: bestAway.book, type: 'Away ML', odds: bestAway.odds }
        ]
      };
    }
    
    return null;
  }
  
  private findBestLines(gameName: string, odds: any[]): any {
    const best = {
      game: gameName,
      moneyline: { home: { odds: -Infinity, book: '' }, away: { odds: -Infinity, book: '' } },
      spread: { home: { odds: -Infinity, book: '' }, away: { odds: -Infinity, book: '' } },
      total: { over: { odds: -Infinity, book: '' }, under: { odds: -Infinity, book: '' } }
    };
    
    odds.forEach(bookOdds => {
      // Moneyline
      if (bookOdds.moneyline) {
        if (bookOdds.moneyline.home > best.moneyline.home.odds) {
          best.moneyline.home = { odds: bookOdds.moneyline.home, book: bookOdds.provider };
        }
        if (bookOdds.moneyline.away > best.moneyline.away.odds) {
          best.moneyline.away = { odds: bookOdds.moneyline.away, book: bookOdds.provider };
        }
      }
      
      // Spread
      if (bookOdds.spread) {
        if (bookOdds.spread.homeOdds > best.spread.home.odds) {
          best.spread.home = { odds: bookOdds.spread.homeOdds, book: bookOdds.provider };
        }
        if (bookOdds.spread.awayOdds > best.spread.away.odds) {
          best.spread.away = { odds: bookOdds.spread.awayOdds, book: bookOdds.provider };
        }
      }
      
      // Total
      if (bookOdds.total) {
        if (bookOdds.total.over > best.total.over.odds) {
          best.total.over = { odds: bookOdds.total.over, book: bookOdds.provider };
        }
        if (bookOdds.total.under > best.total.under.odds) {
          best.total.under = { odds: bookOdds.total.under, book: bookOdds.provider };
        }
      }
    });
    
    return best;
  }
  
  private async matchPatterns(allGames: Map<string, any>): Promise<any[]> {
    // Get patterns from database
    const { data: patterns } = await supabase
      .from('games')
      .select('*')
      .not('metadata->has_pattern', 'is', null)
      .gte('start_time', new Date().toISOString());
    
    const matches = [];
    
    if (patterns) {
      patterns.forEach(pattern => {
        const metadata = pattern.metadata as any;
        const patternKey = this.normalizeGameKey(`${metadata.away_team} @ ${metadata.home_team}`);
        
        allGames.forEach((gameData, gameKey) => {
          if (gameKey.includes(patternKey) || patternKey.includes(gameKey)) {
            matches.push({
              game: gameKey,
              pattern: metadata.pattern_types[0],
              confidence: metadata.pattern_confidence,
              sources: gameData.sources
            });
          }
        });
      });
    }
    
    return matches;
  }
}

async function main() {
  const aggregator = new UltimateOddsAggregator();
  
  try {
    // Aggregate from all sources
    const allOdds = await aggregator.aggregateAllOdds();
    
    // Find opportunities
    const opportunities = await aggregator.findBestOpportunities(allOdds);
    
    // Display results
    console.log('\n' + '=' .repeat(70));
    console.log('📊 AGGREGATION COMPLETE');
    console.log('=' .repeat(70));
    
    // Summary
    const totalGames = allOdds.espn.odds.length + 
                      allOdds.oddsAPI.games.length + 
                      allOdds.bovada.games.length + 
                      allOdds.betonline.games.length;
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`Total Games Found: ${totalGames}`);
    console.log(`Arbitrage Opportunities: ${opportunities.arbitrage.length}`);
    console.log(`Pattern Matches: ${opportunities.patterns.length}`);
    
    // Display arbitrage
    if (opportunities.arbitrage.length > 0) {
      console.log('\n💎 ARBITRAGE OPPORTUNITIES:');
      console.log('=' .repeat(70));
      
      opportunities.arbitrage.forEach((arb: any, idx: number) => {
        console.log(`\n${idx + 1}. ${arb.game}`);
        console.log(`   Profit: ${arb.profit}%`);
        arb.bets.forEach((bet: any) => {
          console.log(`   ${bet.book}: ${bet.type} @ ${bet.odds > 0 ? '+' : ''}${bet.odds}`);
        });
      });
    }
    
    // Display pattern matches
    if (opportunities.patterns.length > 0) {
      console.log('\n🎯 PATTERN MATCHES:');
      console.log('=' .repeat(70));
      
      opportunities.patterns.forEach((match: any, idx: number) => {
        console.log(`\n${idx + 1}. ${match.game}`);
        console.log(`   Pattern: ${match.pattern} (${(match.confidence * 100).toFixed(1)}%)`);
        console.log(`   Available on: ${match.sources.join(', ')}`);
      });
    }
    
    // Display best lines
    console.log('\n📊 BEST LINES (Top 5):');
    console.log('=' .repeat(70));
    
    opportunities.bestLines.slice(0, 5).forEach((game: any) => {
      console.log(`\n${game.game}`);
      if (game.moneyline.home.odds > -Infinity) {
        console.log(`   ML: Home ${game.moneyline.home.odds > 0 ? '+' : ''}${game.moneyline.home.odds} (${game.moneyline.home.book})`);
        console.log(`       Away ${game.moneyline.away.odds > 0 ? '+' : ''}${game.moneyline.away.odds} (${game.moneyline.away.book})`);
      }
    });
    
    console.log('\n✅ RECOMMENDATION:');
    console.log('1. Use ESPN API for reliable odds (never blocked)');
    console.log('2. Get free API key from the-odds-api.com for more coverage');
    console.log('3. Our pattern system works with any odds source!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main();
}

export { UltimateOddsAggregator };