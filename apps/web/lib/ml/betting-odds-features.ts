/**
 * 🎰 BETTING ODDS ML FEATURES
 * Phase 3: Extract market intelligence for ML models
 */

import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export interface BettingOddsFeatures {
  // Market Intelligence (8 features)
  impliedHomeProbability: number;    // What the market thinks
  impliedAwayProbability: number;    // Complement probability
  marketConfidence: number;          // How sure is the market (spread tightness)
  overUnderTotal: number;           // Expected total points
  
  // Value Detection (6 features)
  homeOddsValue: number;            // Are home odds generous?
  awayOddsValue: number;            // Are away odds generous?
  arbitrageOpportunity: number;     // Cross-book arbitrage score
  sharpMoneyDirection: number;      // Where are pros betting? (-1 to 1)
  
  // Market Movement (4 features)
  oddsMovement: number;             // How much have odds shifted?
  volumeIndicator: number;          // Betting volume estimate
  publicBettingPercent: number;     // % of public on home team
  contrianIndicator: number;        // Fade-the-public signal
  
  // Advanced Market Features (6 features)
  lineSharpness: number;            // How efficiently priced is this line?
  closingLineValue: number;         // Expected CLV
  marketMaker: string;              // Primary market maker
  liquidityScore: number;           // How liquid is this market?
  seasonalTrend: number;            // Historical performance vs market
  weatherImpact: number;            // Weather's effect on total
}

export class BettingOddsExtractor {
  private readonly oddsApiKey: string;
  private readonly oddsApiUrl = 'https://api.the-odds-api.com/v4';
  
  constructor() {
    this.oddsApiKey = process.env.ODDS_API_KEY || 'demo';
  }
  
