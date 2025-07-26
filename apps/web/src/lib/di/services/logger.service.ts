/**
 * Logger service implementation
 */

import { Injectable } from '../container';
import { ILogger } from '../interfaces';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

@Injectable({ singleton: true })
export class LoggerService implements ILogger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, error?: any, meta?: any): void {
    if (this.shouldLog('error')) {
      const errorMeta = {
        ...meta,
        error: error instanceof Error ? {
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          name: error.name,
        } : error,
      };
      console.error(this.formatMessage('error', message, errorMeta));
    }
  }
}

/**
 * Production logger that sends logs to external service
 */
@Injectable({ singleton: true })
export class ProductionLoggerService implements ILogger {
  private buffer: any[] = [];
  private flushInterval = 5000; // 5 seconds
  private maxBufferSize = 100;

  constructor() {
    // Flush logs periodically
    setInterval(() => this.flush(), this.flushInterval);
  }

  private async sendLogs(logs: any[]): Promise<void> {
    // TODO: Send to logging service (e.g., Datadog, LogRocket)
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      });
    } catch (error) {
      console.error('Failed to send logs:', error);
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const logs = [...this.buffer];
    this.buffer = [];
    
    await this.sendLogs(logs);
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.buffer.push(logEntry);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console[level](message, meta);
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: any, meta?: any): void {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    this.log('error', message, errorMeta);
  }
}