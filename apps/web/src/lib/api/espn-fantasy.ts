/**
 * ESPN Fantasy Football API
 * 
 * Access ESPN's fantasy-specific endpoints - no API key required!
 * These are the same endpoints used by ESPN Fantasy app
 */

import { redis } from '@/lib/redis';

const ESPN_FANTASY_BASE = 'https://fantasy.espn.com/apis/v3/games/ffl';
const CACHE_TTL = 300; // 5 minute cache

export interface ESPNFantasyPlayer {
  id: number;
  fullName: string;
  proTeamId: number;
  defaultPositionId: number;
  stats?: {
    appliedTotal: number;
    appliedAverage: number;
    stats: Record<string, number>;
  };
  ownership?: {
    percentOwned: number;
    percentStarted: number;
    percentChange: number;
  };
  draftAuctionValue?: number;
  injured?: boolean;
  injuryStatus?: string;
}

export interface ESPNFantasyTeam {
  id: number;
  abbrev: string;
  location: string;
  nickname: string;
  logo?: string;
  record?: {
    overall: {
      wins: number;
      losses: number;
      ties: number;
    };
  };
}

export interface ESPNFantasyLeague {
  id: string;
  name: string;
  size: number;
  scoringPeriodId: number;
  seasonId: number;
  settings?: {
    scoringType: string;
    rosterSettings: any;
    scheduleSettings: any;
  };
}

export interface ESPNProjections {
  playerId: number;
  projectedStats: Record<string, number>;
  projectedPoints: number;
  confidence: number;
}

export interface ESPNPlayerNews {
  playerId: number;
  timestamp: string;
  headline: string;
  body: string;
  type: 'injury' | 'trade' | 'performance' | 'other';
}

export class ESPNFantasyAPI {
  /**
   * Fetch with caching
   */
  private async fetchWithCache(endpoint: string, params?: Record<string, any>): Promise<any> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    const cacheKey = `espn-fantasy:${endpoint}${queryString}`;
    
