import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../../lib/logging/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/waivers/submit
 * Submit a new waiver claim
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      playerId, 
      playerName,
      position,
      team,
      bidAmount, 
      dropPlayerId, 
      dropPlayerName,
      priority, 
      leagueId, 
      userId 
    } = body;

    // Validate required fields
    if (!playerId || !bidAmount || !leagueId || !userId) {
      return NextResponse.json(
        { error: 'Player ID, bid amount, league ID, and user ID are required' },
        { status: 400 }
      );
    }

    if (bidAmount <= 0 || bidAmount > 1000) {
      return NextResponse.json(
        { error: 'Bid amount must be between $1 and $1000' },
        { status: 400 }
      );
    }

    // Check if user has enough budget
    const { data: userBudget, error: budgetError } = await supabase
      .from('league_members')
      .select('faab_budget, faab_spent')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (budgetError) {
      logger.error('Budget check error:', { error: budgetError });
      return NextResponse.json(
        { error: 'Failed to verify budget' },
        { status: 500 }
      );
    }

    const availableBudget = (userBudget?.faab_budget || 100) - (userBudget?.faab_spent || 0);
    
    if (bidAmount > availableBudget) {
      return NextResponse.json(
        { error: `Insufficient budget. Available: $${availableBudget}` },
        { status: 400 }
      );
    }

    // Check if player is available
    const { data: existingRoster, error: rosterError } = await supabase
      .from('league_rosters')
      .select('id')
      .eq('league_id', leagueId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (rosterError) {
      logger.error('Roster check error:', { error: rosterError });
    }

    if (existingRoster) {
      return NextResponse.json(
        { error: 'Player is already rostered in this league' },
        { status: 400 }
      );
    }

    // Check for existing claim on this player
    const { data: existingClaim, error: claimError } = await supabase
      .from('waiver_claims')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .eq('player_id', playerId)
      .eq('status', 'pending')
      .maybeSingle();

    if (claimError) {
      logger.error('Existing claim check error:', { error: claimError });
    }

    if (existingClaim) {
      return NextResponse.json(
        { error: 'You already have a pending claim for this player' },
        { status: 400 }
      );
    }

    // If dropping a player, validate ownership
    if (dropPlayerId) {
      const { data: ownedPlayer, error: ownedError } = await supabase
        .from('league_rosters')
        .select('id')
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .eq('player_id', dropPlayerId)
        .maybeSingle();

      if (ownedError) {
        logger.error('Owned player check error:', { error: ownedError });
      }

      if (!ownedPlayer) {
        return NextResponse.json(
          { error: 'You do not own the player you are trying to drop' },
          { status: 400 }
        );
      }
    }

    // Create the waiver claim
    const claimData = {
      league_id: leagueId,
      user_id: userId,
      player_id: playerId,
      player_name: playerName,
      position,
      team,
      bid_amount: bidAmount,
      drop_player_id: dropPlayerId,
      drop_player_name: dropPlayerName,
      priority: priority || 1,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      process_date: getNextWaiverProcessDate()
    };

    const { data: newClaim, error: insertError } = await supabase
      .from('waiver_claims')
      .insert(claimData)
      .select()
      .single();

    if (insertError) {
      logger.error('Failed to create waiver claim:', { error: insertError });
      return NextResponse.json(
        { error: 'Failed to submit waiver claim' },
        { status: 500 }
      );
    }

    // Log the waiver activity
    await supabase
      .from('league_activity')
      .insert({
        league_id: leagueId,
        user_id: userId,
        action: 'waiver_claim_submitted',
        description: `Submitted $${bidAmount} waiver claim for ${playerName}${dropPlayerName ? ` (dropping ${dropPlayerName})` : ''}`,
        metadata: {
          playerId,
          playerName,
          bidAmount,
          dropPlayerId,
          dropPlayerName,
          claimId: newClaim.id
        }
      });

    return NextResponse.json({
      id: newClaim.id,
      playerId: newClaim.player_id,
      playerName: newClaim.player_name,
      position: newClaim.position,
      team: newClaim.team,
      bidAmount: newClaim.bid_amount,
      dropPlayerId: newClaim.drop_player_id,
      dropPlayerName: newClaim.drop_player_name,
      priority: newClaim.priority,
      status: newClaim.status,
      submittedAt: newClaim.submitted_at,
      processDate: newClaim.process_date
    }, { status: 201 });

  } catch (error) {
    logger.error('Error submitting waiver claim:', { error: error });
    return NextResponse.json(
      { error: 'Failed to submit waiver claim' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/waivers/submit
 * Get user's pending waiver claims
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get('leagueId');
    const userId = searchParams.get('userId');

    if (!leagueId || !userId) {
      return NextResponse.json(
        { error: 'League ID and User ID are required' },
        { status: 400 }
      );
    }

    const { data: claims, error } = await supabase
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
        won
      `)
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .order('priority', { ascending: true });

    if (error) {
      logger.error('Error fetching waiver claims:', { error: error });
      return NextResponse.json(
        { error: 'Failed to fetch waiver claims' },
        { status: 500 }
      );
    }

    // Transform to expected format
    const formattedClaims = claims?.map(claim => ({
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
      won: claim.won
    })) || [];

    return NextResponse.json(formattedClaims);

  } catch (error) {
    logger.error('Error fetching waiver claims:', { error: error });
    return NextResponse.json(
      { error: 'Failed to fetch waiver claims' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/waivers/submit
 * Cancel a pending waiver claim
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const claimId = searchParams.get('claimId');
    const userId = searchParams.get('userId');

    if (!claimId || !userId) {
      return NextResponse.json(
        { error: 'Claim ID and User ID are required' },
        { status: 400 }
      );
    }

    // Verify ownership and that claim is still pending
    const { data: claim, error: fetchError } = await supabase
      .from('waiver_claims')
      .select('id, status, player_name')
      .eq('id', claimId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !claim) {
      return NextResponse.json(
        { error: 'Claim not found or not eligible for cancellation' },
        { status: 404 }
      );
    }

    // Delete the claim
    const { error: deleteError } = await supabase
      .from('waiver_claims')
      .delete()
      .eq('id', claimId);

    if (deleteError) {
      logger.error('Error canceling waiver claim:', { error: deleteError });
      return NextResponse.json(
        { error: 'Failed to cancel waiver claim' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Waiver claim for ${claim.player_name} has been canceled`,
      claimId
    });

  } catch (error) {
    logger.error('Error canceling waiver claim:', { error: error });
    return NextResponse.json(
      { error: 'Failed to cancel waiver claim' },
      { status: 500 }
    );
  }
}

/**
 * Calculate next waiver process date (typically Wednesday)
 */
function getNextWaiverProcessDate(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 3 = Wednesday
  
  let daysUntilWednesday = 3 - dayOfWeek;
  if (daysUntilWednesday <= 0) {
    daysUntilWednesday += 7; // Next Wednesday
  }
  
  const processDate = new Date(now);
  processDate.setDate(now.getDate() + daysUntilWednesday);
  processDate.setHours(3, 0, 0, 0); // 3 AM Wednesday
  
  return processDate.toISOString();
}