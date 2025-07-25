/**
 * Base error classes for the Fantasy AI Platform
 * Provides structured error handling with context and metadata
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  NETWORK = 'network',
  USER_INPUT = 'user_input',
  CONFIGURATION = 'configuration'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  service?: string;
  operation?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'circuit_breaker' | 'graceful_degradation' | 'user_action';
  retryAttempts?: number;
  retryDelay?: number;
  fallbackValue?: any;
  userMessage?: string;
  actionRequired?: string;
}

/**
 * Base error class for all application errors
 */
export abstract class BaseError extends Error {
  public readonly id: string;
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly timestamp: Date;
  public readonly context?: ErrorContext;
  public readonly recoveryStrategy?: ErrorRecoveryStrategy;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity,
    category: ErrorCategory,
    context?: ErrorContext,
    recoveryStrategy?: ErrorRecoveryStrategy,
    originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.id = this.generateErrorId();
    this.code = code;
    this.severity = severity;
    this.category = category;
    this.timestamp = new Date();
    this.context = context;
    this.recoveryStrategy = recoveryStrategy;
    this.originalError = originalError;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  private generateErrorId(): string {
    return `${this.constructor.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  public toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp,
      context: this.context,
      recoveryStrategy: this.recoveryStrategy,
      stack: this.stack
    };
  }

  public getUserMessage(): string {
    return this.recoveryStrategy?.userMessage || this.getDefaultUserMessage();
  }

  protected abstract getDefaultUserMessage(): string;
}

/**
 * Authentication error - user not authenticated
 */
export class AuthenticationError extends BaseError {
  constructor(
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'AUTH_ERROR',
      ErrorSeverity.HIGH,
      ErrorCategory.AUTHENTICATION,
      context,
      {
        type: 'user_action',
        userMessage: 'Please log in to continue',
        actionRequired: 'login'
      },
      originalError
    );
  }

  protected getDefaultUserMessage(): string {
    return 'Authentication required. Please log in.';
  }
}

/**
 * Authorization error - user lacks permissions
 */
export class AuthorizationError extends BaseError {
  constructor(
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'AUTHZ_ERROR',
      ErrorSeverity.HIGH,
      ErrorCategory.AUTHORIZATION,
      context,
      {
        type: 'user_action',
        userMessage: 'You do not have permission to perform this action',
        actionRequired: 'contact_support'
      },
      originalError
    );
  }

  protected getDefaultUserMessage(): string {
    return 'Access denied. You lack the required permissions.';
  }
}

/**
 * Validation error - invalid input data
 */
export class ValidationError extends BaseError {
  public readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    validationErrors?: Record<string, string[]>,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      context,
      {
        type: 'user_action',
        userMessage: 'Please check your input and try again',
        actionRequired: 'correct_input'
      },
      originalError
    );
    this.validationErrors = validationErrors;
  }

  protected getDefaultUserMessage(): string {
    return 'Invalid input. Please check your data and try again.';
  }
}

/**
 * Database error - database operations failed
 */
export class DatabaseError extends BaseError {
  constructor(
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'DB_ERROR',
      ErrorSeverity.CRITICAL,
      ErrorCategory.DATABASE,
      context,
      {
        type: 'retry',
        retryAttempts: 3,
        retryDelay: 1000,
        userMessage: 'A database error occurred. Please try again later.'
      },
      originalError
    );
  }

  protected getDefaultUserMessage(): string {
    return 'A database error occurred. Our team has been notified.';
  }
}

/**
 * External API error - third-party service failures
 */
export class ExternalApiError extends BaseError {
  public readonly apiName: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    apiName: string,
    statusCode?: number,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'API_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.EXTERNAL_API,
      context,
      {
        type: 'circuit_breaker',
        retryAttempts: 3,
        retryDelay: 2000,
        userMessage: `The ${apiName} service is temporarily unavailable`
      },
      originalError
    );
    this.apiName = apiName;
    this.statusCode = statusCode;
  }

  protected getDefaultUserMessage(): string {
    return 'An external service is temporarily unavailable. Please try again later.';
  }
}

/**
 * Business logic error - business rule violations
 */
export class BusinessLogicError extends BaseError {
  constructor(
    message: string,
    code: string,
    context?: ErrorContext,
    userMessage?: string,
    originalError?: Error
  ) {
    super(
      message,
      code,
      ErrorSeverity.MEDIUM,
      ErrorCategory.BUSINESS_LOGIC,
      context,
      {
        type: 'user_action',
        userMessage: userMessage || message,
        actionRequired: 'review_action'
      },
      originalError
    );
  }

  protected getDefaultUserMessage(): string {
    return this.message;
  }
}

/**
 * System error - internal system failures
 */
export class SystemError extends BaseError {
  constructor(
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'SYSTEM_ERROR',
      ErrorSeverity.CRITICAL,
      ErrorCategory.SYSTEM,
      context,
      {
        type: 'graceful_degradation',
        userMessage: 'A system error occurred. Our team has been notified.'
      },
      originalError
    );
  }

  protected getDefaultUserMessage(): string {
    return 'An unexpected error occurred. Please try again later.';
  }
}

/**
 * Network error - network connectivity issues
 */
export class NetworkError extends BaseError {
  constructor(
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'NETWORK_ERROR',
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      context,
      {
        type: 'retry',
        retryAttempts: 5,
        retryDelay: 3000,
        userMessage: 'Network connectivity issue. Please check your connection.'
      },
      originalError
    );
  }

  protected getDefaultUserMessage(): string {
    return 'Network error. Please check your internet connection.';
  }
}

/**
 * Configuration error - missing or invalid configuration
 */
export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'CONFIG_ERROR',
      ErrorSeverity.CRITICAL,
      ErrorCategory.CONFIGURATION,
      context,
      {
        type: 'fallback',
        userMessage: 'Configuration error. Please contact support.'
      },
      originalError
    );
  }

  protected getDefaultUserMessage(): string {
    return 'System configuration error. Please contact support.';
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;

  constructor(
    message: string,
    retryAfter?: number,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(
      message,
      'RATE_LIMIT',
      ErrorSeverity.LOW,
      ErrorCategory.SYSTEM,
      context,
      {
        type: 'retry',
        retryAttempts: 1,
        retryDelay: retryAfter ? retryAfter * 1000 : 60000,
        userMessage: `Too many requests. Please wait ${retryAfter || 60} seconds.`
      },
      originalError
    );
    this.retryAfter = retryAfter;
  }

  protected getDefaultUserMessage(): string {
    return 'Too many requests. Please slow down and try again.';
  }
}