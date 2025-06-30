import { createClient } from '../supabase/server';
import { NextRequest } from 'next/server';
import { createApiLogger } from '../utils/logger';

const logger = createApiLogger('auth-middleware');

export interface AuthUser {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  metadata?: Record<string, any>;
}

export async function requireAuth(
  req: NextRequest,
  options: {
    requiredTier?: 'free' | 'pro' | 'enterprise';
    allowServiceAccounts?: boolean;
  } = {}
): Promise<{ user: AuthUser | null; error: Response | null }> {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('Missing authorization header', {
        path: req.nextUrl.pathname,
        method: req.method,
      });
      
      return {
        user: null,
        error: new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      };
    }

    const token = authHeader.substring(7);
    const supabase = await createClient();
    
    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Invalid auth token', {
        error: error?.message,
        path: req.nextUrl.pathname,
      });
      
      return {
        user: null,
        error: new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      };
    }

    // Get user tier from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('userId', user.id)
      .single();
    
    const userTier = profile?.tier || 'free';
    
    // Check tier requirements
    if (options.requiredTier) {
      const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
      const userTierLevel = tierHierarchy[userTier as keyof typeof tierHierarchy] || 0;
      const requiredTierLevel = tierHierarchy[options.requiredTier];
      
      if (userTierLevel < requiredTierLevel) {
        logger.warn('Insufficient tier access', {
          userId: user.id,
          userTier,
          requiredTier: options.requiredTier,
          path: req.nextUrl.pathname,
        });
        
        return {
          user: null,
          error: new Response(
            JSON.stringify({ 
              error: 'Insufficient permissions',
              requiredTier: options.requiredTier,
              currentTier: userTier,
            }),
            { 
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        };
      }
    }

    logger.info('Auth successful', {
      userId: user.id,
      tier: userTier,
      path: req.nextUrl.pathname,
    });

    return {
      user: {
        id: user.id,
        email: user.email!,
        tier: userTier as 'free' | 'pro' | 'enterprise',
        metadata: user.user_metadata,
      },
      error: null,
    };
  } catch (error) {
    logger.error('Auth middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.nextUrl.pathname,
    });
    
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Authentication service error' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }
}

// Helper wrapper for API routes
export function withAuth<T extends any[], R>(
  handler: (req: NextRequest, user: AuthUser, ...args: T) => Promise<R>,
  options?: Parameters<typeof requireAuth>[1]
) {
  return async (req: NextRequest, ...args: T): Promise<R | Response> => {
    const { user, error } = await requireAuth(req, options);
    
    if (error) {
      return error as any;
    }
    
    return handler(req, user!, ...args);
  };
}