/**
 * 📊 Query Performance Monitor
 * Real-time database query monitoring and optimization
 */

import { EventEmitter } from 'events';

export interface QueryLog {
  id: string;
  query: string;
  params: any[];
  duration: number;
  rowCount: number;
  timestamp: Date;
  slow: boolean;
  error?: string;
  stackTrace?: string;
}

export interface QueryStats {
  totalQueries: number;
  averageDuration: number;
  slowQueries: number;
  errorQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

export class QueryMonitor extends EventEmitter {
  private queries: QueryLog[] = [];
  private stats: QueryStats = {
    totalQueries: 0,
    averageDuration: 0,
    slowQueries: 0,
    errorQueries: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  
  private slowQueryThreshold = 100; // ms
  private maxQueryLogs = 10000;
  private isMonitoring = true;

  constructor() {
    super();
    
    // Emit stats every 30 seconds
    setInterval(() => {
      if (this.isMonitoring) {
        this.emit('stats', this.getStats());
      }
    }, 30000);
  }

  /**
   * Log a query execution
   */
  logQuery(query: string, params: any[], startTime: number, result: { rowCount: number } | Error): void {
    if (!this.isMonitoring) return;

    const duration = Date.now() - startTime;
    const slow = duration > this.slowQueryThreshold;
    const isError = result instanceof Error;

    const log: QueryLog = {
      id: this.generateQueryId(),
      query: this.sanitizeQuery(query),
      params: this.sanitizeParams(params),
      duration,
      rowCount: isError ? 0 : result.rowCount,
      timestamp: new Date(),
      slow,
      error: isError ? result.message : undefined,
      stackTrace: isError ? this.getStackTrace() : undefined
    };

    this.queries.push(log);
    this.updateStats(log);

    // Emit events for monitoring
    if (slow) {
      this.emit('slowQuery', log);
    }
    if (isError) {
      this.emit('queryError', log);
    }

    // Maintain max log size
    if (this.queries.length > this.maxQueryLogs) {
      this.queries.shift();
    }
  }

  /**
   * Log cache hit/miss
   */
  logCacheAccess(hit: boolean): void {
    if (hit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): QueryStats {
    return { ...this.stats };
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit = 10): QueryLog[] {
    return this.queries
      .filter(q => q.slow)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get most frequent queries
   */
  getFrequentQueries(limit = 10): Array<{ query: string; count: number; avgDuration: number }> {
    const queryMap = new Map<string, { count: number; totalDuration: number }>();

    for (const log of this.queries) {
      const key = log.query;
      const existing = queryMap.get(key) || { count: 0, totalDuration: 0 };
      queryMap.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + log.duration
      });
    }

    return Array.from(queryMap.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get query patterns that might indicate N+1 problems
   */
  detectN1Patterns(): Array<{ pattern: string; count: number; timeWindow: number }> {
    const patterns: Map<string, { timestamps: number[]; query: string }> = new Map();
    const timeWindow = 1000; // 1 second

    // Group similar queries
    for (const log of this.queries) {
      const pattern = this.extractQueryPattern(log.query);
      if (!patterns.has(pattern)) {
        patterns.set(pattern, { timestamps: [], query: log.query });
      }
      patterns.get(pattern)!.timestamps.push(log.timestamp.getTime());
    }

    // Find patterns with multiple executions in short time windows
    const n1Patterns: Array<{ pattern: string; count: number; timeWindow: number }> = [];

    for (const [pattern, data] of patterns.entries()) {
      const timestamps = data.timestamps.sort((a, b) => a - b);
      
      for (let i = 0; i < timestamps.length - 1; i++) {
        let count = 1;
        let j = i + 1;
        
        while (j < timestamps.length && timestamps[j] - timestamps[i] <= timeWindow) {
          count++;
          j++;
        }
        
        if (count >= 3) { // 3+ similar queries in 1 second suggests N+1
          n1Patterns.push({
            pattern: data.query,
            count,
            timeWindow: timestamps[j - 1] - timestamps[i]
          });
          break;
        }
      }
    }

    return n1Patterns.sort((a, b) => b.count - a.count);
  }

  /**
   * Generate optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    details: any;
  }> {
    const recommendations = [];

    // Check for slow queries
    const slowQueries = this.getSlowQueries();
    if (slowQueries.length > 0) {
      recommendations.push({
        type: 'slow_queries',
        severity: 'high',
        message: `${slowQueries.length} slow queries detected (>${this.slowQueryThreshold}ms)`,
        details: slowQueries.slice(0, 3).map(q => ({
          query: q.query.substring(0, 100),
          duration: q.duration,
          timestamp: q.timestamp
        }))
      });
    }

    // Check for N+1 patterns
    const n1Patterns = this.detectN1Patterns();
    if (n1Patterns.length > 0) {
      recommendations.push({
        type: 'n1_queries',
        severity: 'high',
        message: `Potential N+1 query patterns detected`,
        details: n1Patterns.slice(0, 3)
      });
    }

    // Check cache hit rate
    const cacheRate = this.getCacheHitRate();
    if (cacheRate < 50 && this.stats.cacheHits + this.stats.cacheMisses > 100) {
      recommendations.push({
        type: 'low_cache_rate',
        severity: 'medium',
        message: `Low cache hit rate: ${cacheRate.toFixed(1)}%`,
        details: {
          hits: this.stats.cacheHits,
          misses: this.stats.cacheMisses
        }
      });
    }

    // Check for frequent queries that should be cached
    const frequent = this.getFrequentQueries();
    const uncachedFrequent = frequent.filter(q => 
      q.count > 10 && !q.query.includes('/* cached */')
    );
    
    if (uncachedFrequent.length > 0) {
      recommendations.push({
        type: 'uncached_frequent',
        severity: 'medium',
        message: `${uncachedFrequent.length} frequently executed queries should be cached`,
        details: uncachedFrequent.slice(0, 3)
      });
    }

    return recommendations;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.queries = [];
    this.stats = {
      totalQueries: 0,
      averageDuration: 0,
      slowQueries: 0,
      errorQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Toggle monitoring
   */
  setMonitoring(enabled: boolean): void {
    this.isMonitoring = enabled;
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): {
    queries: QueryLog[];
    stats: QueryStats;
    recommendations: any[];
  } {
    return {
      queries: this.queries.slice(-100), // Last 100 queries
      stats: this.getStats(),
      recommendations: this.getOptimizationRecommendations()
    };
  }

  /**
   * Private helper methods
   */
  private generateQueryId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeQuery(query: string): string {
    // Remove excessive whitespace and truncate if too long
    return query.replace(/\s+/g, ' ').trim().substring(0, 500);
  }

  private sanitizeParams(params: any[]): any[] {
    // Don't log sensitive data
    return params.map(p => {
      if (typeof p === 'string' && p.length > 50) {
        return `[string:${p.length}]`;
      }
      if (typeof p === 'object' && p !== null) {
        return '[object]';
      }
      return p;
    });
  }

  private extractQueryPattern(query: string): string {
    // Extract query pattern by removing specific values
    return query
      .replace(/'\d+'/g, "'?'")
      .replace(/=\s*\d+/g, "= ?")
      .replace(/IN\s*\([^)]+\)/gi, "IN (?)")
      .trim();
  }

  private getStackTrace(): string {
    const stack = new Error().stack || '';
    const lines = stack.split('\n').slice(3, 8); // Skip monitor frames
    return lines.join('\n');
  }

  private updateStats(log: QueryLog): void {
    this.stats.totalQueries++;
    
    if (log.slow) {
      this.stats.slowQueries++;
    }
    
    if (log.error) {
      this.stats.errorQueries++;
    }
    
    // Update average duration
    const totalDuration = this.queries.reduce((sum, q) => sum + q.duration, 0);
    this.stats.averageDuration = totalDuration / this.queries.length;
  }

  private getCacheHitRate(): number {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return total > 0 ? (this.stats.cacheHits / total) * 100 : 0;
  }
}

// Export singleton instance
export const queryMonitor = new QueryMonitor();