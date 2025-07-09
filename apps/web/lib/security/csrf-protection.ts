import { NextRequest } from 'next/server';
import crypto from 'crypto';

export class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_HEADER = 'x-csrf-token';
  private static readonly TOKEN_COOKIE = 'csrf-token';
  
  static generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }
  
  async verify(req: NextRequest): Promise<boolean> {
    // Get token from header
    const headerToken = req.headers.get(CSRFProtection.TOKEN_HEADER);
    if (!headerToken) {
      return false;
    }
    
    // Get token from cookie
    const cookieToken = req.cookies.get(CSRFProtection.TOKEN_COOKIE)?.value;
    if (!cookieToken) {
      return false;
    }
    
    // Compare tokens (constant time comparison)
    return this.timingSafeEqual(headerToken, cookieToken);
  }
  
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    
    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}