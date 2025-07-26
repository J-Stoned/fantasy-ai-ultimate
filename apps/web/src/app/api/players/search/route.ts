import { NextRequest, NextResponse } from 'next/server';
import { playerDataService } from '@/lib/database/player-data-service';
import { gameStatsService } from '@/lib/database/game-stats-service';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const query = searchParams.get('query') || '';
    const sport = searchParams.get('sport') || undefined;
    const position = searchParams.get('position') || undefined;
    const team = searchParams.get('team') || undefined;
    const sortBy = searchParams.get('sortBy') || 'rank';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    logger.info('🔍 Searching players from 1.57M game stats database', {
      query,
      sport,
      position,
      team,
      limit,
      offset
    });

    // Search players using our elite database
    const players = await playerDataService.searchPlayers({
      name: query,
      sport,
      position,
      team,
      limit,
      offset
    });

    if (!players || players.length === 0) {
      return NextResponse.json({
        players: [],
        total: 0,
        message: 'No players found matching criteria'
      });
    }

    // Enrich with season stats for each player
    const enrichedPlayers = await Promise.all(
      players.map(async (player) => {
        try {
          // Get season stats
          const { data: seasonStats } = await gameStatsService.getSeasonStats(
            player.id,
            new Date().getFullYear()
          );

          // Get recent games
          const { data: recentGames } = await gameStatsService.getPlayerGameLogs(
            player.id,
            { limit: 5 }
          );

          // Calculate trends
          let trend: 'up' | 'down' | 'stable' = 'stable';
          let ownership = 75; // Default ownership
          
          if (recentGames && recentGames.length >= 3) {
            const recentAvg = recentGames.slice(0, 3).reduce((sum, g) => sum + (g.fantasy_points || 0), 0) / 3;
            const seasonAvg = seasonStats?.fantasy_points_avg || 0;
            
            if (recentAvg > seasonAvg * 1.1) trend = 'up';
            else if (recentAvg < seasonAvg * 0.9) trend = 'down';
            
            // Calculate mock ownership based on performance
            ownership = Math.min(95, Math.max(5, 50 + (seasonStats?.overall_rank || 0) * -0.5));
          }

          // Calculate projected points
          const projectedPoints = seasonStats?.fantasy_points_avg || 0;
          const lastGamePoints = recentGames?.[0]?.fantasy_points || 0;

          return {
            id: player.id.toString(),
            name: player.name,
            position: player.position,
            team: player.team || 'FA',
            byeWeek: 10, // TODO: Get actual bye week from schedule
            rank: seasonStats?.overall_rank || 999,
            positionRank: seasonStats?.position_rank || 99,
            avgPoints: seasonStats?.fantasy_points_avg || 0,
            lastGamePoints,
            projectedPoints,
            ownership,
            trend,
            status: player.injury_status || 'healthy',
            news: player.injury_notes,
            // Include full player data for detail view
            fullProfile: player,
            seasonStats,
            recentGames
          };
        } catch (error) {
          logger.error(`Error enriching player ${player.name}:`, error);
          return {
            id: player.id.toString(),
            name: player.name,
            position: player.position,
            team: player.team || 'FA',
            byeWeek: 10,
            rank: 999,
            positionRank: 99,
            avgPoints: 0,
            lastGamePoints: 0,
            projectedPoints: 0,
            ownership: 50,
            trend: 'stable' as const,
            status: 'healthy' as const,
            news: undefined
          };
        }
      })
    );

    // Sort based on sortBy parameter
    enrichedPlayers.sort((a, b) => {
      switch (sortBy) {
        case 'rank':
          return a.rank - b.rank;
        case 'points':
          return b.avgPoints - a.avgPoints;
        case 'ownership':
          return b.ownership - a.ownership;
        case 'trend':
          const trendOrder = { up: 0, stable: 1, down: 2 };
          return trendOrder[a.trend] - trendOrder[b.trend];
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return a.rank - b.rank;
      }
    });

    logger.info(`✅ Found ${enrichedPlayers.length} players from 1.57M game stats`, {
      topPlayer: enrichedPlayers[0]?.name,
      avgPoints: enrichedPlayers[0]?.avgPoints
    });

    return NextResponse.json({
      players: enrichedPlayers,
      total: enrichedPlayers.length,
      hasMore: enrichedPlayers.length === limit,
      dataSource: '1.57M game stats database'
    });

  } catch (error) {
    logger.error('Error searching players:', error);
    return NextResponse.json(
      { error: 'Failed to search players' },
      { status: 500 }
    );
  }
}