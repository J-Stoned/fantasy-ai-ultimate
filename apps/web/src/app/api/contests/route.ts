import { NextRequest, NextResponse } from 'next/server';
import { contestService } from '@/lib/services/contest-service';
import { logger } from '../../../lib/logging/logger';

// GET /api/contests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filters = {
      sport: searchParams.get('sport') || undefined,
      type: searchParams.get('type') || undefined,
      minFee: searchParams.get('minFee') ? parseInt(searchParams.get('minFee')!) : undefined,
      maxFee: searchParams.get('maxFee') ? parseInt(searchParams.get('maxFee')!) : undefined,
      minOverlay: searchParams.get('minOverlay') ? parseFloat(searchParams.get('minOverlay')!) : undefined,
      showRecommended: searchParams.get('recommended') === 'true',
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'overlay',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    };
    
    // Get contests from service
    const { contests, stats } = await contestService.getContests(filters);
    
    return NextResponse.json({
      success: true,
      contests,
      stats,
      filters
    });
    
  } catch (error) {
    logger.error('Error fetching contests:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch contests',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/contests - Create a new contest entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contestId, lineupId, entryCount = 1 } = body;
    
    if (!contestId || !lineupId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: contestId, lineupId' },
        { status: 400 }
      );
    }
    
    // Use contest service to enter contest
    const result = await contestService.enterContest(contestId, lineupId, entryCount);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to enter contest' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      entry: {
        id: result.entryId,
        contestId,
        lineupId,
        entryCount,
        timestamp: new Date(),
        status: 'confirmed'
      },
      message: `Successfully entered ${entryCount} lineup(s) into contest`
    });
    
  } catch (error) {
    logger.error('Error creating contest entry:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create contest entry',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}