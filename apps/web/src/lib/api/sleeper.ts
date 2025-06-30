/**
 * Sleeper API Client
 * 
 * Free API for fantasy football data
 * No API key required!
 */

import { redis } from '@/lib/redis';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const CACHE_TTL = 300; // 5 minute cache

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  number: number;
  status: string;
  injury_status?: string;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  sport: string;
  season: string;
  season_type: string;
  total_rosters: number;
  status: string;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  starters: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
  };
}

export class SleeperAPI {
  private async fetchWithCache<T>(url: string, cacheKey: string): Promise<T> {
    // Check cache first
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from Sleeper
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get all NFL players
   */
  async getNFLPlayers(): Promise<Record<string, SleeperPlayer>> {
    const url = `${SLEEPER_BASE_URL}/players/nfl`;
    return this.fetchWithCache<Record<string, SleeperPlayer>>(
      url,
      'sleeper:players:nfl'
    );
  }

  /**
   * Get trending players
   */
  async getTrendingPlayers(type: 'add' | 'drop' = 'add', limit = 25): Promise<any[]> {
    const url = `${SLEEPER_BASE_URL}/players/nfl/trending/${type}?limit=${limit}`;
    return this.fetchWithCache<any[]>(
      url,
      `sleeper:trending:${type}:${limit}`
    );
  }

  /**
   * Get user by username
   */
  async getUser(username: string): Promise<any> {
    const url = `${SLEEPER_BASE_URL}/user/${username}`;
    return this.fetchWithCache<any>(
      url,
      `sleeper:user:${username}`
    );
  }

  /**
   * Get user leagues for a season
   */
  async getUserLeagues(userId: string, sport: string, season: string): Promise<SleeperLeague[]> {
    const url = `${SLEEPER_BASE_URL}/user/${userId}/leagues/${sport}/${season}`;
    return this.fetchWithCache<SleeperLeague[]>(
      url,
      `sleeper:leagues:${userId}:${sport}:${season}`
    );
  }

  /**
   * Get league details
   */
  async getLeague(leagueId: string): Promise<SleeperLeague> {
    const url = `${SLEEPER_BASE_URL}/league/${leagueId}`;
    return this.fetchWithCache<SleeperLeague>(
      url,
      `sleeper:league:${leagueId}`
    );
  }

  /**
   * Get league rosters
   */
  async getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
    const url = `${SLEEPER_BASE_URL}/league/${leagueId}/rosters`;
    return this.fetchWithCache<SleeperRoster[]>(
      url,
      `sleeper:rosters:${leagueId}`
    );
  }

  /**
   * Get league users
   */
  async getLeagueUsers(leagueId: string): Promise<any[]> {
    const url = `${SLEEPER_BASE_URL}/league/${leagueId}/users`;
    return this.fetchWithCache<any[]>(
      url,
      `sleeper:users:${leagueId}`
    );
  }

  /**
   * Get matchups for a week
   */
  async getMatchups(leagueId: string, week: number): Promise<any[]> {
    const url = `${SLEEPER_BASE_URL}/league/${leagueId}/matchups/${week}`;
    return this.fetchWithCache<any[]>(
      url,
      `sleeper:matchups:${leagueId}:${week}`
    );
  }

  /**
   * Get transactions
   */
  async getTransactions(leagueId: string, week: number): Promise<any[]> {
    const url = `${SLEEPER_BASE_URL}/league/${leagueId}/transactions/${week}`;
    return this.fetchWithCache<any[]>(
      url,
      `sleeper:transactions:${leagueId}:${week}`
    );
  }

  /**
   * Get NFL state (current week, season, etc)
   */
  async getNFLState(): Promise<any> {
    const url = `${SLEEPER_BASE_URL}/state/nfl`;
    return this.fetchWithCache<any>(
      url,
      'sleeper:state:nfl'
    );
  }
}

// Singleton instance
export const sleeperAPI = new SleeperAPI();