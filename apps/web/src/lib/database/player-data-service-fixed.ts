/**
 * 🔥 FIXED PLAYER DATA SERVICE - USING ACTUAL DATABASE STRUCTURE
 * 
 * Based on actual database inspection:
 * - Table: players (85,892 records)
 * - Has: id, firstname, lastname, position, team_id
 * - No direct name column - need to concatenate firstname + lastname
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { gameStatsService } from './game-stats-service-fixed';

export interface PlayerProfile {
  id: number;
  name: string; // Computed from firstname + lastname
  firstname: string;
  lastname: string;
  position: string;
  team_id: number;
  team?: string; // Will need to join with teams table
  season_stats?: any;
  avatar_url?: string;
  avatar_tier?: 'elite' | 'star' | 'solid' | 'starter' | 'bench';
  overall_rating?: number;
  injury_status?: string;
  injury_notes?: string;
  ownership?: {
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface PlayerSearchOptions {
  query?: string;
  position?: string;
  team?: string;
  available?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'points' | 'rating';
  sport?: string;
}

class FixedPlayerDataService {
  private supabaseClient: any = null;

  private async getSupabase() {
    if (!this.supabaseClient) {
      this.supabaseClient = await createClient();
    }
    return this.supabaseClient;
  }

  /**
   * Search players with name matching (firstname/lastname)
   */
  async searchPlayers(options: PlayerSearchOptions = {}): Promise<PlayerProfile[]> {
    try {
      const supabase = await this.getSupabase();
      
      let query = supabase
        .from('players')
        .select(`
          id,
          firstname,
          lastname,
          position,
          team_id,
          season_stats,
          teams!inner (
            id,
            name,
            abbreviation
          )
        `);

      // Search by name - check both firstname and lastname
      if (options.query) {
        const searchTerm = `%${options.query.toLowerCase()}%`;
        query = query.or(`firstname.ilike.${searchTerm},lastname.ilike.${searchTerm}`);
      }

      // Filter by position
      if (options.position) {
        query = query.eq('position', options.position);
      }

      // Filter by team
      if (options.team) {
        query = query.eq('team_id', options.team);
      }

      // Apply limit
      query = query.limit(options.limit || 10);

      const { data, error } = await query;

      if (error) {
        logger.error('Error searching players:', error);
        return [];
      }

      // Transform to PlayerProfile format
      const players = data?.map((player: any) => ({
        id: player.id,
        name: `${player.firstname} ${player.lastname}`.trim(),
        firstname: player.firstname,
        lastname: player.lastname,
        position: player.position,
        team_id: player.team_id,
        team: player.teams?.abbreviation || player.teams?.name,
        season_stats: player.season_stats,
        // Calculate tier based on some metric (would need actual rating data)
        avatar_tier: this.calculateTier(player.season_stats),
        overall_rating: this.calculateRating(player.season_stats)
      })) || [];

      // Sort by requested field
      if (options.sortBy === 'name') {
        players.sort((a, b) => a.name.localeCompare(b.name));
      } else if (options.sortBy === 'points' && players[0]?.season_stats?.fantasy_points_total) {
        players.sort((a, b) => 
          (b.season_stats?.fantasy_points_total || 0) - (a.season_stats?.fantasy_points_total || 0)
        );
      }

      return players;
    } catch (error) {
      logger.error('Player search error:', error);
      return [];
    }
  }

  /**
   * Get player by ID
   */
  async getPlayerById(playerId: number): Promise<{
    data: PlayerProfile | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          firstname,
          lastname,
          position,
          team_id,
          season_stats,
          teams (
            id,
            name,
            abbreviation
          )
        `)
        .eq('id', playerId)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      const player: PlayerProfile = {
        id: data.id,
        name: `${data.firstname} ${data.lastname}`.trim(),
        firstname: data.firstname,
        lastname: data.lastname,
        position: data.position,
        team_id: data.team_id,
        team: data.teams?.abbreviation || data.teams?.name,
        season_stats: data.season_stats,
        avatar_tier: this.calculateTier(data.season_stats),
        overall_rating: this.calculateRating(data.season_stats)
      };

      return { data: player, error: null };
    } catch (error) {
      return { data: null, error: String(error) };
    }
  }

  /**
   * Get multiple players by IDs
   */
  async getPlayersByIds(
    playerIds: number[],
    options: { include_stats?: boolean } = {}
  ): Promise<{
    data: PlayerProfile[] | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getSupabase();
      
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          firstname,
          lastname,
          position,
          team_id,
          season_stats,
          teams (
            id,
            name,
            abbreviation
          )
        `)
        .in('id', playerIds);

      if (error) {
        return { data: null, error: error.message };
      }

      const players = data?.map((player: any) => ({
        id: player.id,
        name: `${player.firstname} ${player.lastname}`.trim(),
        firstname: player.firstname,
        lastname: player.lastname,
        position: player.position,
        team_id: player.team_id,
        team: player.teams?.abbreviation || player.teams?.name,
        season_stats: player.season_stats,
        avatar_tier: this.calculateTier(player.season_stats),
        overall_rating: this.calculateRating(player.season_stats)
      })) || [];

      return { data: players, error: null };
    } catch (error) {
      return { data: null, error: String(error) };
    }
  }

  /**
   * Get player trends by analyzing recent games
   */
  async getPlayerTrends(playerId: number, games: number = 8): Promise<{
    shortTerm: {
      averagePoints: number;
      consistency: number;
      direction: 'up' | 'down' | 'stable';
    };
    projections: {
      nextGame: number;
      restOfSeason: number;
    };
  }> {
    try {
      // Get recent games from game logs
      const { data: gameLogs } = await gameStatsService.getPlayerGameLogs(playerId, {
        limit: games,
        sortBy: 'game_date',
        sortOrder: 'desc'
      });

      if (!gameLogs || gameLogs.length === 0) {
        return {
          shortTerm: {
            averagePoints: 0,
            consistency: 0,
            direction: 'stable'
          },
          projections: {
            nextGame: 0,
            restOfSeason: 0
          }
        };
      }

      // Calculate average and consistency
      const points = gameLogs.map(g => g.fantasy_points || 0);
      const average = points.reduce((sum, p) => sum + p, 0) / points.length;
      
      // Calculate standard deviation for consistency
      const variance = points.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / points.length;
      const stdDev = Math.sqrt(variance);
      const consistency = average > 0 ? Math.max(0, 100 - (stdDev / average * 100)) : 0;

      // Determine trend direction
      const recentAvg = points.slice(0, 3).reduce((sum, p) => sum + p, 0) / 3;
      const olderAvg = points.slice(-3).reduce((sum, p) => sum + p, 0) / 3;
      const direction = recentAvg > olderAvg * 1.1 ? 'up' : 
                       recentAvg < olderAvg * 0.9 ? 'down' : 'stable';

      return {
        shortTerm: {
          averagePoints: Math.round(average * 10) / 10,
          consistency: Math.round(consistency),
          direction
        },
        projections: {
          nextGame: Math.round(average * 10) / 10,
          restOfSeason: Math.round(average * 10) / 10
        }
      };
    } catch (error) {
      logger.error('Error calculating player trends:', error);
      return {
        shortTerm: {
          averagePoints: 0,
          consistency: 0,
          direction: 'stable'
        },
        projections: {
          nextGame: 0,
          restOfSeason: 0
        }
      };
    }
  }

  /**
   * Calculate player tier based on stats
   */
  private calculateTier(seasonStats: any): 'elite' | 'star' | 'solid' | 'starter' | 'bench' {
    if (!seasonStats || !seasonStats.fantasy_points_avg) return 'bench';
    
    const avg = seasonStats.fantasy_points_avg;
    if (avg >= 20) return 'elite';
    if (avg >= 15) return 'star';
    if (avg >= 10) return 'solid';
    if (avg >= 5) return 'starter';
    return 'bench';
  }

  /**
   * Calculate overall rating based on stats
   */
  private calculateRating(seasonStats: any): number {
    if (!seasonStats || !seasonStats.fantasy_points_avg) return 60;
    
    const avg = seasonStats.fantasy_points_avg;
    if (avg >= 20) return 90 + Math.min(10, (avg - 20) / 2);
    if (avg >= 15) return 80 + ((avg - 15) / 5 * 10);
    if (avg >= 10) return 70 + ((avg - 10) / 5 * 10);
    if (avg >= 5) return 60 + ((avg - 5) / 5 * 10);
    return 50 + (avg / 5 * 10);
  }
}

// Export singleton instance
export const playerDataService = new FixedPlayerDataService();

/**
 * ACTUAL DATABASE STRUCTURE:
 * 
 * players table (85,892 records):
 * - id, firstname, lastname (no direct 'name' field)
 * - position, team_id
 * - season_stats (JSON)
 * 
 * teams table (2,908 records):
 * - id, name, city, abbreviation, sport_id
 * 
 * This service now correctly handles the firstname/lastname structure!
 */