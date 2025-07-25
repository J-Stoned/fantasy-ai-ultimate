/**
 * 🚀 BULLMQ QUEUE SERVICE - 2025 PRODUCTION READY 🚀
 * High-performance job queue for Fantasy AI Trading Platform
 * Features: Job prioritization, retries, rate limiting, monitoring
 */

import { Queue, Worker, QueueScheduler, Job, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { logger } from '../logging/logger';

// 2025 Best Practice: Typed job definitions
export enum JobTypes {
  // Lineup optimization jobs
  OPTIMIZE_LINEUP = 'optimize_lineup',
  BATCH_OPTIMIZE = 'batch_optimize',
  
  // Data collection jobs
  COLLECT_OWNERSHIP = 'collect_ownership',
  COLLECT_INJURIES = 'collect_injuries',
  COLLECT_WEATHER = 'collect_weather',
  COLLECT_VEGAS = 'collect_vegas',
  
  // ML jobs
  TRAIN_MODEL = 'train_model',
  UPDATE_PREDICTIONS = 'update_predictions',
  ENSEMBLE_PREDICT = 'ensemble_predict',
  
  // Trading jobs
  EXECUTE_TRADE = 'execute_trade',
  MONITOR_POSITIONS = 'monitor_positions',
  CALCULATE_KELLY = 'calculate_kelly',
  
  // Real-time jobs
  PROCESS_LIVE_DATA = 'process_live_data',
  UPDATE_OWNERSHIP_LIVE = 'update_ownership_live',
  
  // Maintenance jobs
  CLEANUP_OLD_DATA = 'cleanup_old_data',
  WARM_CACHE = 'warm_cache',
  GENERATE_REPORTS = 'generate_reports'
}

// Job interfaces
export interface OptimizeLineupJob {
  sport: string;
  contestId: string;
  salaryCap: number;
  strategy: 'gpp' | 'cash';
  constraints?: any;
}

export interface CollectDataJob {
  dataType: 'ownership' | 'injuries' | 'weather' | 'vegas';
  sport: string;
  contestIds?: string[];
}

export interface TradeExecutionJob {
  contestId: string;
  lineup: any;
  entryFee: number;
  platform: 'draftkings' | 'fanduel';
}

// Queue configuration
const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
};

// Job options by type
const JOB_OPTIONS: Record<JobTypes, JobsOptions> = {
  [JobTypes.OPTIMIZE_LINEUP]: {
    priority: 1,
    delay: 0,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 }
  },
  [JobTypes.EXECUTE_TRADE]: {
    priority: 0, // Highest priority
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: false, // Keep for audit
    removeOnFail: false
  },
  [JobTypes.COLLECT_OWNERSHIP]: {
    priority: 2,
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { age: 3600 }, // 1 hour
    removeOnFail: { age: 7200 } // 2 hours
  },
  // Default options for other job types
  ...Object.fromEntries(
    Object.values(JobTypes)
      .filter(type => ![JobTypes.OPTIMIZE_LINEUP, JobTypes.EXECUTE_TRADE, JobTypes.COLLECT_OWNERSHIP].includes(type))
      .map(type => [type, {
        priority: 3,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 }
      }])
  )
};

export class QueueService extends EventEmitter {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private schedulers: Map<string, QueueScheduler> = new Map();
  private redis: Redis;
  private isConnected = false;
  
  // 2025: Performance metrics
  private metrics = {
    jobsProcessed: 0,
    jobsFailed: 0,
    avgProcessingTime: 0,
    activeWorkers: 0
  };

  constructor() {
    super();
    this.redis = new Redis(REDIS_CONNECTION);
    this.setupQueues();
  }

  private async setupQueues() {
    try {
      // Create queues for each job type
      for (const jobType of Object.values(JobTypes)) {
        const queue = new Queue(jobType, {
          connection: this.redis,
          defaultJobOptions: JOB_OPTIONS[jobType]
        });

        // Create scheduler for delayed/repeated jobs
        const scheduler = new QueueScheduler(jobType, {
          connection: this.redis
        });

        this.queues.set(jobType, queue);
        this.schedulers.set(jobType, scheduler);

        // Queue event handlers
        queue.on('completed', (job) => {
          this.metrics.jobsProcessed++;
          this.emit('job:completed', { type: jobType, jobId: job.id, result: job.returnvalue });
        });

        queue.on('failed', (job, err) => {
          this.metrics.jobsFailed++;
          this.emit('job:failed', { type: jobType, jobId: job?.id, error: err.message });
        });
      }

      this.isConnected = true;
      this.emit('connected');
      logger.info('🟢 BullMQ Queue Service initialized');

      // Start health monitoring
      this.startHealthMonitoring();
      
    } catch (error) {
      logger.error('Failed to setup queues:', { error: error });
      throw error;
    }
  }

