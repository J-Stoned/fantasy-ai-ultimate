import { Worker, Queue, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';
import * as path from 'path';
import { config } from '../config';
import { logger } from '../logging/logger';

// Redis connection for BullMQ
const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue definitions
export const queues = {
  dataCollection: new Queue('data-collection', { connection: redisConnection }),
  mlProcessing: new Queue('ml-processing', { connection: redisConnection }),
  lineupOptimization: new Queue('lineup-optimization', { connection: redisConnection }),
  trading: new Queue('trading', { connection: redisConnection }),
  maintenance: new Queue('maintenance', { connection: redisConnection }),
};

// Queue schedulers for delayed jobs
const schedulers = {
  dataCollection: new QueueScheduler('data-collection', { connection: redisConnection }),
  mlProcessing: new QueueScheduler('ml-processing', { connection: redisConnection }),
  lineupOptimization: new QueueScheduler('lineup-optimization', { connection: redisConnection }),
  trading: new QueueScheduler('trading', { connection: redisConnection }),
  maintenance: new QueueScheduler('maintenance', { connection: redisConnection }),
};

// Worker initialization
export const initializeWorkers = async () => {
  const workers = [];

  // Data Collection Worker
  const dataCollectionWorker = new Worker(
    'data-collection',
    path.join(__dirname, 'data-collection.worker.js'),
    {
      connection: redisConnection,
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  // ML Processing Worker
  const mlWorker = new Worker(
    'ml-processing',
    path.join(__dirname, 'ml.worker.js'),
    {
      connection: redisConnection,
      concurrency: 3,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 25 },
    }
  );

  // Lineup Optimization Worker
  const lineupWorker = new Worker(
    'lineup-optimization',
    path.join(__dirname, 'optimize-lineup.worker.js'),
    {
      connection: redisConnection,
      concurrency: 10,
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    }
  );

  // Trading Worker
  const tradingWorker = new Worker(
    'trading',
    path.join(__dirname, 'trading.worker.js'),
    {
      connection: redisConnection,
      concurrency: 2,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 25 },
    }
  );

  // Maintenance Worker
  const maintenanceWorker = new Worker(
    'maintenance',
    path.join(__dirname, 'maintenance.worker.js'),
    {
      connection: redisConnection,
      concurrency: 1,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 5 },
    }
  );

  // Error handling for all workers
  const handleWorkerError = (workerName: string) => (error: Error) => {
    logger.error('[${workerName}] Worker error:', { error: error });
  };

  dataCollectionWorker.on('error', handleWorkerError('DataCollection'));
  mlWorker.on('error', handleWorkerError('ML'));
  lineupWorker.on('error', handleWorkerError('Lineup'));
  tradingWorker.on('error', handleWorkerError('Trading'));
  maintenanceWorker.on('error', handleWorkerError('Maintenance'));

  workers.push(dataCollectionWorker, mlWorker, lineupWorker, tradingWorker, maintenanceWorker);

  logger.info('Workers initialized successfully');
  return workers;
};

// Scheduled jobs
export const scheduleJobs = async () => {
  // Schedule data collection every 5 minutes
  await queues.dataCollection.add(
    'collect-live-data',
    { type: 'live-scores' },
    { repeat: { every: 5 * 60 * 1000 } }
  );

  // Schedule player stats update every hour
  await queues.dataCollection.add(
    'update-player-stats',
    { type: 'player-stats' },
    { repeat: { every: 60 * 60 * 1000 } }
  );

  // Schedule injury updates every 30 minutes
  await queues.dataCollection.add(
    'update-injuries',
    { type: 'injuries' },
    { repeat: { every: 30 * 60 * 1000 } }
  );

  // Schedule ownership data collection before lock times
  await queues.dataCollection.add(
    'collect-ownership',
    { type: 'ownership' },
    { repeat: { cron: '0 18 * * *' } } // 6 PM daily
  );

  // Schedule ML model retraining weekly
  await queues.mlProcessing.add(
    'retrain-models',
    { type: 'full-retrain' },
    { repeat: { cron: '0 3 * * 0' } } // 3 AM Sunday
  );

  // Schedule database maintenance daily
  await queues.maintenance.add(
    'database-cleanup',
    { type: 'cleanup' },
    { repeat: { cron: '0 2 * * *' } } // 2 AM daily
  );

  logger.info('Scheduled jobs initialized');
};

// Graceful shutdown
export const gracefulShutdown = async () => {
  logger.info('Shutting down workers...');
  
  // Close all schedulers
  await Promise.all(Object.values(schedulers).map(scheduler => scheduler.close()));
  
  // Close all queues
  await Promise.all(Object.values(queues).map(queue => queue.close()));
  
  // Close Redis connection
  await redisConnection.quit();
  
  logger.info('Workers shut down successfully');
};

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);