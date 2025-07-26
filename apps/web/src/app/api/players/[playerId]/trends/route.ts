import { NextRequest, NextResponse } from 'next/server';
import { playerDataService } from '@/lib/database/player-data-service';
import { gameStatsService } from '@/lib/database/game-stats-service';
import { logger } from '@/lib/logging/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const playerId = parseInt(params.playerId);
    
    logger.info('📈 Calculating player trends from real game data', { playerId });

    // Get player profile
    const { data: player, error: playerError } = await playerDataService.getPlayerById(playerId);
    
    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Get recent games for trend analysis
    const { data: recentGames } = await gameStatsService.getPlayerGameLogs(
      playerId,
      { limit: 20 } // Get more games for better trend analysis
    );

    if (!recentGames || recentGames.length === 0) {
      return NextResponse.json({
        playerId,
        shortTerm: { direction: 'stable', averagePoints: 0, consistency: 0 },
        mediumTerm: { direction: 'stable', averagePoints: 0, consistency: 0 },
        longTerm: { direction: 'stable', averagePoints: 0, consistency: 0 },
        projections: { nextGame: 0, restOfSeason: 0, playoffs: 0 }
      });
    }

    // Calculate trends for different periods
    const shortTermGames = recentGames.slice(0, 3);
    const mediumTermGames = recentGames.slice(0, 8);
    const longTermGames = recentGames;

    const calculateTrend = (games: any[]) => {
      if (games.length < 2) {
        return { direction: 'stable' as const, averagePoints: 0, consistency: 0 };
      }

      const points = games.map(g => g.fantasy_points || 0);
      const avg = points.reduce((sum, p) => sum + p, 0) / points.length;
      
      // Calculate consistency (lower is better)
      const variance = points.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / points.length;
      const stdDev = Math.sqrt(variance);
      const consistency = 100 - Math.min(100, (stdDev / avg) * 100);

      // Determine trend direction
      const recentAvg = points.slice(0, Math.ceil(points.length / 2))
        .reduce((sum, p) => sum + p, 0) / Math.ceil(points.length / 2);
      const olderAvg = points.slice(Math.ceil(points.length / 2))
        .reduce((sum, p) => sum + p, 0) / Math.floor(points.length / 2);

      let direction: 'up' | 'down' | 'stable' = 'stable';
      if (recentAvg > olderAvg * 1.1) direction = 'up';
      else if (recentAvg < olderAvg * 0.9) direction = 'down';

      // Get usage metrics if available
      const usageRate = games[0]?.stats?.usage_rate || 
                       games[0]?.stats?.target_share || 
                       games[0]?.stats?.touch_percentage;
      const snapPercentage = games[0]?.stats?.snap_percentage ||
                            games[0]?.stats?.minutes_percentage;

      return {
        direction,
        averagePoints: Math.round(avg * 10) / 10,
        consistency: Math.round(consistency),
        usageRate,
        snapPercentage
      };
    };

    const shortTerm = calculateTrend(shortTermGames);
    const mediumTerm = calculateTrend(mediumTermGames);
    const longTerm = calculateTrend(longTermGames);

    // Calculate projections based on trends
    const weightedAvg = (shortTerm.averagePoints * 0.5) + 
                       (mediumTerm.averagePoints * 0.3) + 
                       (longTerm.averagePoints * 0.2);

    // Adjust projections based on trend direction
    let trendMultiplier = 1;
    if (shortTerm.direction === 'up' && mediumTerm.direction === 'up') {
      trendMultiplier = 1.1;
    } else if (shortTerm.direction === 'down' && mediumTerm.direction === 'down') {
      trendMultiplier = 0.9;
    }

    const projections = {
      nextGame: Math.round(weightedAvg * trendMultiplier * 10) / 10,
      restOfSeason: Math.round(weightedAvg * 10) / 10,
      playoffs: Math.round(weightedAvg * 1.05 * 10) / 10 // Slight boost for playoffs
    };

    logger.info(`✅ Calculated trends for ${player.name}`, {
      shortTerm: shortTerm.direction,
      mediumTerm: mediumTerm.direction,
      projection: projections.nextGame
    });

    return NextResponse.json({
      playerId,
      playerName: player.name,
      shortTerm,
      mediumTerm,
      longTerm,
      projections,
      dataSource: '1.57M game stats database',
      gamesAnalyzed: recentGames.length
    });

  } catch (error) {
    logger.error('Error calculating player trends:', error);
    return NextResponse.json(
      { error: 'Failed to calculate trends' },
      { status: 500 }
    );
  }
}