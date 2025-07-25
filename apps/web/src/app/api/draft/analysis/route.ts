import { NextRequest, NextResponse } from 'next/server';
import { DraftEngine } from '@/lib/services/traditional-fantasy/draft-analysis/draft-engine';
import { logger } from '../../../../lib/logging/logger';

// In-memory draft storage (in production, use Redis or database)
const activeDrafts = new Map<string, DraftEngine>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, teamId } = body;

    if (!draftId || !teamId) {
      return NextResponse.json(
        { error: 'Draft ID and Team ID are required' },
        { status: 400 }
      );
    }

    // Get draft engine
    const engine = activeDrafts.get(draftId);
    
    if (!engine) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Get team analysis
    const analysis = engine.getTeamAnalysis(teamId);
    
    if (!analysis) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Get additional insights
    const draftState = engine.getDraftState();
    const performance = engine.getPerformanceMetrics();
    
    // Calculate some additional metrics
    const totalPicks = draftState.picks.length;
    const myPicks = draftState.picks.filter(p => p.teamId === teamId).length;
    const pickEfficiency = myPicks > 0 ? 
      draftState.picks
        .filter(p => p.teamId === teamId)
        .reduce((sum, p) => sum + p.valueScore, 0) / myPicks : 0;

    return NextResponse.json({
      analysis,
      insights: {
        totalPicks,
        myPicks,
        pickEfficiency,
        recommendationAccuracy: performance.recommendationAccuracy,
        avgResponseTime: performance.avgResponseTime
      }
    });
  } catch (error) {
    logger.error('Error getting analysis:', { error: error });
    return NextResponse.json(
      { error: 'Failed to get analysis' },
      { status: 500 }
    );
  }
}