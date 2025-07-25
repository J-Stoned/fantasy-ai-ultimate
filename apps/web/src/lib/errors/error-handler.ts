/**
 * Centralized error handler for the Fantasy AI Platform
 * Provides consistent error handling, logging, and recovery
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '../logging/logger';
import {
  BaseError,
  ErrorSeverity,
  ErrorCategory,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  DatabaseError,
  ExternalApiError,
  SystemError,
  NetworkError,
  ConfigurationError,
  RateLimitError,
  BusinessLogicError,
  ErrorContext
} from './base-errors';

export interface ErrorHandlerOptions {
  logError?: boolean;
  includeStack?: boolean;
  notifyUser?: boolean;
  sendToMonitoring?: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  
  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error and return appropriate response
   */
  public handleError(
    error: unknown,
    context?: ErrorContext,
    options: ErrorHandlerOptions = {}
  ): BaseError {
    const {
      logError = true,
      includeStack = process.env.NODE_ENV !== 'production',
      sendToMonitoring = true
    } = options;

    // Convert to BaseError if needed
    const baseError = this.normalizeError(error, context);

    // Log the error
    if (logError) {
      this.logError(baseError, includeStack);
    }

    // Send to monitoring service
    if (sendToMonitoring && baseError.severity !== ErrorSeverity.LOW) {
      this.sendToMonitoring(baseError);
    }

    // Apply recovery strategy if available
    if (baseError.recoveryStrategy) {
      this.applyRecoveryStrategy(baseError);
    }

    return baseError;
  }

  /**
   * Convert unknown errors to BaseError instances
   */
  private normalizeError(error: unknown, context?: ErrorContext): BaseError {
    // Already a BaseError
    if (error instanceof BaseError) {
      if (context) {
        error.context = { ...error.context, ...context };
      }
      return error;
    }

    // Zod validation error
    if (error instanceof ZodError) {
      const validationErrors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!validationErrors[path]) {
          validationErrors[path] = [];
        }
        validationErrors[path].push(err.message);
      });

      return new ValidationError(
        'Validation failed',
        validationErrors,
        context,
        error
      );
    }

    // Database errors (PostgreSQL)
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
        return new DatabaseError(
          'Database connection failed',
          context,
          error
        );
      }

      if (error.message.includes('duplicate key')) {
        return new BusinessLogicError(
          'Duplicate entry',
          'DUPLICATE_ENTRY',
          context,
          'This item already exists',
          error
        );
      }

      if (error.message.includes('foreign key')) {
        return new BusinessLogicError(
          'Related data conflict',
          'FOREIGN_KEY_VIOLATION',
          context,
          'Cannot perform this action due to related data',
          error
        );
      }

      // Network errors
      if (error.message.includes('ENOTFOUND') || error.message.includes('EHOSTUNREACH')) {
        return new NetworkError(
          'Network request failed',
          context,
          error
        );
      }

      // Rate limit errors
      if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
        return new RateLimitError(
          'Rate limit exceeded',
          60,
          context,
          error
        );
      }
    }

    // Generic error
    return new SystemError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      context,
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: BaseError, includeStack: boolean): void {
    const logData = {
      errorId: error.id,
      code: error.code,
      category: error.category,
      context: error.context,
      ...(includeStack && { stack: error.stack })
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(error.message, logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error(error.message, logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(error.message, logData);
        break;
      case ErrorSeverity.LOW:
        logger.info(error.message, logData);
        break;
    }
  }

  /**
   * Send error to monitoring service (Sentry/Datadog)
   */
  private sendToMonitoring(error: BaseError): void {
    // TODO: Integrate with Sentry or Datadog
    // For now, just log that we would send to monitoring
    logger.debug('Would send error to monitoring', {
      errorId: error.id,
      severity: error.severity,
      category: error.category
    });
  }

  /**
   * Apply recovery strategy for the error
   */
  private applyRecoveryStrategy(error: BaseError): void {
    if (!error.recoveryStrategy) return;

    const { type, retryAttempts, retryDelay } = error.recoveryStrategy;

    switch (type) {
      case 'retry':
        logger.info('Applying retry strategy', {
          errorId: error.id,
          retryAttempts,
          retryDelay
        });
        break;
      case 'circuit_breaker':
        logger.info('Circuit breaker activated', {
          errorId: error.id,
          service: error.context?.service
        });
        break;
      case 'fallback':
        logger.info('Using fallback value', {
          errorId: error.id
        });
        break;
      case 'graceful_degradation':
        logger.info('Gracefully degrading functionality', {
          errorId: error.id
        });
        break;
    }
  }

  /**
   * Create HTTP response from error
   */
  public createHttpResponse(error: BaseError): NextResponse {
    const statusCode = this.getHttpStatusCode(error);
    const includeDetails = process.env.NODE_ENV !== 'production';

    const responseBody = {
      error: {
        id: error.id,
        code: error.code,
        message: error.getUserMessage(),
        ...(error instanceof ValidationError && error.validationErrors && {
          validationErrors: error.validationErrors
        }),
        ...(includeDetails && {
          details: {
            category: error.category,
            severity: error.severity,
            timestamp: error.timestamp
          }
        })
      }
    };

    return NextResponse.json(responseBody, { status: statusCode });
  }

  /**
   * Get appropriate HTTP status code for error
   */
  private getHttpStatusCode(error: BaseError): number {
    if (error instanceof AuthenticationError) return 401;
    if (error instanceof AuthorizationError) return 403;
    if (error instanceof ValidationError) return 400;
    if (error instanceof RateLimitError) return 429;
    if (error instanceof BusinessLogicError) return 422;
    if (error instanceof ExternalApiError) return 502;
    if (error instanceof DatabaseError) return 503;
    if (error instanceof ConfigurationError) return 500;
    if (error instanceof NetworkError) return 503;
    return 500;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

/**
 * Express-style error handling middleware for API routes
 */
export function errorMiddleware(
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      const context: ErrorContext = {
        requestId: req.headers.get('x-request-id') || undefined,
        operation: `${req.method} ${new URL(req.url).pathname}`
      };

      const baseError = errorHandler.handleError(error, context);
      return errorHandler.createHttpResponse(baseError);
    }
  };
}