# 🛡️ Enterprise Rate Limiting & DDoS Protection

## Overview

This system provides comprehensive API rate limiting and DDoS protection for the Fantasy AI Platform. It uses Redis-based distributed rate limiting with sliding windows, multiple tiers, and real-time monitoring.

## Features

### 1. **Multi-Tier Rate Limiting**
- **Public**: Basic access for unauthenticated users
- **Authenticated**: Higher limits for logged-in users
- **Premium**: Enhanced limits for premium subscribers
- **Admin**: Special limits for administrative functions
- **Unlimited**: No rate limits (enterprise customers)

### 2. **Endpoint Categories**
```typescript
// Rate limits by category (requests/window)
admin: 10/min        // Admin operations
financial: 30/min    // Trading & bankroll endpoints
ml: 100/hour        // ML predictions
contest: 50/min     // Contest submissions
auth: 5/15min       // Login attempts
public: 60/min      // General API access
```

### 3. **DDoS Protection**
- Request size limits (10MB max, 1MB for JSON)
- Connection throttling (100 connections/IP)
- Suspicious pattern detection (XSS, SQL injection, path traversal)
- Automatic IP blocking (1 hour for violations)
- Blacklist management

### 4. **Real-Time Monitoring**
- Admin dashboard at `/admin/rate-limits`
- WebSocket streaming for live metrics
- IP blocking/unblocking interface
- Endpoint statistics and analytics

## Implementation

### Middleware Integration

Rate limiting is automatically applied to all `/api/*` routes via middleware:

```typescript
// middleware.ts
if (pathname.startsWith('/api/')) {
  const rateLimitResult = await rateLimitMiddleware(request);
  if (rateLimitResult) {
    return rateLimitResult; // 429 response
  }
}
```

### Response Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1640995200000
Retry-After: 60 (only on 429 responses)
```

### Custom Rate Limits

Apply custom limits to specific endpoints:

```typescript
// In your API route
import { createRateLimitMiddleware } from '@/lib/middleware/rate-limit';

const customLimit = createRateLimitMiddleware('financial', {
  customLimits: { premium: 200 } // Override premium tier
});

export async function POST(req: NextRequest) {
  const limited = await customLimit(req);
  if (limited) return limited;
  
  // Your API logic here
}
```

## Configuration

### Tier Assignment

Tiers are automatically determined based on:
1. User role (admin gets ADMIN tier)
2. Subscription status (premium/enterprise)
3. API key tier
4. Authentication status

### Redis Configuration

Rate limiting uses the Redis cluster service:

```typescript
// Environment variables
REDIS_CLUSTERS=localhost:7000,localhost:7001
REDIS_PASSWORD=your-password
```

### DDoS Thresholds

Adjust protection levels in `rate-limiter.ts`:

```typescript
export const DDoSProtection = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  maxConnectionsPerIP: 100,
  blockDuration: 3600, // 1 hour
  blockThreshold: 10, // violations before blocking
};
```

## Admin Dashboard

Access the rate limit monitoring dashboard at `/admin/rate-limits`:

### Features:
- **Overview Cards**: Total requests, blocked requests, unique IPs, blocked IPs
- **Real-Time Graph**: Live visualization of allowed vs blocked requests
- **Top Violators**: IPs/users with most violations
- **Blocked IPs**: Manage blocked IPs with unblock capability
- **Endpoint Stats**: Per-endpoint request counts and block rates

### API Endpoints:
- `GET /api/admin/rate-limits/stats` - Get current statistics
- `POST /api/admin/rate-limits/unblock` - Unblock an IP
- `GET /api/admin/rate-limits/stream` - WebSocket for real-time updates

## Best Practices

### 1. **Handle Rate Limit Responses**
```typescript
// Client-side handling
const response = await fetch('/api/predictions', { method: 'POST', body });

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
  // Implement exponential backoff
}
```

### 2. **Monitor Your Limits**
```typescript
// Check current limits
const headers = response.headers;
console.log({
  limit: headers.get('X-RateLimit-Limit'),
  remaining: headers.get('X-RateLimit-Remaining'),
  reset: new Date(parseInt(headers.get('X-RateLimit-Reset'))).toISOString()
});
```

### 3. **Request API Keys**
For higher rate limits, implement API key management:
- Generate unique API keys for partners
- Assign appropriate tiers
- Monitor usage per key
- Revoke compromised keys

### 4. **Implement Caching**
Reduce API calls by caching responses:
- Use Redis cache for frequently requested data
- Implement cache-aside pattern
- Set appropriate TTLs

## Troubleshooting

### Common Issues

1. **"Rate limit exceeded" errors**
   - Check your tier assignment
   - Implement request batching
   - Add caching layer
   - Request higher tier if needed

2. **IP blocked incorrectly**
   - Access admin dashboard
   - Manually unblock IP
   - Review violation logs
   - Adjust thresholds if needed

3. **Headers not showing**
   - Ensure middleware is applied
   - Check route configuration
   - Verify Redis connection

### Debug Mode

Enable detailed logging:
```typescript
// Set in environment
RATE_LIMIT_DEBUG=true
```

## Performance Impact

- **Latency**: <5ms added per request
- **Redis Operations**: 4 commands per request
- **Memory**: Minimal (keys expire automatically)
- **Scalability**: Handles 10,000+ req/sec

## Security Considerations

1. **IP Spoofing**: Use trusted proxy headers
2. **Distributed Attacks**: Implement CAPTCHA for auth endpoints
3. **Resource Exhaustion**: Set connection limits at load balancer
4. **Pattern Updates**: Regularly update suspicious patterns

## Future Enhancements

- [ ] Machine learning for anomaly detection
- [ ] Geographic-based rate limiting
- [ ] Dynamic threshold adjustment
- [ ] GraphQL-specific rate limiting
- [ ] Cost-based rate limiting (expensive operations)
- [ ] User notification system for limit warnings