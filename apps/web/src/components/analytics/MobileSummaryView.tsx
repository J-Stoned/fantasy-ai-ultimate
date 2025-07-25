/**
 * 📱 MOBILE SUMMARY VIEW - CONDENSED ANALYTICS SUMMARY
 * 
 * This component provides a condensed summary of analytics data
 * optimized for mobile viewing with expandable sections.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, AlertCircle, Lightbulb, ChevronDown, 
  ChevronUp, Sparkles, BarChart3, Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Insight } from './InsightPanel';
import type { Metric } from './MetricCards';

interface MobileSummaryViewProps {
  metrics: Metric[];
  insights: Insight[];
  chartSummary?: string;
  className?: string;
}

export function MobileSummaryView({ 
  metrics, 
  insights, 
  chartSummary,
  className 
}: MobileSummaryViewProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };
  
  // Get key metrics
  const keyMetrics = metrics.slice(0, 3);
  const positiveMetrics = metrics.filter(m => m.change && m.change > 0);
  const negativeMetrics = metrics.filter(m => m.change && m.change < 0);
  
  // Get top insights
  const highImpactInsights = insights.filter(i => i.impact === 'high');
  const topInsight = insights[0];
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Executive Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-xl p-4 border border-purple-500/30"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-purple-600 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Analytics Summary</h3>
            <p className="text-sm text-gray-300 mt-1">
              {chartSummary || "Your data analysis is ready"}
            </p>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {keyMetrics.map((metric) => (
            <div 
              key={metric.id}
              className="bg-white/10 rounded-lg p-2 text-center"
            >
              <p className="text-xs text-gray-400">{metric.label}</p>
              <p className="text-sm font-bold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
      
      {/* Top Insight */}
      {topInsight && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-xl p-4 border border-white/10"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-600 to-orange-600 rounded-lg">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-white">Key Insight</h4>
              <p className="text-sm text-gray-300 mt-1">{topInsight.title}</p>
              <p className="text-xs text-gray-400 mt-2">{topInsight.description}</p>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Expandable Sections */}
      {/* Performance Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
      >
        <button
          onClick={() => toggleSection('trends')}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white">Performance Trends</span>
          </div>
          {expandedSection === 'trends' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        <AnimatePresence>
          {expandedSection === 'trends' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-2">
                {positiveMetrics.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 mb-1">Improving</p>
                    {positiveMetrics.map(metric => (
                      <div key={metric.id} className="flex justify-between text-sm">
                        <span className="text-gray-300">{metric.label}</span>
                        <span className="text-green-400">+{metric.change?.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
                {negativeMetrics.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-red-400 mb-1">Needs Attention</p>
                    {negativeMetrics.map(metric => (
                      <div key={metric.id} className="flex justify-between text-sm">
                        <span className="text-gray-300">{metric.label}</span>
                        <span className="text-red-400">{metric.change?.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* AI Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
      >
        <button
          onClick={() => toggleSection('insights')}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-purple-400" />
            <span className="font-medium text-white">
              AI Insights ({insights.length})
            </span>
          </div>
          {expandedSection === 'insights' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        <AnimatePresence>
          {expandedSection === 'insights' && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-3">
                {insights.slice(0, 5).map((insight, index) => (
                  <div 
                    key={insight.id}
                    className="bg-white/5 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {insight.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {insights.length > 5 && (
                  <p className="text-xs text-center text-gray-400">
                    +{insights.length - 5} more insights
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-medium text-white hover:from-purple-700 hover:to-blue-700 transition-all">
          <div className="flex items-center justify-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <span>View Full Analytics</span>
          </div>
        </button>
      </motion.div>
    </div>
  );
}

/**
 * 📱 MOBILE SUMMARY VIEW FEATURES:
 * 
 * - Executive summary card
 * - Key metrics display
 * - Top insight highlight
 * - Expandable sections
 * - Performance trends
 * - AI insights list
 * - Progressive disclosure
 * - Touch-friendly interactions
 * 
 * Condense complex data for mobile!
 */