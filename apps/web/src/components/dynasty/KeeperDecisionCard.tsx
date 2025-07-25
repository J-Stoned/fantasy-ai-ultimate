'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiTrendingUp, FiTrendingDown, FiCheck, FiX, FiInfo } from 'react-icons/fi';
import { keeperAnalysisService } from '@/lib/services/traditional-fantasy/keeper-management/keeper-analysis-service';
import type { PlayerKeeperDecision } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

interface KeeperDecisionCardProps {
  player: PlayerKeeperDecision;
  onDecision: (playerId: string, keep: boolean) => void;
  leagueId: string;
}

export const KeeperDecisionCard: React.FC<KeeperDecisionCardProps> = ({
  player,
  onDecision,
  leagueId
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<boolean | null>(null);

  const handleDecision = async (keep: boolean) => {
    setLoading(true);
    try {
      await onDecision(player.id, keep);
      setDecision(keep);
    } catch (error) {
      logger.error('Failed to save decision:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = () => {
    if (player.recommendation.score >= 80) return 'text-green-400';
    if (player.recommendation.score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getValueTrendIcon = () => {
    if (player.projectedValue > player.currentValue * 1.1) {
      return <FiTrendingUp className="text-green-400" />;
    } else if (player.projectedValue < player.currentValue * 0.9) {
      return <FiTrendingDown className="text-red-400" />;
    }
    return null;
  };

  return (
    <motion.div
      className="relative w-full h-96"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          className={`absolute inset-0 w-full h-full ${
            isFlipped ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front of card */}
          <div
            className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6 shadow-xl"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <FiUser className="text-white text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{player.name}</h3>
                    <p className="text-sm text-gray-400">
                      {player.position} • {player.team}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFlipped(true)}
                  className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                >
                  <FiInfo className="text-gray-400" />
                </button>
              </div>

              {/* Stats */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Keeper Cost</p>
                    <p className="text-xl font-bold text-white">
                      Round {player.keeperCost}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Value Trend</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xl font-bold text-white">
                        {((player.projectedValue / player.currentValue - 1) * 100).toFixed(1)}%
                      </p>
                      {getValueTrendIcon()}
                    </div>
                  </div>
                </div>

                {/* AI Recommendation */}
                <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg p-4 border border-purple-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-300">AI Recommendation</p>
                    <span className={`text-2xl font-bold ${getRecommendationColor()}`}>
                      {player.recommendation.score}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {player.recommendation.reason}
                  </p>
                </div>

                {/* Recent Performance */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Recent Performance</p>
                  <div className="flex space-x-2">
                    {player.recentScores.slice(-5).map((score, index) => (
                      <div
                        key={index}
                        className="flex-1 bg-gray-800/50 rounded-md p-2 text-center"
                      >
                        <p className="text-xs font-medium text-white">{score.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decision Buttons */}
              <div className="flex space-x-3 mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDecision(true)}
                  disabled={loading || decision !== null}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    decision === true
                      ? 'bg-green-500 text-white'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  } ${loading || decision !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="flex items-center justify-center space-x-2">
                    <FiCheck />
                    <span>Keep</span>
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDecision(false)}
                  disabled={loading || decision !== null}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    decision === false
                      ? 'bg-red-500 text-white'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  } ${loading || decision !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="flex items-center justify-center space-x-2">
                    <FiX />
                    <span>Pass</span>
                  </span>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Back of card - Detailed Analysis */}
          <div
            className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6 shadow-xl"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Detailed Analysis</h3>
                <button
                  onClick={() => setIsFlipped(false)}
                  className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                >
                  <FiX className="text-gray-400" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto">
                {/* Pros */}
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-2">Pros</h4>
                  <ul className="space-y-1">
                    {player.recommendation.pros.map((pro, index) => (
                      <li key={index} className="text-xs text-gray-300 flex items-start">
                        <span className="text-green-400 mr-2">•</span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cons */}
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-2">Cons</h4>
                  <ul className="space-y-1">
                    {player.recommendation.cons.map((con, index) => (
                      <li key={index} className="text-xs text-gray-300 flex items-start">
                        <span className="text-red-400 mr-2">•</span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Projections */}
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Season Projection</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">Points/Game</p>
                      <p className="text-white font-medium">{player.projectedPPG.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total Points</p>
                      <p className="text-white font-medium">{player.projectedTotal.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Consistency</p>
                      <p className="text-white font-medium">{player.consistencyRating}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Injury Risk</p>
                      <p className="text-white font-medium">{player.injuryRisk}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};