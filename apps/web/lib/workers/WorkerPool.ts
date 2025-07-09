import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import Bull from 'bull';
import { cache } from '../cache/RedisCache';
import { workerLogger } from '../utils/logger';

interface WorkerTask {
  id: string;
  type: string;
  data: any;
  priority: number;
  retries: number;
  timeout?: number;
}

interface WorkerInstance {
  id: string;
  worker: Worker;
  busy: boolean;
  currentTask?: WorkerTask;
  performance: {
    tasksCompleted: number;
    averageTime: number;
    errors: number;
  };
}

export class WorkerPool extends EventEmitter {
  private workers: Map<string, WorkerInstance> = new Map();
  private taskQueue: Bull.Queue;
  private workerScript: string;
  private maxWorkers: number;
  private minWorkers: number;
  private gpuEnabled: boolean;

  constructor(config: {
    name: string;
    workerScript: string;
    minWorkers?: number;
    maxWorkers?: number;
    gpuEnabled?: boolean;
  }) {
    super();
    this.workerScript = config.workerScript;
    this.minWorkers = config.minWorkers || 5;
    this.maxWorkers = config.maxWorkers || 20;
    this.gpuEnabled = config.gpuEnabled || false;

    // Initialize task queue
    this.taskQueue = new Bull(`worker-pool-${config.name}`, {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });

    this.initialize();
  }

  private async initialize() {
    // Start minimum workers
    for (let i = 0; i < this.minWorkers; i++) {
      await this.spawnWorker();
    }

    // Process queue
    this.taskQueue.process(this.maxWorkers, async (job) => {
      return this.executeTask(job.data);
    });

    // Monitor queue events
    this.taskQueue.on('completed', (job, result) => {
      this.emit('taskCompleted', { jobId: job.id, result });
    });

    this.taskQueue.on('failed', (job, error) => {
      this.emit('taskFailed', { jobId: job.id, error });
    });

    // Auto-scaling based on queue size
    setInterval(() => this.autoScale(), 5000);
  }

  private async spawnWorker(): Promise<string> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const worker = new Worker(this.workerScript, {
      workerData: {
        workerId,
        gpuEnabled: this.gpuEnabled,
      },
    });

    const workerInstance: WorkerInstance = {
      id: workerId,
      worker,
      busy: false,
      performance: {
        tasksCompleted: 0,
        averageTime: 0,
        errors: 0,
      },
    };

    // Worker message handling
    worker.on('message', (message) => {
      if (message.type === 'result') {
        this.handleWorkerResult(workerId, message);
      } else if (message.type === 'error') {
        this.handleWorkerError(workerId, message);
      } else if (message.type === 'metrics') {
        this.updateWorkerMetrics(workerId, message.data);
      }
    });

    worker.on('error', (error) => {
      workerLogger.error('Worker error', { workerId, error });
      workerInstance.performance.errors++;
    });

    worker.on('exit', (code) => {
      workerLogger.info('Worker exited', { workerId, code });
      this.workers.delete(workerId);
      
      // Respawn if below minimum
      if (this.workers.size < this.minWorkers) {
        this.spawnWorker();
      }
    });

    this.workers.set(workerId, workerInstance);
    workerLogger.info('Worker spawned successfully', { workerId });
    
