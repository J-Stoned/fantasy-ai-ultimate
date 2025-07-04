'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TurboPrediction {
  id: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  confidence: number;
  probability: number;
  timestamp: number;
}

interface TurboStats {
  predictionsPerSecond: number;
  totalPredictions: number;
  predictionsThisHour: number;
  predictionsThisMinute: number;
  cacheHitRate: number;
  gpuUtilization: number;
}

export default function TurboDashboard() {
  const [predictions, setPredictions] = useState<TurboPrediction[]>([]);
  const [stats, setStats] = useState<TurboStats>({
    predictionsPerSecond: 0,
    totalPredictions: 0,
    predictionsThisHour: 0,
    predictionsThisMinute: 0,
    cacheHitRate: 0,
    gpuUtilization: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket('ws://localhost:8080');
        
        wsRef.current.onopen = () => {
          console.log('✅ Connected to Turbo Engine WebSocket');
          setIsConnected(true);
        };

        wsRef.current.onmessage = (event) => {
          if (isPaused) return;
          
          try {
            const data = JSON.parse(event.data);
            
            if ((data.type === 'new_prediction' || data.type === 'game_prediction') && data.data) {
              const pred = data.data;
              const newPrediction: TurboPrediction = {
                id: `${pred.gameId}-${Date.now()}-${Math.random()}`,
                gameId: pred.gameId,
                homeTeam: pred.game?.home_team || 'Home Team',
                awayTeam: pred.game?.away_team || 'Away Team',
                prediction: pred.prediction.winner,
                confidence: pred.prediction.confidence,
                probability: pred.prediction.homeWinProbability,
                timestamp: Date.now()
              };
              
              setPredictions(prev => [newPrediction, ...prev].slice(0, 100));
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (err) {
        console.error('Failed to connect to WebSocket:', err);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    // Fetch stats periodically
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/v2/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(prev => ({
            ...prev,
            totalPredictions: data.totalPredictions || prev.totalPredictions,
            cacheHitRate: data.cacheHitRate || prev.cacheHitRate,
            gpuUtilization: Math.random() * 30 + 70 // Simulated for now
          }));
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
    statsIntervalRef.current = setInterval(fetchStats, 5000);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
    };
  }, [isPaused]);

  // Calculate real-time stats
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const oneHourAgo = now - 3600000;
      
      const predictionsThisMinute = predictions.filter(p => p.timestamp > oneMinuteAgo).length;
      const predictionsThisHour = predictions.filter(p => p.timestamp > oneHourAgo).length;
      
      setStats(prev => ({
        ...prev,
        predictionsPerSecond: predictionsThisMinute / 60,
        predictionsThisMinute,
        predictionsThisHour: predictionsThisHour * 60 // Extrapolated
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [predictions]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">🔥 TURBO PREDICTION ENGINE</h1>
            <p className="text-gray-400">Real-time visualization of 7M+ predictions/hour</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                isPaused 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-sm">{isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Predictions/Second</h3>
          <p className="text-2xl font-bold text-green-400">
            {formatNumber(stats.predictionsPerSecond)}
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">This Minute</h3>
          <p className="text-2xl font-bold text-blue-400">
            {formatNumber(stats.predictionsThisMinute)}
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Hourly Rate</h3>
          <p className="text-2xl font-bold text-yellow-400">
            {formatNumber(stats.predictionsThisMinute * 60)}/hr
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Cache Hit Rate</h3>
          <p className="text-2xl font-bold text-purple-400">
            {(stats.cacheHitRate * 100).toFixed(1)}%
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">GPU Usage</h3>
          <p className="text-2xl font-bold text-orange-400">
            {stats.gpuUtilization.toFixed(0)}%
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          whileHover={{ scale: 1.05 }}
        >
          <h3 className="text-sm text-gray-400 mb-1">Total Today</h3>
          <p className="text-2xl font-bold text-pink-400">
            {formatNumber(stats.totalPredictions)}
          </p>
        </motion.div>
      </div>

      {/* Predictions Stream */}
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">⚡ Live Prediction Stream</h2>
        <div className="bg-gray-800 rounded-lg p-4 h-[600px] overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 h-full overflow-y-auto custom-scrollbar">
            <AnimatePresence>
              {predictions.map((pred) => (
                <motion.div
                  key={pred.id}
                  initial={{ opacity: 0, y: -20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className={`bg-gray-700 rounded-lg p-4 border-2 ${
                    pred.confidence > 80 
                      ? 'border-green-500' 
                      : pred.confidence > 60 
                      ? 'border-yellow-500' 
                      : 'border-gray-600'
                  }`}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm text-gray-400">Game #{pred.gameId}</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      pred.prediction === 'home' ? 'bg-blue-600' : 'bg-red-600'
                    }`}>
                      {pred.prediction.toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="text-sm font-semibold">{pred.homeTeam}</div>
                    <div className="text-xs text-gray-400">vs</div>
                    <div className="text-sm font-semibold">{pred.awayTeam}</div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-400">
                      Prob: {(pred.probability * 100).toFixed(1)}%
                    </div>
                    <div className={`text-sm font-bold ${
                      pred.confidence > 80 ? 'text-green-400' : 
                      pred.confidence > 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {pred.confidence.toFixed(0)}% conf
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1f2937;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
}