import { NextRequest, NextResponse } from 'next/server';
import { DraftEngine } from '@/lib/services/traditional-fantasy/draft-analysis/draft-engine';
import { logger } from '../../../../lib/logging/logger';

// In-memory draft storage (in production, use Redis or database)
const activeDrafts = new Map<string, DraftEngine>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, playerId } = body;

    if (!draftId || !playerId) {
      return NextResponse.json(
        { error: 'Draft ID and Player ID are required' },
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

    // Make the pick
    const success = engine.makePick(playerId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to make pick. Player may be unavailable.' },
        { status: 400 }
      );
    }

    // Get updated draft state
    const draftState = engine.getDraftState();

    // Convert Maps to objects for JSON serialization
    const teamsObject: Record<string, any> = {};
    draftState.teams.forEach((team, teamId) => {
      teamsObject[teamId] = {
        ...team,
        needs: team.needs || []
      };
    });

    const availablePlayersArray = Array.from(draftState.availablePlayers);

    // Simulate AI picks if it's not the user's turn
    if (draftState.draftOrder[draftState.currentPick % draftState.teamCount] !== draftState.myTeamId) {
      // Simple AI: pick best available based on recommendations
      setTimeout(async () => {
        const recommendations = engine.getRecommendations(1);
        if (recommendations.length > 0) {
          engine.makePick(recommendations[0].playerId);
        }
      }, Math.random() * 2000 + 1000); // 1-3 second delay
    }

    return NextResponse.json({
      draftState: {
        ...draftState,
        draftId,
        teams: teamsObject,
        availablePlayers: availablePlayersArray
      },
      message: 'Pick made successfully!'
    });
  } catch (error) {
    logger.error('Error making pick:', { error: error });
    return NextResponse.json(
      { error: 'Failed to make pick' },
      { status: 500 }
    );
  }
}