    return workerId;
  }

  async addTask(task: Omit<WorkerTask, 'id' | 'retries'>): Promise<string> {
    const job = await this.taskQueue.add(
      {
        ...task,
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        retries: 0,
      },
      {
        priority: task.priority,
        timeout: task.timeout || 30000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    return job.id.toString();
  }

  private async executeTask(task: WorkerTask): Promise<any> {
    // Find available worker
    const availableWorker = this.findAvailableWorker();
    
    if (!availableWorker) {
      // Scale up if possible
      if (this.workers.size < this.maxWorkers) {
        const newWorkerId = await this.spawnWorker();
        const newWorker = this.workers.get(newWorkerId)!;
        return this.runTaskOnWorker(newWorker, task);
      }
      
      // Wait for available worker
      await this.waitForAvailableWorker();
      return this.executeTask(task);
    }

    return this.runTaskOnWorker(availableWorker, task);
  }

  private async runTaskOnWorker(workerInstance: WorkerInstance, task: WorkerTask): Promise<any> {
    workerInstance.busy = true;
    workerInstance.currentTask = task;
    
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        workerInstance.worker.terminate();
        reject(new Error(`Task ${task.id} timed out`));
      }, task.timeout || 30000);

      const handler = (message: any) => {
        if (message.taskId === task.id) {
          clearTimeout(timeout);
          workerInstance.worker.off('message', handler);
          
          const duration = Date.now() - startTime;
          this.updateWorkerPerformance(workerInstance.id, duration, message.type === 'result');
          
          workerInstance.busy = false;
          workerInstance.currentTask = undefined;

          if (message.type === 'result') {
            resolve(message.data);
          } else {
            reject(new Error(message.error));
          }
        }
      };

      workerInstance.worker.on('message', handler);
      workerInstance.worker.postMessage({ type: 'task', task });
    });
  }

  private findAvailableWorker(): WorkerInstance | null {
    for (const worker of this.workers.values()) {
      if (!worker.busy) {
        return worker;
      }
    }
    return null;
  }

  private async waitForAvailableWorker(timeout = 5000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (this.findAvailableWorker()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('No available workers');
  }

  private handleWorkerResult(workerId: string, message: any) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.performance.tasksCompleted++;
    }
  }

  private handleWorkerError(workerId: string, message: any) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.performance.errors++;
    }
  }

  private updateWorkerMetrics(workerId: string, metrics: any) {
    // Store metrics in cache for monitoring
    cache.set(`worker:metrics:${workerId}`, metrics, 300);
  }

  private updateWorkerPerformance(workerId: string, duration: number, success: boolean) {
    const worker = this.workers.get(workerId);
    if (worker) {
      if (success) {
        const total = worker.performance.tasksCompleted;
        worker.performance.averageTime = 
          (worker.performance.averageTime * total + duration) / (total + 1);
        worker.performance.tasksCompleted++;
      } else {
        worker.performance.errors++;
      }
    }
  }

  private async autoScale() {
    const queueSize = await this.taskQueue.count();
    const busyWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
    const idleWorkers = this.workers.size - busyWorkers;

    // Scale up
    if (queueSize > 10 && idleWorkers < 2 && this.workers.size < this.maxWorkers) {
      const workersToSpawn = Math.min(
        Math.ceil(queueSize / 10),
        this.maxWorkers - this.workers.size
      );
      
      for (let i = 0; i < workersToSpawn; i++) {
        await this.spawnWorker();
      }
    }

    // Scale down
    if (queueSize === 0 && idleWorkers > this.minWorkers) {
      const workersToKill = Math.min(
        idleWorkers - this.minWorkers,
        Math.floor(idleWorkers / 2)
      );

      const idleWorkerIds = Array.from(this.workers.entries())
        .filter(([_, w]) => !w.busy)
        .map(([id]) => id)
        .slice(0, workersToKill);

      for (const workerId of idleWorkerIds) {
        const worker = this.workers.get(workerId);
        if (worker) {
          worker.worker.terminate();
          this.workers.delete(workerId);
        }
      }
    }
  }

  async getStats() {
    const queueStats = await this.taskQueue.getJobCounts();
    const workerStats = Array.from(this.workers.values()).map(w => ({
      id: w.id,
      busy: w.busy,
      currentTask: w.currentTask?.type,
      performance: w.performance,
    }));

    return {
      queue: queueStats,
      workers: {
        total: this.workers.size,
        busy: workerStats.filter(w => w.busy).length,
        idle: workerStats.filter(w => !w.busy).length,
        details: workerStats,
      },
    };
  }

  async shutdown() {
    await this.taskQueue.close();
    
    for (const worker of this.workers.values()) {
      worker.worker.terminate();
    }
    
    this.workers.clear();
  }
}