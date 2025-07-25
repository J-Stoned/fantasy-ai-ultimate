/**
 * 🔥 ADMIN LOGOUT API 🔥
 * 
 * Securely logs out admin users and clears Redis sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AdminAuthService, AdminSecurityAudit } from '@/lib/middleware/admin-auth';
import { logger } from '../../../../../lib/logging/logger';

export async function POST(request: NextRequest) {
  try {
    // Get the admin token from cookie
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (token) {
      // Get session info before destroying (for logging)
      const session = await AdminAuthService.validateSession(token);
      
      // Destroy the Redis session
      const destroyed = await AdminAuthService.destroySession(token);
      
      if (destroyed && session) {
        // Log the logout event with security audit
        AdminSecurityAudit.logAction(session, 'LOGOUT', {
          ipAddress: request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          timestamp: new Date().toISOString()
        });
        
        logger.info('[ADMIN AUTH] Admin ${session.username} logged out at ${new Date().toISOString()}');
      } else {
        logger.warn('[ADMIN AUTH] Failed to destroy session during logout');
      }
    }

    // Clear the admin token cookie regardless
    cookieStore.delete('admin_token');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('[ADMIN AUTH] Logout error:', { error: error });
    
    // Still try to clear the cookie even if session destruction fails
    try {
      const cookieStore = cookies();
      cookieStore.delete('admin_token');
    } catch (cookieError) {
      logger.error('[ADMIN AUTH] Failed to clear cookie:', { error: cookieError });
    }
    
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}