'use client';

import { useEffect, useState } from 'react';

interface DatabaseStats {
  totalGames: number;
  completedGames: number;
  totalPlayers: number;
  activePlayers: number;
  totalTeams: number;
  playerStats: number;
  injuries: number;
  weatherData: number;
  newsArticles: number;
  totalRecords: number;
}

interface PatternStats {
  totalPatterns: number;
  averageAccuracy: number;
  bestPattern: {
    name: string;
    accuracy: number;
    roi: number;
  };
  totalOpportunities: number;
  potentialProfit: number;
}

interface StatsOverview {
  database: DatabaseStats;
  patterns: PatternStats;
  dataCollection: {
    gamesAnalyzed: number;
    dataPoints: number;
    lastUpdate: string;
    updateFrequency: string;
  };
  models: {
    ensembleAccuracy: number;
    modelsActive: number;
    lastTraining: string;
    gpuEnabled: boolean;
  };
  system: {
    status: string;
    uptime: string;
    responseTime: string;
    version: string;
  };
}

export function RealTimeStats() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats/overview');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white/10 backdrop-blur-lg rounded-lg p-4 h-20"></div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-500/10 backdrop-blur-lg rounded-lg p-4 text-red-200">
        {error || 'No statistics available'}
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
          <h3 className="text-xs md:text-sm font-medium text-gray-300">Games Analyzed</h3>
          <p className="text-xl md:text-2xl font-bold text-white mt-1">
            {formatNumber(stats.database.completedGames)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            of {formatNumber(stats.database.totalGames)} total
          </p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
          <h3 className="text-xs md:text-sm font-medium text-gray-300">Active Players</h3>
          <p className="text-xl md:text-2xl font-bold text-white mt-1">
            {formatNumber(stats.database.activePlayers)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatNumber(stats.database.totalPlayers)} total
          </p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
          <h3 className="text-xs md:text-sm font-medium text-gray-300">Pattern Accuracy</h3>
          <p className="text-xl md:text-2xl font-bold text-green-400 mt-1">
            {stats.patterns.averageAccuracy}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Best: {stats.patterns.bestPattern.accuracy}%
          </p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
          <h3 className="text-xs md:text-sm font-medium text-gray-300">Profit Potential</h3>
          <p className="text-xl md:text-2xl font-bold text-yellow-400 mt-1">
            {formatCurrency(stats.patterns.potentialProfit)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatNumber(stats.patterns.totalOpportunities)} opportunities
          </p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400">Player Stats</h4>
          <p className="text-lg font-bold text-white mt-1">
            {formatNumber(stats.database.playerStats)}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400">Injuries</h4>
          <p className="text-lg font-bold text-white mt-1">
            {formatNumber(stats.database.injuries)}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400">Weather Data</h4>
          <p className="text-lg font-bold text-white mt-1">
            {formatNumber(stats.database.weatherData)}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400">News Articles</h4>
          <p className="text-lg font-bold text-white mt-1">
            {formatNumber(stats.database.newsArticles)}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400">ML Models</h4>
          <p className="text-lg font-bold text-white mt-1">
            {stats.models.modelsActive}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400">System Status</h4>
          <p className="text-lg font-bold text-green-400 mt-1">
            {stats.system.status}
          </p>
        </div>
      </div>

      {/* Pattern Performance */}
      <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Pattern Performance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-white">{stats.patterns.bestPattern.name}</p>
            <p className="text-xs text-gray-400">Best performing pattern</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-400">{stats.patterns.bestPattern.accuracy}%</p>
            <p className="text-xs text-gray-400">{stats.patterns.bestPattern.roi}% ROI</p>
          </div>
        </div>
      </div>

      {/* Last Update */}
      <div className="text-xs text-gray-500 text-center">
        Last updated: {new Date(stats.dataCollection.lastUpdate).toLocaleString()}
      </div>
    </div>
  );
}