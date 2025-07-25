# Fantasy AI Platform Services

## Overview

This directory contains the core services that power the Fantasy AI Platform's real-time features, background processing, and third-party integrations.

## Services

### 1. Queue Service (BullMQ)
- **Location**: `queue-service.ts`
- **Purpose**: Background job processing for optimization, data collection, and trading
- **Features**:
  - Multiple job queues (optimization, data collection, ML, trading, maintenance)
  - Redis-backed persistence
  - Job retries and error handling
  - Real-time progress updates
  - Worker concurrency control

### 2. OAuth2 PKCE Service
- **Location**: `oauth2-pkce.ts`
- **Purpose**: Secure OAuth2 authentication with fantasy platforms
- **Features**:
  - PKCE (Proof Key for Code Exchange) implementation
  - Support for Yahoo, ESPN, and Sleeper
  - Token refresh management
  - Secure state validation
  - Database token storage

### 3. WebSocket Server
- **Location**: `websocket-server.ts`
- **Purpose**: Real-time bidirectional communication
- **Features**:
  - JWT authentication
  - Channel-based subscriptions
  - Redis pub/sub integration
  - Automatic reconnection
  - Heartbeat monitoring

### 4. Worker System
- **Location**: `../workers/`
- **Purpose**: Process background jobs from queues
- **Workers**:
  - **Data Collection**: Ownership, injuries, weather, Vegas data
  - **ML Processing**: Model training, predictions, ensemble methods
  - **Lineup Optimization**: DFS lineup generation and optimization
  - **Trading**: Automated trading execution and monitoring
  - **Maintenance**: Database cleanup, cache warming, reports

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Redis**:
   ```bash
   redis-server
   ```

4. **Run Database Migrations**:
   ```bash
   npm run db:migrate
   ```

5. **Start Services**:
   ```bash
   # Start all services
   npm run dev:all

   # Or start individually
   npm run dev        # Next.js app
   npm run services   # Background services
   npm run websocket  # WebSocket server only
   npm run worker     # Workers only
   ```

## Usage Examples

### Queue Service

```typescript
import { queueService } from './queue-service';

// Add an optimization job
const job = await queueService.addJob('optimize-lineup', {
  sport: 'NFL',
  contestId: 'dk-123456',
  settings: {
    maxExposure: 0.3,
    minSalary: 49000,
    maxSalary: 50000
  }
});

// Monitor progress
job.on('progress', (progress) => {
  console.log(`Optimization ${progress}% complete`);
});

// Get result
const result = await job.finished();
```

### OAuth2 PKCE

```typescript
import { OAuth2PKCEService } from './oauth2-pkce';

// Generate auth URL
const authUrl = await OAuth2PKCEService.generateAuthUrl(userId, 'yahoo');

// After user authorizes, exchange code for tokens
const tokens = await OAuth2PKCEService.exchangeCodeForTokens(code, state);

// Use tokens for API calls
const accessToken = await OAuth2PKCEService.getValidAccessToken(userId, 'yahoo');
```

### WebSocket Client

```typescript
const ws = new WebSocket(`ws://localhost:3001?token=${authToken}`);

ws.on('open', () => {
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'user:123:lineups'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  if (message.type === 'lineup:updated') {
    // Handle lineup update
  }
});
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js   │────▶│    Redis    │◀────│   Workers   │
│     App     │     │  (BullMQ)   │     │  (Node.js)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │                    ▼                    │
       │            ┌─────────────┐              │
       └───────────▶│  WebSocket  │◀─────────────┘
                    │   Server    │
                    └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │  Postgres   │
                    │  Database   │
                    └─────────────┘
```

## Monitoring

- **Queue Dashboard**: Access BullMQ Board at `/api/admin/queues`
- **WebSocket Status**: Check `/api/health/websocket`
- **Worker Health**: Monitor via `/api/health/workers`

## Security

- All OAuth tokens are encrypted at rest
- WebSocket connections require JWT authentication
- Queue jobs are validated before processing
- Rate limiting on all endpoints
- CSRF protection for OAuth flows

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping

# Check Redis configuration
redis-cli CONFIG GET requirepass
```

### Worker Not Processing Jobs
```bash
# Check worker logs
npm run worker

# Verify Redis connection
redis-cli KEYS "bull:*"
```

### WebSocket Connection Failed
- Verify JWT token is valid
- Check WebSocket port is not blocked
- Ensure SSL certificates for production

## Performance Tips

1. **Queue Optimization**:
   - Use job priorities for time-sensitive tasks
   - Batch similar jobs together
   - Set appropriate concurrency limits

2. **WebSocket Scaling**:
   - Use Redis pub/sub for multi-server deployments
   - Implement connection pooling
   - Enable compression for large messages

3. **Worker Efficiency**:
   - Process jobs in batches when possible
   - Use caching to avoid redundant work
   - Monitor memory usage and implement limits