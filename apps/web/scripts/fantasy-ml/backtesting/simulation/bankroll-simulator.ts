import { format } from 'date-fns';

interface Position {
  contestId: string;
  entryFee: number;
  lineup: any[];
  expectedValue: number;
  ownership: number[];
  contestType: 'GPP' | 'CASH' | 'SINGLE_ENTRY';
  sport: string;
  slateDate: Date;
}

interface SimulationResult {
  date: Date;
  startingBankroll: number;
  endingBankroll: number;
  positions: PositionResult[];
  totalInvested: number;
  totalReturned: number;
  roi: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
}

interface PositionResult extends Position {
  placement: number;
  payout: number;
  actualPoints: number;
  percentile: number;
}

interface KellyParams {
  winProbability: number;
  payoutMultiple: number;
  confidence: number;
  maxBetFraction: number;
}

export class BankrollSimulator {
  private startingBankroll: number;
  private currentBankroll: number;
  private maxBankroll: number;
  private minBankroll: number;
  private dailyResults: SimulationResult[] = [];
  private kellyCriterion: boolean;
  private maxExposure: number;
  private riskMultiplier: number;

  constructor(
    startingBankroll: number = 10000,
    kellyCriterion: boolean = true,
    maxExposure: number = 0.2, // Max 20% of bankroll per day
    riskMultiplier: number = 0.25 // Conservative Kelly multiplier
  ) {
    this.startingBankroll = startingBankroll;
    this.currentBankroll = startingBankroll;
    this.maxBankroll = startingBankroll;
    this.minBankroll = startingBankroll;
    this.kellyCriterion = kellyCriterion;
    this.maxExposure = maxExposure;
    this.riskMultiplier = riskMultiplier;
  }

  calculateKellyFraction(params: KellyParams): number {
    const { winProbability, payoutMultiple, confidence, maxBetFraction } = params;
    
    // Kelly formula: f = (p * b - q) / b
    // where p = win probability, q = loss probability, b = net odds
    const q = 1 - winProbability;
    const b = payoutMultiple - 1; // Net odds
    
    let kellyFraction = (winProbability * b - q) / b;
    
    // Apply confidence adjustment
    kellyFraction *= confidence;
    
    // Apply risk multiplier for conservative approach
    kellyFraction *= this.riskMultiplier;
    
    // Cap at maximum bet fraction
    kellyFraction = Math.min(kellyFraction, maxBetFraction);
    
    // Never bet negative or zero
    return Math.max(0, kellyFraction);
  }

  calculatePositionSize(
    expectedROI: number,
    confidence: number,
    contestType: string,
    entryFee: number
  ): number {
    if (!this.kellyCriterion) {
      // Fixed percentage of bankroll
      const basePercentage = contestType === 'GPP' ? 0.01 : 0.03;
      return Math.floor(this.currentBankroll * basePercentage / entryFee) * entryFee;
    }

    // Convert ROI to win probability and payout
    const winProbability = this.estimateWinProbability(expectedROI, contestType);
    const payoutMultiple = this.estimatePayoutMultiple(contestType);
    
    const kellyParams: KellyParams = {
      winProbability,
      payoutMultiple,
      confidence,
      maxBetFraction: contestType === 'GPP' ? 0.02 : 0.05
    };
    
    const kellyFraction = this.calculateKellyFraction(kellyParams);
    const positionSize = Math.floor(this.currentBankroll * kellyFraction / entryFee) * entryFee;
    
    return Math.max(entryFee, positionSize); // At least one entry
  }

  private estimateWinProbability(expectedROI: number, contestType: string): number {
    // Convert expected ROI to estimated win probability
    if (contestType === 'CASH') {
      // Cash games: roughly 50% win rate with small edge
      return 0.5 + (expectedROI / 2);
    } else if (contestType === 'SINGLE_ENTRY') {
      // Single entry: moderate win rate
      return 0.2 + (expectedROI / 3);
    } else {
      // GPP: low win rate but high payout
      return 0.1 + (expectedROI / 5);
    }
  }

  private estimatePayoutMultiple(contestType: string): number {
    // Average payout multiples by contest type
    switch (contestType) {
      case 'CASH':
        return 1.8; // Double-ups pay ~1.8x after rake
      case 'SINGLE_ENTRY':
        return 5.0; // Moderate tournaments
      case 'GPP':
        return 20.0; // Large field tournaments
      default:
        return 2.0;
    }
  }

