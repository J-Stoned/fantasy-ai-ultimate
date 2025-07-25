/**
 * 🔥 ADMIN AUTHENTICATION - Enterprise Security Middleware 🔥
 * 
 * Professional admin authentication and authorization system with Redis-backed sessions.
 * Handles session management, role-based access control, and security monitoring.
 */

import { sessionManager, SessionData } from '../services/session-manager';
import { logger } from '../logging/logger';
import { errorHandler, createError } from '../errors';

export interface AdminSession {
  userId: string;
  username: string;
  email?: string;
  role: {
    name: string;
    permissions: string[];
  };
  lastActivity: string;
  sessionToken: string;
  sessionId?: string;
}

export interface AdminRole {
  name: string;
  permissions: string[];
  description: string;
}

// Predefined admin roles with permissions
export const ADMIN_ROLES: Record<string, AdminRole> = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    permissions: ['admin:all'],
    description: 'Full system access and control'
  },
  ML_ADMIN: {
    name: 'ML Administrator',
    permissions: [
      'ml:view',
      'ml:train',
      'ml:deploy',
      'ml:monitor',
      'gpu:monitor',
      'gpu:optimize'
    ],
    description: 'Machine learning system administration'
  },
  DFS_ADMIN: {
    name: 'DFS Administrator',
    permissions: [
      'dfs:view',
      'dfs:trade',
      'dfs:optimize',
      'dfs:monitor',
      'portfolio:manage'
    ],
    description: 'DFS trading system administration'
  },
  ANALYST: {
    name: 'System Analyst',
    permissions: [
      'analytics:view',
      'reports:generate',
      'metrics:view'
    ],
    description: 'System analysis and reporting'
  }
};

export class AdminAuthService {
  /**
   * Validate admin session token using Redis
   */
  static async validateSession(
    token: string,
    validationContext?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<AdminSession | null> {
    try {
      // Validate session with Redis session manager
      const validation = await sessionManager.validateSession(token, validationContext);
      
      if (!validation.valid || !validation.session) {
        logger.warn('Admin session validation failed', {
          service: 'admin-auth',
          reason: validation.reason,
          token: token.substring(0, 10) + '...'
        });
        return null;
      }

      const sessionData = validation.session;

      // Check if token rotation is needed
      if (validation.requiresRotation) {
        logger.info('Admin session requires token rotation', {
          service: 'admin-auth',
          userId: sessionData.userId,
          sessionId: sessionData.sessionId
        });
        // Token rotation should be handled by the calling code to update cookies
      }

      // Convert SessionData to AdminSession format for compatibility
      const adminSession: AdminSession = {
        userId: sessionData.userId,
        username: sessionData.username,
        email: sessionData.email,
        role: sessionData.role,
        lastActivity: sessionData.lastActivity,
        sessionToken: token,
        sessionId: sessionData.sessionId
      };

      return adminSession;
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        service: 'admin-auth',
        operation: 'validateSession',
        token: token.substring(0, 10) + '...'
      });
      logger.error('Admin session validation failed', {
        errorId: handledError.id,
        service: 'admin-auth'
      });
      return null;
    }
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(session: AdminSession | SessionData, permission: string): boolean {
    return session.role.permissions.includes(permission) || 
           session.role.permissions.includes('admin:all');
  }

  /**
   * Create admin session in Redis
   */
  static async createSession(
    username: string,
    email: string,
    role: AdminRole,
    metadata: {
      ipAddress: string;
      userAgent: string;
      rememberMe?: boolean;
      deviceInfo?: any;
    }
  ): Promise<{ token: string; session: SessionData } | null> {
    try {
      // Create session using Redis session manager
      const result = await sessionManager.createSession(
        {
          userId: `admin_${Date.now()}`,
          username,
          email,
          role
        },
        metadata
      );

      return result;
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        service: 'admin-auth',
        operation: 'createSession',
        username
      });
      logger.error('Admin session creation failed', {
        errorId: handledError.id,
        service: 'admin-auth',
        username
      });
      return null;
    }
  }

  /**
   * Destroy admin session
   */
  static async destroySession(token: string): Promise<boolean> {
    try {
      // First validate to get session ID
      const validation = await sessionManager.validateSession(token);
      if (!validation.valid || !validation.session) {
        return true; // Already invalid
      }

      // Destroy the session
      return await sessionManager.destroySession(validation.session.sessionId);
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        service: 'admin-auth',
        operation: 'destroySession'
      });
      logger.error('Admin session destruction failed', {
        errorId: handledError.id,
        service: 'admin-auth'
      });
      return false;
    }
  }

  /**
   * Get all sessions for an admin user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      return await sessionManager.getUserSessions(userId);
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        service: 'admin-auth',
        operation: 'getUserSessions',
        userId
      });
      logger.error('Failed to get user sessions', {
        errorId: handledError.id,
        service: 'admin-auth',
        userId
      });
      return [];
    }
  }

  /**
   * Rotate session token for security
   */
  static async rotateSessionToken(oldToken: string): Promise<string | null> {
    try {
      return await sessionManager.rotateSessionToken(oldToken);
    } catch (error) {
      const handledError = errorHandler.handleError(error, {
        service: 'admin-auth',
        operation: 'rotateSessionToken'
      });
      logger.error('Token rotation failed', {
        errorId: handledError.id,
        service: 'admin-auth'
      });
      return null;
    }
  }
}

// Security audit logging
export class AdminSecurityAudit {
  /**
   * Log admin action for security audit
   */
  static logAction(session: AdminSession | SessionData, action: string, details?: any): void {
    logger.info('Admin security audit', {
      service: 'admin-security-audit',
      userId: session.userId,
      username: session.username,
      action,
      details,
      auditType: 'action',
      ipAddress: 'simulated', // In production, get from request
      userAgent: 'simulated'   // In production, get from request
    });
    
    // In production, store in secure audit database
  }

  /**
   * Log security event
   */
  static logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', details?: any): void {
    const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    
    logger[logLevel]('Security event detected', {
      service: 'admin-security',
      event,
      severity,
      details,
      auditType: 'security_event',
      requiresAlert: severity === 'high'
    });
    
    // In production, alert security team for high severity events
    if (severity === 'high') {
      logger.fatal('HIGH SEVERITY SECURITY EVENT - IMMEDIATE ATTENTION REQUIRED', {
        service: 'admin-security',
        event,
        details,
        alertLevel: 'critical'
      });
    }
  }
}

/**
 * Create admin middleware for Next.js
 */
export function createAdminMiddleware() {
  return async function adminMiddleware(request: any) {
    const { NextResponse } = await import('next/server');
    const token = request.cookies.get('admin_token')?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    
    // Get validation context from request
    const validationContext = {
      ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  request.ip || 
                  'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };
    
    // Validate session asynchronously with Redis
    const session = await AdminAuthService.validateSession(token, validationContext);
    
    if (!session) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('admin_token');
      return response;
    }
    
    // Check if token needs rotation
    const validation = await sessionManager.validateSession(token, validationContext);
    if (validation.requiresRotation) {
      const newToken = await AdminAuthService.rotateSessionToken(token);
      if (newToken) {
        const response = NextResponse.next();
        response.cookies.set('admin_token', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 24 hours
          path: '/'
        });
        
        // Log the access with rotated token
        AdminSecurityAudit.logAction(session, 'PAGE_ACCESS', {
          path: request.nextUrl.pathname,
          tokenRotated: true
        });
        
        return response;
      }
    }
    
    // Log the access
    AdminSecurityAudit.logAction(session, 'PAGE_ACCESS', {
      path: request.nextUrl.pathname
    });
    
    return NextResponse.next();
  };
}