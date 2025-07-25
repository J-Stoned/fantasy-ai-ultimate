/**
 * Centralized error handling and logging exports
 * Single import point for all error handling functionality
 */

// Base error classes
export {
  BaseError,
  ErrorSeverity,
  ErrorCategory,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  DatabaseError,
  ExternalApiError,
  BusinessLogicError,
  SystemError,
  NetworkError,
  ConfigurationError,
  RateLimitError,
  type ErrorContext,
  type ErrorRecoveryStrategy
} from './base-errors';

// Error handler
export {
  ErrorHandler,
  errorHandler,
  errorMiddleware,
  type ErrorHandlerOptions
} from './error-handler';

// Logging
export {
  logger,
  Logger,
  LogLevel,
  createLogger,
  requestLogger,
  type LogMetadata,
  type LogEntry,
  type LoggerConfig
} from '../logging/logger';

// Browser logging
export {
  getBrowserLogger,
  browserLog
} from '../logging/browser-logger';

// Convenience functions for common error patterns
export function createError(
  type: 'auth' | 'authz' | 'validation' | 'database' | 'api' | 'business' | 'system' | 'network' | 'config' | 'rate_limit',
  message: string,
  context?: ErrorContext,
  additionalParams?: any
): BaseError {
  switch (type) {
    case 'auth':
      return new AuthenticationError(message, context, additionalParams);
    case 'authz':
      return new AuthorizationError(message, context, additionalParams);
    case 'validation':
      return new ValidationError(message, additionalParams, context);
    case 'database':
      return new DatabaseError(message, context, additionalParams);
    case 'api':
      return new ExternalApiError(message, additionalParams?.apiName || 'Unknown', additionalParams?.statusCode, context, additionalParams?.originalError);
    case 'business':
      return new BusinessLogicError(message, additionalParams?.code || 'BUSINESS_ERROR', context, additionalParams?.userMessage, additionalParams?.originalError);
    case 'system':
      return new SystemError(message, context, additionalParams);
    case 'network':
      return new NetworkError(message, context, additionalParams);
    case 'config':
      return new ConfigurationError(message, context, additionalParams);
    case 'rate_limit':
      return new RateLimitError(message, additionalParams?.retryAfter, context, additionalParams?.originalError);
    default:
      return new SystemError(message, context, additionalParams);
  }
}

// Type guards for error checking
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isExternalApiError(error: unknown): error is ExternalApiError {
  return error instanceof ExternalApiError;
}

export function isBusinessLogicError(error: unknown): error is BusinessLogicError {
  return error instanceof BusinessLogicError;
}

export function isSystemError(error: unknown): error is SystemError {
  return error instanceof SystemError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}