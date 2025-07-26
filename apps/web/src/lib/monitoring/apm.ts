/**
 * 🚀 Application Performance Monitoring (APM)
 * Enterprise-grade performance monitoring and analytics
 */

import * as Sentry from '@sentry/nextjs';
import { container } from '../di/container';
import { SERVICE_TOKENS } from '../di/interfaces';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  tags?: Record<string, string>;
  timestamp?: number;
}

interface Transaction {
  name: string;
  operation: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'cancelled';
  data?: Record<string, any>;
  spans: Span[];
}

interface Span {
  name: string;
  startTime: number;
  endTime?: number;
  data?: Record<string, any>;
}

class APMService {
  private transactions = new Map<string, Transaction>();
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Reduced to prevent memory issues
  private readonly metricsRetentionMs = 60 * 60 * 1000; // 1 hour
  private flushInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic metric flushing
    this.startMetricFlushing();
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Start a new transaction
   */
  startTransaction(name: string, operation: string): string {
    const transactionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const transaction: Transaction = {
      name,
      operation,
      startTime: performance.now(),
      status: 'ok',
      spans: [],
    };

    this.transactions.set(transactionId, transaction);

    // Start Sentry transaction
    const sentryTransaction = Sentry.startTransaction({
      op: operation,
      name: name,
    });
    Sentry.getCurrentHub().configureScope(scope => scope.setSpan(sentryTransaction));

    return transactionId;
  }

  /**
   * End a transaction
   */
  endTransaction(transactionId: string, status: 'ok' | 'error' | 'cancelled' = 'ok') {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    transaction.endTime = performance.now();
    transaction.status = status;

    // Record transaction metric
    this.recordMetric({
      name: `transaction.${transaction.operation}`,
      value: transaction.endTime - transaction.startTime,
      unit: 'ms',
      tags: {
        status,
        name: transaction.name,
      },
    });

    // Finish Sentry transaction
    const sentryTransaction = Sentry.getCurrentHub().getScope()?.getSpan();
    if (sentryTransaction) {
      sentryTransaction.setStatus(status === 'ok' ? 'ok' : 'internal_error');
      sentryTransaction.finish();
    }

    // Clean up
    this.transactions.delete(transactionId);
  }

  /**
   * Add a span to a transaction
   */
  startSpan(transactionId: string, name: string): number {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return -1;

    const span: Span = {
      name,
      startTime: performance.now(),
    };

    transaction.spans.push(span);
    return transaction.spans.length - 1;
  }

