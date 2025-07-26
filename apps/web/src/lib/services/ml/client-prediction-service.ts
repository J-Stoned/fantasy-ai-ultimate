/**
 * 🎯 Client-Side ML Prediction Service
 * Calls backend API instead of using TensorFlow directly
 */

import { logger } from '@/lib/logging/logger';

interface PredictionRequest {
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  playerId: string;
  features: {
    recentGames: Array<{
      fantasyPoints: number;
      minutes?: number;
      opponent: string;
      isHome: boolean;
      daysRest: number;
    }>;
    seasonAverage: number;
    careerAverage: number;
    vsTeamAverage?: number;
    injuryStatus?: 'healthy' | 'questionable' | 'doubtful';
  };
  modelType?: 'standard' | 'advanced' | 'ensemble';
}

interface PredictionResponse {
  success: boolean;
  prediction?: {
    playerId: string;
    sport: string;
    projectedPoints: number;
    confidence: number;
    range: {
      low: number;
      high: number;
    };
    factors: Array<{
      name: string;
      impact: number;
      value: any;
    }>;
    modelVersion: string;
    timestamp: string;
  };
  error?: string;
  details?: any;
}

export class ClientPredictionService {
  private readonly apiUrl = '/api/ml/predict';
  private cache = new Map<string, { data: PredictionResponse; timestamp: number }>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get prediction from backend
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Returning cached prediction', { playerId: request.playerId });
      return cached.data;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          modelType: request.modelType || 'standard',
        }),
      });

      const data: PredictionResponse = await response.json();

      if (response.ok && data.success) {
        // Cache successful predictions
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
      }

      return data;
    } catch (error) {
      logger.error('Failed to get prediction', { error, request });
      return {
        success: false,
        error: 'Failed to connect to prediction service',
      };
    }
  }

  /**
   * Get predictions for multiple players
   */
  async predictBatch(
    requests: PredictionRequest[]
  ): Promise<Map<string, PredictionResponse>> {
    const results = new Map<string, PredictionResponse>();

    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const promises = batch.map(req => 
        this.predict(req).then(res => ({ playerId: req.playerId, response: res }))
      );

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ playerId, response }) => {
        results.set(playerId, response);
      });
    }

    return results;
  }

  /**
   * Check ML service health
   */
  async checkHealth(): Promise<{
    status: string;
    models?: Record<string, boolean>;
    tensorflow?: string;
    gpu?: boolean;
    timestamp: string;
  }> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
      });

      if (response.ok) {
        return await response.json();
      }

      return {
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        status: 'unreachable',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Prediction cache cleared');
  }

  /**
   * Generate cache key
   */
  private getCacheKey(request: PredictionRequest): string {
    return `${request.sport}:${request.playerId}:${request.modelType || 'standard'}:${
      request.features.recentGames.length
    }`;
  }

  /**
   * Format prediction for display
   */
  formatPrediction(prediction: PredictionResponse['prediction']): {
    primary: string;
    secondary: string;
    confidence: string;
    range: string;
  } {
    if (!prediction) {
      return {
        primary: 'N/A',
        secondary: '',
        confidence: '',
        range: '',
      };
    }

    return {
      primary: `${prediction.projectedPoints.toFixed(1)} pts`,
      secondary: `${(prediction.confidence * 100).toFixed(0)}% confidence`,
      confidence: this.getConfidenceLabel(prediction.confidence),
      range: `${prediction.range.low.toFixed(1)} - ${prediction.range.high.toFixed(1)}`,
    };
  }

  /**
   * Get confidence label
   */
  private getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Moderate';
    if (confidence >= 0.6) return 'Low';
    return 'Very Low';
  }
}

// Export singleton instance
export const clientPredictionService = new ClientPredictionService();