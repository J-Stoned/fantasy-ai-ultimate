/**
 * Client-side logger for React components
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
}

const config: LoggerConfig = {
  enabled: process.env.NODE_ENV !== 'production',
  level: 'info'
};

const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export function createComponentLogger(componentName: string) {
  const prefix = `[${componentName}]`;
  
  const shouldLog = (level: LogLevel): boolean => {
    return config.enabled && logLevels[level] >= logLevels[config.level];
  };
  
  return {
    debug: (...args: any[]) => {
      if (shouldLog('debug')) {
        }
    },
    
    info: (...args: any[]) => {
      if (shouldLog('info')) {
        }
    },
    
    warn: (...args: any[]) => {
      if (shouldLog('warn')) {
        }
    },
    
    error: (...args: any[]) => {
      if (shouldLog('error')) {
        }
    }
  };
}