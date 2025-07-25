import { NextResponse } from 'next/server';
import { LeagueMemorySystem } from '@/lib/services/traditional-fantasy/league-memory/league-memory';
import { logger } from '../../../../lib/logging/logger';

const mockPatterns = [
  {
    title: 'Post-Injury Panic Sellers',
    description: 'Managers who immediately trade star players after injury news',
    managers: ['Steady Eddies', 'Waiver Warriors'],
    frequency: 'After major injury reports',
    occurrences: 12
  },
  {
    title: 'Monday Night Tilt Traders',
    description: 'Emotional trading after bad Monday Night Football performances',
    managers: ['Dynasty Dominators', 'Trade Sharks'],
    frequency: 'Tuesday mornings',
    occurrences: 23
  },
  {
    title: 'Rookie Hype Cycle',
    description: 'Overvaluing rookies in preseason, selling after slow starts',
    managers: ['Rookie Hunters', 'Analytics Army'],
    frequency: 'Weeks 1-4 of season',
    occurrences: 18
  },
  {
    title: 'Deadline Day Warriors',
    description: 'Massive trade activity in final 48 hours before deadline',
    managers: ['Trade Sharks', 'Dynasty Dominators', 'Waiver Warriors'],
    frequency: 'Trade deadline week',
    occurrences: 45
  },
  {
    title: 'Buy-Low Window',
    description: 'Targeting slumping stars between Weeks 3-6',
    managers: ['Analytics Army', 'Dynasty Dominators'],
    frequency: 'Early-mid season',
    occurrences: 31
  },
  {
    title: 'Playoff Push Desperation',
    description: 'Overpaying for immediate help when playoff spot in jeopardy',
    managers: ['Waiver Warriors', 'Rookie Hunters'],
    frequency: 'Weeks 10-13',
    occurrences: 27
  }
];

export async function GET(request: Request) {
  try {
    const leagueId = 'demo-league';
    const platform = 'espn' as const;
    const sport = 'nfl';
    
    const memorySystem = new LeagueMemorySystem(leagueId, platform, sport);
    await memorySystem.initialize();
    
    const patterns = memorySystem.getPatterns();
    
    // Format real patterns if available
    if (patterns) {
      const formattedPatterns = [];
      
      // Add behavioral patterns
      patterns.behavioralPatterns.tiltBehavior.forEach(pattern => {
        formattedPatterns.push({
          title: 'Tilt Trading Pattern',
          description: `Manager shows emotional trading after losses`,
          managers: pattern.managers || [],
          frequency: `${pattern.occurrences || 0} times`,
          occurrences: pattern.occurrences || 0
        });
      });
      
      if (formattedPatterns.length > 0) {
        return NextResponse.json(formattedPatterns);
      }
    }
    
    // Fallback to mock data
    return NextResponse.json(mockPatterns);
  } catch (error) {
    logger.error('Error fetching patterns:', { error: error });
    return NextResponse.json(mockPatterns);
  }
}