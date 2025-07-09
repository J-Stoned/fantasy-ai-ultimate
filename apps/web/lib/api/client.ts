/**
 * API Client for Fantasy AI Platform
 * Centralized client for all API calls
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LineupParams {
  sport: string;
  contest: {
    type: string;
    positions: Record<string, number>;
    salaryCap: number;
  };
  budget: number;
}

export interface PatternAnalysis {
  gameId: number;
  patterns: Array<{
    type: string;
    detected: boolean;
    confidence: number;
    impact: number;
    recommendation: string;
  }>;
  totalConfidence: number;
  bestPlay: string;
}

export class APIClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.NEXT_PUBLIC_API_URL || '';
  }

  /**
   * Pattern Detection
   */
  async analyzePatterns(gameIds: number[]): Promise<{
    results: PatternAnalysis[];
    summary: any;
  }> {
    return this.post('/api/patterns/analyze', { gameIds });
  }

  async getPatterns(params?: {
    sport?: string;
    sortBy?: string;
    search?: string;
  }) {
    const queryParams = new URLSearchParams(params as any);
    return this.get(`/api/patterns?${queryParams}`);
  }

  /**
   * AI Assistant
   */
  async chat(messages: Message[]) {
    return this.post('/api/ai/chat', { messages });
  }

  /**
   * Lineup Optimization
   */
  async optimizeLineup(params: LineupParams) {
    return this.post('/api/optimize/lineup', params);
  }

  /**
   * Dashboard Stats
   */
  async getDashboardStats() {
    return this.get('/api/stats/dashboard');
  }

  /**
   * Health Checks
   */
  async checkHealth() {
    return this.get('/api/health');
  }

  async checkServices() {
    return this.get('/api/health/services');
  }

  /**
   * Predictions
   */
  async getPredictions(gameIds?: number[]) {
    if (gameIds) {
      return this.post('/api/predictions', { gameIds });
    }
    return this.get('/api/predictions');
  }

  /**
   * WebSocket Info
   */
  async getWebSocketInfo() {
    return this.get('/api/websocket/info');
  }

  /**
   * Private methods
   */
  private async get(path: string) {
    const res = await fetch(this.baseURL + path, {
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const error = await this.parseError(res);
      throw new Error(error);
    }

    return res.json();
  }

  private async post(path: string, data: any) {
    const res = await fetch(this.baseURL + path, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await this.parseError(res);
      throw new Error(error);
    }

    return res.json();
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth-token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async parseError(response: Response): Promise<string> {
    try {
      const data = await response.json();
      return data.error || data.message || response.statusText;
    } catch {
      return response.statusText;
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();