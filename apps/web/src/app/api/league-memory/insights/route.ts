import { NextResponse } from 'next/server';
import { LeagueMemorySystem } from '@/lib/services/traditional-fantasy/league-memory/league-memory';
import { logger } from '../../../../lib/logging/logger';

const mockInsights = [
  {
    title: 'Trade Imbalance Detected',
    description: 'Dynasty Dominators has acquired 73% more value than given up in trades this season. Other managers becoming hesitant to negotiate.',
    type: 'Trade Analysis',
    timestamp: '2 hours ago',
    severity: 'high'
  },
  {
    title: 'Waiver Pattern Shift',
    description: 'Waiver Warriors changing strategy - now holding #1 priority instead of churning. Likely targeting specific breakout candidate.',
    type: 'Behavioral Change',
    timestamp: '5 hours ago',
    severity: 'medium'
  },
  {
    title: 'Rivalry Intensifying',
    description: 'Trade Sharks and Analytics Army have not traded with each other in 18 months despite 47 total trades. Personal rivalry affecting league dynamics.',
    type: 'Relationship Analysis',
    timestamp: '1 day ago',
    severity: 'low'
  },
  {
    title: 'Market Manipulation Alert',
    description: 'Coordinated selling of specific player across 3 managers suggests potential collusion or shared information source.',
    type: 'Anomaly Detection',
    timestamp: '3 days ago',
    severity: 'critical'
  },
  {
    title: 'Rookie Market Bubble',
    description: 'Rookie WR prices 40% higher than historical averages. Expect correction after Week 6 based on past patterns.',
    type: 'Market Analysis',
    timestamp: '1 week ago',
    severity: 'medium'
  },
  {
    title: 'Power Shift Incoming',
    description: 'Steady Eddies quietly accumulating elite talent through patient trading. Projected to dominate in 2025 season.',
    type: 'Long-term Projection',
    timestamp: '2 weeks ago',
    severity: 'medium'
  }
];

export async function GET(request: Request) {
  try {
    const leagueId = 'demo-league';
    const platform = 'espn' as const;
    const sport = 'nfl';
    
    const memorySystem = new LeagueMemorySystem(leagueId, platform, sport);
    await memorySystem.initialize();
    
    const insights = memorySystem.getInsights();
    
    // Format real insights if available
    if (insights && insights.length > 0) {
      const formattedInsights = insights.map(insight => ({
        id: insight.id,
        title: insight.title,
        description: insight.description,
        type: insight.category,
        severity: insight.severity || 'medium',
        timestamp: new Date(insight.timestamp).toLocaleString(),
        relatedManagers: insight.affectedManagers || []
      }));
      return NextResponse.json(formattedInsights);
    }
    
    // Fallback to mock data
    return NextResponse.json(mockInsights);
  } catch (error) {
    logger.error('Error fetching insights:', { error: error });
    return NextResponse.json(mockInsights);
  }
}