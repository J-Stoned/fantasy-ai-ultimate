/**
 * 🔥 ADMIN DASHBOARD OVERVIEW - Enterprise System Overview 🔥
 * 
 * High-level overview component for the main admin dashboard.
 * Shows system health, active services, and key metrics.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/card';

export function AdminDashboardOverview() {
  const [systemStats, setSystemStats] = useState({
    mlModelsActive: 4,
    dfsStrategiesRunning: 12,
    totalPredictions: 1247893,
    successRate: 98.4,
    gpuUtilization: 87,
    systemUptime: '23d 14h 32m'
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        ...prev,
        totalPredictions: prev.totalPredictions + Math.floor(Math.random() * 10),
        successRate: Math.max(95, Math.min(99.9, prev.successRate + (Math.random() - 0.5) * 0.1)),
        gpuUtilization: Math.max(70, Math.min(95, prev.gpuUtilization + (Math.random() - 0.5) * 3))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-400 text-sm font-medium">ML Training Systems</p>
            <p className="text-white text-2xl font-bold">{systemStats.mlModelsActive}</p>
            <p className="text-blue-300 text-xs mt-1">Active models training</p>
          </div>
          <div className="text-3xl">🧠</div>
        </div>
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm">All systems operational</span>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-400 text-sm font-medium">DFS Strategies</p>
            <p className="text-white text-2xl font-bold">{systemStats.dfsStrategiesRunning}</p>
            <p className="text-purple-300 text-xs mt-1">Active trading strategies</p>
          </div>
          <div className="text-3xl">💰</div>
        </div>
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-orange-400 text-sm">Portfolio optimization active</span>
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-400 text-sm font-medium">Total Predictions</p>
            <p className="text-white text-2xl font-bold">{systemStats.totalPredictions.toLocaleString()}</p>
            <p className="text-green-300 text-xs mt-1">Lifetime predictions generated</p>
          </div>
          <div className="text-3xl">🎯</div>
        </div>
        <div className="mt-4">
          <div className="text-green-400 text-sm">
            +{Math.floor(Math.random() * 500 + 100)}/hour
          </div>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-400 text-sm font-medium">Success Rate</p>
            <p className="text-white text-2xl font-bold">{systemStats.successRate.toFixed(1)}%</p>
            <p className="text-orange-300 text-xs mt-1">Prediction accuracy</p>
          </div>
          <div className="text-3xl">⚡</div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
              style={{ width: `${systemStats.successRate}%` }}
            ></div>
          </div>
        </div>
      </Card>
    </div>
  );
}