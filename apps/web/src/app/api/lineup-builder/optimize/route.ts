import { NextRequest, NextResponse } from 'next/server';
import { dfsOptimizerFixed } from '../../../../../scripts/fantasy-ml/models/dfs-lineup-optimizer';
import { logger } from '../../../../lib/logging/logger';

interface OptimizationRequest {
  settings: {
    sport: string;
    platform: 'draftkings' | 'fanduel';
    contestType: 'GPP' | 'CASH' | 'TOURNAMENTS';
    riskLevel: 'conservative' | 'balanced' | 'aggressive';
    enableStacking: boolean;
    stackType?: string;
    maxFromTeam: number;
    minSalaryUsed: number;
  };
  lockedPlayers: string[];
  currentLineup: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: OptimizationRequest = await request.json();
    const { settings, lockedPlayers, currentLineup } = body;

    // Create a ReadableStream for real-time progress updates
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial progress
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ progress: 0, status: 'Loading player data...' }) + '\n'
          ));

          // Fetch current player projections
          const playersResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/predictions?sport=${settings.sport}&platform=${settings.platform}`);
          const playersData = await playersResponse.json();

          if (!playersData.success || !playersData.predictions) {
            throw new Error('Failed to load player data');
          }

          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ progress: 20, status: 'Preparing optimization...' }) + '\n'
          ));

          // Convert to DFS optimizer format
          const dfsPlayers = playersData.predictions.map((p: any) => ({
            id: p.player_id || `${p.name}_${p.team}`,
            name: p.name,
            position: p.position,
            team: p.team,
            opponent: p.opponent,
            salary: p.salary,
            projected_points: p.projected_points,
            projected_ownership: p.ownership_projection || 0.1,
            floor: p.floor || p.projected_points * 0.7,
            ceiling: p.ceiling || p.projected_points * 1.4,
            boom_probability: p.boom_probability || 0.2,
            correlation_partners: p.stack_partners || []
          }));

          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ progress: 40, status: 'Setting up constraints...' }) + '\n'
          ));

          // Set up lineup constraints based on sport and platform
          const constraints = getLineupConstraints(settings.sport, settings.platform);
          
          // Apply locked players constraint
          if (lockedPlayers.length > 0) {
            constraints.must_include = lockedPlayers;
          }

          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ progress: 60, status: 'Optimizing lineups...' }) + '\n'
          ));

          // Determine optimization strategy based on risk level and contest type
          let strategy: 'balanced' | 'contrarian' | 'ceiling' = 'balanced';
          if (settings.riskLevel === 'aggressive' || settings.contestType === 'GPP') {
            strategy = 'ceiling';
          } else if (settings.riskLevel === 'conservative') {
            strategy = 'contrarian';
          }

          // Generate multiple lineups (more for tournaments)
          const numLineups = settings.contestType === 'TOURNAMENTS' ? 20 : 
                           settings.contestType === 'GPP' ? 15 : 5;

          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ progress: 80, status: `Generating ${numLineups} lineups...` }) + '\n'
          ));

          // Run optimization
          const optimizedLineups = await dfsOptimizerFixed.optimizeLineups(
            dfsPlayers,
            constraints,
            numLineups,
            strategy
          );

          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ progress: 95, status: 'Finalizing results...' }) + '\n'
          ));

          // Convert back to frontend format
          const formattedLineups = optimizedLineups.map((lineup, index) => ({
            players: lineup.players.map(p => ({
              player_id: p.id,
              name: p.name,
              position: p.position,
              team: p.team,
              opponent: p.opponent,
              salary: p.salary,
              projected_points: p.projected_points,
              floor: p.floor,
              ceiling: p.ceiling,
              ownership_projection: p.projected_ownership,
              leverage_score: lineup.leverage_score,
              value_rating: p.projected_points / (p.salary / 1000)
            })),
            totalSalary: lineup.total_salary,
            totalProjected: lineup.projected_points,
            totalOwnership: lineup.projected_ownership,
            avgLeverage: lineup.leverage_score,
            confidence: Math.min(0.95, 0.6 + (lineup.leverage_score / 10))
          }));

          // Send final results
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ 
              progress: 100, 
              status: 'Complete!',
              lineups: formattedLineups,
              success: true
            }) + '\n'
          ));

          controller.close();

        } catch (error) {
          logger.error('Optimization error:', { error: error });
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ 
              error: 'Optimization failed', 
              message: error instanceof Error ? error.message : 'Unknown error',
              success: false 
            }) + '\n'
          ));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    logger.error('Lineup optimization error:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to optimize lineup',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getLineupConstraints(sport: string, platform: string) {
  const salaryCap = platform === 'draftkings' ? 50000 : 60000;
  
  const constraints = {
    salary_cap: salaryCap,
    positions: new Map(),
    min_teams: 2,
    max_from_team: 4,
  };

  // Set position requirements based on sport
  switch (sport) {
    case 'nfl':
      constraints.positions.set('QB', 1);
      constraints.positions.set('RB', 2);
      constraints.positions.set('WR', 3);
      constraints.positions.set('TE', 1);
      constraints.positions.set('FLEX', 1); // RB/WR/TE
      constraints.positions.set('DST', 1);
      break;
      
    case 'nba':
      constraints.positions.set('PG', 1);
      constraints.positions.set('SG', 1);
      constraints.positions.set('SF', 1);
      constraints.positions.set('PF', 1);
      constraints.positions.set('C', 1);
      constraints.positions.set('G', 1); // PG/SG
      constraints.positions.set('F', 1); // SF/PF
      constraints.positions.set('UTIL', 1); // Any position
      break;
      
    case 'mlb':
      // MLB lineup positions
      constraints.positions.set('P', 2);
      constraints.positions.set('C', 1);
      constraints.positions.set('1B', 1);
      constraints.positions.set('2B', 1);
      constraints.positions.set('3B', 1);
      constraints.positions.set('SS', 1);
      constraints.positions.set('OF', 3);
      break;
      
    case 'nhl':
      constraints.positions.set('C', 2);
      constraints.positions.set('W', 3);
      constraints.positions.set('D', 2);
      constraints.positions.set('G', 1);
      break;
      
    default:
      // Default to NFL
      constraints.positions.set('QB', 1);
      constraints.positions.set('RB', 2);
      constraints.positions.set('WR', 3);
      constraints.positions.set('TE', 1);
      constraints.positions.set('FLEX', 1);
      constraints.positions.set('DST', 1);
  }

  return constraints;
}