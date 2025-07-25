/**
 * 💰 KELLY BANKROLL MANAGER SERVICE 💰
 * User-friendly service connecting to Kelly Criterion API
 */

export interface BankrollStatus {
  current: number;
  available: number;
  reserved: number;
  maxSingleBet: number;
  maxTotalExposure: number;
}

export interface UserPerformance {
  totalContests: number;
  winningContests: number;
  winRate: string;
  totalWagered: number;
  totalReturns: number;
  roi: string;
  maxDrawdown: string;
  avgPnl: number;
  bestWin: number;
  worstLoss: number;
}

export interface RiskSettings {
  label: string;
  kellyMultiplier: number;
  maxSingleBet: number;
  maxTotalExposure: number;
  description: string;
}

export interface RiskProfile {
  level: string;
  settings: RiskSettings;
  healthScore: number;
  healthLabel: string;
  recommendations: string[];
}

export interface ContestRecommendation {
  contestId: string;
  contestName: string;
  contestType: string;
  entryFee: number;
  recommendedBetSize: number;
  maxEntries: number;
  expectedReturn: number;
  confidence: number;
  reasoning: string;
  riskLevel: string;
  suitabilityScore: number;
}

export interface BankrollHistory {
  date: string;
  bankroll: number;
  change: number;
  transactionCount: number;
}

export interface BankrollAlert {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'info';
}

export class KellyBankrollManager {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/bankroll') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current bankroll status and performance metrics
   */
  async getBankrollStatus(currentBankroll: number, riskLevel: string = 'moderate'): Promise<{
    bankroll: BankrollStatus;
    performance: UserPerformance;
    riskProfile: RiskProfile;
  }> {
    const response = await fetch(`${this.baseUrl}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        currentBankroll,
        riskLevel
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get bankroll status: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      bankroll: data.bankroll,
      performance: data.performance,
      riskProfile: data.riskProfile
    };
  }

  /**
   * Get contest recommendations based on bankroll and risk tolerance
   */
  async getContestRecommendations(
    currentBankroll: number,
    riskTolerance: string = 'moderate',
    options: {
      sport?: string;
      maxRecommendations?: number;
      contestTypes?: string[];
    } = {}
  ): Promise<{
    recommendations: ContestRecommendation[];
    summary: any;
    advice: string[];
  }> {
    const response = await fetch(`${this.baseUrl}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentBankroll,
        riskTolerance,
        sport: options.sport || 'all',
        maxRecommendations: options.maxRecommendations || 10,
        contestTypes: options.contestTypes || ['cash', 'single_entry', 'gpp']
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get recommendations: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      recommendations: data.recommendations,
      summary: data.summary,
      advice: data.advice
    };
  }

