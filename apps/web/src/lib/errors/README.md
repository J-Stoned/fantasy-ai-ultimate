# Centralized Error Handling & Structured Logging System

## Overview

This enterprise-grade error handling and logging system provides:

- **Centralized Error Management**: Custom error classes with metadata and recovery strategies
- **Structured Logging**: JSON-formatted logs with metadata for better searchability
- **React Error Boundaries**: Graceful error recovery in the UI
- **API Error Middleware**: Consistent error handling across all API routes
- **Browser Error Tracking**: Client-side error collection and forwarding
- **User-Friendly Error Pages**: Custom 404 and error pages
- **Monitoring Integration**: Ready for Sentry/Datadog integration

## Quick Start

### 1. Basic Error Handling

```typescript
import { logger, createError, errorHandler } from '@/lib/errors';

// Log structured information
logger.info('User action completed', {
  userId: '123',
  action: 'login',
  duration: 156
});

// Create and throw typed errors
throw createError('validation', 'Invalid email format', {
  field: 'email',
  value: 'invalid-email'
});

// Handle unknown errors
try {
  await riskyOperation();
} catch (error) {
  const handledError = errorHandler.handleError(error, {
    service: 'user-service',
    operation: 'updateProfile'
  });
  logger.error('Operation failed', { errorId: handledError.id });
}
```

### 2. API Route Error Handling

```typescript
import { withErrorHandling, withValidation } from '@/lib/middleware/api-error-handler';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email()
});

// Basic error handling
export const GET = withErrorHandling(async (request, context) => {
  // Any thrown errors are automatically handled
  const data = await getUserData();
  return NextResponse.json(data);
});

// With validation
export const POST = withValidation(UserSchema, async (request, body, context) => {
  // body is automatically validated and typed
  const user = await createUser(body);
  return NextResponse.json(user);
});
```

### 3. React Component Error Handling

```typescript
import { ComponentErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import { browserLog } from '@/lib/logging/browser-logger';

// Page-level error boundary
export default function MyPage() {
  return (
    <PageErrorBoundary>
      <MyPageContent />
    </PageErrorBoundary>
  );
}

// Component-level error boundary
function MyComponent() {
  const handleError = (error: Error) => {
    browserLog.logError(error, { component: 'MyComponent' });
  };

  return (
    <ComponentErrorBoundary componentName="MyComponent" onError={handleError}>
      <RiskyComponent />
    </ComponentErrorBoundary>
  );
}
```

## Error Types

### Base Error Classes

| Error Type | Use Case | HTTP Status | Recovery Strategy |
|------------|----------|-------------|-------------------|
| `AuthenticationError` | User not logged in | 401 | Redirect to login |
| `AuthorizationError` | Insufficient permissions | 403 | Show access denied |
| `ValidationError` | Invalid input data | 400 | Show validation errors |
| `DatabaseError` | Database operations fail | 503 | Retry with backoff |
| `ExternalApiError` | Third-party API fails | 502 | Circuit breaker |
| `BusinessLogicError` | Business rule violation | 422 | Show user message |
| `SystemError` | Internal system error | 500 | Log and alert |
| `NetworkError` | Network connectivity | 503 | Retry mechanism |
| `ConfigurationError` | Missing/invalid config | 500 | Alert ops team |
| `RateLimitError` | Too many requests | 429 | Backoff retry |

### Creating Custom Errors

```typescript
// Using factory function
const error = createError('database', 'Connection failed', {
  service: 'user-service',
  operation: 'findUser',
  userId: '123'
});

// Direct instantiation
const error = new ValidationError(
  'Email is required',
  { email: ['Email field is required'] },
  { userId: '123' }
);
```

## Logging System

### Log Levels

- **DEBUG**: Detailed diagnostic information
- **INFO**: General application flow
- **WARN**: Warning conditions
- **ERROR**: Error conditions
- **FATAL**: Critical errors requiring immediate attention

### Structured Logging

```typescript
import { logger, createLogger } from '@/lib/logging/logger';

// Service-specific logger
const serviceLogger = createLogger('user-service', { version: '1.0.0' });

// Structured logging with metadata
logger.info('User registration completed', {
  userId: user.id,
  email: user.email,
  registrationSource: 'web',
  duration: Date.now() - startTime
});

// Performance timing
const timer = logger.startTimer();
await performOperation();
const duration = timer(); // Returns duration in milliseconds

// Automatic timing wrapper
const result = await logger.time('database-query', async () => {
  return await db.query('SELECT * FROM users');
}, { query: 'users-list' });
```

### Browser Logging

```typescript
import { browserLog } from '@/lib/logging/browser-logger';

// Basic logging
browserLog.info('Page loaded', { page: '/dashboard' });

// User actions
browserLog.logAction('button-click', { 
  buttonId: 'submit',
  formData: sanitizedData 
});

// Performance metrics
browserLog.logPerformance('page-load', loadTime);

// React errors (automatic via error boundary)
browserLog.logReactError(error, errorInfo, { component: 'UserForm' });
```

## API Middleware

### Error Handling Middleware

```typescript
import { withErrorHandling, withAuth, withRateLimit, compose } from '@/lib/middleware/api-error-handler';

// Single middleware
export const GET = withErrorHandling(async (request, context) => {
  // Automatic error handling and logging
  return NextResponse.json({ data: 'success' });
});

// Multiple middleware
export const POST = compose(
  withRateLimit(100, 60000), // 100 requests per minute
  withAuth,                  // Require authentication
  withErrorHandling         // Error handling (should be last)
)(async (request, context) => {
  // context.userId is available from withAuth
  return NextResponse.json({ success: true });
});
```

### Validation Middleware

