import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { logger } from '../../../../lib/logging/logger';

// Types
interface LiveGame {
  id: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  homeTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo: string;
  };
  awayTeam: {
    name: string;
    abbreviation: string;
    score: number;
    logo: string;
  };
  status: 'pre' | 'live' | 'final';
  clock: string;
  quarter?: number;
  inning?: number;
  period?: number;
  lastUpdate: string;
  weather?: {
    condition: string;
    temperature: number;
    windSpeed: number;
  };
  venue?: string;
  attendance?: number;
  broadcasts?: string[];
}

interface GameStats {
  gameId: string;
  homeStats: Record<string, number>;
  awayStats: Record<string, number>;
  keyPlayers: {
    home: Array<{ name: string; position: string; stats: Record<string, number> }>;
    away: Array<{ name: string; position: string; stats: Record<string, number> }>;
  };
}

// Mock live games data (replace with actual data source)
const mockLiveGames: LiveGame[] = [
  {
    id: 'nfl_1',
    sport: 'NFL',
    homeTeam: {
      name: 'Kansas City Chiefs',
      abbreviation: 'KC',
      score: 24,
      logo: '/teams/kc.png'
    },
    awayTeam: {
      name: 'Buffalo Bills',
      abbreviation: 'BUF',
      score: 21,
      logo: '/teams/buf.png'
    },
    status: 'live',
    clock: '12:45',
    quarter: 4,
    lastUpdate: new Date().toISOString(),
    weather: {
      condition: 'Clear',
      temperature: 72,
      windSpeed: 8
    },
    venue: 'Arrowhead Stadium',
    attendance: 76416,
    broadcasts: ['CBS', 'Paramount+']
  },
  {
    id: 'nba_1',
    sport: 'NBA',
    homeTeam: {
      name: 'Los Angeles Lakers',
      abbreviation: 'LAL',
      score: 108,
      logo: '/teams/lal.png'
    },
    awayTeam: {
      name: 'Boston Celtics',
      abbreviation: 'BOS',
      score: 112,
      logo: '/teams/bos.png'
    },
    status: 'live',
    clock: '3:24',
    quarter: 4,
    lastUpdate: new Date().toISOString(),
    venue: 'Crypto.com Arena',
    attendance: 20000,
    broadcasts: ['TNT', 'NBA League Pass']
  },
  {
    id: 'mlb_1',
    sport: 'MLB',
    homeTeam: {
      name: 'New York Yankees',
      abbreviation: 'NYY',
      score: 6,
      logo: '/teams/nyy.png'
    },
    awayTeam: {
      name: 'Boston Red Sox',
      abbreviation: 'BOS',
      score: 4,
      logo: '/teams/bos.png'
    },
    status: 'live',
    clock: 'Bot 8th',
    inning: 8,
    lastUpdate: new Date().toISOString(),
    weather: {
      condition: 'Partly Cloudy',
      temperature: 78,
      windSpeed: 12
    },
    venue: 'Yankee Stadium',
    attendance: 47309,
    broadcasts: ['YES', 'MLB.tv']
  },
  {
    id: 'nhl_1',
    sport: 'NHL',
    homeTeam: {
      name: 'Tampa Bay Lightning',
      abbreviation: 'TBL',
      score: 3,
      logo: '/teams/tbl.png'
    },
    awayTeam: {
      name: 'Toronto Maple Leafs',
      abbreviation: 'TOR',
      score: 2,
      logo: '/teams/tor.png'
    },
    status: 'live',
    clock: '08:15',
    period: 3,
    lastUpdate: new Date().toISOString(),
    venue: 'Amalie Arena',
    attendance: 19092,
    broadcasts: ['Bally Sports', 'ESPN+']
  }
];

// Simulate live score updates
const updateScores = () => {
  mockLiveGames.forEach(game => {
    if (game.status === 'live' && Math.random() > 0.7) {
      // Random score update
      if (Math.random() > 0.5) {
        game.homeTeam.score += Math.floor(Math.random() * 7) + 1;
      } else {
        game.awayTeam.score += Math.floor(Math.random() * 7) + 1;
      }
      game.lastUpdate = new Date().toISOString();
    }
  });
};

