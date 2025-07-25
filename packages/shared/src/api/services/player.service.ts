import { ApiClient } from '../client';
import { ApiResponse } from '../../types/api';
import { Player, PlayerStats, PlayerProjection, PlayerValue, PlayerNews } from '../../types/player';
import { PlayerAvatarProfile } from '../../types/avatar';

export class PlayerService {
  constructor(private apiClient: ApiClient) {}

  async getPlayer(playerId: string): Promise<ApiResponse<Player>> {
    return this.apiClient.get<Player>(`/players/${playerId}`);
  }

  async searchPlayers(query: string, sport?: string, limit = 20): Promise<ApiResponse<Player[]>> {
    return this.apiClient.get<Player[]>('/players/search', { 
      q: query, 
      sport,
      limit 
    });
  }

  async getPlayersByTeam(team: string, sport: string): Promise<ApiResponse<Player[]>> {
    return this.apiClient.get<Player[]>('/players', { team, sport });
  }

  async getStarPlayers(sport?: string): Promise<ApiResponse<Player[]>> {
    return this.apiClient.get<Player[]>('/players/stars', { 
      sport,
      minRating: 90 
    });
  }

  async getPlayerStats(playerId: string, season?: number, week?: number): Promise<ApiResponse<PlayerStats[]>> {
    return this.apiClient.get<PlayerStats[]>(`/players/${playerId}/stats`, {
      season,
      week
    });
  }

  async getPlayerProjections(playerId: string, week?: number): Promise<ApiResponse<PlayerProjection[]>> {
    return this.apiClient.get<PlayerProjection[]>(`/players/${playerId}/projections`, {
      week
    });
  }

  async getPlayerValue(playerId: string): Promise<ApiResponse<PlayerValue>> {
    return this.apiClient.get<PlayerValue>(`/players/${playerId}/value`);
  }

  async getPlayerNews(playerId: string, limit = 10): Promise<ApiResponse<PlayerNews[]>> {
    return this.apiClient.get<PlayerNews[]>(`/players/${playerId}/news`, {
      limit
    });
  }

  async getPlayerAvatar(playerId: string): Promise<ApiResponse<PlayerAvatarProfile>> {
    return this.apiClient.get<PlayerAvatarProfile>(`/players/${playerId}/avatar`);
  }

  async getTopPlayers(sport: string, position?: string, limit = 100): Promise<ApiResponse<Player[]>> {
    return this.apiClient.get<Player[]>('/players/top', {
      sport,
      position,
      limit
    });
  }

  async batchGetPlayers(playerIds: string[]): Promise<ApiResponse<Player[]>> {
    return this.apiClient.post<Player[]>('/players/batch', { playerIds });
  }
}