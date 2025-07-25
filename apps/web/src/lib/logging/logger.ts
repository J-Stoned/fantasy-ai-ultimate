/**
 * Structured logging system for the Fantasy AI Platform
 * Provides consistent, searchable, and parseable logs
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogMetadata {
  [key: string]: any;
  service?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  errorId?: string;
  stack?: string;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  metadata?: LogMetadata;
}

export interface LoggerConfig {
  service: string;
  environment: string;
  minLevel: LogLevel;
  pretty: boolean;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
}

class Logger {
  private config: LoggerConfig;
  private levelPriority: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      service: config.service || 'fantasy-ai-platform',
      environment: config.environment || process.env.NODE_ENV || 'development',
      minLevel: config.minLevel || (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG),
      pretty: config.pretty ?? process.env.NODE_ENV !== 'production',
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      enableRemote: config.enableRemote ?? process.env.NODE_ENV === 'production'
    };
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.config.minLevel];
  }

  /**
   * Format log entry
   */
  private formatLogEntry(level: LogLevel, message: string, metadata?: LogMetadata): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.service,
      environment: this.config.environment,
      metadata: {
        ...metadata,
        pid: process.pid,
        hostname: typeof window === 'undefined' ? require('os').hostname() : 'browser'
      }
    };
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Console output
    if (this.config.enableConsole) {
      this.consoleOutput(entry);
    }

    // File output (server-side only)
    if (this.config.enableFile && typeof window === 'undefined') {
      this.fileOutput(entry);
    }

    // Remote output (e.g., to logging service)
    if (this.config.enableRemote) {
      this.remoteOutput(entry);
    }
  }

  /**
   * Console output with color coding
   */
  private consoleOutput(entry: LogEntry): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';

    if (this.config.pretty && typeof window === 'undefined') {
      const color = colors[entry.level];
      const prefix = `${color}[${entry.level.toUpperCase()}]${reset}`;
      console.log(`${prefix} ${entry.timestamp} - ${entry.message}`);
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        console.log('  Metadata:', JSON.stringify(entry.metadata, null, 2));
      }
    } else {
      // JSON output for production or browser
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * File output with rotation support
   */
  private fileOutput(entry: LogEntry): void {
    if (typeof window !== 'undefined') return; // Browser environment

    try {
      const fs = require('fs');
      const path = require('path');
      
      const logDir = path.join(process.cwd(), 'logs');
      const logFile = path.join(logDir, `${this.config.service}.log`);
      const errorLogFile = path.join(logDir, `${this.config.service}-error.log`);
      
      // Ensure log directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logLine = JSON.stringify(entry) + '\n';
      
      // Log all entries to main log
      fs.appendFileSync(logFile, logLine);
      
      // Log errors to separate error log
      if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
        fs.appendFileSync(errorLogFile, logLine);
      }

      // Simple rotation check (rotate if > 10MB)
      const stats = fs.statSync(logFile);
      if (stats.size > 10 * 1024 * 1024) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = path.join(logDir, `${this.config.service}-${timestamp}.log`);
        fs.renameSync(logFile, rotatedFile);
      }
    } catch (error) {
      // Fail silently to avoid infinite loops
      console.error('File logging failed:', error);
    }
  }

  /**
   * Remote output - sends logs to monitoring service
   */
  private remoteOutput(entry: LogEntry): void {
    if (typeof window !== 'undefined') return; // Browser environment
    
    // Don't send to remote in development unless explicitly enabled
    if (this.config.environment === 'development' && !process.env.FORCE_REMOTE_LOGGING) {
      return;
    }

    try {
      // Send to monitoring endpoint (Prometheus metrics format)
      const logPayload = {
        timestamp: entry.timestamp,
        level: entry.level,
        service: entry.service,
        message: entry.message,
        environment: entry.environment,
        metadata: entry.metadata
      };

      // Use setImmediate to avoid blocking the main thread
      setImmediate(async () => {
        try {
          // In production, this would send to your logging service
          const response = await fetch(process.env.LOG_AGGREGATION_ENDPOINT || 'http://localhost:3001/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.LOG_SERVICE_TOKEN || 'dev-token'}`
            },
            body: JSON.stringify(logPayload),
            // Don't wait for response to avoid blocking
            signal: AbortSignal.timeout(5000)
          });

          if (!response.ok) {
            console.error('Remote logging failed:', response.status, response.statusText);
          }
        } catch (error) {
          // Silently fail to avoid infinite loops
          console.error('Remote logging error:', error);
        }
      });
    } catch (error) {
      console.error('Remote logging setup failed:', error);
    }
  }

  /**
   * Log methods
   */
  public debug(message: string, metadata?: LogMetadata): void {
    this.output(this.formatLogEntry(LogLevel.DEBUG, message, metadata));
  }

  public info(message: string, metadata?: LogMetadata): void {
    this.output(this.formatLogEntry(LogLevel.INFO, message, metadata));
  }

  public warn(message: string, metadata?: LogMetadata): void {
    this.output(this.formatLogEntry(LogLevel.WARN, message, metadata));
  }

  public error(message: string, metadata?: LogMetadata): void {
    this.output(this.formatLogEntry(LogLevel.ERROR, message, metadata));
  }

  public fatal(message: string, metadata?: LogMetadata): void {
    this.output(this.formatLogEntry(LogLevel.FATAL, message, metadata));
  }

  /**
   * Create child logger with additional context
   */
  public child(metadata: LogMetadata): Logger {
    const childLogger = new Logger(this.config);
    const originalOutput = childLogger.output.bind(childLogger);
    
    childLogger.output = (entry: LogEntry) => {
      entry.metadata = { ...metadata, ...entry.metadata };
      originalOutput(entry);
    };

    return childLogger;
  }

  /**
   * Performance logging helpers
   */
  public startTimer(): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      return duration;
    };
  }

  public async time<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { ...metadata, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, { 
        ...metadata, 
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Create default logger instance
const defaultConfig: Partial<LoggerConfig> = {
  service: 'fantasy-ai-platform',
  environment: process.env.NODE_ENV || 'development'
};

export const logger = new Logger(defaultConfig);

// Export Logger class for custom instances
export { Logger };

/**
 * Create a logger for a specific service/module
 */
export function createLogger(service: string, metadata?: LogMetadata): Logger {
  const serviceLogger = new Logger({ ...defaultConfig, service });
  return metadata ? serviceLogger.child(metadata) : serviceLogger;
}

/**
 * Express/Next.js request logging middleware
 */
export function requestLogger(req: Request, res?: Response): void {
  const start = Date.now();
  const url = new URL(req.url);
  
  logger.info('Request started', {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: {
      'user-agent': req.headers.get('user-agent'),
      'x-request-id': req.headers.get('x-request-id')
    }
  });

  // Log response if available (Next.js API routes)
  if (res) {
    const originalSend = (res as any).send;
    (res as any).send = function(body: any) {
      const duration = Date.now() - start;
      logger.info('Request completed', {
        method: req.method,
        path: url.pathname,
        status: (res as any).statusCode,
        duration
      });
      return originalSend.call(this, body);
    };
  }
}