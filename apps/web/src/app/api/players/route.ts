import { NextRequest, NextResponse } from 'next/server'
import { playerDataService } from '@/lib/database/player-data-service';
import { logger } from '../../../lib/logging/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sport = searchParams.get('sport')?.toUpperCase() || 'NFL'
    const positions = searchParams.get('position') && searchParams.get('position') !== 'ALL' 
      ? [searchParams.get('position')!] 
      : undefined
    const team = searchParams.get('team') || undefined
    const search = searchParams.get('search') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const includeStats = searchParams.get('includeStats') !== 'false'
    const includeRecent = searchParams.get('includeRecent') === 'true'
    
    logger.info('Players API request', { 
      sport, 
      positions, 
      team, 
      search, 
      limit, 
      includeStats, 
      includeRecent 
    });
    
    // Use our enhanced player data service
    const { data: players, error } = await playerDataService.getPlayers({
      sport,
      positions,
      teams: team ? [team] : undefined,
      search_term: search,
      limit,
      include_stats: includeStats,
      include_recent_games: includeRecent
    });
    
    if (error) {
      logger.error('Error fetching players from service:', error);
      return NextResponse.json(
        { error: 'Failed to fetch players', details: error },
        { status: 500 }
      );
    }
    
    if (!players || players.length === 0) {
      return NextResponse.json({ 
        players: [],
        message: 'No players found for the specified criteria',
        criteria: { sport, positions, team, search }
      });
    }
    
    // Transform to DFS-ready format
    const dfsPlayers = players.map(player => {
      // Generate realistic salary based on performance
      const avgPoints = player.season_stats?.avg_fantasy_points || 10;
      const rating = player.overall_rating || 75;
      const baseSalary = generateSalaryByPosition(player.position, avgPoints, rating);
      
      // Calculate ownership projection (higher for better players)
      const ownershipBase = Math.min(40, Math.max(5, (rating - 60) * 0.8));
      const ownershipVariation = (Math.random() - 0.5) * 10;
      const ownership = Math.max(5, Math.min(40, ownershipBase + ownershipVariation));
      
      return {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team_abbreviation || player.team || 'FA',
        sport: player.sport,
        
        // Performance data
        salary: baseSalary,
        projectedPoints: Number((player.season_stats?.avg_fantasy_points || avgPoints).toFixed(1)),
        ownership: Number(ownership.toFixed(1)),
        value: Number((avgPoints / (baseSalary / 1000)).toFixed(2)),
        
        // Enhanced data
        overallRating: player.overall_rating || null,
        avatarTier: player.avatar_tier || 'practice',
        trending: player.trending || 'stable',
        consistency: player.season_stats?.consistency_score || null,
        
        // DFS platform projections
        dkPoints: player.season_stats?.avg_dk_points || null,
        fdPoints: player.season_stats?.avg_fd_points || null,
        yahooPoints: player.season_stats?.avg_yahoo_points || null,
        
        // Recent performance
        recentGames: includeRecent ? player.recent_games?.slice(0, 3).map(game => ({
          date: game.game_date,
          opponent: game.opponent,
          points: game.fantasy_points || 0,
          week: game.week
        })) : undefined,
        
        // Player metadata
        image: player.image_url || player.avatar_2d_url || null,
        age: player.age || null,
        college: player.college || null,
        draftYear: player.draft_year || null,
        jerseyNumber: player.jersey_number || null,
        
        // Season stats summary
        seasonStats: includeStats ? {
          gamesPlayed: player.season_stats?.games_played || 0,
          totalPoints: player.season_stats?.total_fantasy_points || 0,
          bestGame: player.season_stats?.best_game_points || 0,
          avgDKPoints: player.season_stats?.avg_dk_points || 0,
          avgFDPoints: player.season_stats?.avg_fd_points || 0,
          avgYahooPoints: player.season_stats?.avg_yahoo_points || 0
        } : undefined
      };
    });
    
    // Sort by projected points descending
    dfsPlayers.sort((a, b) => b.projectedPoints - a.projectedPoints);
    
    logger.info('Players API response', {
      sport,
      totalPlayers: dfsPlayers.length,
      avgProjection: dfsPlayers.reduce((sum, p) => sum + p.projectedPoints, 0) / dfsPlayers.length,
      topPlayer: dfsPlayers[0]?.name,
      topProjection: dfsPlayers[0]?.projectedPoints
    });
    
    return NextResponse.json({ 
      players: dfsPlayers,
      metadata: {
        totalPlayers: dfsPlayers.length,
        avgProjection: Number((dfsPlayers.reduce((sum, p) => sum + p.projectedPoints, 0) / dfsPlayers.length).toFixed(1)),
        sport,
        includeStats,
        includeRecent,
        dataSource: '1.57M game stats dataset'
      }
    });
    
  } catch (error) {
    logger.error('Error in players API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch players',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateSalaryByPosition(position: string, avgPoints: number = 10, rating: number = 75): number {
  // Base salary ranges by position (DraftKings style)
  const baseSalaryRanges: Record<string, [number, number]> = {
    // NFL
    QB: [5500, 8500],
    RB: [4000, 9500],
    WR: [3500, 9000],
    TE: [3000, 7500],
    DST: [2200, 3000],
    K: [4600, 5200],
    
    // NBA  
    PG: [4500, 11000],
    SG: [4000, 10500],
    SF: [4500, 10000],
    PF: [4000, 9500],
    C: [4000, 9000],
    
    // MLB
    P: [5000, 11500],
    C: [3500, 5500],
    '1B': [3000, 5000],
    '2B': [3000, 4500],
    '3B': [3000, 5000],
    SS: [3000, 5500],
    OF: [3000, 5500],
    
    // NHL
    C: [4500, 8500],
    LW: [3500, 8000],
    RW: [3500, 8000],
    D: [3000, 7500],
    G: [7000, 8500]
  }
  
  const range = baseSalaryRanges[position] || [3000, 6000];
  
  // Performance-based salary calculation
  const performanceMultiplier = Math.max(0.7, Math.min(1.5, avgPoints / 15)); // Scale based on avg points
  const ratingMultiplier = Math.max(0.8, Math.min(1.3, rating / 80)); // Scale based on overall rating
  
  const baseSalary = range[0] + (range[1] - range[0]) * 0.5; // Mid-range base
  const adjustedSalary = baseSalary * performanceMultiplier * ratingMultiplier;
  
  // Add some randomization (+/- 10%)
  const randomization = 0.9 + (Math.random() * 0.2);
  const finalSalary = Math.round(adjustedSalary * randomization / 100) * 100; // Round to nearest 100
  
  // Ensure it stays within range
  return Math.max(range[0], Math.min(range[1], finalSalary));
}