  /**
   * Get bankroll history and performance metrics
   */
  async getBankrollHistory(period: number = 30): Promise<{
    history: BankrollHistory[];
    metrics: any;
    contestBreakdown: any[];
  }> {
    const response = await fetch(`${this.baseUrl}/history?period=${period}&granularity=daily`);

    if (!response.ok) {
      throw new Error(`Failed to get bankroll history: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      history: data.history.map((h: any) => ({
        date: h.date,
        bankroll: h.bankroll,
        change: h.change,
        transactionCount: h.transactionCount
      })),
      metrics: data.metrics,
      contestBreakdown: data.contestBreakdown
    };
  }

  /**
   * Update bankroll after contest result
   */
  async updateBankrollResult(
    contestId: string,
    result: {
      entryFee: number;
      payout: number;
      currentBankroll: number;
      contestName?: string;
      placement?: number;
      totalEntries?: number;
    }
  ): Promise<{
    previousBankroll: number;
    newBankroll: number;
    change: number;
    changePercent: string;
  }> {
    const response = await fetch(`${this.baseUrl}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        contestId,
        contestName: result.contestName,
        entryFee: result.entryFee,
        payout: result.payout,
        placement: result.placement,
        totalEntries: result.totalEntries,
        newBankroll: result.currentBankroll + result.payout - result.entryFee,
        description: `Contest ${result.payout > result.entryFee ? 'win' : 'loss'}: ${result.contestName || contestId}`
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update bankroll: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      previousBankroll: data.previousBankroll,
      newBankroll: data.newBankroll,
      change: data.change,
      changePercent: data.changePercent
    };
  }

  /**
   * Get bankroll alerts and warnings
   */
  async getBankrollAlerts(currentBankroll: number): Promise<{
    alerts: BankrollAlert[];
    alertCount: number;
    hasHighSeverity: boolean;
  }> {
    const response = await fetch(`${this.baseUrl}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'alerts',
        currentBankroll
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get alerts: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Calculate Kelly bet size for a specific contest
   */
  async calculateKellyBet(
    contest: {
      id: string;
      name: string;
      type: string;
      entryFee: number;
      winProbability?: number;
      projectedROI?: number;
      variance?: number;
    },
    currentBankroll: number,
    riskTolerance: string = 'moderate',
    confidenceLevel: number = 0.75
  ): Promise<ContestRecommendation> {
    const response = await fetch(`${this.baseUrl}/kelly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'calculate',
        currentBankroll,
        contests: [contest],
        riskTolerance,
        confidenceLevel
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to calculate Kelly bet: ${response.statusText}`);
    }

    const data = await response.json();
    return data.recommendations[0];
  }

  /**
   * Get optimal portfolio allocation across multiple contests
   */
  async getPortfolioAllocation(
    contests: any[],
    currentBankroll: number,
    riskTolerance: string = 'moderate'
  ): Promise<{
    allocations: any[];
    metrics: any;
    totalAllocated: number;
    remainingBudget: number;
  }> {
    const response = await fetch(`${this.baseUrl}/kelly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'portfolio',
        currentBankroll,
        contests,
        riskTolerance
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get portfolio allocation: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      allocations: data.allocations,
      metrics: data.metrics,
      totalAllocated: data.totalAllocated,
      remainingBudget: data.remainingBudget
    };
  }

  /**
   * Get user-friendly betting recommendations
   */
  getSimpleBettingAdvice(
    bankroll: number,
    riskLevel: string,
    winRate: number,
    recentPerformance: number
  ): {
    maxBetSize: number;
    recommendedSports: string[];
    contestTypes: string[];
    advice: string[];
  } {
    const riskMultipliers = {
      conservative: 0.05,
      moderate: 0.1,
      aggressive: 0.2
    };

    const maxBetSize = bankroll * (riskMultipliers[riskLevel as keyof typeof riskMultipliers] || 0.1);

    let recommendedSports = ['NFL', 'NBA']; // Start with mainstream sports
    let contestTypes = ['cash'];

    // Adjust based on experience
    if (winRate > 50) {
      contestTypes.push('single_entry');
      if (winRate > 60) {
        contestTypes.push('gpp');
      }
    }

    // Adjust based on recent performance
    if (recentPerformance < -10) {
      recommendedSports = ['NFL']; // Stick to one sport when struggling
      contestTypes = ['cash']; // Only cash games
    } else if (recentPerformance > 10) {
      recommendedSports.push('MLB', 'NHL'); // Expand when doing well
    }

    const advice = [];
    
    if (winRate < 40) {
      advice.push('Focus on improving your player research and lineup construction');
      advice.push('Stick to cash games until your win rate improves');
    } else if (winRate > 60) {
      advice.push('Great performance! Consider gradually increasing your bet sizes');
      advice.push('You may be ready for tournaments and higher-variance contests');
    }

    if (recentPerformance < -20) {
      advice.push('Take a break and analyze what went wrong recently');
      advice.push('Consider reducing bet sizes until you get back on track');
    }

    if (bankroll < 500) {
      advice.push('Build your bankroll with small, conservative bets');
      advice.push('Focus on $1-5 contests until you have more funds');
    }

    return {
      maxBetSize: Math.round(maxBetSize),
      recommendedSports,
      contestTypes,
      advice: advice.slice(0, 3)
    };
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format percentage for display
   */
  formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Get risk level color for UI
   */
  getRiskLevelColor(riskLevel: string): string {
    const colors = {
      low: '#10b981',      // green
      medium: '#f59e0b',   // yellow/orange
      high: '#ef4444',     // red
      extreme: '#dc2626'   // dark red
    };
    
    return colors[riskLevel as keyof typeof colors] || colors.medium;
  }

  /**
   * Get bankroll health indicator
   */
  getBankrollHealthIndicator(healthScore: number): {
    label: string;
    color: string;
    icon: string;
    advice: string;
  } {
    if (healthScore >= 85) {
      return {
        label: 'Excellent',
        color: '#10b981',
        icon: '🟢',
        advice: 'Your bankroll management is excellent. Keep up the good work!'
      };
    } else if (healthScore >= 70) {
      return {
        label: 'Good',
        color: '#22c55e',
        icon: '🔵',
        advice: 'Solid bankroll management. Stay consistent with your approach.'
      };
    } else if (healthScore >= 55) {
      return {
        label: 'Fair',
        color: '#f59e0b',
        icon: '🟡',
        advice: 'Room for improvement. Consider focusing more on cash games.'
      };
    } else if (healthScore >= 40) {
      return {
        label: 'Poor',
        color: '#f97316',
        icon: '🟠',
        advice: 'Your bankroll needs attention. Consider reducing bet sizes.'
      };
    } else {
      return {
        label: 'Critical',
        color: '#ef4444',
        icon: '🔴',
        advice: 'Critical situation. Stop betting and reassess your strategy.'
      };
    }
  }
}

// Create singleton instance
export const kellyBankrollManager = new KellyBankrollManager();