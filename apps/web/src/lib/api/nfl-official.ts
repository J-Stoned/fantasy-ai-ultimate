/**
 * NFL Official Data API
 * 
 * Free access to official NFL data - no API key required!
 * Uses the same endpoints that power NFL.com
 */

import { redis } from '@/lib/redis';

const NFL_BASE_URL = 'https://www.nfl.com/feeds-rs';
const CACHE_TTL = 300; // 5 minute cache

export interface NFLGame {
  gameId: string;
  gameDate: string;
  gameTimeEastern: string;
  week: number;
  gameType: string;
  homeTeam: {
    teamId: string;
    abbreviation: string;
    fullName: string;
    nickName: string;
    score?: number;
  };
  awayTeam: {
    teamId: string;
    abbreviation: string;
    fullName: string;
    nickName: string;
    score?: number;
  };
  phase: string;
  gameStatus: string;
}

export interface NFLBoxScore {
  gameId: string;
  homeTeam: {
    teamId: string;
    statistics: {
      passing: {
        completions: number;
        attempts: number;
        yards: number;
        touchdowns: number;
        interceptions: number;
      };
      rushing: {
        attempts: number;
        yards: number;
        touchdowns: number;
      };
      receiving: {
        receptions: number;
        yards: number;
        touchdowns: number;
      };
    };
    players: NFLPlayerStats[];
  };
  awayTeam: {
    teamId: string;
    statistics: any;
    players: NFLPlayerStats[];
  };
}

export interface NFLPlayerStats {
  playerId: string;
  playerName: string;
  position: string;
  passing?: {
    completions: number;
    attempts: number;
    yards: number;
    touchdowns: number;
    interceptions: number;
    rating: number;
  };
  rushing?: {
    attempts: number;
    yards: number;
    average: number;
    touchdowns: number;
    long: number;
  };
  receiving?: {
    receptions: number;
    yards: number;
    average: number;
    touchdowns: number;
    long: number;
    targets: number;
  };
  defense?: {
    tackles: number;
    assists: number;
    sacks: number;
    interceptions: number;
    forcedFumbles: number;
  };
}

export interface NFLPlayer {
  playerId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: string;
  status: string;
  height: string;
  weight: number;
  birthDate: string;
  college: string;
  experience: number;
  profilePicture?: string;
}

export class NFLOfficialAPI {
  private async fetchWithCache(endpoint: string): Promise<any> {
    const cacheKey = `nfl:${endpoint}`;
    
    // Check cache
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from NFL
    const url = `${NFL_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FantasyAI/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`NFL API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache result
    if (redis && data) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
    }

