import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging/logger';

// Types
interface LivePlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  fantasyPoints: number;
  isActive: boolean;
  gameId: string;
  stats: Record<string, number>;
  projectedPoints: number;
  ownership: number;
  salary?: number;
  status: 'active' | 'inactive' | 'injured' | 'questionable';
  injury?: {
    status: string;
    description: string;
    updatedAt: string;
  };
  liveUpdates: Array<{
    timestamp: string;
    type: 'stat' | 'injury' | 'status';
    description: string;
    fantasyImpact: number;
  }>;
}

interface PlayerAlert {
  id: string;
  playerId: string;
  type: 'touchdown' | 'injury' | 'milestone' | 'benched' | 'target_share';
  message: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  fantasyPointsAdded: number;
}

// Mock live players data
const mockLivePlayers: LivePlayer[] = [
  {
    id: 'nfl_player_1',
    name: 'Josh Allen',
    team: 'BUF',
    position: 'QB',
    fantasyPoints: 22.4,
    isActive: true,
    gameId: 'nfl_1',
    stats: {
      completions: 18,
      attempts: 26,
      passingYards: 284,
      passingTouchdowns: 3,
      rushingYards: 42,
      rushingTouchdowns: 1,
      interceptions: 0
    },
    projectedPoints: 26.8,
    ownership: 23.4,
    salary: 8800,
    status: 'active',
    liveUpdates: [
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'stat',
        description: '15-yard touchdown pass to Stefon Diggs',
        fantasyImpact: 4
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        type: 'stat',
        description: '22-yard rushing touchdown',
        fantasyImpact: 6
      }
    ]
  },
  {
    id: 'nfl_player_2',
    name: 'Patrick Mahomes',
    team: 'KC',
    position: 'QB',
    fantasyPoints: 26.8,
    isActive: true,
    gameId: 'nfl_1',
    stats: {
      completions: 21,
      attempts: 29,
      passingYards: 318,
      passingTouchdowns: 3,
      rushingYards: 28,
      rushingTouchdowns: 0,
      interceptions: 1
    },
    projectedPoints: 28.2,
    ownership: 28.1,
    salary: 9200,
    status: 'active',
    liveUpdates: [
      {
        timestamp: new Date(Date.now() - 180000).toISOString(),
        type: 'stat',
        description: '45-yard touchdown bomb to Tyreek Hill',
        fantasyImpact: 4
      }
    ]
  },
  {
    id: 'nfl_player_3',
    name: 'Travis Kelce',
    team: 'KC',
    position: 'TE',
    fantasyPoints: 18.7,
    isActive: true,
    gameId: 'nfl_1',
    stats: {
      receptions: 8,
      targets: 11,
      receivingYards: 127,
      receivingTouchdowns: 1,
      rushingYards: 0,
      rushingTouchdowns: 0
    },
    projectedPoints: 16.5,
    ownership: 35.2,
    salary: 7400,
    status: 'active',
    liveUpdates: [
      {
        timestamp: new Date(Date.now() - 420000).toISOString(),
        type: 'stat',
        description: '15-yard touchdown reception',
        fantasyImpact: 6
      }
    ]
  },
  {
    id: 'nba_player_1',
    name: 'LeBron James',
    team: 'LAL',
    position: 'PF',
    fantasyPoints: 45.2,
    isActive: true,
    gameId: 'nba_1',
    stats: {
      points: 28,
      rebounds: 9,
      assists: 8,
      steals: 2,
      blocks: 1,
      turnovers: 3,
      fieldGoalsMade: 11,
      fieldGoalsAttempted: 18,
      threePointersMade: 3,
      threePointersAttempted: 6
    },
    projectedPoints: 48.5,
    ownership: 31.8,
    salary: 10200,
    status: 'active',
    liveUpdates: [
      {
        timestamp: new Date(Date.now() - 240000).toISOString(),
        type: 'stat',
        description: 'Triple-double alert: 28 PTS, 9 REB, 8 AST',
        fantasyImpact: 5
      }
    ]
  },
  {
    id: 'nba_player_2',
    name: 'Jayson Tatum',
    team: 'BOS',
    position: 'SF',
    fantasyPoints: 41.8,
    isActive: true,
    gameId: 'nba_1',
    stats: {
      points: 32,
      rebounds: 7,
      assists: 5,
      steals: 1,
      blocks: 0,
      turnovers: 2,
      fieldGoalsMade: 12,
      fieldGoalsAttempted: 22,
      threePointersMade: 5,
      threePointersAttempted: 10
    },
    projectedPoints: 44.2,
    ownership: 26.4,
    salary: 9600,
    status: 'active',
    injury: {
      status: 'Questionable',
      description: 'Left ankle sprain',
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    },
    liveUpdates: [
      {
        timestamp: new Date(Date.now() - 900000).toISOString(),
        type: 'injury',
        description: 'Returned to game after ankle evaluation',
        fantasyImpact: 0
      }
    ]
  }
];

