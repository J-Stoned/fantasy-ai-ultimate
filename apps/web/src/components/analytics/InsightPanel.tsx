/**
 * 💡 INSIGHT PANEL - AI-GENERATED ANALYTICS INSIGHTS
 * 
 * This component displays AI-generated insights, trends, and
 * recommendations based on the analyzed data.
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, AlertTriangle, 
  Lightbulb, Target, Zap, Brain, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'prediction' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  data?: any;
  timestamp?: Date;
}

interface InsightPanelProps {
  insights: Insight[];
  onInsightClick?: (insight: Insight) => void;
  className?: string;
}

export function InsightPanel({ insights, onInsightClick, className }: InsightPanelProps) {
  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="w-5 h-5" />;
      case 'anomaly':
        return <AlertTriangle className="w-5 h-5" />;
      case 'recommendation':
        return <Lightbulb className="w-5 h-5" />;
      case 'prediction':
        return <Brain className="w-5 h-5" />;
      case 'opportunity':
        return <Star className="w-5 h-5" />;
    }
  };
  
  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'trend':
        return 'from-blue-600 to-cyan-600';
      case 'anomaly':
        return 'from-red-600 to-orange-600';
      case 'recommendation':
        return 'from-green-600 to-emerald-600';
      case 'prediction':
        return 'from-purple-600 to-pink-600';
      case 'opportunity':
        return 'from-yellow-600 to-amber-600';
    }
  };
  
  const getImpactBadgeColor = (impact: Insight['impact']) => {
    switch (impact) {
      case 'high':
        return 'bg-red-600/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-amber-600/20 text-amber-400 border-amber-500/30';
      case 'low':
        return 'bg-green-600/20 text-green-400 border-green-500/30';
    }
  };
  
  const sortedInsights = [...insights].sort((a, b) => {
    // Sort by impact first, then confidence
    const impactOrder = { high: 3, medium: 2, low: 1 };
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[b.impact] - impactOrder[a.impact];
    }
    return b.confidence - a.confidence;
  });
  
  return (
    <Card className={cn("bg-white/5 border-white/10 h-full", className)}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <AnimatePresence mode="popLayout">
          {sortedInsights.length > 0 ? (
            sortedInsights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  onClick={() => onInsightClick?.(insight)}
                  className="w-full text-left group"
                >
                  <div className="relative p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200">
                    {/* Gradient Background */}
                    <div 
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity rounded-lg",
                        getInsightColor(insight.type)
                      )}
                    />
                    
                    {/* Content */}
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-lg bg-gradient-to-br",
                            getInsightColor(insight.type)
                          )}>
                            {getInsightIcon(insight.type)}
                          </div>
                          <h4 className="font-medium text-white line-clamp-1">
                            {insight.title}
                          </h4>
                        </div>
                        
                        {/* Impact Badge */}
                        <span className={cn(
                          "px-2 py-0.5 text-xs rounded-full border",
                          getImpactBadgeColor(insight.impact)
                        )}>
                          {insight.impact}
                        </span>
                      </div>
                      
                      {/* Description */}
                      <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                        {insight.description}
                      </p>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Confidence */}
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                                initial={{ width: 0 }}
                                animate={{ width: `${insight.confidence * 100}%` }}
                                transition={{ duration: 0.5, delay: index * 0.05 + 0.2 }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">
                              {Math.round(insight.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Action Indicator */}
                        {insight.data?.query && (
                          <span className="text-xs text-purple-400 group-hover:text-purple-300 transition-colors">
                            Click to explore →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8">
              <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                No insights yet. Ask a question to generate insights.
              </p>
            </div>
          )}
        </AnimatePresence>
        
        {/* Insight Summary */}
        {insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-3 bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-lg border border-purple-500/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                {insights.length} insights found
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-red-400">
                  {insights.filter(i => i.impact === 'high').length} high
                </span>
                <span className="text-amber-400">
                  {insights.filter(i => i.impact === 'medium').length} medium
                </span>
                <span className="text-green-400">
                  {insights.filter(i => i.impact === 'low').length} low
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 💡 INSIGHT PANEL FEATURES:
 * 
 * - AI-generated insights display
 * - Multiple insight types with icons
 * - Impact level indicators
 * - Confidence scoring
 * - Interactive insight cards
 * - Beautiful gradients
 * - Smooth animations
 * - Insight summary
 * - Scrollable list
 * 
 * Turn data into actionable intelligence!
 */