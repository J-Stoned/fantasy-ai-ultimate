import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { logger } from '../logging/logger';

// Security utilities
export const sanitizeHtml = (input: string): string => {
  // Remove all HTML tags and script content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

export const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};

// SQL injection detection
export const detectSqlInjection = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(--|\/\*|\*\/|xp_|sp_)/i,
    /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/i,
    /[';].*(--)/, 
    /(\b(sys|information_schema)\b)/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

// Malicious input detection
export const detectMaliciousInput = (input: string): boolean => {
  const maliciousPatterns = [
    /<script|javascript:|onerror=|onload=|onclick=/i,
    /\.\.[\/\\]/, // Path traversal
    /%00|%0d|%0a/i, // Null bytes and newlines
    /\0|\\x00/i, // Null characters
  ];
  
  return maliciousPatterns.some(pattern => pattern.test(input));
};

// Request size limits
export const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB
export const MAX_JSON_DEPTH = 10;

// Validation middleware factory
export function validateRequest<T>(schema: ZodSchema<T>) {
  return async (
    req: NextRequest,
    handler: (req: NextRequest, parsedData: T) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    try {
      // Check request size
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
        return NextResponse.json(
          { error: 'Request too large' },
          { status: 413 }
        );
      }

      // Parse request body
      let body: any;
      
      if (req.method === 'GET') {
        // For GET requests, parse from URL search params
        const { searchParams } = new URL(req.url);
        body = Object.fromEntries(searchParams);
      } else {
        // For other methods, parse JSON body
        try {
          const text = await req.text();
          if (text) {
            // Check for SQL injection in raw text
            if (detectSqlInjection(text)) {
              return NextResponse.json(
                { error: 'Invalid input detected' },
                { status: 400 }
              );
            }
            body = JSON.parse(text);
          } else {
            body = {};
          }
        } catch (e) {
          return NextResponse.json(
            { error: 'Invalid JSON' },
            { status: 400 }
          );
        }
      }

      // Validate against schema
      const validated = schema.parse(body);
      
      // Additional security checks on validated data
      const stringified = JSON.stringify(validated);
      if (detectMaliciousInput(stringified)) {
        return NextResponse.json(
          { error: 'Invalid input detected' },
          { status: 400 }
        );
      }

      // Call the handler with validated data
      return handler(req, validated);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      
      logger.error('Validation middleware error:', { error: error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// Validation wrapper for route handlers
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (req: NextRequest, data: T) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    return validateRequest(schema)(req, handler);
  };
}

// Query params validation wrapper
export function validateQueryParams<T>(
  schema: ZodSchema<T>,
  handler: (req: NextRequest, params: T) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const { searchParams } = new URL(req.url);
      const params = Object.fromEntries(searchParams);
      
      // Check for SQL injection in query params
      for (const value of Object.values(params)) {
        if (typeof value === 'string' && detectSqlInjection(value)) {
          return NextResponse.json(
            { error: 'Invalid query parameters' },
            { status: 400 }
          );
        }
      }
      
      const validated = schema.parse(params);
      return handler(req, validated);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Query parameter validation error',
            details: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// Path params validation wrapper
export function validatePathParams<T>(
  schema: ZodSchema<T>,
  handler: (req: NextRequest, params: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: any }): Promise<NextResponse> => {
    try {
      const validated = schema.parse(context.params);
      
      // Check for path traversal attempts
      const stringified = JSON.stringify(validated);
      if (stringified.includes('../') || stringified.includes('..\\')) {
        return NextResponse.json(
          { error: 'Invalid path parameters' },
          { status: 400 }
        );
      }
      
      return handler(req, validated);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Path parameter validation error',
            details: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// Combined validation for body and params
export function validateAll<TBody, TParams>(
  bodySchema: ZodSchema<TBody>,
  paramsSchema: ZodSchema<TParams>,
  handler: (req: NextRequest, data: { body: TBody; params: TParams }) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: any }): Promise<NextResponse> => {
    try {
      // Validate params
      const validatedParams = paramsSchema.parse(context.params);
      
      // Validate body
      const body = await req.json();
      const validatedBody = bodySchema.parse(body);
      
      // Additional security checks
      const combined = { body: validatedBody, params: validatedParams };
      const stringified = JSON.stringify(combined);
      
      if (detectSqlInjection(stringified) || detectMaliciousInput(stringified)) {
        return NextResponse.json(
          { error: 'Invalid input detected' },
          { status: 400 }
        );
      }
      
      return handler(req, combined);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// Rate limiting helper (to be used with validation)
export function withRateLimit(
  identifier: string,
  limit: number = 100,
  window: number = 60 // seconds
) {
  return (handler: Function) => {
    // This would integrate with Redis or similar for production
    // Placeholder for rate limiting logic
    return handler;
  };
}

// Export all schemas for easy import
export * from './schemas/auth';
export * from './schemas/common';
export * from './schemas/financial';
export * from './schemas/leagues';
export * from './schemas/contests';
export * from './schemas/admin';