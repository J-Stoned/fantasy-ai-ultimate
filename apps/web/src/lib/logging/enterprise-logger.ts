/**
 * Enterprise-grade logging system for Fantasy AI Platform
 * Adds structured logging, log aggregation, correlation IDs, and monitoring integration
 */

import { logger, LogLevel, LogMetadata, createLogger } from './logger';
import { performance } from 'perf_hooks';

export interface EnterpriseLogMetadata extends LogMetadata {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  operationName?: string;
  component?: string;
  businessContext?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  complianceLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
}

export class EnterpriseLogger {
  private static instance: EnterpriseLogger;
  private correlationId: string = '';
  private readonly logger = createLogger('enterprise-platform');

  private constructor() {
    this.generateCorrelationId();
  }

  public static getInstance(): EnterpriseLogger {
    if (!EnterpriseLogger.instance) {
      EnterpriseLogger.instance = new EnterpriseLogger();
    }
    return EnterpriseLogger.instance;
  }

  /**
   * Generate unique correlation ID for request tracing
   */
  private generateCorrelationId(): string {
    this.correlationId = `${Date.now()}-${Math.random().toString(36).substring(7)}-${process.pid}`;
    return this.correlationId;
  }

  /**
   * Set correlation ID for distributed tracing
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get current correlation ID
   */
  public getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Enhanced structured logging with enterprise metadata
   */
  private logWithContext(
    level: LogLevel,
    message: string,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    const enhancedMetadata: EnterpriseLogMetadata = {
      ...metadata,
      correlationId: metadata.correlationId || this.correlationId,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    // Add business context classification
    if (metadata.riskLevel === 'critical' || metadata.complianceLevel === 'restricted') {
      enhancedMetadata.alertLevel = 'immediate';
    }

    this.logger[level](message, enhancedMetadata);
  }

  /**
   * Business operation logging
   */
  public logBusinessOperation(
    operation: string,
    status: 'started' | 'completed' | 'failed',
    metadata: EnterpriseLogMetadata = {}
  ): void {
    this.logWithContext(LogLevel.INFO, `Business operation ${status}: ${operation}`, {
      ...metadata,
      operationName: operation,
      operationStatus: status,
      businessContext: metadata.businessContext || 'general'
    });
  }

  /**
   * Security event logging
   */
  public logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata: EnterpriseLogMetadata = {}
  ): void {
    this.logWithContext(LogLevel.WARN, `Security event: ${event}`, {
      ...metadata,
      securityEvent: event,
      securitySeverity: severity,
      riskLevel: severity,
      complianceLevel: 'restricted'
    });
  }

  /**
   * Performance monitoring
   */
  public logPerformanceMetric(
    metric: string,
    value: number,
    threshold?: number,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    const isThresholdViolation = threshold && value > threshold;
    const level = isThresholdViolation ? LogLevel.WARN : LogLevel.INFO;

    this.logWithContext(level, `Performance metric: ${metric}`, {
      ...metadata,
      metric,
      value,
      threshold,
      unit: 'ms',
      thresholdViolation: isThresholdViolation
    });
  }

  /**
   * Database operation logging
   */
  public logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    recordCount?: number,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    this.logWithContext(LogLevel.INFO, `Database operation: ${operation} on ${table}`, {
      ...metadata,
      databaseOperation: operation,
      tableName: table,
      duration,
      recordCount,
      component: 'database'
    });
  }

  /**
   * API request/response logging
   */
  public logAPICall(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    
    this.logWithContext(level, `API ${method} ${endpoint} - ${statusCode}`, {
      ...metadata,
      httpMethod: method,
      endpoint,
      statusCode,
      duration,
      component: 'api',
      success: statusCode < 400
    });
  }

  /**
   * ML model execution logging
   */
  public logMLModelExecution(
    modelName: string,
    accuracy: number,
    executionTime: number,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    this.logWithContext(LogLevel.INFO, `ML model executed: ${modelName}`, {
      ...metadata,
      modelName,
      accuracy,
      executionTime,
      component: 'ml-engine',
      businessContext: 'prediction'
    });
  }

  /**
   * Financial transaction logging (high compliance)
   */
  public logFinancialTransaction(
    transactionId: string,
    amount: number,
    currency: string,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    this.logWithContext(LogLevel.INFO, `Financial transaction: ${transactionId}`, {
      ...metadata,
      transactionId,
      amount,
      currency,
      complianceLevel: 'restricted',
      riskLevel: 'high',
      component: 'financial',
      businessContext: 'transaction'
    });
  }

  /**
   * Audit logging for compliance
   */
  public logAuditEvent(
    action: string,
    resource: string,
    userId?: string,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    this.logWithContext(LogLevel.INFO, `Audit: ${action} on ${resource}`, {
      ...metadata,
      auditAction: action,
      resource,
      userId,
      complianceLevel: 'restricted',
      component: 'audit',
      businessContext: 'compliance'
    });
  }

  /**
   * Error tracking with context preservation
   */
  public logError(
    error: Error | string,
    context: string,
    metadata: EnterpriseLogMetadata = {}
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logWithContext(LogLevel.ERROR, `Error in ${context}: ${errorMessage}`, {
      ...metadata,
      errorContext: context,
      errorStack,
      errorName: error instanceof Error ? error.name : 'Unknown',
      riskLevel: 'high'
    });
  }

  /**
   * Time operation with automatic logging
   */
  public async timeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata: EnterpriseLogMetadata = {}
  ): Promise<T> {
    const startTime = performance.now();
    const operationCorrelationId = this.generateCorrelationId();

    this.logWithContext(LogLevel.INFO, `Starting operation: ${operationName}`, {
      ...metadata,
      correlationId: operationCorrelationId,
      operationName,
      operationStatus: 'started'
    });

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      this.logWithContext(LogLevel.INFO, `Completed operation: ${operationName}`, {
        ...metadata,
        correlationId: operationCorrelationId,
        operationName,
        operationStatus: 'completed',
        duration
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.logError(error as Error, operationName, {
        ...metadata,
        correlationId: operationCorrelationId,
        operationName,
        operationStatus: 'failed',
        duration
      });

      throw error;
    }
  }

  /**
   * Create child logger with persistent context
   */
  public createChildLogger(context: EnterpriseLogMetadata): EnterpriseLogger {
    const childLogger = new EnterpriseLogger();
    childLogger.correlationId = context.correlationId || this.correlationId;
    return childLogger;
  }
}

// Export singleton instance
export const enterpriseLogger = EnterpriseLogger.getInstance();

// Export convenience functions
export const logBusinessOperation = enterpriseLogger.logBusinessOperation.bind(enterpriseLogger);
export const logSecurityEvent = enterpriseLogger.logSecurityEvent.bind(enterpriseLogger);
export const logPerformanceMetric = enterpriseLogger.logPerformanceMetric.bind(enterpriseLogger);
export const logDatabaseOperation = enterpriseLogger.logDatabaseOperation.bind(enterpriseLogger);
export const logAPICall = enterpriseLogger.logAPICall.bind(enterpriseLogger);
export const logMLModelExecution = enterpriseLogger.logMLModelExecution.bind(enterpriseLogger);
export const logFinancialTransaction = enterpriseLogger.logFinancialTransaction.bind(enterpriseLogger);
export const logAuditEvent = enterpriseLogger.logAuditEvent.bind(enterpriseLogger);
export const logError = enterpriseLogger.logError.bind(enterpriseLogger);
export const timeOperation = enterpriseLogger.timeOperation.bind(enterpriseLogger);