'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LightBulbIcon,
  TrophyIcon,
  ArrowPathIcon,
  BuildingLibraryIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import type { ChampionshipWindow, TeamMetrics, Player } from '@/lib/services/traditional-fantasy/keeper-management/types';

interface TeamStrategyAdvisorProps {
  championshipWindow: ChampionshipWindow;
  teamMetrics: TeamMetrics;
  roster: Player[];
}

interface StrategyRecommendation {
  id: string;
  category: 'immediate' | 'short-term' | 'long-term';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  timeframe: string;
  actions: string[];
  metrics?: {
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'stable';
  }[];
}

export function TeamStrategyAdvisor({ championshipWindow, teamMetrics, roster }: TeamStrategyAdvisorProps) {
  // Generate strategy recommendations based on team state
  const recommendations = useMemo(() => {
    const recs: StrategyRecommendation[] = [];
    
    // Championship Window Specific Strategies
    if (championshipWindow.status === 'competing') {
      recs.push({
        id: '1',
        category: 'immediate',
        priority: 'critical',
        title: 'Maximize Championship Window',
        description: 'Your team is in prime position. Focus on win-now moves to capitalize on this opportunity.',
        impact: 'Could increase championship probability by 15-25%',
        timeframe: 'Next 1-2 seasons',
        actions: [
          'Trade future picks for proven veterans',
          'Target high-floor players over high-ceiling rookies',
          'Keep all elite assets regardless of age',
          'Stream defenses and kickers based on matchups'
        ],
        metrics: [
          { label: 'Championship Probability', value: `${(championshipWindow.championshipProbability[0] * 100).toFixed(0)}%`, trend: 'up' },
          { label: 'Window Duration', value: `${championshipWindow.windowDuration} years`, trend: 'stable' }
        ]
      });

      // Position-specific needs
      const rbAge = roster.filter(p => p.position === 'RB').reduce((sum, p) => sum + p.age, 0) / roster.filter(p => p.position === 'RB').length;
      if (rbAge > 26) {
        recs.push({
          id: '2',
          category: 'short-term',
          priority: 'high',
          title: 'RB Depth Concern',
          description: 'Your RB room is aging. Consider adding young backup talent.',
          impact: 'Prevent sudden roster decline',
          timeframe: 'Before next season',
          actions: [
            'Target RBs in rounds 2-3 of rookie draft',
            'Look for undervalued handcuffs',
            'Consider trading aging RB before value crashes'
          ]
        });
      }
    } else if (championshipWindow.status === 'rebuilding') {
      recs.push({
        id: '3',
        category: 'long-term',
        priority: 'critical',
        title: 'Accumulate Future Assets',
        description: 'Focus on building a foundation for future success through youth and draft capital.',
        impact: 'Position for championship contention in 2-3 years',
        timeframe: 'Next 2-3 seasons',
        actions: [
          'Trade aging veterans for picks and young players',
          'Target players under 25 in all transactions',
          'Prioritize draft capital accumulation',
          'Be patient with developing talent'
        ],
        metrics: [
          { label: 'Avg Roster Age', value: roster.reduce((sum, p) => sum + p.age, 0) / roster.length, trend: 'down' },
          { label: 'Future Picks', value: teamMetrics.draftCapital.length, trend: 'up' }
        ]
      });
    }

    // Cap space management
    if (teamMetrics.capSpace[0] < 20) {
      recs.push({
        id: '4',
        category: 'immediate',
        priority: 'high',
        title: 'Salary Cap Crunch',
        description: 'Limited cap space restricts your flexibility. Consider restructuring or cuts.',
        impact: 'Free up $15-30M for roster improvements',
        timeframe: 'Before free agency',
        actions: [
          'Identify restructure candidates',
          'Consider cutting underperforming high-salary players',
          'Trade expensive veterans for cap relief',
          'Target value contracts in free agency'
        ],
        metrics: [
          { label: 'Current Cap Space', value: `$${teamMetrics.capSpace[0]}M`, trend: 'down' },
          { label: 'Next Year Cap', value: `$${teamMetrics.capSpace[1]}M`, trend: 'up' }
        ]
      });
    }

    // Roster construction
    const qbCount = roster.filter(p => p.position === 'QB').length;
    if (qbCount < 2) {
      recs.push({
        id: '5',
        category: 'short-term',
        priority: 'medium',
        title: 'QB Depth Needed',
        description: 'Only one QB on roster creates significant risk.',
        impact: 'Avoid catastrophic season if starter injured',
        timeframe: 'Before season starts',
        actions: [
          'Target veteran backup in free agency',
          'Consider late-round rookie QB',
          'Monitor waiver wire for upside plays'
        ]
      });
    }

    // Competitive balance
    if (teamMetrics.competitiveBalance < 0.5) {
      recs.push({
        id: '6',
        category: 'immediate',
        priority: 'high',
        title: 'Roster Imbalance Detected',
        description: 'Your roster lacks balance between positions or age groups.',
        impact: 'Improve sustainability and consistency',
        timeframe: 'Next 2-3 months',
        actions: [
          'Identify position groups with excess/shortage',
          'Balance youth and experience',
          'Diversify risk across multiple assets'
        ],
        metrics: [
          { label: 'Balance Score', value: `${(teamMetrics.competitiveBalance * 100).toFixed(0)}%`, trend: 'down' }
        ]
      });
    }

    return recs;
  }, [championshipWindow, teamMetrics, roster]);

  const priorityConfig = {
    critical: {
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/50',
      icon: ExclamationTriangleIcon
    },
    high: {
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/50',
      icon: ArrowTrendingUpIcon
    },
    medium: {
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/50',
      icon: LightBulbIcon
    },
    low: {
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/50',
      icon: ChartBarIcon
    }
  };

  const strategyIcons = {
    'win-now': TrophyIcon,
    'balanced': ArrowPathIcon,
    'rebuild': BuildingLibraryIcon
  };

  const StrategyIcon = strategyIcons[championshipWindow.recommendedStrategy.approach];

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-gray-900 border-purple-500/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <SparklesIcon className="w-8 h-8 text-purple-400" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold text-white">AI Strategy Advisor</h2>
            <p className="text-gray-400">Personalized recommendations for your team</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2">
          <StrategyIcon className="w-6 h-6 text-purple-400" />
          <div>
            <p className="text-xs text-gray-400">Recommended Approach</p>
            <p className="text-sm font-bold text-purple-400 capitalize">
              {championshipWindow.recommendedStrategy.approach.replace('-', ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-800/50 rounded-lg p-4 text-center"
        >
          <UserGroupIcon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Target Positions</p>
          <div className="flex flex-wrap gap-1 justify-center mt-2">
            {championshipWindow.recommendedStrategy.targetPositions.map((pos, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-500/20 rounded text-xs text-blue-400">
                {pos}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-800/50 rounded-lg p-4 text-center"
        >
          <CalendarDaysIcon className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Optimal Timeline</p>
          <p className="text-xl font-bold text-green-400 mt-1">
            {championshipWindow.peakYear === 0 ? 'Now' : `${championshipWindow.peakYear} Years`}
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-800/50 rounded-lg p-4 text-center"
        >
          <RocketLaunchIcon className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Action Priority</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">
            {recommendations.filter(r => r.priority === 'critical').length} Critical
          </p>
        </motion.div>
      </div>

      {/* Strategy Recommendations */}
      <div className="space-y-4">
        {['immediate', 'short-term', 'long-term'].map(category => {
          const categoryRecs = recommendations.filter(r => r.category === category);
          if (categoryRecs.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-400 mb-3 capitalize">
                {category.replace('-', ' ')} Actions
              </h3>
              <div className="space-y-3">
                {categoryRecs.map((rec, idx) => {
                  const config = priorityConfig[rec.priority];
                  const PriorityIcon = config.icon;

                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 bg-gradient-to-r ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <PriorityIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{rec.title}</h4>
                            <p className="text-sm text-gray-300 mt-1">{rec.description}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-medium bg-gradient-to-r ${config.color} text-white`}>
                          {rec.priority}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Recommended Actions:</p>
                          <ul className="space-y-1">
                            {rec.actions.map((action, actionIdx) => (
                              <li key={actionIdx} className="text-sm text-gray-300 flex items-start gap-2">
                                <CheckCircleIcon className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <div className="bg-gray-900/50 rounded-lg p-3 mb-2">
                            <p className="text-xs text-gray-500">Impact</p>
                            <p className="text-sm text-white font-medium">{rec.impact}</p>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">Timeframe</p>
                            <p className="text-sm text-white font-medium">{rec.timeframe}</p>
                          </div>
                        </div>
                      </div>

                      {rec.metrics && (
                        <div className="flex gap-3 mt-3 pt-3 border-t border-gray-700/50">
                          {rec.metrics.map((metric, metricIdx) => (
                            <div key={metricIdx} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{metric.label}:</span>
                              <span className="text-sm font-semibold text-white">{metric.value}</span>
                              {metric.trend && (
                                <ArrowTrendingUpIcon className={`w-3 h-3 ${
                                  metric.trend === 'up' ? 'text-green-400' :
                                  metric.trend === 'down' ? 'text-red-400' :
                                  'text-gray-400'
                                }`} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Quick Actions</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 font-medium transition-colors"
          >
            Run Trade Finder
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 font-medium transition-colors"
          >
            Optimize Lineup
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 font-medium transition-colors"
          >
            Waiver Analysis
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg text-yellow-400 font-medium transition-colors"
          >
            Export Report
          </motion.button>
        </div>
      </div>
    </Card>
  );
}