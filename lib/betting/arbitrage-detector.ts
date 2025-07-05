/**
 * 💰 ARBITRAGE OPPORTUNITY DETECTOR
 * Finds guaranteed profit opportunities across sportsbooks
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ArbitrageOpportunity {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  profit: number; // Percentage profit
  investment: number;
  returns: number;
  bets: {
    outcome: string;
    bookmaker: string;
    odds: number;
    stake: number;
    payout: number;
  }[];
  impliedProbability: number;
  marketInefficiency: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeWindow: number; // Minutes before odds might change
}

export class ArbitrageDetector {
  private minProfit = 0.5; // Minimum 0.5% profit to consider
  private maxInvestment = 1000; // Maximum investment per opportunity

  /**
   * Analyze odds for arbitrage opportunities
   */
  analyzeOdds(bookmakerOdds: any[]): ArbitrageOpportunity | null {
    // Find best odds for each outcome
    let bestHome = { odds: -Infinity, bookmaker: '' };
    let bestAway = { odds: -Infinity, bookmaker: '' };
    let bestDraw = { odds: -Infinity, bookmaker: '' };

    bookmakerOdds.forEach(bookmaker => {
      if (bookmaker.markets?.h2h) {
        const { home, away, draw } = bookmaker.markets.h2h;
        
        if (home > bestHome.odds) {
          bestHome = { odds: home, bookmaker: bookmaker.bookmaker };
        }
        if (away > bestAway.odds) {
          bestAway = { odds: away, bookmaker: bookmaker.bookmaker };
        }
        if (draw && draw > bestDraw.odds) {
          bestDraw = { odds: draw, bookmaker: bookmaker.bookmaker };
        }
      }
    });

    // Calculate arbitrage for 2-way market
    const twoWayArb = this.calculate2WayArbitrage(bestHome, bestAway);
    
    // Calculate arbitrage for 3-way market (if draw exists)
    const threeWayArb = bestDraw.odds > -Infinity 
      ? this.calculate3WayArbitrage(bestHome, bestAway, bestDraw)
      : null;

    // Return the best opportunity
    const bestArb = threeWayArb && threeWayArb.profit > twoWayArb.profit 
      ? threeWayArb 
      : twoWayArb;

    return bestArb.profit >= this.minProfit ? bestArb : null;
  }

  /**
   * Calculate 2-way arbitrage (home/away only)
   */
  private calculate2WayArbitrage(
    bestHome: { odds: number; bookmaker: string },
    bestAway: { odds: number; bookmaker: string }
  ): any {
    // Convert American to decimal odds
    const homeDecimal = this.americanToDecimal(bestHome.odds);
    const awayDecimal = this.americanToDecimal(bestAway.odds);

    // Calculate implied probabilities
    const homeProb = 1 / homeDecimal;
    const awayProb = 1 / awayDecimal;
    const totalProb = homeProb + awayProb;

    // Calculate profit percentage
    const profit = totalProb < 1 ? ((1 / totalProb) - 1) * 100 : 0;

    // Calculate optimal stakes
    const investment = Math.min(this.maxInvestment, 1000);
    const homeStake = (homeProb / totalProb) * investment;
    const awayStake = (awayProb / totalProb) * investment;

    // Calculate payouts
    const homePayout = homeStake * homeDecimal;
    const awayPayout = awayStake * awayDecimal;
    const guaranteedReturn = Math.min(homePayout, awayPayout);

    return {
      profit,
      investment,
      returns: guaranteedReturn,
      bets: [
        {
          outcome: 'home',
          bookmaker: bestHome.bookmaker,
          odds: bestHome.odds,
          stake: homeStake,
          payout: homePayout
        },
        {
          outcome: 'away',
          bookmaker: bestAway.bookmaker,
          odds: bestAway.odds,
          stake: awayStake,
          payout: awayPayout
        }
      ],
      impliedProbability: totalProb,
      marketInefficiency: Math.abs(1 - totalProb),
      riskLevel: this.assessRisk(profit, totalProb),
      timeWindow: this.estimateTimeWindow(profit)
    };
  }

  /**
   * Calculate 3-way arbitrage (home/draw/away)
   */
  private calculate3WayArbitrage(
    bestHome: { odds: number; bookmaker: string },
    bestAway: { odds: number; bookmaker: string },
    bestDraw: { odds: number; bookmaker: string }
  ): any {
    // Convert to decimal odds
    const homeDecimal = this.americanToDecimal(bestHome.odds);
    const awayDecimal = this.americanToDecimal(bestAway.odds);
    const drawDecimal = this.americanToDecimal(bestDraw.odds);

    // Calculate implied probabilities
    const homeProb = 1 / homeDecimal;
    const awayProb = 1 / awayDecimal;
    const drawProb = 1 / drawDecimal;
    const totalProb = homeProb + awayProb + drawProb;

    // Calculate profit
    const profit = totalProb < 1 ? ((1 / totalProb) - 1) * 100 : 0;

    // Calculate stakes
    const investment = Math.min(this.maxInvestment, 1000);
    const homeStake = (homeProb / totalProb) * investment;
    const awayStake = (awayProb / totalProb) * investment;
    const drawStake = (drawProb / totalProb) * investment;

    // Calculate payouts
    const homePayout = homeStake * homeDecimal;
    const awayPayout = awayStake * awayDecimal;
    const drawPayout = drawStake * drawDecimal;
    const guaranteedReturn = Math.min(homePayout, awayPayout, drawPayout);

    return {
      profit,
      investment,
      returns: guaranteedReturn,
      bets: [
        {
          outcome: 'home',
          bookmaker: bestHome.bookmaker,
          odds: bestHome.odds,
          stake: homeStake,
          payout: homePayout
        },
        {
          outcome: 'away',
          bookmaker: bestAway.bookmaker,
          odds: bestAway.odds,
          stake: awayStake,
          payout: awayPayout
        },
        {
          outcome: 'draw',
          bookmaker: bestDraw.bookmaker,
          odds: bestDraw.odds,
          stake: drawStake,
          payout: drawPayout
        }
      ],
      impliedProbability: totalProb,
      marketInefficiency: Math.abs(1 - totalProb),
      riskLevel: this.assessRisk(profit, totalProb),
      timeWindow: this.estimateTimeWindow(profit)
    };
  }

  /**
   * Convert American odds to decimal
   */
  private americanToDecimal(americanOdds: number): number {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    } else {
      return (100 / Math.abs(americanOdds)) + 1;
    }
  }

  /**
   * Assess risk level of arbitrage opportunity
   */
  private assessRisk(profit: number, totalProb: number): 'low' | 'medium' | 'high' {
    if (profit > 5 && totalProb < 0.95) return 'low';
    if (profit > 2 && totalProb < 0.98) return 'medium';
    return 'high';
  }

  /**
   * Estimate how long the opportunity might last
   */
  private estimateTimeWindow(profit: number): number {
    // Higher profit opportunities close faster
    if (profit > 10) return 1; // 1 minute
    if (profit > 5) return 5; // 5 minutes
    if (profit > 2) return 15; // 15 minutes
    return 30; // 30 minutes
  }

  /**
   * Monitor live odds for arbitrage opportunities
   */
  async monitorArbitrage(updateInterval = 60000) { // 1 minute default
    console.log(chalk.bold.cyan('💰 Starting Arbitrage Monitor...\n'));

    setInterval(async () => {
      try {
        // Fetch latest odds from database
        const { data: games } = await supabase
          .from('betting_odds')
          .select('*')
          .gte('last_updated', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order('last_updated', { ascending: false });

        if (!games || games.length === 0) {
          console.log(chalk.gray('No recent odds data available'));
          return;
        }

        const opportunities: ArbitrageOpportunity[] = [];

        games.forEach(game => {
          if (game.bookmaker_data) {
            const opportunity = this.analyzeOdds(game.bookmaker_data);
            if (opportunity) {
              opportunities.push({
                ...opportunity,
                gameId: game.game_id,
                sport: 'NBA',
                homeTeam: 'Home Team',
                awayTeam: 'Away Team'
              });
            }
          }
        });

        if (opportunities.length > 0) {
          console.log(chalk.bold.green(`\n🎯 ${opportunities.length} Arbitrage Opportunities Found!\n`));

          opportunities
            .sort((a, b) => b.profit - a.profit)
            .forEach(opp => {
              console.log(chalk.bold(`${opp.homeTeam} vs ${opp.awayTeam}`));
              console.log(chalk.green(`💰 Profit: ${opp.profit.toFixed(2)}%`));
              console.log(chalk.yellow(`📊 Investment: $${opp.investment.toFixed(2)} → Returns: $${opp.returns.toFixed(2)}`));
              console.log(chalk.cyan('🎲 Bets:'));
              
              opp.bets.forEach(bet => {
                console.log(`   ${bet.outcome}: $${bet.stake.toFixed(2)} @ ${bet.odds} (${bet.bookmaker}) → $${bet.payout.toFixed(2)}`);
              });
              
              console.log(chalk.gray(`⚠️  Risk: ${opp.riskLevel} | ⏱️  Act within ${opp.timeWindow} minutes`));
              console.log('');
            });

          // Send alert (could integrate with push notifications)
          this.sendArbitrageAlert(opportunities[0]);
        } else {
          console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] No arbitrage opportunities found`));
        }
      } catch (error) {
        console.error(chalk.red('Error monitoring arbitrage:'), error);
      }
    }, updateInterval);

    console.log(chalk.green('✅ Arbitrage monitor running...'));
    console.log(chalk.gray(`Checking every ${updateInterval / 1000} seconds`));
  }

  /**
   * Send alert for arbitrage opportunity
   */
  private async sendArbitrageAlert(opportunity: ArbitrageOpportunity) {
    // This would integrate with push notification service
    console.log(chalk.bold.red('\n🚨 ARBITRAGE ALERT! 🚨'));
    console.log(chalk.bold.yellow(`${opportunity.profit.toFixed(2)}% guaranteed profit available!`));
    
    // Store alert in database
    await supabase.from('arbitrage_alerts').insert({
      game_id: opportunity.gameId,
      profit_percentage: opportunity.profit,
      investment_required: opportunity.investment,
      guaranteed_return: opportunity.returns,
      bet_details: opportunity.bets,
      risk_level: opportunity.riskLevel,
      expires_at: new Date(Date.now() + opportunity.timeWindow * 60 * 1000).toISOString()
    });
  }
}