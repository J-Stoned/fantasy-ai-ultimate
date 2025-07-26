/**
 * 🔐 JWT Verification Utility
 * Secure JWT token verification with proper validation
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/environment';

interface JWTPayload {
  sub?: string;
  userId?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify and decode JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    // Get secret from environment
    const secret = env.JWT_SECRET || env.NEXTAUTH_SECRET;
    
    if (!secret) {
      // JWT secret not configured - error handled by return null
      return null;
    }

    // Verify token
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256', 'HS384', 'HS512'], // Allowed algorithms
      maxAge: '7d', // Maximum token age
    }) as JWTPayload;

    // Additional validation
    if (!decoded.sub && !decoded.userId) {
      return null;
    }

    // Check expiration
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token verification failed
    return null;
  }
}

/**
 * Extract user ID from JWT token
 */
export async function extractUserIdFromJWT(token: string): Promise<string | undefined> {
  const payload = await verifyJWT(token);
  return payload?.sub || payload?.userId;
}

/**
 * Verify token without throwing errors
 */
export function isValidJWT(token: string): boolean {
  try {
    const secret = env.JWT_SECRET || env.NEXTAUTH_SECRET;
    if (!secret) return false;
    
    jwt.verify(token, secret);
    return true;
  } catch {
    return false;
  }
}