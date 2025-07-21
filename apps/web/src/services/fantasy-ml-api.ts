/**
 * 🚀 Fantasy ML API Client
 * Connects web UI to ML predictions and optimization
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_FANTASY_API_URL || 'http://localhost:3338';

export interface PlayerPrediction {
  player_id: string;
  player_name: string;
  predicted_points: number;
  floor: number;
  ceiling: number;
  confidence: number;
  boom_probability: number;
  bust_probability: number;
}

export interface DFSPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projected_points: number;
  projected_ownership: number;
  floor: number;
  ceiling: number;
  boom_probability: number;
}

export interface OptimizedLineup {
  players: DFSPlayer[];
  total_salary: number;
  projected_points: number;
  projected_ownership: number;
  ceiling: number;
  leverage_score: number;
  correlation_score: number;
}

export interface LineupRequest {
  sport: string;
  contest_type: 'gpp' | 'cash';
  salary_cap: number;
  num_lineups?: number;
  locked_players?: string[];
  excluded_players?: string[];
}

class FantasyMLAPI {
  private authToken?: string;

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async fetch(endpoint: string, options?: RequestInit) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options?.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get player predictions
   */
  async getPlayerPredictions(playerIds: string[]): Promise<PlayerPrediction[]> {
    return this.fetch('/api/predictions/players', {
      method: 'POST',
      body: JSON.stringify({ player_ids: playerIds }),
    });
  }

  /**
   * Get available players for DFS
   */
  async getDFSPlayers(sport: string, slate?: string): Promise<DFSPlayer[]> {
    const params = new URLSearchParams({ sport });
    if (slate) params.append('slate', slate);
    
    return this.fetch(`/api/dfs/players?${params}`);
  }

  /**
   * Optimize DFS lineups
   */
  async optimizeLineups(request: LineupRequest): Promise<OptimizedLineup[]> {
    return this.fetch('/api/optimize/lineup', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get prop bet analysis
   */
  async getPropAnalysis(playerId: string, propType: string, line: number) {
    return this.fetch('/api/props/analyze', {
      method: 'POST',
      body: JSON.stringify({
        player_id: playerId,
        prop_type: propType,
        line,
      }),
    });
  }

  /**
   * Check API health
   */
  async checkHealth() {
    return this.fetch('/api/health');
  }

  /**
   * Get user subscription status
   */
  async getSubscriptionStatus() {
    return this.fetch('/api/subscription/status');
  }
}

export const fantasyMLAPI = new FantasyMLAPI();