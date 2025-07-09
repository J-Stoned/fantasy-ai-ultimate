import { CronJob } from 'cron';
import { supabase } from '../supabase/client';
import { Redis } from 'ioredis';
import { cronLogger } from '../utils/logger';

interface JobConfig {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  timezone?: string;
  runOnInit?: boolean;
}

interface JobStatus {
  name: string;
  lastRun: Date | null;
  nextRun: Date | null;
  isRunning: boolean;
  lastError: string | null;
  successCount: number;
  errorCount: number;
}

export class CronManager {
  private jobs: Map<string, CronJob> = new Map();
  private jobStatus: Map<string, JobStatus> = new Map();
  private redis: Redis | null = null;

  constructor() {
    // Initialize Redis for job locking and status tracking
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }
  }

  async registerJob(config: JobConfig) {
    const { name, schedule, handler, timezone = 'America/New_York', runOnInit = false } = config;

    // Initialize job status
    this.jobStatus.set(name, {
      name,
      lastRun: null,
      nextRun: null,
      isRunning: false,
      lastError: null,
      successCount: 0,
      errorCount: 0,
    });

    // Wrap handler with error handling and status tracking
    const wrappedHandler = async () => {
      const status = this.jobStatus.get(name)!;
      
      // Check if job is already running (distributed lock)
      if (status.isRunning) {
        cronLogger.info('Job already running, skipping', { jobName: name });
        return;
      }

      // Acquire distributed lock if Redis is available
      const lockKey = `cron:lock:${name}`;
      const lockAcquired = await this.acquireLock(lockKey);
      
      if (!lockAcquired) {
        cronLogger.warn('Could not acquire lock, another instance may be running', { jobName: name });
        return;
      }

      const startTime = Date.now();
      try {
        cronLogger.info('Starting cron job', { jobName: name });
        status.isRunning = true;
        status.lastRun = new Date();
        
        // Execute the job
        await handler();
        
        const endTime = Date.now();
        status.successCount++;
        status.lastError = null;
        cronLogger.info('Cron job completed', { jobName: name, duration: `${endTime - startTime}ms` });
        
        // Log to database
        await this.logJobRun(name, 'success');
      } catch (error) {
        status.errorCount++;
        status.lastError = error instanceof Error ? error.message : 'Unknown error';
        const errorEndTime = Date.now();
        cronLogger.error('Cron job failed', error, { jobName: name, duration: `${errorEndTime - startTime}ms` });
        
        // Log to database
        await this.logJobRun(name, 'error', status.lastError);
      } finally {
        status.isRunning = false;
        await this.releaseLock(lockKey);
      }
    };

    // Create the cron job
    const job = new CronJob(
      schedule,
      wrappedHandler,
      null,
      true, // Start immediately
      timezone
    );

    this.jobs.set(name, job);
    
    // Update next run time
    const status = this.jobStatus.get(name)!;
    status.nextRun = job.nextDate().toJSDate();

    // Run on init if requested
    if (runOnInit) {
      setTimeout(() => wrappedHandler(), 1000);
    }

    cronLogger.info('Registered cron job', { jobName: name, schedule, timezone });
  }

  async acquireLock(key: string, ttl = 60000): Promise<boolean> {
    if (!this.redis) return true; // No Redis, proceed without lock
    
    try {
      const result = await this.redis.set(key, '1', 'PX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      cronLogger.error('Redis lock error', error);
      return true; // Proceed on Redis error
    }
  }

  async releaseLock(key: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      await this.redis.del(key);
    } catch (error) {
      cronLogger.error('Redis unlock error', error);
    }
  }

  async logJobRun(jobName: string, status: 'success' | 'error', error?: string) {
    try {
      await supabase.from('cron_job_logs').insert({
        job_name: jobName,
        status,
        error_message: error,
        executed_at: new Date().toISOString(),
      });
    } catch (err) {
      cronLogger.error('Failed to log job run', err);
    }
  }

  stopJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      cronLogger.info('Stopped cron job', { jobName: name });
    }
  }

  startJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      const status = this.jobStatus.get(name)!;
      status.nextRun = job.nextDate().toJSDate();
      cronLogger.info('Started cron job', { jobName: name });
    }
  }

  getJobStatus(name: string): JobStatus | undefined {
    return this.jobStatus.get(name);
  }

  getAllJobStatuses(): JobStatus[] {
    return Array.from(this.jobStatus.values());
  }

  async shutdown() {
    cronLogger.info('Shutting down cron manager');
    
    // Stop all jobs
    for (const [name, job] of this.jobs) {
      job.stop();
      cronLogger.info('Stopped job', { jobName: name });
    }

    // Close Redis connection
    if (this.redis) {
      await this.redis.quit();
    }

    this.jobs.clear();
    this.jobStatus.clear();
  }
}

// Singleton instance
export const cronManager = new CronManager();