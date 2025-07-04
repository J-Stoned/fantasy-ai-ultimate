import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Demo player data with predictions
const DEMO_PLAYERS = [
  {
    id: '1',
    name: 'LeBron James',
    team: 'Lakers',
    position: 'SF',
    predictions: {
      points: 26.3,
      assists: 7.8,
      rebounds: 8.1,
      steals: 1.2,
      blocks: 0.9,
      fantasyPoints: 48.2
    },
    confidence: 82,
    trends: { points: 'up', assists: 'stable', rebounds: 'up' },
    factors: ['Home game', 'Well rested', 'Favorable matchup']
  },
  {
    id: '2',
    name: 'Stephen Curry',
    team: 'Warriors',
    position: 'PG',
    predictions: {
      points: 29.7,
      assists: 6.2,
      rebounds: 5.3,
      steals: 1.4,
      blocks: 0.3,
      fantasyPoints: 45.8
    },
    confidence: 78,
    trends: { points: 'hot', assists: 'up', rebounds: 'stable' },
    factors: ['Hot streak', '3-game win streak']
  },
  {
    id: '3',
    name: 'Giannis Antetokounmpo',
    team: 'Bucks',
    position: 'PF',
    predictions: {
      points: 31.2,
      assists: 5.9,
      rebounds: 11.4,
      steals: 1.1,
      blocks: 1.6,
      fantasyPoints: 56.7
    },
    confidence: 85,
    trends: { points: 'stable', assists: 'up', rebounds: 'hot' },
    factors: ['Dominant form', 'Weak opponent defense']
  },
  {
    id: '4',
    name: 'Luka Dončić',
    team: 'Mavericks',
    position: 'PG',
    predictions: {
      points: 28.9,
      assists: 8.4,
      rebounds: 8.7,
      steals: 1.3,
      blocks: 0.6,
      fantasyPoints: 52.3
    },
    confidence: 81,
    trends: { points: 'stable', assists: 'hot', rebounds: 'up' },
    factors: ['Triple-double threat', 'High usage rate']
  },
  {
    id: '5',
    name: 'Jayson Tatum',
    team: 'Celtics',
    position: 'SF',
    predictions: {
      points: 27.4,
      assists: 4.8,
      rebounds: 8.2,
      steals: 1.0,
      blocks: 0.8,
      fantasyPoints: 44.6
    },
    confidence: 77,
    trends: { points: 'up', assists: 'stable', rebounds: 'stable' },
    factors: ['Team leader', 'Clutch performer']
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  try {
    if (playerId) {
      // Get specific player
      const player = DEMO_PLAYERS.find(p => p.id === playerId);
      if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }
      
      // Add recent games data
      const recentGames = Array(5).fill(null).map((_, i) => ({
        gameId: `game_${i}`,
        date: new Date(Date.now() - i * 86400000).toISOString(),
        opponent: ['Lakers', 'Warriors', 'Celtics', 'Heat', 'Nuggets'][i],
        actual: {
          points: player.predictions.points + (Math.random() - 0.5) * 10,
          assists: player.predictions.assists + (Math.random() - 0.5) * 3,
          rebounds: player.predictions.rebounds + (Math.random() - 0.5) * 4,
          fantasyPoints: player.predictions.fantasyPoints + (Math.random() - 0.5) * 15
        },
        predicted: {
          points: player.predictions.points + (Math.random() - 0.5) * 8,
          assists: player.predictions.assists + (Math.random() - 0.5) * 2,
          rebounds: player.predictions.rebounds + (Math.random() - 0.5) * 3,
          fantasyPoints: player.predictions.fantasyPoints + (Math.random() - 0.5) * 12
        }
      }));
      
      return NextResponse.json({
        player,
        recentGames,
        seasonAverages: {
          points: player.predictions.points - 1.2,
          assists: player.predictions.assists - 0.3,
          rebounds: player.predictions.rebounds - 0.5,
          fantasyPoints: player.predictions.fantasyPoints - 2.1
        }
      });
    }
    
    // Get all players with predictions
    const players = DEMO_PLAYERS.slice(0, limit).map(player => ({
      ...player,
      nextGame: {
        opponent: ['Lakers', 'Warriors', 'Celtics', 'Heat', 'Nuggets'][Math.floor(Math.random() * 5)],
        date: new Date(Date.now() + 86400000).toISOString(),
        time: '7:30 PM'
      }
    }));
    
    return NextResponse.json({
      players,
      generated: new Date().toISOString(),
      model: 'player_performance_v1'
    });
    
  } catch (error) {
    console.error('Player predictions error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate predictions',
      players: DEMO_PLAYERS.slice(0, 5)
    }, { status: 500 });
  }
}