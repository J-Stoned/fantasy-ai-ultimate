import { NextRequest, NextResponse } from 'next/server';
import { DynastyAnalyzer } from '../../../../lib/services/traditional-fantasy/keeper-management/dynasty-analyzer';
import { ValueProjector } from '../../../../lib/services/traditional-fantasy/keeper-management/value-projector';
import { LeagueDatabaseService } from '../../../../lib/services/league-database-service';
import { logger } from '../../../../lib/logging/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leagueId = searchParams.get('leagueId');
    
    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID required' },
        { status: 400 }
      );
    }

    const dbService = new LeagueDatabaseService();
    const league = await dbService.getLeague(leagueId);
    const players = await dbService.getLeaguePlayers(leagueId);
    
    if (!league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      );
    }

    const leagueContext = {
      leagueId,
      settings: league.settings || {},
      scoringSystem: league.scoring_type,
      platform: league.platform,
      sport: league.sport
    };

    const dynastyAnalyzer = new DynastyAnalyzer(leagueContext as any);
    const valueProjector = new ValueProjector(leagueContext as any);

    // Create player assets with mock data
    const playerAssets = await Promise.all(
      players.map(async (player) => {
        // Mock age based on position
        const age = player.position === 'RB' ? 24 : 
                   player.position === 'WR' ? 25 : 
                   player.position === 'QB' ? 28 : 26;

        // Mock current value based on projected points
        const currentValue = player.projected_points 
          ? Math.min(100, (player.projected_points / 300) * 100)
          : 50;

        // Project future values
        const futureValues = [
          currentValue,
          currentValue * (age < 27 ? 1.1 : 0.95),
          currentValue * (age < 27 ? 1.15 : 0.85),
          currentValue * (age < 27 ? 1.1 : 0.75),
          currentValue * (age < 27 ? 1.0 : 0.65)
        ];

        return {
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          age,
          currentValue,
          futureValue: futureValues,
          category: currentValue > 80 ? 'elite' :
                    currentValue > 60 ? 'core' :
                    age < 25 && currentValue > 40 ? 'developing' :
                    age > 28 ? 'aging' : 'roster',
          injuryStatus: player.injury_status,
          imageUrl: player.image_url
        };
      })
    );

    // Mock draft picks
    const draftPicks = [
      {
        id: 'pick_2024_1_1',
        round: 1,
        year: 2024,
        currentValue: 85,
        expectedPosition: 'RB/WR',
        category: 'draft'
      },
      {
        id: 'pick_2024_2_1',
        round: 2,
        year: 2024,
        currentValue: 60,
        expectedPosition: 'WR/TE',
        category: 'draft'
      },
      {
        id: 'pick_2025_1_1',
        round: 1,
        year: 2025,
        currentValue: 75,
        expectedPosition: 'BPA',
        category: 'draft'
      }
    ];

    // Calculate totals
    const totalPlayerValue = playerAssets.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPickValue = draftPicks.reduce((sum, p) => sum + p.currentValue, 0);
    const totalValue = totalPlayerValue + totalPickValue;

    // Category breakdown
    const categoryBreakdown = {
      elite: playerAssets.filter(p => p.category === 'elite').length,
      core: playerAssets.filter(p => p.category === 'core').length,
      developing: playerAssets.filter(p => p.category === 'developing').length,
      aging: playerAssets.filter(p => p.category === 'aging').length,
      roster: playerAssets.filter(p => p.category === 'roster').length,
      draft: draftPicks.length
    };

    return NextResponse.json({
      success: true,
      assets: {
        players: playerAssets,
        picks: draftPicks
      },
      summary: {
        totalValue,
        playerValue: totalPlayerValue,
        pickValue: totalPickValue,
        assetCount: playerAssets.length + draftPicks.length,
        categoryBreakdown
      },
      meta: {
        leagueId,
        platform: league.platform,
        sport: league.sport,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Error fetching dynasty assets:', { error: error });
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch dynasty assets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}