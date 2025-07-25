import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LeagueMemorySystem } from '@/lib/services/traditional-fantasy/league-memory/league-memory';
import { ManagerProfiler } from '@/lib/services/traditional-fantasy/league-memory/manager-profiler';
import { logger } from '../../../../lib/logging/logger';

const mockManagers = [
  {
    id: '1',
    team_name: 'Dynasty Dominators',
    style: 'Aggressive',
    risk_level: 5,
    trade_frequency: 'Very High',
    win_rate: 78,
    behavioral_summary: 'Highly aggressive trader who capitalizes on market inefficiencies. Known for buying low on injured stars.'
  },
  {
    id: '2',
    team_name: 'Steady Eddies',
    style: 'Conservative',
    risk_level: 2,
    trade_frequency: 'Low',
    win_rate: 65,
    behavioral_summary: 'Patient manager who builds through the draft. Rarely trades unless value is overwhelming.'
  },
  {
    id: '3',
    team_name: 'Waiver Warriors',
    style: 'Opportunistic',
    risk_level: 4,
    trade_frequency: 'High',
    win_rate: 71,
    behavioral_summary: 'Master of the waiver wire. Quick to identify breakout candidates and flip them for value.'
  },
  {
    id: '4',
    team_name: 'Analytics Army',
    style: 'Data-Driven',
    risk_level: 3,
    trade_frequency: 'Moderate',
    win_rate: 82,
    behavioral_summary: 'Uses advanced metrics to find undervalued players. Focuses on efficiency over name value.'
  },
  {
    id: '5',
    team_name: 'Rookie Hunters',
    style: 'Development',
    risk_level: 4,
    trade_frequency: 'Moderate',
    win_rate: 69,
    behavioral_summary: 'Specializes in identifying rookie talent. Willing to sacrifice current season for future dynasty.'
  },
  {
    id: '6',
    team_name: 'Trade Sharks',
    style: 'Predatory',
    risk_level: 5,
    trade_frequency: 'Very High',
    win_rate: 75,
    behavioral_summary: 'Notorious for one-sided trades. Preys on inexperienced managers and panic sellers.'
  }
];

export async function GET(request: Request) {
  try {
    // In production, you would get these from query params or session
    const leagueId = 'demo-league';
    const platform = 'espn' as const;
    const sport = 'nfl';
    
    // Initialize the league memory system
    const memorySystem = new LeagueMemorySystem(leagueId, platform, sport);
    await memorySystem.initialize();
    
    // For demo, add some managers if none exist
    const mockManagerNames = ['Alex Thompson', 'Sarah Chen', 'Marcus Johnson', 'Emily Davis', 'Mike Wilson', 'Jessica Lee'];
    for (let i = 0; i < mockManagerNames.length; i++) {
      await memorySystem.addManager(`manager-${i+1}`, mockManagerNames[i]);
    }
    
    // Get all manager profiles
    const profiles = [];
    for (let i = 0; i < mockManagerNames.length; i++) {
      const profile = memorySystem.getManagerProfile(`manager-${i+1}`);
      if (profile && i < mockManagers.length) {
        // Merge with mock data for better demo
        profiles.push({
          ...mockManagers[i],
          ...profile,
          id: profile.managerId
        });
      }
    }
    
    return NextResponse.json(profiles.length > 0 ? profiles : mockManagers);
  } catch (error) {
    logger.error('Error fetching manager profiles:', { error: error });
    // Fallback to mock data if service fails
    return NextResponse.json(mockManagers);
  }
}