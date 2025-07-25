import { NextResponse } from 'next/server';
import { LeagueMemorySystem } from '@/lib/services/traditional-fantasy/league-memory/league-memory';
import { logger } from '../../../../lib/logging/logger';

const mockPredictions = [
  {
    manager: 'Dynasty Dominators',
    action: 'Will target underperforming RB1s after Week 4',
    confidence: 87,
    reasoning: 'Historical pattern shows aggressive buy-low strategy on elite players with slow starts'
  },
  {
    manager: 'Trade Sharks',
    action: 'Likely to package mid-tier WRs for elite TE upgrade',
    confidence: 92,
    reasoning: 'Currently rostering 8 WRs, only 1 startable TE. Has done this 3 times in past 2 seasons'
  },
  {
    manager: 'Analytics Army',
    action: 'Will sell aging veterans before Week 8 deadline',
    confidence: 78,
    reasoning: 'Consistent pattern of trading 28+ year old players while value remains high'
  },
  {
    manager: 'Waiver Warriors',
    action: 'Targeting rookie WRs on practice squads',
    confidence: 83,
    reasoning: 'Has successfully identified 4 breakout WRs using this strategy over past 3 years'
  },
  {
    manager: 'Rookie Hunters',
    action: 'Accumulating 2025 draft picks via small trades',
    confidence: 95,
    reasoning: 'Already made 3 trades acquiring future picks. Typical dynasty building pattern'
  },
  {
    manager: 'Steady Eddies',
    action: 'Holding roster steady until bye weeks force moves',
    confidence: 91,
    reasoning: 'Averages only 2.3 trades per season, typically during bye week crunches'
  }
];

export async function GET(request: Request) {
  try {
    const leagueId = 'demo-league';
    const platform = 'espn' as const;
    const sport = 'nfl';
    
    const memorySystem = new LeagueMemorySystem(leagueId, platform, sport);
    await memorySystem.initialize();
    
    const predictions = memorySystem.getPredictions();
    
    // If we have real predictions, format them for the UI
    if (predictions && predictions.behaviorPredictions.length > 0) {
      const formattedPredictions = predictions.behaviorPredictions.map((pred, idx) => ({
        manager: pred.managerId,
        action: pred.predictedAction,
        confidence: Math.round(pred.confidence * 100),
        reasoning: pred.reasoning,
        triggers: pred.triggers || [],
        timeframe: pred.timeframe || 'Next 2 weeks'
      }));
      return NextResponse.json(formattedPredictions);
    }
    
    // Fallback to mock data
    return NextResponse.json(mockPredictions);
  } catch (error) {
    logger.error('Error fetching predictions:', { error: error });
    return NextResponse.json(mockPredictions);
  }
}