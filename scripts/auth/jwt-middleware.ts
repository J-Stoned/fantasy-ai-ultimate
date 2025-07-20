import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        tier: 'starter' | 'professional' | 'enterprise';
        permissions: string[];
      };
    }
  }
}

// Generate a secure JWT secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set in environment, using generated secret');
  console.warn('⚠️  Set JWT_SECRET in .env for production!');
}

export interface TokenPayload {
  id: string;
  email: string;
  tier: 'starter' | 'professional' | 'enterprise';
  permissions: string[];
}

// Create JWT token
export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'fantasy-ai',
    audience: 'fantasy-ai-api'
  });
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'fantasy-ai',
    audience: 'fantasy-ai-api'
  }) as TokenPayload;
}

// Authentication middleware
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'No authorization header provided'
    });
  }
  
  const [bearer, token] = authHeader.split(' ');
  
  if (bearer !== 'Bearer' || !token) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid authorization format. Use: Bearer <token>'
    });
  }
  
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please login again'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }
    
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
}

// Permission-based middleware
export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const hasPermission = permissions.some(permission => 
      req.user!.permissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Required permissions: ${permissions.join(', ')}`
      });
    }
    
    next();
  };
}

// Tier-based middleware
export function requireTier(minTier: 'starter' | 'professional' | 'enterprise') {
  const tierLevels = {
    starter: 1,
    professional: 2,
    enterprise: 3
  };
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const userTierLevel = tierLevels[req.user.tier];
    const requiredTierLevel = tierLevels[minTier];
    
    if (userTierLevel < requiredTierLevel) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `This endpoint requires ${minTier} tier or higher`
      });
    }
    
    next();
  };
}

// API Key authentication as alternative to JWT
export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    // Fall back to JWT auth
    return authMiddleware(req, res, next);
  }
  
  try {
    // In production, this would query the database
    // For now, we'll implement a simple validation
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // TODO: Replace with database lookup
    // const user = await validateAPIKey(keyHash);
    
    // Mock user for now
    if (apiKey.startsWith('sk_')) {
      const [, tier] = apiKey.split('_');
      req.user = {
        id: 'api-user',
        email: 'api@fantasy-ai.com',
        tier: tier as any || 'starter',
        permissions: ['read', 'write']
      };
      next();
    } else {
      res.status(401).json({ 
        error: 'Invalid API key',
        message: 'Please provide a valid API key'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during API key validation'
    });
  }
}

// Rate limiting per user/tier
export function createRateLimiter() {
  const limits = {
    starter: { windowMs: 15 * 60 * 1000, max: 100 },
    professional: { windowMs: 15 * 60 * 1000, max: 500 },
    enterprise: { windowMs: 15 * 60 * 1000, max: 10000 }
  };
  
  const userLimits = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const tier = req.user.tier;
    const limit = limits[tier];
    const now = Date.now();
    
    let userLimit = userLimits.get(userId);
    
    if (!userLimit || userLimit.resetTime < now) {
      userLimit = {
        count: 0,
        resetTime: now + limit.windowMs
      };
      userLimits.set(userId, userLimit);
    }
    
    userLimit.count++;
    
    if (userLimit.count > limit.max) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter.toString());
      
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds`,
        limit: limit.max,
        windowMs: limit.windowMs,
        tier
      });
    }
    
    res.set('X-RateLimit-Limit', limit.max.toString());
    res.set('X-RateLimit-Remaining', (limit.max - userLimit.count).toString());
    res.set('X-RateLimit-Reset', userLimit.resetTime.toString());
    
    next();
  };
}

// Export all middleware
export default {
  authMiddleware,
  apiKeyMiddleware,
  requirePermission,
  requireTier,
  createRateLimiter,
  createToken,
  verifyToken
};