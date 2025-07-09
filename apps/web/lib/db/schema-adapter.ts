/**
 * Schema Adapter Layer
 * 
 * Provides a unified interface for working with both simple and complex schemas
 * Handles the transition period while we migrate to the full complex schema
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to ensure env vars are loaded
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and key must be provided via environment variables');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

export interface PlayerData {
  id?: number;
  external_id?: string;
  name: string;
  position?: string;
  team?: string;
  sport?: string;
  jersey_number?: string;
  metadata?: Record<string, any>;
}

export interface GameData {
  id?: number;
  external_id?: string;
  home_team_id?: number;
  away_team_id?: number;
  home_team?: string;
  away_team?: string;
  home_score?: number;
  away_score?: number;
  game_date?: string;
  sport?: string;
  status?: string;
  venue?: string;
  attendance?: number;
  metadata?: Record<string, any>;
}

export interface PlayerStatsData {
  player_id: number;
  game_id?: number;
  stat_type?: string;
  stat_value?: number;
  stats?: Record<string, any>;
  fantasy_points?: number;
  season?: number;
  game_date?: string;
}

export class SchemaAdapter {
  /**
   * Get or create a player with external ID mapping
   */
  async upsertPlayer(data: PlayerData, platform?: string): Promise<number | null> {
    try {
      // If we have an external_id, check if player exists
      if (data.external_id) {
        const existing = await this.findPlayerByExternalId(data.external_id);
        if (existing) return existing.id;
      }
      
      // Prepare player data for simple schema
      // Split name into firstname/lastname
      const nameParts = data.name.split(' ');
      const firstname = nameParts[0] || '';
      const lastname = nameParts.slice(1).join(' ') || '';
      
      const playerData: any = {
        firstname: firstname,
        lastname: lastname,
        position: data.position ? [data.position] : ['Unknown'], // position is an array
        team: data.team || 'Free Agent',
        sport: data.sport || 'football',
        sport_id: this.getSportId(data.sport)
      };
      
      // Add jersey number if provided
      if (data.jersey_number) {
        playerData.jersey_number = data.jersey_number;
      }
      
      // If external_id column exists, use it
      if (data.external_id) {
        playerData.external_id = data.external_id;
      }
      
      // Upsert player
      const { data: player, error } = await getSupabase()
        .from('players')
        .upsert(playerData, { 
          onConflict: data.external_id ? 'external_id' : 'firstname,lastname',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error || !player) {
        console.error('Player upsert error:', error);
        return null;
      }
      
      // Store platform mapping if provided
      if (platform && data.external_id) {
        await this.storePlatformMapping(player.id, platform, data.external_id, data.metadata);
      }
      
      return player.id;
    } catch (error) {
      console.error('Error in upsertPlayer:', error);
      return null;
    }
  }

  /**
   * Find player by external ID
   */
  async findPlayerByExternalId(externalId: string): Promise<{ id: number } | null> {
    // First try direct external_id column
    const { data, error } = await getSupabase()
      .from('players')
      .select('id')
      .eq('external_id', externalId)
      .single();
    
    if (data) return data;
    
    // Fall back to platform mapping table if it exists
    try {
      const { data: mapping } = await getSupabase()
        .from('player_platform_mapping')
        .select('player_id')
        .eq('platform_player_id', externalId)
        .single();
      
      if (mapping) return { id: mapping.player_id };
    } catch (e) {
      // Table might not exist yet
    }
    
    return null;
  }

  /**
   * Store platform-specific player mapping
   */
  async storePlatformMapping(
    playerId: number, 
    platform: string, 
    platformId: string, 
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await getSupabase()
        .from('player_platform_mapping')
        .upsert({
          player_id: playerId,
          platform: platform,
          platform_player_id: platformId,
          platform_data: metadata || {},
          confidence_score: 1.0,
          verified: true
        }, {
          onConflict: 'platform,platform_player_id'
        });
    } catch (e) {
      // Table might not exist yet, ignore
    }
  }

  /**
   * Get or create a game
   */
  async upsertGame(data: GameData): Promise<number | null> {
    try {
      // If we have an external_id, check if game exists
      if (data.external_id) {
        const { data: existing } = await getSupabase()
          .from('games')
          .select('id')
          .eq('external_id', data.external_id)
          .single();
        
        if (existing) return existing.id;
      }
      
      // Need to resolve team IDs if we have team names
      let home_team_id = data.home_team_id;
      let away_team_id = data.away_team_id;
      
      if (!home_team_id && data.home_team) {
        const { data: homeTeam } = await getSupabase()
          .from('teams')
          .select('id')
          .eq('name', data.home_team)
          .single();
        
        home_team_id = homeTeam?.id;
      }
      
      if (!away_team_id && data.away_team) {
        const { data: awayTeam } = await getSupabase()
          .from('teams')
          .select('id')
          .eq('name', data.away_team)
          .single();
        
        away_team_id = awayTeam?.id;
      }
      
      // Prepare game data
      const gameData: any = {
        home_team_id,
        away_team_id,
        home_score: data.home_score,
        away_score: data.away_score,
        start_time: data.game_date,
        sport_id: data.sport || 'nfl',
        status: data.status || 'completed'
      };
      
      if (data.external_id) {
        gameData.external_id = data.external_id;
      }
      
      const { data: game, error } = await getSupabase()
        .from('games')
        .upsert(gameData, {
          onConflict: data.external_id ? 'external_id' : undefined
        })
        .select()
        .single();
      
      if (error || !game) {
        console.error('Game upsert error:', error);
        return null;
      }
      
      return game.id;
    } catch (error) {
      console.error('Error in upsertGame:', error);
      return null;
    }
  }

  /**
   * Store player stats - handles both old and new schema
   */
  async upsertPlayerStats(data: PlayerStatsData): Promise<boolean> {
    try {
      // Check if we should use new game logs table
      const useGameLogs = await this.checkTableExists('player_game_logs');
      
      if (useGameLogs && data.game_id && data.stats) {
        // Use new schema
        const { error } = await getSupabase()
          .from('player_game_logs')
          .upsert({
            player_id: data.player_id,
            game_id: data.game_id,
            game_date: data.game_date || new Date().toISOString(),
            stats: data.stats,
            fantasy_points: data.fantasy_points || 0
          }, {
            onConflict: 'player_id,game_id'
          });
        
        return !error;
      } else {
        // Use old schema - need to break down stats into stat_type/stat_value pairs
        if (data.stats) {
          const inserts = Object.entries(data.stats).map(([type, value]) => ({
            player_id: data.player_id,
            game_id: data.game_id,
            stat_type: type,
            stat_value: Number(value),
            fantasy_points: data.fantasy_points
          }));
          
          const { error } = await getSupabase()
            .from('player_stats')
            .upsert(inserts, {
              onConflict: 'player_id,game_id,stat_type'
            });
          
          return !error;
        } else if (data.stat_type && data.stat_value !== undefined) {
          // Single stat entry
          const { error } = await getSupabase()
            .from('player_stats')
            .upsert({
              player_id: data.player_id,
              game_id: data.game_id,
              stat_type: data.stat_type,
              stat_value: data.stat_value,
              fantasy_points: data.fantasy_points
            }, {
              onConflict: 'player_id,game_id,stat_type'
            });
          
          return !error;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error in upsertPlayerStats:', error);
      return false;
    }
  }

  /**
   * Get player stats for ML training - unified interface
   */
  async getPlayerStatsForGame(playerId: number, gameId: number): Promise<Record<string, number>> {
    // Try new schema first
    const { data: gameLogs } = await getSupabase()
      .from('player_game_logs')
      .select('stats')
      .eq('player_id', playerId)
      .eq('game_id', gameId)
      .single();
    
    if (gameLogs?.stats) {
      return gameLogs.stats;
    }
    
    // Fall back to old schema
    const { data: oldStats } = await getSupabase()
      .from('player_stats')
      .select('stat_type, stat_value')
      .eq('player_id', playerId)
      .eq('game_id', gameId);
    
    if (oldStats) {
      const stats: Record<string, number> = {};
      oldStats.forEach(stat => {
        stats[stat.stat_type] = stat.stat_value;
      });
      return stats;
    }
    
    return {};
  }

  /**
   * Check if a table exists
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const { error } = await getSupabase()
        .from(tableName)
        .select('*')
        .limit(0);
      
      return !error;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get team by name or ID
   */
  async getTeam(nameOrId: string | number): Promise<{ id: number; name: string } | null> {
    if (typeof nameOrId === 'number') {
      const { data } = await getSupabase()
        .from('teams')
        .select('id, name')
        .eq('id', nameOrId)
        .single();
      
      return data;
    } else {
      const { data } = await getSupabase()
        .from('teams')
        .select('id, name')
        .eq('name', nameOrId)
        .single();
      
      return data;
    }
  }

  /**
   * Get sport ID from sport name
   */
  private getSportId(sport?: string): string {
    switch (sport?.toLowerCase()) {
      case 'football':
        return 'nfl';
      case 'basketball':
        return 'nba';
      case 'baseball':
        return 'mlb';
      case 'hockey':
        return 'nhl';
      default:
        return sport || 'nfl';
    }
  }
}

// Export singleton instance
export const schemaAdapter = new SchemaAdapter();