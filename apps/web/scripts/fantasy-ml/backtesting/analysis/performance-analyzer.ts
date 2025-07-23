import { Pool } from 'pg';
import { format, differenceInDays } from 'date-fns';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PerformanceMetrics {
  sport: string;
  period: {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    tradingDays: number;
  };
  returns: {
    totalReturn: number;
    totalROI: number;
    annualizedReturn: number;
    monthlyReturns: Record<string, number>;
    dailyReturns: number[];
  };
  riskMetrics: {
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    maxDrawdownDuration: number;
    volatility: number;
    downsideDeviation: number;
    var95: number; // Value at Risk
    cvar95: number; // Conditional Value at Risk
  };
  tradingMetrics: {
    totalContests: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    expectancy: number;
    avgROI: number;
    hitRate: {
      cash: number;
      gpp: number;
      singleEntry: number;
    };
  };
  sportSpecificMetrics: {
    bestSlates: Array<{
      date: Date;
      roi: number;
      contests: number;
      profit: number;
    }>;
    worstSlates: Array<{
      date: Date;
      roi: number;
      contests: number;
      loss: number;
    }>;
    seasonalPerformance: Record<string, number>;
    dayOfWeekPerformance: Record<string, number>;
    contestTypeBreakdown: Record<string, {
      count: number;
      roi: number;
      winRate: number;
    }>;
  };
  modelPerformance: {
    predictionAccuracy: number;
    ownershipAccuracy: number;
    valueIdentification: number;
    overlayDetection: number;
    modelDrift: Array<{
      period: string;
      accuracy: number;
    }>;
  };
}

interface ContestResult {
  date: Date;
  sport: string;
  contestType: string;
  entryFee: number;
  payout: number;
  placement: number;
  fieldSize: number;
  lineup: any[];
  actualPoints: number;
  projectedPoints: number;
  ownership: number[];
}

