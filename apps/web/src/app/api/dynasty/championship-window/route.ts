import { NextRequest, NextResponse } from 'next/server';
import { WindowCalculator } from '../../../../lib/services/traditional-fantasy/keeper-management/window-calculator';
import { DynastyAnalyzer } from '../../../../lib/services/traditional-fantasy/keeper-management/dynasty-analyzer';
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

    // Get league data
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

    // Create analyzers
    const windowCalculator = new WindowCalculator(leagueContext as any);
    const dynastyAnalyzer = new DynastyAnalyzer(leagueContext as any);

    // Mock team metrics for now
    const teamMetrics = {
      currentRosterValue: 70,
      futureRosterValue: [75, 78, 80, 77, 75],
      competitiveBalance: 0.65,
      strengthOfSchedule: 0.5,
      divisionStrength: 0.6,
      projectedFinish: 4,
      playoffProbability: 0.7,
      championshipProbability: 0.15,
      draftCapital: { currentYear: 3, futureYears: 6 }
    };

    // Calculate championship window
    const window = await windowCalculator.calculateWindow(
      players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team,
        age: 26, // Would need real age data
        injuryHistory: [],
        contractDetails: null,
        performanceHistory: [],
        projectedStats: {},
        adp: 50,
        auctionValue: 20,
        keeperCost: 15,
        yearsInLeague: 2,
        tradeValue: 50
      })) as any,
      teamMetrics
    );

    // Analyze dynasty position
    const dynastyAnalysis = await dynastyAnalyzer.analyzeDynastyPosition(
      players as any,
      [], // Draft picks
      teamMetrics
    );

    // Generate mock championship probability data
    const currentYear = new Date().getFullYear();
    const championshipProbabilities = window.championshipProbability.map((prob, index) => ({
      year: currentYear + index,
      probability: prob,
      projectedValue: teamMetrics.futureRosterValue[index] || teamMetrics.currentRosterValue
    }));

    // Position strength analysis
    const positionStrength = {
      QB: players.filter(p => p.position === 'QB').length > 0 ? 75 : 40,
      RB: players.filter(p => p.position === 'RB').length * 25,
      WR: players.filter(p => p.position === 'WR').length * 20,
      TE: players.filter(p => p.position === 'TE').length > 0 ? 60 : 30,
      overall: teamMetrics.currentRosterValue
    };

    return NextResponse.json({
      success: true,
      window: {
        status: window.status,
        peakYear: window.peakYear,
        windowDuration: window.windowDuration,
        currentYear: 0,
        recommendedStrategy: dynastyAnalysis.strategy
      },
      championshipProbabilities,
      positionStrength,
      recommendations: dynastyAnalysis.recommendations,
      meta: {
        leagueId,
        platform: league.platform,
        sport: league.sport,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Error calculating championship window:', { error: error });
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to calculate championship window',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}