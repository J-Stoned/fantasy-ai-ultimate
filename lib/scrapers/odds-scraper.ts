/**
 * 🎰 SPORTS BETTING ODDS SCRAPER
 * Collects odds from major sportsbooks via APIs
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The Odds API - Free tier available
const ODDS_API_KEY = process.env.ODDS_API_KEY || 'demo_key';
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export interface OddsData {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: Date;
  bookmakers: BookmakerOdds[];
  bestOdds: {
    homeWin: { odds: number; bookmaker: string };
    awayWin: { odds: number; bookmaker: string };
    draw?: { odds: number; bookmaker: string };
  };
  impliedProbabilities: {
    home: number;
    away: number;
    draw?: number;
  };
  arbitrageOpportunity?: {
    exists: boolean;
    profit?: number;
    stakes?: {
      home: number;
      away: number;
      draw?: number;
    };
  };
}

export interface BookmakerOdds {
  bookmaker: string;
  lastUpdate: Date;
  markets: {
    h2h?: {
      home: number;
      away: number;
      draw?: number;
    };
    spreads?: {
      home: { point: number; odds: number };
      away: { point: number; odds: number };
    };
    totals?: {
      over: { point: number; odds: number };
      under: { point: number; odds: number };
    };
  };
}

export class OddsScraper {
  private cache = new Map<string, { data: OddsData; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch odds for a specific sport
   */
  async fetchOdds(sport: string = 'basketball_nba'): Promise<OddsData[]> {
    console.log(chalk.bold.cyan(`🎰 Fetching odds for ${sport}...`));

    try {
      // Get upcoming games
      const gamesResponse = await axios.get(`${ODDS_API_BASE}/sports/${sport}/odds`, {
        params: {
          apiKey: ODDS_API_KEY,
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american'
        }
      });

      const games = gamesResponse.data;
      console.log(chalk.green(`✅ Found ${games.length} games with odds`));

      const oddsData: OddsData[] = [];

      for (const game of games) {
        const odds = this.parseGameOdds(game);
        oddsData.push(odds);
        
        // Cache the odds
        this.cache.set(game.id, {
          data: odds,
          timestamp: Date.now()
        });
      }

      // Store in database
      await this.storeOdds(oddsData);

      return oddsData;
    } catch (error: any) {
      console.error(chalk.red('Failed to fetch odds:'), error.message);
      throw error;
    }
  }

  /**
   * Parse raw odds data from API
   */
  private parseGameOdds(game: any): OddsData {
    const bookmakers: BookmakerOdds[] = [];
    let bestHome = { odds: -Infinity, bookmaker: '' };
    let bestAway = { odds: -Infinity, bookmaker: '' };
    let bestDraw = { odds: -Infinity, bookmaker: '' };

    // Process each bookmaker
    for (const bookmaker of game.bookmakers) {
      const markets: any = {};

      // Head to head odds
      const h2h = bookmaker.markets.find((m: any) => m.key === 'h2h');
      if (h2h) {
        const homeOdds = h2h.outcomes.find((o: any) => o.name === game.home_team)?.price || 0;
        const awayOdds = h2h.outcomes.find((o: any) => o.name === game.away_team)?.price || 0;
        const drawOdds = h2h.outcomes.find((o: any) => o.name === 'Draw')?.price;

        markets.h2h = {
          home: homeOdds,
          away: awayOdds,
          ...(drawOdds && { draw: drawOdds })
        };

        // Track best odds
        if (homeOdds > bestHome.odds) {
          bestHome = { odds: homeOdds, bookmaker: bookmaker.title };
        }
        if (awayOdds > bestAway.odds) {
          bestAway = { odds: awayOdds, bookmaker: bookmaker.title };
        }
        if (drawOdds && drawOdds > bestDraw.odds) {
          bestDraw = { odds: drawOdds, bookmaker: bookmaker.title };
        }
      }

      // Spreads
      const spreads = bookmaker.markets.find((m: any) => m.key === 'spreads');
      if (spreads) {
        const homeSpread = spreads.outcomes.find((o: any) => o.name === game.home_team);
        const awaySpread = spreads.outcomes.find((o: any) => o.name === game.away_team);
        
        if (homeSpread && awaySpread) {
          markets.spreads = {
            home: { point: homeSpread.point, odds: homeSpread.price },
            away: { point: awaySpread.point, odds: awaySpread.price }
          };
        }
      }

      // Totals
      const totals = bookmaker.markets.find((m: any) => m.key === 'totals');
      if (totals) {
        const over = totals.outcomes.find((o: any) => o.name === 'Over');
        const under = totals.outcomes.find((o: any) => o.name === 'Under');
        
        if (over && under) {
          markets.totals = {
            over: { point: over.point, odds: over.price },
            under: { point: under.point, odds: under.price }
          };
        }
      }

      bookmakers.push({
        bookmaker: bookmaker.title,
        lastUpdate: new Date(bookmaker.last_update),
        markets
      });
    }

    // Calculate implied probabilities
    const impliedProbabilities = this.calculateImpliedProbabilities(
      bestHome.odds,
      bestAway.odds,
      bestDraw.odds
    );

    // Check for arbitrage
    const arbitrageOpportunity = this.checkArbitrage(
      bestHome.odds,
      bestAway.odds,
      bestDraw.odds
    );

    return {
      gameId: game.id,
      sport: game.sport_key,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      commenceTime: new Date(game.commence_time),
      bookmakers,
      bestOdds: {
        homeWin: bestHome,
        awayWin: bestAway,
        ...(bestDraw.odds > -Infinity && { draw: bestDraw })
      },
      impliedProbabilities,
      arbitrageOpportunity
    };
  }

  /**
   * Convert American odds to implied probability
   */
  private americanToImpliedProb(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  /**
   * Calculate implied probabilities from best odds
   */
  private calculateImpliedProbabilities(
    homeOdds: number,
    awayOdds: number,
    drawOdds?: number
  ) {
    const homeProb = this.americanToImpliedProb(homeOdds);
    const awayProb = this.americanToImpliedProb(awayOdds);
    const drawProb = drawOdds ? this.americanToImpliedProb(drawOdds) : undefined;

    // Normalize to sum to 1
    const total = homeProb + awayProb + (drawProb || 0);

    return {
      home: homeProb / total,
      away: awayProb / total,
      ...(drawProb && { draw: drawProb / total })
    };
  }

  /**
   * Check if arbitrage opportunity exists
   */
  private checkArbitrage(
    homeOdds: number,
    awayOdds: number,
    drawOdds?: number
  ) {
    const homeProb = this.americanToImpliedProb(homeOdds);
    const awayProb = this.americanToImpliedProb(awayOdds);
    const drawProb = drawOdds ? this.americanToImpliedProb(drawOdds) : 0;

    const totalProb = homeProb + awayProb + drawProb;

    if (totalProb < 1) {
      // Arbitrage opportunity exists
      const profit = (1 / totalProb - 1) * 100;
      
      // Calculate optimal stakes for $100 total investment
      const totalStake = 100;
      const homeStake = (homeProb / totalProb) * totalStake;
      const awayStake = (awayProb / totalProb) * totalStake;
      const drawStake = drawProb ? (drawProb / totalProb) * totalStake : undefined;

      return {
        exists: true,
        profit,
        stakes: {
          home: homeStake,
          away: awayStake,
          ...(drawStake && { draw: drawStake })
        }
      };
    }

    return { exists: false };
  }

  /**
   * Store odds in database
   */
  private async storeOdds(oddsData: OddsData[]) {
    console.log(chalk.yellow('💾 Storing odds in database...'));

    for (const odds of oddsData) {
      try {
        // Find matching game in our database
        const { data: games } = await supabase
          .from('games')
          .select('id')
          .ilike('home_team_id', `%${odds.homeTeam}%`)
          .ilike('away_team_id', `%${odds.awayTeam}%`)
          .gte('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (games && games.length > 0) {
          // Store odds
          await supabase.from('betting_odds').upsert({
            game_id: games[0].id,
            bookmaker_data: odds.bookmakers,
            best_odds: odds.bestOdds,
            implied_probabilities: odds.impliedProbabilities,
            arbitrage_opportunity: odds.arbitrageOpportunity,
            last_updated: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(chalk.red(`Failed to store odds for ${odds.homeTeam} vs ${odds.awayTeam}`));
      }
    }

    console.log(chalk.green('✅ Odds stored successfully'));
  }

  /**
   * Get cached odds for a game
   */
  getCachedOdds(gameId: string): OddsData | null {
    const cached = this.cache.get(gameId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Find arbitrage opportunities across all games
   */
  async findArbitrageOpportunities(): Promise<OddsData[]> {
    console.log(chalk.bold.yellow('💰 Searching for arbitrage opportunities...'));

    const allOdds = await this.fetchOdds();
    const opportunities = allOdds.filter(odds => odds.arbitrageOpportunity?.exists);

    if (opportunities.length > 0) {
      console.log(chalk.bold.green(`\n🎯 Found ${opportunities.length} arbitrage opportunities!\n`));

      opportunities.forEach(opp => {
        console.log(chalk.bold(`${opp.homeTeam} vs ${opp.awayTeam}`));
        console.log(chalk.green(`  Profit: ${opp.arbitrageOpportunity!.profit!.toFixed(2)}%`));
        console.log(chalk.cyan(`  Stakes: Home $${opp.arbitrageOpportunity!.stakes!.home.toFixed(2)}, Away $${opp.arbitrageOpportunity!.stakes!.away.toFixed(2)}`));
        console.log(chalk.gray(`  Best odds: ${opp.bestOdds.homeWin.bookmaker} (${opp.bestOdds.homeWin.odds}), ${opp.bestOdds.awayWin.bookmaker} (${opp.bestOdds.awayWin.odds})`));
        console.log('');
      });
    } else {
      console.log(chalk.gray('No arbitrage opportunities found'));
    }

    return opportunities;
  }
}