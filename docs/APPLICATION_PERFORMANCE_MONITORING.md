# 🚀 Application Performance Monitoring (APM)

## Overview

Fantasy AI Ultimate implements enterprise-grade Application Performance Monitoring (APM) to track, analyze, and optimize system performance in real-time. The APM system provides comprehensive insights into API performance, database queries, cache efficiency, ML model performance, and system resources.

## Architecture

### Core Components

1. **APM Service** (`src/lib/monitoring/apm.ts`)
   - Transaction tracking
   - Custom metrics collection
   - Performance measurement decorators
   - Metric aggregation and flushing

2. **Performance Dashboard** (`src/components/admin/PerformanceMonitor.tsx`)
   - Real-time visualization
   - Health status monitoring
   - Resource utilization tracking
   - Alert visualization

3. **Metrics API** (`src/app/api/admin/metrics/route.ts`)
   - Performance data aggregation
   - Time-range queries
   - Real-time metric streaming

## Metrics Tracked

### API Performance
- **Requests per second**: Throughput measurement
- **Response times**: Average, P95, P99 percentiles
- **Error rate**: Percentage of failed requests
- **Active requests**: Current concurrent requests

### Database Performance
- **Active connections**: Current database connections
- **Query time**: Average query execution time
- **Slow queries**: Queries exceeding threshold
- **Connection pool usage**: Pool utilization percentage

### Cache Performance
- **Hit rate**: Percentage of successful cache hits
- **Miss rate**: Percentage of cache misses
- **Evictions**: Number of cache evictions
- **Memory usage**: Cache memory utilization

### System Resources
- **CPU usage**: Processor utilization
- **Memory usage**: RAM utilization
- **Disk I/O**: Read/write operations
- **Network I/O**: Network throughput

### ML Performance
- **Predictions per minute**: ML inference throughput
- **Average prediction time**: Model inference latency
- **GPU utilization**: Graphics processor usage
- **Model load time**: Time to load ML models

### WebSocket Performance
- **Active connections**: Current WebSocket connections
- **Messages per second**: WebSocket message throughput
- **Average latency**: Message delivery time
- **Reconnections**: Connection recovery count

## Usage

### Transaction Tracking

```typescript
import { apm } from '@/lib/monitoring/apm';

// Start a transaction
const transactionId = apm.startTransaction('user.login', 'auth');

try {
  // Add spans for sub-operations
  const dbSpan = apm.startSpan(transactionId, 'database.query');
  const user = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  apm.endSpan(transactionId, dbSpan);

  // End transaction successfully
  apm.endTransaction(transactionId, 'ok');
} catch (error) {
  // End transaction with error
  apm.endTransaction(transactionId, 'error');
  throw error;
}
```

### Custom Metrics

```typescript
// Record custom metric
apm.recordMetric({
  name: 'custom.operation',
  value: 123,
  unit: 'ms',
  tags: {
    operation: 'data_processing',
    status: 'success'
  }
});

// Record API performance
apm.recordApiPerformance('/api/predictions', 'POST', 156, 200, 2048);

// Record database query
apm.recordDatabaseQuery('SELECT * FROM players', 45, 100, false);

// Record cache operation
apm.recordCacheOperation('get', true, 5, 'player:123');

// Record ML prediction
apm.recordMLPrediction('nfl_predictor', 89, 50, true);
```

### Performance Decorators

```typescript
import { MeasurePerformance } from '@/lib/monitoring/apm';

class PredictionService {
  @MeasurePerformance
  async generatePrediction(data: any) {
    // Method execution is automatically timed
    const result = await this.mlModel.predict(data);
    return result;
  }
}
```

### Middleware Integration

```typescript
// Next.js API Route
import { apmMiddleware } from '@/lib/monitoring/apm';

export async function GET(request: Request) {
  // APM automatically tracks this request
  return NextResponse.json({ data: 'success' });
}

// Express.js
app.use(apmMiddleware());
```

## Dashboard Access

The performance monitoring dashboard is available at:
```
/admin/performance
```

### Dashboard Features

