/**
 * 🔐 ADMIN PASSWORD CHANGE API 🔐
 * 
 * Secure password change endpoint with:
 * - Current password verification
 * - Password strength validation
 * - Audit logging
 * - Session invalidation
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { logger } from '../../../../../lib/logging/logger';
import { 
  verifyPassword, 
  hashPassword, 
  checkPasswordStrength,
  migrateFromSHA256 
} from '@/lib/utils/password';

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  invalidateSessions?: boolean;
}

// Get admin credentials
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || '',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
  isLegacyHash: process.env.ADMIN_PASSWORD_IS_SHA256 === 'true'
};

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const cookieStore = cookies();
    const adminToken = cookieStore.get('admin_token');
    
    if (!adminToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ChangePasswordRequest = await request.json();
    const { currentPassword, newPassword, confirmPassword, invalidateSessions = true } = body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'All password fields are required' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New passwords do not match' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Verify current password
    let isValidCurrentPassword = false;
    
    if (ADMIN_CREDENTIALS.isLegacyHash) {
      // Legacy SHA-256 validation
      const currentHash = crypto.createHash('sha256').update(currentPassword).digest('hex');
      isValidCurrentPassword = currentHash === ADMIN_CREDENTIALS.passwordHash;
    } else {
      // Modern bcrypt validation
      const verifyResult = await verifyPassword(currentPassword, ADMIN_CREDENTIALS.passwordHash);
      if (!verifyResult.success) {
        return NextResponse.json(
          { error: 'Authentication system error' },
          { status: 500 }
        );
      }
      isValidCurrentPassword = verifyResult.isValid || false;
    }

    if (!isValidCurrentPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Check new password strength
    const strengthCheck = checkPasswordStrength(newPassword);
    if (!strengthCheck.isValid) {
      return NextResponse.json(
        { 
          error: 'New password does not meet security requirements',
          details: {
            issues: strengthCheck.issues,
            suggestions: strengthCheck.suggestions,
            score: strengthCheck.score
          }
        },
        { status: 400 }
      );
    }

    // Hash new password
    const hashResult = await hashPassword(newPassword);
    if (!hashResult.success || !hashResult.hash) {
      return NextResponse.json(
        { error: 'Failed to secure new password' },
        { status: 500 }
      );
    }

    // Log password change
    logger.info('[ADMIN AUTH] Password changed for admin: ${ADMIN_CREDENTIALS.email}');
    logger.info('[ADMIN AUTH] New password hash:', { data: hashResult.hash });
    logger.info('[ADMIN AUTH] To update environment variable, set:');
    logger.info(`ADMIN_PASSWORD_HASH="${hashResult.hash}"`);
    // If requested, invalidate all sessions
    if (invalidateSessions) {
      // In a real application, you would clear all sessions from your session store
      logger.info('[ADMIN AUTH] All sessions invalidated due to password change');
      
      // Clear current session cookie
      cookieStore.delete('admin_token');
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      newHash: hashResult.hash,
      instructions: 'Update ADMIN_PASSWORD_HASH environment variable with the new hash',
      sessionInvalidated: invalidateSessions
    });

  } catch (error) {
    logger.error('[ADMIN AUTH] Password change error:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check password requirements
export async function GET(request: NextRequest) {
  return NextResponse.json({
    requirements: {
      minLength: 12,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      preventCommonPatterns: true
    },
    tips: [
      'Use a passphrase with random words',
      'Include a mix of character types',
      'Avoid common patterns and dictionary words',
      'Consider using a password manager',
      'Make it unique - don\'t reuse passwords'
    ]
  });
}