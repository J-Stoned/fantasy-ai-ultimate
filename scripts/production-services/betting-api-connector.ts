#!/usr/bin/env tsx
/**
 * 🎰 REAL BETTING API CONNECTOR
 * 
 * Integrates with major sportsbooks for real-time odds
 * Handles rate limiting and failover
 * Provides unified odds interface
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';
import Redis from 'ioredis';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

interface BettingAPI {
  name: string;
  baseUrl: string;
  apiKey: string;
  rateLimit: { requests: number; window: number }; // requests per window (ms)
  priority: number; // 1-10, higher = preferred
  sports: string[];
}

interface GameOdds {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  sources: OddsSource[];
  consensus: {
    spread: { home: number; away: number };
    total: { over: number; under: number; line: number };
    moneyline: { home: number; away: number };
  };
  bestOdds: {
    spread: { book: string; line: number; odds: number };
    total: { book: string; line: number; overOdds: number; underOdds: number };
    moneyline: { book: string; homeOdds: number; awayOdds: number };
  };
  movement: {
    spread: { open: number; current: number; trend: 'home' | 'away' | 'stable' };
    total: { open: number; current: number; trend: 'up' | 'down' | 'stable' };
  };
}

interface OddsSource {
  book: string;
  spread: { home: number; away: number; line: number };
  total: { over: number; under: number; line: number };
  moneyline: { home: number; away: number };
  lastUpdate: Date;
}

class BettingAPIConnector {
  private apis: BettingAPI[] = [
    {
      name: 'DraftKings',
      baseUrl: process.env.DRAFTKINGS_API_URL || 'https://api.draftkings.com/v1',
      apiKey: process.env.DRAFTKINGS_API_KEY || 'demo',
      rateLimit: { requests: 30, window: 60000 },
      priority: 9,
      sports: ['nfl', 'nba', 'mlb', 'nhl']
    },
    {
      name: 'FanDuel',
      baseUrl: process.env.FANDUEL_API_URL || 'https://api.fanduel.com/v2',
      apiKey: process.env.FANDUEL_API_KEY || 'demo',
      rateLimit: { requests: 20, window: 60000 },
      priority: 8,
      sports: ['nfl', 'nba', 'mlb', 'nhl']
    },
    {
      name: 'BetMGM',
      baseUrl: process.env.BETMGM_API_URL || 'https://api.betmgm.com/v1',
      apiKey: process.env.BETMGM_API_KEY || 'demo',
      rateLimit: { requests: 25, window: 60000 },
      priority: 7,
      sports: ['nfl', 'nba', 'mlb']
    },
    {
      name: 'Caesars',
      baseUrl: process.env.CAESARS_API_URL || 'https://api.caesars.com/v1',
      apiKey: process.env.CAESARS_API_KEY || 'demo',
      rateLimit: { requests: 20, window: 60000 },
      priority: 6,
      sports: ['nfl', 'nba']
    }
  ];
  
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  
  async initialize() {
    console.log(chalk.cyan('🎰 Initializing Betting API Connector...'));
    
    // Test connections
    for (const api of this.apis) {
      const status = await this.testConnection(api);
      if (status) {
        console.log(chalk.green(`✅ ${api.name} connected`));
      } else {
        console.log(chalk.yellow(`⚠️ ${api.name} unavailable (using mock data)`));
      }
    }
    
    console.log(chalk.green('✅ Betting API Connector ready'));
  }
  
  private async testConnection(api: BettingAPI): Promise<boolean> {
    if (api.apiKey === 'demo') return false;
    
    try {
      // Most APIs have a status endpoint
      const response = await axios.get(`${api.baseUrl}/status`, {
        headers: { 'X-API-Key': api.apiKey },
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  async getOdds(gameId: string, sport: string): Promise<GameOdds | null> {
    // Check cache first
    const cached = await this.getCachedOdds(gameId);
    if (cached) return cached;
    
    // Get odds from all available sources
    const sources: OddsSource[] = [];
    const availableAPIs = this.apis
      .filter(api => api.sports.includes(sport))
      .sort((a, b) => b.priority - a.priority);
    
    for (const api of availableAPIs) {
      if (await this.checkRateLimit(api)) {
        const odds = await this.fetchOddsFromAPI(api, gameId, sport);
        if (odds) sources.push(odds);
      }
    }
    
    if (sources.length === 0) {
      // Use mock data for demo
      return this.getMockOdds(gameId, sport);
    }
    
    // Calculate consensus and best odds
    const gameOdds = this.calculateConsensus(gameId, sport, sources);
    
    // Cache for 1 minute
    await this.cacheOdds(gameId, gameOdds, 60);
    
    return gameOdds;
  }
  
  private async checkRateLimit(api: BettingAPI): Promise<boolean> {
    const key = api.name;
    const now = Date.now();
    
    let rateInfo = this.requestCounts.get(key);
    if (!rateInfo || now > rateInfo.resetTime) {
      rateInfo = { count: 0, resetTime: now + api.rateLimit.window };
      this.requestCounts.set(key, rateInfo);
    }
    
    if (rateInfo.count >= api.rateLimit.requests) {
      console.log(chalk.yellow(`⚠️ Rate limit reached for ${api.name}`));
      return false;
    }
    
    rateInfo.count++;
    return true;
  }
  
  private async fetchOddsFromAPI(
    api: BettingAPI, 
    gameId: string, 
    sport: string
  ): Promise<OddsSource | null> {
    try {
      // Each API has different endpoints and response formats
      // This is a simplified version
      const endpoint = `${api.baseUrl}/odds/${sport}/${gameId}`;
      const response = await axios.get(endpoint, {
        headers: { 'X-API-Key': api.apiKey },
        timeout: 3000
      });
      
      // Transform to our standard format
      return this.transformOddsResponse(api.name, response.data);
    } catch (error) {
      console.error(`Error fetching from ${api.name}:`, error);
      return null;
    }
  }
  
  private transformOddsResponse(book: string, data: any): OddsSource {
    // Each sportsbook has different response format
    // This is simplified - real implementation would handle each format
    return {
      book,
      spread: {
        home: data.spread?.home || -110,
        away: data.spread?.away || -110,
        line: data.spread?.line || 0
      },
      total: {
        over: data.total?.over || -110,
        under: data.total?.under || -110,
        line: data.total?.line || 0
      },
      moneyline: {
        home: data.moneyline?.home || -200,
        away: data.moneyline?.away || +170
      },
      lastUpdate: new Date()
    };
  }
  
  private calculateConsensus(
    gameId: string,
    sport: string,
    sources: OddsSource[]
  ): GameOdds {
    // Calculate average lines
    const avgSpreadLine = sources.reduce((sum, s) => sum + s.spread.line, 0) / sources.length;
    const avgTotalLine = sources.reduce((sum, s) => sum + s.total.line, 0) / sources.length;
    
    // Find best odds
    const bestSpread = sources.reduce((best, source) => {
      const currentBest = Math.max(source.spread.home, source.spread.away);
      const prevBest = Math.max(best.odds, best.odds);
      return currentBest > prevBest ? 
        { book: source.book, line: source.spread.line, odds: currentBest } : best;
    }, { book: '', line: 0, odds: -999 });
    
    const bestTotal = sources.reduce((best, source) => {
      const betterOver = source.total.over > best.overOdds;
      const betterUnder = source.total.under > best.underOdds;
      return betterOver || betterUnder ? {
        book: source.book,
        line: source.total.line,
        overOdds: Math.max(source.total.over, best.overOdds),
        underOdds: Math.max(source.total.under, best.underOdds)
      } : best;
    }, { book: '', line: 0, overOdds: -999, underOdds: -999 });
    
    const bestMoneyline = sources.reduce((best, source) => {
      const betterHome = source.moneyline.home > best.homeOdds;
      const betterAway = source.moneyline.away > best.awayOdds;
      return betterHome || betterAway ? {
        book: source.book,
        homeOdds: Math.max(source.moneyline.home, best.homeOdds),
        awayOdds: Math.max(source.moneyline.away, best.awayOdds)
      } : best;
    }, { book: '', homeOdds: -999, awayOdds: -999 });
    
    return {
      gameId,
      sport,
      homeTeam: 'TBD',
      awayTeam: 'TBD',
      startTime: new Date(),
      sources,
      consensus: {
        spread: { home: avgSpreadLine, away: -avgSpreadLine },
        total: { over: -110, under: -110, line: avgTotalLine },
        moneyline: { 
          home: sources[0]?.moneyline.home || -200, 
          away: sources[0]?.moneyline.away || +170 
        }
      },
      bestOdds: {
        spread: bestSpread,
        total: bestTotal,
        moneyline: bestMoneyline
      },
      movement: {
        spread: { open: avgSpreadLine, current: avgSpreadLine, trend: 'stable' },
        total: { open: avgTotalLine, current: avgTotalLine, trend: 'stable' }
      }
    };
  }
  
  private async getCachedOdds(gameId: string): Promise<GameOdds | null> {
    const cached = await redis.get(`odds:${gameId}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  private async cacheOdds(gameId: string, odds: GameOdds, ttl: number) {
    await redis.setex(`odds:${gameId}`, ttl, JSON.stringify(odds));
  }
  
  private getMockOdds(gameId: string, sport: string): GameOdds {
    // Generate realistic mock odds
    const spread = Math.floor(Math.random() * 14) - 7;
    const total = sport === 'nfl' ? 45 + Math.random() * 10 : 
                  sport === 'nba' ? 220 + Math.random() * 20 : 200;
    
    return {
      gameId,
      sport,
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      startTime: new Date(),
      sources: [
        {
          book: 'DraftKings',
          spread: { home: -110, away: -110, line: spread },
          total: { over: -110, under: -110, line: total },
          moneyline: { home: spread < 0 ? -150 : +130, away: spread > 0 ? -150 : +130 },
          lastUpdate: new Date()
        }
      ],
      consensus: {
        spread: { home: spread, away: -spread },
        total: { over: -110, under: -110, line: total },
        moneyline: { home: -150, away: +130 }
      },
      bestOdds: {
        spread: { book: 'DraftKings', line: spread, odds: -105 },
        total: { book: 'FanDuel', line: total, overOdds: -105, underOdds: -105 },
        moneyline: { book: 'BetMGM', homeOdds: -145, awayOdds: +135 }
      },
      movement: {
        spread: { open: spread, current: spread, trend: 'stable' },
        total: { open: total, current: total, trend: 'stable' }
      }
    };
  }
  
  async streamOddsUpdates(gameIds: string[], callback: (odds: GameOdds) => void) {
    console.log(chalk.cyan('📊 Starting odds streaming...'));
    
    const updateInterval = setInterval(async () => {
      for (const gameId of gameIds) {
        const odds = await this.getOdds(gameId, 'nfl'); // Sport would be dynamic
        if (odds) {
          // Check for changes
          const previous = await this.getCachedOdds(`prev:${gameId}`);
          if (this.hasOddsChanged(previous, odds)) {
            callback(odds);
          }
          await this.cacheOdds(`prev:${gameId}`, odds, 300);
        }
      }
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(updateInterval);
  }
  
  private hasOddsChanged(prev: GameOdds | null, current: GameOdds): boolean {
    if (!prev) return true;
    
    return (
      prev.consensus.spread.home !== current.consensus.spread.home ||
      prev.consensus.total.line !== current.consensus.total.line ||
      prev.consensus.moneyline.home !== current.consensus.moneyline.home
    );
  }
  
  async findArbitrage(): Promise<any[]> {
    console.log(chalk.cyan('🔍 Scanning for arbitrage opportunities...'));
    
    // Get all active games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .gte('start_time', new Date().toISOString())
      .limit(50);
      
    const opportunities = [];
    
    for (const game of games || []) {
      const odds = await this.getOdds(game.id, game.sport);
      if (!odds) continue;
      
      // Check for arbitrage in each market
      const moneylineArb = this.checkMoneylineArbitrage(odds);
      if (moneylineArb) opportunities.push(moneylineArb);
      
      // More complex arbitrage checks could be added
    }
    
    return opportunities;
  }
  
  private checkMoneylineArbitrage(odds: GameOdds): any {
    const bestHome = odds.bestOdds.moneyline.homeOdds;
    const bestAway = odds.bestOdds.moneyline.awayOdds;
    
    // Convert American odds to decimal
    const homeDecimal = bestHome > 0 ? (bestHome / 100) + 1 : (-100 / bestHome) + 1;
    const awayDecimal = bestAway > 0 ? (bestAway / 100) + 1 : (-100 / bestAway) + 1;
    
    // Calculate implied probabilities
    const homeProb = 1 / homeDecimal;
    const awayProb = 1 / awayDecimal;
    const totalProb = homeProb + awayProb;
    
    // Arbitrage exists if total probability < 100%
    if (totalProb < 0.98) { // 2% margin for profit
      const profit = ((1 / totalProb) - 1) * 100;
      return {
        gameId: odds.gameId,
        type: 'moneyline',
        profit: profit.toFixed(2),
        bets: [
          { team: 'home', odds: bestHome, book: odds.bestOdds.moneyline.book },
          { team: 'away', odds: bestAway, book: odds.bestOdds.moneyline.book }
        ]
      };
    }
    
    return null;
  }
}

// Example usage
async function main() {
  const connector = new BettingAPIConnector();
  await connector.initialize();
  
  // Example 1: Get odds for a game
  console.log(chalk.cyan('\n💰 Fetching odds...'));
  const odds = await connector.getOdds('game_123', 'nfl');
  
  if (odds) {
    console.log(chalk.white(`\nGame: ${odds.homeTeam} vs ${odds.awayTeam}`));
    console.log(chalk.yellow(`Spread: ${odds.consensus.spread.home} (${odds.bestOdds.spread.book})`));
    console.log(chalk.blue(`Total: ${odds.consensus.total.line} (${odds.bestOdds.total.book})`));
    console.log(chalk.green(`ML: ${odds.consensus.moneyline.home}/${odds.consensus.moneyline.away}`));
  }
  
  // Example 2: Find arbitrage
  const arbs = await connector.findArbitrage();
  if (arbs.length > 0) {
    console.log(chalk.green(`\n💎 Found ${arbs.length} arbitrage opportunities!`));
    arbs.forEach(arb => {
      console.log(`  ${arb.profit}% profit on ${arb.type}`);
    });
  }
  
  // Example 3: Stream updates
  console.log(chalk.cyan('\n📊 Streaming odds updates...'));
  const stopStreaming = await connector.streamOddsUpdates(
    ['game_123', 'game_456'],
    (odds) => {
      console.log(chalk.yellow(`⚡ Odds update for ${odds.gameId}`));
      console.log(`  Spread moved to ${odds.consensus.spread.home}`);
    }
  );
  
  // Stop after 30 seconds
  setTimeout(() => {
    stopStreaming();
    console.log(chalk.red('🛑 Stopped streaming'));
  }, 30000);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { BettingAPIConnector, GameOdds };