# 🛡️ API Rate Limiting Documentation

## Overview

The Fantasy AI Ultimate platform implements enterprise-grade rate limiting to protect APIs from abuse, ensure fair usage, and maintain system stability. The rate limiting system is integrated at the middleware level and supports multiple tiers, endpoint-specific limits, and various identification methods.

## Architecture

### Components

1. **Next.js Middleware** (`apps/web/src/middleware.ts`)
   - Intercepts all API requests
   - Applies rate limiting before authentication
   - Adds security headers
   - Handles CSRF protection

2. **Rate Limiter Module** (`apps/web/src/lib/middleware/rate-limiter.ts`)
   - Express-compatible rate limiting
   - Redis store support
   - Tiered rate limits
   - Endpoint-specific configurations

3. **Storage Backends**
   - **Upstash Redis** (Production)
   - **In-Memory Store** (Development/Fallback)

## Rate Limit Tiers

### User Tiers

| Tier | Requests | Window | Use Case |
|------|----------|---------|----------|
| Free | 100 | 15 min | Basic usage |
| Pro | 1,000 | 15 min | Power users |
| Enterprise | 10,000 | 15 min | High-volume usage |
| API | 60 | 1 min | API key access |

### Endpoint-Specific Limits

| Endpoint | Limit | Window | Reason |
|----------|-------|---------|--------|
| `/api/auth/login` | 5 | 15 min | Prevent brute force |
| `/api/auth/register` | 3 | 1 hour | Prevent spam accounts |
| `/api/predictions` | 30 | 1 min | Resource intensive |
| `/api/ml/predict` | 20 | 1 min | GPU intensive |
| `/api/data/export` | 10 | 1 hour | Large data transfers |
| `/api/ml/train` | 5 | 24 hours | Extremely resource intensive |
| `/api/voice/process` | 20 | 5 min | Audio processing |
| `/api/oracle/*` | 30 | 5 min | AI processing |

## Implementation Details

### Identification Methods

The system identifies users in the following priority order:

1. **User ID** (from authentication)
   ```typescript
   identifier = `user:${userId}`
   ```

2. **API Key** (from header)
   ```typescript
   identifier = `api:${apiKey}`
   ```

3. **Session Token** (from cookie)
   ```typescript
   identifier = `token:${tokenPrefix}`
   ```

4. **IP Address** (fallback)
   ```typescript
   identifier = `ip:${ipAddress}`
   ```

### Headers

All rate-limited responses include the following headers:

- `X-RateLimit-Limit`: Total requests allowed in window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: ISO 8601 timestamp when window resets
- `Retry-After`: Seconds until next request allowed (429 responses only)

### Error Response

When rate limit is exceeded:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 300
}
```

Status Code: `429 Too Many Requests`

## Configuration

### Environment Variables

```bash
# Upstash Redis (Production)
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Redis (Alternative)
REDIS_URL=redis://localhost:6379
```

### Custom Rate Limits

To add a new endpoint-specific limit:

```typescript
// In middleware.ts
const RATE_LIMITS = {
  '/api/your-endpoint': { 
    requests: 10, 
    window: '5m' 
  },
  // ... other limits
}
```

## Usage Examples

### Client-Side Handling

```typescript
// React component with rate limit handling
const fetchPredictions = async () => {
  try {
    const response = await fetch('/api/predictions');
    
    if (response.status === 429) {
      const data = await response.json();
      const retryAfter = data.retryAfter || 60;
      
      toast.error(`Rate limit exceeded. Try again in ${retryAfter} seconds`);
      
      // Optional: Set a timer to retry
      setTimeout(() => {
        fetchPredictions();
      }, retryAfter * 1000);
      
      return;
    }
    
    // Check remaining requests
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining && parseInt(remaining) < 5) {
      toast.warning(`Only ${remaining} requests remaining`);
    }
    
    const data = await response.json();
    // Process data...
  } catch (error) {
    console.error('Failed to fetch predictions:', error);
  }
};
```

### API Key Usage

```typescript
// Using API key for higher limits
const response = await fetch('/api/predictions', {
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json',
  },
});
```

## Testing

### Manual Testing

```bash
# Test rate limiting
npm run test:rate-limit

