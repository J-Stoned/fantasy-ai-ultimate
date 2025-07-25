/**
 * 📈 METRIC CARDS - KEY PERFORMANCE INDICATORS
 * 
 * This component displays important metrics in a beautiful
 * card layout with animations and trend indicators.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import CountUp from 'react-countup';

export interface Metric {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

interface MetricCardsProps {
  metrics: Metric[];
  className?: string;
}

export function MetricCards({ metrics, className }: MetricCardsProps) {
  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      case 'stable':
        return <Minus className="w-4 h-4" />;
      default:
        return null;
    }
  };
  
  const getTrendColor = (trend?: 'up' | 'down' | 'stable', change?: number) => {
    if (!trend || change === undefined) return 'text-gray-400';
    
    if (trend === 'stable') return 'text-gray-400';
    
    // For up/down trends, positive change is green, negative is red
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };
  
  const getCardGradient = (index: number) => {
    const gradients = [
      'from-purple-600/20 to-pink-600/20',
      'from-blue-600/20 to-cyan-600/20',
      'from-green-600/20 to-emerald-600/20',
      'from-amber-600/20 to-orange-600/20'
    ];
    return gradients[index % gradients.length];
  };
  
  const parseNumericValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    
    // Remove common prefixes/suffixes and parse
    const cleanValue = value.toString()
      .replace(/[$%,+]/g, '')
      .replace(/[a-zA-Z]/g, '');
    
    return parseFloat(cleanValue) || 0;
  };
  
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <div className="relative group">
            {/* Card */}
            <div className={cn(
              "relative p-6 rounded-xl border border-white/10 overflow-hidden",
              "bg-gradient-to-br backdrop-blur-xl",
              "hover:border-white/20 transition-all duration-300",
              getCardGradient(index)
            )}>
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-repeat" />
              </div>
              
              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    {metric.icon}
                  </div>
                  
                  {metric.change !== undefined && (
                    <div className={cn(
                      "flex items-center gap-1 text-sm",
                      getTrendColor(metric.trend, metric.change)
                    )}>
                      {getTrendIcon(metric.trend)}
                      <span>
                        {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Value */}
                <div className="mb-1">
                  {typeof metric.value === 'number' || !isNaN(parseNumericValue(metric.value)) ? (
                    <div className="text-2xl font-bold text-white">
                      {metric.prefix}
                      <CountUp
                        start={0}
                        end={parseNumericValue(metric.value)}
                        duration={1.5}
                        delay={index * 0.1}
                        decimals={metric.decimals || 0}
                        separator=","
                      />
                      {metric.suffix}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-white">
                      {metric.value}
                    </div>
                  )}
                </div>
                
                {/* Label */}
                <div className="text-sm text-gray-400">
                  {metric.label}
                </div>
              </div>
              
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
            
            {/* Shadow */}
            <div className={cn(
              "absolute inset-0 -z-10 rounded-xl bg-gradient-to-br blur-xl opacity-30 group-hover:opacity-50 transition-opacity",
              getCardGradient(index)
            )} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * 📈 METRIC CARDS FEATURES:
 * 
 * - Beautiful gradient cards
 * - Animated number counting
 * - Trend indicators
 * - Change percentages
 * - Icon support
 * - Hover effects
 * - Responsive grid layout
 * - Background patterns
 * 
 * Display KPIs with style!
 */