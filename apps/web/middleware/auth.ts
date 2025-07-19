/**
 * Authentication Middleware for Fantasy AI APIs
 * 
 * Provides JWT-based authentication and authorization for all API routes.
 * Supports both API keys and JWT tokens for flexibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { logger } from '../../../scripts/utils/logger';

// Environment configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const API_KEY_HEADER = 'x-api-key';
const AUTH_HEADER = 'authorization';

// Supabase client for user verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/v2/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh'
];

// Rate limiting configuration per user
const RATE_LIMITS = {
  free: { requests: 100, window: 3600000 }, // 100 requests per hour
  pro: { requests: 1000, window: 3600000 }, // 1000 requests per hour
  enterprise: { requests: 10000, window: 3600000 } // 10000 requests per hour
};

// In-memory rate limit tracker (use Redis in production)
const rateLimitTracker = new Map<string, { count: number; resetTime: number }>();

export interface AuthUser {
  id: string;
  email: string;
  role: 'free' | 'pro' | 'enterprise' | 'admin';
  permissions: string[];
}

/**
 * Verify JWT token and extract user information
 */
async function verifyJWT(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Verify user still exists and is active
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, is_active, permissions')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !user || !user.is_active) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      role: user.role || 'free',
      permissions: user.permissions || []
    };
  } catch (error) {
    logger.error('JWT verification failed', error);
    return null;
  }
}

/**
 * Verify API key
 */
async function verifyApiKey(apiKey: string): Promise<AuthUser | null> {
  try {
    const { data: key, error } = await supabase
      .from('api_keys')
      .select('user_id, permissions')
      .eq('key', apiKey)
      .eq('is_active', true)
      .single();
    
    if (error || !key) {
      return null;
    }
    
    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', key.user_id)
      .single();
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      role: user.role || 'free',
      permissions: key.permissions || []
    };
  } catch (error) {
    logger.error('API key verification failed', error);
    return null;
  }
}

/**
 * Check rate limits for user
 */
function checkRateLimit(userId: string, role: 'free' | 'pro' | 'enterprise' | 'admin'): boolean {
  if (role === 'admin') return true;
  
  const limit = RATE_LIMITS[role] || RATE_LIMITS.free;
  const now = Date.now();
  const tracker = rateLimitTracker.get(userId);
  
  if (!tracker || tracker.resetTime < now) {
    rateLimitTracker.set(userId, { count: 1, resetTime: now + limit.window });
    return true;
  }
  
  if (tracker.count >= limit.requests) {
    return false;
  }
  
  tracker.count++;
  return true;
}

/**
 * Main authentication middleware
 */
export async function authMiddleware(
  request: NextRequest,
  requiredPermissions: string[] = []
): Promise<{ user: AuthUser } | NextResponse> {
  const path = request.nextUrl.pathname;
  
  // Skip auth for public routes
  if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
    return { user: null as any };
  }
  
  // Extract authentication credentials
  const apiKey = request.headers.get(API_KEY_HEADER);
  const authHeader = request.headers.get(AUTH_HEADER);
  
  let user: AuthUser | null = null;
  
  // Try API key first
  if (apiKey) {
    user = await verifyApiKey(apiKey);
  }
  
  // Try JWT token
  if (!user && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    user = await verifyJWT(token);
  }
  
  // No valid credentials
  if (!user) {
    logger.warn('Unauthorized access attempt', { path, ip: request.ip });
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid authentication required' },
      { status: 401 }
    );
  }
  
  // Check rate limits
  if (!checkRateLimit(user.id, user.role)) {
    logger.warn('Rate limit exceeded', { userId: user.id, path });
    return NextResponse.json(
      { error: 'Rate limit exceeded', message: 'Too many requests' },
      { status: 429 }
    );
  }
  
  // Check permissions
  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.every(perm => 
      user!.permissions.includes(perm) || user!.role === 'admin'
    );
    
    if (!hasPermission) {
      logger.warn('Insufficient permissions', { userId: user.id, path, required: requiredPermissions });
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      );
    }
  }
  
  // Log successful authentication
  logger.info('Authenticated request', { 
    userId: user.id, 
    path, 
    method: request.method 
  });
  
  return { user };
}

/**
 * Wrapper for API route handlers with authentication
 */
export function withAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>,
  requiredPermissions: string[] = []
) {
  return async (req: NextRequest) => {
    const authResult = await authMiddleware(req, requiredPermissions);
    
    if ('user' in authResult) {
      return handler(req, authResult.user);
    }
    
    return authResult;
  };
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId: string, expiresIn = '24h'): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
}

/**
 * Hash API key for storage
 */
export async function hashApiKey(key: string): Promise<string> {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}