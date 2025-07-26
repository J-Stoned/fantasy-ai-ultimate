/**
 * 🔥 UNIVERSAL PLAYER DATA SERVICE
 * Elite developer player data management for Fantasy AI Ultimate
 * 
 * Handles player profiles, avatar integration, performance ratings
 * Connects 24,568 NFL players with 1,575,773 game stats
 * Maps performance data to avatar tiers and overall ratings
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { gameStatsService, GameStatsRecord } from './game-stats-service';

export interface PlayerProfile {
  id: number;
  name: string;
  firstname?: string;
  lastname?: string;
  position: string;
  team?: string;
  team_abbreviation?: string;
  jersey_number?: string;
  
  // Physical attributes
  height_inches?: number;
  weight_lbs?: number;
  birthdate?: string;
  age?: number;
  bmi?: number;
  
  // Career info
  college?: string;
  draft_year?: number;
  draft_round?: number;
  years_pro?: number;
  status?: string;
  
  // Sport classification
  sport: string;
  sport_id?: string;
  
  // Avatar system
  avatar_tier?: 'star' | 'starter' | 'bench' | 'practice';
  avatar_2d_url?: string;
  avatar_3d_url?: string;
  avatar_photo_url?: string;
  image_url?: string;
  overall_rating?: number;
  avatar_metadata?: any;
  
  // Performance metrics (calculated from game stats)
  season_stats?: {
    games_played?: number;
    avg_fantasy_points?: number;
    avg_dk_points?: number;
    avg_fd_points?: number;
    avg_yahoo_points?: number;
    total_fantasy_points?: number;
    best_game_points?: number;
    consistency_score?: number;
  };
  
  // Recent performance
  recent_games?: GameStatsRecord[];
  trending?: 'up' | 'down' | 'stable';
  
  // Metadata
  created_at?: string;
  updated_at?: string;
}

export interface PlayerSearchQuery {
  sport?: string;
  positions?: string[];
  teams?: string[];
  search_term?: string;
  avatar_tiers?: string[];
  min_rating?: number;
  max_rating?: number;
  status?: string;
  include_stats?: boolean;
  include_recent_games?: boolean;
  limit?: number;
  offset?: number;
}

class PlayerDataService {
  private supabaseClient: any = null;

  private async getSupabase() {
    if (!this.supabaseClient) {
      this.supabaseClient = await createClient();
    }
    return this.supabaseClient;
  }

  /**
   * Calculate avatar tier based on performance metrics
   */
  private calculateAvatarTier(
    overallRating?: number, 
    avgFantasyPoints?: number, 
    position?: string
  ): 'star' | 'starter' | 'bench' | 'practice' {
    // Use overall rating as primary factor
    if (overallRating) {
      if (overallRating >= 90) return 'star';
      if (overallRating >= 80) return 'starter';
      if (overallRating >= 70) return 'bench';
      return 'practice';
    }

    // Fallback to fantasy points by position
    if (avgFantasyPoints && position) {
      const positionThresholds = {
        'QB': { star: 25, starter: 18, bench: 12 },
        'RB': { star: 20, starter: 15, bench: 10 },
        'WR': { star: 18, starter: 13, bench: 8 },
        'TE': { star: 15, starter: 10, bench: 6 }
      };

      const thresholds = positionThresholds[position as keyof typeof positionThresholds];
      if (thresholds) {
        if (avgFantasyPoints >= thresholds.star) return 'star';
        if (avgFantasyPoints >= thresholds.starter) return 'starter';
        if (avgFantasyPoints >= thresholds.bench) return 'bench';
      }
    }

    return 'practice';
  }

  /**
   * Calculate consistency score (0-100) based on game stats variance
   */
  private calculateConsistencyScore(gameStats: GameStatsRecord[]): number {
    if (gameStats.length < 3) return 0;

    const fantasyPoints = gameStats.map(g => g.fantasy_points || 0);
    const mean = fantasyPoints.reduce((sum, p) => sum + p, 0) / fantasyPoints.length;
    const variance = fantasyPoints.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / fantasyPoints.length;
    const stdDev = Math.sqrt(variance);
    
    // Higher consistency = lower standard deviation relative to mean
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    const consistencyScore = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 50)));
    
    return Math.round(consistencyScore);
  }

  /**
   * Determine trending direction based on recent vs earlier performance
   */
  private calculateTrending(gameStats: GameStatsRecord[]): 'up' | 'down' | 'stable' {
    if (gameStats.length < 6) return 'stable';

    const recentGames = gameStats.slice(0, 3);
    const earlierGames = gameStats.slice(3, 6);

    const recentAvg = recentGames.reduce((sum, g) => sum + (g.fantasy_points || 0), 0) / recentGames.length;
    const earlierAvg = earlierGames.reduce((sum, g) => sum + (g.fantasy_points || 0), 0) / earlierGames.length;

    const changePercent = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;

    if (changePercent > 15) return 'up';
    if (changePercent < -15) return 'down';
    return 'stable';
  }

  /**
   * Transform raw database row to PlayerProfile with calculated fields
   */
  private async transformPlayerProfile(
    row: any, 
    includeStats: boolean = false,
    includeRecentGames: boolean = false
  ): Promise<PlayerProfile> {
    const profile: PlayerProfile = {
      id: row.id,
      name: row.name || `${row.firstname || ''} ${row.lastname || ''}`.trim(),
      firstname: row.firstname,
      lastname: row.lastname,
      position: row.position,
      team: row.team,
      team_abbreviation: row.team_abbreviation,
      jersey_number: row.jersey_number,
      
      // Physical attributes
      height_inches: row.heightinches ? parseFloat(row.heightinches) : undefined,
      weight_lbs: row.weightlbs ? parseFloat(row.weightlbs) : undefined,
      birthdate: row.birthdate,
      college: row.college,
      draft_year: row.draft_year ? parseInt(row.draft_year) : undefined,
      draft_round: row.draft_round ? parseInt(row.draft_round) : undefined,
      status: row.status,
      
      // Sport classification
      sport: row.sport || (row.sport_id === '1' ? 'NFL' : row.sport_id === '2' ? 'NBA' : row.sport_id === '3' ? 'MLB' : row.sport_id === '4' ? 'NHL' : 'UNKNOWN'),
      sport_id: row.sport_id,
      
      // Avatar system
      avatar_tier: row.avatar_tier as any,
      avatar_2d_url: row.avatar_2d_url,
      avatar_3d_url: row.avatar_3d_url,
      avatar_photo_url: row.avatar_photo_url,
      image_url: row.image_url || row.photo_url || row.avatar_photo_url || row.avatar_2d_url,
      overall_rating: row.overall_rating,
      avatar_metadata: row.avatar_metadata,
      
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Calculate derived fields
    if (profile.birthdate) {
      profile.age = Math.floor((Date.now() - new Date(profile.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    if (profile.weight_lbs && profile.height_inches) {
      profile.bmi = (profile.weight_lbs / Math.pow(profile.height_inches, 2)) * 703;
    }

    if (profile.draft_year) {
      profile.years_pro = new Date().getFullYear() - profile.draft_year;
    }

    // Get performance stats if requested
    if (includeStats || includeRecentGames) {
      const { data: gameStats } = await gameStatsService.getGameStats({
        player_ids: [profile.id],
        sport: profile.sport,
        limit: includeRecentGames ? 20 : 5 // Get more if we need recent games
      });

      if (gameStats.length > 0) {
        // Calculate season stats
        const gamesPlayed = gameStats.length;
        const totalFantasyPoints = gameStats.reduce((sum, g) => sum + (g.fantasy_points || 0), 0);
        const totalDKPoints = gameStats.reduce((sum, g) => sum + (g.dk_points || 0), 0);
        const totalFDPoints = gameStats.reduce((sum, g) => sum + (g.fd_points || 0), 0);
        const totalYahooPoints = gameStats.reduce((sum, g) => sum + (g.yahoo_points || 0), 0);
        
        const avgFantasyPoints = totalFantasyPoints / gamesPlayed;
        const bestGamePoints = Math.max(...gameStats.map(g => g.fantasy_points || 0));
        const consistencyScore = this.calculateConsistencyScore(gameStats);

        profile.season_stats = {
          games_played: gamesPlayed,
          avg_fantasy_points: Number(avgFantasyPoints.toFixed(2)),
          avg_dk_points: Number((totalDKPoints / gamesPlayed).toFixed(2)),
          avg_fd_points: Number((totalFDPoints / gamesPlayed).toFixed(2)),
          avg_yahoo_points: Number((totalYahooPoints / gamesPlayed).toFixed(2)),
          total_fantasy_points: Number(totalFantasyPoints.toFixed(2)),
          best_game_points: Number(bestGamePoints.toFixed(2)),
          consistency_score: consistencyScore
        };

        // Update avatar tier based on performance if not set
        if (!profile.avatar_tier) {
          profile.avatar_tier = this.calculateAvatarTier(
            profile.overall_rating,
            avgFantasyPoints,
            profile.position
          );
        }

        // Calculate trending
        profile.trending = this.calculateTrending(gameStats);

        // Include recent games if requested
        if (includeRecentGames) {
          profile.recent_games = gameStats.slice(0, 5);
        }
      }
    }

    return profile;
  }

  /**
   * Get players with comprehensive filtering and search
   */
  async getPlayers(query: PlayerSearchQuery = {}): Promise<{
    data: PlayerProfile[];
    error: string | null;
    count?: number;
  }> {
    try {
      const supabase = await this.getSupabase();
      
      let queryBuilder = supabase
        .from('players')
        .select(`
          id,
          name,
          firstname,
          lastname,
          position,
          team,
          team_abbreviation,
          jersey_number,
          heightinches,
          weightlbs,
          birthdate,
          college,
          draft_year,
          draft_round,
          status,
          sport,
          sport_id,
          avatar_tier,
          avatar_2d_url,
          avatar_3d_url,
          avatar_photo_url,
          photo_url,
          image_url,
          overall_rating,
          avatar_metadata,
          created_at,
          updated_at
        `);

      // Apply filters
      if (query.sport) {
        queryBuilder = queryBuilder.eq('sport', query.sport);
      }
      
      if (query.positions && query.positions.length > 0) {
        queryBuilder = queryBuilder.in('position', query.positions);
      }
      
      if (query.teams && query.teams.length > 0) {
        queryBuilder = queryBuilder.in('team', query.teams);
      }
      
      if (query.avatar_tiers && query.avatar_tiers.length > 0) {
        queryBuilder = queryBuilder.in('avatar_tier', query.avatar_tiers);
      }
      
      if (query.min_rating) {
        queryBuilder = queryBuilder.gte('overall_rating', query.min_rating);
      }
      
      if (query.max_rating) {
        queryBuilder = queryBuilder.lte('overall_rating', query.max_rating);
      }
      
      if (query.status) {
        queryBuilder = queryBuilder.eq('status', query.status);
      }

      // Text search
      if (query.search_term) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query.search_term}%,firstname.ilike.%${query.search_term}%,lastname.ilike.%${query.search_term}%`);
      }

      // Apply pagination
      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }
      
      if (query.offset) {
        queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 1000) - 1);
      }

      // Order by overall rating descending, then by name
      queryBuilder = queryBuilder.order('overall_rating', { ascending: false, nullsLast: true })
                                 .order('name', { ascending: true });

      const { data, error } = await queryBuilder;

      if (error) {
        logger.error('Error fetching players:', error);
        return { data: [], error: error.message };
      }

      // Transform each player profile
      const playerProfiles = await Promise.all(
        (data || []).map(row => 
          this.transformPlayerProfile(
            row, 
            query.include_stats, 
            query.include_recent_games
          )
        )
      );

      logger.info('Players fetched successfully', {
        count: playerProfiles.length,
        sport: query.sport,
        positions: query.positions,
        includeStats: query.include_stats,
        includeRecentGames: query.include_recent_games
      });

      return { data: playerProfiles, error: null, count: playerProfiles.length };

    } catch (error) {
      logger.error('Player data service error:', error);
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Unknown error in player data service'
      };
    }
  }

  /**
   * Get a single player by ID with full profile data
   */
  async getPlayerById(
    playerId: number, 
    options: { include_stats?: boolean; include_recent_games?: boolean } = {}
  ): Promise<{
    data: PlayerProfile | null;
    error: string | null;
  }> {
    try {
      const { data: players, error } = await this.getPlayers({
        ...options,
        limit: 1
      });

      if (error) {
        return { data: null, error };
      }

      const player = players.find(p => p.id === playerId);
      if (!player) {
        return { data: null, error: 'Player not found' };
      }

      return { data: player, error: null };

    } catch (error) {
      logger.error('Error fetching player by ID:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error fetching player'
      };
    }
  }

  /**
   * Get multiple players by IDs with full profile data
   */
  async getPlayersByIds(
    playerIds: number[], 
    options: { include_stats?: boolean; include_recent_games?: boolean } = {}
  ): Promise<{
    data: PlayerProfile[] | null;
    error: string | null;
  }> {
    try {
      if (playerIds.length === 0) {
        return { data: [], error: null };
      }

      // Use the existing getPlayers method with player_ids filter
      const result = await this.getPlayers({
        player_ids: playerIds,
        include_stats: options.include_stats,
        include_recent_games: options.include_recent_games,
        limit: playerIds.length
      });

      return result;

    } catch (error) {
      logger.error('Error fetching players by IDs:', { playerIds: playerIds.length, error });
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error fetching players'
      };
    }
  }

  /**
   * Get top performers with full player profiles
   */
  async getTopPerformers(options: {
    sport: string;
    positions?: string[];
    season?: number;
    weeks?: number[];
    limit?: number;
    min_games?: number;
  }): Promise<{
    data: PlayerProfile[];
    error: string | null;
  }> {
    try {
      // Get top performers from game stats service
      const { data: topPerformersStats, error: statsError } = await gameStatsService.getTopPerformers(options);
      
      if (statsError) {
        return { data: [], error: statsError };
      }

      // Get full player profiles for these performers
      const playerIds = topPerformersStats.map(p => p.player_id);
      const { data: playerProfiles, error: profilesError } = await this.getPlayers({
        sport: options.sport,
        include_stats: true,
        include_recent_games: true,
        limit: playerIds.length
      });

      if (profilesError) {
        return { data: [], error: profilesError };
      }

      // Merge stats with profiles and maintain order
      const topPerformersWithProfiles = topPerformersStats.map(stats => {
        const profile = playerProfiles.find(p => p.id === stats.player_id);
        if (profile) {
          // Override season stats with the calculated performance data
          profile.season_stats = {
            games_played: stats.game_count,
            avg_fantasy_points: stats.avg_fantasy_points,
            avg_dk_points: stats.avg_dk_points,
            avg_fd_points: stats.avg_fd_points,
            avg_yahoo_points: stats.avg_yahoo_points,
            total_fantasy_points: stats.total_fantasy_points,
            best_game_points: Math.max(...stats.recent_games.map((g: any) => g.fantasy_points || 0)),
            consistency_score: profile.season_stats?.consistency_score || 0
          };
          profile.recent_games = stats.recent_games;
        }
        return profile;
      }).filter(Boolean) as PlayerProfile[];

      return { data: topPerformersWithProfiles, error: null };

    } catch (error) {
      logger.error('Error getting top performers with profiles:', error);
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Unknown error in top performers with profiles'
      };
    }
  }

  /**
   * Update player avatar tier based on performance
   */
  async updatePlayerAvatarTier(playerId: number): Promise<{
    success: boolean;
    error: string | null;
    newTier?: string;
  }> {
    try {
      // Get player's recent performance
      const { data: player, error } = await this.getPlayerById(playerId, { include_stats: true });
      
      if (error || !player) {
        return { success: false, error: error || 'Player not found' };
      }

      // Calculate new avatar tier
      const newTier = this.calculateAvatarTier(
        player.overall_rating,
        player.season_stats?.avg_fantasy_points,
        player.position
      );

      // Update in database if changed
      if (newTier !== player.avatar_tier) {
        const supabase = await this.getSupabase();
        const { error: updateError } = await supabase
          .from('players')
          .update({ avatar_tier: newTier })
          .eq('id', playerId);

        if (updateError) {
          return { success: false, error: updateError.message };
        }

        logger.info('Player avatar tier updated', {
          playerId,
          oldTier: player.avatar_tier,
          newTier,
          avgFantasyPoints: player.season_stats?.avg_fantasy_points,
          overallRating: player.overall_rating
        });
      }

      return { success: true, error: null, newTier };

    } catch (error) {
      logger.error('Error updating player avatar tier:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error updating avatar tier'
      };
    }
  }
}

// Export singleton instance
export const playerDataService = new PlayerDataService();
export default playerDataService;