  // Add job to queue
  async addJob<T = any>(type: JobTypes, data: T, options?: JobsOptions): Promise<Job> {
    const queue = this.queues.get(type);
    if (!queue) {
      throw new Error(`Queue for job type ${type} not found`);
    }

    const jobOptions = {
      ...JOB_OPTIONS[type],
      ...options
    };

    const job = await queue.add(type, data, jobOptions);
    this.emit('job:added', { type, jobId: job.id });
    
    return job;
  }

  // Bulk add jobs
  async addBulkJobs<T = any>(type: JobTypes, jobs: Array<{ data: T; options?: JobsOptions }>): Promise<Job[]> {
    const queue = this.queues.get(type);
    if (!queue) {
      throw new Error(`Queue for job type ${type} not found`);
    }

    const bulkJobs = jobs.map(({ data, options }) => ({
      name: type,
      data,
      opts: { ...JOB_OPTIONS[type], ...options }
    }));

    return await queue.addBulk(bulkJobs);
  }

  // Create worker for job processing
  createWorker<T = any, R = any>(
    type: JobTypes,
    processor: (job: Job<T>) => Promise<R>,
    concurrency = 1
  ): Worker {
    const existingWorker = this.workers.get(type);
    if (existingWorker) {
      return existingWorker;
    }

    const worker = new Worker(
      type,
      async (job) => {
        const start = Date.now();
        try {
          const result = await processor(job);
          const processingTime = Date.now() - start;
          this.updateMetrics(processingTime);
          return result;
        } catch (error) {
          logger.error('Worker error for ${type}:', { error: error });
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency,
        autorun: true
      }
    );

    // Worker event handlers
    worker.on('active', () => {
      this.metrics.activeWorkers++;
      this.emit('worker:active', { type });
    });

    worker.on('completed', (job) => {
      this.emit('worker:completed', { type, jobId: job.id });
    });

    worker.on('failed', (job, err) => {
      this.emit('worker:failed', { type, jobId: job?.id, error: err.message });
    });

    worker.on('stalled', (jobId) => {
      logger.warn('Job ${jobId} stalled in ${type}');
      this.emit('worker:stalled', { type, jobId });
    });

    this.workers.set(type, worker);
    return worker;
  }

  // Schedule recurring jobs
  async scheduleRecurringJob<T = any>(
    type: JobTypes,
    data: T,
    pattern: string, // Cron pattern
    options?: JobsOptions
  ): Promise<void> {
    const queue = this.queues.get(type);
    if (!queue) {
      throw new Error(`Queue for job type ${type} not found`);
    }

    await queue.add(
      `${type}:recurring`,
      data,
      {
        ...JOB_OPTIONS[type],
        ...options,
        repeat: {
          pattern,
          tz: 'America/New_York' // For sports schedules
        }
      }
    );
  }

  // 2025: Priority job lanes
  async addPriorityJob<T = any>(type: JobTypes, data: T, priority: 'critical' | 'high' | 'normal' | 'low'): Promise<Job> {
    const priorityMap = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3
    };

    return this.addJob(type, data, {
      priority: priorityMap[priority],
      lifo: priority === 'critical' // Last in, first out for critical
    });
  }

  // Get job counts
  async getJobCounts(type?: JobTypes): Promise<Record<string, number>> {
    if (type) {
      const queue = this.queues.get(type);
      if (!queue) return {};
      return await queue.getJobCounts();
    }

    const counts: Record<string, any> = {};
    for (const [jobType, queue] of this.queues) {
      counts[jobType] = await queue.getJobCounts();
    }
    return counts;
  }

  // Pause/resume queue
  async pauseQueue(type: JobTypes): Promise<void> {
    const queue = this.queues.get(type);
    if (queue) {
      await queue.pause();
      this.emit('queue:paused', { type });
    }
  }

  async resumeQueue(type: JobTypes): Promise<void> {
    const queue = this.queues.get(type);
    if (queue) {
      await queue.resume();
      this.emit('queue:resumed', { type });
    }
  }

  // Clean old jobs
  async cleanQueue(type: JobTypes, grace: number = 3600000): Promise<void> {
    const queue = this.queues.get(type);
    if (queue) {
      await queue.clean(grace, 100); // Clean jobs older than grace period
    }
  }

