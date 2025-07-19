/**
 * Structured Logging Utility
 * 
 * Replaces 5,249 console.log statements with proper structured logging.
 * Features: Log levels, structured output, performance tracking, error context.
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogContext {
  timestamp: string;
  level: string;
  service?: string;
  module?: string;
  correlationId?: string;
  userId?: string;
  duration?: number;
  [key: string]: any;
}

interface LoggerConfig {
  level: LogLevel;
  service: string;
  format: 'json' | 'pretty';
  output: 'console' | 'file' | 'both';
  filePath?: string;
  maskSensitive?: boolean;
}

class Logger {
  private config: LoggerConfig;
  private startTimes: Map<string, number> = new Map();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: this.parseLogLevel(process.env.LOG_LEVEL || 'INFO'),
      service: config.service || 'fantasy-ai',
      format: (process.env.LOG_FORMAT as 'json' | 'pretty') || 'json',
      output: (process.env.LOG_OUTPUT as 'console' | 'file' | 'both') || 'console',
      filePath: process.env.LOG_FILE_PATH || './logs/app.log',
      maskSensitive: process.env.MASK_SENSITIVE !== 'false',
      ...config,
    };

    // Create log directory if needed
    if (this.config.output !== 'console' && this.config.filePath) {
      const dir = path.dirname(this.config.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private parseLogLevel(level: string): LogLevel {
    return LogLevel[level.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private maskSensitiveData(data: any): any {
    if (!this.config.maskSensitive) return data;

    const sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'authorization',
      'api_key', 'apiKey', 'auth', 'credential', 'ssn', 'email'
    ];

    const mask = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const masked = Array.isArray(obj) ? [...obj] : { ...obj };
      
      for (const key in masked) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          masked[key] = '***MASKED***';
        } else if (typeof masked[key] === 'object') {
          masked[key] = mask(masked[key]);
        }
      }
      
      return masked;
    };

    return mask(data);
  }

  private formatMessage(level: string, message: string, context: LogContext): string {
    const fullContext = {
      ...context,
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      pid: process.pid,
    };

    if (this.config.format === 'json') {
      return JSON.stringify({ message, ...fullContext });
    }

    // Pretty format for development
    const color = {
      DEBUG: '\x1b[36m',
      INFO: '\x1b[32m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
      FATAL: '\x1b[35m',
    }[level] || '';
    const reset = '\x1b[0m';

    return `${color}[${fullContext.timestamp}] [${level}] [${fullContext.service}]${reset} ${message} ${
      Object.keys(context).length > 0 ? JSON.stringify(context) : ''
    }`;
  }

  private write(level: string, message: string, context: LogContext): void {
    const formatted = this.formatMessage(level, message, this.maskSensitiveData(context));

    if (this.config.output === 'console' || this.config.output === 'both') {
      if (level === 'ERROR' || level === 'FATAL') {
        console.error(formatted);
      } else {
        console.log(formatted);
      }
    }

    if (this.config.output === 'file' || this.config.output === 'both') {
      if (this.config.filePath) {
        fs.appendFileSync(this.config.filePath, formatted + '\n');
      }
    }
  }

  // Core logging methods
  debug(message: string, context: Partial<LogContext> = {}): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.write('DEBUG', message, context as LogContext);
    }
  }

  info(message: string, context: Partial<LogContext> = {}): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.write('INFO', message, context as LogContext);
    }
  }

  warn(message: string, context: Partial<LogContext> = {}): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.write('WARN', message, context as LogContext);
    }
  }

  error(message: string, error?: Error | unknown, context: Partial<LogContext> = {}): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = error instanceof Error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      } : error ? { error } : {};
      
      this.write('ERROR', message, { ...context, ...errorContext } as LogContext);
    }
  }

  fatal(message: string, error?: Error | unknown, context: Partial<LogContext> = {}): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      const errorContext = error instanceof Error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      } : error ? { error } : {};
      
      this.write('FATAL', message, { ...context, ...errorContext } as LogContext);
    }
  }

  // Performance tracking
  time(label: string): void {
    this.startTimes.set(label, Date.now());
  }

  timeEnd(label: string, context: Partial<LogContext> = {}): void {
    const startTime = this.startTimes.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.startTimes.delete(label);
      this.info(`${label} completed`, { ...context, duration });
    }
  }

  // Child logger with additional context
  child(context: Partial<LogContext>): Logger {
    const childLogger = new Logger(this.config);
    const originalWrite = childLogger.write.bind(childLogger);
    
    childLogger.write = (level: string, message: string, ctx: LogContext) => {
      originalWrite(level, message, { ...context, ...ctx });
    };
    
    return childLogger;
  }

  // Utility methods
  profile(fn: () => any, label: string, context: Partial<LogContext> = {}): any {
    this.time(label);
    try {
      const result = fn();
      this.timeEnd(label, { ...context, status: 'success' });
      return result;
    } catch (error) {
      this.timeEnd(label, { ...context, status: 'error' });
      throw error;
    }
  }

  async profileAsync<T>(
    fn: () => Promise<T>,
    label: string,
    context: Partial<LogContext> = {}
  ): Promise<T> {
    this.time(label);
    try {
      const result = await fn();
      this.timeEnd(label, { ...context, status: 'success' });
      return result;
    } catch (error) {
      this.timeEnd(label, { ...context, status: 'error', error });
      throw error;
    }
  }
}

// Create default logger instance
export const logger = new Logger();

// Export for creating custom loggers
export function createLogger(config: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

// Migration helper to replace console.log
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  fatal: logger.fatal.bind(logger),
  time: logger.time.bind(logger),
  timeEnd: logger.timeEnd.bind(logger),
};

// Express middleware
export function loggerMiddleware(req: any, res: any, next: any): void {
  const start = Date.now();
  const correlationId = req.headers['x-correlation-id'] || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.correlationId = correlationId;
  req.logger = logger.child({ correlationId, userId: req.user?.id });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      correlationId,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}