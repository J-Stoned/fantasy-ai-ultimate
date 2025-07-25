/**
 * 🔥 CLIENT INFO API 🔥
 * 
 * Returns client information for security display on login page.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('x-client-ip') ||
                   'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Mock location lookup - in production use a real IP geolocation service
  const location = clientIp === 'unknown' ? 'Unknown' : 'Seattle, WA';
  
  // Get last login from cookies/session (mock for now)
  const lastLogin = '';

  return NextResponse.json({
    ipAddress: clientIp.split(',')[0].trim(), // Get first IP if multiple
    location,
    lastLogin,
    userAgent
  });
}