import { createClient } from '@supabase/supabase-js';

export class BatchQueryService {
  private supabase: ReturnType<typeof createClient>;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  
  /**
   * Get stats for multiple players in a single query
   * Eliminates N+1 query problem
   */
  async getBatchPlayerStats(
    playerIds: string[], 
    limit: number = 5
  ): Promise<Map<string, any[]>> {
    if (playerIds.length === 0) return new Map();
    
    // Single query to get all stats
    const { data: allStats, error } = await this.supabase
      .from('player_stats')
      .select(`
        *,
        game:games!inner(
          game_date,
          home_team:teams!games_home_team_id_fkey(abbreviation),
          away_team:teams!games_away_team_id_fkey(abbreviation)
        )
      `)
      .in('player_id', playerIds)
      .order('game.game_date', { ascending: false })
      .limit(limit * playerIds.length);
    
    if (error) throw error;
    
    // Group by player_id
    const statsByPlayer = new Map<string, any[]>();
    
    for (const playerId of playerIds) {
      const playerStats = allStats
        ?.filter(stat => stat.player_id === playerId)
        .slice(0, limit) || [];
      statsByPlayer.set(playerId, playerStats);
    }
    
    return statsByPlayer;
  }
  
  /**
   * Get projections for multiple players in a single query
   */
  async getBatchPlayerProjections(
    playerIds: string[],
    week?: number,
    season?: number
  ): Promise<Map<string, any>> {
    if (playerIds.length === 0) return new Map();
    
    const query = this.supabase
      .from('player_projections')
      .select('*')
      .in('player_id', playerIds);
    
    if (week) query.eq('week', week);
    if (season) query.eq('season', season);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Convert to Map for O(1) lookup
    const projectionsByPlayer = new Map<string, any>();
    data?.forEach(proj => {
      projectionsByPlayer.set(proj.player_id, proj);
    });
    
    return projectionsByPlayer;
  }
  
  /**
   * Get injuries for multiple players in a single query
   */
  async getBatchPlayerInjuries(
    playerIds: string[]
  ): Promise<Map<string, any[]>> {
    if (playerIds.length === 0) return new Map();
    
    const { data, error } = await this.supabase
      .from('player_injuries')
      .select('*')
      .in('player_id', playerIds)
      .eq('is_active', true)
      .order('injury_date', { ascending: false });
    
    if (error) throw error;
    
    // Group by player_id
    const injuriesByPlayer = new Map<string, any[]>();
    
    playerIds.forEach(playerId => {
      const playerInjuries = data?.filter(inj => inj.player_id === playerId) || [];
      injuriesByPlayer.set(playerId, playerInjuries);
    });
    
    return injuriesByPlayer;
  }
  
  /**
   * Get complete player data with stats, projections, and injuries in minimal queries
   */
  async getBatchPlayerData(
    playerIds: string[],
    options: {
      includeStats?: boolean;
      statsLimit?: number;
      includeProjections?: boolean;
      includeInjuries?: boolean;
      week?: number;
      season?: number;
    } = {}
  ) {
    const {
      includeStats = true,
      statsLimit = 5,
      includeProjections = true,
      includeInjuries = true,
      week,
      season
    } = options;
    
    // Execute all queries in parallel
    const promises: Promise<any>[] = [];
    
    // Base player data
    promises.push(
      this.supabase
        .from('players')
        .select(`
          *,
          current_team:teams(id, name, abbreviation)
        `)
        .in('id', playerIds)
    );
    
    // Optional data based on flags
    if (includeStats) {
      promises.push(this.getBatchPlayerStats(playerIds, statsLimit));
    }
    
    if (includeProjections) {
      promises.push(this.getBatchPlayerProjections(playerIds, week, season));
    }
    
    if (includeInjuries) {
      promises.push(this.getBatchPlayerInjuries(playerIds));
    }
    
    // Execute all queries in parallel
    const results = await Promise.all(promises);
    
    let index = 0;
    const playersResult = results[index++];
    const statsMap = includeStats ? results[index++] : null;
    const projectionsMap = includeProjections ? results[index++] : null;
    const injuriesMap = includeInjuries ? results[index++] : null;
    
    if (playersResult.error) throw playersResult.error;
    
    // Combine all data
    const enrichedPlayers = playersResult.data?.map(player => ({
      ...player,
      stats: statsMap?.get(player.id) || [],
      projection: projectionsMap?.get(player.id) || null,
      injuries: injuriesMap?.get(player.id) || []
    })) || [];
    
    return enrichedPlayers;
  }
  
  /**
   * Batch update multiple records efficiently
   */
  async batchUpdate<T extends { id: string }>(
    table: string,
    updates: T[]
  ): Promise<void> {
    if (updates.length === 0) return;
    
    // Supabase doesn't support bulk updates natively,
    // so we use a transaction-like approach
    const promises = updates.map(update => 
      this.supabase
        .from(table)
        .update(update)
        .eq('id', update.id)
    );
    
    const results = await Promise.all(promises);
    
    // Check for any errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      throw new Error(`Batch update failed: ${errors.map(e => e.error?.message).join(', ')}`);
    }
  }
}