import { NextRequest, NextResponse } from 'next/server';
import { LeagueDatabaseService } from '../../../lib/services/league-database-service';
import { logger } from '../../../lib/logging/logger';

export async function GET(req: NextRequest) {
  const dbService = new LeagueDatabaseService();
  
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const sport = searchParams.get('sport');
    const leagueId = searchParams.get('leagueId');
    const includePlayers = searchParams.get('includePlayers') === 'true';
    const enrichPlayers = searchParams.get('enrichPlayers') === 'true';
    
    // Initialize database tables if needed
    await dbService.initializeDatabase();
    
    // Get specific league with players
    if (leagueId) {
      const league = await dbService.getLeague(leagueId);
      
      if (!league) {
        return NextResponse.json({
          success: false,
          error: 'League not found'
        }, { status: 404 });
      }
      
      let players = null;
      if (includePlayers) {
        if (enrichPlayers) {
          // Use enriched players with real game stats data
          players = await dbService.getEnrichedLeaguePlayers(leagueId);
        } else {
          // Use basic league players
          players = await dbService.getLeaguePlayers(leagueId);
        }
      }
      
      return NextResponse.json({
        success: true,
        league: {
          id: league.id,
          platformId: league.platform_id,
          platform: league.platform,
          name: league.name,
          sport: league.sport,
          season: league.season,
          teamCount: league.team_count,
          scoringType: league.scoring_type,
          isActive: league.is_active,
          myTeamId: league.my_team_id,
          myTeamName: league.my_team_name,
          currentStanding: league.current_standing,
          settings: league.settings,
          lastSynced: league.last_synced,
          createdAt: league.created_at,
          updatedAt: league.updated_at,
          players: players,
          playerStats: players ? {
            totalPlayers: players.length,
            enrichedPlayers: enrichPlayers ? players.filter((p: any) => p.hasRealData).length : 0,
            dataSource: enrichPlayers ? '1.57M game stats dataset' : 'platform import'
          } : null
        }
      });
    }
    
    if (platform) {
      // Get leagues for specific platform
      const leagues = await dbService.getLeaguesByPlatform(platform);
      
      // Filter by sport if specified
      const filteredLeagues = sport 
        ? leagues.filter(league => league.sport === sport)
        : leagues;
      
      return NextResponse.json({
        success: true,
        leagues: filteredLeagues.map(league => ({
          id: league.id,
          platformId: league.platform_id,
          platform: league.platform,
          name: league.name,
          sport: league.sport,
          season: league.season,
          teamCount: league.team_count,
          scoringType: league.scoring_type,
          isActive: league.is_active,
          myTeamId: league.my_team_id,
          myTeamName: league.my_team_name,
          currentStanding: league.current_standing,
          settings: league.settings,
          lastSynced: league.last_synced,
          createdAt: league.created_at,
          updatedAt: league.updated_at
        }))
      });
    } else {
      // Get summary of all leagues
      const summary = await dbService.getLeagueSummary();
      
      return NextResponse.json({
        success: true,
        summary: {
          ...summary,
          dataIntegration: {
            gameStatsDatabase: '1.57M records available',
            avatarSystem: 'Integrated with player performance',
            realTimeData: 'Available for enriched league players'
          }
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching leagues:', { error: error });
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch leagues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const dbService = new LeagueDatabaseService();
  
  try {
    const { searchParams } = new URL(req.url);
    const leagueId = searchParams.get('id');
    
    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID required' },
        { status: 400 }
      );
    }
    
    await dbService.deleteLeague(leagueId);
    
    return NextResponse.json({
      success: true,
      message: 'League deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting league:', { error: error });
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete league',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}