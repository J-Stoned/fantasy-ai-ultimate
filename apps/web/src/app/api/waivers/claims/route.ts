import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../../lib/logging/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,  
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/waivers/claims
 * Get user's waiver claims with full details
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get('leagueId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status'); // pending, processed, all

    if (!leagueId || !userId) {
      return NextResponse.json(
        { error: 'League ID and User ID are required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('waiver_claims')
      .select(`
        id,
        player_id,
        player_name,
        position,
        team,
        bid_amount,
        drop_player_id,
        drop_player_name,
        priority,
        status,
        submitted_at,
        process_date,
        processed_at,
        won,
        failure_reason
      `)
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .order('priority', { ascending: true });

    // Filter by status if specified
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: claims, error } = await query;

    if (error) {
      logger.error('Error fetching waiver claims:', { error: error });
      return NextResponse.json(
        { error: 'Failed to fetch waiver claims' },
        { status: 500 }
      );
    }

    // Mock some additional data for demonstration
    const enhancedClaims = claims?.map(claim => ({
      id: claim.id,
      playerId: claim.player_id,
      playerName: claim.player_name,
      position: claim.position,
      team: claim.team,
      bidAmount: claim.bid_amount,
      dropPlayerId: claim.drop_player_id,
      dropPlayerName: claim.drop_player_name,
      priority: claim.priority,
      status: claim.status,
      submittedAt: claim.submitted_at,
      processDate: claim.process_date,
      processedAt: claim.processed_at,
      won: claim.won,
      failureReason: claim.failure_reason,
      
      // Mock additional data
      successProbability: calculateSuccessProbability(claim.bid_amount),
      competitorBids: generateMockCompetitorBids(claim.bid_amount),
      optimalBid: calculateOptimalBid(claim.bid_amount)
    })) || [];

    return NextResponse.json(enhancedClaims);

  } catch (error) {
    logger.error('Error fetching waiver claims:', { error: error });
    return NextResponse.json(
      { error: 'Failed to fetch waiver claims' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/waivers/claims
 * Update waiver claim priority or bid amount
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimId, userId, bidAmount, priority } = body;

    if (!claimId || !userId) {
      return NextResponse.json(
        { error: 'Claim ID and User ID are required' },
        { status: 400 }
      );
    }

    // Verify ownership and that claim is still pending
    const { data: existingClaim, error: fetchError } = await supabase
      .from('waiver_claims')
      .select('id, status, league_id')
      .eq('id', claimId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !existingClaim) {
      return NextResponse.json(
        { error: 'Claim not found or not eligible for updates' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (bidAmount !== undefined) {
      if (bidAmount <= 0 || bidAmount > 1000) {
        return NextResponse.json(
          { error: 'Bid amount must be between $1 and $1000' },
          { status: 400 }
        );
      }

      // Check budget if increasing bid
      const { data: userBudget } = await supabase
        .from('league_members')
        .select('faab_budget, faab_spent')
        .eq('league_id', existingClaim.league_id)
        .eq('user_id', userId)
        .single();

      const availableBudget = (userBudget?.faab_budget || 100) - (userBudget?.faab_spent || 0);
      
      if (bidAmount > availableBudget) {
        return NextResponse.json(
          { error: `Insufficient budget. Available: $${availableBudget}` },
          { status: 400 }
        );
      }

      updateData.bid_amount = bidAmount;
    }

    if (priority !== undefined) {
      if (priority < 1 || priority > 20) {
        return NextResponse.json(
          { error: 'Priority must be between 1 and 20' },
          { status: 400 }
        );
      }
      updateData.priority = priority;
    }

    // Update the claim
    const { data: updatedClaim, error: updateError } = await supabase
      .from('waiver_claims')
      .update(updateData)
      .eq('id', claimId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating waiver claim:', { error: updateError });
      return NextResponse.json(
        { error: 'Failed to update waiver claim' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: updatedClaim.id,
      playerId: updatedClaim.player_id,
      playerName: updatedClaim.player_name,
      bidAmount: updatedClaim.bid_amount,
      priority: updatedClaim.priority,
      status: updatedClaim.status,
      message: 'Waiver claim updated successfully'
    });

  } catch (error) {
    logger.error('Error updating waiver claim:', { error: error });
    return NextResponse.json(
      { error: 'Failed to update waiver claim' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/waivers/claims/reorder
 * Reorder multiple waiver claims
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claims, userId, leagueId } = body;

    if (!claims || !Array.isArray(claims) || !userId || !leagueId) {
      return NextResponse.json(
        { error: 'Claims array, User ID, and League ID are required' },
        { status: 400 }
      );
    }

    // Verify all claims belong to the user and are pending
    const claimIds = claims.map(c => c.id);
    const { data: existingClaims, error: fetchError } = await supabase
      .from('waiver_claims')
      .select('id, status')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('status', 'pending')
      .in('id', claimIds);

    if (fetchError) {
      logger.error('Error fetching claims for reorder:', { error: fetchError });
      return NextResponse.json(
        { error: 'Failed to verify claims' },
        { status: 500 }
      );
    }

    if (existingClaims?.length !== claims.length) {
      return NextResponse.json(
        { error: 'Some claims are not eligible for reordering' },
        { status: 400 }
      );
    }

    // Update priorities in batch
    const updates = claims.map((claim, index) => ({
      id: claim.id,
      priority: index + 1
    }));

    const { error: updateError } = await supabase
      .from('waiver_claims')
      .upsert(updates.map(update => ({
        id: update.id,
        priority: update.priority
      })));

    if (updateError) {
      logger.error('Error reordering claims:', { error: updateError });
      return NextResponse.json(
        { error: 'Failed to reorder claims' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Claims reordered successfully',
      updatedCount: updates.length
    });

  } catch (error) {
    logger.error('Error reordering waiver claims:', { error: error });
    return NextResponse.json(
      { error: 'Failed to reorder waiver claims' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to calculate mock success probability
 */
function calculateSuccessProbability(bidAmount: number): number {
  // Simple formula: higher bids = higher success rate
  if (bidAmount >= 30) return 0.9;
  if (bidAmount >= 20) return 0.75;
  if (bidAmount >= 15) return 0.6;
  if (bidAmount >= 10) return 0.45;
  if (bidAmount >= 5) return 0.3;
  return 0.15;
}

/**
 * Helper function to generate mock competitor bids
 */
function generateMockCompetitorBids(userBid: number): number[] {
  const numCompetitors = Math.floor(Math.random() * 3) + 1;
  const bids = [];
  
  for (let i = 0; i < numCompetitors; i++) {
    // Generate bids around the user's bid with some variance
    const variance = Math.random() * 10 - 5; // -5 to +5
    const competitorBid = Math.max(1, Math.round(userBid + variance));
    bids.push(competitorBid);
  }
  
  return bids.sort((a, b) => b - a);
}

/**
 * Helper function to calculate optimal bid
 */
function calculateOptimalBid(currentBid: number): number {
  // Simple optimization: suggest 10-20% higher if low, or warn if too high
  if (currentBid < 10) return currentBid + 3;
  if (currentBid < 20) return currentBid + 2;
  if (currentBid > 40) return Math.max(25, currentBid - 5);
  return currentBid;
}