1. **Real-time Metrics**: Live updates every 5 seconds
2. **Time Range Selection**: 5 minutes, 1 hour, 24 hours
3. **Health Status**: Component health indicators
4. **Visual Graphs**: Performance trends and patterns
5. **Alert Indicators**: Warning and error thresholds

## Configuration

### Environment Variables

```bash
# Sentry Configuration (for APM integration)
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# APM Configuration
APM_ENABLED=true
APM_FLUSH_INTERVAL=30000
APM_MAX_METRICS=10000
```

### Performance Thresholds

```typescript
// Configure in apm.ts
const THRESHOLDS = {
  api: {
    responseTime: { good: 100, warning: 300, critical: 1000 },
    errorRate: { good: 1, warning: 5, critical: 10 }
  },
  database: {
    queryTime: { good: 50, warning: 200, critical: 1000 },
    connectionPool: { good: 70, warning: 85, critical: 95 }
  },
  cache: {
    hitRate: { good: 90, warning: 70, critical: 50 }
  }
};
```

## Monitoring Best Practices

### 1. Transaction Naming
- Use consistent naming: `resource.action`
- Examples: `user.login`, `prediction.generate`, `contest.create`

### 2. Metric Tags
- Include relevant context in tags
- Common tags: `endpoint`, `method`, `status`, `user_tier`

### 3. Performance Budgets
- Set performance budgets for critical operations
- Monitor budget violations
- Alert on threshold breaches

### 4. Sampling
- Use sampling for high-volume operations
- Adjust sample rates based on traffic

### 5. Data Retention
- Keep detailed metrics for 24 hours
- Aggregate data for longer retention
- Archive critical performance data

## Alerting

### Alert Configuration

```typescript
const ALERT_RULES = {
  highErrorRate: {
    metric: 'api.error_rate',
    threshold: 5,
    duration: '5m',
    severity: 'critical'
  },
  slowResponse: {
    metric: 'api.p95_response_time',
    threshold: 1000,
    duration: '10m',
    severity: 'warning'
  },
  dbConnectionExhaustion: {
    metric: 'db.connection_pool_usage',
    threshold: 90,
    duration: '2m',
    severity: 'critical'
  }
};
```

### Alert Channels
- Sentry alerts for errors
- Slack notifications for warnings
- PagerDuty for critical issues
- Email summaries for trends

## Performance Optimization

### Identified Bottlenecks

1. **API Response Times**
   - Implement response caching
   - Optimize database queries
   - Use connection pooling

2. **Database Performance**
   - Add missing indexes
   - Optimize slow queries
   - Implement query caching

3. **ML Predictions**
   - Cache frequent predictions
   - Batch processing
   - GPU optimization

4. **WebSocket Latency**
   - Message compression
   - Connection pooling
   - Regional deployment

## Integration with Other Systems

### Sentry Integration
- Automatic error tracking
- Performance transaction tracking
- Release tracking
- User impact analysis

### CloudWatch/Datadog
- Export metrics for analysis
- Custom dashboards
- Advanced alerting
- Log correlation

### Grafana
- Custom visualization
- Complex queries
- Team dashboards
- Historical analysis

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check metric retention
   - Verify flush intervals
   - Monitor metric cardinality

2. **Missing Metrics**
   - Verify APM initialization
   - Check transaction completion
   - Validate metric names

3. **Dashboard Not Loading**
   - Check API endpoint
   - Verify authentication
   - Review browser console

### Debug Mode

Enable debug logging:
```typescript
// In development
process.env.APM_DEBUG = 'true';

// Logs detailed APM operations
apm.enableDebugMode();
```

## Future Enhancements

1. **Machine Learning Anomaly Detection**
   - Automatic baseline establishment
   - Anomaly detection
   - Predictive alerts

2. **Distributed Tracing**
   - Cross-service tracing
   - Request flow visualization
   - Bottleneck identification

3. **Custom Dashboards**
   - User-specific dashboards
   - Saved views
   - Export capabilities

4. **Advanced Analytics**
   - Trend analysis
   - Capacity planning
   - Cost optimization

## Support

For APM-related issues:
- Check the dashboard for real-time status
- Review logs for detailed errors
- Contact: devops@fantasyai.com
- Slack: #apm-support