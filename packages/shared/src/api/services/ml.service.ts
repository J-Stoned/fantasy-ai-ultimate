import { ApiClient } from '../client';
import { ApiResponse } from '../../types/api';
import { MLPrediction, MLModel, MLPerformance } from '../../types/ml';
import { LineupPlayer } from '../../types/contest';

export interface LineupOptimizationRequest {
  sport: string;
  contestId?: string;
  salaryCap: number;
  positions: Record<string, number>;
  excludedPlayers?: string[];
  lockedPlayers?: string[];
  optimizationType: 'ceiling' | 'floor' | 'balanced';
}

export interface LineupOptimizationResponse {
  lineup: LineupPlayer[];
  projectedPoints: number;
  totalSalary: number;
  confidence: number;
  alternativeLineups?: LineupPlayer[][];
}

export interface TradeAnalysisRequest {
  leagueId: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  includeProjections?: boolean;
}

export interface TradeAnalysisResponse {
  teamAValue: number;
  teamBValue: number;
  fairnessScore: number;
  recommendation: 'accept' | 'reject' | 'neutral';
  reasoning: string;
  projectedImpact: {
    teamA: { wins: number; points: number };
    teamB: { wins: number; points: number };
  };
}

export class MLService {
  constructor(private apiClient: ApiClient) {}

  async getPlayerPrediction(playerId: string, gameId?: string): Promise<ApiResponse<MLPrediction>> {
    return this.apiClient.get<MLPrediction>(`/ml/predictions/player/${playerId}`, { gameId });
  }

  async getBatchPredictions(playerIds: string[], gameIds?: string[]): Promise<ApiResponse<MLPrediction[]>> {
    return this.apiClient.post<MLPrediction[]>('/ml/predictions/batch', {
      playerIds,
      gameIds
    });
  }

  async optimizeLineup(request: LineupOptimizationRequest): Promise<ApiResponse<LineupOptimizationResponse>> {
    return this.apiClient.post<LineupOptimizationResponse>('/ml/optimize/lineup', request);
  }

  async analyzeTradeWithML(request: TradeAnalysisRequest): Promise<ApiResponse<TradeAnalysisResponse>> {
    return this.apiClient.post<TradeAnalysisResponse>('/ml/analyze/trade', request);
  }

  async getInjuryRiskPrediction(playerId: string): Promise<ApiResponse<MLPrediction>> {
    return this.apiClient.get<MLPrediction>(`/ml/predictions/injury-risk/${playerId}`);
  }

  async getOwnershipProjection(contestId: string, playerId: string): Promise<ApiResponse<MLPrediction>> {
    return this.apiClient.get<MLPrediction>('/ml/predictions/ownership', {
      contestId,
      playerId
    });
  }

  async getModelPerformance(modelId: string, days = 30): Promise<ApiResponse<MLPerformance[]>> {
    return this.apiClient.get<MLPerformance[]>(`/ml/models/${modelId}/performance`, { days });
  }

  async getActiveModels(sport?: string): Promise<ApiResponse<MLModel[]>> {
    return this.apiClient.get<MLModel[]>('/ml/models', { 
      sport,
      active: true 
    });
  }

  async getGamePredictions(gameId: string): Promise<ApiResponse<{
    homeTeamScore: number;
    awayTeamScore: number;
    totalScore: number;
    confidence: number;
    playerPredictions: MLPrediction[];
  }>> {
    return this.apiClient.get(`/ml/predictions/game/${gameId}`);
  }

  async getSeasonProjections(playerId: string, season: number): Promise<ApiResponse<MLPrediction>> {
    return this.apiClient.get<MLPrediction>(`/ml/projections/season/${playerId}`, { season });
  }
}