  // 2025: Rate limiting
  async addRateLimitedJob<T = any>(
    type: JobTypes,
    data: T,
    rateLimitKey: string,
    maxJobs: number,
    duration: number // milliseconds
  ): Promise<Job | null> {
    const queue = this.queues.get(type);
    if (!queue) return null;

    // Check rate limit
    const key = `ratelimit:${type}:${rateLimitKey}`;
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.pexpire(key, duration);
    }

    if (count > maxJobs) {
      this.emit('job:rateLimited', { type, key: rateLimitKey });
      return null;
    }

    return this.addJob(type, data);
  }

  // Performance metrics
  private updateMetrics(processingTime: number) {
    this.metrics.avgProcessingTime = 
      (this.metrics.avgProcessingTime * 0.9) + (processingTime * 0.1);
  }

  private startHealthMonitoring() {
    setInterval(async () => {
      try {
        const allCounts = await this.getJobCounts();
        const health = {
          isHealthy: true,
          metrics: this.metrics,
          queues: allCounts
        };

        // Check for stalled queues
        for (const [type, counts] of Object.entries(allCounts)) {
          if ((counts as any).stalled > 10) {
            health.isHealthy = false;
            logger.warn('Queue ${type} has ${(counts as any).stalled} stalled jobs');
          }
        }

        this.emit('health:check', health);
      } catch (error) {
        logger.error('Health check failed:', { error: error });
      }
    }, 30000); // Every 30 seconds
  }

  // Get metrics
  getMetrics() {
    return {
      ...this.metrics,
      avgProcessingTime: `${this.metrics.avgProcessingTime.toFixed(2)}ms`,
      successRate: this.metrics.jobsProcessed > 0
        ? ((this.metrics.jobsProcessed / (this.metrics.jobsProcessed + this.metrics.jobsFailed)) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  // Graceful shutdown
  async shutdown() {
    // Close workers first
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close schedulers
    for (const scheduler of this.schedulers.values()) {
      await scheduler.close();
    }

    // Close queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    // Close Redis connection
    await this.redis.quit();
    
    this.isConnected = false;
    this.emit('disconnected');
  }
}

// 2025: Singleton instance
export const queueService = new QueueService();

// 2025: Job creators with type safety
export const jobs = {
  lineup: {
    optimize: (data: OptimizeLineupJob) => 
      queueService.addJob(JobTypes.OPTIMIZE_LINEUP, data),
    
    batchOptimize: (lineups: OptimizeLineupJob[]) =>
      queueService.addBulkJobs(JobTypes.BATCH_OPTIMIZE, 
        lineups.map(data => ({ data }))
      )
  },
  
  data: {
    collectOwnership: (sport: string, contestIds?: string[]) =>
      queueService.addJob(JobTypes.COLLECT_OWNERSHIP, { 
        dataType: 'ownership', 
        sport, 
        contestIds 
      }),
    
    collectInjuries: (sport: string) =>
      queueService.addJob(JobTypes.COLLECT_INJURIES, { 
        dataType: 'injuries', 
        sport 
      })
  },
  
  trading: {
    executeTrade: (trade: TradeExecutionJob) =>
      queueService.addPriorityJob(JobTypes.EXECUTE_TRADE, trade, 'critical'),
    
    monitorPositions: () =>
      queueService.addJob(JobTypes.MONITOR_POSITIONS, {})
  },
  
  ml: {
    updatePredictions: (sport: string) =>
      queueService.addJob(JobTypes.UPDATE_PREDICTIONS, { sport }),
    
    trainModel: (modelType: string, data: any) =>
      queueService.addJob(JobTypes.TRAIN_MODEL, { modelType, data })
  }
};

// 2025: Scheduled jobs setup
export async function setupScheduledJobs() {
  // Collect ownership every 5 minutes during peak hours
  await queueService.scheduleRecurringJob(
    JobTypes.COLLECT_OWNERSHIP,
    { dataType: 'ownership', sport: 'ALL' },
    '*/5 16-23 * * *' // Every 5 minutes from 4 PM to 11 PM
  );

  // Update injuries every 30 minutes
  await queueService.scheduleRecurringJob(
    JobTypes.COLLECT_INJURIES,
    { dataType: 'injuries', sport: 'ALL' },
    '*/30 * * * *'
  );

  // Warm cache every hour
  await queueService.scheduleRecurringJob(
    JobTypes.WARM_CACHE,
    {},
    '0 * * * *'
  );

  // Clean old data daily at 3 AM
  await queueService.scheduleRecurringJob(
    JobTypes.CLEANUP_OLD_DATA,
    { daysToKeep: 30 },
    '0 3 * * *'
  );
}