// Update scores periodically
setInterval(updateScores, 30000); // Every 30 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport');
    const status = searchParams.get('status');
    const includeStats = searchParams.get('includeStats') === 'true';

    // Filter games based on query parameters
    let filteredGames = mockLiveGames;

    if (sport) {
      filteredGames = filteredGames.filter(game => 
        game.sport.toLowerCase() === sport.toLowerCase()
      );
    }

    if (status) {
      filteredGames = filteredGames.filter(game => game.status === status);
    }

    // Add detailed stats if requested
    if (includeStats) {
      const gamesWithStats = filteredGames.map(game => ({
        ...game,
        stats: generateGameStats(game)
      }));

      return NextResponse.json({
        success: true,
        data: gamesWithStats,
        meta: {
          total: gamesWithStats.length,
          lastUpdate: new Date().toISOString(),
          filters: { sport, status, includeStats }
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredGames,
      meta: {
        total: filteredGames.length,
        lastUpdate: new Date().toISOString(),
        filters: { sport, status }
      }
    });

  } catch (error) {
    logger.error('Live scores API error:', { error: error });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch live scores',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, gameId, data } = body;

    switch (action) {
      case 'updateScore':
        return handleScoreUpdate(gameId, data);
      case 'updateStatus':
        return handleStatusUpdate(gameId, data);
      case 'addAlert':
        return handleAddAlert(gameId, data);
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Live scores POST error:', { error: error });
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
function generateGameStats(game: LiveGame): GameStats {
  // Generate mock stats based on sport
  const stats: GameStats = {
    gameId: game.id,
    homeStats: {},
    awayStats: {},
    keyPlayers: { home: [], away: [] }
  };

  switch (game.sport) {
    case 'NFL':
      stats.homeStats = {
        totalYards: Math.floor(Math.random() * 200) + 250,
        passingYards: Math.floor(Math.random() * 150) + 180,
        rushingYards: Math.floor(Math.random() * 80) + 70,
        turnovers: Math.floor(Math.random() * 3),
        timeOfPossession: Math.floor(Math.random() * 10) + 25
      };
      stats.awayStats = {
        totalYards: Math.floor(Math.random() * 200) + 250,
        passingYards: Math.floor(Math.random() * 150) + 180,
        rushingYards: Math.floor(Math.random() * 80) + 70,
        turnovers: Math.floor(Math.random() * 3),
        timeOfPossession: 60 - stats.homeStats.timeOfPossession
      };
      break;

    case 'NBA':
      stats.homeStats = {
        fieldGoalPercentage: (Math.random() * 0.3 + 0.4) * 100,
        threePointPercentage: (Math.random() * 0.2 + 0.3) * 100,
        freeThrowPercentage: (Math.random() * 0.2 + 0.7) * 100,
        rebounds: Math.floor(Math.random() * 15) + 35,
        assists: Math.floor(Math.random() * 10) + 20,
        turnovers: Math.floor(Math.random() * 8) + 10
      };
      stats.awayStats = {
        fieldGoalPercentage: (Math.random() * 0.3 + 0.4) * 100,
        threePointPercentage: (Math.random() * 0.2 + 0.3) * 100,
        freeThrowPercentage: (Math.random() * 0.2 + 0.7) * 100,
        rebounds: Math.floor(Math.random() * 15) + 35,
        assists: Math.floor(Math.random() * 10) + 20,
        turnovers: Math.floor(Math.random() * 8) + 10
      };
      break;

    case 'MLB':
      stats.homeStats = {
        hits: Math.floor(Math.random() * 6) + 6,
        runs: game.homeTeam.score,
        errors: Math.floor(Math.random() * 3),
        leftOnBase: Math.floor(Math.random() * 5) + 4
      };
      stats.awayStats = {
        hits: Math.floor(Math.random() * 6) + 6,
        runs: game.awayTeam.score,
        errors: Math.floor(Math.random() * 3),
        leftOnBase: Math.floor(Math.random() * 5) + 4
      };
      break;

    case 'NHL':
      stats.homeStats = {
        shots: Math.floor(Math.random() * 15) + 25,
        hits: Math.floor(Math.random() * 10) + 15,
        blockedShots: Math.floor(Math.random() * 8) + 8,
        faceoffWins: Math.floor(Math.random() * 20) + 25,
        powerPlayOpportunities: Math.floor(Math.random() * 4) + 2,
        penaltyMinutes: Math.floor(Math.random() * 8) + 4
      };
      stats.awayStats = {
        shots: Math.floor(Math.random() * 15) + 25,
        hits: Math.floor(Math.random() * 10) + 15,
        blockedShots: Math.floor(Math.random() * 8) + 8,
        faceoffWins: 50 - stats.homeStats.faceoffWins,
        powerPlayOpportunities: Math.floor(Math.random() * 4) + 2,
        penaltyMinutes: Math.floor(Math.random() * 8) + 4
      };
      break;
  }

  return stats;
}

async function handleScoreUpdate(gameId: string, data: any) {
  const game = mockLiveGames.find(g => g.id === gameId);
  if (!game) {
    return NextResponse.json(
      { success: false, error: 'Game not found' },
      { status: 404 }
    );
  }

  // Update scores
  if (data.homeScore !== undefined) game.homeTeam.score = data.homeScore;
  if (data.awayScore !== undefined) game.awayTeam.score = data.awayScore;
  if (data.clock) game.clock = data.clock;
  if (data.quarter) game.quarter = data.quarter;
  if (data.period) game.period = data.period;
  if (data.inning) game.inning = data.inning;

  game.lastUpdate = new Date().toISOString();

  return NextResponse.json({
    success: true,
    data: game,
    message: 'Score updated successfully'
  });
}

async function handleStatusUpdate(gameId: string, data: any) {
  const game = mockLiveGames.find(g => g.id === gameId);
  if (!game) {
    return NextResponse.json(
      { success: false, error: 'Game not found' },
      { status: 404 }
    );
  }

  game.status = data.status;
  game.lastUpdate = new Date().toISOString();

  return NextResponse.json({
    success: true,
    data: game,
    message: 'Game status updated successfully'
  });
}

async function handleAddAlert(gameId: string, data: any) {
  // This would integrate with the WebSocket server to broadcast alerts
  const game = mockLiveGames.find(g => g.id === gameId);
  if (!game) {
    return NextResponse.json(
      { success: false, error: 'Game not found' },
      { status: 404 }
    );
  }

  // Broadcast alert via WebSocket (would integrate with realtimeServer)
  // realtimeServer.publishToChannel(`live-scores/${game.sport.toLowerCase()}`, {
  //   type: 'fantasy:alert',
  //   data: {
  //     gameId,
  //     ...data,
  //     timestamp: new Date().toISOString()
  //   }
  // });

  return NextResponse.json({
    success: true,
    message: 'Alert added successfully'
  });
}