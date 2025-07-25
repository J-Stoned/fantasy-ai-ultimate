import { NextRequest, NextResponse } from 'next/server';
import { waiverRecommendationEngine } from '../../../../lib/services/waiver/waiver-recommendation-engine';
import { logger } from '../../../../lib/logging/logger';

/**
 * GET /api/waivers/available
 * Get available players for waiver wire
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const leagueId = searchParams.get('leagueId');
    const positions = searchParams.get('positions')?.split(',') || ['QB', 'RB', 'WR', 'TE'];
    const minOwnership = parseFloat(searchParams.get('minOwnership') || '0');
    const maxOwnership = parseFloat(searchParams.get('maxOwnership') || '100');
    const sortBy = searchParams.get('sortBy') || 'trendScore';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Get available players with mock data for now
    const availablePlayers = [
      {
        id: '1',
        name: 'Tyler Allgeier',
        position: 'RB',
        team: 'ATL',
        ownership: 45.2,
        trendScore: 85,
        projectedPoints: 12.5,
        recentPerformance: [8.2, 15.6, 4.1, 12.8],
        injuryStatus: 'Healthy',
        news: 'Seeing increased carries with Bijan Robinson nursing minor injury',
        faabValue: 15,
        breakoutProbability: 65,
        scheduleStrength: 72,
        ros_rank: 35,
        opportunityScore: 78,
        talentScore: 65,
        situationScore: 82,
        targetShare: 8.5,
        snapShare: 42.1,
        redZoneTargets: 0,
        momementumScore: 78
      },
      {
        id: '2',
        name: 'Jahan Dotson',
        position: 'WR',
        team: 'PHI',
        ownership: 38.7,
        trendScore: 73,
        projectedPoints: 10.8,
        recentPerformance: [3.2, 8.9, 14.5, 6.7],
        injuryStatus: 'Healthy',
        news: 'Increased target share after trade to Eagles',
        faabValue: 12,
        breakoutProbability: 58,
        scheduleStrength: 68,
        ros_rank: 42,
        opportunityScore: 68,
        talentScore: 75,
        situationScore: 70,
        targetShare: 12.3,
        snapShare: 65.8,
        redZoneTargets: 2,
        momementumScore: 72
      },
      {
        id: '3',
        name: 'Jordan Mason',
        position: 'RB',
        team: 'SF',
        ownership: 15.9,
        trendScore: 92,
        projectedPoints: 8.2,
        recentPerformance: [1.4, 0.8, 18.7, 12.3],
        injuryStatus: 'Healthy',
        news: 'Primary backup with Christian McCaffrey dealing with minor injury',
        faabValue: 25,
        breakoutProbability: 78,
        scheduleStrength: 75,
        ros_rank: 48,
        opportunityScore: 85,
        talentScore: 68,
        situationScore: 88,
        targetShare: 4.2,
        snapShare: 28.5,
        redZoneTargets: 0,
        momementumScore: 85
      },
      {
        id: '4',
        name: 'Darnell Mooney',
        position: 'WR',
        team: 'ATL',
        ownership: 62.1,
        trendScore: 68,
        projectedPoints: 11.4,
        recentPerformance: [7.8, 13.2, 9.1, 15.6],
        injuryStatus: 'Healthy',
        news: 'Consistent target share in high-powered offense',
        faabValue: 8,
        breakoutProbability: 45,
        scheduleStrength: 71,
        ros_rank: 38,
        opportunityScore: 72,
        talentScore: 78,
        situationScore: 75,
        targetShare: 18.7,
        snapShare: 78.2,
        redZoneTargets: 3,
        momementumScore: 65
      },
      {
        id: '5',
        name: 'Trey Palmer',
        position: 'WR',
        team: 'TB',
        ownership: 8.3,
        trendScore: 81,
        projectedPoints: 7.9,
        recentPerformance: [2.1, 4.8, 11.7, 9.2],
        injuryStatus: 'Healthy',
        news: 'Emerging as reliable deep threat for Bucs',
        faabValue: 18,
        breakoutProbability: 72,
        scheduleStrength: 69,
        ros_rank: 55,
        opportunityScore: 75,
        talentScore: 82,
        situationScore: 78,
        targetShare: 14.2,
        snapShare: 58.9,
        redZoneTargets: 1,
        momementumScore: 79
      },
      {
        id: '6',
        name: 'Isaiah Likely',
        position: 'TE',
        team: 'BAL',
        ownership: 41.5,
        trendScore: 76,
        projectedPoints: 9.3,
        recentPerformance: [5.4, 12.1, 8.7, 6.9],
        injuryStatus: 'Healthy',
        news: 'Solid TE2 with upside if Mark Andrews misses time',
        faabValue: 10,
        breakoutProbability: 55,
        scheduleStrength: 73,
        ros_rank: 18,
        opportunityScore: 65,
        talentScore: 72,
        situationScore: 68,
        targetShare: 8.9,
        snapShare: 52.3,
        redZoneTargets: 2,
        momementumScore: 68
      }
    ];

    // Filter by parameters
    let filteredPlayers = availablePlayers.filter(player => {
      return positions.includes(player.position) &&
             player.ownership >= minOwnership &&
             player.ownership <= maxOwnership;
    });

    // Sort by specified criteria
    filteredPlayers.sort((a, b) => {
      switch (sortBy) {
        case 'projectedPoints':
          return b.projectedPoints - a.projectedPoints;
        case 'ownership':
          return a.ownership - b.ownership;
        case 'faabValue':
          return b.faabValue - a.faabValue;
        case 'breakoutProbability':
          return b.breakoutProbability - a.breakoutProbability;
        default: // trendScore
          return b.trendScore - a.trendScore;
      }
    });

    // Limit results
    filteredPlayers = filteredPlayers.slice(0, limit);

    return NextResponse.json(filteredPlayers, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });

  } catch (error) {
    logger.error('Error fetching available players:', { error: error });
    return NextResponse.json(
      { error: 'Failed to fetch available players' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/waivers/available
 * Get personalized available players recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leagueId, userId, positions, maxRecommendations, budget, strategy } = body;

    if (!leagueId || !userId) {
      return NextResponse.json(
        { error: 'League ID and User ID are required' },
        { status: 400 }
      );
    }

    // Get personalized recommendations
    const recommendations = await waiverRecommendationEngine.getWaiverRecommendations(
      leagueId,
      userId,
      {
        positions,
        maxRecommendations,
        budget,
        strategy
      }
    );

    return NextResponse.json(recommendations, {
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360'
      }
    });

  } catch (error) {
    logger.error('Error getting waiver recommendations:', { error: error });
    return NextResponse.json(
      { error: 'Failed to get waiver recommendations' },
      { status: 500 }
    );
  }
}