import { NextRequest, NextResponse } from 'next/server';
import { LeagueDatabaseService } from '../../../lib/services/league-database-service';
import { logger } from '../../../lib/logging/logger';

export async function GET(req: NextRequest) {
  const dbService = new LeagueDatabaseService();
  
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const sport = searchParams.get('sport');
    
    // Initialize database tables if needed
    await dbService.initializeDatabase();
    
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
        summary
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