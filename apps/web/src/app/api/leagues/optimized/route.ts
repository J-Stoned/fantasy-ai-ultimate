import { NextRequest, NextResponse } from 'next/server';
import { optimizedDB } from '@/lib/services/optimized-database';
import { playerLoader, leagueLoader, playerStatsLoader } from '@/lib/services/data-loader';
import { cache } from '@/lib/services/cache';
import { logger } from '../../../../lib/logging/logger';

// GET /api/leagues/optimized - Get league data with optimized queries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const includeStats = searchParams.get('includeStats') === 'true';
    
    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `league:full:${leagueId}:${includeStats}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Use DataLoader to prevent N+1 queries
    const league = await leagueLoader.load(leagueId);
    
    if (!league) {
      return NextResponse.json(
        { success: false, error: 'League not found' },
        { status: 404 }
      );
    }

    // Get players with stats using optimized query
    const players = await optimizedDB.getPlayersWithStats(leagueId);
    
    // If stats requested, batch load them
    let playerStats = null;
    if (includeStats) {
      const playerIds = players.map(p => p.id);
      playerStats = await playerStatsLoader.loadMany(playerIds);
    }

    // Get league summary with aggregated data
    const leagueDetails = await optimizedDB.getLeagueWithDetails(leagueId);

    // Construct response
    const response = {
      league: leagueDetails,
      players: players.map((player, index) => ({
        ...player,
        stats: includeStats ? playerStats?.[index] : undefined
      })),
      meta: {
        playerCount: players.length,
        avgPoints: leagueDetails.league_avg_points,
        lastUpdated: new Date().toISOString()
      }
    };

    // Cache the response
    await cache.set(cacheKey, response, { 
      ttl: 300, // 5 minutes
      tags: ['league', leagueId]
    });

    return NextResponse.json({
      success: true,
      data: response,
      cached: false
    });

  } catch (error) {
    logger.error('Error fetching optimized league data:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch league data' },
      { status: 500 }
    );
  }
}

// POST /api/leagues/optimized/batch - Batch update players (optimized)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leagueId, players } = body;
    
    if (!leagueId || !Array.isArray(players)) {
      return NextResponse.json(
        { success: false, error: 'League ID and players array required' },
        { status: 400 }
      );
    }

    // Prepare batch data
    const columns = [
      'id', 'platform_id', 'league_id', 'team_id', 'name',
      'position', 'team', 'injury_status', 'projected_points',
      'season_points', 'image_url'
    ];

    const values = players.map(player => [
      player.id,
      player.platform_id,
      leagueId,
      player.team_id,
      player.name,
      player.position,
      player.team,
      player.injury_status,
      player.projected_points,
      player.season_points,
      player.image_url
    ]);

    // Execute optimized batch insert
    const inserted = await optimizedDB.batchInsert(
      'fantasy_players',
      columns,
      values,
      {
        onConflict: `
          ON CONFLICT (id) DO UPDATE SET
            team_id = EXCLUDED.team_id,
            name = EXCLUDED.name,
            position = EXCLUDED.position,
            team = EXCLUDED.team,
            injury_status = EXCLUDED.injury_status,
            projected_points = EXCLUDED.projected_points,
            season_points = EXCLUDED.season_points,
            image_url = EXCLUDED.image_url,
            updated_at = NOW()
        `,
        batchSize: 500
      }
    );

    // Clear related caches
    await cache.clearByTag(leagueId);
    
    // Clear DataLoader caches
    players.forEach(player => {
      playerLoader.clear(player.id);
    });
    leagueLoader.clear(leagueId);

    return NextResponse.json({
      success: true,
      inserted,
      message: `Successfully updated ${inserted} players`
    });

  } catch (error) {
    logger.error('Error batch updating players:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Failed to update players' },
      { status: 500 }
    );
  }
}