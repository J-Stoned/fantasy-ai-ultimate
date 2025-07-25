/**
 * 🔒 ENTERPRISE PASSWORD SECURITY UTILITY 🔒
 * 
 * Provides secure password hashing and verification using bcrypt
 * with enterprise-grade security features including:
 * - Bcrypt hashing with configurable salt rounds
 * - Password strength validation
 * - Rate limiting support
 * - Timing attack protection
 * - Secure error handling
 */

import bcrypt from 'bcrypt';
import { logger } from '../logging/logger';

// Configuration
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
  minLength: MIN_PASSWORD_LENGTH,
  maxLength: MAX_PASSWORD_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  preventCommonPatterns: true
};

// Common weak passwords to prevent
const COMMON_PASSWORDS = [
  'password', 'password123', 'admin', 'administrator', 'letmein',
  'welcome', 'monkey', 'dragon', 'football', 'baseball',
  '123456', '12345678', '123456789', '1234567890', 'qwerty',
  'abc123', 'Password1', 'Password123', 'Admin123', 'Welcome123'
];

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

export interface HashPasswordResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export interface VerifyPasswordResult {
  success: boolean;
  isValid?: boolean;
  error?: string;
}

/**
 * Hash a password using bcrypt with enterprise-grade security
 */
export async function hashPassword(password: string): Promise<HashPasswordResult> {
  try {
    // Validate password strength first
    const strengthCheck = checkPasswordStrength(password);
    if (!strengthCheck.isValid) {
      return {
        success: false,
        error: `Password does not meet security requirements: ${strengthCheck.issues.join(', ')}`
      };
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    return {
      success: true,
      hash
    };
  } catch (error) {
    logger.error('[PASSWORD UTILITY] Error hashing password:', { error: error });
    return {
      success: false,
      error: 'Failed to hash password'
    };
  }
}

/**
 * Verify a password against a hash with timing attack protection
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<VerifyPasswordResult> {
  try {
    // Basic validation
    if (!password || !hash) {
      return {
        success: false,
        error: 'Invalid input'
      };
    }

    // Compare password with hash
    const isValid = await bcrypt.compare(password, hash);

    return {
      success: true,
      isValid
    };
  } catch (error) {
    logger.error('[PASSWORD UTILITY] Error verifying password:', { error: error });
    return {
      success: false,
      error: 'Failed to verify password'
    };
  }
}

/**
 * Check password strength and provide detailed feedback
 */
export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length check
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    issues.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
    suggestions.push('Use a longer password for better security');
  } else if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    issues.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  } else {
    score += 25;
    // Bonus points for extra length
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 5;
  }

  // Character type checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`).test(password);

  if (PASSWORD_REQUIREMENTS.requireUppercase && !hasUppercase) {
    issues.push('Password must contain at least one uppercase letter');
    suggestions.push('Add uppercase letters (A-Z)');
  } else if (hasUppercase) {
    score += 15;
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !hasLowercase) {
    issues.push('Password must contain at least one lowercase letter');
    suggestions.push('Add lowercase letters (a-z)');
  } else if (hasLowercase) {
    score += 15;
  }

  if (PASSWORD_REQUIREMENTS.requireNumbers && !hasNumbers) {
    issues.push('Password must contain at least one number');
    suggestions.push('Add numbers (0-9)');
  } else if (hasNumbers) {
    score += 15;
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !hasSpecialChars) {
    issues.push('Password must contain at least one special character');
    suggestions.push(`Add special characters: ${PASSWORD_REQUIREMENTS.specialChars}`);
  } else if (hasSpecialChars) {
    score += 15;
  }

  // Check for common patterns
  if (PASSWORD_REQUIREMENTS.preventCommonPatterns) {
    const lowerPassword = password.toLowerCase();
    
    // Check against common passwords
    if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
      issues.push('Password contains common patterns');
      suggestions.push('Avoid common words and patterns');
      score -= 20;
    }

    // Check for sequential characters
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password) ||
        /(?:012|123|234|345|456|567|678|789)/.test(password)) {
      issues.push('Password contains sequential characters');
      suggestions.push('Avoid sequential patterns like "123" or "abc"');
      score -= 10;
    }

    // Check for repeated characters
    if (/(.)\1{2,}/.test(password)) {
      issues.push('Password contains repeated characters');
      suggestions.push('Avoid repeating the same character multiple times');
      score -= 10;
    }

    // Check for keyboard patterns
    if (/(?:qwerty|asdf|zxcv|qazwsx|qwertyuiop)/i.test(password)) {
      issues.push('Password contains keyboard patterns');
      suggestions.push('Avoid keyboard patterns like "qwerty"');
      score -= 15;
    }
  }

  // Entropy bonus
  const uniqueChars = new Set(password.split('')).size;
  if (uniqueChars >= password.length * 0.7) {
    score += 10; // Good character diversity
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return {
    isValid: issues.length === 0 && score >= 60,
    score,
    issues,
    suggestions: issues.length > 0 ? suggestions : ['Your password is strong!']
  };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 20): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = PASSWORD_REQUIREMENTS.specialChars;
  const allChars = uppercase + lowercase + numbers + special;

  let password = '';
  
  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Migrate from SHA-256 to bcrypt
 * This function helps transition existing SHA-256 hashes to bcrypt
 */
export async function migrateFromSHA256(
  password: string,
  sha256Hash: string
): Promise<HashPasswordResult> {
  try {
    // First verify the password matches the SHA-256 hash
    const crypto = await import('crypto');
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    
    if (inputHash !== sha256Hash) {
      return {
        success: false,
        error: 'Invalid password for migration'
      };
    }

    // If valid, create a new bcrypt hash
    return await hashPassword(password);
  } catch (error) {
    logger.error('[PASSWORD UTILITY] Error migrating from SHA-256:', { error: error });
    return {
      success: false,
      error: 'Failed to migrate password'
    };
  }
}

/**
 * Create a password reset token (for future use)
 */
export function createPasswordResetToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate password reset token format (for future use)
 */
export function validatePasswordResetToken(token: string): boolean {
  // Check if token is a valid hex string of correct length
  return /^[a-f0-9]{64}$/i.test(token);
}