  simulateDay(
    date: Date,
    positions: Position[],
    actualResults: Map<string, number> // playerId -> actual points
  ): SimulationResult {
    const startingDayBankroll = this.currentBankroll;
    const positionResults: PositionResult[] = [];
    let totalInvested = 0;
    let totalReturned = 0;

    // Apply daily exposure limit
    const maxDailyInvestment = this.currentBankroll * this.maxExposure;
    let currentDailyInvestment = 0;

    for (const position of positions) {
      // Check if we can afford this position
      if (currentDailyInvestment + position.entryFee > maxDailyInvestment) {
        continue;
      }

      // Calculate position size using Kelly Criterion
      const confidence = this.calculateConfidence(position);
      const positionSize = this.calculatePositionSize(
        position.expectedValue,
        confidence,
        position.contestType,
        position.entryFee
      );

      if (positionSize > 0 && this.currentBankroll >= positionSize) {
        // Enter the contest
        this.currentBankroll -= positionSize;
        totalInvested += positionSize;
        currentDailyInvestment += positionSize;

        // Calculate actual points for the lineup
        const actualPoints = this.calculateLineupPoints(position.lineup, actualResults);
        
        // Simulate contest results
        const { placement, payout, percentile } = this.simulateContestResult(
          position,
          actualPoints,
          positionSize
        );

        this.currentBankroll += payout;
        totalReturned += payout;

        positionResults.push({
          ...position,
          placement,
          payout,
          actualPoints,
          percentile
        });
      }
    }

    // Update max/min bankroll
    this.maxBankroll = Math.max(this.maxBankroll, this.currentBankroll);
    this.minBankroll = Math.min(this.minBankroll, this.currentBankroll);

    const result: SimulationResult = {
      date,
      startingBankroll: startingDayBankroll,
      endingBankroll: this.currentBankroll,
      positions: positionResults,
      totalInvested,
      totalReturned,
      roi: totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0
    };

    this.dailyResults.push(result);
    return result;
  }

