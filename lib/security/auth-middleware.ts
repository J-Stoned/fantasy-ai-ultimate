import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { RateLimiter } from './rate-limiter';
import { SecurityHeaders } from './security-headers';
import { CSRFProtection } from './csrf-protection';

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
  requireCSRF?: boolean;
  allowedRoles?: string[];
}

const defaultOptions: AuthMiddlewareOptions = {
  requireAuth: true,
  rateLimit: { max: 100, windowMs: 60000 },
  requireCSRF: true,
  allowedRoles: []
};

export function withAuth(
  handler: (req: NextRequest, context?: any) => Promise<Response>,
  options: AuthMiddlewareOptions = {}
) {
  const config = { ...defaultOptions, ...options };
  
  return async (req: NextRequest, context?: any) => {
    try {
      // Apply security headers
      const headers = SecurityHeaders.apply();
      
      // Rate limiting
      if (config.rateLimit) {
        const rateLimiter = new RateLimiter(config.rateLimit);
        const allowed = await rateLimiter.check(req);
        if (!allowed) {
          return new NextResponse('Too Many Requests', { 
            status: 429,
            headers 
          });
        }
      }
      
      // CSRF protection for state-changing methods
      if (config.requireCSRF && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const csrf = new CSRFProtection();
        const valid = await csrf.verify(req);
        if (!valid) {
          return new NextResponse('Invalid CSRF Token', { 
            status: 403,
            headers 
          });
        }
      }
      
      // Authentication check
      if (config.requireAuth) {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              get(name: string) {
                return req.cookies.get(name)?.value;
              },
              set() {},
              remove() {}
            }
          }
        );
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          return new NextResponse('Unauthorized', { 
            status: 401,
            headers 
          });
        }
        
        // Role-based access control
        if (config.allowedRoles.length > 0) {
          const userRole = user.user_metadata?.role || 'user';
          if (!config.allowedRoles.includes(userRole)) {
            return new NextResponse('Forbidden', { 
              status: 403,
              headers 
            });
          }
        }
        
        // Add user to context
        if (context) {
          context.user = user;
        }
      }
      
      // Call the actual handler
      const response = await handler(req, context);
      
      // Apply security headers to response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value as string);
      });
      
      return response;
      
    } catch (error) {
      console.error('Auth middleware error:', error);
      return new NextResponse('Internal Server Error', { 
        status: 500,
        headers: SecurityHeaders.apply()
      });
    }
  };
}