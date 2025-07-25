'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Cpu,
  Gauge,
  MemoryStick,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { setupPerformanceObserver, PerformanceMetrics } from '@/lib/utils/performance';

interface ComponentMetrics {
  name: string;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  renderCount: number;
  lastRenderTime: number;
  trend: 'up' | 'down' | 'stable';
}

export const PerformanceMonitor = memo(() => {
  const [metrics, setMetrics] = useState<Map<string, ComponentMetrics>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);
  const metricsRef = useRef<Map<string, ComponentMetrics>>(new Map());
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());

  // FPS monitoring
  useEffect(() => {
    let animationId: number;
    
    const measureFPS = () => {
      frameCountRef.current++;
      const currentTime = performance.now();
      const deltaTime = currentTime - lastFrameTimeRef.current;
      
      if (deltaTime >= 1000) {
        const currentFPS = Math.round((frameCountRef.current * 1000) / deltaTime);
        setFps(currentFPS);
        frameCountRef.current = 0;
        lastFrameTimeRef.current = currentTime;
      }
      
      if (isMonitoring) {
        animationId = requestAnimationFrame(measureFPS);
      }
    };
    
    if (isMonitoring) {
      animationId = requestAnimationFrame(measureFPS);
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isMonitoring]);

  // Memory monitoring
  useEffect(() => {
    if (!isMonitoring) return;
    
    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMemory = memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
        setMemoryUsage(Math.round(usedMemory));
      }
    };
    
    measureMemory();
    const interval = setInterval(measureMemory, 2000);
    
    return () => clearInterval(interval);
  }, [isMonitoring]);

  // Performance observer
  useEffect(() => {
    if (!isMonitoring) return;
    
    const cleanup = setupPerformanceObserver((newMetrics: PerformanceMetrics[]) => {
      const updatedMetrics = new Map(metricsRef.current);
      
      newMetrics.forEach(metric => {
        const existing = updatedMetrics.get(metric.componentName) || {
          name: metric.componentName,
          averageRenderTime: 0,
          maxRenderTime: 0,
          minRenderTime: Infinity,
          renderCount: 0,
          lastRenderTime: 0,
          trend: 'stable' as const
        };
        
        const newRenderCount = existing.renderCount + 1;
        const newAverage = (existing.averageRenderTime * existing.renderCount + metric.renderTime) / newRenderCount;
        const trend = newAverage > existing.averageRenderTime ? 'up' : 
                     newAverage < existing.averageRenderTime ? 'down' : 'stable';
        
        updatedMetrics.set(metric.componentName, {
          name: metric.componentName,
          averageRenderTime: newAverage,
          maxRenderTime: Math.max(existing.maxRenderTime, metric.renderTime),
          minRenderTime: Math.min(existing.minRenderTime, metric.renderTime),
          renderCount: newRenderCount,
          lastRenderTime: metric.renderTime,
          trend
        });
      });
      
      metricsRef.current = updatedMetrics;
      setMetrics(new Map(updatedMetrics));
    });
    
    return cleanup;
  }, [isMonitoring]);

  const sortedMetrics = Array.from(metrics.values()).sort(
    (a, b) => b.averageRenderTime - a.averageRenderTime
  );

  const overallHealth = fps >= 50 && sortedMetrics.every(m => m.averageRenderTime < 16);
  const warningComponents = sortedMetrics.filter(m => m.averageRenderTime > 16);
  const criticalComponents = sortedMetrics.filter(m => m.averageRenderTime > 50);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="bg-gray-900/95 backdrop-blur border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Performance Monitor
          </h3>
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className="text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
          >
            {isMonitoring ? 'Pause' : 'Resume'}
          </button>
        </div>

        {/* Overall Health */}
        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">System Health</span>
            <Badge className={cn(
              "text-xs",
              overallHealth ? "bg-green-500/20 text-green-500" : 
              criticalComponents.length > 0 ? "bg-red-500/20 text-red-500" :
              "bg-yellow-500/20 text-yellow-500"
            )}>
              {overallHealth ? 'Excellent' : 
               criticalComponents.length > 0 ? 'Critical' : 'Warning'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                <Gauge className="w-3 h-3" />
                FPS
              </div>
              <div className={cn(
                "text-lg font-bold",
                fps >= 50 ? "text-green-500" : 
                fps >= 30 ? "text-yellow-500" : "text-red-500"
              )}>
                {fps}
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                <MemoryStick className="w-3 h-3" />
                Memory
              </div>
              <div className="text-lg font-bold">
                {memoryUsage}MB
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                <Cpu className="w-3 h-3" />
                Components
              </div>
              <div className="text-lg font-bold">
                {metrics.size}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Alerts */}
        {(warningComponents.length > 0 || criticalComponents.length > 0) && (
          <div className="mb-4 space-y-2">
            {criticalComponents.map(component => (
              <div key={component.name} className="flex items-center gap-2 p-2 bg-red-500/10 rounded text-xs">
                <AlertCircle className="w-3 h-3 text-red-500" />
                <span className="flex-1">{component.name}</span>
                <span className="text-red-500 font-medium">
                  {component.averageRenderTime.toFixed(1)}ms
                </span>
              </div>
            ))}
            {warningComponents.filter(c => !criticalComponents.includes(c)).map(component => (
              <div key={component.name} className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded text-xs">
                <Clock className="w-3 h-3 text-yellow-500" />
                <span className="flex-1">{component.name}</span>
                <span className="text-yellow-500 font-medium">
                  {component.averageRenderTime.toFixed(1)}ms
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Component Metrics */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <div className="text-xs font-medium text-gray-400 mb-1">Component Render Times</div>
          {sortedMetrics.slice(0, 10).map(component => {
            const isHealthy = component.averageRenderTime < 16;
            const isWarning = component.averageRenderTime >= 16 && component.averageRenderTime < 50;
            
            return (
              <div key={component.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    {component.name}
                    {component.trend === 'up' && (
                      <TrendingUp className="w-3 h-3 text-red-400" />
                    )}
                    {component.trend === 'down' && (
                      <TrendingDown className="w-3 h-3 text-green-400" />
                    )}
                  </span>
                  <span className={cn(
                    "font-medium",
                    isHealthy ? "text-green-500" :
                    isWarning ? "text-yellow-500" : "text-red-500"
                  )}>
                    {component.averageRenderTime.toFixed(1)}ms
                  </span>
                </div>
                <Progress 
                  value={Math.min((component.averageRenderTime / 50) * 100, 100)} 
                  className="h-1"
                />
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Min: {component.minRenderTime.toFixed(1)}ms</span>
                  <span>Max: {component.maxRenderTime.toFixed(1)}ms</span>
                  <span>Count: {component.renderCount}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Target Line */}
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Target: &lt;16ms (60fps)
            </span>
            <span className="flex items-center gap-1">
              {overallHealth ? (
                <>
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">Meeting target</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  <span className="text-yellow-500">Optimization needed</span>
                </>
              )}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;