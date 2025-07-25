/**
 * 🛡️ UNBLOCK IP API ENDPOINT 🛡️
 * Allows admins to manually unblock IPs
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/services/rate-limiter';
import { logger } from '../../../../../lib/logging/logger';

export async function POST(request: NextRequest) {
  try {
    const { ip } = await request.json();
    
    if (!ip) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      );
    }
    
    // Validate IP format (basic validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return NextResponse.json(
        { error: 'Invalid IP address format' },
        { status: 400 }
      );
    }
    
    // Unblock the IP
    const success = await rateLimiter.unblockIP(ip);
    
    if (success) {
      // Log the action for audit purposes
      logger.info('Admin unblocked IP: ${ip} at ${new Date().toISOString()}');
      
      return NextResponse.json({
        success: true,
        message: `IP ${ip} has been unblocked`,
        unblockedAt: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `IP ${ip} was not found in blocklist`
      });
    }
    
  } catch (error) {
    logger.error('Failed to unblock IP:', { error: error });
    return NextResponse.json(
      { error: 'Failed to unblock IP address' },
      { status: 500 }
    );
  }
}