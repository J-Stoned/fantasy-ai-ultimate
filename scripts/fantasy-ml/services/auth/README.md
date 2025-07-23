# 🔐 Secure Authentication System for DraftKings & FanDuel APIs

A production-ready, enterprise-grade authentication system for DraftKings and FanDuel APIs with comprehensive security features.

## 🌟 Features

### 🔒 Security First
- **OAuth2 with PKCE** - Industry standard authentication with Proof Key for Code Exchange
- **AES-256-GCM Encryption** - Military-grade encryption for credential storage
- **PBKDF2 Key Derivation** - 100,000 iterations for maximum security
- **Zero-Knowledge Architecture** - Credentials never logged or exposed
- **Session Management** - Automatic token refresh and secure session handling

### 🛡️ Multi-Factor Authentication
- **TOTP Support** - Time-based One-Time Passwords (Google Authenticator, Authy)
- **SMS Verification** - Text message verification codes
- **Backup Codes** - Secure recovery codes for account access
- **QR Code Generation** - Easy mobile app setup
- **Rate Limited** - Protection against brute force attacks

### ⚡ Performance & Reliability
- **Smart Rate Limiting** - Platform-specific limits with burst allowance
- **Circuit Breaker Pattern** - Automatic failure protection
- **Request Queuing** - Priority-based request handling
- **Sliding Window** - Accurate rate limit tracking
- **Auto-Recovery** - Intelligent retry mechanisms

### 📊 Monitoring & Analytics
- **Security Event Logging** - Comprehensive audit trail
- **Real-time Monitoring** - Live session and authentication tracking
- **Performance Metrics** - Rate limit usage and response times
- **Violation Detection** - Automatic security breach detection

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Auth Service  │───▶│  OAuth Service  │───▶│ Platform APIs   │
│                 │    │                 │    │ (DK/FD)        │
└─────────┬───────┘    └─────────────────┘    └─────────────────┘
          │
          ├─────────────┐
          │             │
┌─────────▼───────┐    ┌▼──────────────┐
│ Credentials     │    │ Two-Factor    │
│ Manager         │    │ Auth          │
└─────────────────┘    └───────────────┘
          │                      │
┌─────────▼───────┐    ┌─────────▼───────┐
│ Rate Limiter    │    │ SMS Provider    │
└─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Environment Setup

Create `.env.local` with required variables:

```env
# Master encryption key (32+ characters)
FANTASY_ML_MASTER_KEY=your-super-secure-master-key-here-32-chars-minimum

# DraftKings OAuth2 Configuration
DRAFTKINGS_CLIENT_ID=your_draftkings_client_id
DRAFTKINGS_CLIENT_SECRET=your_draftkings_client_secret
DRAFTKINGS_REDIRECT_URI=http://localhost:3000/auth/draftkings/callback

# FanDuel OAuth2 Configuration
FANDUEL_CLIENT_ID=your_fanduel_client_id
FANDUEL_CLIENT_SECRET=your_fanduel_client_secret
FANDUEL_REDIRECT_URI=http://localhost:3000/auth/fanduel/callback

# Optional: SMS Provider Configuration
SMS_PROVIDER_API_KEY=your_sms_provider_key
SMS_PROVIDER_ACCOUNT_SID=your_account_sid
```

### 2. Installation

```bash
# Install dependencies
npm install axios ws qrcode otplib p-limit chalk dotenv

# Install type definitions
npm install -D @types/node @types/ws @types/qrcode
```

### 3. Basic Usage

```typescript
import { authService } from './services/auth';

// Initialize the authentication system
await authService.initialize();

// Start OAuth2 flow
const { authUrl, state } = await authService.startAuthentication('draftkings');
console.log('Visit:', authUrl);

// Complete authentication (after user visits URL and returns with code)
const result = await authService.completeAuthentication(
  'draftkings',
  authorizationCode,
  state,
  codeVerifier
);

if (result.requires2FA) {
  // Handle 2FA verification
  const verified = await authService.verify2FA(
    result.sessionId!,
    userEnteredCode,
    'totp'
  );
}

// Use authenticated session
const accessToken = await authService.getAccessToken(sessionId);
```

## 📖 API Reference

### AuthService

#### `initialize(): Promise<void>`
Initialize the authentication system and load existing sessions.

#### `startAuthentication(platform: 'draftkings' | 'fanduel'): Promise<{authUrl: string, state: string}>`
Start OAuth2 authentication flow for specified platform.

#### `completeAuthentication(platform, code, state, codeVerifier): Promise<AuthResult>`
Complete OAuth2 authentication and create session.

#### `verify2FA(sessionId: string, code: string, method?: '2fa_method'): Promise<AuthResult>`
Verify two-factor authentication code.

#### `getAccessToken(sessionId: string): Promise<string | null>`
Get valid access token for API requests.

#### `invalidateSession(sessionId: string): Promise<void>`
Invalidate and cleanup a session.

### CredentialsManager

#### `storeCredentials(id: string, credentials: any): Promise<void>`
Encrypt and securely store credentials.

#### `getCredentials(id: string): Promise<any>`
Retrieve and decrypt stored credentials.

