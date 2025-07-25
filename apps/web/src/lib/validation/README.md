# 🛡️ API Validation & Security System

Comprehensive input validation and security middleware for all API routes using Zod schemas.

## Overview

This validation system provides:
- **Type-safe validation** with Zod schemas
- **SQL injection prevention** with parameterized queries
- **XSS prevention** with input sanitization
- **Request size limits** and rate limiting
- **File upload validation**
- **CSRF protection**
- **Consistent error responses**

## Quick Start

### Basic Route Validation

```typescript
import { withValidation, adminLoginSchema } from '@/lib/validation';

export const POST = withValidation(adminLoginSchema, async (req, validatedData) => {
  // validatedData is fully typed and validated
  const { email, password } = validatedData;
  // ... handle request
});
```

### Query Parameter Validation

```typescript
import { validateQueryParams, paginationSchema } from '@/lib/validation';

export const GET = validateQueryParams(paginationSchema, async (req, params) => {
  const { page, limit, sortBy } = params;
  // ... handle request
});
```

### Path Parameter Validation

```typescript
import { validatePathParams, uuidSchema } from '@/lib/validation';

export const GET = validatePathParams(
  z.object({ id: uuidSchema }), 
  async (req, params) => {
    const { id } = params;
    // ... handle request
  }
);
```

## Available Schemas

### Authentication (`/schemas/auth.ts`)
- `adminLoginSchema` - Admin login with email/password
- `changePasswordSchema` - Password change validation
- `oauthCallbackSchema` - OAuth callback parameters
- `tokenSchema` - JWT token validation
- `apiKeySchema` - API key format validation

### Common (`/schemas/common.ts`)
- `uuidSchema` - UUID validation
- `paginationSchema` - Page, limit, sort parameters
- `dateRangeSchema` - Start/end date validation
- `safeStringSchema` - XSS-safe string validation
- `moneySchema` - Currency amount validation
- `sportSchema` - Sport enum validation
- `platformSchema` - Platform enum validation

### Financial (`/schemas/financial.ts`)
- `bankrollUpdateSchema` - Bankroll management
- `kellyCalculationSchema` - Kelly Criterion inputs
- `contestEntrySchema` - Contest entry validation
- `transactionSchema` - Financial transactions
- `withdrawalRequestSchema` - Withdrawal validation

### Leagues (`/schemas/leagues.ts`)
- `createLeagueSchema` - League creation
- `importLeagueSchema` - League import from platforms
- `tradeProposalSchema` - Trade validation
- `rosterMoveSchema` - Roster management
- `waiverClaimSchema` - Waiver claims

### Contests (`/schemas/contests.ts`)
- `lineupSchema` - DFS lineup validation
- `contestSearchSchema` - Contest filtering
- `optimalLineupRequestSchema` - Optimizer inputs
- `multiLineupRequestSchema` - Multiple lineup generation
- `stackValidationSchema` - Stack validation

### Admin (`/schemas/admin.ts`)
- `dataCollectionSchema` - Data collection requests
- `mlTrainingRequestSchema` - ML model training
- `tradingOrchestrationSchema` - Trading automation
- `sessionManagementSchema` - Session control
- `auditLogQuerySchema` - Audit log queries

## Security Features

### SQL Injection Prevention
```typescript
// Automatic detection and blocking
const schema = z.object({
  query: safeStringSchema(100) // Removes SQL patterns
});
```

### XSS Prevention
```typescript
// HTML sanitization
const sanitized = sanitizeHtml(userInput);

// Safe text validation
const schema = z.object({
  description: safeTextSchema(1000) // Strips scripts
});
```

### File Upload Security
```typescript
import { validateFile } from '@/lib/validation/security';

const result = validateFile(
  { name: file.name, type: file.type, size: file.size },
  'csv' // or 'json', 'image', 'document'
);
```

### Rate Limiting
```typescript
import { getRateLimitKey } from '@/lib/validation/security';

const key = getRateLimitKey(clientIp, '/api/endpoint', 'hour');
// Use with Redis for rate limiting
```

## Best Practices

### 1. Always Validate User Input
```typescript
// ❌ Bad
export async function POST(req: NextRequest) {
  const body = await req.json();
  // Direct use without validation
}

// ✅ Good
export const POST = withValidation(schema, async (req, data) => {
  // data is validated and typed
});
```

### 2. Use Specific Schemas
```typescript
// ❌ Bad - Too generic
const schema = z.object({
  amount: z.number()
});

// ✅ Good - Domain-specific validation
const schema = z.object({
  amount: moneySchema.min(10).max(10000)
});
```

### 3. Sanitize Output
```typescript
import { maskSensitiveData } from '@/lib/validation/security';

// Log safely
console.log('User data:', maskSensitiveData(userData));
```

### 4. Validate File Uploads
```typescript
// Always validate file type and size
const validation = validateFile(file, 'csv');
if (!validation.valid) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
```

### 5. Use Parameterized Queries
```typescript
// ❌ Bad - SQL injection risk
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ Good - Parameterized query
const query = 'SELECT * FROM users WHERE email = $1';
const result = await pool.query(query, [email]);
```

## Custom Validation

### Creating Custom Schemas
```typescript
const customSchema = z.object({
  playerIds: z.array(z.string().max(100))
    .min(1, 'At least one player required')
    .max(9, 'Maximum 9 players allowed')
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Duplicate players not allowed'
    ),
  
  contestId: z.string()
    .regex(/^[A-Z0-9]{8,12}$/, 'Invalid contest ID format'),
  
  entryFee: moneySchema
    .refine(
      (fee) => [1, 3, 5, 10, 20, 50, 100].includes(fee),
      'Invalid entry fee amount'
    )
});
```

### Async Validation
```typescript
const schema = z.object({
  username: z.string().refine(
    async (username) => {
      const exists = await checkUsernameExists(username);
      return !exists;
    },
    'Username already taken'
  )
});
```

## Error Handling

Validation errors return consistent JSON responses:

```json
{
  "error": "Validation error",
  "details": [
    {
      "path": "email",
      "message": "Invalid email format"
    },
    {
      "path": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

## Migration Guide

To add validation to existing routes:

1. Import validation utilities:
```typescript
import { withValidation, [schemaName] } from '@/lib/validation';
```

2. Replace function export with validated version:
```typescript
// Before
export async function POST(req: NextRequest) {
  const body = await req.json();
  // ...
}

// After
export const POST = withValidation(schema, async (req, body) => {
  // body is validated
  // ...
});
```

3. Update error handling to use validation errors.

## Testing

Test validation with invalid inputs:

```typescript
// Test SQL injection
const response = await fetch('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({
    query: "'; DROP TABLE users; --"
  })
});
expect(response.status).toBe(400);

// Test XSS
const response = await fetch('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({
    description: '<script>alert("XSS")</script>'
  })
});
expect(response.status).toBe(400);
```

## Performance

- Validation adds ~1-2ms overhead per request
- Schemas are parsed once at startup
- No runtime compilation overhead
- Efficient error collection and reporting

## Security Checklist

- [ ] All API routes use validation middleware
- [ ] File uploads validate type and size
- [ ] SQL queries use parameterized statements
- [ ] User input is sanitized before display
- [ ] Rate limiting is implemented
- [ ] CSRF tokens for state-changing operations
- [ ] Request size limits enforced
- [ ] Sensitive data is masked in logs
- [ ] Origin validation for CORS
- [ ] JSON depth validation to prevent DoS