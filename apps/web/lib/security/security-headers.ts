export class SecurityHeaders {
  static apply(): Record<string, string> {
    return {
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      
      // Enable XSS protection
      'X-XSS-Protection': '1; mode=block',
      
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Permissions policy
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      
      // HSTS - enforce HTTPS
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Content Security Policy
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net https://*.supabase.co",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests"
      ].join('; ')
    };
  }
}