    return data;
  }

  /**
   * Get current week's scores
   */
  async getCurrentScores(): Promise<NFLGame[]> {
    const data = await this.fetchWithCache('/scores/');
    return this.parseGames(data);
  }

  /**
   * Get scores for a specific week
   */
  async getWeekScores(year: number, week: number, seasonType: string = 'REG'): Promise<NFLGame[]> {
    const data = await this.fetchWithCache(`/scores/${year}/${seasonType}/${week}`);
    return this.parseGames(data);
  }

  /**
   * Get detailed box score for a game
   */
  async getBoxScore(gameId: string): Promise<NFLBoxScore> {
    const data = await this.fetchWithCache(`/boxscores/${gameId}`);
    return this.parseBoxScore(data);
  }

  /**
   * Get team roster
   */
  async getTeamRoster(teamAbbr: string): Promise<NFLPlayer[]> {
    const data = await this.fetchWithCache(`/teams/${teamAbbr}/roster`);
    return this.parseRoster(data);
  }

  /**
   * Get player details
   */
  async getPlayer(playerId: string): Promise<NFLPlayer | null> {
    try {
      const data = await this.fetchWithCache(`/players/${playerId}`);
      return this.parsePlayer(data);
    } catch (error) {
      console.error(`Error fetching player ${playerId}:`, error);
      return null;
    }
  }

  /**
   * Get live game updates
   */
  async getLiveGameData(gameId: string): Promise<any> {
    // This endpoint updates in real-time during games
    const data = await this.fetchWithCache(`/games/${gameId}/plays`);
    return data;
  }

  /**
   * Get team standings
   */
  async getStandings(year: number = new Date().getFullYear()): Promise<any> {
    const data = await this.fetchWithCache(`/standings/${year}`);
    return data;
  }

  /**
   * Parse games data
   */
  private parseGames(data: any): NFLGame[] {
    if (!data?.games) return [];

    return data.games.map((game: any) => ({
      gameId: game.gameId,
      gameDate: game.gameDate,
      gameTimeEastern: game.gameTimeEastern,
      week: game.week,
      gameType: game.gameType,
      homeTeam: {
        teamId: game.homeTeamId,
        abbreviation: game.homeTeamAbbr,
        fullName: game.homeTeamFullName,
        nickName: game.homeTeamNickName,
        score: game.homeTeamScore,
      },
      awayTeam: {
        teamId: game.awayTeamId,
        abbreviation: game.awayTeamAbbr,
        fullName: game.awayTeamFullName,
        nickName: game.awayTeamNickName,
        score: game.awayTeamScore,
      },
      phase: game.phase,
      gameStatus: game.gameStatus,
    }));
  }

  /**
   * Parse box score data
   */
  private parseBoxScore(data: any): NFLBoxScore {
    // Parse the complex box score structure
    // This will vary based on actual API response
    return {
      gameId: data.gameId,
      homeTeam: {
        teamId: data.homeTeam.teamId,
        statistics: data.homeTeam.statistics,
        players: this.parsePlayerStats(data.homeTeam.players),
      },
      awayTeam: {
        teamId: data.awayTeam.teamId,
        statistics: data.awayTeam.statistics,
        players: this.parsePlayerStats(data.awayTeam.players),
      },
    };
  }

  /**
   * Parse player stats from box score
   */
  private parsePlayerStats(players: any[]): NFLPlayerStats[] {
    if (!players) return [];

    return players.map(player => ({
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      passing: player.passing,
      rushing: player.rushing,
      receiving: player.receiving,
      defense: player.defense,
    }));
  }

  /**
   * Parse roster data
   */
  private parseRoster(data: any): NFLPlayer[] {
    if (!data?.players) return [];

    return data.players.map((player: any) => ({
      playerId: player.playerId,
      displayName: player.displayName,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      status: player.status,
      height: player.height,
      weight: player.weight,
      birthDate: player.birthDate,
      college: player.college,
      experience: player.experience,
      profilePicture: player.profilePicture,
    }));
  }

  /**
   * Parse player data
   */
  private parsePlayer(data: any): NFLPlayer {
    return {
      playerId: data.playerId,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      position: data.position,
      jerseyNumber: data.jerseyNumber,
      status: data.status,
      height: data.height,
      weight: data.weight,
      birthDate: data.birthDate,
      college: data.college,
      experience: data.experience,
      profilePicture: data.profilePicture,
    };
  }

  /**
   * Get injury report
   */
  async getInjuryReport(): Promise<any> {
    // NFL.com also provides injury data
    const data = await this.fetchWithCache('/injuries/');
    return data;
  }

  /**
   * Get transactions (trades, signings, etc.)
   */
  async getTransactions(): Promise<any> {
    const data = await this.fetchWithCache('/transactions/');
    return data;
  }

  /**
   * Fantasy-relevant helpers
   */
  
  /**
   * Get red zone stats for players
   */
  async getRedZoneStats(week?: number): Promise<any> {
    const endpoint = week ? `/stats/redzone/${week}` : '/stats/redzone/';
    const data = await this.fetchWithCache(endpoint);
    return data;
  }

  /**
   * Get target share data
   */
  async getTargetShare(teamAbbr: string): Promise<any> {
    const data = await this.fetchWithCache(`/stats/targets/${teamAbbr}`);
    return data;
  }

  /**
   * Get snap counts
   */
  async getSnapCounts(gameId: string): Promise<any> {
    const data = await this.fetchWithCache(`/stats/snaps/${gameId}`);
    return data;
  }
}

// Singleton instance
export const nflAPI = new NFLOfficialAPI();