/**
 * Browser-specific logger implementation
 * Lightweight logger for client-side error tracking and debugging
 */

import { LogLevel, LogMetadata, Logger } from './logger';

interface BrowserLoggerConfig {
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
  userId?: string;
  sessionId?: string;
}

class BrowserLogger extends Logger {
  private buffer: any[] = [];
  private config: BrowserLoggerConfig;
  private flushTimer?: number;

  constructor(config: Partial<BrowserLoggerConfig> = {}) {
    super({
      service: 'fantasy-ai-browser',
      environment: process.env.NODE_ENV || 'development',
      enableFile: false, // No file logging in browser
      enableRemote: config.enableRemoteLogging ?? false
    });

    this.config = {
      enableRemoteLogging: config.enableRemoteLogging ?? false,
      remoteEndpoint: config.remoteEndpoint || '/api/logs',
      bufferSize: config.bufferSize || 50,
      flushInterval: config.flushInterval || 30000, // 30 seconds
      userId: config.userId,
      sessionId: config.sessionId || this.generateSessionId()
    };

    if (this.config.enableRemoteLogging) {
      this.startFlushTimer();
      this.setupUnloadHandler();
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Override output to handle browser-specific logging
   */
  protected output(entry: any): void {
    // Always log to console in development
    if (process.env.NODE_ENV !== 'production' || entry.level === LogLevel.ERROR) {
      super.output(entry);
    }

    // Add to buffer for remote logging
    if (this.config.enableRemoteLogging) {
      this.addToBuffer({
        ...entry,
        metadata: {
          ...entry.metadata,
          userId: this.config.userId,
          sessionId: this.config.sessionId,
          userAgent: navigator.userAgent,
          url: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      });
    }
  }

  /**
   * Add log entry to buffer
   */
  private addToBuffer(entry: any): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffer to remote endpoint
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs })
      });
    } catch (error) {
      // Silently fail to avoid infinite error loops
      console.error('Failed to send logs to remote endpoint:', error);
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Setup unload handler to flush logs before page unload
   */
  private setupUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      if (this.buffer.length > 0) {
        // Use sendBeacon for reliability
        const logs = JSON.stringify({ logs: this.buffer });
        navigator.sendBeacon(this.config.remoteEndpoint!, logs);
      }
    });
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  /**
   * Log browser-specific errors
   */
  public logError(error: Error, metadata?: LogMetadata): void {
    this.error(error.message, {
      ...metadata,
      stack: error.stack,
      name: error.name
    });
  }

  /**
   * Log React errors
   */
  public logReactError(error: Error, errorInfo: any, metadata?: LogMetadata): void {
    this.error('React error', {
      ...metadata,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: errorInfo.errorBoundary
    });
  }

  /**
   * Log performance metrics
   */
  public logPerformance(metric: string, value: number, metadata?: LogMetadata): void {
    this.info(`Performance: ${metric}`, {
      ...metadata,
      metric,
      value,
      unit: 'ms'
    });
  }

  /**
   * Log user actions
   */
  public logAction(action: string, metadata?: LogMetadata): void {
    this.info(`User action: ${action}`, {
      ...metadata,
      action,
      timestamp: Date.now()
    });
  }
}

// Create singleton instance
let browserLogger: BrowserLogger | null = null;

export function getBrowserLogger(config?: Partial<BrowserLoggerConfig>): BrowserLogger {
  if (!browserLogger) {
    browserLogger = new BrowserLogger(config);
  }
  return browserLogger;
}

// Export convenience methods
export const browserLog = {
  debug: (message: string, metadata?: LogMetadata) => 
    getBrowserLogger().debug(message, metadata),
  
  info: (message: string, metadata?: LogMetadata) => 
    getBrowserLogger().info(message, metadata),
  
  warn: (message: string, metadata?: LogMetadata) => 
    getBrowserLogger().warn(message, metadata),
  
  error: (message: string, metadata?: LogMetadata) => 
    getBrowserLogger().error(message, metadata),
  
  logError: (error: Error, metadata?: LogMetadata) => 
    getBrowserLogger().logError(error, metadata),
  
  logReactError: (error: Error, errorInfo: any, metadata?: LogMetadata) => 
    getBrowserLogger().logReactError(error, errorInfo, metadata),
  
  logPerformance: (metric: string, value: number, metadata?: LogMetadata) => 
    getBrowserLogger().logPerformance(metric, value, metadata),
  
  logAction: (action: string, metadata?: LogMetadata) => 
    getBrowserLogger().logAction(action, metadata)
};

// Setup global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    getBrowserLogger().error('Unhandled error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    getBrowserLogger().error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise
    });
  });
}