/**
 * API Error Handling Middleware
 * Provides consistent error handling for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorHandler } from '../errors/error-handler';
import { logger, requestLogger } from '../logging/logger';
import { z } from 'zod';

export interface ApiContext {
  userId?: string;
  sessionId?: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
  method: string;
  path: string;
}

/**
 * Higher-order function to wrap API routes with error handling
 */
export function withErrorHandling<T = any>(
  handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const startTime = Date.now();
    
    // Generate request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Extract context information
    const context: ApiContext = {
      requestId,
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 request.ip || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      method: request.method,
      path: new URL(request.url).pathname
    };

    // Add request ID to headers for tracing
    const headers = new Headers();
    headers.set('x-request-id', requestId);

    try {
      // Log request start
      requestLogger(request);
      
      // Call the actual handler
      const response = await handler(request, context);
      
      // Log successful response
      const duration = Date.now() - startTime;
      logger.info('API request completed', {
        requestId,
        method: context.method,
        path: context.path,
        status: response.status,
        duration,
        ipAddress: context.ipAddress
      });

      // Add request ID to response headers
      response.headers.set('x-request-id', requestId);
      
      return response;

    } catch (error) {
      // Handle the error using centralized error handler
      const handledError = errorHandler.handleError(error, {
        ...context,
        service: 'api',
        operation: `${context.method} ${context.path}`
      });

      // Log the error
      const duration = Date.now() - startTime;
      logger.error('API request failed', {
        requestId,
        errorId: handledError.id,
        method: context.method,
        path: context.path,
        duration,
        ipAddress: context.ipAddress,
        error: handledError.message
      });

      // Create error response
      const errorResponse = errorHandler.createHttpResponse(handledError);
      errorResponse.headers.set('x-request-id', requestId);
      
      return errorResponse;
    }
  };
}

/**
 * Validation middleware for API routes
 */
export function withValidation<T extends z.ZodTypeAny>(
  schema: T,
  handler: (request: NextRequest, body: z.infer<T>, context: ApiContext) => Promise<NextResponse>
) {
  return withErrorHandling(async (request: NextRequest, context: ApiContext) => {
    try {
      // Parse and validate request body
      const body = await request.json();
      const validatedBody = schema.parse(body);
      
      // Call handler with validated body
      return await handler(request, validatedBody, context);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Transform Zod errors to validation errors
        const validationErrors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!validationErrors[path]) {
            validationErrors[path] = [];
          }
          validationErrors[path].push(err.message);
        });

        return NextResponse.json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            validationErrors
          }
        }, { status: 400 });
      }
      
      throw error; // Re-throw non-validation errors
    }
  });
}

/**
 * Authentication middleware for API routes
 */
export function withAuth(
  handler: (request: NextRequest, context: ApiContext & { userId: string }) => Promise<NextResponse>
) {
  return withErrorHandling(async (request: NextRequest, context: ApiContext) => {
    // Extract authentication token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.cookies.get('auth_token')?.value ||
                  request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    // TODO: Validate token and extract user ID
    // For now, simulate user ID extraction
    const userId = 'user_123'; // Replace with actual token validation

    return await handler(request, { ...context, userId });
  });
}

/**
 * Rate limiting middleware for API routes
 */
export function withRateLimit(
  limit: number = 100,
  window: number = 60000 // 1 minute
) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return function(
    handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>
  ) {
    return withErrorHandling(async (request: NextRequest, context: ApiContext) => {
      const key = context.ipAddress;
      const now = Date.now();

      // Get or create request tracking
      let tracking = requests.get(key);
      if (!tracking || now > tracking.resetTime) {
        tracking = { count: 0, resetTime: now + window };
        requests.set(key, tracking);
      }

      // Check rate limit
      if (tracking.count >= limit) {
        const retryAfter = Math.ceil((tracking.resetTime - now) / 1000);
        
        logger.warn('Rate limit exceeded', {
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          limit,
          window,
          retryAfter
        });

        return NextResponse.json({
          error: {
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded',
            retryAfter
          }
        }, { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString()
          }
        });
      }

      // Increment request count
      tracking.count++;

      return await handler(request, context);
    });
  };
}

/**
 * CORS middleware for API routes
 */
export function withCors(
  options: {
    origin?: string | string[];
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
  } = {}
) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false
  } = options;

  return function(
    handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>
  ) {
    return withErrorHandling(async (request: NextRequest, context: ApiContext) => {
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': Array.isArray(origin) ? origin.join(', ') : origin,
            'Access-Control-Allow-Methods': methods.join(', '),
            'Access-Control-Allow-Headers': headers.join(', '),
            'Access-Control-Allow-Credentials': credentials.toString()
          }
        });
      }

      // Call handler
      const response = await handler(request, context);

      // Add CORS headers to response
      response.headers.set('Access-Control-Allow-Origin', Array.isArray(origin) ? origin.join(', ') : origin);
      if (credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      return response;
    });
  };
}

/**
 * Compose multiple middleware functions
 */
export function compose(...middlewares: Array<(handler: any) => any>) {
  return (handler: any) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}