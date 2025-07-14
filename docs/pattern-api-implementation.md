# 🚀 Pattern API Implementation Guide

## Quick Start

This guide covers the practical implementation of the Fantasy AI Pattern Detection APIs, including setup, configuration, and advanced usage patterns.

## Table of Contents
1. [Installation & Setup](#installation--setup)
2. [API Architecture](#api-architecture)
3. [Using the APIs](#using-the-apis)
4. [Real-time Integration](#real-time-integration)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

## Installation & Setup

### Prerequisites
```bash
# Required versions
node --version  # v18.0.0 or higher
npm --version   # v9.0.0 or higher

# Check GPU support (optional but recommended)
nvidia-smi      # For NVIDIA GPU acceleration
```

### Initial Setup
```bash
# Clone repository
git clone https://github.com/your-repo/fantasy-ai-ultimate.git
cd fantasy-ai-ultimate

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your database credentials

# Initialize pattern cache
npm run patterns:init
```

### Database Requirements
```sql
-- Ensure these tables exist
SELECT COUNT(*) FROM games;        -- Should have 48,863+ games
SELECT COUNT(*) FROM player_stats; -- Should have 3.6M+ stats
SELECT COUNT(*) FROM teams;        -- Should have all teams
```

## API Architecture

### Service Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                      PATTERN API ECOSYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ Unified API      │  │ Production V4    │  │ Real-time    │ │
│  │ Port: 3336      │  │ Port: 3337       │  │ Scanner      │ │
│  │                 │  │                  │  │ Port: 3338   │ │
│  │ • All patterns  │  │ • Cached results │  │ • WebSocket  │ │
│  │ • Historical    │  │ • 48K games      │  │ • Live alerts│ │
│  │ • Combinations  │  │ • Fast queries   │  │ • Streaming  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                      │                    │         │
│           └──────────────────────┴────────────────────┘         │
│                              │                                  │
│                     ┌────────▼────────┐                        │
│                     │ Pattern Engine  │                        │
│                     │ Core Detection  │                        │
│                     └────────┬────────┘                        │
│                              │                                  │
│                     ┌────────▼────────┐                        │
│                     │ Lucey Cache     │                        │
│                     │ Compressed Data │                        │
│                     └─────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Starting the Services

#### 1. Unified Pattern API (Development/Testing)
```bash
# Start the unified API
npx tsx scripts/unified-pattern-api.ts

# API will be available at http://localhost:3336
# Swagger docs at http://localhost:3336/docs
```

Features:
- All 24 pattern variations
- No caching (real-time computation)
- Pattern combination analysis
- Historical backtesting

#### 2. Production Pattern V4 (Production)
```bash
# Start production API with caching
npx tsx scripts/production-pattern-api-v4.ts

# API will be available at http://localhost:3337
# Health check at http://localhost:3337/health
```

Features:
- Pre-computed pattern cache
- Sub-10ms response times
- Optimized for high traffic
- Built-in monitoring

#### 3. Real-time Scanner
```bash
# Start WebSocket server for live alerts
npx tsx scripts/realtime-pattern-scanner.ts

# WebSocket available at ws://localhost:3338
```

## Using the APIs

### Basic Pattern Detection

#### Get Today's Patterns
```typescript
// Using fetch
const response = await fetch('http://localhost:3336/api/patterns/today');
const data = await response.json();

console.log(data);
// {
//   "patterns": [
//     {
//       "game_id": 401584715,
//       "teams": {
//         "home": "Lakers",
//         "away": "Celtics"
//       },
//       "pattern_type": "back_to_back_fade",
//       "confidence": 0.768,
//       "expected_roi": 0.466,
//       "bet_recommendation": {
//         "type": "spread",
//         "team": "home",
//         "value": "+7.5"
//       }
//     }
//   ],
//   "summary": {
//     "total_opportunities": 8,
//     "average_confidence": 0.694,
//     "projected_value": 387.20
//   }
// }
```

#### Check Specific Game
```typescript
const gameId = 401584715;
const patterns = await fetch(`http://localhost:3337/api/patterns/game/${gameId}`);
const result = await patterns.json();

if (result.patterns.length > 0) {
  console.log('Patterns detected:', result.patterns);
  
  // Calculate optimal bet size
  const bankroll = 10000;
  const kellyBet = calculateKellyBet(
    result.patterns[0].confidence,
    result.patterns[0].odds,
    bankroll
  );
  
  console.log(`Recommended bet: $${kellyBet}`);
}
```

### Advanced Pattern Queries

#### Historical Performance
```typescript
// Get pattern performance for date range
const params = new URLSearchParams({
  start: '2024-01-01',
  end: '2024-12-31',
  pattern: 'back_to_back_fade'
});

const historical = await fetch(`http://localhost:3337/api/patterns/historical?${params}`);
const stats = await historical.json();

console.log(`${stats.pattern} Performance:`);
console.log(`Games: ${stats.total_games}`);
console.log(`Wins: ${stats.wins} (${stats.win_rate}%)`);
console.log(`ROI: ${stats.roi}%`);
console.log(`Profit: $${stats.total_profit}`);
```

#### Pattern Combinations
```typescript
// Find games with multiple patterns
const multiPatterns = await fetch('http://localhost:3336/api/patterns/multi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    min_patterns: 2,
    min_confidence: 0.65,
    date: '2024-01-15'
  })
});

const results = await multiPatterns.json();

// Multi-pattern games have higher accuracy
results.games.forEach(game => {
  console.log(`Game ${game.id}: ${game.patterns.length} patterns`);
  console.log(`Combined confidence: ${game.combined_confidence}`);
  console.log(`Recommended bet size: ${game.kelly_percentage}% of bankroll`);
});
```

### Pattern Scanning

#### Batch Analysis
```typescript
// Analyze multiple games efficiently
const games = [401584715, 401584716, 401584717, 401584718];

const batchAnalysis = await fetch('http://localhost:3336/api/patterns/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ game_ids: games })
});

