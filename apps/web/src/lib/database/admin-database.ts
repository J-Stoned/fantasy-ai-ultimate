/**
 * 🔥 ENTERPRISE ADMIN DATABASE SERVICE 🔥
 * 
 * Jaw-dropping database operations for admin metrics and analytics.
 * Built for ML Training & DFS Training Dashboard data management.
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { Redis } from 'ioredis';
import { AdminSession } from '../middleware/admin-auth';

// Database Configuration
export interface AdminDatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

// Metric Interfaces
export interface MLTrainingJob {
  id: string;
  jobName: string;
  modelType: string;
  sport?: string;
  datasetSize: number;
  hyperparameters: Record<string, any>;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedBy: string;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
  gpuHoursUsed?: number;
  memoryPeakGb?: number;
  finalAccuracy?: number;
  finalLoss?: number;
  validationMetrics?: Record<string, any>;
  modelArtifactPath?: string;
  logsPath?: string;
  errorMessage?: string;
}

export interface MLTrainingMetric {
  id: string;
  jobId: string;
  epoch: number;
  batch?: number;
  loss: number;
  accuracy: number;
  validationLoss?: number;
  validationAccuracy?: number;
  learningRate: number;
  gpuUtilization: number;
  memoryUsageGb: number;
  trainingSpeed: number;
  customMetrics?: Record<string, any>;
  timestamp: Date;
}

export interface DFSContestEntry {
  id: string;
  contestId: string;
  platform: string;
  sport: string;
  slateDate: Date;
  contestType: string;
  entryFee: number;
  maxEntries: number;
  totalEntries?: number;
  prizePool?: number;
  strategyId?: string;
  lineup: Record<string, any>;
  ownershipProjections?: Record<string, any>;
  projectedScore: number;
  actualScore?: number;
  finalRank?: number;
  payout: number;
  roiPercent?: number;
  status: 'ENTERED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  enteredAt: Date;
  completedAt?: Date;
}

export interface SystemMetric {
  id: string;
  metricName: string;
  metricValue: number;
  metricUnit?: string;
  component: string;
  serverId?: string;
  timestamp: Date;
}

export interface AdminAlert {
  id: string;
  ruleId?: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data?: Record<string, any>;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

// Query Result Types
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class AdminDatabaseService {
  private pool: Pool;
  private redis: Redis;
  private config: AdminDatabaseConfig;

  constructor(config: AdminDatabaseConfig) {
    this.config = config;
    
    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeoutMs,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      // Performance optimizations
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      application_name: 'fantasy-ai-admin'
    });
    
    // Initialize Redis for caching
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    this.setupEventHandlers();
    console.log('[AdminDB] Database service initialized');
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', (client) => {
      console.log('[AdminDB] Client connected to database');
    });
    
    this.pool.on('error', (err) => {
      console.error('[AdminDB] Database error:', err);
    });
    
    this.pool.on('remove', () => {
      console.log('[AdminDB] Client removed from pool');
    });
  }

  // ==================== ML TRAINING OPERATIONS ====================

  /**
   * 🤖 CREATE ML TRAINING JOB
   * Record new ML training job with comprehensive tracking
   */
  async createMLTrainingJob(job: Omit<MLTrainingJob, 'id' | 'startedAt'>): Promise<string> {
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO ml_training_jobs (
          job_name, model_type, sport, dataset_size, hyperparameters,
          status, started_by, gpu_hours_used, memory_peak_gb
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
      
      const values = [
        job.jobName,
        job.modelType,
        job.sport,
        job.datasetSize,
        JSON.stringify(job.hyperparameters),
        job.status,
        job.startedBy,
        job.gpuHoursUsed || 0,
        job.memoryPeakGb || 0
      ];
      
      const result = await client.query(query, values);
      const jobId = result.rows[0].id;
      
      // Cache job info for real-time updates
      await this.redis.setex(`ml_job:${jobId}`, 3600, JSON.stringify(job));
      
      console.log(`[AdminDB] Created ML training job: ${jobId}`);
      return jobId;
      
    } finally {
      client.release();
    }
  }

  /**
   * 📊 LOG ML TRAINING METRICS
   * Record real-time training metrics during model training
   */
  async logMLTrainingMetrics(metrics: Omit<MLTrainingMetric, 'id' | 'timestamp'>[]): Promise<void> {
    if (metrics.length === 0) return;
    
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO ml_training_metrics (
          job_id, epoch, batch, loss, accuracy, validation_loss, validation_accuracy,
          learning_rate, gpu_utilization, memory_usage_gb, training_speed_samples_per_sec,
          custom_metrics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (job_id, epoch, batch) DO UPDATE SET
          loss = EXCLUDED.loss,
          accuracy = EXCLUDED.accuracy,
          validation_loss = EXCLUDED.validation_loss,
          validation_accuracy = EXCLUDED.validation_accuracy,
          learning_rate = EXCLUDED.learning_rate,
          gpu_utilization = EXCLUDED.gpu_utilization,
          memory_usage_gb = EXCLUDED.memory_usage_gb,
          training_speed_samples_per_sec = EXCLUDED.training_speed_samples_per_sec,
          custom_metrics = EXCLUDED.custom_metrics,
          timestamp = CURRENT_TIMESTAMP
      `;
      
      for (const metric of metrics) {
        const values = [
          metric.jobId,
          metric.epoch,
          metric.batch || null,
          metric.loss,
          metric.accuracy,
          metric.validationLoss || null,
          metric.validationAccuracy || null,
          metric.learningRate,
          metric.gpuUtilization,
          metric.memoryUsageGb,
          metric.trainingSpeed,
          metric.customMetrics ? JSON.stringify(metric.customMetrics) : null
        ];
        
        await client.query(query, values);
      }
      
      await client.query('COMMIT');
      
      // Cache latest metrics for real-time dashboard
      const latestMetric = metrics[metrics.length - 1];
      await this.redis.setex(
        `ml_metrics:${latestMetric.jobId}:latest`,
        300,
        JSON.stringify(latestMetric)
      );
      
      console.log(`[AdminDB] Logged ${metrics.length} ML training metrics`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🎯 UPDATE ML TRAINING JOB STATUS
   * Update job status and final results
   */
  async updateMLTrainingJobStatus(
    jobId: string,
    status: MLTrainingJob['status'],
    updates: Partial<MLTrainingJob> = {}
  ): Promise<void> {
    const client = await this.getClient();
    try {
      const setClauses: string[] = ['status = $2'];
      const values: any[] = [jobId, status];
      let paramIndex = 3;
      
      if (updates.completedAt) {
        setClauses.push(`completed_at = $${paramIndex++}`);
        values.push(updates.completedAt);
      }
      
      if (updates.durationSeconds) {
        setClauses.push(`duration_seconds = $${paramIndex++}`);
        values.push(updates.durationSeconds);
      }
      
      if (updates.finalAccuracy) {
        setClauses.push(`final_accuracy = $${paramIndex++}`);
        values.push(updates.finalAccuracy);
      }
      
      if (updates.finalLoss) {
        setClauses.push(`final_loss = $${paramIndex++}`);
        values.push(updates.finalLoss);
      }
      
      if (updates.validationMetrics) {
        setClauses.push(`validation_metrics = $${paramIndex++}`);
        values.push(JSON.stringify(updates.validationMetrics));
      }
      
      if (updates.modelArtifactPath) {
        setClauses.push(`model_artifact_path = $${paramIndex++}`);
        values.push(updates.modelArtifactPath);
      }
      
      if (updates.errorMessage) {
        setClauses.push(`error_message = $${paramIndex++}`);
        values.push(updates.errorMessage);
      }
      
      const query = `
        UPDATE ml_training_jobs 
        SET ${setClauses.join(', ')}
        WHERE id = $1
      `;
      
      await client.query(query, values);
      
      // Update cache
      await this.redis.del(`ml_job:${jobId}`);
      
      console.log(`[AdminDB] Updated ML job ${jobId} status to ${status}`);
      
    } finally {
      client.release();
    }
  }

  /**
   * 📈 GET ML TRAINING ANALYTICS
   * Retrieve ML training performance analytics
   */
  async getMLTrainingAnalytics(options: {
    dateFrom?: Date;
    dateTo?: Date;
    modelType?: string;
    sport?: string;
  } = {}): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgAccuracy: number;
    totalGpuHours: number;
    avgDuration: number;
    dailyStats: Array<{
      date: string;
      jobs: number;
      completedJobs: number;
      avgAccuracy: number;
    }>;
  }> {
    const cacheKey = `ml_analytics:${JSON.stringify(options)}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const client = await this.getClient();
    try {
      let whereClause = '1=1';
      const values: any[] = [];
      let paramIndex = 1;
      
      if (options.dateFrom) {
        whereClause += ` AND started_at >= $${paramIndex++}`;
        values.push(options.dateFrom);
      }
      
      if (options.dateTo) {
        whereClause += ` AND started_at <= $${paramIndex++}`;
        values.push(options.dateTo);
      }
      
      if (options.modelType) {
        whereClause += ` AND model_type = $${paramIndex++}`;
        values.push(options.modelType);
      }
      
      if (options.sport) {
        whereClause += ` AND sport = $${paramIndex++}`;
        values.push(options.sport);
      }
      
      // Main stats query
      const statsQuery = `
        SELECT 
          COUNT(*) as total_jobs,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_jobs,
          COUNT(*) FILTER (WHERE status = 'FAILED') as failed_jobs,
          AVG(final_accuracy) FILTER (WHERE status = 'COMPLETED') as avg_accuracy,
          SUM(gpu_hours_used) as total_gpu_hours,
          AVG(duration_seconds) FILTER (WHERE status = 'COMPLETED') as avg_duration
        FROM ml_training_jobs
        WHERE ${whereClause}
      `;
      
      const statsResult = await client.query(statsQuery, values);
      const stats = statsResult.rows[0];
      
      // Daily stats query
      const dailyQuery = `
        SELECT 
          DATE(started_at) as date,
          COUNT(*) as jobs,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_jobs,
          AVG(final_accuracy) FILTER (WHERE status = 'COMPLETED') as avg_accuracy
        FROM ml_training_jobs
        WHERE ${whereClause}
        GROUP BY DATE(started_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      
      const dailyResult = await client.query(dailyQuery, values);
      
      const analytics = {
        totalJobs: parseInt(stats.total_jobs) || 0,
        completedJobs: parseInt(stats.completed_jobs) || 0,
        failedJobs: parseInt(stats.failed_jobs) || 0,
        avgAccuracy: parseFloat(stats.avg_accuracy) || 0,
        totalGpuHours: parseFloat(stats.total_gpu_hours) || 0,
        avgDuration: parseFloat(stats.avg_duration) || 0,
        dailyStats: dailyResult.rows.map(row => ({
          date: row.date,
          jobs: parseInt(row.jobs),
          completedJobs: parseInt(row.completed_jobs),
          avgAccuracy: parseFloat(row.avg_accuracy) || 0
        }))
      };
      
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(analytics));
      
      return analytics;
      
    } finally {
      client.release();
    }
  }

  // ==================== DFS TRADING OPERATIONS ====================

  /**
   * 🎰 CREATE DFS CONTEST ENTRY
   * Record new DFS contest entry
   */
  async createDFSContestEntry(entry: Omit<DFSContestEntry, 'id' | 'enteredAt'>): Promise<string> {
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO dfs_contest_entries (
          contest_id, platform, sport, slate_date, contest_type, entry_fee,
          max_entries, total_entries, prize_pool, strategy_id, lineup,
          ownership_projections, projected_score, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `;
      
      const values = [
        entry.contestId,
        entry.platform,
        entry.sport,
        entry.slateDate,
        entry.contestType,
        entry.entryFee,
        entry.maxEntries,
        entry.totalEntries,
        entry.prizePool,
        entry.strategyId,
        JSON.stringify(entry.lineup),
        entry.ownershipProjections ? JSON.stringify(entry.ownershipProjections) : null,
        entry.projectedScore,
        entry.status
      ];
      
      const result = await client.query(query, values);
      const entryId = result.rows[0].id;
      
      console.log(`[AdminDB] Created DFS contest entry: ${entryId}`);
      return entryId;
      
    } finally {
      client.release();
    }
  }

  /**
   * 🔄 UPDATE DFS CONTEST ENTRY
   * Update contest entry with live results
   */
  async updateDFSContestEntry(
    entryId: string,
    updates: Partial<DFSContestEntry>
  ): Promise<void> {
    const client = await this.getClient();
    try {
      const setClauses: string[] = [];
      const values: any[] = [entryId];
      let paramIndex = 2;
      
      if (updates.actualScore !== undefined) {
        setClauses.push(`actual_score = $${paramIndex++}`);
        values.push(updates.actualScore);
      }
      
      if (updates.finalRank !== undefined) {
        setClauses.push(`final_rank = $${paramIndex++}`);
        values.push(updates.finalRank);
      }
      
      if (updates.payout !== undefined) {
        setClauses.push(`payout = $${paramIndex++}`);
        values.push(updates.payout);
      }
      
      if (updates.roiPercent !== undefined) {
        setClauses.push(`roi_percent = $${paramIndex++}`);
        values.push(updates.roiPercent);
      }
      
      if (updates.status) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      
      if (updates.completedAt) {
        setClauses.push(`completed_at = $${paramIndex++}`);
        values.push(updates.completedAt);
      }
      
      if (setClauses.length === 0) return;
      
      const query = `
        UPDATE dfs_contest_entries 
        SET ${setClauses.join(', ')}
        WHERE id = $1
      `;
      
      await client.query(query, values);
      
      console.log(`[AdminDB] Updated DFS contest entry: ${entryId}`);
      
    } finally {
      client.release();
    }
  }

  /**
   * 💰 GET DFS PERFORMANCE ANALYTICS
   * Retrieve DFS trading performance metrics
   */
  async getDFSPerformanceAnalytics(options: {
    dateFrom?: Date;
    dateTo?: Date;
    platform?: string;
    sport?: string;
  } = {}): Promise<{
    totalEntries: number;
    totalFees: number;
    totalPayouts: number;
    netProfit: number;
    roi: number;
    winRate: number;
    bestDay: number;
    worstDay: number;
    dailyPerformance: Array<{
      date: string;
      entries: number;
      fees: number;
      payouts: number;
      profit: number;
      roi: number;
    }>;
  }> {
    const cacheKey = `dfs_analytics:${JSON.stringify(options)}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const client = await this.getClient();
    try {
      let whereClause = "status = 'COMPLETED'";
      const values: any[] = [];
      let paramIndex = 1;
      
      if (options.dateFrom) {
        whereClause += ` AND slate_date >= $${paramIndex++}`;
        values.push(options.dateFrom);
      }
      
      if (options.dateTo) {
        whereClause += ` AND slate_date <= $${paramIndex++}`;
        values.push(options.dateTo);
      }
      
      if (options.platform) {
        whereClause += ` AND platform = $${paramIndex++}`;
        values.push(options.platform);
      }
      
      if (options.sport) {
        whereClause += ` AND sport = $${paramIndex++}`;
        values.push(options.sport);
      }
      
      // Main performance query
      const performanceQuery = `
        SELECT 
          COUNT(*) as total_entries,
          SUM(entry_fee) as total_fees,
          SUM(payout) as total_payouts,
          SUM(payout - entry_fee) as net_profit,
          AVG(roi_percent) as avg_roi,
          COUNT(*) FILTER (WHERE payout > entry_fee) as winning_entries
        FROM dfs_contest_entries
        WHERE ${whereClause}
      `;
      
      const perfResult = await client.query(performanceQuery, values);
      const perf = perfResult.rows[0];
      
      // Daily performance query
      const dailyQuery = `
        SELECT 
          slate_date as date,
          COUNT(*) as entries,
          SUM(entry_fee) as fees,
          SUM(payout) as payouts,
          SUM(payout - entry_fee) as profit,
          AVG(roi_percent) as roi
        FROM dfs_contest_entries
        WHERE ${whereClause}
        GROUP BY slate_date
        ORDER BY slate_date DESC
        LIMIT 30
      `;
      
      const dailyResult = await client.query(dailyQuery, values);
      
      // Best/worst day query
      const extremesQuery = `
        SELECT 
          MAX(daily_profit) as best_day,
          MIN(daily_profit) as worst_day
        FROM (
          SELECT 
            slate_date,
            SUM(payout - entry_fee) as daily_profit
          FROM dfs_contest_entries
          WHERE ${whereClause}
          GROUP BY slate_date
        ) daily_totals
      `;
      
      const extremesResult = await client.query(extremesQuery, values);
      const extremes = extremesResult.rows[0];
      
      const totalEntries = parseInt(perf.total_entries) || 0;
      const winningEntries = parseInt(perf.winning_entries) || 0;
      const totalFees = parseFloat(perf.total_fees) || 0;
      const totalPayouts = parseFloat(perf.total_payouts) || 0;
      
      const analytics = {
        totalEntries,
        totalFees,
        totalPayouts,
        netProfit: parseFloat(perf.net_profit) || 0,
        roi: totalFees > 0 ? ((totalPayouts - totalFees) / totalFees) * 100 : 0,
        winRate: totalEntries > 0 ? (winningEntries / totalEntries) * 100 : 0,
        bestDay: parseFloat(extremes.best_day) || 0,
        worstDay: parseFloat(extremes.worst_day) || 0,
        dailyPerformance: dailyResult.rows.map(row => ({
          date: row.date,
          entries: parseInt(row.entries),
          fees: parseFloat(row.fees),
          payouts: parseFloat(row.payouts),
          profit: parseFloat(row.profit),
          roi: parseFloat(row.roi) || 0
        }))
      };
      
      // Cache for 2 minutes
      await this.redis.setex(cacheKey, 120, JSON.stringify(analytics));
      
      return analytics;
      
    } finally {
      client.release();
    }
  }

  // ==================== SYSTEM METRICS OPERATIONS ====================

  /**
   * 📊 LOG SYSTEM METRICS
   * Record system performance metrics
   */
  async logSystemMetrics(metrics: Omit<SystemMetric, 'id' | 'timestamp'>[]): Promise<void> {
    if (metrics.length === 0) return;
    
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO system_metrics (metric_name, metric_value, metric_unit, component, server_id)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      for (const metric of metrics) {
        const values = [
          metric.metricName,
          metric.metricValue,
          metric.metricUnit,
          metric.component,
          metric.serverId
        ];
        
        await client.query(query, values);
      }
      
      console.log(`[AdminDB] Logged ${metrics.length} system metrics`);
      
    } finally {
      client.release();
    }
  }

  // ==================== ALERT OPERATIONS ====================

  /**
   * 🚨 CREATE ADMIN ALERT
   * Create new admin alert
   */
  async createAdminAlert(alert: Omit<AdminAlert, 'id' | 'triggeredAt'>): Promise<string> {
    const client = await this.getClient();
    try {
      const query = `
        INSERT INTO admin_alerts (
          rule_id, alert_type, severity, title, message, data
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const values = [
        alert.ruleId,
        alert.alertType,
        alert.severity,
        alert.title,
        alert.message,
        alert.data ? JSON.stringify(alert.data) : null
      ];
      
      const result = await client.query(query, values);
      const alertId = result.rows[0].id;
      
      // Cache for real-time alerts
      await this.redis.lpush('admin_alerts:recent', JSON.stringify({
        id: alertId,
        ...alert,
        triggeredAt: new Date()
      }));
      await this.redis.ltrim('admin_alerts:recent', 0, 99); // Keep last 100
      
      console.log(`[AdminDB] Created admin alert: ${alertId}`);
      return alertId;
      
    } finally {
      client.release();
    }
  }

  /**
   * ✅ ACKNOWLEDGE ADMIN ALERT
   * Mark alert as acknowledged
   */
  async acknowledgeAdminAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const client = await this.getClient();
    try {
      const query = `
        UPDATE admin_alerts 
        SET acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = $2
        WHERE id = $1 AND acknowledged_at IS NULL
      `;
      
      await client.query(query, [alertId, acknowledgedBy]);
      
      console.log(`[AdminDB] Acknowledged alert ${alertId} by ${acknowledgedBy}`);
      
    } finally {
      client.release();
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * 🔌 GET DATABASE CLIENT
   * Get database client from pool with error handling
   */
  private async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      console.error('[AdminDB] Failed to get database client:', error);
      throw new Error('Database connection failed');
    }
  }

  /**
   * 🔍 EXECUTE PAGINATED QUERY
   * Execute query with pagination support
   */
  async executePaginatedQuery<T>(
    baseQuery: string,
    countQuery: string,
    values: any[],
    options: QueryOptions = {}
  ): Promise<PaginatedResult<T>> {
    const client = await this.getClient();
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const page = Math.floor(offset / limit) + 1;
      
      // Add ORDER BY clause
      let query = baseQuery;
      if (options.orderBy) {
        const direction = options.orderDirection || 'DESC';
        query += ` ORDER BY ${options.orderBy} ${direction}`;
      }
      
      // Add LIMIT and OFFSET
      query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(limit, offset);
      
      // Execute queries in parallel
      const [dataResult, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, values.slice(0, -2)) // Remove LIMIT/OFFSET values
      ]);
      
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);
      
      return {
        data: dataResult.rows,
        total,
        page,
        pageSize: limit,
        totalPages
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * 🧹 CLEANUP OLD DATA
   * Clean up old metrics and logs
   */
  async cleanupOldData(): Promise<{
    auditLogsDeleted: number;
    securityEventsDeleted: number;
    metricsDeleted: number;
  }> {
    const client = await this.getClient();
    try {
      // Clean up old audit logs (90 days, except high risk)
      const auditResult = await client.query(`
        DELETE FROM admin_audit_logs 
        WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days'
        AND risk_level NOT IN ('HIGH', 'CRITICAL')
      `);
      
      // Clean up old security events (30 days, except unresolved critical)
      const securityResult = await client.query(`
        DELETE FROM admin_security_events 
        WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND NOT (severity = 'CRITICAL' AND resolved = false)
      `);
      
      // Clean up old system metrics (7 days)
      const metricsResult = await client.query(`
        DELETE FROM system_metrics 
        WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '7 days'
      `);
      
      const cleanup = {
        auditLogsDeleted: auditResult.rowCount || 0,
        securityEventsDeleted: securityResult.rowCount || 0,
        metricsDeleted: metricsResult.rowCount || 0
      };
      
      console.log('[AdminDB] Cleanup completed:', cleanup);
      return cleanup;
      
    } finally {
      client.release();
    }
  }

  /**
   * 📈 GET DATABASE HEALTH
   * Get database connection and performance metrics
   */
  async getDatabaseHealth(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
    poolSize: number;
    avgQueryTime: number;
    slowQueries: number;
  }> {
    const client = await this.getClient();
    try {
      const statsQuery = `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      const result = await client.query(statsQuery);
      const stats = result.rows[0];
      
      return {
        totalConnections: parseInt(stats.total_connections),
        activeConnections: parseInt(stats.active_connections),
        idleConnections: parseInt(stats.idle_connections),
        waitingClients: this.pool.waitingCount,
        poolSize: this.pool.totalCount,
        avgQueryTime: 0, // Would need pg_stat_statements extension
        slowQueries: 0    // Would need pg_stat_statements extension
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * 🛑 GRACEFUL SHUTDOWN
   * Close all connections gracefully
   */
  async shutdown(): Promise<void> {
    console.log('[AdminDB] Shutting down database service...');
    
    try {
      await this.pool.end();
      await this.redis.quit();
      console.log('[AdminDB] Database service shut down complete');
    } catch (error) {
      console.error('[AdminDB] Shutdown error:', error);
    }
  }
}

// Export singleton instance
export const adminDatabase = new AdminDatabaseService({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fantasy_ai',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000')
});

export default AdminDatabaseService;