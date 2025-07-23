#!/usr/bin/env tsx
/**
 * 🔐 AUTHENTICATION SYSTEM EXPORTS
 * 
 * Centralized exports for the complete authentication system
 */

// Main services
export { AuthService, authService } from './auth-service';
export { OAuthService, oauthService } from './oauth-service';
export { CredentialsManager, credentialsManager } from './credentials-manager';
export { RateLimiter, rateLimiter } from './rate-limiter';
export { TwoFactorAuth, twoFactorAuth, MockSMSProvider } from './two-factor-auth';

// Types
export type { 
  AuthResult, 
  UserSession 
} from './auth-service';

export type {
  VerificationRequest
} from './two-factor-auth';

// Constants
export const AUTH_PLATFORMS = ['draftkings', 'fanduel'] as const;

export const SECURITY_FEATURES = {
  oauth2: 'OAuth2 with PKCE',
  encryption: 'AES-256-GCM',
  twoFactor: 'TOTP/SMS/Backup codes',
  rateLimiting: 'Sliding window with circuit breaker',
  sessionManagement: 'Automatic refresh and cleanup'
} as const;