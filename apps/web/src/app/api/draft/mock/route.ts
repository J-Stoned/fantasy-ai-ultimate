import { NextRequest, NextResponse } from 'next/server';
import { DraftEngine } from '@/lib/services/traditional-fantasy/draft-analysis/draft-engine';
import { logger } from '../../../../lib/logging/logger';
import { 
  Player, 
  PlayerProjection, 
  LeagueSettings,
  PlayerMap,
  ProjectionMap,
  MockDraftSettings,
  AIPersonality 
} from '@/lib/services/traditional-fantasy/draft-analysis/types';

// In-memory draft storage
const activeDrafts = new Map<string, DraftEngine>();

// Mock data generators (reuse from start route)
function generateMockPlayers(): PlayerMap {
  const players = new Map<string, Player>();
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
  const teams = ['KC', 'BUF', 'SF', 'PHI', 'DAL', 'MIA', 'CIN', 'LAR', 'BAL', 'DET', 'JAX', 'GB'];
  
  const playerNames = {
    QB: ['Patrick Mahomes', 'Josh Allen', 'Jalen Hurts', 'Lamar Jackson', 'Joe Burrow', 'Dak Prescott', 'Tua Tagovailoa', 'Justin Herbert', 'Trevor Lawrence', 'Jared Goff'],
    RB: ['Christian McCaffrey', 'Austin Ekeler', 'Bijan Robinson', 'Nick Chubb', 'Saquon Barkley', 'Tony Pollard', 'Josh Jacobs', 'Derrick Henry', 'Jonathan Taylor', 'Rhamondre Stevenson'],
    WR: ['Justin Jefferson', 'Ja\'Marr Chase', 'Tyreek Hill', 'Stefon Diggs', 'CeeDee Lamb', 'A.J. Brown', 'Davante Adams', 'Cooper Kupp', 'Amon-Ra St. Brown', 'Jaylen Waddle'],
    TE: ['Travis Kelce', 'Mark Andrews', 'T.J. Hockenson', 'George Kittle', 'Dallas Goedert', 'Darren Waller', 'Kyle Pitts', 'Pat Freiermuth', 'Evan Engram', 'Cole Kmet'],
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
        games: 17
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

// Generate AI personalities for mock draft
function generateAIPersonalities(teamCount: number, difficulty: string): AIPersonality[] {
  const personalities: AIPersonality[] = [];
  const styles = ['aggressive', 'conservative', 'balanced', 'contrarian', 'homer'] as const;
  
  for (let i = 2; i <= teamCount; i++) {
    const style = styles[Math.floor(Math.random() * styles.length)];
    const riskTolerance = 
      difficulty === 'easy' ? 0.3 + Math.random() * 0.2 :
      difficulty === 'medium' ? 0.4 + Math.random() * 0.3 :
      difficulty === 'hard' ? 0.5 + Math.random() * 0.4 :
      0.6 + Math.random() * 0.4;
    
    personalities.push({
      teamId: `team-${i}`,
      style,
      riskTolerance,
      positionPreference: style === 'aggressive' ? ['RB', 'WR'] : 
                         style === 'conservative' ? ['QB', 'TE'] : undefined
    });
  }
  
  return personalities;
}

// Simulate AI draft picks
async function simulateAIPicks(
  engine: DraftEngine, 
  personalities: AIPersonality[],
  speed: string
) {
  const delay = speed === 'instant' ? 0 : speed === 'fast' ? 500 : 2000;
  
  // Run draft simulation
  const draftInterval = setInterval(() => {
    const state = engine.getDraftState();
    const currentTeam = state.draftOrder[state.currentPick % state.teamCount];
    
    // Check if it's an AI team's turn
    if (currentTeam !== state.myTeamId && !state.isPaused) {
      const personality = personalities.find(p => p.teamId === currentTeam);
      
      // Get recommendations based on personality
      const recommendations = engine.getRecommendations(10);
      let pick = recommendations[0];
      
      if (personality && recommendations.length > 0) {
        // Adjust pick based on personality
        if (personality.style === 'contrarian') {
          // Pick someone unexpected
          pick = recommendations[Math.floor(Math.random() * Math.min(5, recommendations.length))];
        } else if (personality.style === 'aggressive' && personality.positionPreference) {
          // Prefer certain positions
          const preferred = recommendations.find(r => {
            const player = Array.from(engine['players'].values())
              .find(p => p.id === r.playerId);
            return player && personality.positionPreference!.includes(player.position);
          }) || pick;
          pick = preferred;
        }
      }
      
      // Make the pick
      if (pick) {
        engine.makePick(pick.playerId);
      }
    }
    
    // Check if draft is complete
    if (state.currentPick >= state.teamCount * state.rosterSize) {
      clearInterval(draftInterval);
    }
  }, delay);
  
  return draftInterval;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings = {} }: { settings: MockDraftSettings } = body;

    const {
      aiDifficulty = 'medium',
      speed = 'fast'
    } = settings;

    // Generate mock data
    const players = generateMockPlayers();
    const projections = generateMockProjections(players);

    // Create league settings
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

    // Create draft order
    const draftOrder = Array.from({ length: 12 }, (_, i) => `team-${i + 1}`);
    const myTeamId = 'team-1';

    // Create draft engine
    const draftId = `mock-draft-${Date.now()}`;
    const engine = new DraftEngine(
      players,
      projections,
      leagueSettings,
      draftOrder,
      myTeamId
    );

    // Store draft engine
    activeDrafts.set(draftId, engine);

    // Generate AI personalities
    const aiPersonalities = generateAIPersonalities(leagueSettings.teamCount, aiDifficulty);

    // Start AI simulation
    simulateAIPicks(engine, aiPersonalities, speed);

    // Get initial draft state
    const draftState = engine.getDraftState();

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
        ...draftState,
        draftId,
        teams: teamsObject,
        availablePlayers: availablePlayersArray
      },
      players: playersArray,
      aiPersonalities,
      message: 'Mock draft started successfully!'
    });
  } catch (error) {
    logger.error('Error starting mock draft:', { error: error });
    return NextResponse.json(
      { error: 'Failed to start mock draft' },
      { status: 500 }
    );
  }
}