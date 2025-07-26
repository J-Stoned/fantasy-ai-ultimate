/**
 * 🚀 Performance Monitoring Dashboard
 * Real-time APM visualization
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Zap, 
  Database, 
  Globe,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Wifi
} from 'lucide-react';

interface PerformanceMetrics {
  api: {
    requestsPerSecond: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    activeRequests: number;
  };
  database: {
    activeConnections: number;
    queryTime: number;
    slowQueries: number;
    connectionPoolUsage: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
    memoryUsage: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskIO: number;
    networkIO: number;
  };
  ml: {
    predictionsPerMinute: number;
    avgPredictionTime: number;
    gpuUtilization: number;
    modelLoadTime: number;
  };
  websocket: {
    activeConnections: number;
    messagesPerSecond: number;
    avgLatency: number;
    reconnections: number;
  };
}

interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  lastCheck: string;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'5m' | '1h' | '24h'>('5m');

  useEffect(() => {
    fetchMetrics();
    fetchHealthStatus();

    // Set up polling
    const interval = setInterval(() => {
      fetchMetrics();
      fetchHealthStatus();
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/admin/metrics?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      // Error handled by try-catch, metrics won't update
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data.checks || []);
      }
    } catch (error) {
      // Error handled by try-catch, health status won't update
    }
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-500';
    if (value <= thresholds.warning) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Performance Monitor</h2>
        </div>
        <div className="flex gap-2">
          {(['5m', '1h', '24h'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-primary text-white'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {healthStatus.map((status) => (
              <div key={status.component} className="flex items-center gap-3 p-3 border rounded-lg">
                {getHealthIcon(status.status)}
                <div>
                  <p className="font-medium">{status.component}</p>
                  <p className="text-sm text-muted-foreground">{status.message}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            API Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Requests/sec</p>
              <p className="text-2xl font-bold">{metrics.api.requestsPerSecond.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.api.avgResponseTime, { good: 100, warning: 300 })}`}>
                {metrics.api.avgResponseTime.toFixed(0)}ms
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Error Rate</p>
              <p className={`text-2xl font-bold ${getStatusColor(metrics.api.errorRate, { good: 1, warning: 5 })}`}>
                {metrics.api.errorRate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">P95 Response Time</p>
              <p className="text-lg font-medium">{metrics.api.p95ResponseTime.toFixed(0)}ms</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">P99 Response Time</p>
              <p className="text-lg font-medium">{metrics.api.p99ResponseTime.toFixed(0)}ms</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Requests</p>
              <p className="text-lg font-medium">{metrics.api.activeRequests}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Active Connections</p>
                <p className="text-xl font-bold">{metrics.database.activeConnections}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Query Time</p>
                <p className={`text-xl font-bold ${getStatusColor(metrics.database.queryTime, { good: 50, warning: 200 })}`}>
                  {metrics.database.queryTime.toFixed(0)}ms
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Slow Queries</p>
                <p className={`text-xl font-bold ${metrics.database.slowQueries > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {metrics.database.slowQueries}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pool Usage</p>
                <p className="text-xl font-bold">{metrics.database.connectionPoolUsage}%</p>
              </div>
            </div>
            <Progress value={metrics.database.connectionPoolUsage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* System Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU & Memory */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">CPU Usage</span>
                <span className="text-sm font-medium">{metrics.system.cpuUsage}%</span>
              </div>
              <Progress value={metrics.system.cpuUsage} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Memory Usage</span>
                <span className="text-sm font-medium">{metrics.system.memoryUsage}%</span>
              </div>
              <Progress value={metrics.system.memoryUsage} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Disk I/O</span>
                <span className="text-sm font-medium">{metrics.system.diskIO} MB/s</span>
              </div>
              <Progress value={Math.min(metrics.system.diskIO / 100 * 100, 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Cache Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Cache Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Hit Rate</p>
                <p className="text-xl font-bold text-green-500">{metrics.cache.hitRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Miss Rate</p>
                <p className="text-xl font-bold text-yellow-500">{metrics.cache.missRate.toFixed(1)}%</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Memory Usage</span>
                <span className="text-sm font-medium">{metrics.cache.memoryUsage}%</span>
              </div>
              <Progress value={metrics.cache.memoryUsage} className="h-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Evictions (last hour)</p>
              <p className="text-lg font-medium">{metrics.cache.evictions.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ML & WebSocket Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ML Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              ML Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Predictions/min</span>
                <span className="font-medium">{metrics.ml.predictionsPerMinute}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Prediction Time</span>
                <span className="font-medium">{metrics.ml.avgPredictionTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">GPU Utilization</span>
                <span className="font-medium">{metrics.ml.gpuUtilization}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Model Load Time</span>
                <span className="font-medium">{metrics.ml.modelLoadTime.toFixed(0)}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WebSocket Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              WebSocket Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Connections</span>
                <span className="font-medium">{metrics.websocket.activeConnections.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Messages/sec</span>
                <span className="font-medium">{metrics.websocket.messagesPerSecond.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Latency</span>
                <span className="font-medium">{metrics.websocket.avgLatency.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reconnections</span>
                <span className="font-medium">{metrics.websocket.reconnections}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}