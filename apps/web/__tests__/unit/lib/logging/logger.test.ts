/**
 * Comprehensive test suite for logging system
 * Tests structured logging, enterprise features, and performance
 */

import { logger, Logger, LogLevel, createLogger } from '@/lib/logging/logger';
import { enterpriseLogger, EnterpriseLogger } from '@/lib/logging/enterprise-logger';

// Mock fs module for testing file logging
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  renameSync: jest.fn(),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock fetch for remote logging
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
});

// Mock setImmediate
global.setImmediate = jest.fn((fn) => setTimeout(fn, 0));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Logging', () => {
    test('should log debug messages', () => {
      logger.debug('Test debug message', { testData: 'debug' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test debug message')
      );
    });

    test('should log info messages', () => {
      logger.info('Test info message', { testData: 'info' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
    });

    test('should log error messages', () => {
      logger.error('Test error message', { testData: 'error' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
    });

    test('should respect log levels', () => {
      const prodLogger = new Logger({
        minLevel: LogLevel.WARN,
        enableConsole: true,
      });

      prodLogger.debug('Should not appear');
      prodLogger.info('Should not appear');
      prodLogger.warn('Should appear');

      // Debug and info should not be logged
      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Should appear')
      );
    });
  });

  describe('Structured Logging', () => {
    test('should include metadata in log entries', () => {
      const metadata = {
        userId: 'user123',
        sessionId: 'session456',
        duration: 1500,
      };

      logger.info('Test with metadata', metadata);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test with metadata')
      );
    });

    test('should format logs as JSON in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodLogger = new Logger({
        pretty: false,
        enableConsole: true,
      });

      prodLogger.info('Production log');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/^{.*}$/) // JSON format
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Child Loggers', () => {
    test('should create child logger with additional context', () => {
      const childLogger = logger.child({
        service: 'auth-service',
        userId: 'user123',
      });

      childLogger.info('Child logger test');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Child logger test')
      );
    });

    test('should inherit parent configuration', () => {
      const parentLogger = new Logger({
        service: 'parent-service',
        minLevel: LogLevel.WARN,
      });

      const childLogger = parentLogger.child({ userId: 'user123' });
      
      // Should not log debug due to parent's minLevel
      childLogger.debug('Should not appear');
      childLogger.warn('Should appear');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Timing', () => {
    test('should measure operation duration', async () => {
      const testOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'operation result';
      };

      const result = await logger.time('test-operation', testOperation, {
        testContext: 'timing',
      });

      expect(result).toBe('operation result');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('test-operation completed')
      );
    });

    test('should log errors in timed operations', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      await expect(
        logger.time('failing-operation', failingOperation)
      ).rejects.toThrow('Operation failed');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('failing-operation failed')
      );
    });

    test('should provide timer functions', () => {
      const timer = logger.startTimer();
      expect(typeof timer).toBe('function');
      
      const duration = timer();
      expect(typeof duration).toBe('number');
    });
  });

  describe('File Logging', () => {
    test('should enable file logging when configured', () => {
      const fs = require('fs');
      
      const fileLogger = new Logger({
        enableFile: true,
        enableConsole: false,
      });

      fileLogger.info('File log test', { fileData: 'test' });

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    test('should rotate logs when size limit reached', () => {
      const fs = require('fs');
      fs.statSync.mockReturnValue({ size: 11 * 1024 * 1024 }); // > 10MB

      const fileLogger = new Logger({
        enableFile: true,
        enableConsole: false,
      });

      fileLogger.info('Large file log test');

      expect(fs.renameSync).toHaveBeenCalled();
    });
  });

  describe('Remote Logging', () => {
    test('should send logs to remote endpoint', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const remoteLogger = new Logger({
        enableRemote: true,
        enableConsole: false,
      });

      remoteLogger.info('Remote log test');

      // Wait for async remote logging
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle remote logging failures gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const remoteLogger = new Logger({
        enableRemote: true,
        enableConsole: false,
      });

      // Should not throw despite remote logging failure
      expect(() => {
        remoteLogger.error('Remote logging test');
      }).not.toThrow();
    });
  });

  describe('createLogger Factory', () => {
    test('should create logger with service name', () => {
      const serviceLogger = createLogger('test-service');
      
      serviceLogger.info('Service logger test');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service logger test')
      );
    });

    test('should create logger with metadata', () => {
      const serviceLogger = createLogger('test-service', {
        version: '1.0.0',
        environment: 'test',
      });

      serviceLogger.info('Service with metadata');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Service with metadata')
      );
    });
  });
});

