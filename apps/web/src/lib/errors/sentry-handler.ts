/**
 * 🚨 Sentry Error Handler
 * Enhanced error tracking with context and user info
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '../logging/logger';

// Error severity levels
export enum ErrorSeverity {
  Fatal = 'fatal',
  Error = 'error', 
  Warning = 'warning',
  Info = 'info',
  Debug = 'debug'
}

// Enhanced error context
interface ErrorContext {
  user?: {
    id: string;
    email?: string;
    username?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  fingerprint?: string[];
  level?: ErrorSeverity;
}

/**
 * Initialize Sentry with enhanced configuration
 */
export function initSentry() {
  const environment = process.env.NODE_ENV || 'development';
  const release = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown';

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment,
    release,
    
    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    
    // Session replay
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 0,
    
    // Integrations
    integrations: [
      new Sentry.BrowserTracing({
        routingInstrumentation: Sentry.nextRouterInstrumentation,
        // Trace fetch requests
        traceFetch: true,
        // Trace XHR requests
        traceXHR: true,
      }),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
        // Mask sensitive data
        mask: ['.sensitive', 'input[type="password"]', '[data-mask]'],
      }),
    ],
    
    // Filtering
    beforeSend(event, hint) {
      // Filter out non-error console logs
      if (event.level === 'log') {
        return null;
      }
      
      // Filter out known non-issues
      const error = hint.originalException;
      if (error && error instanceof Error) {
        // Skip network errors in development
        if (environment === 'development' && error.message.includes('Failed to fetch')) {
          return null;
        }
        
        // Skip canceled requests
        if (error.name === 'AbortError') {
          return null;
        }
      }
      
      // Add custom context
      event.tags = {
        ...event.tags,
        component: 'web-app',
      };
      
      return event;
    },
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        return null;
      }
      
      return breadcrumb;
    },
  });
}

/**
 * Capture error with enhanced context
 */
export function captureError(
  error: Error | string,
  context?: ErrorContext
): string {
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  
  // Set user context
  if (context?.user) {
    Sentry.setUser({
      id: context.user.id,
      email: context.user.email,
      username: context.user.username,
    });
  }
  
  // Set tags
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }
  
  // Set extra context
  if (context?.extra) {
    Sentry.setContext('extra', context.extra);
  }
  
  // Capture with level
  const sentryId = Sentry.captureException(errorObj, {
    level: context?.level || ErrorSeverity.Error,
    fingerprint: context?.fingerprint,
  });
  
  // Also log locally
  logger.error('Error captured by Sentry', {
    sentryId,
    error: errorObj.message,
    stack: errorObj.stack,
    context,
  });
  
  return sentryId;
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: ErrorSeverity = ErrorSeverity.Info,
  context?: Omit<ErrorContext, 'level'>
): string {
  // Set context
  if (context?.user) {
    Sentry.setUser(context.user);
  }
  
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }
  
  if (context?.extra) {
    Sentry.setContext('extra', context.extra);
  }
  
  const sentryId = Sentry.captureMessage(message, level);
  
  logger.info('Message captured by Sentry', {
    sentryId,
    message,
    level,
    context,
  });
  
  return sentryId;
}

/**
 * Add breadcrumb for better error context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Wrap async function with error capture
 */
export function withErrorCapture<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * React error boundary integration
 */
export function captureReactError(
  error: Error,
  errorInfo: { componentStack: string }
): void {
  captureError(error, {
    level: ErrorSeverity.Error,
    tags: {
      component: 'react',
    },
    extra: {
      componentStack: errorInfo.componentStack,
    },
  });
}

/**
 * Performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Transaction {
  return Sentry.startTransaction({
    name,
    op,
    tags: {
      component: 'web-app',
    },
  });
}

/**
 * Profile API performance
 */
export function profileAPICall(
  endpoint: string,
  method: string = 'GET'
): () => void {
  const transaction = startTransaction(`${method} ${endpoint}`, 'http.client');
  const span = transaction.startChild({
    op: 'http.client',
    description: `${method} ${endpoint}`,
  });
  
  return () => {
    span.finish();
    transaction.finish();
  };
}