// Simulate live player updates
const updatePlayerStats = () => {
  mockLivePlayers.forEach(player => {
    if (player.isActive && Math.random() > 0.8) {
      const updateType = Math.random();
      let fantasyImpact = 0;
      let description = '';

      if (player.position === 'QB') {
        if (updateType > 0.7) {
          player.stats.completions = (player.stats.completions || 0) + 1;
          player.stats.passingYards = (player.stats.passingYards || 0) + Math.floor(Math.random() * 20) + 5;
          fantasyImpact = 0.5;
          description = `${Math.floor(Math.random() * 15) + 5}-yard completion`;
        } else if (updateType > 0.9) {
          player.stats.passingTouchdowns = (player.stats.passingTouchdowns || 0) + 1;
          player.stats.passingYards = (player.stats.passingYards || 0) + Math.floor(Math.random() * 20) + 10;
          fantasyImpact = 4;
          description = `${Math.floor(Math.random() * 30) + 10}-yard touchdown pass`;
        }
      } else if (player.position === 'RB') {
        if (updateType > 0.8) {
          player.stats.rushingYards = (player.stats.rushingYards || 0) + Math.floor(Math.random() * 15) + 3;
          fantasyImpact = 0.3;
          description = `${Math.floor(Math.random() * 12) + 3}-yard rush`;
        }
      } else if (['WR', 'TE'].includes(player.position)) {
        if (updateType > 0.7) {
          player.stats.receptions = (player.stats.receptions || 0) + 1;
          player.stats.receivingYards = (player.stats.receivingYards || 0) + Math.floor(Math.random() * 25) + 5;
          fantasyImpact = 1.5;
          description = `${Math.floor(Math.random() * 20) + 5}-yard reception`;
        }
      }

      if (description) {
        player.fantasyPoints += fantasyImpact;
        player.liveUpdates.unshift({
          timestamp: new Date().toISOString(),
          type: 'stat',
          description,
          fantasyImpact
        });
        
        // Keep only last 10 updates
        player.liveUpdates = player.liveUpdates.slice(0, 10);
      }
    }
  });
};

