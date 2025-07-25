/**
 * 🏆 Player Predictions API - User-Friendly Interface 🏆
 * 
 * Simplified API that wraps the complex ML predictions
 * and presents them in an easy-to-understand format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging/logger';

// Mock player data for each sport
const PLAYER_DATA = {
  NFL: [
    { id: '1', name: 'Patrick Mahomes', position: 'QB', team: 'KC', opponent: 'BUF', salary: 8200 },
    { id: '2', name: 'Josh Allen', position: 'QB', team: 'BUF', opponent: 'KC', salary: 8000 },
    { id: '3', name: 'Christian McCaffrey', position: 'RB', team: 'SF', opponent: 'DAL', salary: 9000 },
    { id: '4', name: 'Austin Ekeler', position: 'RB', team: 'LAC', opponent: 'LV', salary: 7500 },
    { id: '5', name: 'Tyreek Hill', position: 'WR', team: 'MIA', opponent: 'NYJ', salary: 8500 },
    { id: '6', name: 'Justin Jefferson', position: 'WR', team: 'MIN', opponent: 'GB', salary: 8800 },
    { id: '7', name: 'Stefon Diggs', position: 'WR', team: 'BUF', opponent: 'KC', salary: 7800 },
    { id: '8', name: 'Travis Kelce', position: 'TE', team: 'KC', opponent: 'BUF', salary: 7200 },
    { id: '9', name: 'T.J. Hockenson', position: 'TE', team: 'MIN', opponent: 'GB', salary: 5500 },
    { id: '10', name: 'Dallas Cowboys', position: 'DST', team: 'DAL', opponent: 'SF', salary: 3200 },
    { id: '11', name: 'Derrick Henry', position: 'RB', team: 'TEN', opponent: 'IND', salary: 7300 },
    { id: '12', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', opponent: 'SF', salary: 7600 },
  ],
  NBA: [
    { id: '13', name: 'Nikola Jokic', position: 'C', team: 'DEN', opponent: 'LAL', salary: 11500 },
    { id: '14', name: 'Luka Doncic', position: 'PG', team: 'DAL', opponent: 'PHX', salary: 11200 },
    { id: '15', name: 'Giannis Antetokounmpo', position: 'PF', team: 'MIL', opponent: 'BOS', salary: 11800 },
    { id: '16', name: 'Joel Embiid', position: 'C', team: 'PHI', opponent: 'MIA', salary: 11000 },
    { id: '17', name: 'Stephen Curry', position: 'PG', team: 'GSW', opponent: 'LAC', salary: 10200 },
    { id: '18', name: 'Jayson Tatum', position: 'SF', team: 'BOS', opponent: 'MIL', salary: 9800 },
    { id: '19', name: 'Donovan Mitchell', position: 'SG', team: 'CLE', opponent: 'NYK', salary: 8500 },
    { id: '20', name: 'Anthony Davis', position: 'PF', team: 'LAL', opponent: 'DEN', salary: 10500 },
  ],
  MLB: [
    { id: '21', name: 'Shohei Ohtani', position: 'P', team: 'LAA', opponent: 'HOU', salary: 11000 },
    { id: '22', name: 'Ronald Acuna Jr.', position: 'OF', team: 'ATL', opponent: 'NYM', salary: 6200 },
    { id: '23', name: 'Mookie Betts', position: 'OF', team: 'LAD', opponent: 'SD', salary: 5800 },
    { id: '24', name: 'Aaron Judge', position: 'OF', team: 'NYY', opponent: 'BOS', salary: 6000 },
    { id: '25', name: 'Freddie Freeman', position: '1B', team: 'LAD', opponent: 'SD', salary: 5500 },
    { id: '26', name: 'Mike Trout', position: 'OF', team: 'LAA', opponent: 'HOU', salary: 5700 },
  ],
  NHL: [
    { id: '27', name: 'Connor McDavid', position: 'C', team: 'EDM', opponent: 'CGY', salary: 8500 },
    { id: '28', name: 'Auston Matthews', position: 'C', team: 'TOR', opponent: 'MTL', salary: 8200 },
    { id: '29', name: 'Nathan MacKinnon', position: 'C', team: 'COL', opponent: 'MIN', salary: 8000 },
    { id: '30', name: 'Igor Shesterkin', position: 'G', team: 'NYR', opponent: 'NJ', salary: 7800 },
  ]
};

export async function POST(request: NextRequest) {
  try {
    const { sport } = await request.json();
    
    if (!sport || !PLAYER_DATA[sport as keyof typeof PLAYER_DATA]) {
      return NextResponse.json({
        error: 'Invalid sport. Choose from NFL, NBA, MLB, or NHL.'
      }, { status: 400 });
    }

    // Get players for the selected sport
    const players = PLAYER_DATA[sport as keyof typeof PLAYER_DATA];

    // Call the ML prediction API
    const mlResponse = await fetch(`${request.nextUrl.origin}/api/admin/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sport, players })
    });

    if (!mlResponse.ok) {
      throw new Error('Failed to get ML predictions');
    }

    const mlData = await mlResponse.json();

    // Transform the predictions into a user-friendly format
    const predictions = mlData.predictions.map((pred: any) => {
      // Add salary information
      const playerInfo = players.find(p => p.id === pred.playerId);
      
      return {
        ...pred,
        salary: playerInfo?.salary || 0,
        value: pred.predictions.fantasyPoints / (playerInfo?.salary || 1) * 1000, // Points per $1000
        isChalk: pred.predictions.projectedOwnership > 0.2, // 20%+ ownership
        isContrarian: pred.predictions.projectedOwnership < 0.1, // <10% ownership
        isSafePlay: pred.predictions.confidence > 0.8 && pred.predictions.floor > 15,
        isVolatile: (pred.predictions.ceiling - pred.predictions.floor) > pred.predictions.fantasyPoints * 0.5,
        recommendation: getRecommendation(pred)
      };
    });

    return NextResponse.json({
      success: true,
      sport,
      predictions,
      metadata: {
        ...mlData.metadata,
        lastUpdated: new Date().toISOString(),
        totalPlayers: predictions.length
      }
    });

  } catch (error) {
    logger.error('Error in predictions API:', { error: error });
    return NextResponse.json({
      success: false,
      error: 'Failed to generate predictions'
    }, { status: 500 });
  }
}

function getRecommendation(prediction: any): string {
  const { confidence, projectedOwnership, gpp_score, cash_score } = prediction.predictions;
  
  if (cash_score > 15 && confidence > 0.8) {
    return 'Cash Game Lock';
  } else if (gpp_score > 250 && projectedOwnership < 0.15) {
    return 'GPP Leverage Play';
  } else if (confidence > 0.85) {
    return 'Core Play';
  } else if (projectedOwnership < 0.05 && gpp_score > 200) {
    return 'Tournament Dart';
  } else if (confidence > 0.7 && projectedOwnership > 0.2) {
    return 'Popular Play';
  }
  
  return 'Balanced Play';
}

export async function GET(request: NextRequest) {
  // Return available sports
  return NextResponse.json({
    sports: Object.keys(PLAYER_DATA),
    message: 'Use POST method with { sport: "NFL" } to get predictions'
  });
}