    // Check cache
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from ESPN
    const url = `${ESPN_FANTASY_BASE}${endpoint}${queryString}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FantasyAI/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`ESPN Fantasy API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache result
    if (redis && data) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get player rankings for current week
   */
  async getPlayerRankings(position?: string, scoringPeriodId?: number): Promise<ESPNFantasyPlayer[]> {
    const params: any = {
      view: 'kona_player_info',
    };
    
    if (position) params.position = position;
    if (scoringPeriodId) params.scoringPeriodId = scoringPeriodId;

    const data = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);
    return this.parsePlayerRankings(data);
  }

  /**
   * Get projections for players
   */
  async getProjections(playerIds: number[], week?: number): Promise<ESPNProjections[]> {
    const season = new Date().getFullYear();
    const params = {
      view: 'kona_playercard',
      scoringPeriodId: week || this.getCurrentWeek(),
    };

    const data = await this.fetchWithCache(`/seasons/${season}/players`, params);
    return this.parseProjections(data, playerIds);
  }

  /**
   * Get top available free agents
   */
  async getTopAvailablePlayers(size: number = 50): Promise<ESPNFantasyPlayer[]> {
    const params = {
      view: 'kona_player_info',
      filter: JSON.stringify({
        players: {
          filterStatus: {
            value: ['FREEAGENT', 'WAIVERS']
          },
          limit: size,
          sortPercOwned: {
            sortPriority: 1,
            sortAsc: false
          }
        }
      })
    };

    const data = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);
    return this.parsePlayers(data);
  }

  /**
   * Get trending players (most added/dropped)
   */
  async getTrendingPlayers(): Promise<{
    mostAdded: ESPNFantasyPlayer[];
    mostDropped: ESPNFantasyPlayer[];
  }> {
    const params = {
      view: 'kona_player_info',
      filter: JSON.stringify({
        players: {
          filterStatsForMostRecentScoringPeriod: {
            value: true
          },
          limit: 25,
          sortDraftPercentChange: {
            sortPriority: 1,
            sortAsc: false
          }
        }
      })
    };

    const added = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);
    
    // Get most dropped (reverse sort)
    params.filter = JSON.stringify({
      players: {
        filterStatsForMostRecentScoringPeriod: {
          value: true
        },
        limit: 25,
        sortDraftPercentChange: {
          sortPriority: 1,
          sortAsc: true
        }
      }
    });

    const dropped = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);

    return {
      mostAdded: this.parsePlayers(added),
      mostDropped: this.parsePlayers(dropped),
    };
  }

  /**
   * Get player news and updates
   */
  async getPlayerNews(playerId: number): Promise<ESPNPlayerNews[]> {
    const data = await this.fetchWithCache(`/news/players/${playerId}`);
    return this.parsePlayerNews(data);
  }

  /**
   * Get injury status for all players
   */
  async getInjuryReport(): Promise<ESPNFantasyPlayer[]> {
    const params = {
      view: 'kona_player_info',
      filter: JSON.stringify({
        players: {
          filterStatus: {
            value: ['INJURY']
          },
          limit: 200
        }
      })
    };

    const data = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);
    return this.parsePlayers(data);
  }

  /**
   * Get draft rankings and ADP (Average Draft Position)
   */
  async getDraftRankings(): Promise<any> {
    const params = {
      view: 'kona_player_info',
      filter: JSON.stringify({
        players: {
          filterSlotIds: {
            value: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 23]
          },
          limit: 300,
          sortDraftRanks: {
            sortPriority: 1,
            sortAsc: true,
            value: 'STANDARD'
          }
        }
      })
    };

    const data = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);
    return this.parseDraftRankings(data);
  }

  /**
   * Get matchup rankings (strength of schedule)
   */
  async getMatchupRankings(position: string): Promise<any> {
    const positionMap: Record<string, number> = {
      'QB': 0,
      'RB': 2,
      'WR': 4,
      'TE': 6,
      'K': 17,
      'DST': 16,
    };

    const params = {
      view: 'proTeamSchedules_wl',
    };

    const data = await this.fetchWithCache('/seasons/2024', params);
    return this.parseMatchupRankings(data, positionMap[position]);
  }

  /**
   * Get live scoring updates
   */
  async getLiveScoring(scoringPeriodId?: number): Promise<any> {
    const params = {
      view: 'mLiveScoring',
      scoringPeriodId: scoringPeriodId || this.getCurrentWeek(),
    };

    const data = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);
    return data;
  }

  /**
   * Get ROS (Rest of Season) rankings
   */
  async getRestOfSeasonRankings(position?: string): Promise<ESPNFantasyPlayer[]> {
    const params = {
      view: 'kona_player_info',
      filter: JSON.stringify({
        players: {
          filterRanksForSlotIds: {
            value: position ? [this.getPositionId(position)] : []
          },
          limit: 200,
          sortRanks: {
            sortPriority: 1,
            sortAsc: true,
            value: 'PPR'
          }
        }
      })
    };

    const data = await this.fetchWithCache('/seasons/2024/segments/0/leaguedefaults/3', params);
    return this.parsePlayers(data);
  }

  /**
   * Parse player rankings
   */
  private parsePlayerRankings(data: any): ESPNFantasyPlayer[] {
    if (!data?.players) return [];

    return data.players.map((player: any) => ({
      id: player.id,
      fullName: player.player.fullName,
      proTeamId: player.player.proTeamId,
      defaultPositionId: player.player.defaultPositionId,
      stats: player.player.stats?.[0],
      ownership: player.player.ownership,
      draftAuctionValue: player.player.draftRanksByRankType?.STANDARD?.auctionValue,
      injured: player.player.injured,
      injuryStatus: player.player.injuryStatus,
    }));
  }

  /**
   * Parse players
   */
  private parsePlayers(data: any): ESPNFantasyPlayer[] {
    if (!data?.players) return [];

    return data.players.map((playerData: any) => {
      const player = playerData.player || playerData;
      return {
        id: player.id,
        fullName: player.fullName,
        proTeamId: player.proTeamId,
        defaultPositionId: player.defaultPositionId,
        stats: player.stats?.[0],
        ownership: player.ownership,
        draftAuctionValue: player.draftRanksByRankType?.STANDARD?.auctionValue,
        injured: player.injured,
        injuryStatus: player.injuryStatus,
      };
    });
  }

  /**
   * Parse projections
   */
  private parseProjections(data: any, playerIds: number[]): ESPNProjections[] {
    if (!data?.players) return [];

    return data.players
      .filter((p: any) => playerIds.includes(p.id))
      .map((player: any) => ({
        playerId: player.id,
        projectedStats: player.player.stats?.[0]?.stats || {},
        projectedPoints: player.player.stats?.[0]?.appliedTotal || 0,
        confidence: 0.75, // ESPN doesn't provide confidence scores
      }));
  }

  /**
   * Parse player news
   */
  private parsePlayerNews(data: any): ESPNPlayerNews[] {
    if (!data?.news) return [];

    return data.news.map((item: any) => ({
      playerId: item.playerId,
      timestamp: item.published,
      headline: item.headline,
      body: item.story,
      type: this.categorizeNews(item.headline + ' ' + item.story),
    }));
  }

  /**
   * Parse draft rankings
   */
  private parseDraftRankings(data: any): any {
    if (!data?.players) return [];

    return data.players.map((playerData: any) => {
      const player = playerData.player;
      return {
        id: player.id,
        fullName: player.fullName,
        position: this.getPositionName(player.defaultPositionId),
        team: player.proTeamId,
        draftRank: player.draftRanksByRankType?.STANDARD?.rank,
        auctionValue: player.draftRanksByRankType?.STANDARD?.auctionValue,
        adp: player.ownership?.averageDraftPosition,
      };
    }).sort((a: any, b: any) => a.draftRank - b.draftRank);
  }

  /**
   * Parse matchup rankings
   */
  private parseMatchupRankings(data: any, positionId: number): any {
    // Complex parsing for strength of schedule
    // Would need actual API response structure
    return data;
  }

  /**
   * Helper: Get current NFL week
   */
  private getCurrentWeek(): number {
    // Simplified - would need actual NFL calendar
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // Sept 1
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(1, weeksSinceStart), 18);
  }

  /**
   * Helper: Get position ID
   */
  private getPositionId(position: string): number {
    const positionMap: Record<string, number> = {
      'QB': 0,
      'RB': 2,
      'WR': 4,
      'TE': 6,
      'FLEX': 23,
      'K': 17,
      'DST': 16,
    };
    return positionMap[position] || 0;
  }

  /**
   * Helper: Get position name
   */
  private getPositionName(positionId: number): string {
    const positions: Record<number, string> = {
      0: 'QB',
      1: 'TQB',
      2: 'RB',
      3: 'RB/WR',
      4: 'WR',
      5: 'WR/TE',
      6: 'TE',
      17: 'K',
      16: 'D/ST',
      23: 'FLEX',
    };
    return positions[positionId] || 'Unknown';
  }

  /**
   * Helper: Categorize news
   */
  private categorizeNews(text: string): ESPNPlayerNews['type'] {
    const lower = text.toLowerCase();
    if (lower.includes('injur') || lower.includes('hurt') || lower.includes('questionable')) {
      return 'injury';
    }
    if (lower.includes('trade') || lower.includes('deal') || lower.includes('acquire')) {
      return 'trade';
    }
    if (lower.includes('touchdown') || lower.includes('yards') || lower.includes('performance')) {
      return 'performance';
    }
    return 'other';
  }
}

// Singleton instance
export const espnFantasyAPI = new ESPNFantasyAPI();