/**
 * 🔥 ADMIN SESSION MANAGEMENT API - Revoke All Sessions 🔥
 * 
 * Revoke all sessions except the current one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthService, AdminSecurityAudit } from '@/lib/middleware/admin-auth';
import { sessionManager } from '@/lib/services/session-manager';
import { logger } from '../../../../../lib/logging/logger';

/**
 * POST /api/admin/sessions/revoke-all
 * Revoke all sessions except the current one
 */
export async function POST(request: NextRequest) {
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

    // Get all user sessions
    const allSessions = await AdminAuthService.getUserSessions(currentSession.userId);
    
    // Revoke all sessions except current
    let revokedCount = 0;
    const revokedSessions = [];
    
    for (const session of allSessions) {
      if (session.sessionId !== currentSession.sessionId) {
        const revoked = await sessionManager.destroySession(session.sessionId);
        if (revoked) {
          revokedCount++;
          revokedSessions.push({
            sessionId: session.sessionId,
            ipAddress: session.ipAddress,
            createdAt: session.createdAt
          });
        }
      }
    }

    // Log the action
    AdminSecurityAudit.logAction(currentSession, 'REVOKE_ALL_SESSIONS', {
      revokedCount,
      totalSessions: allSessions.length,
      revokedSessions
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
      revokedCount,
      remainingSessions: 1 // Current session
    });

  } catch (error) {
    logger.error('[ADMIN SESSIONS API] Error revoking all sessions:', { error: error });
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}