# Test specific endpoint
curl -i http://localhost:3000/api/predictions

# Test with API key
curl -i -H "X-API-Key: test-key" http://localhost:3000/api/predictions
```

### Automated Testing

```typescript
// Jest/Vitest test example
describe('Rate Limiting', () => {
  it('should enforce rate limits', async () => {
    const requests = Array(6).fill(null).map(() => 
      fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'test' }),
      })
    );
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Monitoring

### Metrics to Track

1. **Rate Limit Hits**
   - Count of 429 responses
   - Grouped by endpoint and identifier type

2. **Usage Patterns**
   - Requests per user/API key
   - Peak usage times
   - Most requested endpoints

3. **Performance**
   - Rate limiter response time
   - Redis/Memory store performance

### Alerts

Set up alerts for:
- Sudden spike in rate limit violations
- Specific users consistently hitting limits
- System-wide rate limit threshold (e.g., >80% of users hitting limits)

## Best Practices

### For API Consumers

1. **Implement Exponential Backoff**
   ```typescript
   const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
   ```

2. **Cache Responses**
   - Reduce unnecessary API calls
   - Implement client-side caching

3. **Batch Requests**
   - Use batch endpoints when available
   - Combine multiple operations

4. **Monitor Usage**
   - Track rate limit headers
   - Alert before hitting limits

### For Developers

1. **Set Appropriate Limits**
   - Based on actual resource usage
   - Consider user experience
   - Leave headroom for bursts

2. **Provide Clear Error Messages**
   - Include retry information
   - Suggest alternatives

3. **Implement Gradual Degradation**
   - Warn users approaching limits
   - Provide usage statistics

4. **Document Limits Clearly**
   - In API documentation
   - In error responses
   - In user dashboards

## Troubleshooting

### Common Issues

1. **"Rate limit exceeded" for legitimate users**
   - Check if user tier is correctly identified
   - Verify Redis connection
   - Check for IP address conflicts (shared networks)

2. **Headers not appearing**
   - Ensure middleware is properly configured
   - Check response interceptors
   - Verify header names (case-sensitive)

3. **Inconsistent rate limiting**
   - Check Redis connection stability
   - Verify time synchronization
   - Check for multiple instances

### Debug Mode

Enable debug logging:

```typescript
// In middleware.ts
if (process.env.RATE_LIMIT_DEBUG) {
  console.log('Rate limit check:', {
    identifier,
    limit: rateLimitResult.limit,
    remaining: rateLimitResult.remaining,
    success: rateLimitResult.success,
  });
}
```

## Security Considerations

1. **Prevent Bypass Attempts**
   - Don't trust client headers blindly
   - Validate API keys server-side
   - Use secure session tokens

2. **DDoS Protection**
   - Rate limiting is first line of defense
   - Consider CloudFlare or similar for additional protection
   - Implement IP-based blocking for severe abuse

3. **Resource Protection**
   - Stricter limits on resource-intensive endpoints
   - Consider queuing for heavy operations
   - Implement circuit breakers

## Future Enhancements

1. **Dynamic Rate Limiting**
   - Adjust limits based on system load
   - Time-of-day variations
   - Event-based adjustments

2. **Advanced Analytics**
   - Machine learning for anomaly detection
   - Predictive rate limiting
   - User behavior analysis

3. **Enhanced User Experience**
   - WebSocket notifications for limit approaching
   - Grace period for premium users
   - Burst allowances

## Support

For rate limit increases or issues:
- Contact: support@fantasyai.com
- Include: User ID, API Key, Use case description
- Expected response time: 24-48 hours