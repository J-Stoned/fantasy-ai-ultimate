import { NextRequest, NextResponse } from 'next/server';
import { DraftEngine } from '@/lib/services/traditional-fantasy/draft-analysis/draft-engine';
import { logger } from '../../../../lib/logging/logger';
import { 
  Player, 
  PlayerProjection, 
  LeagueSettings,
  PlayerMap,
  ProjectionMap,
  DraftState 
} from '@/lib/services/traditional-fantasy/draft-analysis/types';

// In-memory draft storage (in production, use Redis or database)
const activeDrafts = new Map<string, DraftEngine>();

// Mock data generator (same as recommendations route)
function generateMockPlayers(): PlayerMap {
  const players = new Map<string, Player>();
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
  const teams = ['KC', 'BUF', 'SF', 'PHI', 'DAL', 'MIA', 'CIN', 'LAR', 'BAL', 'DET', 'JAX', 'GB'];
  
  // Real player names for more realistic experience
  const playerNames = {
    QB: ['Patrick Mahomes', 'Josh Allen', 'Jalen Hurts', 'Lamar Jackson', 'Joe Burrow', 'Dak Prescott', 'Tua Tagovailoa', 'Justin Herbert'],
    RB: ['Christian McCaffrey', 'Austin Ekeler', 'Bijan Robinson', 'Nick Chubb', 'Saquon Barkley', 'Tony Pollard', 'Josh Jacobs', 'Derrick Henry'],
    WR: ['Justin Jefferson', 'Ja\'Marr Chase', 'Tyreek Hill', 'Stefon Diggs', 'CeeDee Lamb', 'A.J. Brown', 'Davante Adams', 'Cooper Kupp'],
    TE: ['Travis Kelce', 'Mark Andrews', 'T.J. Hockenson', 'George Kittle', 'Dallas Goedert', 'Darren Waller', 'Kyle Pitts', 'Pat Freiermuth'],
    K: ['Justin Tucker', 'Harrison Butker', 'Daniel Carlson', 'Tyler Bass', 'Evan McPherson', 'Jason Myers', 'Younghoe Koo', 'Jake Elliott'],
    DST: ['49ers', 'Bills', 'Cowboys', 'Ravens', 'Eagles', 'Patriots', 'Broncos', 'Steelers']
  };
  
  let id = 1;
  for (const position of positions) {
    const names = playerNames[position as keyof typeof playerNames] || [];
    const count = position === 'QB' ? 32 : position === 'RB' ? 60 : 
                  position === 'WR' ? 80 : position === 'TE' ? 40 :
                  position === 'K' ? 32 : 32;
    
    for (let i = 0; i < count; i++) {
      const playerId = `player-${id}`;
      const name = i < names.length ? names[i] : `${position} Player ${i + 1}`;
      
      players.set(playerId, {
        id: playerId,
        name,
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
  
  // Elite player bonuses based on name
  const elitePlayers = new Set([
    'Patrick Mahomes', 'Josh Allen', 'Christian McCaffrey', 'Justin Jefferson',
    'Travis Kelce', 'Tyreek Hill', 'Austin Ekeler', 'Ja\'Marr Chase'
  ]);
  
  players.forEach((player, playerId) => {
    const isElite = elitePlayers.has(player.name);
    const eliteMultiplier = isElite ? 1.3 : 1;
    
    const basePoints = 
      player.position === 'QB' ? (250 + Math.random() * 150) * eliteMultiplier :
      player.position === 'RB' ? (150 + Math.random() * 150) * eliteMultiplier :
      player.position === 'WR' ? (120 + Math.random() * 150) * eliteMultiplier :
      player.position === 'TE' ? (80 + Math.random() * 100) * eliteMultiplier :
      player.position === 'K' ? 100 + Math.random() * 50 :
      120 + Math.random() * 60;
    
    projections.set(playerId, {
      playerId,
      projectedPoints: basePoints,
      projectedStats: {
        games: 17,
        ...(player.position === 'QB' ? {
          passingYards: (3500 + Math.random() * 2000) * eliteMultiplier,
          passingTDs: (20 + Math.random() * 20) * eliteMultiplier,
          interceptions: 5 + Math.random() * 10,
          rushingYards: Math.random() * 500,
          rushingTDs: Math.random() * 5
        } : {}),
        ...(player.position === 'RB' ? {
          rushingYards: (800 + Math.random() * 800) * eliteMultiplier,
          rushingTDs: (5 + Math.random() * 10) * eliteMultiplier,
          receptions: (20 + Math.random() * 60) * eliteMultiplier,
          receivingYards: (200 + Math.random() * 600) * eliteMultiplier,
          receivingTDs: Math.random() * 5 * eliteMultiplier
        } : {}),
        ...(player.position === 'WR' ? {
          receptions: (50 + Math.random() * 70) * eliteMultiplier,
          receivingYards: (700 + Math.random() * 800) * eliteMultiplier,
          receivingTDs: (4 + Math.random() * 10) * eliteMultiplier,
          rushingYards: Math.random() * 100,
          rushingTDs: Math.random() * 2
        } : {}),
      },
      confidenceInterval: {
        low: basePoints * 0.8,
        high: basePoints * 1.2
      },
      consistency: isElite ? 0.7 + Math.random() * 0.3 : 0.5 + Math.random() * 0.5,
      upside: isElite ? 0.7 + Math.random() * 0.3 : 0.5 + Math.random() * 0.5,
      floor: basePoints * 0.7,
      ceiling: basePoints * 1.3
    });
  });
  
  return projections;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leagueSettings, draftOrder, myTeamId } = body;

    if (!leagueSettings || !draftOrder || !myTeamId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Generate mock data
    const players = generateMockPlayers();
    const projections = generateMockProjections(players);

    // Create draft engine
    const draftId = `draft-${Date.now()}`;
    const engine = new DraftEngine(
      players,
      projections,
      leagueSettings,
      draftOrder,
      myTeamId
    );

    // Store draft engine
    activeDrafts.set(draftId, engine);

    // Get initial draft state
    const draftState = engine.getDraftState();

    // Add draft ID to state
    const stateWithId: DraftState = {
      ...draftState,
      draftId
    };

    // Convert Maps to objects for JSON serialization
    const teamsObject: Record<string, any> = {};
    draftState.teams.forEach((team, teamId) => {
      teamsObject[teamId] = {
        ...team,
        needs: team.needs || []
      };
    });

    const playersArray = Array.from(players.values());
    const availablePlayersArray = Array.from(draftState.availablePlayers);

    return NextResponse.json({
      draftState: {
        ...stateWithId,
        teams: teamsObject,
        availablePlayers: availablePlayersArray
      },
      players: playersArray,
      message: 'Draft started successfully!'
    });
  } catch (error) {
    logger.error('Error starting draft:', { error: error });
    return NextResponse.json(
      { error: 'Failed to start draft' },
      { status: 500 }
    );
  }
}

// Cleanup old drafts periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 1000 * 60 * 60 * 24; // 24 hours
  
  activeDrafts.forEach((engine, draftId) => {
    const draftTime = parseInt(draftId.split('-')[1]);
    if (now - draftTime > maxAge) {
      activeDrafts.delete(draftId);
    }
  });
}, 1000 * 60 * 60); // Check every hour