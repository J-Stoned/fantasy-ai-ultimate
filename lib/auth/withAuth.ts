import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAPILogger } from '@/lib/utils/logger';

const logger = createAPILogger('auth:wrapper');

export type AuthenticatedHandler = (
  request: NextRequest,
  context: { params?: any; user: any }
) => Promise<NextResponse>;

/**
 * Authentication wrapper for API routes
 * Ensures user is authenticated before executing handler
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, context?: any) => {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        logger.warn('Unauthorized access attempt', {
          path: request.nextUrl.pathname,
          method: request.method,
          error: error?.message
        });

        return NextResponse.json(
          { 
            error: 'Unauthorized',
            message: 'You must be logged in to access this resource'
          },
          { status: 401 }
        );
      }

      // Add user to context for handler
      const enhancedContext = {
        ...context,
        user
      };

      // Execute the actual handler with authenticated user
      return handler(request, enhancedContext);
    } catch (error) {
      logger.error('Auth wrapper error', error);
      
      return NextResponse.json(
        { 
          error: 'Internal server error',
          message: 'Authentication check failed'
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Admin-only authentication wrapper
 * Requires user to have admin role
 */
export function withAdminAuth(handler: AuthenticatedHandler) {
  return withAuth(async (request, context) => {
    const { user } = context;

    // Check for admin role in user metadata
    const isAdmin = user.user_metadata?.role === 'admin' || 
                    user.email?.endsWith('@fantasy-ai-ultimate.com');

    if (!isAdmin) {
      logger.warn('Admin access denied', {
        userId: user.id,
        email: user.email,
        path: request.nextUrl.pathname
      });

      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'Admin access required'
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  });
}

/**
 * Service account authentication wrapper
 * For inter-service communication
 */
export function withServiceAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, context?: any) => {
    const serviceToken = request.headers.get('x-service-token');
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

    if (!serviceToken || serviceToken !== expectedToken) {
      logger.warn('Invalid service token', {
        path: request.nextUrl.pathname,
        hasToken: !!serviceToken
      });

      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Invalid service token'
        },
        { status: 401 }
      );
    }

    // Create a service user object
    const serviceUser = {
      id: 'service-account',
      email: 'service@fantasy-ai-ultimate.com',
      role: 'service'
    };

    const enhancedContext = {
      ...context,
      user: serviceUser
    };

    return handler(request, enhancedContext);
  };
}