describe('EnterpriseLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = EnterpriseLogger.getInstance();
      const instance2 = EnterpriseLogger.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Correlation ID Management', () => {
    test('should generate correlation ID', () => {
      const correlationId = enterpriseLogger.getCorrelationId();
      
      expect(correlationId).toBeTruthy();
      expect(typeof correlationId).toBe('string');
    });

    test('should set and get correlation ID', () => {
      const testId = 'test-correlation-id';
      enterpriseLogger.setCorrelationId(testId);
      
      expect(enterpriseLogger.getCorrelationId()).toBe(testId);
    });
  });

  describe('Business Operation Logging', () => {
    test('should log business operations', () => {
      enterpriseLogger.logBusinessOperation(
        'user-registration',
        'completed',
        {
          userId: 'user123',
          businessContext: 'onboarding',
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Business operation completed: user-registration')
      );
    });

    test('should log failed business operations', () => {
      enterpriseLogger.logBusinessOperation(
        'payment-processing',
        'failed',
        {
          paymentId: 'pay123',
          riskLevel: 'high',
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Business operation failed: payment-processing')
      );
    });
  });

  describe('Security Event Logging', () => {
    test('should log security events', () => {
      enterpriseLogger.logSecurityEvent(
        'unauthorized-access-attempt',
        'high',
        {
          userId: 'user123',
          ipAddress: '192.168.1.1',
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Security event: unauthorized-access-attempt')
      );
    });

    test('should mark critical security events properly', () => {
      enterpriseLogger.logSecurityEvent(
        'data-breach-detected',
        'critical',
        {
          affectedRecords: 1000,
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Security event: data-breach-detected')
      );
    });
  });

  describe('Performance Monitoring', () => {
    test('should log performance metrics', () => {
      enterpriseLogger.logPerformanceMetric(
        'api-response-time',
        250,
        500,
        {
          endpoint: '/api/users',
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Performance metric: api-response-time')
      );
    });

    test('should warn on threshold violations', () => {
      enterpriseLogger.logPerformanceMetric(
        'database-query-time',
        1500,
        1000, // threshold exceeded
        {
          query: 'SELECT * FROM users',
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Performance metric: database-query-time')
      );
    });
  });

  describe('ML Model Execution Logging', () => {
    test('should log ML model executions', () => {
      enterpriseLogger.logMLModelExecution(
        'fantasy-prediction-model',
        0.87,
        150,
        {
          modelVersion: '2.1.0',
          inputFeatures: 25,
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('ML model executed: fantasy-prediction-model')
      );
    });
  });

  describe('Financial Transaction Logging', () => {
    test('should log financial transactions with high compliance', () => {
      enterpriseLogger.logFinancialTransaction(
        'txn_123456789',
        99.99,
        'USD',
        {
          userId: 'user123',
          paymentMethod: 'credit_card',
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Financial transaction: txn_123456789')
      );
    });
  });

  describe('Audit Event Logging', () => {
    test('should log audit events for compliance', () => {
      enterpriseLogger.logAuditEvent(
        'user-data-access',
        'user-profile',
        'user123',
        {
          adminUser: 'admin456',
          reason: 'customer support',
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Audit: user-data-access on user-profile')
      );
    });
  });

  describe('Timed Operations', () => {
    test('should time operations with correlation tracking', async () => {
      const testOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'timed result';
      };

      const result = await enterpriseLogger.timeOperation(
        'enterprise-operation',
        testOperation,
        {
          businessContext: 'data-processing',
        }
      );

      expect(result).toBe('timed result');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Starting operation: enterprise-operation')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Completed operation: enterprise-operation')
      );
    });

    test('should handle operation failures', async () => {
      const failingOperation = async () => {
        throw new Error('Enterprise operation failed');
      };

      await expect(
        enterpriseLogger.timeOperation(
          'failing-enterprise-operation',
          failingOperation
        )
      ).rejects.toThrow('Enterprise operation failed');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Error in failing-enterprise-operation')
      );
    });
  });

  describe('Child Logger Creation', () => {
    test('should create child logger with context', () => {
      const childLogger = enterpriseLogger.createChildLogger({
        service: 'user-service',
        userId: 'user123',
      });

      expect(childLogger).toBeInstanceOf(EnterpriseLogger);
    });
  });
});

describe('Integration Tests', () => {
  test('should work together - basic and enterprise loggers', () => {
    logger.info('Basic logger message');
    enterpriseLogger.logBusinessOperation('test-operation', 'started');

    expect(mockConsoleLog).toHaveBeenCalledTimes(2);
  });

  test('should maintain performance under load', async () => {
    const startTime = Date.now();
    
    // Log 100 messages rapidly
    for (let i = 0; i < 100; i++) {
      logger.info(`Load test message ${i}`, { iteration: i });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (< 1 second)
    expect(duration).toBeLessThan(1000);
    expect(mockConsoleLog).toHaveBeenCalledTimes(100);
  });
});