import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { calculateConsistencyScore } from '@/lib/utils/stats';

type Player = Database['public']['Tables']['players']['Row'];
type GameLog = Database['public']['Tables']['player_game_logs']['Row'];

export interface PlayerData {
  id: number;
  name: string;
  team: string;
  position: string;
  avatarUrl: string;
  status: 'active' | 'injured' | 'inactive';
  stats: {
    seasonAverage: number;
    last5Average: number;
    projectedPoints: number;
    consistency: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export class PlayerDataService {
  async searchPlayers(query: string, options: {
    sport?: string;
    position?: string;
    limit?: number;
  } = {}): Promise<{ data: PlayerData[] | null; error: string | null }> {
    try {
      let queryBuilder = supabase
        .from('players')
        .select(`
          *,
          teams (
            name,
            abbreviation,
            logo_url
          )
        `)
        .limit(options.limit || 20);

      // Search by name
      if (query) {
        queryBuilder = queryBuilder.or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`);
      }

      // Filter by position - handle array format
      if (options.position) {
        // Use contains for array positions
        queryBuilder = queryBuilder.contains('position', [options.position]);
      }

      const { data: players, error } = await queryBuilder;

      if (error) throw error;
      if (!players || players.length === 0) return { data: [], error: null };

      // Get recent game logs for each player
      const playerIds = players.map(p => p.id);
      const { data: gameLogs } = await supabase
        .from('player_game_logs')
        .select('*')
        .in('player_id', playerIds)
        .order('game_date', { ascending: false });

      const playerDataMap = new Map<number, PlayerData>();

      for (const player of players) {
        const playerLogs = gameLogs?.filter(log => log.player_id === player.id) || [];
        const recentLogs = playerLogs.slice(0, 10);
        
        // Extract position from array if needed
        const position = Array.isArray(player.position) ? player.position[0] : player.position;
        
        // Calculate stats
        const seasonAverage = this.calculateAverage(playerLogs);
        const last5Average = this.calculateAverage(recentLogs.slice(0, 5));
        const consistency = calculateConsistencyScore(recentLogs.map(log => log.fantasy_points || 0));
        const trend = this.calculateTrend(recentLogs);

        playerDataMap.set(player.id, {
          id: player.id,
          name: `${player.firstname} ${player.lastname}`.trim(),
          team: player.teams?.abbreviation || 'FA',
          position: position || 'UN',
          avatarUrl: player.avatar_url || '',
          status: player.injury_status === 'active' ? 'active' : 
                  player.injury_status === 'injured' ? 'injured' : 'inactive',
          stats: {
            seasonAverage,
            last5Average,
            projectedPoints: last5Average * 1.05, // Simple projection
            consistency,
            trend
          }
        });
      }

      return {
        data: Array.from(playerDataMap.values()),
        error: null
      };
    } catch (error) {
      console.error('Error searching players:', error);
      return { data: null, error: String(error) };
    }
  }

  async getPlayerById(playerId: number): Promise<{ data: PlayerData | null; error: string | null }> {
    try {
      const { data: player, error } = await supabase
        .from('players')
        .select(`
          *,
          teams (
            name,
            abbreviation,
            logo_url
          )
        `)
        .eq('id', playerId)
        .single();

      if (error) throw error;
      if (!player) return { data: null, error: 'Player not found' };

      // Get game logs
      const { data: gameLogs } = await supabase
        .from('player_game_logs')
        .select('*')
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(20);

      const logs = gameLogs || [];
      const recentLogs = logs.slice(0, 10);
      
      // Extract position from array if needed
      const position = Array.isArray(player.position) ? player.position[0] : player.position;

      return {
        data: {
          id: player.id,
          name: `${player.firstname} ${player.lastname}`.trim(),
          team: player.teams?.abbreviation || 'FA',
          position: position || 'UN',
          avatarUrl: player.avatar_url || '',
          status: player.injury_status === 'active' ? 'active' : 
                  player.injury_status === 'injured' ? 'injured' : 'inactive',
          stats: {
            seasonAverage: this.calculateAverage(logs),
            last5Average: this.calculateAverage(logs.slice(0, 5)),
            projectedPoints: this.calculateAverage(logs.slice(0, 5)) * 1.05,
            consistency: calculateConsistencyScore(recentLogs.map(log => log.fantasy_points || 0)),
            trend: this.calculateTrend(recentLogs)
          }
        },
        error: null
      };
    } catch (error) {
      console.error('Error getting player:', error);
      return { data: null, error: String(error) };
    }
  }

  async getTopPerformers(options: {
    sport?: string;
    position?: string;
    timeframe?: 'season' | 'week' | 'month';
    limit?: number;
  } = {}): Promise<{ data: PlayerData[] | null; error: string | null }> {
    try {
      // Get date range
      const now = new Date();
      let dateFrom = new Date();
      
      if (options.timeframe === 'week') {
        dateFrom.setDate(now.getDate() - 7);
      } else if (options.timeframe === 'month') {
        dateFrom.setMonth(now.getMonth() - 1);
      } else {
        dateFrom.setFullYear(now.getFullYear() - 1);
      }

      // Get top performing players by average fantasy points
      let query = supabase
        .from('player_game_logs')
        .select(`
          player_id,
          players!inner (
            id,
            firstname,
            lastname,
            position,
            avatar_url,
            injury_status,
            teams (
              name,
              abbreviation,
              logo_url
            )
          )
        `)
        .gte('game_date', dateFrom.toISOString())
        .limit(100);

      if (options.sport) {
        query = query.eq('metadata->>sport', options.sport);
      }

      const { data: logs, error } = await query;

      if (error) throw error;
      if (!logs) return { data: [], error: null };

      // Calculate averages for each player
      const playerStats = new Map<number, {
        player: any;
        totalPoints: number;
        gameCount: number;
        logs: any[];
      }>();

      for (const log of logs) {
        const playerId = log.player_id;
        const existing = playerStats.get(playerId);
        
        if (existing) {
          existing.totalPoints += log.fantasy_points || 0;
          existing.gameCount++;
          existing.logs.push(log);
        } else {
          playerStats.set(playerId, {
            player: log.players,
            totalPoints: log.fantasy_points || 0,
            gameCount: 1,
            logs: [log]
          });
        }
      }

      // Convert to PlayerData and sort
      const players: PlayerData[] = [];
      
      for (const [playerId, stats] of playerStats) {
        const player = stats.player;
        const position = Array.isArray(player.position) ? player.position[0] : player.position;
        
        // Filter by position if specified
        if (options.position && position !== options.position) continue;
        
        const average = stats.totalPoints / stats.gameCount;
        const recentLogs = stats.logs.slice(0, 5);
        
        players.push({
          id: player.id,
          name: `${player.firstname} ${player.lastname}`.trim(),
          team: player.teams?.abbreviation || 'FA',
          position: position || 'UN',
          avatarUrl: player.avatar_url || '',
          status: player.injury_status === 'active' ? 'active' : 
                  player.injury_status === 'injured' ? 'injured' : 'inactive',
          stats: {
            seasonAverage: average,
            last5Average: this.calculateAverage(recentLogs),
            projectedPoints: average * 1.05,
            consistency: calculateConsistencyScore(stats.logs.map(log => log.fantasy_points || 0)),
            trend: this.calculateTrend(recentLogs)
          }
        });
      }

      // Sort by average and limit
      players.sort((a, b) => b.stats.seasonAverage - a.stats.seasonAverage);
      
      return {
        data: players.slice(0, options.limit || 20),
        error: null
      };
    } catch (error) {
      console.error('Error getting top performers:', error);
      return { data: null, error: String(error) };
    }
  }

  private calculateAverage(logs: any[]): number {
    if (!logs || logs.length === 0) return 0;
    const sum = logs.reduce((acc, log) => acc + (log.fantasy_points || 0), 0);
    return sum / logs.length;
  }

  private calculateTrend(logs: any[]): 'up' | 'down' | 'stable' {
    if (!logs || logs.length < 3) return 'stable';
    
    const recent = logs.slice(0, 3).reduce((sum, log) => sum + (log.fantasy_points || 0), 0) / 3;
    const older = logs.slice(3, 6).reduce((sum, log) => sum + (log.fantasy_points || 0), 0) / 3;
    
    if (recent > older * 1.1) return 'up';
    if (recent < older * 0.9) return 'down';
    return 'stable';
  }
}

export const playerDataService = new PlayerDataService();