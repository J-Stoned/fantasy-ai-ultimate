'use client';

import { motion } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  Shield, 
  Target,
  Zap,
  Brain,
  ChevronRight
} from 'lucide-react';
import { DraftRecommendation } from '@/lib/services/traditional-fantasy/draft-analysis/types';

interface RecommendationPanelProps {
  recommendations: DraftRecommendation[];
  onSelectPlayer: (playerId: string) => void;
}

export function RecommendationPanel({ 
  recommendations, 
  onSelectPlayer 
}: RecommendationPanelProps) {
  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'best_player_available': return <TrendingUp className="w-4 h-4" />;
      case 'position_scarcity': return <Target className="w-4 h-4" />;
      case 'balanced_roster': return <Shield className="w-4 h-4" />;
      case 'upside_chase': return <Zap className="w-4 h-4" />;
      case 'safe_floor': return <Shield className="w-4 h-4" />;
      case 'stack_building': return <Brain className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getStrategyLabel = (strategy: string) => {
    const labels: Record<string, string> = {
      'best_player_available': 'Best Available',
      'position_scarcity': 'Scarce Position',
      'balanced_roster': 'Team Balance',
      'upside_chase': 'High Upside',
      'safe_floor': 'Safe Pick',
      'stack_building': 'Stack Play',
      'handcuff_target': 'Handcuff'
    };
    return labels[strategy] || strategy;
  };

  const getReasonTypeColor = (type: string) => {
    switch (type) {
      case 'value': return 'text-green-400';
      case 'need': return 'text-blue-400';
      case 'scarcity': return 'text-yellow-400';
      case 'tier_break': return 'text-purple-400';
      case 'stack': return 'text-orange-400';
      case 'hedge': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary-400" />
        <h2 className="text-xl font-bold">AI Recommendations</h2>
      </div>

      <div className="space-y-3">
        {recommendations.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Loading recommendations...
          </p>
        ) : (
          recommendations.map((rec, index) => (
            <motion.div
              key={rec.playerId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelectPlayer(rec.playerId)}
              className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-primary-500/50 cursor-pointer transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`
                    text-2xl font-bold
                    ${index === 0 ? 'text-yellow-500' : 
                      index === 1 ? 'text-gray-300' :
                      index === 2 ? 'text-orange-600' :
                      'text-gray-500'}
                  `}>
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold">Player Name</h3>
                    <p className="text-xs text-gray-400">Position • Team</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-400">
                    {rec.score}
                  </div>
                  <div className="text-xs text-gray-400">Score</div>
                </div>
              </div>

              {/* Strategy */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`
                  flex items-center gap-1 px-2 py-1 rounded-full text-xs
                  bg-primary-500/20 text-primary-400 border border-primary-500/30
                `}>
                  {getStrategyIcon(rec.strategy)}
                  <span>{getStrategyLabel(rec.strategy)}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {Math.round(rec.confidenceLevel * 100)}% confidence
                </div>
              </div>

              {/* Top Reasons */}
              <div className="space-y-1 mb-3">
                {rec.reasons.slice(0, 2).map((reason, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className={`mt-1 w-1 h-1 rounded-full ${getReasonTypeColor(reason.type)} bg-current`} />
                    <span className="text-gray-300">{reason.description}</span>
                  </div>
                ))}
              </div>

              {/* Alternative Picks */}
              {rec.alternativePicks.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <div className="text-xs text-gray-500 mb-1">Also consider:</div>
                  <div className="flex gap-2">
                    {rec.alternativePicks.slice(0, 2).map((alt, i) => (
                      <div key={i} className="text-xs bg-gray-800 px-2 py-1 rounded">
                        Player ({alt.score})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hover Effect */}
              <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-primary-400 flex items-center gap-1">
                  View Details
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Quick Stats */}
      {recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-center p-2 bg-white/5 rounded">
              <div className="text-gray-400">Avg Score</div>
              <div className="font-semibold">
                {Math.round(recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length)}
              </div>
            </div>
            <div className="text-center p-2 bg-white/5 rounded">
              <div className="text-gray-400">Top Strategy</div>
              <div className="font-semibold">
                {getStrategyLabel(recommendations[0]?.strategy || '')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}