// Update player stats periodically
setInterval(updatePlayerStats, 20000); // Every 20 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const team = searchParams.get('team');
    const position = searchParams.get('position');
    const gameId = searchParams.get('gameId');
    const minFantasyPoints = searchParams.get('minFantasyPoints');
    const includeProjections = searchParams.get('includeProjections') === 'true';
    const includeOwnership = searchParams.get('includeOwnership') === 'true';

    // Filter players based on query parameters
    let filteredPlayers = mockLivePlayers;

    if (sport) {
      const sportPrefix = sport.toLowerCase();
      filteredPlayers = filteredPlayers.filter(player => 
        player.id.startsWith(`${sportPrefix}_player`)
      );
    }

    if (team) {
      filteredPlayers = filteredPlayers.filter(player => 
        player.team.toLowerCase() === team.toLowerCase()
      );
    }

    if (position) {
      filteredPlayers = filteredPlayers.filter(player => 
        player.position.toLowerCase() === position.toLowerCase()
      );
    }

    if (gameId) {
      filteredPlayers = filteredPlayers.filter(player => 
        player.gameId === gameId
      );
    }

    if (minFantasyPoints) {
      const minPoints = parseFloat(minFantasyPoints);
      filteredPlayers = filteredPlayers.filter(player => 
        player.fantasyPoints >= minPoints
      );
    }

    // Sort by fantasy points descending
    filteredPlayers.sort((a, b) => b.fantasyPoints - a.fantasyPoints);

    // Add real-time performance indicators
    const playersWithPerformance = filteredPlayers.map(player => ({
      ...player,
      performance: {
        vsProjection: ((player.fantasyPoints / player.projectedPoints) * 100).toFixed(1),
        trend: player.liveUpdates.slice(0, 3).reduce((sum, update) => sum + update.fantasyImpact, 0),
        lastUpdate: player.liveUpdates[0]?.timestamp || player.liveUpdates[0]?.timestamp
      },
      ...(includeProjections && {
        projection: {
          remaining: Math.max(0, player.projectedPoints - player.fantasyPoints),
          confidence: Math.random() * 0.3 + 0.7 // 70-100% confidence
        }
      }),
      ...(includeOwnership && {
        ownership: {
          percentage: player.ownership,
          leverage: calculateLeverage(player)
        }
      })
    }));

    return NextResponse.json({
      success: true,
      data: playersWithPerformance,
      meta: {
        total: playersWithPerformance.length,
        lastUpdate: new Date().toISOString(),
        filters: { sport, team, position, gameId, minFantasyPoints },
        options: { includeProjections, includeOwnership }
      }
    });

  } catch (error) {
    logger.error('Live players API error:', { error: error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch live player data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, playerId, data } = body;

    switch (action) {
      case 'updateStats':
        return handleStatsUpdate(playerId, data);
      case 'updateStatus':
        return handleStatusUpdate(playerId, data);
      case 'addAlert':
        return handleAddPlayerAlert(playerId, data);
      case 'updateInjury':
        return handleInjuryUpdate(playerId, data);
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Live players POST error:', { error: error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateLeverage(player: LivePlayer): number {
  // Calculate leverage score based on ownership vs projection
  const projectionScore = (player.fantasyPoints / player.projectedPoints) * 100;
  const ownershipAdjustment = 100 - player.ownership;
  return (projectionScore * ownershipAdjustment) / 100;
}

async function handleStatsUpdate(playerId: string, data: any) {
  const player = mockLivePlayers.find(p => p.id === playerId);
  if (!player) {
    return NextResponse.json(
      { success: false, error: 'Player not found' },
      { status: 404 }
    );
  }

  // Update stats
  Object.keys(data.stats || {}).forEach(stat => {
    player.stats[stat] = data.stats[stat];
  });

  // Recalculate fantasy points
  player.fantasyPoints = calculateFantasyPoints(player);

  // Add live update
  if (data.description) {
    player.liveUpdates.unshift({
      timestamp: new Date().toISOString(),
      type: 'stat',
      description: data.description,
      fantasyImpact: data.fantasyImpact || 0
    });
  }

  return NextResponse.json({
    success: true,
    data: player,
    message: 'Player stats updated successfully'
  });
}

async function handleStatusUpdate(playerId: string, data: any) {
  const player = mockLivePlayers.find(p => p.id === playerId);
  if (!player) {
    return NextResponse.json(
      { success: false, error: 'Player not found' },
      { status: 404 }
    );
  }

  player.status = data.status;
  player.isActive = data.status === 'active';

  // Add live update
  player.liveUpdates.unshift({
    timestamp: new Date().toISOString(),
    type: 'status',
    description: `Status changed to ${data.status}`,
    fantasyImpact: 0
  });

  return NextResponse.json({
    success: true,
    data: player,
    message: 'Player status updated successfully'
  });
}

async function handleAddPlayerAlert(playerId: string, data: any) {
  const player = mockLivePlayers.find(p => p.id === playerId);
  if (!player) {
    return NextResponse.json(
      { success: false, error: 'Player not found' },
      { status: 404 }
    );
  }

  // This would integrate with WebSocket server to broadcast player-specific alerts
  // realtimeServer.publishToChannel(`player-alerts/user123`, {
  //   type: 'fantasy:alert',
  //   data: {
  //     playerId,
  //     player: player.name,
  //     ...data,
  //     timestamp: new Date().toISOString()
  //   }
  // });

  return NextResponse.json({
    success: true,
    message: 'Player alert added successfully'
  });
}

async function handleInjuryUpdate(playerId: string, data: any) {
  const player = mockLivePlayers.find(p => p.id === playerId);
  if (!player) {
    return NextResponse.json(
      { success: false, error: 'Player not found' },
      { status: 404 }
    );
  }

  player.injury = {
    status: data.status,
    description: data.description,
    updatedAt: new Date().toISOString()
  };

  // Update player status based on injury
  if (data.status === 'Out') {
    player.status = 'injured';
    player.isActive = false;
  } else if (data.status === 'Questionable') {
    player.status = 'questionable';
  }

  // Add live update
  player.liveUpdates.unshift({
    timestamp: new Date().toISOString(),
    type: 'injury',
    description: `Injury update: ${data.description}`,
    fantasyImpact: data.fantasyImpact || 0
  });

  return NextResponse.json({
    success: true,
    data: player,
    message: 'Player injury updated successfully'
  });
}

function calculateFantasyPoints(player: LivePlayer): number {
  let points = 0;
  const stats = player.stats;

  // Fantasy scoring based on position and sport
  if (player.id.startsWith('nfl_')) {
    // NFL Fantasy scoring
    if (player.position === 'QB') {
      points += (stats.passingYards || 0) * 0.04;
      points += (stats.passingTouchdowns || 0) * 4;
      points += (stats.rushingYards || 0) * 0.1;
      points += (stats.rushingTouchdowns || 0) * 6;
      points -= (stats.interceptions || 0) * 2;
    } else if (player.position === 'RB') {
      points += (stats.rushingYards || 0) * 0.1;
      points += (stats.rushingTouchdowns || 0) * 6;
      points += (stats.receptions || 0) * 1;
      points += (stats.receivingYards || 0) * 0.1;
      points += (stats.receivingTouchdowns || 0) * 6;
    } else if (['WR', 'TE'].includes(player.position)) {
      points += (stats.receptions || 0) * 1;
      points += (stats.receivingYards || 0) * 0.1;
      points += (stats.receivingTouchdowns || 0) * 6;
      points += (stats.rushingYards || 0) * 0.1;
      points += (stats.rushingTouchdowns || 0) * 6;
    }
  } else if (player.id.startsWith('nba_')) {
    // NBA Fantasy scoring
    points += (stats.points || 0) * 1;
    points += (stats.rebounds || 0) * 1.2;
    points += (stats.assists || 0) * 1.5;
    points += (stats.steals || 0) * 3;
    points += (stats.blocks || 0) * 3;
    points -= (stats.turnovers || 0) * 1;
  }

  return Math.round(points * 10) / 10; // Round to 1 decimal place
}