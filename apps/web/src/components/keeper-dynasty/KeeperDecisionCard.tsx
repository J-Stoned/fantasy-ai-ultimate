'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowsRightLeftIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ShieldExclamationIcon,
  BoltIcon,
  CalendarDaysIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import type { KeeperRecommendation } from '@/lib/services/traditional-fantasy/keeper-management/types';

interface KeeperDecisionCardProps {
  recommendation: KeeperRecommendation;
  onDecisionChange: (decision: 'keep' | 'release' | 'trade') => void;
}

export function KeeperDecisionCard({ recommendation, onDecisionChange }: KeeperDecisionCardProps) {
  const { decision, reasoning, confidenceFactors, alternativeScenarios } = recommendation;
  const { player, recommendationScore, projectedValue, opportunityCost, riskAssessment, alternativeOptions } = decision;
  const [selectedDecision, setSelectedDecision] = useState<'keep' | 'release' | 'trade' | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const getRecommendationColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-green-600';
    if (score >= 60) return 'from-yellow-500 to-yellow-600';
    if (score >= 40) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  const getRiskIcon = (risk: number) => {
    if (risk < 0.3) return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
    if (risk < 0.6) return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />;
    return <ShieldExclamationIcon className="w-5 h-5 text-red-400" />;
  };

  const handleDecision = (decision: 'keep' | 'release' | 'trade') => {
    setSelectedDecision(decision);
    onDecisionChange(decision);
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
      {/* Player Header */}
      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-gray-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{player.name}</h3>
              <p className="text-gray-400">{player.position} - {player.team}</p>
              <div className="flex items-center gap-2 mt-1">
                <CalendarDaysIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-400">Age {player.age}</span>
                {player.draftDetails && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-sm text-gray-400">
                      Round {player.draftDetails.round} keeper (kept {player.draftDetails.timesKept}x)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* AI Recommendation Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`px-4 py-2 rounded-lg bg-gradient-to-r ${getRecommendationColor(recommendationScore)}`}
          >
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-white" />
              <div>
                <p className="text-xs font-semibold text-white/80">AI Score</p>
                <p className="text-lg font-bold text-white">{recommendationScore}%</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">3-Year Value</p>
            <p className="text-lg font-bold text-white">{projectedValue.threeYearValue.toFixed(0)}</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Opportunity Cost</p>
            <p className="text-lg font-bold text-orange-400">{opportunityCost.toFixed(0)}</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Risk Level</p>
            <div className="flex items-center gap-2">
              {getRiskIcon(riskAssessment.overallRisk)}
              <p className="text-lg font-bold text-white">{(riskAssessment.overallRisk * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>

        {/* Decision Buttons */}
        <div className="flex gap-3 mb-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleDecision('keep')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              selectedDecision === 'keep'
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              Keep
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleDecision('trade')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              selectedDecision === 'trade'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ArrowsRightLeftIcon className="w-5 h-5" />
              Trade
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleDecision('release')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              selectedDecision === 'release'
                ? 'bg-red-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <XCircleIcon className="w-5 h-5" />
              Release
            </div>
          </motion.button>
        </div>

        {/* Toggle Details */}
        <motion.button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {showDetails ? 'Hide' : 'Show'} Detailed Analysis
        </motion.button>
      </div>

      {/* Detailed Analysis */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-gray-700"
          >
            <div className="p-6 space-y-6">
              {/* AI Reasoning */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3">AI Analysis</h4>
                <div className="space-y-2">
                  {reasoning.map((reason, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-2"
                    >
                      <BoltIcon className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">{reason}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Confidence Factors */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Confidence Factors</h4>
                <div className="space-y-2">
                  {confidenceFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{factor.factor}</span>
                      <div className="flex items-center gap-2">
                        {factor.direction === 'positive' ? (
                          <TrendingUpIcon className="w-4 h-4 text-green-400" />
                        ) : (
                          <TrendingDownIcon className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`text-sm font-semibold ${
                          factor.direction === 'positive' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {factor.impact > 0 ? '+' : ''}{factor.impact}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Risk Assessment</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Injury Risk</p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 mr-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full"
                          style={{ width: `${riskAssessment.injuryRisk * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {(riskAssessment.injuryRisk * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Age Risk</p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 mr-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full"
                          style={{ width: `${riskAssessment.ageRisk * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {(riskAssessment.ageRisk * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Volatility</p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 mr-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full"
                          style={{ width: `${riskAssessment.performanceVolatility * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {(riskAssessment.performanceVolatility * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Team Risk</p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 mr-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full"
                          style={{ width: `${riskAssessment.teamSituationRisk * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {(riskAssessment.teamSituationRisk * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alternative Scenarios */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Scenario Analysis</h4>
                <div className="space-y-3">
                  {alternativeScenarios.map((scenario, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-gray-900/50 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-white">{scenario.scenario}</h5>
                        <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300">
                          {(scenario.probability * 100).toFixed(0)}% chance
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{scenario.strategyAdjustment}</p>
                      <div className="flex items-center gap-2">
                        <ChartBarIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-semibold text-yellow-400">
                          {scenario.outcomeValue.toFixed(0)} pts
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Alternative Options */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Alternative Options</h4>
                <div className="space-y-2">
                  {alternativeOptions.map((option, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          option.action === 'draft' ? 'bg-blue-400' :
                          option.action === 'trade' ? 'bg-purple-400' :
                          'bg-green-400'
                        }`} />
                        <span className="text-sm text-gray-300 capitalize">{option.action}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{option.expectedValue.toFixed(0)} pts</p>
                        <p className="text-xs text-gray-500">{(option.probability * 100).toFixed(0)}% success</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}