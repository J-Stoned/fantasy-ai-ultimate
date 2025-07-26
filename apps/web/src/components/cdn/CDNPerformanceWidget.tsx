'use client';

import { useEffect, useState } from 'react';
import { useCDN } from '@/hooks/useCDN';
import { formatDistanceToNow } from 'date-fns';
import { 
  ArrowUpIcon, 
  ArrowDownIcon,
  CloudArrowUpIcon,
  GlobeAltIcon,
  BoltIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface CDNPerformanceWidgetProps {
  className?: string;
  compact?: boolean;
}

export function CDNPerformanceWidget({ 
  className = '', 
  compact = false 
}: CDNPerformanceWidgetProps) {
  const { metrics, loading, error } = useCDN();
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [previousMetrics, setPreviousMetrics] = useState(metrics);

  // Calculate trend
  useEffect(() => {
    if (metrics && previousMetrics) {
      const diff = metrics.cacheHitRate - previousMetrics.cacheHitRate;
      if (diff > 1) setTrend('up');
      else if (diff < -1) setTrend('down');
      else setTrend('stable');
    }
    if (metrics) setPreviousMetrics(metrics);
  }, [metrics, previousMetrics]);

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-800 rounded-lg p-4 ${className}`}>
        <p className="text-red-400 text-sm">Failed to load CDN metrics</p>
      </div>
    );
  }

  if (!metrics) return null;

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toString();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (compact) {
    return (
      <div className={`bg-gray-800 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CloudArrowUpIcon className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-gray-400">CDN Performance</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-lg font-bold text-white">
              {metrics.cacheHitRate.toFixed(1)}%
            </span>
            {trend === 'up' && <ArrowUpIcon className="h-4 w-4 text-green-400" />}
            {trend === 'down' && <ArrowDownIcon className="h-4 w-4 text-red-400" />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <CloudArrowUpIcon className="h-6 w-6 text-blue-400" />
          <span>CDN Performance</span>
        </h3>
        <span className="text-xs text-gray-500">
          Updated {formatDistanceToNow(metrics.timestamp, { addSuffix: true })}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cache Hit Rate */}
        <div className="bg-gray-900 rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Cache Hit Rate</span>
            {trend === 'up' && <ArrowUpIcon className="h-4 w-4 text-green-400" />}
            {trend === 'down' && <ArrowDownIcon className="h-4 w-4 text-red-400" />}
          </div>
          <div className="text-2xl font-bold text-white">
            {metrics.cacheHitRate.toFixed(1)}%
          </div>
          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: `${metrics.cacheHitRate}%` }}
            />
          </div>
        </div>

        {/* Bandwidth Saved */}
        <div className="bg-gray-900 rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Bandwidth Saved</span>
            <ChartBarIcon className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatBytes(metrics.bandwidthSaved)}
          </div>
          <div className="text-xs text-green-400 mt-1">
            ≈ ${(metrics.bandwidthSaved / (1024 * 1024 * 1024) * 0.08).toFixed(2)} saved
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-gray-900 rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Response</span>
            <BoltIcon className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {metrics.averageResponseTime.toFixed(0)}ms
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.averageResponseTime < 100 ? 'Excellent' : 
             metrics.averageResponseTime < 300 ? 'Good' : 
             metrics.averageResponseTime < 500 ? 'Fair' : 'Needs improvement'}
          </div>
        </div>

        {/* Global Reach */}
        <div className="bg-gray-900 rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Edge Locations</span>
            <GlobeAltIcon className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {metrics.edgeLocations.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatNumber(metrics.requestsServed)} requests
          </div>
        </div>
      </div>

      {/* Top Locations */}
      {metrics.edgeLocations.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Top Edge Locations</h4>
          <div className="space-y-2">
            {metrics.edgeLocations.slice(0, 3).map((location, i) => (
              <div key={location.location} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-medium text-gray-500">{i + 1}</span>
                  <span className="text-sm text-white">{location.location}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-400">
                    {formatNumber(location.requests)} reqs
                  </span>
                  <span className="text-sm text-green-400">
                    {location.cacheHitRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Paths */}
      {metrics.topPaths.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Most Requested Resources</h4>
          <div className="space-y-2">
            {metrics.topPaths.slice(0, 3).map((path, i) => (
              <div key={path.path} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-medium text-gray-500">{i + 1}</span>
                  <span className="text-sm text-white font-mono truncate max-w-xs">
                    {path.path}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-400">
                    {formatNumber(path.requests)}
                  </span>
                  <span className="text-sm text-blue-400">
                    {formatBytes(path.bandwidth)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}