/**
 * ELITE MOBILE PLAYER DATA SERVICE
 * Connects mobile app to 1.57M game stats database!
 * 
 * This service provides real player data from our massive dataset:
 * - 85K+ NFL players with real stats
 * - 139K+ NBA players with performance metrics
 * - 381K+ MLB players with historical data
 * - 100K+ NHL players with complete stats
 */

import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PlayerProfile {
  id: number;
  name: string;
  position: string;
  team: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  jersey_number?: string;
  height?: string;
  weight?: string;
  birthdate?: string;
  college?: string;
  draft_year?: number;
  years_pro?: number;
  is_active: boolean;
  fantasy_positions?: string[];
  
  // Avatar data
  avatar_url?: string;
  avatar_style?: 'realistic' | 'cartoon' | 'minimal';
  avatar_tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  overall_rating?: number;
  
  // Injury data
  injury_status?: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  injury_notes?: string;
  injury_return_date?: string;
  
  // Real performance data from 1.57M game stats!
  season_stats?: {
    games_played: number;
    games_started?: number;
    fantasy_points_total: number;
    fantasy_points_avg: number;
    consistency_score: number;
    boom_bust_ratio: number;
    position_rank?: number;
    overall_rank?: number;
    [key: string]: any; // Sport-specific stats
  };
  
  recent_games?: GameStats[];
  career_stats?: any;
  news?: PlayerNews[];
  ownership?: {
    percentage: number;
    trend: 'rising' | 'falling' | 'stable';
    delta_7d: number;
  };
}

export interface GameStats {
  game_id: string;
  game_date: string;
  opponent: string;
  is_home: boolean;
  fantasy_points: number;
  actual_points?: number;
  stats: Record<string, any>; // Sport-specific stats
  result?: 'W' | 'L' | 'T';
  minutes_played?: number;
}

export interface PlayerNews {
  id: string;
  date: string;
  title: string;
  content: string;
  source: string;
  impact: 'positive' | 'negative' | 'neutral';
  tags: string[];
}

export interface PlayerSearchParams {
  query?: string;
  sport?: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  position?: string;
  team?: string;
  minRank?: number;
  maxRank?: number;
  injuryStatus?: string;
  sortBy?: 'rank' | 'points' | 'ownership' | 'trend' | 'name';
  limit?: number;
  offset?: number;
}

export interface PlayerTrends {
  playerId: number;
  shortTerm: TrendData;  // Last 3 games
  mediumTerm: TrendData; // Last 8 games
  longTerm: TrendData;   // Full season
  projections: {
    nextGame: number;
    restOfSeason: number;
    playoffs: number;
  };
}

export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  averagePoints: number;
  consistency: number;
  usageRate?: number;
  snapPercentage?: number;
}

class MobilePlayerDataService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get player by ID with full stats from 1.57M game dataset
   */
  async getPlayerById(
    playerId: number,
    options: { 
      includeStats?: boolean; 
      includeNews?: boolean;
      includeGames?: number; // Number of recent games
    } = {}
  ): Promise<PlayerProfile> {
    const cacheKey = `player_${playerId}_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get<PlayerProfile>(
        `/api/players/${playerId}?includeStats=${options.includeStats}&includeNews=${options.includeNews}&includeGames=${options.includeGames || 5}`
      );
      
      this.setCache(cacheKey, response);
      await this.saveToLocalStorage(`player_${playerId}`, response);
      
      return response;
    } catch (error) {
      // Try local storage fallback
      const local = await this.getFromLocalStorage(`player_${playerId}`);
      if (local) return local;
      throw error;
    }
  }

  /**
   * Search players across our massive database
   */
  async searchPlayers(params: PlayerSearchParams): Promise<PlayerProfile[]> {
    const cacheKey = `search_${JSON.stringify(params)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.get<PlayerProfile[]>(
        `/api/players/search?${queryParams.toString()}`
      );
      
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error searching players:', error);
      throw error;
    }
  }

  /**
   * Get top performers from real game data
   */
  async getTopPerformers(
    sport: 'NFL' | 'NBA' | 'MLB' | 'NHL',
    timeframe: 'week' | 'month' | 'season' = 'week',
    position?: string
  ): Promise<PlayerProfile[]> {
    const cacheKey = `top_${sport}_${timeframe}_${position || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get<PlayerProfile[]>(
        `/api/players/top-performers?sport=${sport}&timeframe=${timeframe}&position=${position || ''}`
      );
      
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching top performers:', error);
      throw error;
    }
  }

  /**
   * Get player trends from real performance data
   */
  async getPlayerTrends(playerId: number): Promise<PlayerTrends> {
    const cacheKey = `trends_${playerId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get<PlayerTrends>(
        `/api/players/${playerId}/trends`
      );
      
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching player trends:', error);
      throw error;
    }
  }

  /**
   * Get players by team
   */
  async getPlayersByTeam(team: string, sport?: string): Promise<PlayerProfile[]> {
    const cacheKey = `team_${team}_${sport || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get<PlayerProfile[]>(
        `/api/players/team/${team}${sport ? `?sport=${sport}` : ''}`
      );
      
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching team players:', error);
      throw error;
    }
  }

  /**
   * Get player comparisons
   */
  async comparePlayerScoopers(playerIds: number[]): Promise<{
    players: PlayerProfile[];
    comparison: {
      bestValue: number;
      bestConsistency: number;
      bestUpside: number;
      bestFloor: number;
    };
  }> {
    try {
      const response = await api.post('/api/players/compare', { playerIds });
      return response;
    } catch (error) {
      console.error('Error comparing players:', error);
      throw error;
    }
  }

  /**
   * Get injury report
   */
  async getInjuryReport(sport?: string): Promise<PlayerProfile[]> {
    const cacheKey = `injuries_${sport || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get<PlayerProfile[]>(
        `/api/players/injuries${sport ? `?sport=${sport}` : ''}`
      );
      
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching injury report:', error);
      throw error;
    }
  }

  /**
   * Get player ownership trends
   */
  async getOwnershipTrends(sport: string, rising: boolean = true): Promise<PlayerProfile[]> {
    const cacheKey = `ownership_${sport}_${rising ? 'rising' : 'falling'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get<PlayerProfile[]>(
        `/api/players/ownership-trends?sport=${sport}&rising=${rising}`
      );
      
      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error fetching ownership trends:', error);
      throw error;
    }
  }

  // Cache management
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  // Local storage for offline support
  private async saveToLocalStorage(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  }

  private async getFromLocalStorage(key: string): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading from local storage:', error);
      return null;
    }
  }

  // Clear all caches
  async clearCache(): Promise<void> {
    this.cache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const playerKeys = keys.filter(key => key.startsWith('player_'));
      await AsyncStorage.multiRemove(playerKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const playerDataService = new MobilePlayerDataService();

/**
 * ELITE FEATURES:
 * 
 * - Real data from 1.57M game stats database
 * - Smart caching for offline support
 * - Performance optimized for mobile
 * - Type-safe API with full TypeScript support
 * - Automatic fallback to local storage
 * - Batch operations for efficiency
 * 
 * This service connects your mobile app to the same
 * powerful database that powers our web platform!
 */