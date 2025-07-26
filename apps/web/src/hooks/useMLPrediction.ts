/**
 * 🧠 ML Prediction Hook
 * React hook for getting ML predictions from backend
 */

import { useState, useEffect, useCallback } from 'react';
import { clientPredictionService } from '@/lib/services/ml/client-prediction-service';
import { logger } from '@/lib/logging/logger';

interface PredictionData {
  playerId: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
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
}

interface UseMLPredictionOptions {
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  playerId: string;
  features?: {
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
  enabled?: boolean;
  refetchInterval?: number;
}

interface UseMLPredictionResult {
  prediction: PredictionData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  formatted: {
    primary: string;
    secondary: string;
    confidence: string;
    range: string;
  };
}

export function useMLPrediction({
  sport,
  playerId,
  features,
  modelType = 'standard',
  enabled = true,
  refetchInterval,
}: UseMLPredictionOptions): UseMLPredictionResult {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    if (!enabled || !features) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await clientPredictionService.predict({
        sport,
        playerId,
        features,
        modelType,
      });

      if (response.success && response.prediction) {
        setPrediction({
          playerId: response.prediction.playerId,
          sport: response.prediction.sport as any,
          projectedPoints: response.prediction.projectedPoints,
          confidence: response.prediction.confidence,
          range: response.prediction.range,
          factors: response.prediction.factors,
        });
      } else {
        setError(response.error || 'Failed to get prediction');
      }
    } catch (err) {
      logger.error('Prediction hook error', { err });
      setError('Failed to fetch prediction');
    } finally {
      setIsLoading(false);
    }
  }, [sport, playerId, features, modelType, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(fetchPrediction, refetchInterval);
    return () => clearInterval(interval);
  }, [fetchPrediction, refetchInterval, enabled]);

  // Format prediction for display
  const formatted = prediction
    ? clientPredictionService.formatPrediction({
        playerId: prediction.playerId,
        sport: prediction.sport,
        projectedPoints: prediction.projectedPoints,
        confidence: prediction.confidence,
        range: prediction.range,
        factors: prediction.factors,
        modelVersion: '2025.1.0',
        timestamp: new Date().toISOString(),
      })
    : {
        primary: 'N/A',
        secondary: '',
        confidence: '',
        range: '',
      };

  return {
    prediction,
    isLoading,
    error,
    refetch: fetchPrediction,
    formatted,
  };
}

/**
 * Hook for batch predictions
 */
export function useMLPredictionBatch(
  players: Array<{
    playerId: string;
    sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
    features: UseMLPredictionOptions['features'];
  }>,
  options?: {
    modelType?: 'standard' | 'advanced' | 'ensemble';
    enabled?: boolean;
  }
): {
  predictions: Map<string, PredictionData>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [predictions, setPredictions] = useState<Map<string, PredictionData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    if (!options?.enabled ?? true) return;
    if (players.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const requests = players
        .filter(p => p.features)
        .map(p => ({
          sport: p.sport,
          playerId: p.playerId,
          features: p.features!,
          modelType: options?.modelType || 'standard',
        }));

      const results = await clientPredictionService.predictBatch(requests);
      const newPredictions = new Map<string, PredictionData>();

      results.forEach((response, playerId) => {
        if (response.success && response.prediction) {
          newPredictions.set(playerId, {
            playerId: response.prediction.playerId,
            sport: response.prediction.sport as any,
            projectedPoints: response.prediction.projectedPoints,
            confidence: response.prediction.confidence,
            range: response.prediction.range,
            factors: response.prediction.factors,
          });
        }
      });

      setPredictions(newPredictions);
    } catch (err) {
      logger.error('Batch prediction error', { err });
      setError('Failed to fetch predictions');
    } finally {
      setIsLoading(false);
    }
  }, [players, options]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  return {
    predictions,
    isLoading,
    error,
    refetch: fetchPredictions,
  };
}