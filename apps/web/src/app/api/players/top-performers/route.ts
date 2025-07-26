import { NextRequest, NextResponse } from 'next/server';
import { gameStatsService } from '@/lib/database/game-stats-service';
import { playerDataService } from '@/lib/database/player-data-service';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const sport = searchParams.get('sport') || 'NFL';
    const timeframe = searchParams.get('timeframe') || 'week';
    const position = searchParams.get('position') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');

    logger.info('🏆 Fetching top performers from 1.57M game stats', {
      sport,
      timeframe,
      position,
      limit
    });

    // Calculate date range based on timeframe
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'season':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
    }

    // Get top performers from game stats
    const { data: topPerformers, error } = await gameStatsService.getTopPerformers({
      sport,
      position,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      limit,
      orderBy: 'fantasy_points'
    });

    if (error || !topPerformers) {
      logger.error('Error fetching top performers:', error);
      return NextResponse.json({
        players: [],
        message: 'No top performers found'
      });
    }

    // Enrich each performer with full player data
    const enrichedPerformers = await Promise.all(
      topPerformers.map(async (performer) => {
        try {
          const { data: player } = await playerDataService.getPlayerById(
            performer.player_id,
            { include_stats: true }
          );

          if (!player) return null;

          // Get recent trend
          const { data: recentGames } = await gameStatsService.getPlayerGameLogs(
            performer.player_id,
            { limit: 3 }
          );

          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (recentGames && recentGames.length >= 2) {
            const lastGame = recentGames[0].fantasy_points || 0;
            const prevGame = recentGames[1].fantasy_points || 0;
            
            if (lastGame > prevGame * 1.1) trend = 'up';
            else if (lastGame < prevGame * 0.9) trend = 'down';
          }

          return {
            id: player.id.toString(),
            name: player.name,
            position: player.position,
            team: player.team || 'FA',
            sport: player.sport,
            avgPoints: performer.avg_fantasy_points,
            totalPoints: performer.total_fantasy_points,
            gamesPlayed: performer.games_played,
            lastGamePoints: recentGames?.[0]?.fantasy_points || 0,
            trend,
            consistency: performer.consistency_score || 75,
            ownership: Math.min(95, Math.max(20, 80 - (performer.rank || 0) * 2)),
            avatar_url: player.avatar_url,
            avatar_tier: player.avatar_tier,
            overall_rating: player.overall_rating,
            injury_status: player.injury_status || 'healthy',
            stats: performer.stats,
            timeframeStats: {
              points: performer.total_fantasy_points,
              average: performer.avg_fantasy_points,
              games: performer.games_played,
              bestGame: performer.max_fantasy_points,
              worstGame: performer.min_fantasy_points
            }
          };
        } catch (error) {
          logger.error(`Error enriching performer ${performer.player_id}:`, error);
          return null;
        }
      })
    );

    // Filter out any null results
    const validPerformers = enrichedPerformers.filter(p => p !== null);

    logger.info(`✅ Found ${validPerformers.length} top performers`, {
      topScorer: validPerformers[0]?.name,
      topPoints: validPerformers[0]?.avgPoints,
      sport,
      timeframe
    });

    return NextResponse.json({
      players: validPerformers,
      timeframe,
      sport,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      dataSource: '1.57M game stats database'
    });

  } catch (error) {
    logger.error('Error in top performers endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top performers' },
      { status: 500 }
    );
  }
}