/**
 * Sync Scheduler for Fantasy League Data
 * Manages automatic synchronization of league data across platforms
 */

import { EventEmitter } from 'events';
import {
import { logger } from '../../logging/logger';
  SyncConfig,
  SyncStatus,
  SyncType,
  FantasyPlatform,
  RetryConfig,
  ApiResponse
} from './types';

interface ScheduledSync {
  config: SyncConfig;
  timer?: NodeJS.Timeout;
  retryCount: number;
  lastError?: Error;
  nextRetryTime?: Date;
}

interface SyncResult {
  success: boolean;
  syncedData?: any;
  error?: Error;
  duration: number;
}

export class SyncScheduler extends EventEmitter {
  private scheduledSyncs: Map<string, ScheduledSync> = new Map();
  private syncStatuses: Map<string, SyncStatus> = new Map();
  private isRunning: boolean = false;
  private syncQueue: string[] = [];
  private activeSyncs: Set<string> = new Set();
  private maxConcurrentSyncs: number = 3;

  constructor() {
    super();
    this.startScheduler();
  }

  /**
   * Start the sync scheduler
   */
  private startScheduler(): void {
    this.isRunning = true;
    this.processSyncQueue();
  }

  /**
   * Stop the sync scheduler
   */
  public stop(): void {
    this.isRunning = false;
    
    // Cancel all scheduled syncs
    this.scheduledSyncs.forEach(sync => {
      if (sync.timer) {
        clearTimeout(sync.timer);
      }
    });
    
    this.scheduledSyncs.clear();
    this.syncStatuses.clear();
    this.syncQueue = [];
    this.activeSyncs.clear();
  }

  /**
   * Schedule a sync for a league
   */
  public async scheduleSync(config: SyncConfig): Promise<void> {
    const syncKey = this.getSyncKey(config.leagueId);
    
    // Cancel existing sync if present
    const existingSync = this.scheduledSyncs.get(syncKey);
    if (existingSync?.timer) {
      clearTimeout(existingSync.timer);
    }

    // Create scheduled sync
    const scheduledSync: ScheduledSync = {
      config,
      retryCount: 0
    };

    this.scheduledSyncs.set(syncKey, scheduledSync);
    
    // Initialize sync status
    this.updateSyncStatus(config.leagueId, {
      leagueId: config.leagueId,
      platform: config.platform,
      lastSync: new Date(),
      nextSync: new Date(Date.now() + config.syncInterval),
      status: 'scheduled',
      syncedData: {}
    });

    // Schedule the first sync
    this.scheduleNextSync(syncKey);
  }

  /**
   * Cancel a scheduled sync
   */
  public cancelSync(leagueId: string): void {
    const syncKey = this.getSyncKey(leagueId);
    const scheduledSync = this.scheduledSyncs.get(syncKey);
    
    if (scheduledSync) {
      if (scheduledSync.timer) {
        clearTimeout(scheduledSync.timer);
      }
      this.scheduledSyncs.delete(syncKey);
      this.syncStatuses.delete(syncKey);
    }

    // Remove from queue if present
    this.syncQueue = this.syncQueue.filter(key => key !== syncKey);
  }

  /**
   * Trigger an immediate sync
   */
  public async triggerSync(leagueId: string, syncTypes?: SyncType[]): Promise<void> {
    const syncKey = this.getSyncKey(leagueId);
    const scheduledSync = this.scheduledSyncs.get(syncKey);
    
    if (!scheduledSync) {
      throw new Error(`No sync configured for league ${leagueId}`);
    }

    // Update sync types if provided
    if (syncTypes) {
      scheduledSync.config.syncTypes = syncTypes;
    }

    // Add to queue with high priority
    this.addToQueue(syncKey, true);
  }

  /**
   * Get sync status for a league
   */
  public async getSyncStatus(leagueId: string): Promise<SyncStatus | null> {
    const syncKey = this.getSyncKey(leagueId);
    return this.syncStatuses.get(syncKey) || null;
  }

  /**
   * Get all sync statuses
   */
  public getAllSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  /**
   * Schedule the next sync for a league
   */
  private scheduleNextSync(syncKey: string): void {
    const scheduledSync = this.scheduledSyncs.get(syncKey);
    if (!scheduledSync || !this.isRunning) {
      return;
    }

    const { config } = scheduledSync;
    let delay = config.syncInterval;

    // If retrying, calculate retry delay
    if (scheduledSync.retryCount > 0 && config.retryConfig) {
      delay = this.calculateRetryDelay(scheduledSync.retryCount, config.retryConfig);
      scheduledSync.nextRetryTime = new Date(Date.now() + delay);
    }

    // Schedule the sync
    scheduledSync.timer = setTimeout(() => {
      this.addToQueue(syncKey);
    }, delay);

    // Update next sync time
    this.updateSyncStatus(config.leagueId, {
      nextSync: new Date(Date.now() + delay)
    });
  }

