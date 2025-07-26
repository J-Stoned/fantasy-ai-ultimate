/**
 * 🔥 UNIVERSAL GAME STATS SERVICE
 * Elite developer database abstraction layer for Fantasy AI Ultimate
 * 
 * Handles the mapping between player_game_stats table and player_game_logs view
 * Provides unified access to 1,575,773 game stats across all sports
 * Extracts JSON field data for NFL, NBA, MLB, NHL statistics
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';

// Types for different sports stats
export interface NFLStats {
  passing_yards?: number;
  passing_tds?: number;
  passing_ints?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  receptions?: number;
  targets?: number;
  fumbles_lost?: number;
}

export interface NBAStats {
  points?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  minutes?: number;
  field_goals_made?: number;
  field_goals_attempted?: number;
  three_pointers_made?: number;
  three_pointers_attempted?: number;
  free_throws_made?: number;
  free_throws_attempted?: number;
}

export interface MLBStats {
  at_bats?: number;
  hits?: number;
  runs?: number;
  rbis?: number;
  home_runs?: number;
  stolen_bases?: number;
  strikeouts?: number;
  walks?: number;
  batting_average?: number;
  on_base_percentage?: number;
  slugging_percentage?: number;
}

export interface NHLStats {
  goals?: number;
  assists?: number;
  shots?: number;
  saves?: number;
  time_on_ice?: number;
  power_play_goals?: number;
  power_play_assists?: number;
  penalty_minutes?: number;
  hits?: number;
  blocked_shots?: number;
}

export interface GameStatsRecord {
  id: number;
  player_id: number;
  player_name?: string;
  position?: string;
  sport: string;
  team?: string;
  opponent?: string;
  game_date?: string;
  season?: number;
  week?: number;
  is_home?: boolean;
  
  // Fantasy points across platforms
  fantasy_points?: number;
  dk_points?: number;
  fd_points?: number;
  yahoo_points?: number;
  espn_points?: number;
  cbs_points?: number;
  sleeper_points?: number;
  
  // Sport-specific stats (extracted from JSON)
  nfl_stats?: NFLStats;
  nba_stats?: NBAStats;
  mlb_stats?: MLBStats;
  nhl_stats?: NHLStats;
  
  // Raw data
  stats?: any;
  advanced_stats?: any;
  played?: boolean;
  started?: boolean;
  confidence_score?: number;
  data_source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GameStatsQuery {
  sport?: string;
  season?: number;
  player_ids?: number[];
  positions?: string[];
  teams?: string[];
  weeks?: number[];
  limit?: number;
  offset?: number;
  include_stats?: boolean;
  min_fantasy_points?: number;
}

class GameStatsService {
  private supabaseClient: any = null;

  private async getSupabase() {
    if (!this.supabaseClient) {
      this.supabaseClient = await createClient();
    }
    return this.supabaseClient;
  }

  /**
   * Extract sport-specific stats from JSON field
   */
  private extractSportStats(sport: string, stats: any): any {
    if (!stats) return {};

    switch (sport.toLowerCase()) {
      case 'nfl':
        return {
          passing_yards: stats.passing_yards ? Number(stats.passing_yards) : undefined,
          passing_tds: stats.passing_tds ? Number(stats.passing_tds) : undefined,
          passing_ints: stats.passing_ints ? Number(stats.passing_ints) : undefined,
          rushing_yards: stats.rushing_yards ? Number(stats.rushing_yards) : undefined,
          rushing_tds: stats.rushing_tds ? Number(stats.rushing_tds) : undefined,
          receiving_yards: stats.receiving_yards ? Number(stats.receiving_yards) : undefined,
          receiving_tds: stats.receiving_tds ? Number(stats.receiving_tds) : undefined,
          receptions: stats.receptions ? Number(stats.receptions) : undefined,
          targets: stats.targets ? Number(stats.targets) : undefined,
          fumbles_lost: stats.fumbles_lost ? Number(stats.fumbles_lost) : undefined,
        };

      case 'nba':
        return {
          points: stats.points ? Number(stats.points) : undefined,
          rebounds: stats.rebounds ? Number(stats.rebounds) : undefined,
          assists: stats.assists ? Number(stats.assists) : undefined,
          steals: stats.steals ? Number(stats.steals) : undefined,
          blocks: stats.blocks ? Number(stats.blocks) : undefined,
          turnovers: stats.turnovers ? Number(stats.turnovers) : undefined,
          minutes: stats.minutes ? Number(stats.minutes) : undefined,
          field_goals_made: stats.field_goals_made ? Number(stats.field_goals_made) : undefined,
          field_goals_attempted: stats.field_goals_attempted ? Number(stats.field_goals_attempted) : undefined,
          three_pointers_made: stats.three_pointers_made ? Number(stats.three_pointers_made) : undefined,
          three_pointers_attempted: stats.three_pointers_attempted ? Number(stats.three_pointers_attempted) : undefined,
          free_throws_made: stats.free_throws_made ? Number(stats.free_throws_made) : undefined,
          free_throws_attempted: stats.free_throws_attempted ? Number(stats.free_throws_attempted) : undefined,
        };

      case 'mlb':
        return {
          at_bats: stats.at_bats ? Number(stats.at_bats) : undefined,
          hits: stats.hits ? Number(stats.hits) : undefined,
          runs: stats.runs ? Number(stats.runs) : undefined,
          rbis: stats.rbis ? Number(stats.rbis) : undefined,
          home_runs: stats.home_runs ? Number(stats.home_runs) : undefined,
          stolen_bases: stats.stolen_bases ? Number(stats.stolen_bases) : undefined,
          strikeouts: stats.strikeouts ? Number(stats.strikeouts) : undefined,
          walks: stats.walks ? Number(stats.walks) : undefined,
          batting_average: stats.batting_average ? Number(stats.batting_average) : undefined,
          on_base_percentage: stats.on_base_percentage ? Number(stats.on_base_percentage) : undefined,
          slugging_percentage: stats.slugging_percentage ? Number(stats.slugging_percentage) : undefined,
        };

      case 'nhl':
        return {
          goals: stats.goals ? Number(stats.goals) : undefined,
          assists: stats.assists ? Number(stats.assists) : undefined,
          shots: stats.shots ? Number(stats.shots) : undefined,
          saves: stats.saves ? Number(stats.saves) : undefined,
          time_on_ice: stats.time_on_ice ? Number(stats.time_on_ice) : undefined,
          power_play_goals: stats.power_play_goals ? Number(stats.power_play_goals) : undefined,
          power_play_assists: stats.power_play_assists ? Number(stats.power_play_assists) : undefined,
          penalty_minutes: stats.penalty_minutes ? Number(stats.penalty_minutes) : undefined,
          hits: stats.hits ? Number(stats.hits) : undefined,
          blocked_shots: stats.blocked_shots ? Number(stats.blocked_shots) : undefined,
        };

      default:
        return {};
    }
  }

  /**
   * Transform raw database row to GameStatsRecord
   */
  private transformRecord(row: any): GameStatsRecord {
    const sport = row.sport?.toLowerCase() || 'unknown';
    const sportStats = this.extractSportStats(sport, row.stats);

    const record: GameStatsRecord = {
      id: row.id,
      player_id: row.player_id,
      player_name: row.player_name,
      position: row.position,
      sport: row.sport,
      team: row.team,
      opponent: row.opponent,
      game_date: row.game_date,
      season: row.season,
      week: row.week,
      is_home: row.is_home,
      
      // Fantasy points
      fantasy_points: row.fantasy_points ? Number(row.fantasy_points) : undefined,
      dk_points: row.dk_points ? Number(row.dk_points) : undefined,
      fd_points: row.fd_points ? Number(row.fd_points) : undefined,
      yahoo_points: row.yahoo_points ? Number(row.yahoo_points) : undefined,
      espn_points: row.espn_points ? Number(row.espn_points) : undefined,
      cbs_points: row.cbs_points ? Number(row.cbs_points) : undefined,
      sleeper_points: row.sleeper_points ? Number(row.sleeper_points) : undefined,
      
      // Raw data
      stats: row.stats,
      advanced_stats: row.advanced_stats,
      played: row.played,
      started: row.started,
      confidence_score: row.confidence_score,
      data_source: row.data_source,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Add sport-specific stats
    switch (sport) {
      case 'nfl':
        record.nfl_stats = sportStats;
        break;
      case 'nba':
        record.nba_stats = sportStats;
        break;
      case 'mlb':
        record.mlb_stats = sportStats;
        break;
      case 'nhl':
        record.nhl_stats = sportStats;
        break;
    }

    return record;
  }

  /**
   * Get game stats using the player_game_logs view (recommended)
   * This view properly handles all the complex joins and mappings
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
        .select(`
          id,
          player_id,
          player_name,
          position,
          sport,
          team,
          opponent,
          game_date,
          season,
          week,
          is_home,
          fantasy_points,
          dk_points,
          fd_points,
          yahoo_points,
          espn_points,
          stats,
          advanced_stats,
          played,
          started,
          confidence_score,
          data_source,
          created_at,
          updated_at
        `);

      // Apply filters
      if (query.sport) {
        queryBuilder = queryBuilder.eq('sport', query.sport);
      }
      
      if (query.season) {
        queryBuilder = queryBuilder.eq('season', query.season);
      }
      
      if (query.player_ids && query.player_ids.length > 0) {
        queryBuilder = queryBuilder.in('player_id', query.player_ids);
      }
      
      if (query.positions && query.positions.length > 0) {
        queryBuilder = queryBuilder.in('position', query.positions);
      }
      
      if (query.teams && query.teams.length > 0) {
        queryBuilder = queryBuilder.in('team', query.teams);
      }
      
      if (query.weeks && query.weeks.length > 0) {
        queryBuilder = queryBuilder.in('week', query.weeks);
      }
      
      if (query.min_fantasy_points) {
        queryBuilder = queryBuilder.gte('fantasy_points', query.min_fantasy_points);
      }

      // Apply pagination
      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }
      
      if (query.offset) {
        queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 1000) - 1);
      }

      // Order by game date descending
      queryBuilder = queryBuilder.order('game_date', { ascending: false });

      const { data, error } = await queryBuilder;

      if (error) {
        logger.error('Error fetching game stats:', error);
        return { data: [], error: error.message };
      }

      const transformedData = (data || []).map(row => this.transformRecord(row));

      logger.info('Game stats fetched successfully', {
        count: transformedData.length,
        sport: query.sport,
        season: query.season,
        hasPositionFilter: !!query.positions,
        hasPlayerFilter: !!query.player_ids
      });

      return { data: transformedData, error: null, count: transformedData.length };

    } catch (error) {
      logger.error('Game stats service error:', error);
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Unknown error in game stats service'
      };
    }
  }

  /**
   * Get aggregated stats for a player across multiple games
   */
  async getPlayerAggregateStats(
    playerId: number, 
    options: { sport?: string; season?: number; limit?: number } = {}
  ): Promise<{
    data: any;
    error: string | null;
  }> {
    try {
      const { data: gameStats, error } = await this.getGameStats({
        player_ids: [playerId],
        sport: options.sport,
        season: options.season,
        limit: options.limit
      });

      if (error) {
        return { data: null, error };
      }

      if (gameStats.length === 0) {
        return { data: null, error: 'No game stats found for player' };
      }

      // Aggregate fantasy points
      const totalGames = gameStats.length;
      const totalFantasyPoints = gameStats.reduce((sum, game) => sum + (game.fantasy_points || 0), 0);
      const avgFantasyPoints = totalFantasyPoints / totalGames;

      // Platform-specific averages
      const avgDKPoints = gameStats.reduce((sum, game) => sum + (game.dk_points || 0), 0) / totalGames;
      const avgFDPoints = gameStats.reduce((sum, game) => sum + (game.fd_points || 0), 0) / totalGames;
      const avgYahooPoints = gameStats.reduce((sum, game) => sum + (game.yahoo_points || 0), 0) / totalGames;

      const aggregated = {
        player_id: playerId,
        total_games: totalGames,
        avg_fantasy_points: Number(avgFantasyPoints.toFixed(2)),
        avg_dk_points: Number(avgDKPoints.toFixed(2)),
        avg_fd_points: Number(avgFDPoints.toFixed(2)),
        avg_yahoo_points: Number(avgYahooPoints.toFixed(2)),
        recent_games: gameStats.slice(0, 5), // Last 5 games
        sport: gameStats[0].sport,
        position: gameStats[0].position
      };

      return { data: aggregated, error: null };

    } catch (error) {
      logger.error('Error aggregating player stats:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error in player aggregation'
      };
    }
  }

  /**
   * Get top performers for a given criteria
   */
  async getTopPerformers(options: {
    sport: string;
    positions?: string[];
    season?: number;
    weeks?: number[];
    limit?: number;
    min_games?: number;
  }): Promise<{
    data: any[];
    error: string | null;
  }> {
    try {
      const { data: gameStats, error } = await this.getGameStats({
        sport: options.sport,
        positions: options.positions,
        season: options.season,
        weeks: options.weeks,
        limit: options.limit ? options.limit * 10 : 5000 // Get more to aggregate properly
      });

      if (error) {
        return { data: [], error };
      }

      // Group by player and aggregate
      const playerMap = new Map();
      
      gameStats.forEach(game => {
        const playerId = game.player_id;
        if (!playerMap.has(playerId)) {
          playerMap.set(playerId, {
            player_id: playerId,
            player_name: game.player_name,
            position: game.position,
            sport: game.sport,
            team: game.team,
            games: [],
            total_fantasy_points: 0,
            total_dk_points: 0,
            total_fd_points: 0,
            total_yahoo_points: 0
          });
        }
        
        const player = playerMap.get(playerId);
        player.games.push(game);
        player.total_fantasy_points += game.fantasy_points || 0;
        player.total_dk_points += game.dk_points || 0;
        player.total_fd_points += game.fd_points || 0;
        player.total_yahoo_points += game.yahoo_points || 0;
      });

      // Calculate averages and filter by minimum games
      const topPerformers = Array.from(playerMap.values())
        .filter(player => player.games.length >= (options.min_games || 1))
        .map(player => ({
          ...player,
          game_count: player.games.length,
          avg_fantasy_points: Number((player.total_fantasy_points / player.games.length).toFixed(2)),
          avg_dk_points: Number((player.total_dk_points / player.games.length).toFixed(2)),
          avg_fd_points: Number((player.total_fd_points / player.games.length).toFixed(2)),
          avg_yahoo_points: Number((player.total_yahoo_points / player.games.length).toFixed(2)),
          recent_games: player.games.slice(0, 3)
        }))
        .sort((a, b) => b.avg_fantasy_points - a.avg_fantasy_points)
        .slice(0, options.limit || 50);

      return { data: topPerformers, error: null };

    } catch (error) {
      logger.error('Error getting top performers:', error);
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Unknown error in top performers'
      };
    }
  }
}

// Export singleton instance
export const gameStatsService = new GameStatsService();
export default gameStatsService;