const results = await batchAnalysis.json();

// Process results
const opportunities = results.filter(r => r.patterns.length > 0);
console.log(`Found ${opportunities.length} betting opportunities`);
```

## Real-time Integration

### WebSocket Connection
```typescript
class PatternAlertClient {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  
  connect() {
    this.ws = new WebSocket('ws://localhost:3338/patterns');
    
    this.ws.onopen = () => {
      console.log('Connected to pattern alerts');
      this.reconnectAttempts = 0;
      
      // Subscribe to specific patterns
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        patterns: ['back_to_back_fade', 'embarrassment_revenge'],
        min_confidence: 0.70
      }));
    };
    
    this.ws.onmessage = (event) => {
      const alert = JSON.parse(event.data);
      this.handleAlert(alert);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      this.reconnect();
    };
  }
  
  private handleAlert(alert: PatternAlert) {
    console.log(`🚨 Pattern Alert: ${alert.pattern_type}`);
    console.log(`Game: ${alert.game_id}`);
    console.log(`Confidence: ${(alert.confidence * 100).toFixed(1)}%`);
    console.log(`Expected ROI: ${(alert.roi * 100).toFixed(1)}%`);
    
    // Trigger betting logic
    if (alert.confidence > 0.75) {
      this.placeBet(alert);
    }
  }
  
  private async placeBet(alert: PatternAlert) {
    // Integration with betting platform
    const betSize = this.calculateBetSize(alert);
    
    console.log(`Placing bet: $${betSize} on ${alert.recommendation}`);
    // await bettingAPI.placeBet(...);
  }
  
  private reconnect() {
    if (this.reconnectAttempts < 5) {
      setTimeout(() => {
        console.log('Reconnecting...');
        this.reconnectAttempts++;
        this.connect();
      }, 1000 * Math.pow(2, this.reconnectAttempts));
    }
  }
}

// Start monitoring
const client = new PatternAlertClient();
client.connect();
```

### Server-Sent Events (Alternative)
```typescript
// For simpler one-way streaming
const eventSource = new EventSource('http://localhost:3336/api/patterns/stream');

