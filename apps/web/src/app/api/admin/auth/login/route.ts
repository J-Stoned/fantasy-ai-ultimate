/**
 * 🔥 ADMIN AUTHENTICATION API 🔥
 * 
 * Enterprise-grade authentication endpoint with MFA support,
 * security monitoring, and session management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { verifyPassword, hashPassword, checkPasswordStrength } from '@/lib/utils/password';
import { AdminAuthService, ADMIN_ROLES } from '@/lib/middleware/admin-auth';
import { withValidation, adminLoginSchema, clientInfoSchema } from '@/lib/validation';
import { logger } from '../../../../../lib/logging/logger';

// Log to ensure file is loading
logger.info('[ADMIN AUTH API] Route file loaded');

// Admin credentials from environment variables
// SECURITY: Never hard-code credentials! Always use environment variables
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || '',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
  mfaSecret: process.env.ADMIN_MFA_SECRET || '',
  // Support legacy SHA-256 during migration
  isLegacyHash: process.env.ADMIN_PASSWORD_IS_SHA256 === 'true'
};

// Validate environment variables on startup
if (!ADMIN_CREDENTIALS.email || !ADMIN_CREDENTIALS.passwordHash) {
  console.error('[ADMIN AUTH] CRITICAL: Admin credentials not configured in environment variables!');
  console.error('[ADMIN AUTH] Please set ADMIN_EMAIL, ADMIN_PASSWORD_HASH, and ADMIN_MFA_SECRET');
}

// Track login attempts for security
const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

// Type is now inferred from the Zod schema
type LoginRequest = {
  email: string;
  password: string;
  mfaToken?: string;
  rememberMe?: boolean;
  clientInfo?: {
    userAgent: string;
    timezone: string;
    language: string;
  };
};

export const POST = withValidation(adminLoginSchema.extend({
  mfaToken: adminLoginSchema.shape.email.optional(), // Reuse email validation for MFA token
  clientInfo: clientInfoSchema.partial().optional()
}), async (request: NextRequest, body) => {
  logger.info('[ADMIN AUTH API] Login endpoint hit');
  logger.info('[ADMIN AUTH API] Request method:', { data: request.method });
  logger.info('[ADMIN AUTH API] Request URL:', { data: request.url });
  
  try {
    // Body is already validated and typed
    logger.info('[ADMIN AUTH API] Request body received:', { data: { 
      email: body.email, 
      hasPassword: !!body.password,
      hasMFA: !!body.mfaToken 
    } });
    
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Check for rate limiting
    const attempts = loginAttempts.get(clientIp) || { count: 0, lastAttempt: new Date() };
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
    
    if (attempts.count >= 5 && timeSinceLastAttempt < 15 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Validate email
    if (body.email !== ADMIN_CREDENTIALS.email) {
      updateLoginAttempts(clientIp, false);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Validate password
    let isValidPassword = false;
    
    if (ADMIN_CREDENTIALS.isLegacyHash) {
      // Legacy SHA-256 validation (for migration period)
      const passwordHash = crypto.createHash('sha256').update(body.password).digest('hex');
      isValidPassword = passwordHash === ADMIN_CREDENTIALS.passwordHash;
      
      // If valid, log warning about needing to update to bcrypt
      if (isValidPassword) {
        logger.warn('[ADMIN AUTH] WARNING: Still using SHA-256 hash. Please update to bcrypt!');
        logger.info('[ADMIN AUTH] To migrate, run: npm run admin:hash-password');
      }
    } else {
      // Modern bcrypt validation
      const verifyResult = await verifyPassword(body.password, ADMIN_CREDENTIALS.passwordHash);
      if (!verifyResult.success) {
        logger.error('[ADMIN AUTH] Password verification error:', { error: verifyResult.error });
        updateLoginAttempts(clientIp, false);
        return NextResponse.json(
          { error: 'Authentication system error' },
          { status: 500 }
        );
      }
      isValidPassword = verifyResult.isValid || false;
    }
    
    if (!isValidPassword) {
      updateLoginAttempts(clientIp, false);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if MFA is required but not provided
    if (!body.mfaToken) {
      return NextResponse.json(
        { requiresMFA: true },
        { status: 200 }
      );
    }

    // Validate MFA token
    if (body.mfaToken !== ADMIN_CREDENTIALS.mfaSecret) {
      updateLoginAttempts(clientIp, false);
      return NextResponse.json(
        { error: 'Invalid MFA code' },
        { status: 401 }
      );
    }

    // Successful login - create Redis-backed session
    const sessionMetadata = {
      ipAddress: clientIp,
      userAgent: body.clientInfo?.userAgent || request.headers.get('user-agent') || 'unknown',
      rememberMe: body.rememberMe || false,
      deviceInfo: body.clientInfo || {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: request.headers.get('accept-language')?.split(',')[0] || 'en'
      }
    };

    // Create session using AdminAuthService
    const sessionResult = await AdminAuthService.createSession(
      body.email,
      body.email,
      ADMIN_ROLES.SUPER_ADMIN,
      sessionMetadata
    );

    if (!sessionResult) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    const { token: sessionToken, session } = sessionResult;

    // Clear login attempts on success
    loginAttempts.delete(clientIp);

    // Set secure cookie
    const cookieStore = cookies();
    const cookieMaxAge = body.rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 24; // 7 days or 24 hours
    cookieStore.set('admin_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
      path: '/'
    });

    // Log successful login
    logger.info('[ADMIN AUTH] Successful login for ${body.email} from ${clientIp}');

    return NextResponse.json({
      success: true,
      sessionToken,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      user: {
        email: body.email,
        username: session.username,
        role: session.role.name,
        permissions: session.role.permissions
      }
    });

  } catch (error) {
    logger.error('[ADMIN AUTH API] Login error:', { error: error });
    logger.error('[ADMIN AUTH API] Error details:', { error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    } });
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    );
  }
});

// Also support GET for client info
export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Mock location lookup - in production use a real IP geolocation service
  const location = clientIp === 'unknown' ? 'Unknown' : 'Seattle, WA';
  
  // Get last login from session storage (mock for now)
  const lastLogin = 'Never';

  return NextResponse.json({
    ipAddress: clientIp,
    location,
    lastLogin,
    userAgent
  });
}

function updateLoginAttempts(ip: string, success: boolean) {
  if (success) {
    loginAttempts.delete(ip);
  } else {
    const current = loginAttempts.get(ip) || { count: 0, lastAttempt: new Date() };
    loginAttempts.set(ip, {
      count: current.count + 1,
      lastAttempt: new Date()
    });
  }
}