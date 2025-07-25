/**
 * 🔧 QUEUE WORKERS - BACKGROUND JOB PROCESSORS 🔧
 * Processes all queued jobs for the Fantasy AI Trading Platform
 */

import { queueService, JobTypes } from '../services/queue-service';
import { optimizeLineupWorker } from './optimize-lineup.worker';
import { dataCollectionWorker } from './data-collection.worker';
import { tradingWorker } from './trading.worker';
import { mlWorker } from './ml.worker';
import { maintenanceWorker } from './maintenance.worker';
import { logger } from '../logging/logger';

// Worker configuration
const WORKER_CONFIG = {
  [JobTypes.OPTIMIZE_LINEUP]: {
    processor: optimizeLineupWorker,
    concurrency: 4 // 4 concurrent lineup optimizations
  },
  [JobTypes.BATCH_OPTIMIZE]: {
    processor: optimizeLineupWorker,
    concurrency: 2
  },
  [JobTypes.COLLECT_OWNERSHIP]: {
    processor: dataCollectionWorker,
    concurrency: 2
  },
  [JobTypes.COLLECT_INJURIES]: {
    processor: dataCollectionWorker,
    concurrency: 1
  },
  [JobTypes.COLLECT_WEATHER]: {
    processor: dataCollectionWorker,
    concurrency: 1
  },
  [JobTypes.COLLECT_VEGAS]: {
    processor: dataCollectionWorker,
    concurrency: 1
  },
  [JobTypes.EXECUTE_TRADE]: {
    processor: tradingWorker,
    concurrency: 3 // Multiple trades in parallel
  },
  [JobTypes.MONITOR_POSITIONS]: {
    processor: tradingWorker,
    concurrency: 1
  },
  [JobTypes.CALCULATE_KELLY]: {
    processor: tradingWorker,
    concurrency: 1
  },
  [JobTypes.UPDATE_PREDICTIONS]: {
    processor: mlWorker,
    concurrency: 2
  },
  [JobTypes.TRAIN_MODEL]: {
    processor: mlWorker,
    concurrency: 1 // Heavy computation
  },
  [JobTypes.ENSEMBLE_PREDICT]: {
    processor: mlWorker,
    concurrency: 2
  },
  [JobTypes.CLEANUP_OLD_DATA]: {
    processor: maintenanceWorker,
    concurrency: 1
  },
  [JobTypes.WARM_CACHE]: {
    processor: maintenanceWorker,
    concurrency: 1
  },
  [JobTypes.GENERATE_REPORTS]: {
    processor: maintenanceWorker,
    concurrency: 1
  },
  [JobTypes.PROCESS_LIVE_DATA]: {
    processor: dataCollectionWorker,
    concurrency: 3
  },
  [JobTypes.UPDATE_OWNERSHIP_LIVE]: {
    processor: dataCollectionWorker,
    concurrency: 2
  }
};

// Initialize all workers
export async function initializeWorkers() {
  logger.info('🚀 Initializing queue workers...');
  
  for (const [jobType, config] of Object.entries(WORKER_CONFIG)) {
    try {
      queueService.createWorker(
        jobType as JobTypes,
        config.processor,
        config.concurrency
      );
      logger.info('✅ Worker initialized for ${jobType} (concurrency: ${config.concurrency})');
    } catch (error) {
      logger.error('❌ Failed to initialize worker for ${jobType}:', { error: error });
    }
  }

  // Setup event listeners for monitoring
  queueService.on('job:completed', ({ type, jobId, result }) => {
    logger.info('✅ Job completed: ${type} - ${jobId}');
  });

  queueService.on('job:failed', ({ type, jobId, error }) => {
    logger.error('❌ Job failed: ${type} - ${jobId}:', { error: error });
  });

  queueService.on('worker:stalled', ({ type, jobId }) => {
    logger.warn('⚠️ Job stalled: ${type} - ${jobId}');
  });

  queueService.on('health:check', (health) => {
    if (!health.isHealthy) {
      logger.error('🔴 Queue health check failed:', { error: health });
    }
  });

  logger.info('✅ All workers initialized successfully');
}

// Graceful shutdown
export async function shutdownWorkers() {
  logger.info('🛑 Shutting down workers...');
  await queueService.shutdown();
  logger.info('✅ Workers shut down successfully');
}

// Handle process termination
process.on('SIGINT', shutdownWorkers);
process.on('SIGTERM', shutdownWorkers);

// Export initialization functions
export * from './init';