  /**
   * Add sync to queue
   */
  private addToQueue(syncKey: string, priority: boolean = false): void {
    // Remove if already in queue
    this.syncQueue = this.syncQueue.filter(key => key !== syncKey);
    
    // Add to queue
    if (priority) {
      this.syncQueue.unshift(syncKey);
    } else {
      this.syncQueue.push(syncKey);
    }

    // Process queue
    this.processSyncQueue();
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Check if we can process more syncs
    while (this.syncQueue.length > 0 && this.activeSyncs.size < this.maxConcurrentSyncs) {
      const syncKey = this.syncQueue.shift();
      if (syncKey && !this.activeSyncs.has(syncKey)) {
        this.activeSyncs.add(syncKey);
        this.executeSync(syncKey).finally(() => {
          this.activeSyncs.delete(syncKey);
          this.processSyncQueue();
        });
      }
    }
  }

  /**
   * Execute a sync
   */
  private async executeSync(syncKey: string): Promise<void> {
    const scheduledSync = this.scheduledSyncs.get(syncKey);
    if (!scheduledSync) {
      return;
    }

    const { config } = scheduledSync;
    const startTime = Date.now();

    try {
      // Update status to syncing
      this.updateSyncStatus(config.leagueId, {
        status: 'syncing',
        error: undefined
      });

      // Emit sync start event
      this.emit('sync:start', {
        leagueId: config.leagueId,
        syncTypes: config.syncTypes,
        timestamp: new Date()
      });

      // Execute sync based on types
      const syncResult = await this.performSync(config);

      if (syncResult.success) {
        // Reset retry count on success
        scheduledSync.retryCount = 0;
        scheduledSync.lastError = undefined;

        // Update status
        this.updateSyncStatus(config.leagueId, {
          status: 'idle',
          lastSync: new Date(),
          syncedData: this.updateSyncedData(config)
        });

        // Emit success event
        this.emit('sync:complete', {
          leagueId: config.leagueId,
          syncedData: syncResult.syncedData,
          syncTypes: config.syncTypes,
          timestamp: new Date(),
          duration: syncResult.duration
        });
      } else {
        throw syncResult.error || new Error('Sync failed');
      }
    } catch (error) {
      // Handle sync error
      scheduledSync.retryCount++;
      scheduledSync.lastError = error as Error;

      // Update status
      this.updateSyncStatus(config.leagueId, {
        status: 'error',
        error: (error as Error).message
      });

      // Emit error event
      this.emit('sync:error', {
        leagueId: config.leagueId,
        error: error as Error,
        syncType: config.syncTypes,
        timestamp: new Date(),
        retryCount: scheduledSync.retryCount
      });

      // Check if we should retry
      if (this.shouldRetry(scheduledSync)) {
        logger.info('Scheduling retry ${scheduledSync.retryCount} for league ${config.leagueId}');
      } else {
        console.error(`Max retries reached for league ${config.leagueId}`);
        // Cancel sync after max retries
        this.cancelSync(config.leagueId);
      }
    } finally {
      // Schedule next sync
      if (this.scheduledSyncs.has(syncKey)) {
        this.scheduleNextSync(syncKey);
      }
    }
  }

