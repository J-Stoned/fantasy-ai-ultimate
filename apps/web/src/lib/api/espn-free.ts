/**
 * ESPN FREE API Integration
 * 
 * Uses ESPN's hidden/internal APIs that are publicly accessible
 * No API key required! 
 */

import { redis } from '@/lib/redis';
import { Player } from '@/types/player';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';
const CACHE_TTL = 60; // 1 minute cache for live data

export interface ESPNPlayer {
  id: string;
  displayName: string;
  position: {
    abbreviation: string;
  };
  team?: {
    id: string;
    abbreviation: string;
    displayName: string;
  };
  statistics?: {
    name: string;
    value: number;
  }[];
}

export interface ESPNTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  logo: string;
  record?: {
    items: {
      summary: string;
    }[];
  };
}

export interface ESPNGame {
  id: string;
  date: string;
  status: {
    type: {
      description: string;
      state: string;
    };
  };
  competitions: {
    competitors: {
      team: ESPNTeam;
      score: string;
      homeAway: string;
    }[];
  }[];
}

export class ESPNFreeAPI {
  private async fetchWithCache<T>(url: string, cacheKey: string): Promise<T> {
    // Check cache first
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from ESPN
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FantasyAI/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get current NFL scoreboard
   */
  async getNFLScoreboard() {
    const url = `${ESPN_BASE_URL}/football/nfl/scoreboard`;
    return this.fetchWithCache<any>(url, 'espn:nfl:scoreboard');
  }

  /**
   * Get NBA scoreboard
   */
  async getNBAScoreboard() {
    const url = `${ESPN_BASE_URL}/basketball/nba/scoreboard`;
    return this.fetchWithCache<any>(url, 'espn:nba:scoreboard');
  }

  /**
   * Get NFL news
   */
  async getNFLNews(limit = 10) {
    const url = `${ESPN_BASE_URL}/football/nfl/news?limit=${limit}`;
    return this.fetchWithCache<any>(url, `espn:nfl:news:${limit}`);
  }

  /**
   * Get team roster
   */
  async getTeamRoster(sport: string, league: string, teamId: string) {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/teams/${teamId}/roster`;
    return this.fetchWithCache<any>(
      url,
      `espn:${sport}:${league}:roster:${teamId}`
    );
  }

  /**
   * Get player info
   */
  async getPlayer(sport: string, league: string, playerId: string) {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/athletes/${playerId}`;
    return this.fetchWithCache<any>(
      url,
      `espn:${sport}:${league}:player:${playerId}`
    );
  }

  /**
   * Get team schedule
   */
  async getTeamSchedule(sport: string, league: string, teamId: string) {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/teams/${teamId}/schedule`;
    return this.fetchWithCache<any>(
      url,
      `espn:${sport}:${league}:schedule:${teamId}`
    );
  }

  /**
   * Get league standings
   */
  async getStandings(sport: string, league: string) {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/standings`;
    return this.fetchWithCache<any>(
      url,
      `espn:${sport}:${league}:standings`
    );
  }

  /**
   * Get injuries
   */
  async getInjuries(sport: string, league: string) {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/injuries`;
    return this.fetchWithCache<any>(
      url,
      `espn:${sport}:${league}:injuries`
    );
  }

  /**
   * Search for teams
   */
  async searchTeams(sport: string, league: string, query: string) {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/teams?limit=50`;
    const data = await this.fetchWithCache<any>(
      url,
      `espn:${sport}:${league}:teams`
    );
    
    // Filter by query
    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      const teams = data.sports[0].leagues[0].teams;
      return teams.filter((team: any) => 
        team.team.displayName.toLowerCase().includes(query.toLowerCase()) ||
        team.team.abbreviation.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return [];
  }

  /**
   * Get live game updates
   */
  async getGameDetail(sport: string, league: string, gameId: string) {
    const url = `${ESPN_BASE_URL}/${sport}/${league}/summary?event=${gameId}`;
    return this.fetchWithCache<any>(
      url,
      `espn:${sport}:${league}:game:${gameId}`
    );
  }
}

// Singleton instance
export const espnAPI = new ESPNFreeAPI();

// Helper to map ESPN players to our schema
export function mapESPNPlayer(espnPlayer: any): Partial<Player> {
  return {
    espn_id: espnPlayer.id,
    name: espnPlayer.displayName,
    position: espnPlayer.position?.abbreviation,
    team: espnPlayer.team?.abbreviation,
    jersey_number: espnPlayer.jersey,
    height: espnPlayer.height,
    weight: espnPlayer.weight,
    age: espnPlayer.age,
    headshot_url: espnPlayer.headshot?.href,
    status: espnPlayer.injuries?.[0]?.status || 'ACTIVE',
  };
}

// Helper to extract stats
export function extractESPNStats(stats: any[]): Record<string, number> {
  const result: Record<string, number> = {};
  
  stats?.forEach(stat => {
    const key = stat.name.toLowerCase().replace(/\s+/g, '_');
    result[key] = parseFloat(stat.value) || 0;
  });
  
  return result;
}