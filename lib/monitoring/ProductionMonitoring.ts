/**
 * 🚨 PRODUCTION MONITORING & ERROR HANDLING
 * 
 * Comprehensive monitoring system with:
 * - OpenTelemetry integration
 * - Prometheus metrics
 * - Error tracking with Sentry
 * - Custom alerts and dashboards
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import * as Sentry from '@sentry/node';
import { register, Counter, Histogram, Gauge, Summary } from 'prom-client';
import chalk from 'chalk';
import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

// Request context for distributed tracing
const requestContext = new AsyncLocalStorage<RequestContext>();

interface RequestContext {
  requestId: string;
  userId?: string;
  span?: any;
}

interface MonitoringConfig {
  serviceName: string;
  environment: string;
  sentryDsn?: string;
  prometheusPort?: number;
  logLevel?: string;
}

export class ProductionMonitoring {
  private tracer: any;
  private logger: winston.Logger;
  
  // Metrics
  private requestCounter: Counter;
  private errorCounter: Counter;
  private requestDuration: Histogram;
  private mlPredictionCounter: Counter;
  private mlAccuracyGauge: Gauge;
  private mlLatency: Summary;
  private wsConnectionGauge: Gauge;
  private dataCollectionCounter: Counter;
  private cacheHitRate: Gauge;
  private dbConnectionPool: Gauge;
  
  constructor(config: MonitoringConfig) {
    this.initializeTracing(config);
    this.initializeMetrics(config);
    this.initializeErrorTracking(config);
    this.initializeLogging(config);
    this.setupGracefulShutdown();
  }
  
  /**
   * Initialize OpenTelemetry tracing
   */
  private initializeTracing(config: MonitoringConfig) {
    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
      }),
    });
    
    // Add exporters based on environment
    if (config.environment === 'production') {
      // Add OTLP exporter for production
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      const otlpExporter = new OTLPTraceExporter({
        url: process.env.OTLP_ENDPOINT || 'http://otel-collector:4318/v1/traces',
      });
      
      const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
      provider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));
    }
    
    provider.register();
    this.tracer = trace.getTracer(config.serviceName);
  }
  
  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(config: MonitoringConfig) {
    // HTTP metrics
    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });
    
    this.errorCounter = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'service', 'severity'],
    });
    
    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });
    
    // ML metrics
    this.mlPredictionCounter = new Counter({
      name: 'ml_predictions_total',
      help: 'Total ML predictions made',
      labelNames: ['model', 'type'],
    });
    
    this.mlAccuracyGauge = new Gauge({
      name: 'ml_accuracy_rate',
      help: 'Current ML model accuracy',
      labelNames: ['model'],
    });
    
    this.mlLatency = new Summary({
      name: 'ml_prediction_duration_seconds',
      help: 'ML prediction latency',
      labelNames: ['model'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
    });
    
    // WebSocket metrics
    this.wsConnectionGauge = new Gauge({
      name: 'websocket_active_connections',
      help: 'Number of active WebSocket connections',
    });
    
    // Data collection metrics
    this.dataCollectionCounter = new Counter({
      name: 'data_collected_total',
      help: 'Total data points collected',
      labelNames: ['source', 'type'],
    });
    
    // Cache metrics
    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_name'],
    });
    
    // Database metrics
    this.dbConnectionPool = new Gauge({
      name: 'db_connection_pool_size',
      help: 'Database connection pool metrics',
      labelNames: ['status'],
    });
    
    // Start Prometheus server
    if (config.prometheusPort) {
      const prometheusExporter = new PrometheusExporter({
        port: config.prometheusPort,
      }, () => {
        console.log(chalk.green(`✅ Prometheus metrics available at :${config.prometheusPort}/metrics`));
      });
    }
  }
  
  /**
   * Initialize Sentry error tracking
   */
  private initializeErrorTracking(config: MonitoringConfig) {
    if (config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.environment,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Console(),
        ],
        tracesSampleRate: config.environment === 'production' ? 0.1 : 1.0,
        beforeSend(event, hint) {
          // Filter out expected errors
          if (event.exception?.values?.[0]?.type === 'ValidationError') {
            return null;
          }
          return event;
        },
      });
    }
  }
  
  /**
   * Initialize structured logging
   */
  private initializeLogging(config: MonitoringConfig) {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(info => {
        const ctx = requestContext.getStore();
        return JSON.stringify({
          timestamp: info.timestamp,
          level: info.level,
          message: info.message,
          service: config.serviceName,
          requestId: ctx?.requestId,
          userId: ctx?.userId,
          ...info,
        });
      })
    );
    
    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: logFormat,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
    
    // Add file transport in production
    if (config.environment === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }));
      
      this.logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
      }));
    }
  }
  
  /**
   * Middleware for Express to track requests
   */
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const requestId = req.headers['x-request-id'] || this.generateRequestId();
      const startTime = Date.now();
      
      // Create request context
      const ctx: RequestContext = {
        requestId,
        userId: req.user?.id,
      };
      
      // Start span
      const span = this.tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.target': req.path,
          'user.id': req.user?.id,
        },
      });
      
      ctx.span = span;
      
      // Track response
      const originalSend = res.send;
      res.send = function(data: any) {
        res.send = originalSend;
        
        const duration = (Date.now() - startTime) / 1000;
        const labels = {
          method: req.method,
          route: req.route?.path || req.path,
          status: res.statusCode.toString(),
        };
        
        // Update metrics
        monitoring.requestCounter.inc(labels);
        monitoring.requestDuration.observe(labels, duration);
        
        // End span
        span.setStatus({
          code: res.statusCode >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
        });
        span.setAttribute('http.status_code', res.statusCode);
        span.end();
        
        return res.send(data);
      };
      
      // Run request in context
      requestContext.run(ctx, () => {
        next();
      });
    };
  }
  
  /**
   * Track ML predictions
   */
  trackMLPrediction(model: string, type: string, latency: number) {
    this.mlPredictionCounter.inc({ model, type });
    this.mlLatency.observe({ model }, latency / 1000);
  }
  
  /**
   * Update ML accuracy
   */
  updateMLAccuracy(model: string, accuracy: number) {
    this.mlAccuracyGauge.set({ model }, accuracy);
  }
  
  /**
   * Track WebSocket connections
   */
  updateWebSocketConnections(count: number) {
    this.wsConnectionGauge.set(count);
  }
  
  /**
   * Track data collection
   */
  trackDataCollection(source: string, type: string, count: number) {
    this.dataCollectionCounter.inc({ source, type }, count);
  }
  
  /**
   * Update cache metrics
   */
  updateCacheHitRate(cacheName: string, hitRate: number) {
    this.cacheHitRate.set({ cache_name: cacheName }, hitRate);
  }
  
  /**
   * Track database connections
   */
  updateDBConnections(active: number, idle: number) {
    this.dbConnectionPool.set({ status: 'active' }, active);
    this.dbConnectionPool.set({ status: 'idle' }, idle);
  }
  
  /**
   * Log error with context
   */
  logError(error: Error, context?: any) {
    const ctx = requestContext.getStore();
    
    this.errorCounter.inc({
      type: error.name,
      service: context?.service || 'unknown',
      severity: context?.severity || 'error',
    });
    
    this.logger.error({
      message: error.message,
      stack: error.stack,
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      ...context,
    });
    
    // Send to Sentry
    Sentry.captureException(error, {
      tags: {
        requestId: ctx?.requestId,
      },
      user: ctx?.userId ? { id: ctx.userId } : undefined,
      extra: context,
    });
  }
  
  /**
   * Create custom span for tracing
   */
  startSpan(name: string, attributes?: any) {
    const ctx = requestContext.getStore();
    const parentSpan = ctx?.span;
    
    return this.tracer.startSpan(name, {
      parent: parentSpan,
      attributes,
    });
  }
  
  /**
   * Health check endpoint data
   */
  getHealthMetrics() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        requests: {
          total: this.requestCounter.get(),
          errors: this.errorCounter.get(),
        },
        ml: {
          predictions: this.mlPredictionCounter.get(),
          accuracy: this.mlAccuracyGauge.get(),
        },
        websocket: {
          connections: this.wsConnectionGauge.get(),
        },
      },
    };
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Graceful shutdown
   */
  private setupGracefulShutdown() {
    const shutdown = async () => {
      console.log(chalk.yellow('\n🛑 Shutting down monitoring...'));
      
      // Flush metrics
      await register.metrics();
      
      // Flush Sentry
      await Sentry.close(2000);
      
      // Close logger
      this.logger.end();
      
      console.log(chalk.green('✅ Monitoring shutdown complete'));
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

// Export singleton instance
export const monitoring = new ProductionMonitoring({
  serviceName: process.env.SERVICE_NAME || 'fantasy-ai',
  environment: process.env.NODE_ENV || 'development',
  sentryDsn: process.env.SENTRY_DSN,
  prometheusPort: parseInt(process.env.METRICS_PORT || '9090'),
  logLevel: process.env.LOG_LEVEL || 'info',
});