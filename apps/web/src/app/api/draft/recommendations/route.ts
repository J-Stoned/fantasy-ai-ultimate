import { NextRequest, NextResponse } from 'next/server';
import { DraftEngine } from '@/lib/services/traditional-fantasy/draft-analysis/draft-engine';
import { logger } from '../../../../lib/logging/logger';
import { 
  Player, 
  PlayerProjection, 
  LeagueSettings,
  PlayerMap,
  ProjectionMap 
} from '@/lib/services/traditional-fantasy/draft-analysis/types';

// In-memory draft storage (in production, use Redis or database)
const activeDrafts = new Map<string, DraftEngine>();

// Mock data generator
function generateMockPlayers(): PlayerMap {
  const players = new Map<string, Player>();
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
  const teams = ['KC', 'BUF', 'SF', 'PHI', 'DAL', 'MIA', 'CIN', 'LAR'];
  
  let id = 1;
  for (const position of positions) {
    const count = position === 'QB' ? 32 : position === 'RB' ? 60 : 
                  position === 'WR' ? 80 : position === 'TE' ? 40 :
                  position === 'K' ? 32 : 32;
    
    for (let i = 0; i < count; i++) {
      const playerId = `player-${id}`;
      players.set(playerId, {
        id: playerId,
        name: `${position} Player ${i + 1}`,
        team: teams[Math.floor(Math.random() * teams.length)],
        position,
        sport: 'NFL',
        age: 22 + Math.floor(Math.random() * 12),
        experience: Math.floor(Math.random() * 10),
        injuryStatus: Math.random() > 0.9 ? 'questionable' : 'healthy'
      });
      id++;
    }
  }
  
  return players;
}

function generateMockProjections(players: PlayerMap): ProjectionMap {
  const projections = new Map<string, PlayerProjection>();
  
  players.forEach((player, playerId) => {
    const basePoints = 
      player.position === 'QB' ? 250 + Math.random() * 150 :
      player.position === 'RB' ? 150 + Math.random() * 150 :
      player.position === 'WR' ? 120 + Math.random() * 150 :
      player.position === 'TE' ? 80 + Math.random() * 100 :
      player.position === 'K' ? 100 + Math.random() * 50 :
      120 + Math.random() * 60;
    
    projections.set(playerId, {
      playerId,
      projectedPoints: basePoints,
      projectedStats: {
        games: 17,
        // Add position-specific stats
        ...(player.position === 'QB' ? {
          passingYards: 3500 + Math.random() * 2000,
          passingTDs: 20 + Math.random() * 20,
          interceptions: 5 + Math.random() * 10,
          rushingYards: Math.random() * 500,
          rushingTDs: Math.random() * 5
        } : {}),
        ...(player.position === 'RB' ? {
          rushingYards: 800 + Math.random() * 800,
          rushingTDs: 5 + Math.random() * 10,
          receptions: 20 + Math.random() * 60,
          receivingYards: 200 + Math.random() * 600,
          receivingTDs: Math.random() * 5
        } : {}),
        ...(player.position === 'WR' ? {
          receptions: 50 + Math.random() * 70,
          receivingYards: 700 + Math.random() * 800,
          receivingTDs: 4 + Math.random() * 10,
          rushingYards: Math.random() * 100,
          rushingTDs: Math.random() * 2
        } : {}),
      },
      confidenceInterval: {
        low: basePoints * 0.8,
        high: basePoints * 1.2
      },
      consistency: 0.5 + Math.random() * 0.5,
      upside: 0.5 + Math.random() * 0.5,
      floor: basePoints * 0.7,
      ceiling: basePoints * 1.3
    });
  });
  
  return projections;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      );
    }

    // Get draft engine
    let engine = activeDrafts.get(draftId);
    
    if (!engine) {
      // Create mock draft engine if not found
      const players = generateMockPlayers();
      const projections = generateMockProjections(players);
      const leagueSettings: LeagueSettings = {
        sport: 'NFL',
        draftType: 'snake',
        scoringType: 'ppr',
        teamCount: 12,
        rosterSize: 16,
        rosterRequirements: {
          QB: { min: 1, max: 4 },
          RB: { min: 2, max: 8 },
          WR: { min: 2, max: 8 },
          TE: { min: 1, max: 3 },
          FLEX: { min: 1, max: 2, flex: true },
          K: { min: 1, max: 2 },
          DST: { min: 1, max: 2 },
          BENCH: { min: 5, max: 7 }
        },
        scoringRules: {
          passingYards: 0.04,
          passingTDs: 4,
          interceptions: -2,
          rushingYards: 0.1,
          rushingTDs: 6,
          receptions: 1,
          receivingYards: 0.1,
          receivingTDs: 6
        }
      };
      
      const draftOrder = Array.from({ length: 12 }, (_, i) => `team-${i + 1}`);
      engine = new DraftEngine(players, projections, leagueSettings, draftOrder, 'team-1');
      activeDrafts.set(draftId, engine);
    }

    // Get recommendations
    const recommendations = engine.getRecommendations(5);
    const positionScarcity = engine.getPositionScarcity();
    
    // Convert Map to object for JSON serialization
    const scarcityObject: Record<string, any> = {};
    positionScarcity.forEach((value, key) => {
      scarcityObject[key] = value;
    });

    return NextResponse.json({
      recommendations,
      positionScarcity: scarcityObject,
      performanceMetrics: engine.getPerformanceMetrics()
    });
  } catch (error) {
    logger.error('Error getting recommendations:', { error: error });
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}