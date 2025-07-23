#!/usr/bin/env tsx
/**
 * 🔐 TWO-FACTOR AUTHENTICATION HANDLER
 * 
 * Handles 2FA verification for DraftKings & FanDuel:
 * - TOTP (Time-based One-Time Password) support
 * - SMS verification
 * - Backup codes
 * - QR code generation for setup
 * - Rate limiting for security
 * - Session-based 2FA validation
 * 
 * SECURITY CRITICAL - NEVER LOG CODES!
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import qrcode from 'qrcode';
import { authenticator } from 'otplib';
import { RateLimiter } from './rate-limiter';

interface TwoFactorConfig {
  platform: 'draftkings' | 'fanduel';
  userId: string;
  secret: string;
  backupCodes: string[];
  method: 'totp' | 'sms' | 'email';
  phoneNumber?: string;
  email?: string;
  isEnabled: boolean;
  lastUsed?: Date;
  recoveryEmail?: string;
}

interface VerificationRequest {
  sessionId: string;
  platform: 'draftkings' | 'fanduel';
  userId: string;
  code: string;
  method: 'totp' | 'sms' | 'backup';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface SMSProvider {
  name: string;
  sendSMS: (phoneNumber: string, message: string) => Promise<boolean>;
}

export class TwoFactorAuth extends EventEmitter {
  private rateLimiter: RateLimiter;
  private verificationAttempts = new Map<string, number>();
  private pendingVerifications = new Map<string, { code: string; expiresAt: Date }>();
  private smsProvider?: SMSProvider;

  // 2FA configuration per platform
  private readonly TOTP_CONFIG = {
    window: 2, // Allow 2 windows before/after current time
    step: 30, // 30-second windows
    digits: 6, // 6-digit codes
    algorithm: 'sha1' as const
  };

  // Security limits
  private readonly SECURITY_LIMITS = {
    maxAttempts: 5, // Max verification attempts per session
    lockoutDuration: 15 * 60 * 1000, // 15 minutes lockout
    codeValidityDuration: 5 * 60 * 1000, // 5 minutes for SMS codes
    backupCodeLength: 8,
    backupCodeCount: 10
  };

  constructor(rateLimiter?: RateLimiter) {
    super();
    this.rateLimiter = rateLimiter || new RateLimiter();
    
    // Configure TOTP
    authenticator.options = this.TOTP_CONFIG;
    
    // Clean up expired verifications every minute
    setInterval(() => this.cleanupExpiredVerifications(), 60 * 1000);
  }

  /**
   * Generate 2FA setup for new user
   */
  generateSetup(platform: 'draftkings' | 'fanduel', userId: string, userEmail?: string): {
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
    manualEntryKey: string;
  } {
    // Generate secret
    const secret = authenticator.generateSecret();
    
    // Generate service name for QR code
    const serviceName = platform === 'draftkings' ? 'DraftKings' : 'FanDuel';
    const accountName = userEmail || `${platform}-${userId}`;
    
    // Generate OTP Auth URL
    const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret);
    
    // Generate QR code data URL
    const qrCodeUrl = qrcode.toDataURL(otpAuthUrl);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    
    // Manual entry key (formatted for easier reading)
    const manualEntryKey = secret.match(/.{1,4}/g)?.join(' ') || secret;
    
    console.log(chalk.cyan(`🔐 2FA setup generated for ${platform} user ${userId}`));
    
    this.emit('setup_generated', { platform, userId, hasBackupCodes: backupCodes.length });
    
    return {
      secret,
      qrCodeUrl,
      backupCodes,
      manualEntryKey
    };
  }

  /**
   * Verify 2FA code
   */
  async verifyCode(request: VerificationRequest): Promise<boolean> {
    const { sessionId, platform, userId, code, method } = request;
    
    // Rate limiting
    try {
      await this.rateLimiter.checkLimit(`2fa_${platform}_${userId}`, 5, 60 * 1000, 9); // 5 attempts per minute, high priority
    } catch (error) {
      console.log(chalk.red(`🚨 2FA rate limit exceeded for ${platform} user ${userId}`));
      this.emit('rate_limit_exceeded', { platform, userId, sessionId });
      throw new Error('Too many verification attempts. Please try again later.');
    }
    
    // Check attempt count
    const attemptKey = `${sessionId}_${userId}`;
    const attempts = this.verificationAttempts.get(attemptKey) || 0;
    
    if (attempts >= this.SECURITY_LIMITS.maxAttempts) {
      console.log(chalk.red(`🔒 2FA locked out for ${platform} user ${userId} (${attempts} attempts)`));
      this.emit('lockout', { platform, userId, sessionId, attempts });
      throw new Error('Too many failed attempts. Account temporarily locked.');
    }
    
    try {
      let isValid = false;
      
      switch (method) {
        case 'totp':
          isValid = await this.verifyTOTP(platform, userId, code);
          break;
        case 'sms':
          isValid = await this.verifySMS(platform, userId, code);
          break;
        case 'backup':
          isValid = await this.verifyBackupCode(platform, userId, code);
          break;
        default:
          throw new Error(`Unsupported 2FA method: ${method}`);
      }
      
      if (isValid) {
        // Reset attempt counter on success
        this.verificationAttempts.delete(attemptKey);
        
        console.log(chalk.green(`✅ 2FA verified successfully for ${platform} user ${userId} using ${method}`));
        
        this.emit('verification_success', {
          platform,
          userId,
          sessionId,
          method,
          timestamp: new Date(),
          attempts: attempts + 1
        });
        
        return true;
      } else {
        // Increment attempt counter
        this.verificationAttempts.set(attemptKey, attempts + 1);
        
        console.log(chalk.red(`❌ 2FA verification failed for ${platform} user ${userId} using ${method} (attempt ${attempts + 1}/${this.SECURITY_LIMITS.maxAttempts})`));
        
        this.emit('verification_failed', {
          platform,
          userId,
          sessionId,
          method,
          attempts: attempts + 1,
          remainingAttempts: this.SECURITY_LIMITS.maxAttempts - attempts - 1
        });
        
        // Set lockout timer if max attempts reached
        if (attempts + 1 >= this.SECURITY_LIMITS.maxAttempts) {
          setTimeout(() => {
            this.verificationAttempts.delete(attemptKey);
            console.log(chalk.yellow(`🔓 2FA lockout expired for ${platform} user ${userId}`));
          }, this.SECURITY_LIMITS.lockoutDuration);
        }
        
        return false;
      }
    } catch (error) {
      console.error(chalk.red(`❌ 2FA verification error for ${platform} user ${userId}:`), error);
      throw error;
    }
  }

  /**
   * Send SMS verification code
   */
  async sendSMSCode(platform: 'draftkings' | 'fanduel', userId: string, phoneNumber: string): Promise<boolean> {
    if (!this.smsProvider) {
      throw new Error('SMS provider not configured');
    }
    
    // Rate limiting for SMS sending
    try {
      await this.rateLimiter.checkLimit(`sms_${platform}_${userId}`, 3, 60 * 1000, 8); // 3 SMS per minute
    } catch (error) {
      throw new Error('SMS rate limit exceeded. Please try again later.');
    }
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with expiration
    const verificationKey = `${platform}_${userId}`;
    this.pendingVerifications.set(verificationKey, {
      code,
      expiresAt: new Date(Date.now() + this.SECURITY_LIMITS.codeValidityDuration)
    });
    
    // Send SMS
    const serviceName = platform === 'draftkings' ? 'DraftKings' : 'FanDuel';
    const message = `Your ${serviceName} verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;
    
    try {
      const sent = await this.smsProvider.sendSMS(phoneNumber, message);
      
      if (sent) {
        console.log(chalk.cyan(`📱 SMS code sent to ${phoneNumber.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2')} for ${platform} user ${userId}`));
        this.emit('sms_sent', { platform, userId, phoneNumber: phoneNumber.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2') });
      }
      
      return sent;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to send SMS for ${platform} user ${userId}:`), error);
      throw error;
    }
  }

  /**
   * Configure SMS provider
   */
  setSMSProvider(provider: SMSProvider): void {
    this.smsProvider = provider;
    console.log(chalk.cyan(`📱 SMS provider configured: ${provider.name}`));
  }

  /**
   * Verify TOTP code
   */
  private async verifyTOTP(platform: string, userId: string, code: string): Promise<boolean> {
    // In production, load secret from secure storage
    const secret = await this.getStoredSecret(platform, userId);
    
    if (!secret) {
      throw new Error('TOTP secret not found. Please set up 2FA first.');
    }
    
    return authenticator.verify({ token: code, secret });
  }

  /**
   * Verify SMS code
   */
  private async verifySMS(platform: string, userId: string, code: string): Promise<boolean> {
    const verificationKey = `${platform}_${userId}`;
    const pending = this.pendingVerifications.get(verificationKey);
    
    if (!pending) {
      throw new Error('No pending SMS verification found');
    }
    
    if (new Date() > pending.expiresAt) {
      this.pendingVerifications.delete(verificationKey);
      throw new Error('SMS verification code has expired');
    }
    
    const isValid = pending.code === code;
    
    if (isValid) {
      this.pendingVerifications.delete(verificationKey);
    }
    
    return isValid;
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(platform: string, userId: string, code: string): Promise<boolean> {
    // In production, load backup codes from secure storage
    const backupCodes = await this.getStoredBackupCodes(platform, userId);
    
    if (!backupCodes || backupCodes.length === 0) {
      throw new Error('No backup codes available');
    }
    
    const codeIndex = backupCodes.indexOf(code);
    
    if (codeIndex === -1) {
      return false;
    }
    
    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    await this.saveBackupCodes(platform, userId, backupCodes);
    
    console.log(chalk.yellow(`🎫 Backup code used for ${platform} user ${userId}. ${backupCodes.length} codes remaining.`));
    
    this.emit('backup_code_used', {
      platform,
      userId,
      remainingCodes: backupCodes.length
    });
    
    return true;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < this.SECURITY_LIMITS.backupCodeCount; i++) {
      const code = crypto.randomBytes(this.SECURITY_LIMITS.backupCodeLength / 2)
        .toString('hex')
        .toUpperCase()
        .match(/.{1,4}/g)
        ?.join('-') || '';
      
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Clean up expired verifications
   */
  private cleanupExpiredVerifications(): void {
    const now = new Date();
    let cleaned = 0;
    
    for (const [key, verification] of this.pendingVerifications.entries()) {
      if (now > verification.expiresAt) {
        this.pendingVerifications.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(chalk.cyan(`🧹 Cleaned up ${cleaned} expired 2FA verifications`));
    }
  }

  /**
   * Get stored secret (placeholder - implement with secure storage)
   */
  private async getStoredSecret(platform: string, userId: string): Promise<string | null> {
    // In production, retrieve from encrypted storage
    // This is a placeholder implementation
    return null;
  }

  /**
   * Get stored backup codes (placeholder - implement with secure storage)
   */
  private async getStoredBackupCodes(platform: string, userId: string): Promise<string[] | null> {
    // In production, retrieve from encrypted storage
    // This is a placeholder implementation
    return null;
  }

  /**
   * Save backup codes (placeholder - implement with secure storage)
   */
  private async saveBackupCodes(platform: string, userId: string, codes: string[]): Promise<void> {
    // In production, save to encrypted storage
    // This is a placeholder implementation
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(platform: 'draftkings' | 'fanduel', userId: string): Promise<string[]> {
    const newCodes = this.generateBackupCodes();
    
    // Save new codes
    await this.saveBackupCodes(platform, userId, newCodes);
    
    console.log(chalk.cyan(`🔄 New backup codes generated for ${platform} user ${userId}`));
    
    this.emit('backup_codes_regenerated', {
      platform,
      userId,
      codeCount: newCodes.length
    });
    
    return newCodes;
  }

  /**
   * Disable 2FA for user
   */
  async disable2FA(platform: 'draftkings' | 'fanduel', userId: string, currentCode: string): Promise<boolean> {
    // Verify current code before disabling
    const isValid = await this.verifyCode({
      sessionId: `disable_${Date.now()}`,
      platform,
      userId,
      code: currentCode,
      method: 'totp',
      timestamp: new Date()
    });
    
    if (!isValid) {
      throw new Error('Invalid verification code. Cannot disable 2FA.');
    }
    
    // In production, remove from secure storage
    console.log(chalk.yellow(`⚠️ 2FA disabled for ${platform} user ${userId}`));
    
    this.emit('2fa_disabled', { platform, userId });
    
    return true;
  }

  /**
   * Get 2FA status for user
   */
  async get2FAStatus(platform: 'draftkings' | 'fanduel', userId: string): Promise<{
    enabled: boolean;
    method?: string;
    backupCodesRemaining?: number;
    lastUsed?: Date;
  }> {
    // In production, load from secure storage
    // This is a placeholder implementation
    return {
      enabled: false
    };
  }
}

// Example SMS provider implementation
export class MockSMSProvider implements SMSProvider {
  name = 'Mock SMS Provider';
  
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    // In production, integrate with real SMS service (Twilio, AWS SNS, etc.)
    console.log(chalk.cyan(`📱 [MOCK SMS] To: ${phoneNumber}`));
    console.log(chalk.gray(`Message: ${message}`));
    return true;
  }
}

// Export singleton instance
export const twoFactorAuth = new TwoFactorAuth();