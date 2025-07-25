/**
 * Enterprise-grade environment variable validation and security
 * Implements zero-trust approach to configuration management
 */

import { logger } from '@/lib/logging/logger';
import { enterpriseLogger } from '@/lib/logging/enterprise-logger';
import crypto from 'crypto';

export interface EnvironmentConfig {
  key: string;
  required: boolean;
  format?: 'url' | 'email' | 'jwt' | 'uuid' | 'base64' | 'numeric' | 'boolean';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  sensitive?: boolean;
  productionOnly?: boolean;
  developmentFallback?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityScore: number;
}

export class EnvironmentValidator {
  private static readonly SENSITIVE_PATTERNS = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /credential/i,
    /private/i,
    /auth/i,
  ];

  private static readonly REQUIRED_PRODUCTION_VARS: EnvironmentConfig[] = [
    {
      key: 'JWT_SECRET',
      required: true,
      format: 'base64',
      minLength: 32,
      sensitive: true,
      productionOnly: true,
    },
    {
      key: 'DATABASE_URL',
      required: true,
      format: 'url',
      sensitive: true,
      productionOnly: true,
    },
    {
      key: 'ENCRYPTION_KEY',
      required: true,
      format: 'base64',
      minLength: 32,
      sensitive: true,
      productionOnly: true,
    },
    {
      key: 'SESSION_SECRET',
      required: true,
      minLength: 32,
      sensitive: true,
      productionOnly: true,
    },
    {
      key: 'ADMIN_PASSWORD',
      required: true,
      minLength: 12,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      sensitive: true,
      productionOnly: true,
    },
    {
      key: 'REDIS_URL',
      required: false,
      format: 'url',
      sensitive: true,
    },
    {
      key: 'SMTP_PASSWORD',
      required: false,
      minLength: 8,
      sensitive: true,
    },
    {
      key: 'NODE_ENV',
      required: true,
      pattern: /^(development|production|test|staging)$/,
      sensitive: false,
    },
    {
      key: 'PORT',
      required: false,
      format: 'numeric',
      sensitive: false,
      developmentFallback: '3000',
    },
  ];

  /**
   * Validate all environment variables
   */
  public static validateEnvironment(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityScore: 100,
    };

    const isProduction = process.env.NODE_ENV === 'production';

    // Validate configured variables
    for (const config of this.REQUIRED_PRODUCTION_VARS) {
      const validation = this.validateVariable(config, isProduction);
      
      if (!validation.isValid) {
        result.isValid = false;
        result.errors.push(...validation.errors);
      }
      
      result.warnings.push(...validation.warnings);
      result.securityScore = Math.min(result.securityScore, validation.securityScore);
    }

    // Scan for unvalidated sensitive variables
    const unvalidatedSensitive = this.scanForUnvalidatedSensitiveVars();
    if (unvalidatedSensitive.length > 0) {
      result.warnings.push(
        `Unvalidated sensitive variables detected: ${unvalidatedSensitive.join(', ')}`
      );
      result.securityScore -= unvalidatedSensitive.length * 5;
    }

    // Log validation results
    this.logValidationResults(result);

    return result;
  }

  /**
   * Validate a single environment variable
   */
  private static validateVariable(
    config: EnvironmentConfig,
    isProduction: boolean
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityScore: 100,
    };

    const value = process.env[config.key];

    // Check if required variable is missing
    if (config.required && !value) {
      if (isProduction || !config.developmentFallback) {
        result.isValid = false;
        result.errors.push(`${config.key} is required but not set`);
        result.securityScore = 0;
        return result;
      } else {
        result.warnings.push(
          `${config.key} using development fallback value`
        );
        result.securityScore -= 10;
      }
    }

    if (!value) {
      return result; // No value to validate
    }

    // Validate format
    if (config.format) {
      const formatValid = this.validateFormat(value, config.format);
      if (!formatValid.isValid) {
        result.isValid = false;
        result.errors.push(
          `${config.key} has invalid ${config.format} format: ${formatValid.error}`
        );
        result.securityScore -= 20;
      }
    }

    // Validate length
    if (config.minLength && value.length < config.minLength) {
      result.isValid = false;
      result.errors.push(
        `${config.key} must be at least ${config.minLength} characters`
      );
      result.securityScore -= 15;
    }

    if (config.maxLength && value.length > config.maxLength) {
      result.warnings.push(
        `${config.key} exceeds recommended length of ${config.maxLength}`
      );
      result.securityScore -= 5;
    }

    // Validate pattern
    if (config.pattern && !config.pattern.test(value)) {
      result.isValid = false;
      result.errors.push(`${config.key} does not match required pattern`);
      result.securityScore -= 25;
    }

    // Security checks for sensitive variables
    if (config.sensitive || this.isSensitiveVariable(config.key)) {
      const securityCheck = this.performSecurityChecks(config.key, value);
      result.warnings.push(...securityCheck.warnings);
      result.securityScore = Math.min(result.securityScore, securityCheck.score);
    }

    // Production-only checks
    if (config.productionOnly && !isProduction && value) {
      result.warnings.push(
        `${config.key} is set in non-production environment`
      );
    }

    return result;
  }

  /**
   * Validate format of environment variable value
   */
  private static validateFormat(
    value: string,
    format: string
  ): { isValid: boolean; error?: string } {
    switch (format) {
      case 'url':
        try {
          new URL(value);
          return { isValid: true };
        } catch {
          return { isValid: false, error: 'Invalid URL format' };
        }

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
          isValid: emailRegex.test(value),
          error: emailRegex.test(value) ? undefined : 'Invalid email format',
        };

      case 'jwt':
        const jwtParts = value.split('.');
        return {
          isValid: jwtParts.length === 3,
          error: jwtParts.length === 3 ? undefined : 'Invalid JWT format',
        };

      case 'uuid':
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return {
          isValid: uuidRegex.test(value),
          error: uuidRegex.test(value) ? undefined : 'Invalid UUID format',
        };

      case 'base64':
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        return {
          isValid: base64Regex.test(value) && value.length % 4 === 0,
          error: base64Regex.test(value) ? undefined : 'Invalid base64 format',
        };

      case 'numeric':
        const isNumeric = !isNaN(Number(value));
        return {
          isValid: isNumeric,
          error: isNumeric ? undefined : 'Value must be numeric',
        };

      case 'boolean':
        const validBooleans = ['true', 'false', '1', '0', 'yes', 'no'];
        return {
          isValid: validBooleans.includes(value.toLowerCase()),
          error: validBooleans.includes(value.toLowerCase())
            ? undefined
            : 'Invalid boolean format',
        };

      default:
        return { isValid: true };
    }
  }

  /**
   * Perform security checks on sensitive variables
   */
  private static performSecurityChecks(
    key: string,
    value: string
  ): { warnings: string[]; score: number } {
    const warnings: string[] = [];
    let score = 100;

    // Check for weak passwords/secrets
    if (this.isWeakSecret(value)) {
      warnings.push(`${key} appears to use a weak or common value`);
      score -= 30;
    }

    // Check for development/test values in production
    if (process.env.NODE_ENV === 'production' && this.isDevelopmentValue(value)) {
      warnings.push(`${key} appears to use a development/test value in production`);
      score -= 40;
    }

    // Check entropy for cryptographic keys
    const entropy = this.calculateEntropy(value);
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')) {
      if (entropy < 4.0) {
        warnings.push(`${key} has low entropy (${entropy.toFixed(2)}), consider using a stronger value`);
        score -= 20;
      }
    }

    // Check for hardcoded patterns
    if (this.hasHardcodedPatterns(value)) {
      warnings.push(`${key} contains patterns suggesting it may be hardcoded`);
      score -= 25;
    }

    return { warnings, score };
  }

  /**
   * Check if variable name indicates sensitive data
   */
  private static isSensitiveVariable(key: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
  }

  /**
   * Check if secret is weak or commonly used
   */
  private static isWeakSecret(value: string): boolean {
    const weakSecrets = [
      'password',
      '123456',
      'secret',
      'admin',
      'test',
      'development',
      'dev',
      'changeme',
      'default',
      'fantasy123',
    ];

    return weakSecrets.some(weak => 
      value.toLowerCase().includes(weak.toLowerCase())
    );
  }

  /**
   * Check if value appears to be from development/test
   */
  private static isDevelopmentValue(value: string): boolean {
    const devPatterns = [
      /dev.*secret/i,
      /test.*key/i,
      /localhost/i,
      /127\.0\.0\.1/i,
      /development/i,
      /staging/i,
    ];

    return devPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Calculate Shannon entropy of a string
   */
  private static calculateEntropy(str: string): number {
    const freq: { [key: string]: number } = {};
    
    // Count character frequencies
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    // Calculate entropy
    let entropy = 0;
    const length = str.length;
    
    for (const count of Object.values(freq)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Check for hardcoded patterns
   */
  private static hasHardcodedPatterns(value: string): boolean {
    const hardcodedPatterns = [
      /^(secret|key|password)\d*$/i,
      /^test/i,
      /^dev/i,
      /^default/i,
      /^changeme/i,
    ];

    return hardcodedPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Scan for unvalidated sensitive environment variables
   */
  private static scanForUnvalidatedSensitiveVars(): string[] {
    const validated = new Set(this.REQUIRED_PRODUCTION_VARS.map(v => v.key));
    const unvalidated: string[] = [];

    for (const [key, value] of Object.entries(process.env)) {
      if (!validated.has(key) && value && this.isSensitiveVariable(key)) {
        unvalidated.push(key);
      }
    }

    return unvalidated;
  }

  /**
   * Log validation results for audit purposes
   */
  private static logValidationResults(result: ValidationResult): void {
    const logData = {
      validationResult: result.isValid ? 'PASS' : 'FAIL',
      securityScore: result.securityScore,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    if (result.isValid) {
      logger.info('Environment validation passed', logData);
    } else {
      logger.error('Environment validation failed', {
        ...logData,
        errors: result.errors,
      });
    }

    if (result.warnings.length > 0) {
      logger.warn('Environment validation warnings', {
        ...logData,
        warnings: result.warnings,
      });
    }

    // Log to enterprise audit system
    enterpriseLogger.logSecurityEvent(
      'environment-validation',
      result.isValid ? 'low' : 'high',
      {
        ...logData,
        complianceLevel: 'restricted',
        businessContext: 'security-audit',
      }
    );
  }

  /**
   * Generate secure random string for development fallbacks
   */
  public static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  /**
   * Redact sensitive values for logging
   */
  public static redactSensitive(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const redacted = { ...obj };
    
    for (const [key, value] of Object.entries(redacted)) {
      if (this.isSensitiveVariable(key)) {
        if (typeof value === 'string' && value.length > 0) {
          redacted[key] = `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
        } else {
          redacted[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object') {
        redacted[key] = this.redactSensitive(value);
      }
    }

    return redacted;
  }

  /**
   * Initialize environment validation on startup
   */
  public static initialize(): void {
    logger.info('Initializing environment validation');
    
    try {
      const result = this.validateEnvironment();
      
      if (!result.isValid) {
        logger.error('Environment validation failed, terminating application');
        process.exit(1);
      }

      if (result.securityScore < 70) {
        logger.warn(`Environment security score is low: ${result.securityScore}/100`);
      }

      logger.info('Environment validation completed', {
        securityScore: result.securityScore,
        warningCount: result.warnings.length,
      });

    } catch (error) {
      logger.error('Environment validation initialization failed', { error });
      process.exit(1);
    }
  }
}

// Export for use in application startup
export const initializeEnvironmentSecurity = EnvironmentValidator.initialize;