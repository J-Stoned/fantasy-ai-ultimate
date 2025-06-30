/**
 * The Odds API Integration
 * 
 * Free tier: 500 requests/month
 * Provides betting lines from 70+ bookmakers
 */

import { redis } from '@/lib/redis';

const ODDS_API_KEY = process.env.ODDS_API_KEY || 'demo';
const ODDS_BASE_URL = 'https://api.the-odds-api.com/v4';
const CACHE_TTL = 300; // 5 minute cache for odds

export interface OddsData {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commence_time: string;
  bookmakers: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: {
        name: string;
        price: number;
        point?: number;
      }[];
    }[];
  }[];
  consensus: {
    spread: {
      home: number;
      away: number;
    };
    total: {
      over: number;
      under: number;
      points: number;
    };
    moneyline: {
      home: number;
      away: number;
    };
  };
}

export interface PropBet {
  playerId: string;
  playerName: string;
  market: string;
  line: number;
  over: number;
  under: number;
  bookmaker: string;
}

export class OddsAPI {
  private async fetchOdds<T>(endpoint: string): Promise<T> {
    const cacheKey = `odds:${endpoint}`;
    
    // Check cache
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from API
    const url = `${ODDS_BASE_URL}${endpoint}?apiKey=${ODDS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache result
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get available sports
   */
  async getSports() {
    return this.fetchOdds<any[]>('/sports');
  }

  /**
   * Get odds for a specific sport
   */
  async getOdds(sport: string, markets: string[] = ['h2h', 'spreads', 'totals']): Promise<OddsData[]> {
    const marketString = markets.join(',');
    const data = await this.fetchOdds<any[]>(
      `/sports/${sport}/odds?markets=${marketString}&regions=us`
    );

    return data.map(game => this.parseOddsData(game));
  }

  /**
   * Get player props
   */
  async getPlayerProps(sport: string, gameId: string): Promise<PropBet[]> {
    const data = await this.fetchOdds<any>(
      `/sports/${sport}/events/${gameId}/odds?markets=player_props&regions=us`
    );

    return this.parsePlayerProps(data);
  }

  /**
   * Parse raw odds data
   */
  private parseOddsData(data: any): OddsData {
    const consensus = this.calculateConsensus(data.bookmakers);

    return {
      gameId: data.id,
      homeTeam: data.home_team,
      awayTeam: data.away_team,
      commence_time: data.commence_time,
      bookmakers: data.bookmakers,
      consensus,
    };
  }

  /**
   * Calculate consensus lines from all bookmakers
   */
  private calculateConsensus(bookmakers: any[]): OddsData['consensus'] {
    const spreads: number[] = [];
    const totals: number[] = [];
    const homeML: number[] = [];
    const awayML: number[] = [];

    bookmakers.forEach(book => {
      book.markets.forEach((market: any) => {
        if (market.key === 'spreads') {
          market.outcomes.forEach((outcome: any) => {
            if (outcome.point) spreads.push(outcome.point);
          });
        } else if (market.key === 'totals') {
          market.outcomes.forEach((outcome: any) => {
            if (outcome.point) totals.push(outcome.point);
          });
        } else if (market.key === 'h2h') {
          market.outcomes.forEach((outcome: any) => {
            if (outcome.name === bookmakers[0].home_team) {
              homeML.push(outcome.price);
            } else {
              awayML.push(outcome.price);
            }
          });
        }
      });
    });

    return {
      spread: {
        home: this.median(spreads),
        away: -this.median(spreads),
      },
      total: {
        over: -110, // Standard juice
        under: -110,
        points: this.median(totals),
      },
      moneyline: {
        home: this.median(homeML),
        away: this.median(awayML),
      },
    };
  }

  /**
   * Parse player props
   */
  private parsePlayerProps(data: any): PropBet[] {
    const props: PropBet[] = [];

    data.bookmakers?.forEach((book: any) => {
      book.markets?.forEach((market: any) => {
        if (market.key.includes('player_')) {
          market.outcomes?.forEach((outcome: any) => {
            // Extract player name and bet type
            const [playerName, betType] = outcome.description.split(' - ');
            
            props.push({
              playerId: outcome.id,
              playerName,
              market: market.key,
              line: outcome.point || 0,
              over: outcome.price,
              under: outcome.price, // Would need to find matching under
              bookmaker: book.title,
            });
          });
        }
      });
    });

    return props;
  }

  /**
   * Get betting insights
   */
  getBettingInsights(odds: OddsData): string[] {
    const insights: string[] = [];
    const { consensus } = odds;

    // Heavy favorites
    if (consensus.spread.home < -7) {
      insights.push(`💰 ${odds.homeTeam} heavy favorites (${consensus.spread.home})`);
    } else if (consensus.spread.away < -7) {
      insights.push(`💰 ${odds.awayTeam} heavy favorites (${consensus.spread.away})`);
    }

    // High/Low totals
    if (consensus.total.points > 50) {
      insights.push(`📈 High-scoring game expected (O/U ${consensus.total.points})`);
    } else if (consensus.total.points < 40) {
      insights.push(`📉 Low-scoring game expected (O/U ${consensus.total.points})`);
    }

    // Line movement (would need historical data)
    // Sharp money indicators (would need more data)

    return insights;
  }

  /**
   * Helper to calculate median
   */
  private median(values: number[]): number {
    if (values.length === 0) return 0;
    
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    
    return values.length % 2 !== 0
      ? values[mid]
      : (values[mid - 1] + values[mid]) / 2;
  }

  /**
   * Convert American odds to implied probability
   */
  oddsToImpliedProbability(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    } else {
      return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
  }
}

// Singleton instance
export const oddsAPI = new OddsAPI();