'use client';

import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  TrendingDown, 
  Activity,
  BarChart3
} from 'lucide-react';
import { PositionScarcity, Sport } from '@/lib/services/traditional-fantasy/draft-analysis/types';

interface ScarcityIndicatorProps {
  positionScarcity: Map<string, PositionScarcity>;
  sport: Sport;
}

export function ScarcityIndicator({ positionScarcity, sport }: ScarcityIndicatorProps) {
  // Convert Map to array and sort by scarcity
  const scarcityData = Array.from(positionScarcity.entries())
    .map(([position, data]) => ({ position, ...data }))
    .sort((a, b) => b.scarcityIndex - a.scarcityIndex);

  const getScarcityColor = (scarcityIndex: number) => {
    if (scarcityIndex >= 0.8) return 'text-red-500 bg-red-500/20 border-red-500/30';
    if (scarcityIndex >= 0.6) return 'text-orange-500 bg-orange-500/20 border-orange-500/30';
    if (scarcityIndex >= 0.4) return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
    return 'text-green-500 bg-green-500/20 border-green-500/30';
  };

  const getScarcityLabel = (scarcityIndex: number) => {
    if (scarcityIndex >= 0.8) return 'Critical';
    if (scarcityIndex >= 0.6) return 'High';
    if (scarcityIndex >= 0.4) return 'Medium';
    return 'Low';
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-yellow-400" />
        <h2 className="text-xl font-bold">Position Scarcity</h2>
      </div>

      <div className="space-y-3">
        {scarcityData.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Loading scarcity data...
          </p>
        ) : (
          scarcityData.map((data, index) => (
            <motion.div
              key={data.position}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="space-y-2"
            >
              {/* Position Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{data.position}</span>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full border
                    ${getScarcityColor(data.scarcityIndex)}
                  `}>
                    {getScarcityLabel(data.scarcityIndex)}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  {data.remainingStarters} left
                </div>
              </div>

              {/* Scarcity Bar */}
              <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${data.scarcityIndex * 100}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className={`
                    absolute left-0 top-0 h-full rounded-full
                    ${data.scarcityIndex >= 0.8 ? 'bg-red-500' :
                      data.scarcityIndex >= 0.6 ? 'bg-orange-500' :
                      data.scarcityIndex >= 0.4 ? 'bg-yellow-500' :
                      'bg-green-500'}
                  `}
                />
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-400">Drop-off:</span>
                  <span className="font-semibold">{data.dropOffPoints.toFixed(1)} pts</span>
                </div>
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-400">S/D:</span>
                  <span className="font-semibold">{data.supplyDemandRatio.toFixed(2)}</span>
                </div>
              </div>

              {/* Run Prediction */}
              {data.projectedRun.probability > 0.5 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
                  <AlertTriangle className="w-3 h-3 text-yellow-500" />
                  <span className="text-yellow-400">
                    {Math.round(data.projectedRun.probability * 100)}% chance of run 
                    ({data.projectedRun.expectedPicks} picks)
                  </span>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-xs text-gray-400 mb-2">Scarcity Levels:</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>Critical (80%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>High (60-80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span>Medium (40-60%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>Low (&lt;40%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}