eventSource.onmessage = (event) => {
  const pattern = JSON.parse(event.data);
  console.log('New pattern:', pattern);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

## Production Deployment

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose ports
EXPOSE 3336 3337 3338

# Start services
CMD ["npm", "run", "patterns:production"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  pattern-api:
    build: .
    ports:
      - "3336:3336"
      - "3337:3337"
      - "3338:3338"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3337/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=fantasy_ai
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  redis-data:
  postgres-data:
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pattern-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pattern-api
  template:
    metadata:
      labels:
        app: pattern-api
    spec:
      containers:
      - name: pattern-api
        image: fantasy-ai/pattern-api:latest
        ports:
        - containerPort: 3336
        - containerPort: 3337
        - containerPort: 3338
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3337
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3337
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: pattern-api-service
spec:
  selector:
    app: pattern-api
  ports:
    - name: unified
      port: 3336
      targetPort: 3336
    - name: production
      port: 3337
      targetPort: 3337
    - name: websocket
      port: 3338
      targetPort: 3338
  type: LoadBalancer
```

### Monitoring & Observability

#### Prometheus Metrics
```typescript
// Add to your API
import { register, Counter, Histogram } from 'prom-client';

const patternCounter = new Counter({
  name: 'pattern_detections_total',
  help: 'Total pattern detections',
  labelNames: ['pattern_type', 'confidence_bucket']
});

const apiLatency = new Histogram({
  name: 'pattern_api_latency_seconds',
  help: 'API response latency',
  labelNames: ['endpoint', 'method']
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

#### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Pattern Detection System",
    "panels": [
      {
        "title": "Pattern Detections/Hour",
        "targets": [{
          "expr": "rate(pattern_detections_total[1h])"
        }]
      },
      {
        "title": "API Latency",
        "targets": [{
          "expr": "histogram_quantile(0.95, pattern_api_latency_seconds)"
        }]
      },
      {
        "title": "Pattern Accuracy",
        "targets": [{
          "expr": "pattern_wins_total / pattern_bets_total"
        }]
      }
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### 1. High Latency
```bash
# Check cache status
curl http://localhost:3337/api/cache/stats

# Clear cache if needed
curl -X POST http://localhost:3337/api/cache/clear

# Rebuild pattern cache
npm run patterns:rebuild-cache
```

#### 2. WebSocket Disconnections
```typescript
// Implement exponential backoff
class ReliableWebSocket {
  private backoff = {
    initial: 1000,
    max: 30000,
    multiplier: 1.5,
    current: 1000
  };
  
  connect() {
    // Connection logic with backoff
  }
}
```

#### 3. Memory Issues
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Monitor memory usage
npm run monitor:memory
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=pattern:* npm start

# Verbose pattern analysis
PATTERN_DEBUG=true npm run patterns:analyze
```

### Performance Tuning
```typescript
// config/performance.ts
export const PERFORMANCE_CONFIG = {
  // Batch processing
  BATCH_SIZE: process.env.NODE_ENV === 'production' ? 1000 : 100,
  
  // Caching
  CACHE_TTL: 3600, // 1 hour
  CACHE_MAX_SIZE: 10000,
  
  // Parallel processing
  WORKER_THREADS: os.cpus().length,
  
  // Database
  DB_POOL_SIZE: 20,
  DB_TIMEOUT: 5000,
  
  // WebSocket
  WS_MAX_CONNECTIONS: 10000,
  WS_HEARTBEAT_INTERVAL: 30000
};
```

## Next Steps

1. **Integration with Betting Platforms**
   - DraftKings API integration
   - FanDuel API integration
   - Automated bet placement

2. **Advanced Features**
   - Machine learning pattern discovery
   - Custom pattern creation
   - Pattern backtesting framework

3. **Scaling**
   - Redis cluster for caching
   - Horizontal scaling with load balancing
   - Global CDN for API endpoints

---

For additional support, see our [FAQ](./faq.md) or contact the development team.