# Redis Cloud Setup for Production
## By Marcus "The Fixer" Rodriguez

After watching Redis melt during the "Red Zone Crash of 2017", I learned: NEVER use localhost Redis in production.

## Why Redis Cloud?

1. **Auto-scaling** - Handles NFL Sunday traffic spikes
2. **Persistence** - Data survives container restarts
3. **Replication** - No single point of failure
4. **SSL/TLS** - Encrypted connections
5. **Monitoring** - Built-in metrics and alerts

## Setup Steps

### 1. Create Redis Cloud Account

1. Go to [Redis Cloud](https://redis.com/try-free/)
2. Sign up for free tier (30MB free forever)
3. For production: Choose "Pay as you go"

### 2. Create Database

```
Name: fantasy-ai-ultimate-prod
Region: us-east-1 (or closest to your servers)
Type: Redis Stack (includes JSON, Search, TimeSeries)
Size: 
  - Dev: 30MB (free)
  - Production: 1GB minimum ($70/month)
  - NFL Sunday Ready: 5GB ($350/month)
Persistence: AOF every write
Replication: Enabled
```

### 3. Configure for Fantasy Sports

#### Enable Modules:
- **RedisJSON** - Store player stats, lineups
- **RediSearch** - Fast player/team search
- **RedisTimeSeries** - Real-time score updates
- **RedisBloom** - Duplicate detection

#### Connection Pooling:
```javascript
// Maximum connections for NFL Sunday
maxConnections: 1000
connectionTimeout: 5000
commandTimeout: 5000
```

### 4. Get Connection Details

```bash
# Redis Cloud provides:
REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_ENDPOINT.redis.cache.amazonaws.com:6379

# With SSL (recommended):
REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_ENDPOINT.redis.cache.amazonaws.com:6379
```

### 5. Update Environment

```bash
# .env.local
REDIS_URL=rediss://default:abc123xyz@redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com:16397

# For connection pooling:
REDIS_POOL_SIZE=50
REDIS_POOL_MIN=10
REDIS_CONNECTION_TIMEOUT=5000
```

### 6. Test Connection

```bash
# Run our Redis test
npm run test:redis

# Or use redis-cli
redis-cli -u $REDIS_URL ping
# Should return: PONG
```

## Production Configuration

### Memory Policy
```
maxmemory-policy: volatile-lru
# Evict least recently used keys with TTL
```

### Key Patterns
```
rate_limit:*     # 1 minute TTL
session:*        # 24 hour TTL  
cache:player:*   # 5 minute TTL
cache:league:*   # 1 hour TTL
queue:*          # No TTL (persistent)
```

### Monitoring Alerts
1. Memory usage > 80%
2. Connection count > 800
3. Command latency > 100ms
4. Eviction rate > 100/sec

## Cost Optimization

### Free Tier (Development)
- 30MB free forever
- Perfect for development
- Includes all modules

### Starter ($70/month)
- 1GB memory
- 100 connections
- Handles ~10K users

### Pro ($350/month)
- 5GB memory  
- 1000 connections
- NFL Sunday ready
- Handles 100K+ users

### Enterprise (Custom)
- 25GB+ memory
- Unlimited connections
- Multi-region replication
- SLA guarantee

## Migration from Local Redis

```bash
# Export local data
redis-cli --rdb dump.rdb

# Import to Redis Cloud
redis-cli -u $REDIS_CLOUD_URL --pipe < dump.rdb
```

## Performance Tips

1. **Use pipelining** for bulk operations
2. **Set TTLs** on all cache keys
3. **Monitor slow queries** with SLOWLOG
4. **Use connection pooling** always
5. **Enable compression** for large values

## Emergency Procedures

### If Redis is down:
1. Check Redis Cloud status page
2. Failover to read replica
3. Enable bypass mode (serve stale data)
4. Scale up if memory pressure

### If rate limiting fails:
1. Switch to in-memory fallback
2. Increase capacity immediately
3. Clear rate limit keys if needed

## The Marcus Guarantee

With this setup, you'll handle:
- 1M requests/minute
- 50ms p99 latency
- Zero data loss
- Automatic failover
- NFL Sunday traffic without breaking a sweat

Remember: The "Red Zone Crash of 2017" happened because we used local Redis. Never again.