#### `deleteCredentials(id: string): Promise<void>`
Securely delete stored credentials.

### RateLimiter

#### `checkLimit(key: string, requests?: number, windowMs?: number, priority?: number): Promise<void>`
Check if request is within rate limits.

#### `setLimit(key: string, requests: number, windowMs: number): void`
Set custom rate limit for a key.

#### `getUsage(key: string): RateLimit Usage`
Get current rate limit usage statistics.

### TwoFactorAuth

#### `generateSetup(platform, userId, email?): Setup`
Generate 2FA setup with QR code and backup codes.

#### `verifyCode(request: VerificationRequest): Promise<boolean>`
Verify 2FA code (TOTP, SMS, or backup).

#### `sendSMSCode(platform, userId, phoneNumber): Promise<boolean>`
Send SMS verification code.

## ⚙️ Configuration

### Rate Limits (per minute)

| Platform | Authentication | API Calls | Contests | Lineups |
|----------|---------------|-----------|----------|---------|
| DraftKings | 10 | 60 | 30 | 120 |
| FanDuel | 10 | 60 | 30 | 120 |

### Security Limits

- **2FA Attempts**: 5 per session (15-minute lockout)
- **SMS Codes**: 3 per minute
- **Token Refresh**: 30 per minute
- **Session Timeout**: Based on platform token expiry
- **Credential Encryption**: AES-256-GCM with PBKDF2 (100k iterations)

## 🔐 Security Best Practices

### Environment Security
- Use strong master key (32+ characters)
- Store environment variables securely
- Never commit credentials to version control
- Use HTTPS in production

### OAuth2 Security
- PKCE prevents authorization code interception
- State parameter prevents CSRF attacks
- Short-lived access tokens with automatic refresh
- Secure redirect URI validation

### Session Security
- Automatic session cleanup
- Token refresh before expiry
- Session invalidation on suspicious activity
- Device fingerprinting for security

### 2FA Security
- Rate limiting prevents brute force
- TOTP uses industry standard (RFC 6238)
- Backup codes for account recovery
- SMS codes expire in 5 minutes

## 📊 Monitoring

### Security Events

The system emits comprehensive security events:

```typescript
authService.on('auth_completed', (data) => {
  console.log('User authenticated:', data);
});

authService.on('2fa_verified', (data) => {
  console.log('2FA verified:', data);
});

authService.on('rate_limit_violation', (data) => {
  console.log('Rate limit exceeded:', data);
});

authService.on('circuit_breaker_opened', (data) => {
  console.log('Circuit breaker opened:', data);
});
```

### Metrics Available

- Active session count
- Authentication success/failure rates
- 2FA verification rates
- Rate limit usage
- Circuit breaker status
- Token refresh frequency

## 🧪 Testing

### Run Demo

```bash
# Run comprehensive demo
npx tsx services/auth/demo-auth-system.ts
```

### Manual Testing

```bash
# Test individual components
npx tsx -e "
import { rateLimiter } from './services/auth';
await rateLimiter.checkLimit('test', 5, 60000);
console.log('Rate limit check passed');
"
```

## 🚨 Troubleshooting

### Common Issues

**Authentication Fails**
- Check OAuth2 credentials in environment
- Verify redirect URI matches platform settings
- Ensure HTTPS in production

**Rate Limited**
- Check current usage with `rateLimiter.getUsage()`
- Wait for rate limit window to reset
- Use higher priority for critical requests

**2FA Not Working**
- Verify TOTP secret setup correctly
- Check system time synchronization
- Use backup codes if TOTP fails

**Session Expired**
- Automatic token refresh should handle this
- Check network connectivity
- Verify OAuth2 refresh token is valid

### Debug Mode

Enable detailed logging:

```typescript
process.env.DEBUG = 'auth:*';
```

## 🔄 Production Deployment

### Prerequisites
- HTTPS endpoints configured
- Environment variables secured
- Database/storage for persistence
- SMS provider configured
- Monitoring system setup

### Security Checklist
- [ ] Master key is cryptographically secure
- [ ] OAuth2 credentials are from production apps
- [ ] Redirect URIs use HTTPS
- [ ] Rate limits are appropriate for usage
- [ ] 2FA is enabled for admin accounts
- [ ] Security monitoring is active
- [ ] Backup procedures are tested

### Performance Optimization
- Enable credential caching
- Use connection pooling
- Implement session clustering for scale
- Monitor rate limit usage
- Optimize token refresh timing

## 📞 Support

For issues or questions:

1. Check troubleshooting section
2. Review security event logs
3. Verify environment configuration
4. Test with demo script

## 🔗 Related Files

- `oauth-service.ts` - OAuth2 authentication flows
- `credentials-manager.ts` - Encrypted credential storage
- `rate-limiter.ts` - Rate limiting and circuit breaker
- `two-factor-auth.ts` - 2FA verification system
- `auth-service.ts` - Main authentication orchestrator
- `demo-auth-system.ts` - Comprehensive demonstration

## 📝 License

This authentication system is part of the Fantasy ML project and follows the same licensing terms.