```typescript
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(18)
});

export const POST = withValidation(CreateUserSchema, async (request, body, context) => {
  // body is typed as: { name: string; email: string; age: number }
  const user = await createUser(body);
  return NextResponse.json(user);
});
```

## Error Recovery Strategies

### Automatic Recovery

Errors include recovery strategies that can be applied automatically:

```typescript
const error = new ExternalApiError('API timeout', 'github-api', 503, context, originalError);
// Includes automatic retry strategy with exponential backoff

const error = new DatabaseError('Connection lost', context, originalError);
// Includes automatic retry with connection pooling
```

### Manual Recovery

```typescript
try {
  await riskyOperation();
} catch (error) {
  if (isRetriableError(error)) {
    await delay(error.recoveryStrategy?.retryDelay || 1000);
    return await riskyOperation(); // Retry once
  }
  
  if (error.recoveryStrategy?.type === 'fallback') {
    return error.recoveryStrategy.fallbackValue;
  }
  
  throw error; // Let error boundary handle it
}
```

## Error Pages

### Custom Error Pages

- `src/app/error.tsx` - Global error page
- `src/app/not-found.tsx` - 404 page
- `src/app/global-error.tsx` - Global error fallback

### Error Boundary Components

```typescript
// Global error boundary (already in layout.tsx)
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Page-level error boundary
<PageErrorBoundary>
  <PageContent />
</PageErrorBoundary>

// Component-level error boundary
<ComponentErrorBoundary componentName="UserProfile">
  <UserProfile />
</ComponentErrorBoundary>
```

## Monitoring Integration

### Sentry Integration (Ready)

```typescript
// In error-handler.ts - sendToMonitoring method
private sendToMonitoring(error: BaseError): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        errorId: error.id,
        category: error.category,
        severity: error.severity
      },
      extra: error.context
    });
  }
}
```

### Datadog Integration (Ready)

```typescript
// In logger.ts - remoteOutput method
private remoteOutput(entry: LogEntry): void {
  if (process.env.DATADOG_API_KEY) {
    // Send to Datadog logs API
    fetch('https://http-intake.logs.datadoghq.com/v1/input/' + process.env.DATADOG_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  }
}
```

## Performance Considerations

### Log Buffering

Browser logs are buffered and sent in batches to reduce network overhead:

- Buffer size: 50 entries
- Flush interval: 30 seconds
- Automatic flush on page unload

### Error Rate Limiting

Prevent error spam:

- Rate limit: 10 errors per minute per user
- Circuit breaker: Auto-disable error reporting if rate exceeded
- Priority: FATAL errors bypass rate limiting

### Memory Management

- Automatic cleanup of old log entries
- LRU cache for error patterns
- Memory monitoring and alerts

## Migration Guide

### From console.log to Structured Logging

1. Run the replacement script:
```bash
npm run replace-console-logs
```

2. Review and test changes:
```bash
npm run build
npm run test
```

3. Update environment variables:
```env
LOG_LEVEL=info
ENABLE_REMOTE_LOGGING=true
SENTRY_DSN=your_sentry_dsn
DATADOG_API_KEY=your_datadog_key
```

### Gradual Migration Strategy

1. **Phase 1**: Implement error boundaries and basic logging
2. **Phase 2**: Replace console.log statements in critical paths
3. **Phase 3**: Add API middleware to all routes
4. **Phase 4**: Integrate monitoring services
5. **Phase 5**: Fine-tune error recovery strategies

## Best Practices

### Error Handling

1. **Always include context** when creating errors
2. **Use appropriate error types** for different scenarios
3. **Include recovery strategies** where possible
4. **Log errors at the appropriate level**
5. **Never expose sensitive data** in error messages

### Logging

1. **Use structured logging** with consistent metadata
2. **Include request IDs** for tracing
3. **Log user actions** for audit trails
4. **Monitor performance metrics**
5. **Use appropriate log levels**

### Security

1. **Sanitize error messages** before sending to client
2. **Never log sensitive data** (passwords, tokens, PII)
3. **Use audit logging** for security-critical operations
4. **Monitor for suspicious error patterns**
5. **Implement rate limiting** on error endpoints

## Testing

### Error Simulation

```typescript
// Test error boundaries
const ErrorComponent = () => {
  throw new Error('Test error');
};

// Test API error handling
test('handles validation errors', async () => {
  const response = await POST(requestWithInvalidData);
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
});

// Test error recovery
test('retries on network error', async () => {
  mockFetch.mockRejectedValueOnce(new NetworkError('Connection failed'));
  mockFetch.mockResolvedValueOnce({ data: 'success' });
  
  const result = await apiCall();
  expect(result.data).toBe('success');
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
```

## Environment Configuration

```env
# Logging
LOG_LEVEL=info
ENABLE_CONSOLE_LOGGING=true
ENABLE_FILE_LOGGING=false
ENABLE_REMOTE_LOGGING=true

# Error Handling
ERROR_RATE_LIMIT=10
ENABLE_ERROR_RECOVERY=true
ERROR_MONITORING_URL=https://your-monitoring-service.com

# Monitoring
SENTRY_DSN=your_sentry_dsn
DATADOG_API_KEY=your_datadog_key
ENABLE_PERFORMANCE_MONITORING=true
```

## Troubleshooting

### Common Issues

1. **Circular dependencies**: Import from specific error files, not the index
2. **Missing context**: Always provide context when creating errors
3. **Performance**: Use log levels appropriately to avoid spam
4. **Memory leaks**: Ensure error recovery cleans up resources

### Debug Mode

Set `LOG_LEVEL=debug` to enable verbose logging:

```typescript
logger.debug('Detailed operation info', {
  step: 'validation',
  inputData: sanitizedInput,
  timestamp: Date.now()
});
```

This comprehensive error handling system provides production-ready error management with monitoring integration, user-friendly error pages, and structured logging for better observability.