  /**
   * Perform the actual sync
   */
  private async performSync(config: SyncConfig): Promise<SyncResult> {
    const startTime = Date.now();
    const syncedData: any = {};

    try {
      // This is where the actual sync logic would be implemented
      // It would call the appropriate API client methods based on sync types
      
      if (config.syncTypes.includes('all') || config.syncTypes.includes('roster')) {
        // Sync roster data
        syncedData.roster = await this.syncRosterData(config);
      }

      if (config.syncTypes.includes('all') || config.syncTypes.includes('standings')) {
        // Sync standings data
        syncedData.standings = await this.syncStandingsData(config);
      }

      if (config.syncTypes.includes('all') || config.syncTypes.includes('matchups')) {
        // Sync matchup data
        syncedData.matchups = await this.syncMatchupData(config);
      }

      if (config.syncTypes.includes('all') || config.syncTypes.includes('transactions')) {
        // Sync transaction data
        syncedData.transactions = await this.syncTransactionData(config);
      }

      if (config.syncTypes.includes('all') || config.syncTypes.includes('stats')) {
        // Sync player stats
        syncedData.stats = await this.syncStatsData(config);
      }

      return {
        success: true,
        syncedData,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Sync roster data
   */
  private async syncRosterData(config: SyncConfig): Promise<any> {
    // Placeholder for roster sync logic
    logger.info('Syncing roster data for league ${config.leagueId}');
    return { updated: true, timestamp: new Date() };
  }

  /**
   * Sync standings data
   */
  private async syncStandingsData(config: SyncConfig): Promise<any> {
    // Placeholder for standings sync logic
    logger.info('Syncing standings data for league ${config.leagueId}');
    return { updated: true, timestamp: new Date() };
  }

  /**
   * Sync matchup data
   */
  private async syncMatchupData(config: SyncConfig): Promise<any> {
    // Placeholder for matchup sync logic
    logger.info('Syncing matchup data for league ${config.leagueId}');
    return { updated: true, timestamp: new Date() };
  }

  /**
   * Sync transaction data
   */
  private async syncTransactionData(config: SyncConfig): Promise<any> {
    // Placeholder for transaction sync logic
    logger.info('Syncing transaction data for league ${config.leagueId}');
    return { updated: true, timestamp: new Date() };
  }

  /**
   * Sync stats data
   */
  private async syncStatsData(config: SyncConfig): Promise<any> {
    // Placeholder for stats sync logic
    logger.info('Syncing stats data for league ${config.leagueId}');
    return { updated: true, timestamp: new Date() };
  }

  /**
   * Check if sync should be retried
   */
  private shouldRetry(scheduledSync: ScheduledSync): boolean {
    const { config, retryCount } = scheduledSync;
    
    if (!config.retryConfig) {
      return false;
    }

    return retryCount <= config.retryConfig.maxRetries;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, retryConfig: RetryConfig): number {
    const delay = Math.min(
      retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, retryCount - 1),
      retryConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(leagueId: string, updates: Partial<SyncStatus>): void {
    const syncKey = this.getSyncKey(leagueId);
    const currentStatus = this.syncStatuses.get(syncKey) || {
      leagueId,
      platform: 'yahoo' as FantasyPlatform,
      lastSync: new Date(),
      nextSync: new Date(),
      status: 'idle',
      syncedData: {}
    };

    this.syncStatuses.set(syncKey, {
      ...currentStatus,
      ...updates
    });
  }

  /**
   * Update synced data timestamps
   */
  private updateSyncedData(config: SyncConfig): Record<SyncType, Date> {
    const syncKey = this.getSyncKey(config.leagueId);
    const currentStatus = this.syncStatuses.get(syncKey);
    const syncedData = currentStatus?.syncedData || {};
    const now = new Date();

    config.syncTypes.forEach(type => {
      if (type === 'all') {
        syncedData.roster = now;
        syncedData.standings = now;
        syncedData.matchups = now;
        syncedData.transactions = now;
        syncedData.stats = now;
      } else {
        syncedData[type] = now;
      }
    });

    return syncedData;
  }

  /**
   * Get sync key for a league
   */
  private getSyncKey(leagueId: string): string {
    return `sync_${leagueId}`;
  }

  /**
   * Get sync statistics
   */
  public getSyncStatistics(): SyncStatistics {
    const stats: SyncStatistics = {
      totalScheduled: this.scheduledSyncs.size,
      activeSyncs: this.activeSyncs.size,
      queueLength: this.syncQueue.length,
      syncsByStatus: {
        idle: 0,
        syncing: 0,
        error: 0,
        scheduled: 0
      },
      syncsByPlatform: {
        yahoo: 0,
        espn: 0,
        cbs: 0,
        sleeper: 0
      }
    };

    // Count by status and platform
    this.syncStatuses.forEach(status => {
      stats.syncsByStatus[status.status]++;
      stats.syncsByPlatform[status.platform]++;
    });

    return stats;
  }

  /**
   * Pause all syncs
   */
  public pauseAll(): void {
    this.isRunning = false;
    this.syncQueue = [];
    
    // Cancel all timers but keep configurations
    this.scheduledSyncs.forEach(sync => {
      if (sync.timer) {
        clearTimeout(sync.timer);
        sync.timer = undefined;
      }
    });
  }

  /**
   * Resume all syncs
   */
  public resumeAll(): void {
    this.isRunning = true;
    
    // Reschedule all syncs
    this.scheduledSyncs.forEach((sync, key) => {
      this.scheduleNextSync(key);
    });
    
    // Process any pending syncs
    this.processSyncQueue();
  }

  /**
   * Set max concurrent syncs
   */
  public setMaxConcurrentSyncs(max: number): void {
    this.maxConcurrentSyncs = Math.max(1, max);
    this.processSyncQueue();
  }
}

// Additional types for sync scheduler
interface SyncStatistics {
  totalScheduled: number;
  activeSyncs: number;
  queueLength: number;
  syncsByStatus: Record<string, number>;
  syncsByPlatform: Record<FantasyPlatform, number>;
}