  /**
   * End a span
   */
  endSpan(transactionId: string, spanIndex: number) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || !transaction.spans[spanIndex]) return;

    const span = transaction.spans[spanIndex];
    span.endTime = performance.now();

    // Record span metric
    this.recordMetric({
      name: `span.${span.name}`,
      value: span.endTime - span.startTime,
      unit: 'ms',
      tags: {
        transaction: transaction.name,
      },
    });
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric) {
    // Add timestamp if not provided
    if (!metric.timestamp) {
      metric.timestamp = Date.now();
    }

    // Add to metrics array
    this.metrics.push(metric);

    // Trim if exceeding max
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Send to Sentry as custom metric
    Sentry.metrics.increment(metric.name, metric.value, {
      unit: metric.unit,
      tags: metric.tags,
    });
  }

  /**
   * Record API endpoint performance
   */
  recordApiPerformance(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    size?: number
  ) {
    this.recordMetric({
      name: 'api.request',
      value: duration,
      unit: 'ms',
      tags: {
        endpoint,
        method,
        status: status.toString(),
        statusGroup: `${Math.floor(status / 100)}xx`,
      },
    });

    if (size) {
      this.recordMetric({
        name: 'api.response_size',
        value: size,
        unit: 'bytes',
        tags: {
          endpoint,
          method,
        },
      });
    }
  }

  /**
   * Record database query performance
   */
  recordDatabaseQuery(
    query: string,
    duration: number,
    rowCount?: number,
    error?: boolean
  ) {
    this.recordMetric({
      name: 'db.query',
      value: duration,
      unit: 'ms',
      tags: {
        query: query.substring(0, 50), // First 50 chars
        status: error ? 'error' : 'success',
      },
    });

    if (rowCount !== undefined) {
      this.recordMetric({
        name: 'db.rows',
        value: rowCount,
        unit: 'count',
        tags: {
          query: query.substring(0, 50),
        },
      });
    }
  }

  /**
   * Record cache performance
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    hit: boolean,
    duration: number,
    key?: string
  ) {
    this.recordMetric({
      name: `cache.${operation}`,
      value: duration,
      unit: 'ms',
      tags: {
        hit: hit.toString(),
        key: key?.substring(0, 30),
      },
    });

    // Track cache hit rate
    if (operation === 'get') {
      this.recordMetric({
        name: 'cache.hit_rate',
        value: hit ? 100 : 0,
        unit: 'percent',
      });
    }
  }

  /**
   * Record WebSocket metrics
   */
  recordWebSocketMetric(
    event: 'connection' | 'message' | 'error' | 'disconnect',
    room?: string
  ) {
    this.recordMetric({
      name: `websocket.${event}`,
      value: 1,
      unit: 'count',
      tags: {
        room: room || 'global',
      },
    });
  }

  /**
   * Record ML model performance
   */
  recordMLPrediction(
    model: string,
    duration: number,
    inputSize: number,
    success: boolean
  ) {
    this.recordMetric({
      name: 'ml.prediction',
      value: duration,
      unit: 'ms',
      tags: {
        model,
        status: success ? 'success' : 'error',
        inputSizeGroup: inputSize < 100 ? 'small' : inputSize < 1000 ? 'medium' : 'large',
      },
    });
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Filter recent metrics
    const recentMetrics = this.metrics.filter(m => m.timestamp! > fiveMinutesAgo);

    // Group by metric name
    const grouped = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    // Calculate statistics
    for (const [name, values] of Object.entries(grouped)) {
      const sorted = values.sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      
      summary[name] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: sum / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    }

    return summary;
  }

  /**
   * Start periodic metric flushing
   */
  private startMetricFlushing() {
    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000);
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup() {
    // Clean up old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up old metrics and transactions
   */
  private cleanupOldMetrics() {
    const now = Date.now();
    const cutoff = now - this.metricsRetentionMs;
    
    // Clean up metrics
    this.metrics = this.metrics.filter(m => m.timestamp! > cutoff);
    
    // Clean up old transactions (older than 1 hour)
    for (const [id, transaction] of this.transactions.entries()) {
      if (transaction.startTime < performance.now() - 3600000) {
        this.transactions.delete(id);
      }
    }
  }

  /**
   * Flush metrics to external service
   */
  private async flushMetrics() {
    if (this.metrics.length === 0) return;

    try {
      const logger = container.resolve(SERVICE_TOKENS.Logger);
      
      // In production, send to APM service
      if (process.env.NODE_ENV === 'production') {
        // This would send to Datadog, New Relic, etc.
        logger.info('APM metrics flushed', {
          count: this.metrics.length,
          summary: this.getMetricsSummary(),
        });
      }

      // Clear old metrics
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      this.metrics = this.metrics.filter(m => m.timestamp! > oneHourAgo);
    } catch (error) {
      // Failed to flush metrics - error handled internally
      // Avoid console usage in production
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.flushMetrics();
    this.transactions.clear();
    this.metrics = [];
  }
}

// Export singleton instance
export const apm = new APMService();

// Export decorator for method timing
export function MeasurePerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const transactionId = apm.startTransaction(
      `${target.constructor.name}.${propertyKey}`,
      'method'
    );

    try {
      const result = await originalMethod.apply(this, args);
      apm.endTransaction(transactionId, 'ok');
      return result;
    } catch (error) {
      apm.endTransaction(transactionId, 'error');
      throw error;
    }
  };

  return descriptor;
}

// Export middleware for Express/Next.js
export function apmMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const transactionId = apm.startTransaction(
      `${req.method} ${req.path}`,
      'http.request'
    );

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Date.now() - start;
      
      apm.recordApiPerformance(
        req.path,
        req.method,
        duration,
        res.statusCode,
        res.get('content-length')
      );
      
      apm.endTransaction(transactionId, res.statusCode < 400 ? 'ok' : 'error');
      
      originalEnd.apply(res, args);
    };

    next();
  };
}