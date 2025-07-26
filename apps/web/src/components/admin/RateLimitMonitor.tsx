/**
 * 🛡️ RATE LIMIT MONITORING DASHBOARD 🛡️
 * Real-time monitoring of API rate limits and blocked IPs
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Ban,
  Clock,
  Users,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { logger } from '../../lib/logging/logger';

interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  topViolators: Array<{
    identifier: string;
    violations: number;
    type: 'ip' | 'user' | 'apiKey';
  }>;
  blockedIPs: Array<{
    ip: string;
    blockedAt: string;
    reason: string;
    remainingTime: number;
  }>;
  endpointStats: Record<string, {
    requests: number;
    blocked: number;
    avgResponseTime: number;
  }>;
}

interface RealTimeMetric {
  timestamp: number;
  requests: number;
  blocked: number;
  responseTime: number;
}

export function RateLimitMonitor() {
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch rate limit statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/rate-limits/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      logger.error('Failed to fetch rate limit stats:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  // Unblock an IP address
  const unblockIP = async (ip: string) => {
    try {
      const response = await fetch(`/api/admin/rate-limits/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      
      if (response.ok) {
        // Refresh stats
        fetchStats();
      }
    } catch (error) {
      logger.error('Failed to unblock IP:', { error: error });
    }
  };

  // Set up WebSocket for real-time updates
  useEffect(() => {
    fetchStats();
    
    // WebSocket connection for real-time metrics
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/admin/rate-limits/stream`
    );
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'metric') {
        setRealTimeMetrics(prev => {
          const updated = [...prev, data.metric];
          // Keep only last 60 data points (1 minute of data)
          return updated.slice(-60);
        });
      } else if (data.type === 'stats') {
        setStats(data.stats);
      }
    };
    
    // Auto-refresh every 10 seconds
    const interval = autoRefresh ? setInterval(fetchStats, 10000) : null;
    
    return () => {
      ws.close();
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const blockRate = stats ? (stats.blockedRequests / stats.totalRequests) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Rate Limit Monitor</h2>
        </div>
        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
          {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalRequests.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
            <Ban className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats?.blockedRequests.toLocaleString() || '0'}
            </div>
            <Progress value={blockRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {blockRate.toFixed(1)}% block rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique IPs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.uniqueIPs.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {stats?.blockedIPs.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Activity Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Real-time Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 relative">
            {/* Simple line graph visualization */}
            <svg className="w-full h-full">
              {realTimeMetrics.length > 1 && (
                <>
                  {/* Requests line */}
                  <polyline
                    fill="none"
                    stroke="rgb(34 197 94)"
                    strokeWidth="2"
                    points={realTimeMetrics
                      .map((m, i) => 
                        `${(i / (realTimeMetrics.length - 1)) * 100}%,${
                          100 - (m.requests / Math.max(...realTimeMetrics.map(m => m.requests))) * 90
                        }%`
                      )
                      .join(' ')}
                  />
                  {/* Blocked line */}
                  <polyline
                    fill="none"
                    stroke="rgb(239 68 68)"
                    strokeWidth="2"
                    points={realTimeMetrics
                      .map((m, i) => 
                        `${(i / (realTimeMetrics.length - 1)) * 100}%,${
                          100 - (m.blocked / Math.max(...realTimeMetrics.map(m => m.requests))) * 90
                        }%`
                      )
                      .join(' ')}
                  />
                </>
              )}
            </svg>
            <div className="absolute bottom-0 left-0 text-xs text-muted-foreground">
              <span className="text-green-500">● Allowed</span>
              <span className="ml-4 text-red-500">● Blocked</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Violators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Top Violators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.topViolators.map((violator, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-muted-foreground">
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{violator.identifier}</p>
                    <Badge variant="outline" className="text-xs">
                      {violator.type}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-destructive">
                    {violator.violations}
                  </p>
                  <p className="text-xs text-muted-foreground">violations</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Blocked IPs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Blocked IPs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats?.blockedIPs.map((blocked) => (
              <div key={blocked.ip} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Shield className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-mono font-medium">{blocked.ip}</p>
                    <p className="text-sm text-muted-foreground">{blocked.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {Math.floor(blocked.remainingTime / 60)}m remaining
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Blocked {new Date(blocked.blockedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unblockIP(blocked.ip)}
                  >
                    Unblock
                  </Button>
                </div>
              </div>
            ))}
            {(!stats?.blockedIPs || stats.blockedIPs.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                No IPs currently blocked
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Endpoint Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoint Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats && Object.entries(stats.endpointStats).map(([endpoint, data]) => (
              <div key={endpoint} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{endpoint}</h4>
                  <Badge variant={data.blocked > 0 ? "destructive" : "default"}>
                    {((data.blocked / data.requests) * 100).toFixed(1)}% blocked
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Requests</p>
                    <p className="font-medium">{data.requests.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Blocked</p>
                    <p className="font-medium text-destructive">{data.blocked.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Response</p>
                    <p className="font-medium">{data.avgResponseTime.toFixed(0)}ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}