export class PerformanceAnalyzer {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sports_betting_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
    });
  }

  async analyzeHistoricalPerformance(
    sport: string,
    startDate: Date,
    endDate: Date,
    contestResults: ContestResult[]
  ): Promise<PerformanceMetrics> {
    console.log(`📊 Analyzing ${sport} performance from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}...`);

    const metrics: PerformanceMetrics = {
      sport,
      period: this.calculatePeriodMetrics(startDate, endDate, contestResults),
      returns: this.calculateReturns(contestResults),
      riskMetrics: this.calculateRiskMetrics(contestResults),
      tradingMetrics: this.calculateTradingMetrics(contestResults),
      sportSpecificMetrics: this.calculateSportSpecificMetrics(contestResults),
      modelPerformance: await this.calculateModelPerformance(sport, contestResults)
    };

    return metrics;
  }

  private calculatePeriodMetrics(
    startDate: Date,
    endDate: Date,
    results: ContestResult[]
  ): PerformanceMetrics['period'] {
    const uniqueDates = new Set(results.map(r => format(r.date, 'yyyy-MM-dd')));
    
    return {
      startDate,
      endDate,
      totalDays: differenceInDays(endDate, startDate),
      tradingDays: uniqueDates.size
    };
  }

  private calculateReturns(results: ContestResult[]): PerformanceMetrics['returns'] {
    // Group by date for daily returns
    const dailyResults = new Map<string, ContestResult[]>();
    results.forEach(r => {
      const dateKey = format(r.date, 'yyyy-MM-dd');
      if (!dailyResults.has(dateKey)) {
        dailyResults.set(dateKey, []);
      }
      dailyResults.get(dateKey)!.push(r);
    });

    // Calculate daily returns
    const dailyReturns: number[] = [];
    const monthlyReturns: Record<string, number> = {};
    let totalInvested = 0;
    let totalReturned = 0;

    dailyResults.forEach((dayResults, dateStr) => {
      const dayInvested = dayResults.reduce((sum, r) => sum + r.entryFee, 0);
      const dayReturned = dayResults.reduce((sum, r) => sum + r.payout, 0);
      const dayROI = dayInvested > 0 ? ((dayReturned - dayInvested) / dayInvested) * 100 : 0;
      
      dailyReturns.push(dayROI);
      totalInvested += dayInvested;
      totalReturned += dayReturned;

      // Aggregate monthly
      const monthKey = dateStr.substring(0, 7);
      if (!monthlyReturns[monthKey]) {
        monthlyReturns[monthKey] = 0;
      }
      monthlyReturns[monthKey] += dayReturned - dayInvested;
    });

    const totalReturn = totalReturned - totalInvested;
    const totalROI = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    
    // Annualized return
    const years = differenceInDays(
      Math.max(...results.map(r => r.date.getTime())),
      Math.min(...results.map(r => r.date.getTime()))
    ) / 365;
    const annualizedReturn = Math.pow(1 + (totalROI / 100), 1 / years) - 1;

    return {
      totalReturn,
      totalROI,
      annualizedReturn: annualizedReturn * 100,
      monthlyReturns,
      dailyReturns
    };
  }

  private calculateRiskMetrics(results: ContestResult[]): PerformanceMetrics['riskMetrics'] {
    const returns = this.calculateReturns(results);
    const dailyReturns = returns.dailyReturns;

    // Basic statistics
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance);

    // Downside deviation (for Sortino)
    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);

    // Risk ratios (annualized)
    const riskFreeRate = 0.02; // 2% annual
    const annualizedVolatility = volatility * Math.sqrt(252); // Trading days
    const annualizedDownside = downsideDeviation * Math.sqrt(252);
    
    const sharpeRatio = annualizedVolatility > 0
      ? (returns.annualizedReturn - riskFreeRate) / annualizedVolatility
      : 0;
    
    const sortinoRatio = annualizedDownside > 0
      ? (returns.annualizedReturn - riskFreeRate) / annualizedDownside
      : 0;

    // Max drawdown calculation
    const { maxDrawdown, maxDrawdownDuration } = this.calculateMaxDrawdown(results);
    
    const calmarRatio = maxDrawdown > 0
      ? returns.annualizedReturn / maxDrawdown
      : 0;

    // VaR and CVaR (95% confidence)
    const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
    const var95Index = Math.floor(sortedReturns.length * 0.05);
    const var95 = sortedReturns[var95Index] || 0;
    
    const cvar95 = var95Index > 0
      ? sortedReturns.slice(0, var95Index).reduce((a, b) => a + b, 0) / var95Index
      : var95;

    return {
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown,
      maxDrawdownDuration,
      volatility: annualizedVolatility,
      downsideDeviation: annualizedDownside,
      var95,
      cvar95
    };
  }

  private calculateMaxDrawdown(results: ContestResult[]): {
    maxDrawdown: number;
    maxDrawdownDuration: number;
  } {
    // Sort by date
    const sortedResults = [...results].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let peak = 0;
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdownStart: Date | null = null;
    let runningPnL = 0;

    for (const result of sortedResults) {
      runningPnL += result.payout - result.entryFee;
      
      if (runningPnL > peak) {
        peak = runningPnL;
        currentDrawdownStart = null;
      } else {
        if (!currentDrawdownStart) {
          currentDrawdownStart = result.date;
        }
        
        const drawdown = peak > 0 ? ((peak - runningPnL) / peak) * 100 : 0;
        
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          if (currentDrawdownStart) {
            maxDrawdownDuration = differenceInDays(result.date, currentDrawdownStart);
          }
        }
      }
    }

    return { maxDrawdown, maxDrawdownDuration };
  }

  private calculateTradingMetrics(results: ContestResult[]): PerformanceMetrics['tradingMetrics'] {
    const winningContests = results.filter(r => r.payout > r.entryFee);
    const losingContests = results.filter(r => r.payout <= r.entryFee);
    
    const totalWins = winningContests.reduce((sum, r) => sum + (r.payout - r.entryFee), 0);
    const totalLosses = Math.abs(losingContests.reduce((sum, r) => sum + (r.payout - r.entryFee), 0));
    
    const avgWin = winningContests.length > 0 ? totalWins / winningContests.length : 0;
    const avgLoss = losingContests.length > 0 ? totalLosses / losingContests.length : 0;
    
    const winRate = results.length > 0 ? winningContests.length / results.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    
    // Expectancy
    const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
    
    // Average ROI
    const totalInvested = results.reduce((sum, r) => sum + r.entryFee, 0);
    const totalReturned = results.reduce((sum, r) => sum + r.payout, 0);
    const avgROI = totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0;

    // Hit rates by contest type
    const contestTypes = ['cash', 'gpp', 'singleEntry'];
    const hitRate: Record<string, number> = {};
    
    contestTypes.forEach(type => {
      const typeResults = results.filter(r => 
        r.contestType.toLowerCase().includes(type.toLowerCase())
      );
      const typeWins = typeResults.filter(r => r.payout > r.entryFee);
      hitRate[type] = typeResults.length > 0 ? typeWins.length / typeResults.length : 0;
    });

    return {
      totalContests: results.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      avgROI,
      hitRate: hitRate as any
    };
  }

  private calculateSportSpecificMetrics(results: ContestResult[]): PerformanceMetrics['sportSpecificMetrics'] {
    // Group by date for slate analysis
    const slateResults = new Map<string, ContestResult[]>();
    results.forEach(r => {
      const dateKey = format(r.date, 'yyyy-MM-dd');
      if (!slateResults.has(dateKey)) {
        slateResults.set(dateKey, []);
      }
      slateResults.get(dateKey)!.push(r);
    });

    // Calculate slate performance
    const slatePerformance = Array.from(slateResults.entries()).map(([dateStr, slateContests]) => {
      const invested = slateContests.reduce((sum, r) => sum + r.entryFee, 0);
      const returned = slateContests.reduce((sum, r) => sum + r.payout, 0);
      const profit = returned - invested;
      const roi = invested > 0 ? (profit / invested) * 100 : 0;
      
      return {
        date: new Date(dateStr),
        roi,
        contests: slateContests.length,
        profit: profit > 0 ? profit : 0,
        loss: profit < 0 ? Math.abs(profit) : 0
      };
    });

    // Best and worst slates
    const sortedByROI = [...slatePerformance].sort((a, b) => b.roi - a.roi);
    const bestSlates = sortedByROI.slice(0, 10).filter(s => s.profit > 0);
    const worstSlates = sortedByROI.slice(-10).filter(s => s.loss > 0);

    // Seasonal performance
    const seasonalPerformance: Record<string, number> = {};
    const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
    
    results.forEach(r => {
      const month = r.date.getMonth();
      const season = month < 3 ? 'Winter' : month < 6 ? 'Spring' : month < 9 ? 'Summer' : 'Fall';
      
      if (!seasonalPerformance[season]) {
        seasonalPerformance[season] = 0;
      }
      seasonalPerformance[season] += r.payout - r.entryFee;
    });

    // Day of week performance
    const dayOfWeekPerformance: Record<string, number> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    results.forEach(r => {
      const dayName = days[r.date.getDay()];
      if (!dayOfWeekPerformance[dayName]) {
        dayOfWeekPerformance[dayName] = 0;
      }
      dayOfWeekPerformance[dayName] += r.payout - r.entryFee;
    });

    // Contest type breakdown
    const contestTypeBreakdown: Record<string, any> = {};
    const contestTypeGroups = new Map<string, ContestResult[]>();
    
    results.forEach(r => {
      const type = r.contestType;
      if (!contestTypeGroups.has(type)) {
        contestTypeGroups.set(type, []);
      }
      contestTypeGroups.get(type)!.push(r);
    });

    contestTypeGroups.forEach((contests, type) => {
      const wins = contests.filter(c => c.payout > c.entryFee).length;
      const invested = contests.reduce((sum, c) => sum + c.entryFee, 0);
      const returned = contests.reduce((sum, c) => sum + c.payout, 0);
      
      contestTypeBreakdown[type] = {
        count: contests.length,
        roi: invested > 0 ? ((returned - invested) / invested) * 100 : 0,
        winRate: contests.length > 0 ? wins / contests.length : 0
      };
    });

    return {
      bestSlates,
      worstSlates,
      seasonalPerformance,
      dayOfWeekPerformance,
      contestTypeBreakdown
    };
  }

  private async calculateModelPerformance(
    sport: string,
    results: ContestResult[]
  ): Promise<PerformanceMetrics['modelPerformance']> {
    // Calculate prediction accuracy
    const predictions = results.map(r => ({
      projected: r.projectedPoints,
      actual: r.actualPoints
    }));

    const avgError = predictions.reduce((sum, p) => 
      sum + Math.abs(p.projected - p.actual), 0
    ) / predictions.length;
    
    const avgActual = predictions.reduce((sum, p) => sum + p.actual, 0) / predictions.length;
    const predictionAccuracy = 1 - (avgError / avgActual);

    // Ownership accuracy (simplified)
    const ownershipAccuracy = 0.75; // Placeholder

    // Value identification
    const highValuePlays = results.filter(r => {
      const avgOwnership = r.ownership.reduce((a, b) => a + b, 0) / r.ownership.length;
      return avgOwnership < 0.1 && r.actualPoints > r.projectedPoints * 1.2;
    });
    const valueIdentification = highValuePlays.length / results.length;

    // Overlay detection (contests where we significantly outperformed)
    const overlayContests = results.filter(r => r.placement < r.fieldSize * 0.1);
    const overlayDetection = overlayContests.length / results.length;

    // Model drift over time
    const modelDrift: Array<{ period: string; accuracy: number }> = [];
    
    // Group by month and calculate accuracy
    const monthlyGroups = new Map<string, ContestResult[]>();
    results.forEach(r => {
      const monthKey = format(r.date, 'yyyy-MM');
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, []);
      }
      monthlyGroups.get(monthKey)!.push(r);
    });

    monthlyGroups.forEach((monthResults, monthKey) => {
      const monthPredictions = monthResults.map(r => ({
        projected: r.projectedPoints,
        actual: r.actualPoints
      }));
      
      const monthError = monthPredictions.reduce((sum, p) => 
        sum + Math.abs(p.projected - p.actual), 0
      ) / monthPredictions.length;
      
      const monthAvgActual = monthPredictions.reduce((sum, p) => 
        sum + p.actual, 0
      ) / monthPredictions.length;
      
      modelDrift.push({
        period: monthKey,
        accuracy: 1 - (monthError / monthAvgActual)
      });
    });

    return {
      predictionAccuracy,
      ownershipAccuracy,
      valueIdentification,
      overlayDetection,
      modelDrift
    };
  }

  async generateReport(
    metrics: PerformanceMetrics,
    outputPath: string
  ): Promise<void> {
    console.log(`📝 Generating performance report...`);

    const report = `
# ${metrics.sport} Historical Performance Report
## Period: ${format(metrics.period.startDate, 'yyyy-MM-dd')} to ${format(metrics.period.endDate, 'yyyy-MM-dd')}

### Executive Summary
- **Total Return**: $${metrics.returns.totalReturn.toFixed(2)} (${metrics.returns.totalROI.toFixed(2)}%)
- **Annualized Return**: ${metrics.returns.annualizedReturn.toFixed(2)}%
- **Sharpe Ratio**: ${metrics.riskMetrics.sharpeRatio.toFixed(2)}
- **Max Drawdown**: ${metrics.riskMetrics.maxDrawdown.toFixed(2)}%
- **Win Rate**: ${(metrics.tradingMetrics.winRate * 100).toFixed(2)}%

### Risk Metrics
- **Sharpe Ratio**: ${metrics.riskMetrics.sharpeRatio.toFixed(2)}
- **Sortino Ratio**: ${metrics.riskMetrics.sortinoRatio.toFixed(2)}
- **Calmar Ratio**: ${metrics.riskMetrics.calmarRatio.toFixed(2)}
- **Max Drawdown**: ${metrics.riskMetrics.maxDrawdown.toFixed(2)}% (${metrics.riskMetrics.maxDrawdownDuration} days)
- **Volatility**: ${metrics.riskMetrics.volatility.toFixed(2)}%
- **95% VaR**: ${metrics.riskMetrics.var95.toFixed(2)}%
- **95% CVaR**: ${metrics.riskMetrics.cvar95.toFixed(2)}%

### Trading Performance
- **Total Contests**: ${metrics.tradingMetrics.totalContests}
- **Win Rate**: ${(metrics.tradingMetrics.winRate * 100).toFixed(2)}%
- **Average Win**: $${metrics.tradingMetrics.avgWin.toFixed(2)}
- **Average Loss**: $${metrics.tradingMetrics.avgLoss.toFixed(2)}
- **Profit Factor**: ${metrics.tradingMetrics.profitFactor.toFixed(2)}
- **Expectancy**: $${metrics.tradingMetrics.expectancy.toFixed(2)}

### Contest Type Performance
- **Cash Games**: ${(metrics.tradingMetrics.hitRate.cash * 100).toFixed(2)}% hit rate
- **GPPs**: ${(metrics.tradingMetrics.hitRate.gpp * 100).toFixed(2)}% hit rate
- **Single Entry**: ${(metrics.tradingMetrics.hitRate.singleEntry * 100).toFixed(2)}% hit rate

### Model Performance
- **Prediction Accuracy**: ${(metrics.modelPerformance.predictionAccuracy * 100).toFixed(2)}%
- **Ownership Accuracy**: ${(metrics.modelPerformance.ownershipAccuracy * 100).toFixed(2)}%
- **Value Identification**: ${(metrics.modelPerformance.valueIdentification * 100).toFixed(2)}%
- **Overlay Detection**: ${(metrics.modelPerformance.overlayDetection * 100).toFixed(2)}%

### Best Performing Slates
${metrics.sportSpecificMetrics.bestSlates.slice(0, 5).map(s => 
  `- ${format(s.date, 'yyyy-MM-dd')}: ${s.roi.toFixed(2)}% ROI ($${s.profit.toFixed(2)} profit)`
).join('\n')}

### Monthly Returns
${Object.entries(metrics.returns.monthlyReturns).map(([month, returns]) => 
  `- ${month}: $${returns.toFixed(2)}`
).join('\n')}

### Day of Week Performance
${Object.entries(metrics.sportSpecificMetrics.dayOfWeekPerformance).map(([day, profit]) => 
  `- ${day}: $${profit.toFixed(2)}`
).join('\n')}

---
Generated on ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
`;

    await fs.writeFile(outputPath, report);
    console.log(`✅ Report saved to ${outputPath}`);
  }

  async generateJSONReport(
    metrics: PerformanceMetrics,
    outputPath: string
  ): Promise<void> {
    await fs.writeFile(outputPath, JSON.stringify(metrics, null, 2));
    console.log(`✅ JSON report saved to ${outputPath}`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}