  private calculateConfidence(position: Position): number {
    // Calculate confidence based on various factors
    let confidence = 0.5; // Base confidence

    // Adjust based on expected value
    if (position.expectedValue > 0.2) confidence += 0.2;
    else if (position.expectedValue > 0.1) confidence += 0.1;

    // Adjust based on ownership leverage
    const avgOwnership = position.ownership.reduce((a, b) => a + b, 0) / position.ownership.length;
    if (avgOwnership < 0.05) confidence += 0.1; // Low ownership plays
    if (avgOwnership > 0.3) confidence -= 0.1; // Chalky plays

    // Contest type adjustment
    if (position.contestType === 'CASH') confidence += 0.2;
    else if (position.contestType === 'SINGLE_ENTRY') confidence += 0.1;

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  private calculateLineupPoints(lineup: any[], actualResults: Map<string, number>): number {
    return lineup.reduce((total, player) => {
      const points = actualResults.get(player.playerId) || 0;
      return total + points;
    }, 0);
  }

  private simulateContestResult(
    position: Position,
    actualPoints: number,
    investment: number
  ): { placement: number; payout: number; percentile: number } {
    // Simulate contest results based on actual points and contest type
    // This is a simplified simulation - in reality, you'd use historical contest data
    
    const randomFactor = Math.random();
    let placement: number;
    let payout: number;
    let percentile: number;

    if (position.contestType === 'CASH') {
      // Cash games: top 50% win
      percentile = this.calculatePercentile(actualPoints, position.sport, 'CASH');
      if (percentile >= 0.5) {
        placement = Math.floor((1 - percentile) * 1000) + 1;
        payout = investment * 1.8; // Standard cash game payout
      } else {
        placement = Math.floor((1 - percentile) * 1000) + 1;
        payout = 0;
      }
    } else if (position.contestType === 'SINGLE_ENTRY') {
      // Single entry tournaments
      percentile = this.calculatePercentile(actualPoints, position.sport, 'SINGLE_ENTRY');
      placement = Math.floor((1 - percentile) * 5000) + 1;
      
      if (percentile >= 0.99) {
        payout = investment * 50; // Top 1%
      } else if (percentile >= 0.95) {
        payout = investment * 10; // Top 5%
      } else if (percentile >= 0.85) {
        payout = investment * 3; // Top 15%
      } else if (percentile >= 0.75) {
        payout = investment * 1.5; // Top 25%
      } else {
        payout = 0;
      }
    } else {
      // GPP tournaments
      percentile = this.calculatePercentile(actualPoints, position.sport, 'GPP');
      placement = Math.floor((1 - percentile) * 100000) + 1;
      
      if (percentile >= 0.999) {
        payout = investment * 1000; // Top 0.1%
      } else if (percentile >= 0.99) {
        payout = investment * 100; // Top 1%
      } else if (percentile >= 0.95) {
        payout = investment * 20; // Top 5%
      } else if (percentile >= 0.85) {
        payout = investment * 5; // Top 15%
      } else if (percentile >= 0.75) {
        payout = investment * 2; // Top 25%
      } else {
        payout = 0;
      }
    }

    return { placement, payout, percentile };
  }

  private calculatePercentile(points: number, sport: string, contestType: string): number {
    // Use historical data to calculate percentile
    // This is simplified - in reality, you'd use actual historical distributions
    const sportAverages: Record<string, number> = {
      NFL: 120,
      NBA: 250,
      MLB: 45,
      NHL: 35
    };

    const avg = sportAverages[sport] || 100;
    const stdDev = avg * 0.2; // Approximate standard deviation
    
    // Calculate z-score
    const zScore = (points - avg) / stdDev;
    
    // Convert to percentile using normal CDF approximation
    const percentile = 0.5 * (1 + this.erf(zScore / Math.sqrt(2)));
    
    return Math.min(0.999, Math.max(0.001, percentile));
  }

  private erf(x: number): number {
    // Error function approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  getPerformanceMetrics(): {
    totalReturn: number;
    totalROI: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownDuration: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    calmarRatio: number;
  } {
    const totalReturn = this.currentBankroll - this.startingBankroll;
    const totalROI = (totalReturn / this.startingBankroll) * 100;

    // Calculate daily returns
    const dailyReturns = this.dailyResults.map(r => 
      (r.endingBankroll - r.startingBankroll) / r.startingBankroll
    );

    // Sharpe Ratio (assuming risk-free rate of 2% annually)
    const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const dailyStdDev = this.calculateStdDev(dailyReturns);
    const annualizedReturn = avgDailyReturn * 365;
    const annualizedStdDev = dailyStdDev * Math.sqrt(365);
    const riskFreeRate = 0.02;
    const sharpeRatio = (annualizedReturn - riskFreeRate) / annualizedStdDev;

    // Sortino Ratio (downside deviation)
    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downsideDeviation = this.calculateStdDev(negativeReturns) * Math.sqrt(365);
    const sortinoRatio = (annualizedReturn - riskFreeRate) / downsideDeviation;

    // Max Drawdown
    const { maxDrawdown, maxDrawdownDuration } = this.calculateMaxDrawdown();

    // Win/Loss metrics
    const winningDays = this.dailyResults.filter(r => r.roi > 0);
    const losingDays = this.dailyResults.filter(r => r.roi < 0);
    const winRate = winningDays.length / this.dailyResults.length;
    const avgWin = winningDays.length > 0
      ? winningDays.reduce((sum, r) => sum + r.roi, 0) / winningDays.length
      : 0;
    const avgLoss = losingDays.length > 0
      ? Math.abs(losingDays.reduce((sum, r) => sum + r.roi, 0) / losingDays.length)
      : 0;
    const profitFactor = avgWin * winningDays.length / (avgLoss * losingDays.length || 1);

    // Calmar Ratio
    const calmarRatio = annualizedReturn / Math.abs(maxDrawdown);

    return {
      totalReturn,
      totalROI,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownDuration,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      calmarRatio
    };
  }

  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private calculateMaxDrawdown(): { maxDrawdown: number; maxDrawdownDuration: number } {
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdown = 0;
    let currentDuration = 0;
    let peak = this.startingBankroll;

    for (const result of this.dailyResults) {
      if (result.endingBankroll > peak) {
        peak = result.endingBankroll;
        currentDrawdown = 0;
        currentDuration = 0;
      } else {
        currentDrawdown = (peak - result.endingBankroll) / peak;
        currentDuration++;
        
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
          maxDrawdownDuration = currentDuration;
        }
      }
    }

    return { maxDrawdown: maxDrawdown * 100, maxDrawdownDuration };
  }

  exportResults(): {
    summary: ReturnType<typeof this.getPerformanceMetrics>;
    dailyResults: SimulationResult[];
    bankrollHistory: { date: Date; bankroll: number }[];
  } {
    return {
      summary: this.getPerformanceMetrics(),
      dailyResults: this.dailyResults,
      bankrollHistory: this.dailyResults.map(r => ({
        date: r.date,
        bankroll: r.endingBankroll
      }))
    };
  }
}