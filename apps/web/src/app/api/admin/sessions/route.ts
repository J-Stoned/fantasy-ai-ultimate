/**
 * 🔥 ADMIN SESSION MANAGEMENT API 🔥
 * 
 * Manage active admin sessions - view, revoke, and monitor.
 * Uses Redis-backed session storage for enterprise security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthService, AdminSecurityAudit } from '@/lib/middleware/admin-auth';
import { sessionManager } from '@/lib/services/session-manager';
import { logger } from '../../../../lib/logging/logger';

/**
 * GET /api/admin/sessions
 * Get all active sessions for the current admin user
 */
export async function GET(request: NextRequest) {
  try {
    // Get current session from token
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const validationContext = {
      ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    const currentSession = await AdminAuthService.validateSession(token, validationContext);
    if (!currentSession) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if user has permission to view sessions
    if (!AdminAuthService.hasPermission(currentSession, 'admin:all') &&
        !AdminAuthService.hasPermission(currentSession, 'sessions:view')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get all sessions for the user
    const sessions = await AdminAuthService.getUserSessions(currentSession.userId);

    // Log the action
    AdminSecurityAudit.logAction(currentSession, 'VIEW_SESSIONS', {
      sessionCount: sessions.length
    });

    // Format sessions for response
    const formattedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceInfo: session.deviceInfo,
      isCurrent: session.sessionId === currentSession.sessionId,
      rememberMe: session.rememberMe
    }));

    return NextResponse.json({
      success: true,
      sessions: formattedSessions,
      currentSessionId: currentSession.sessionId
    });

  } catch (error) {
    logger.error('[ADMIN SESSIONS API] Error getting sessions:', { error: error });
    return NextResponse.json(
      { error: 'Failed to retrieve sessions' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sessions/:sessionId
 * Revoke a specific session
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get current session from token
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const validationContext = {
      ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    const currentSession = await AdminAuthService.validateSession(token, validationContext);
    if (!currentSession) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if user has permission to revoke sessions
    if (!AdminAuthService.hasPermission(currentSession, 'admin:all') &&
        !AdminAuthService.hasPermission(currentSession, 'sessions:manage')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get session ID to revoke from request body
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Prevent revoking current session
    if (sessionId === currentSession.sessionId) {
      return NextResponse.json(
        { error: 'Cannot revoke current session. Use logout instead.' },
        { status: 400 }
      );
    }

    // Get session details before revoking (for security audit)
    const targetSession = await sessionManager.getUserSessions(currentSession.userId);
    const sessionToRevoke = targetSession.find(s => s.sessionId === sessionId);

    if (!sessionToRevoke) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Revoke the session
    const revoked = await sessionManager.destroySession(sessionId);

    if (revoked) {
      // Log the action
      AdminSecurityAudit.logAction(currentSession, 'REVOKE_SESSION', {
        revokedSessionId: sessionId,
        revokedSessionIp: sessionToRevoke.ipAddress,
        revokedSessionCreated: sessionToRevoke.createdAt
      });

      // Log security event
      AdminSecurityAudit.logSecurityEvent(
        'SESSION_REVOKED',
        'medium',
        {
          adminUser: currentSession.username,
          revokedSessionId: sessionId,
          reason: 'Manual revocation by admin'
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Session revoked successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to revoke session' },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('[ADMIN SESSIONS API] Error revoking session:', { error: error });
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sessions/revoke-all
 * Revoke all sessions except the current one
 */
export async function POST(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    
    // Handle revoke-all endpoint
    if (pathname.endsWith('/revoke-all')) {
      // Get current session from token
      const token = request.cookies.get('admin_token')?.value;
      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const validationContext = {
        ipAddress: request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      };

      const currentSession = await AdminAuthService.validateSession(token, validationContext);
      if (!currentSession) {
        return NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        );
      }

      // Check if user has permission to revoke sessions
      if (!AdminAuthService.hasPermission(currentSession, 'admin:all') &&
          !AdminAuthService.hasPermission(currentSession, 'sessions:manage')) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Get all user sessions
      const allSessions = await AdminAuthService.getUserSessions(currentSession.userId);
      
      // Revoke all sessions except current
      let revokedCount = 0;
      for (const session of allSessions) {
        if (session.sessionId !== currentSession.sessionId) {
          const revoked = await sessionManager.destroySession(session.sessionId);
          if (revoked) {
            revokedCount++;
          }
        }
      }

      // Log the action
      AdminSecurityAudit.logAction(currentSession, 'REVOKE_ALL_SESSIONS', {
        revokedCount,
        totalSessions: allSessions.length
      });

      // Log security event
      AdminSecurityAudit.logSecurityEvent(
        'ALL_SESSIONS_REVOKED',
        'high',
        {
          adminUser: currentSession.username,
          revokedCount,
          reason: 'Manual revocation of all sessions'
        }
      );

      return NextResponse.json({
        success: true,
        message: `Revoked ${revokedCount} sessions`,
        revokedCount
      });
    }

    // Invalid endpoint
    return NextResponse.json(
      { error: 'Invalid endpoint' },
      { status: 404 }
    );

  } catch (error) {
    logger.error('[ADMIN SESSIONS API] Error in POST handler:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}