  /**
   * Extract betting odds features for a game
   */
  async extractOddsFeatures(
    homeTeamName: string, 
    awayTeamName: string, 
    gameDate: Date,
    sport: string = 'americanfootball_nfl'
  ): Promise<BettingOddsFeatures> {
    console.log(chalk.gray(`🎰 Extracting betting odds for ${homeTeamName} vs ${awayTeamName}`));
    
    if (this.oddsApiKey === 'demo') {
      console.log(chalk.yellow('⚠️  Using demo odds data (set ODDS_API_KEY for real data)'));
      return this.generateDemoOddsFeatures(homeTeamName, awayTeamName);
    }
    
    try {
      // Get live odds from multiple sportsbooks
      const oddsData = await this.fetchLiveOdds(sport, homeTeamName, awayTeamName);
      
      if (!oddsData || oddsData.length === 0) {
        console.log(chalk.yellow('⚠️  No odds data found, using demo features'));
        return this.generateDemoOddsFeatures(homeTeamName, awayTeamName);
      }
      
      return this.processOddsData(oddsData, homeTeamName, awayTeamName);
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Odds API error: ${error.message}, using demo data`));
      return this.generateDemoOddsFeatures(homeTeamName, awayTeamName);
    }
  }
  
  /**
   * Fetch live odds from The Odds API
   */
  private async fetchLiveOdds(sport: string, homeTeam: string, awayTeam: string) {
    const url = `${this.oddsApiUrl}/sports/${sport}/odds`;
    const params = new URLSearchParams({
      apiKey: this.oddsApiKey,
      regions: 'us',
      markets: 'h2h,spreads,totals',
      oddsFormat: 'american',
      dateFormat: 'iso'
    });
    
    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Filter for our specific game
    return data.filter((game: any) => {
      const teams = [game.home_team, game.away_team].map(t => t.toLowerCase());
      const searchTerms = [homeTeam.toLowerCase(), awayTeam.toLowerCase()];
      return searchTerms.every(term => teams.some(team => team.includes(term)));
    });
  }
  
  /**
   * Process real odds data into ML features
   */
  private processOddsData(oddsData: any[], homeTeam: string, awayTeam: string): BettingOddsFeatures {
    const game = oddsData[0]; // Use first matching game
    const bookmakers = game.bookmakers || [];
    
    if (bookmakers.length === 0) {
      return this.generateDemoOddsFeatures(homeTeam, awayTeam);
    }
    
    // Extract moneyline odds
    const moneylineMarkets = bookmakers.map((book: any) => 
      book.markets.find((m: any) => m.key === 'h2h')
    ).filter(Boolean);
    
    const homeOdds = this.extractTeamOdds(moneylineMarkets, homeTeam, true);
    const awayOdds = this.extractTeamOdds(moneylineMarkets, awayTeam, false);
    
    // Convert American odds to probabilities
    const homeImpliedProb = this.americanOddsToProb(homeOdds.bestOdds);
    const awayImpliedProb = this.americanOddsToProb(awayOdds.bestOdds);
    
    // Calculate market features
    const marketConfidence = this.calculateMarketConfidence(homeOdds.allOdds, awayOdds.allOdds);
    const arbitrageOpp = this.calculateArbitrageOpportunity(homeOdds.bestOdds, awayOdds.bestOdds);
    
    // Extract totals
    const totalsMarkets = bookmakers.map((book: any) => 
      book.markets.find((m: any) => m.key === 'totals')
    ).filter(Boolean);
    
    const averageTotal = this.calculateAverageTotal(totalsMarkets);
    
    return {
      // Market Intelligence
      impliedHomeProbability: homeImpliedProb,
      impliedAwayProbability: awayImpliedProb,
      marketConfidence: marketConfidence,
      overUnderTotal: averageTotal / 100, // Normalize
      
      // Value Detection
      homeOddsValue: this.calculateOddsValue(homeOdds),
      awayOddsValue: this.calculateOddsValue(awayOdds),
      arbitrageOpportunity: arbitrageOpp,
      sharpMoneyDirection: this.estimateSharpMoney(homeOdds, awayOdds),
      
      // Market Movement (would need historical data)
      oddsMovement: 0.5, // Placeholder
      volumeIndicator: 0.7,
      publicBettingPercent: 0.6,
      contrianIndicator: 0.4,
      
      // Advanced Features
      lineSharpness: marketConfidence,
      closingLineValue: 0.5,
      marketMaker: bookmakers[0]?.title || 'unknown',
      liquidityScore: Math.min(1, bookmakers.length / 10),
      seasonalTrend: 0.5,
      weatherImpact: 0.5
    };
  }
  
  /**
   * Generate realistic demo odds features
   */
  private generateDemoOddsFeatures(homeTeam: string, awayTeam: string): BettingOddsFeatures {
    // Create realistic odds based on team names/characteristics
    const homeAdvantage = 0.55; // Home field advantage
    const randomFactor = (Math.random() - 0.5) * 0.2; // ±10% randomness
    
    const homeProb = Math.max(0.25, Math.min(0.75, homeAdvantage + randomFactor));
    const awayProb = 1 - homeProb;
    
    // Generate correlated features
    const marketConfidence = 0.7 + Math.random() * 0.2; // 70-90%
    const totalPoints = 45 + Math.random() * 20; // 45-65 points expected
    
    return {
      // Market Intelligence
      impliedHomeProbability: homeProb,
      impliedAwayProbability: awayProb,
      marketConfidence: marketConfidence,
      overUnderTotal: totalPoints / 100, // Normalized
      
      // Value Detection  
      homeOddsValue: 0.5 + (Math.random() - 0.5) * 0.3, // Some value either way
      awayOddsValue: 0.5 + (Math.random() - 0.5) * 0.3,
      arbitrageOpportunity: Math.random() * 0.1, // 0-10% arb opportunity
      sharpMoneyDirection: (Math.random() - 0.5) * 0.8, // -0.4 to +0.4
      
      // Market Movement
      oddsMovement: (Math.random() - 0.5) * 0.2, // ±10% movement
      volumeIndicator: 0.6 + Math.random() * 0.3,
      publicBettingPercent: 0.4 + Math.random() * 0.4, // 40-80% on home
      contrianIndicator: Math.random() * 0.6,
      
      // Advanced Features
      lineSharpness: marketConfidence,
      closingLineValue: 0.4 + Math.random() * 0.2,
      marketMaker: 'DraftKings',
      liquidityScore: 0.8 + Math.random() * 0.2,
      seasonalTrend: 0.4 + Math.random() * 0.2,
      weatherImpact: Math.random() * 0.3
    };
  }
  
  /**
   * Extract team odds from multiple bookmakers
   */
  private extractTeamOdds(markets: any[], teamName: string, isHome: boolean) {
    const allOdds: number[] = [];
    
    markets.forEach(market => {
      const outcomes = market?.outcomes || [];
      const teamOutcome = outcomes.find((outcome: any) => 
        outcome.name.toLowerCase().includes(teamName.toLowerCase()) ||
        (isHome && outcome.name.includes('Home')) ||
        (!isHome && outcome.name.includes('Away'))
      );
      
      if (teamOutcome?.price) {
        allOdds.push(teamOutcome.price);
      }
    });
    
    return {
      allOdds,
      bestOdds: allOdds.length > 0 ? Math.max(...allOdds) : -110, // Best odds for bettor
      avgOdds: allOdds.length > 0 ? allOdds.reduce((a, b) => a + b) / allOdds.length : -110
    };
  }
  
  /**
   * Convert American odds to implied probability
   */
  private americanOddsToProb(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }
  
  /**
   * Calculate market confidence based on odds consistency
   */
  private calculateMarketConfidence(homeOdds: number[], awayOdds: number[]): number {
    if (homeOdds.length < 2 || awayOdds.length < 2) return 0.7;
    
    const homeVariance = this.calculateVariance(homeOdds);
    const awayVariance = this.calculateVariance(awayOdds);
    const avgVariance = (homeVariance + awayVariance) / 2;
    
    // Lower variance = higher confidence
    return Math.max(0.3, Math.min(1, 1 - (avgVariance / 10000)));
  }
  
  /**
   * Calculate variance of an array
   */
  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / numbers.length;
  }
  
  /**
   * Calculate arbitrage opportunity
   */
  private calculateArbitrageOpportunity(homeOdds: number, awayOdds: number): number {
    const homeProb = this.americanOddsToProb(homeOdds);
    const awayProb = this.americanOddsToProb(awayOdds);
    const totalProb = homeProb + awayProb;
    
    // If total prob < 1, there's an arbitrage opportunity
    return Math.max(0, 1 - totalProb);
  }
  
  /**
   * Calculate average total from totals markets
   */
  private calculateAverageTotal(totalsMarkets: any[]): number {
    const totals: number[] = [];
    
    totalsMarkets.forEach(market => {
      const outcomes = market?.outcomes || [];
      outcomes.forEach((outcome: any) => {
        if (outcome.point && typeof outcome.point === 'number') {
          totals.push(outcome.point);
        }
      });
    });
    
    return totals.length > 0 ? totals.reduce((a, b) => a + b) / totals.length : 50;
  }
  
  /**
   * Calculate odds value (how generous are the odds?)
   */
  private calculateOddsValue(oddsData: { allOdds: number[]; bestOdds: number; avgOdds: number }): number {
    if (oddsData.allOdds.length === 0) return 0.5;
    
    const bestProb = this.americanOddsToProb(oddsData.bestOdds);
    const avgProb = this.americanOddsToProb(oddsData.avgOdds);
    
    // Value = how much better than average
    return Math.max(0, Math.min(1, (avgProb - bestProb) * 10 + 0.5));
  }
  
  /**
   * Estimate sharp money direction
   */
  private estimateSharpMoney(homeOdds: any, awayOdds: any): number {
    // Sharp money typically moves lines
    // This is simplified - in reality you'd track line movement
    const homeSpread = homeOdds.allOdds.length > 1 ? 
      Math.max(...homeOdds.allOdds) - Math.min(...homeOdds.allOdds) : 0;
    const awaySpread = awayOdds.allOdds.length > 1 ? 
      Math.max(...awayOdds.allOdds) - Math.min(...awayOdds.allOdds) : 0;
    
    // More spread = more sharp action
    const totalSpread = homeSpread + awaySpread;
    return Math.max(-1, Math.min(1, (homeSpread - awaySpread) / Math.max(1, totalSpread)));
  }
}