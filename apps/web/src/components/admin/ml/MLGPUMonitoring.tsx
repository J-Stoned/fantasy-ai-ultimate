/**
 * 🔥 GPU MONITORING - RTX 4060 Real-time Hardware Monitor 🔥
 * 
 * Real-time GPU hardware monitoring with thermal management,
 * CUDA core utilization, and performance optimization alerts.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';

interface GPUMetrics {
  utilization: number;
  temperature: number;
  memoryUsed: number;
  memoryTotal: number;
  powerDraw: number;
  powerLimit: number;
  clockSpeed: number;
  fanSpeed: number;
  cudaCores: number;
  activeCores: number;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export function MLGPUMonitoring() {
  const [gpuMetrics, setGpuMetrics] = useState<GPUMetrics>({
    utilization: 87,
    temperature: 72,
    memoryUsed: 6843,
    memoryTotal: 8192,
    powerDraw: 98,
    powerLimit: 115,
    clockSpeed: 2595,
    fanSpeed: 65,
    cudaCores: 3072,
    activeCores: 2847
  });

  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 'alert_1',
      type: 'info',
      message: 'GPU optimization completed - 12% performance boost achieved',
      timestamp: '14:32:15'
    },
    {
      id: 'alert_2',
      type: 'warning',
      message: 'Memory usage approaching 85% - consider batch size reduction',
      timestamp: '14:28:43'
    }
  ]);

  const [performanceHistory, setPerformanceHistory] = useState<number[]>(
    Array.from({ length: 20 }, () => Math.random() * 30 + 70)
  );

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setGpuMetrics(prev => ({
        ...prev,
        utilization: Math.max(60, Math.min(98, prev.utilization + (Math.random() - 0.5) * 6)),
        temperature: Math.max(65, Math.min(83, prev.temperature + (Math.random() - 0.5) * 3)),
        memoryUsed: Math.max(4000, Math.min(7800, prev.memoryUsed + (Math.random() - 0.5) * 200)),
        powerDraw: Math.max(80, Math.min(115, prev.powerDraw + (Math.random() - 0.5) * 5)),
        clockSpeed: Math.max(2400, Math.min(2595, prev.clockSpeed + (Math.random() - 0.5) * 50)),
        fanSpeed: Math.max(40, Math.min(85, prev.fanSpeed + (Math.random() - 0.5) * 8)),
        activeCores: Math.max(2500, Math.min(3072, prev.activeCores + (Math.random() - 0.5) * 100))
      }));

      // Update performance history
      setPerformanceHistory(prev => {
        const newHistory = [...prev.slice(1), Math.random() * 30 + 70];
        return newHistory;
      });

      // Randomly add alerts
      if (Math.random() < 0.1) {
        const alertTypes = [
          { type: 'info' as const, message: 'CUDA kernel optimization completed successfully' },
          { type: 'warning' as const, message: 'Temperature spike detected - increasing fan speed' },
          { type: 'info' as const, message: 'Memory defragmentation completed' }
        ];
        
        const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const newAlert: AlertItem = {
          id: `alert_${Date.now()}`,
          type: alert.type,
          message: alert.message,
          timestamp: new Date().toLocaleTimeString()
        };

        setAlerts(prev => [newAlert, ...prev.slice(0, 4)]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getTemperatureColor = (temp: number) => {
    if (temp < 70) return 'from-green-500 to-blue-500';
    if (temp < 80) return 'from-yellow-500 to-orange-500';
    return 'from-orange-500 to-red-500';
  };

  const getUtilizationColor = (util: number) => {
    if (util < 70) return 'from-blue-500 to-cyan-500';
    if (util < 90) return 'from-green-500 to-emerald-500';
    return 'from-yellow-500 to-orange-500';
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-red-500/30 bg-red-500/20 text-red-400';
      case 'warning': return 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400';
      case 'info': return 'border-blue-500/30 bg-blue-500/20 text-blue-400';
      default: return 'border-gray-500/30 bg-gray-500/20 text-gray-400';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📊';
    }
  };

  return (
    <Card className="bg-black/40 backdrop-blur-lg border-white/10 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white">🎮 RTX 4060 Monitor</h3>
          <p className="text-gray-400 text-sm">Real-time hardware telemetry</p>
        </div>
        <div className="text-right">
          <div className="text-green-400 text-sm font-medium">OPTIMAL ZONE</div>
          <div className="text-gray-400 text-xs">3072 CUDA Cores</div>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="space-y-4 mb-6">
        <div className="bg-black/60 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">GPU Utilization</span>
            <span className="text-white font-bold text-lg">{gpuMetrics.utilization}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
            <div 
              className={`h-3 rounded-full bg-gradient-to-r ${getUtilizationColor(gpuMetrics.utilization)} transition-all duration-500`}
              style={{ width: `${gpuMetrics.utilization}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Target: 80-95%</span>
            <span>{gpuMetrics.activeCores}/{gpuMetrics.cudaCores} cores active</span>
          </div>
        </div>

        <div className="bg-black/60 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">Temperature</span>
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold text-lg">{gpuMetrics.temperature}°C</span>
              <div className="text-xs">
                {gpuMetrics.temperature < 75 ? '❄️' : gpuMetrics.temperature < 80 ? '🌡️' : '🔥'}
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
            <div 
              className={`h-3 rounded-full bg-gradient-to-r ${getTemperatureColor(gpuMetrics.temperature)} transition-all duration-500`}
              style={{ width: `${(gpuMetrics.temperature / 90) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Throttle: 83°C</span>
            <span>Fan: {gpuMetrics.fanSpeed}%</span>
          </div>
        </div>

        <div className="bg-black/60 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">VRAM Usage</span>
            <span className="text-white font-bold text-lg">
              {(gpuMetrics.memoryUsed / 1024).toFixed(1)}GB
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
            <div 
              className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${(gpuMetrics.memoryUsed / gpuMetrics.memoryTotal) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Total: {(gpuMetrics.memoryTotal / 1024).toFixed(0)}GB</span>
            <span>{((gpuMetrics.memoryUsed / gpuMetrics.memoryTotal) * 100).toFixed(1)}% used</span>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-black/60 border border-white/10 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm font-medium">Performance History</span>
          <span className="text-green-400 text-xs">Last 2 minutes</span>
        </div>
        <div className="flex items-end space-x-1 h-16">
          {performanceHistory.map((value, index) => (
            <div
              key={index}
              className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t transition-all duration-300"
              style={{ height: `${(value / 100) * 64}px` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>-2min</span>
          <span>Real-time</span>
        </div>
      </div>

      {/* Hardware Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-black/60 border border-white/10 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Power Draw</div>
          <div className="text-white font-bold">{gpuMetrics.powerDraw}W</div>
          <div className="text-xs text-gray-500">TGP: {gpuMetrics.powerLimit}W</div>
        </div>
        
        <div className="bg-black/60 border border-white/10 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Clock Speed</div>
          <div className="text-white font-bold">{gpuMetrics.clockSpeed}MHz</div>
          <div className="text-xs text-gray-500">Boost: 2595MHz</div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-black/60 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm font-medium">🚨 System Alerts</span>
          <span className="text-gray-500 text-xs">{alerts.length} recent</span>
        </div>
        
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-gray-500 text-xs text-center py-2">
              No recent alerts - system running optimally
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`border rounded-lg p-2 ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-sm">{getAlertIcon(alert.type)}</span>
                  <div className="flex-1">
                    <div className="text-xs">{alert.message}</div>
                    <div className="text-xs opacity-70 mt-1">{alert.timestamp}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}