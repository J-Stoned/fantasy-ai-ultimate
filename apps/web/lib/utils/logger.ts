import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, component, ...metadata }) => {
    let msg = `${timestamp} [${level}]`;
    if (component) msg += ` [${component}]`;
    msg += ` ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create base logger configuration
const createLogger = (component: string) => {
  const logger = winston.createLogger({
    levels: logLevels,
    defaultMeta: { component },
    transports: [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info'
      })
    ]
  });

  // Add file transports only in production
  if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));

    logger.add(new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));
  }

  return logger;
};

// Create a wrapper class for better typing and convenience
export class Logger {
  private logger: winston.Logger;
  private component: string;

  constructor(options: { component: string }) {
    this.component = options.component;
    this.logger = createLogger(options.component);
  }

  error(message: string, error?: any, metadata?: Record<string, any>) {
    this.logger.error(message, {
      error: error?.message || error,
      stack: error?.stack,
      ...metadata
    });
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.logger.warn(message, metadata);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.logger.info(message, metadata);
  }

  http(message: string, metadata?: Record<string, any>) {
    this.logger.http(message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.logger.debug(message, metadata);
  }

  verbose(message: string, metadata?: Record<string, any>) {
    this.logger.verbose(message, metadata);
  }
}

// Create specialized loggers
export const apiLogger = new Logger({ component: 'api' });
export const dbLogger = new Logger({ component: 'database' });
export const aiLogger = new Logger({ component: 'ai' });
export const mlLogger = new Logger({ component: 'ml' });
export const authLogger = new Logger({ component: 'auth' });
export const cronLogger = new Logger({ component: 'cron' });
export const mcpLogger = new Logger({ component: 'mcp' });
export const arLogger = new Logger({ component: 'ar' });
export const defaultLogger = new Logger({ component: 'app' });

// Create API logger factory function
export function createAPILogger(endpoint: string) {
  return new Logger({ component: `api:${endpoint}` });
}

// Alias for backward compatibility
export const createApiLogger = createAPILogger;

// Create agent logger factory function
export function createAgentLogger(agentName: string) {
  return new Logger({ component: `agent:${agentName}` });
}

// Default export for convenience
export default defaultLogger;