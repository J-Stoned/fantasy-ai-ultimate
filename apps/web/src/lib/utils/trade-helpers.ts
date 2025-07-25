// Trade analysis helper functions

export interface TradePlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  projectedPoints: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface TradePackage {
  players: TradePlayer[];
  totalValue: number;
  avgProjectedPoints: number;
  positionBalance: Record<string, number>;
}

export function calculateTradePackageValue(players: TradePlayer[]): TradePackage {
  const totalValue = players.reduce((sum, player) => sum + player.value, 0);
  const avgProjectedPoints = players.reduce((sum, player) => sum + player.projectedPoints, 0) / players.length;
  
  const positionBalance: Record<string, number> = {};
  players.forEach(player => {
    positionBalance[player.position] = (positionBalance[player.position] || 0) + 1;
  });

  return {
    players,
    totalValue,
    avgProjectedPoints,
    positionBalance
  };
}

export function evaluateTradeFairness(giving: TradePackage, receiving: TradePackage): {
  fairnessScore: number;
  recommendation: 'accept' | 'reject' | 'review';
  reasoning: string[];
} {
  const valueDiff = receiving.totalValue - giving.totalValue;
  const valuePct = (valueDiff / giving.totalValue) * 100;
  const pointsDiff = receiving.avgProjectedPoints - giving.avgProjectedPoints;
  
  // Calculate fairness score (0-100, where 100 is perfectly fair)
  const fairnessScore = Math.max(0, 100 - Math.abs(valuePct));
  
  // Generate reasoning
  const reasoning: string[] = [];
  
  if (valueDiff > 0) {
    reasoning.push(`You gain ${valueDiff.toFixed(0)} points in total value (+${valuePct.toFixed(1)}%)`);
  } else if (valueDiff < 0) {
    reasoning.push(`You lose ${Math.abs(valueDiff).toFixed(0)} points in total value (${valuePct.toFixed(1)}%)`);
  } else {
    reasoning.push('Trade is balanced in terms of total value');
  }
  
  if (pointsDiff > 0) {
    reasoning.push(`Average projected points improve by ${pointsDiff.toFixed(1)} per week`);
  } else if (pointsDiff < 0) {
    reasoning.push(`Average projected points decrease by ${Math.abs(pointsDiff).toFixed(1)} per week`);
  }
  
  // Check position balance
  const losingPositions = Object.keys(giving.positionBalance).filter(
    pos => !receiving.positionBalance[pos] || receiving.positionBalance[pos] < giving.positionBalance[pos]
  );
  
  if (losingPositions.length > 0) {
    reasoning.push(`Warning: You'll have fewer ${losingPositions.join(', ')} after this trade`);
  }
  
  // Determine recommendation
  let recommendation: 'accept' | 'reject' | 'review';
  if (fairnessScore > 80 && valueDiff >= 0) {
    recommendation = 'accept';
  } else if (fairnessScore < 60 || valueDiff < -20) {
    recommendation = 'reject';
  } else {
    recommendation = 'review';
  }
  
  return {
    fairnessScore,
    recommendation,
    reasoning
  };
}

export function getPlayerTrend(recentPoints: number[], projectedPoints: number): 'up' | 'down' | 'stable' {
  if (recentPoints.length < 3) return 'stable';
  
  const avg = recentPoints.reduce((a, b) => a + b, 0) / recentPoints.length;
  const recentAvg = recentPoints.slice(-3).reduce((a, b) => a + b, 0) / 3;
  
  if (recentAvg > avg * 1.1 && projectedPoints > avg) return 'up';
  if (recentAvg < avg * 0.9 || projectedPoints < avg * 0.9) return 'down';
  return 'stable';
}

export function formatTradeImpact(impact: { winProbChange: number; pointsGained: number; valueChange: number }) {
  const items = [];
  
  if (impact.winProbChange !== 0) {
    items.push({
      label: 'Win Probability',
      value: `${impact.winProbChange > 0 ? '+' : ''}${impact.winProbChange.toFixed(1)}%`,
      positive: impact.winProbChange > 0
    });
  }
  
  if (impact.pointsGained !== 0) {
    items.push({
      label: 'Weekly Points',
      value: `${impact.pointsGained > 0 ? '+' : ''}${impact.pointsGained.toFixed(1)}`,
      positive: impact.pointsGained > 0
    });
  }
  
  if (impact.valueChange !== 0) {
    items.push({
      label: 'Trade Value',
      value: `${impact.valueChange > 0 ? '+' : ''}${impact.valueChange}`,
      positive: impact.valueChange > 0
    });
  }
  
  return items;
}