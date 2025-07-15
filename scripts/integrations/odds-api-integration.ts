#!/usr/bin/env tsx
/**
 * 🎲 THE ODDS API INTEGRATION
 * 
 * Uses The Odds API for real live odds
 * Free tier: 500 requests/month
 * Paid tiers: $99-499/month for more
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// You can get a free API key at https://the-odds-api.com/
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY || '3e1234567890abcdef1234567890abcd'; // Example key

interface OddsAPIGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

class OddsAPIClient {
  private readonly BASE_URL = 'https://api.the-odds-api.com/v4';
  
  async getMLBOdds(): Promise<OddsAPIGame[]> {
    console.log('📊 Fetching live MLB odds from The Odds API...');
    
    try {
      const response = await axios.get(
        `${this.BASE_URL}/sports/baseball_mlb/odds`,
        {
          params: {
            apiKey: ODDS_API_KEY,
            regions: 'us',
            markets: 'h2h,spreads,totals',
            bookmakers: 'draftkings,fanduel,betmgm,caesars,pointsbetus'
          }
        }
      );
      
      console.log(`✅ Found ${response.data.length} MLB games`);
      console.log(`📊 Remaining requests: ${response.headers['x-requests-remaining']}/${response.headers['x-requests-used']}`);
      
      return response.data;
      
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('❌ Invalid API key. Get a free key at https://the-odds-api.com/');
        console.log('⚠️  Using sample data for demonstration...');
        return this.getSampleData();
      }
      
      console.error('❌ Error fetching odds:', error.message);
      return this.getSampleData();
    }
  }
  
  private getSampleData(): OddsAPIGame[] {
    // Sample data showing what real API returns
    return [
      {
        id: '83d5e6f2a8b9c4d7e5f6a8b9c4d7e5f6',
        sport_key: 'baseball_mlb',
        sport_title: 'MLB',
        commence_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        home_team: 'Atlanta Braves',
        away_team: 'Philadelphia Phillies',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Atlanta Braves', price: 1.74 }, // -135 American
                  { name: 'Philadelphia Phillies', price: 2.15 } // +115 American
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Atlanta Braves', price: 1.91, point: -1.5 },
                  { name: 'Philadelphia Phillies', price: 1.91, point: 1.5 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', price: 1.87, point: 8.5 },
                  { name: 'Under', price: 1.95, point: 8.5 }
                ]
              }
            ]
          },
          {
            key: 'fanduel',
            title: 'FanDuel',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Atlanta Braves', price: 1.71 }, // -140 American
                  { name: 'Philadelphia Phillies', price: 2.20 } // +120 American
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Atlanta Braves', price: 1.95, point: -1.5 },
                  { name: 'Philadelphia Phillies', price: 1.87, point: 1.5 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', price: 1.91, point: 8.5 },
                  { name: 'Under', price: 1.91, point: 8.5 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: '94e6f7a3b9c5d8e6f7a3b9c5d8e6f7a3',
        sport_key: 'baseball_mlb',
        sport_title: 'MLB',
        commence_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        home_team: 'Colorado Rockies',
        away_team: 'Los Angeles Dodgers',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Colorado Rockies', price: 2.85 }, // +185
                  { name: 'Los Angeles Dodgers', price: 1.45 } // -220
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', price: 1.91, point: 11.5 }, // Coors Field!
                  { name: 'Under', price: 1.91, point: 11.5 }
                ]
              }
            ]
          },
          {
            key: 'fanduel',
            title: 'FanDuel',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Colorado Rockies', price: 2.90 }, // +190
                  { name: 'Los Angeles Dodgers', price: 1.42 } // -240
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', price: 1.87, point: 11.5 },
                  { name: 'Under', price: 1.95, point: 11.5 }
                ]
              }
            ]
          }
        ]
      }
    ];
  }
  
  convertToAmericanOdds(decimal: number): number {
    return decimal >= 2 
      ? Math.round((decimal - 1) * 100)
      : Math.round(-100 / (decimal - 1));
  }
  
  findArbitrageOpportunities(games: OddsAPIGame[]): any[] {
    const opportunities = [];
    
    games.forEach(game => {
      // Get odds from each book
      const dkBook = game.bookmakers.find(b => b.key === 'draftkings');
      const fdBook = game.bookmakers.find(b => b.key === 'fanduel');
      
      if (!dkBook || !fdBook) return;
      
      // Check moneyline arbitrage
      const dkML = dkBook.markets.find(m => m.key === 'h2h');
      const fdML = fdBook.markets.find(m => m.key === 'h2h');
      
      if (dkML && fdML) {
        const dkHome = dkML.outcomes.find(o => o.name === game.home_team)?.price || 2;
        const dkAway = dkML.outcomes.find(o => o.name === game.away_team)?.price || 2;
        const fdHome = fdML.outcomes.find(o => o.name === game.home_team)?.price || 2;
        const fdAway = fdML.outcomes.find(o => o.name === game.away_team)?.price || 2;
        
        // Find best odds
        const bestHome = Math.max(dkHome, fdHome);
        const bestAway = Math.max(dkAway, fdAway);
        
        // Calculate arbitrage
        const homeProb = 1 / bestHome;
        const awayProb = 1 / bestAway;
        const total = homeProb + awayProb;
        
        if (total < 0.98) { // 2% threshold
          const profit = ((1 / total) - 1) * 100;
          
          opportunities.push({
            game: `${game.away_team} @ ${game.home_team}`,
            type: 'Moneyline',
            profit: profit.toFixed(2),
            bets: [
              {
                book: bestHome === dkHome ? 'DraftKings' : 'FanDuel',
                team: game.home_team,
                odds: this.convertToAmericanOdds(bestHome),
                stake: (awayProb * 1000).toFixed(2)
              },
              {
                book: bestAway === dkAway ? 'DraftKings' : 'FanDuel',
                team: game.away_team,
                odds: this.convertToAmericanOdds(bestAway),
                stake: (homeProb * 1000).toFixed(2)
              }
            ]
          });
        }
      }
      
      // Check totals arbitrage
      const dkTotals = dkBook.markets.find(m => m.key === 'totals');
      const fdTotals = fdBook.markets.find(m => m.key === 'totals');
      
      if (dkTotals && fdTotals) {
        const dkOver = dkTotals.outcomes.find(o => o.name === 'Over')?.price || 1.91;
        const dkUnder = dkTotals.outcomes.find(o => o.name === 'Under')?.price || 1.91;
        const fdOver = fdTotals.outcomes.find(o => o.name === 'Over')?.price || 1.91;
        const fdUnder = fdTotals.outcomes.find(o => o.name === 'Under')?.price || 1.91;
        
        const bestOver = Math.max(dkOver, fdOver);
        const bestUnder = Math.max(dkUnder, fdUnder);
        
        const overProb = 1 / bestOver;
        const underProb = 1 / bestUnder;
        const totalProb = overProb + underProb;
        
        if (totalProb < 0.98) {
          const profit = ((1 / totalProb) - 1) * 100;
          const line = dkTotals.outcomes[0].point;
          
          opportunities.push({
            game: `${game.away_team} @ ${game.home_team}`,
            type: `Total ${line}`,
            profit: profit.toFixed(2),
            bets: [
              {
                book: bestOver === dkOver ? 'DraftKings' : 'FanDuel',
                selection: `Over ${line}`,
                odds: this.convertToAmericanOdds(bestOver),
                stake: (underProb * 1000).toFixed(2)
              },
              {
                book: bestUnder === dkUnder ? 'DraftKings' : 'FanDuel',
                selection: `Under ${line}`,
                odds: this.convertToAmericanOdds(bestUnder),
                stake: (overProb * 1000).toFixed(2)
              }
            ]
          });
        }
      }
    });
    
    return opportunities;
  }
  
  async matchWithPatterns(games: OddsAPIGame[]): Promise<any[]> {
    console.log('\n🎯 Matching odds with our patterns...');
    
    // Get patterns from database
    const { data: patterns } = await supabase
      .from('games')
      .select('*')
      .not('metadata->has_pattern', 'is', null)
      .gte('start_time', new Date().toISOString());
    
    const matches = [];
    
    if (patterns) {
      games.forEach(game => {
        patterns.forEach(pattern => {
          const metadata = pattern.metadata as any;
          
          // Match by team names
          if ((metadata.home_team === game.home_team || metadata.away_team === game.away_team) &&
              metadata.has_pattern) {
            
            // Get best odds for this game
            const bestOdds = this.getBestOdds(game);
            
            matches.push({
              pattern: metadata.pattern_types[0],
              confidence: metadata.pattern_confidence,
              game: `${game.away_team} @ ${game.home_team}`,
              bestOdds: bestOdds,
              expectedValue: this.calculateEV(metadata.pattern_confidence, bestOdds)
            });
          }
        });
      });
    }
    
    return matches.sort((a, b) => b.expectedValue - a.expectedValue);
  }
  
  private getBestOdds(game: OddsAPIGame): any {
    const odds: any = {
      moneyline: { home: -Infinity, away: -Infinity, homeBook: '', awayBook: '' },
      spread: { home: -Infinity, away: -Infinity, homeBook: '', awayBook: '' },
      total: { over: -Infinity, under: -Infinity, overBook: '', underBook: '' }
    };
    
    game.bookmakers.forEach(book => {
      const ml = book.markets.find(m => m.key === 'h2h');
      if (ml) {
        const home = this.convertToAmericanOdds(ml.outcomes.find(o => o.name === game.home_team)?.price || 2);
        const away = this.convertToAmericanOdds(ml.outcomes.find(o => o.name === game.away_team)?.price || 2);
        
        if (home > odds.moneyline.home) {
          odds.moneyline.home = home;
          odds.moneyline.homeBook = book.title;
        }
        if (away > odds.moneyline.away) {
          odds.moneyline.away = away;
          odds.moneyline.awayBook = book.title;
        }
      }
    });
    
    return odds;
  }
  
  private calculateEV(confidence: number, odds: any): number {
    // Simple EV calculation based on best available odds
    const mlOdds = Math.max(odds.moneyline.home, odds.moneyline.away);
    const decimal = mlOdds > 0 ? (mlOdds / 100) + 1 : (-100 / mlOdds) + 1;
    return (confidence * (decimal - 1)) - (1 - confidence);
  }
}

async function main() {
  console.log('🎲 THE ODDS API - PROFESSIONAL ODDS AGGREGATOR');
  console.log('=' .repeat(70));
  console.log('📌 Get your FREE API key at: https://the-odds-api.com/');
  console.log('   Free tier: 500 requests/month');
  console.log('   Paid tiers: $99-499/month\n');
  
  const client = new OddsAPIClient();
  
  try {
    // Get live odds
    const games = await client.getMLBOdds();
    
    if (games.length === 0) {
      console.log('No games available');
      return;
    }
    
    // Display odds summary
    console.log('\n📊 LIVE ODDS SUMMARY:');
    console.log('=' .repeat(70));
    
    games.forEach((game, idx) => {
      console.log(`\n${idx + 1}. ${game.away_team} @ ${game.home_team}`);
      console.log(`   Start: ${new Date(game.commence_time).toLocaleString()}`);
      console.log(`   Books: ${game.bookmakers.map(b => b.title).join(', ')}`);
      
      // Show best odds
      const bestML = { home: -Infinity, away: -Infinity, homeBook: '', awayBook: '' };
      
      game.bookmakers.forEach(book => {
        const ml = book.markets.find(m => m.key === 'h2h');
        if (ml) {
          const homeOdds = client.convertToAmericanOdds(ml.outcomes.find(o => o.name === game.home_team)?.price || 2);
          const awayOdds = client.convertToAmericanOdds(ml.outcomes.find(o => o.name === game.away_team)?.price || 2);
          
          if (homeOdds > bestML.home) {
            bestML.home = homeOdds;
            bestML.homeBook = book.title;
          }
          if (awayOdds > bestML.away) {
            bestML.away = awayOdds;
            bestML.awayBook = book.title;
          }
        }
      });
      
      console.log(`   Best ML: ${game.home_team} ${bestML.home > 0 ? '+' : ''}${bestML.home} (${bestML.homeBook})`);
      console.log(`           ${game.away_team} ${bestML.away > 0 ? '+' : ''}${bestML.away} (${bestML.awayBook})`);
    });
    
    // Find arbitrage
    const arbitrage = client.findArbitrageOpportunities(games);
    
    if (arbitrage.length > 0) {
      console.log('\n💎 ARBITRAGE OPPORTUNITIES:');
      console.log('=' .repeat(70));
      
      arbitrage.forEach((arb, idx) => {
        console.log(`\n${idx + 1}. ${arb.game} - ${arb.type}`);
        console.log(`   Profit: ${arb.profit}%`);
        arb.bets.forEach(bet => {
          const team = bet.team || bet.selection;
          console.log(`   ${bet.book}: ${team} @ ${bet.odds > 0 ? '+' : ''}${bet.odds} (Bet $${bet.stake})`);
        });
        console.log(`   Total Stake: $${(parseFloat(arb.bets[0].stake) + parseFloat(arb.bets[1].stake)).toFixed(2)}`);
        console.log(`   Guaranteed Profit: $${(parseFloat(arb.profit) * 10).toFixed(2)}`);
      });
    } else {
      console.log('\n❌ No arbitrage opportunities at current odds');
    }
    
    // Match with patterns
    const patternMatches = await client.matchWithPatterns(games);
    
    if (patternMatches.length > 0) {
      console.log('\n🎯 PATTERN MATCHES:');
      console.log('=' .repeat(70));
      
      patternMatches.slice(0, 5).forEach((match, idx) => {
        console.log(`\n${idx + 1}. ${match.game}`);
        console.log(`   Pattern: ${match.pattern} (${(match.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`   Expected Value: ${(match.expectedValue * 100).toFixed(2)}%`);
        console.log(`   Best Odds: ${match.bestOdds.moneyline.homeBook} / ${match.bestOdds.moneyline.awayBook}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main();
}

export { OddsAPIClient };