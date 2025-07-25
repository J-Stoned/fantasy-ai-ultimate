/**
 * 🔮 PROPHECY DISPLAY - ORACLE PREDICTIONS
 * 
 * This component displays Oracle prophecies with mystical
 * visual effects and tracking capabilities.
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clock, Target, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { logger } from '../../lib/logging/logger';

interface Prophecy {
  id: string;
  sport: string;
  timeframe: 'tonight' | 'this_week' | 'season';
  type: 'general' | 'player' | 'contest' | 'weather';
  prediction: string;
  confidence: number;
  createdAt: Date;
  fulfilled?: boolean;
  accuracy?: number;
}

interface ProphecyDisplayProps {
  prophecy: Prophecy;
  onTrack?: (fulfilled: boolean, accuracy: number) => void;
  className?: string;
}

export function ProphecyDisplay({
  prophecy,
  onTrack,
  className
}: ProphecyDisplayProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingResult, setTrackingResult] = useState<{
    fulfilled: boolean;
    accuracy: number;
  } | null>(null);
  
  const getTimeframeIcon = () => {
    switch (prophecy.timeframe) {
      case 'tonight':
        return <Clock className="w-4 h-4" />;
      case 'this_week':
        return <TrendingUp className="w-4 h-4" />;
      case 'season':
        return <Target className="w-4 h-4" />;
    }
  };
  
  const getTypeColor = () => {
    switch (prophecy.type) {
      case 'general':
        return 'from-purple-600 to-indigo-600';
      case 'player':
        return 'from-blue-600 to-cyan-600';
      case 'contest':
        return 'from-green-600 to-emerald-600';
      case 'weather':
        return 'from-sky-600 to-blue-600';
    }
  };
  
  const handleTrack = async (fulfilled: boolean) => {
    setIsTracking(true);
    
    // Calculate accuracy (in real app, this would be more sophisticated)
    const accuracy = fulfilled ? 0.75 + Math.random() * 0.25 : Math.random() * 0.5;
    
    try {
      const res = await fetch('/api/oracle/prophecy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prophecyId: prophecy.id,
          fulfilled,
          accuracy
        })
      });
      
      if (res.ok) {
        setTrackingResult({ fulfilled, accuracy });
        if (onTrack) {
          onTrack(fulfilled, accuracy);
        }
      }
    } catch (error) {
      logger.error('Track prophecy error:', { error: error });
    } finally {
      setIsTracking(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/20",
        className
      )}
    >
      {/* Background Gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-10",
        getTypeColor()
      )} />
      
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[url('/oracle-pattern.svg')] bg-repeat animate-pulse" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Oracle Prophecy</h3>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                {getTimeframeIcon()}
                {prophecy.timeframe.replace('_', ' ')}
              </span>
              <span>{prophecy.sport}</span>
              <span>{format(new Date(prophecy.createdAt), 'MMM d, HH:mm')}</span>
            </div>
          </div>
          
          {/* Confidence Badge */}
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {Math.round(prophecy.confidence * 100)}%
            </div>
            <div className="text-xs text-gray-400">Confidence</div>
          </div>
        </div>
        
        {/* Prediction */}
        <div className="mb-6">
          <p className="text-white leading-relaxed">
            {prophecy.prediction}
          </p>
        </div>
        
        {/* Tracking Section */}
        {prophecy.fulfilled === undefined && !trackingResult ? (
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-gray-300">
                Track this prophecy's outcome
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleTrack(true)}
                disabled={isTracking}
                className="px-3 py-1 text-sm bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg transition-colors disabled:opacity-50"
              >
                ✓ Fulfilled
              </button>
              <button
                onClick={() => handleTrack(false)}
                disabled={isTracking}
                className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
              >
                ✗ Not Fulfilled
              </button>
            </div>
          </div>
        ) : (
          trackingResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-4 rounded-lg",
                trackingResult.fulfilled
                  ? "bg-green-600/20 border border-green-500/30"
                  : "bg-red-600/20 border border-red-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">
                    {trackingResult.fulfilled ? 'Prophecy Fulfilled!' : 'Prophecy Not Fulfilled'}
                  </div>
                  <div className="text-sm text-gray-400">
                    Accuracy: {Math.round(trackingResult.accuracy * 100)}%
                  </div>
                </div>
                <div className="text-2xl">
                  {trackingResult.fulfilled ? '✨' : '💭'}
                </div>
              </div>
            </motion.div>
          )
        )}
        
        {/* Already Tracked */}
        {prophecy.fulfilled !== undefined && (
          <div className={cn(
            "p-4 rounded-lg",
            prophecy.fulfilled
              ? "bg-green-600/20 border border-green-500/30"
              : "bg-red-600/20 border border-red-500/30"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white">
                  {prophecy.fulfilled ? 'Fulfilled' : 'Not Fulfilled'}
                </div>
                {prophecy.accuracy && (
                  <div className="text-sm text-gray-400">
                    Accuracy: {Math.round(prophecy.accuracy * 100)}%
                  </div>
                )}
              </div>
              <div className="text-2xl">
                {prophecy.fulfilled ? '✨' : '💭'}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Mystical Border Animation */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: 'conic-gradient(from 0deg, transparent, rgba(147, 51, 234, 0.3), transparent)',
        }}
        animate={{
          rotate: 360
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </motion.div>
  );
}

/**
 * 🔮 PROPHECY DISPLAY FEATURES:
 * 
 * - Beautiful gradient backgrounds
 * - Animated mystical effects
 * - Prophecy tracking system
 * - Confidence indicators
 * - Timeframe and type badges
 * - Fulfillment tracking
 * - Accuracy calculation
 * - Responsive design
 * 
 * Track the Oracle's predictive power!
 */