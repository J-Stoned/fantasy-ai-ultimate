// Client-safe logger that works in both browser and server environments
// Falls back to console methods in the browser

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogMeta {
  [key: string]: any;
}

class ClientLogger {
  private context: Record<string, any>;
  
  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }
  
  private formatMessage(level: string, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(this.context).length > 0 ? ` [${JSON.stringify(this.context)}]` : '';
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}]${contextStr}: ${message}${metaStr}`;
  }
  
  private log(level: LogLevel, message: string, meta?: LogMeta) {
    if (typeof window === 'undefined') {
      // Server-side: use the winston logger
      const { defaultLogger } = require('./logger');
      defaultLogger[level](message, { ...this.context, ...meta });
    } else {
      // Client-side: use console with formatting
      const formattedMessage = this.formatMessage(level, message, meta);
      
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'debug':
          if (process.env.NODE_ENV === 'development') {
            console.log(formattedMessage);
          }
          break;
      }
    }
  }
  
  error(message: string, error?: Error | unknown, meta?: LogMeta) {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : error ? { error } : {};
    
    this.log('error', message, { ...errorMeta, ...meta });
  }
  
  warn(message: string, meta?: LogMeta) {
    this.log('warn', message, meta);
  }
  
  info(message: string, meta?: LogMeta) {
    this.log('info', message, meta);
  }
  
  debug(message: string, meta?: LogMeta) {
    this.log('debug', message, meta);
  }
  
  // Create child logger with additional context
  child(additionalContext: Record<string, any>): ClientLogger {
    return new ClientLogger({ ...this.context, ...additionalContext });
  }
}

// Default client logger instance
export const clientLogger = new ClientLogger();

// Specialized client loggers
export const uiLogger = new ClientLogger({ component: 'ui' });
export const dataLogger = new ClientLogger({ component: 'data' });
export const navigationLogger = new ClientLogger({ component: 'navigation' });

// Helper to create logger for specific pages/components
export function createComponentLogger(componentName: string): ClientLogger {
  return uiLogger.child({ component: componentName });
}