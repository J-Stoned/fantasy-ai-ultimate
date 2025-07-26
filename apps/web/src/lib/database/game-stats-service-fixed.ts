/**
 * 🔥 FIXED GAME STATS SERVICE - USING ACTUAL DATABASE STRUCTURE
 * 
 * Based on actual database inspection:
 * - Table: player_game_logs (639,650 records)
 * - Has: fantasy_points, stats (JSON), metadata (JSON)
 * - Sport detection from metadata.sport field
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

export interface GameStatsRecord {
  id: number;
  player_id: number;
  game_id: number;
  game_date: string;
  team_id: number;
  opponent_id: number;
  is_home: boolean;
  fantasy_points: number;
  minutes_played?: number;
  stats: any; // JSON stats object
  metadata?: any; // Contains sport info
  sport?: string; // Extracted from metadata
}

export interface GameStatsQuery {
  player_id?: number;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  sport?: string;
  sortBy?: 'game_date' | 'fantasy_points';
  sortOrder?: 'asc' | 'desc';
}

class FixedGameStatsService {
  private supabaseClient: any = null;

  private async getSupabase() {
    if (!this.supabaseClient) {
      this.supabaseClient = await createClient();
    }
    return this.supabaseClient;
  }

  /**
   * Get player game logs from the actual table
   */
  async getPlayerGameLogs(playerId: number, options: GameStatsQuery = {}): Promise<{
    data: GameStatsRecord[] | null;
    error: string | null;
  }> {
    try {
      const supabase = await this.getSupabase();
      
      let query = supabase
        .from('player_game_logs')
        .select('*')
        .eq('player_id', playerId);

      // Apply filters
      if (options.startDate) {
        query = query.gte('game_date', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('game_date', options.endDate);
      }
      
      // Apply sorting
      const sortBy = options.sortBy || 'game_date';
      const sortOrder = options.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      
      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching game logs:', error);
        return { data: null, error: error.message };
      }

      // Extract sport from metadata
      const processedData = data?.map((log: any) => ({
        ...log,
        sport: log.metadata?.sport || 'Unknown'
      })) || [];

      return { data: processedData, error: null };
    } catch (error) {
      logger.error('Game stats service error:', error);
      return { data: null, error: String(error) };
    }
  }

  /**
   * Get game stats with optional sport filter
   */
  async getGameStats(query: GameStatsQuery = {}): Promise<{
    data: GameStatsRecord[];
    error: string | null;
    count?: number;
  }> {
    try {
      const supabase = await this.getSupabase();
      
      let queryBuilder = supabase
        .from('player_game_logs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (query.player_id) {
        queryBuilder = queryBuilder.eq('player_id', query.player_id);
      }
      
      // Sport filter would need to check metadata->sport
      if (query.sport) {
        queryBuilder = queryBuilder.eq('metadata->>sport', query.sport);
      }

      // Apply sorting
      queryBuilder = queryBuilder.order(query.sortBy || 'game_date', { 
        ascending: query.sortOrder === 'asc' 
      });

      // Apply pagination
      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }
      if (query.offset) {
        queryBuilder = queryBuilder.range(
          query.offset, 
          query.offset + (query.limit || 10) - 1
        );
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('Error fetching game stats:', error);
        return { data: [], error: error.message };
      }

      // Process data to extract sport
      const processedData = data?.map((log: any) => ({
        ...log,
        sport: log.metadata?.sport || 'Unknown'
      })) || [];

      return { 
        data: processedData, 
        error: null,
        count: count || undefined
      };
    } catch (error) {
      logger.error('Game stats service error:', error);
      return { data: [], error: String(error) };
    }
  }

  /**
   * Calculate fantasy points average for a player
   */
  async getPlayerFantasyAverage(playerId: number, games: number = 10): Promise<{
    average: number;
    games_played: number;
    error: string | null;
  }> {
    try {
      const { data, error } = await this.getPlayerGameLogs(playerId, {
        limit: games,
        sortBy: 'game_date',
        sortOrder: 'desc'
      });

      if (error || !data) {
        return { average: 0, games_played: 0, error };
      }

      const totalPoints = data.reduce((sum, game) => sum + (game.fantasy_points || 0), 0);
      const gamesPlayed = data.length;
      const average = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

      return {
        average: Math.round(average * 10) / 10,
        games_played: gamesPlayed,
        error: null
      };
    } catch (error) {
      return { average: 0, games_played: 0, error: String(error) };
    }
  }
}

// Export singleton instance
export const gameStatsService = new FixedGameStatsService();

/**
 * ACTUAL DATABASE STRUCTURE:
 * 
 * player_game_logs table (639,650 records):
 * - id, player_id, game_id, team_id, opponent_id
 * - game_date, is_home, minutes_played
 * - fantasy_points (direct column)
 * - stats (JSON with sport-specific data)
 * - metadata (JSON with sport field)
 * 
 * players table (85,892 records):
 * - id, firstname, lastname, position, team_id
 * - season_stats (JSON)
 * 
 * This service now correctly maps to the actual database!
 */