/**
 * 📦 Fantasy ML Models Exports
 * Centralized exports for all ML models
 */

import { PlayerPerformancePredictor } from './player-performance-predictor';
import { DFSLineupOptimizerFixed } from './dfs-lineup-optimizer-fixed';
import { PropBetAnalyzer } from './prop-bet-analyzer';

// Create singleton instances
export const playerPredictor = new PlayerPerformancePredictor();
export const dfsOptimizer = new DFSLineupOptimizerFixed();
export const propAnalyzer = new PropBetAnalyzer();

// Export types
export type { PredictionResult } from './player-performance-predictor';
export type { DFSPlayer, LineupConstraints, OptimizedLineup } from './dfs-lineup-optimizer-fixed';
export type { PropBet, PropAnalysis } from './prop-bet-analyzer';

// Export classes for direct instantiation if needed
export { PlayerPerformancePredictor, DFSLineupOptimizerFixed, PropBetAnalyzer };