/**
 * 🔥 ADMIN SESSION MANAGEMENT API - Individual Session Operations 🔥
 * 
 * Handle operations on individual sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthService, AdminSecurityAudit } from '@/lib/middleware/admin-auth';
import { sessionManager } from '@/lib/services/session-manager';
import { logger } from '../../../../../lib/logging/logger';

/**
 * DELETE /api/admin/sessions/:sessionId
 * Revoke a specific session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    const sessionId = params.sessionId;

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
        { error: 'Session not found or does not belong to current user' },
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