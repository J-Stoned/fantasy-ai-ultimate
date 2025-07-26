#!/usr/bin/env tsx

/**
 * 📊 Database Connection Pool Monitor
 * Monitors connection pool usage and health
 */

import { db, dbConnectionManager } from './connection-manager';
import { logger } from '../logging/logger';
import chalk from 'chalk';

interface PoolMetrics {
  timestamp: Date;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  activeCount: number;
  utilizationPercent: number;
}

class ConnectionPoolMonitor {
  private metrics: PoolMetrics[] = [];
  private readonly maxMetrics = 100;
  private interval: NodeJS.Timeout | null = null;
  
  /**
   * Start monitoring the connection pool
   */
  async start(intervalMs: number = 5000): Promise<void> {
    );
    
    // Initial check
    await this.checkPool();
    
    // Set up interval
    this.interval = setInterval(async () => {
      await this.checkPool();
    }, intervalMs);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      );
      this.printSummary();
      process.exit(0);
    }
  }
  
  /**
   * Check pool status and record metrics
   */
  private async checkPool(): Promise<void> {
    try {
      const stats = await db.getStats();
      
      if (stats.status === 'not_initialized') {
        );
        return;
      }
      
      const activeCount = stats.totalCount - stats.idleCount;
      const utilizationPercent = stats.maxConnections > 0 
        ? (activeCount / stats.maxConnections) * 100 
        : 0;
      
      const metric: PoolMetrics = {
        timestamp: new Date(),
        totalCount: stats.totalCount,
        idleCount: stats.idleCount,
        waitingCount: stats.waitingCount,
        activeCount,
        utilizationPercent,
      };
      
      this.metrics.push(metric);
      if (this.metrics.length > this.maxMetrics) {
        this.metrics.shift();
      }
      
      this.displayStatus(metric, stats.maxConnections);
      this.checkThresholds(metric, stats.maxConnections);
      
    } catch (error) {
      , error);
    }
  }
  
  /**
   * Display current status
   */
  private displayStatus(metric: PoolMetrics, maxConnections: number): void {
    const timestamp = metric.timestamp.toLocaleTimeString();
    const utilization = metric.utilizationPercent.toFixed(1);
    
    // Clear line and display status
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    
    let statusColor = chalk.green;
    if (metric.utilizationPercent > 80) statusColor = chalk.red;
    else if (metric.utilizationPercent > 60) statusColor = chalk.yellow;
    
    process.stdout.write(
      `[${timestamp}] ` +
      statusColor(`Active: ${metric.activeCount}/${maxConnections} (${utilization}%)`) +
      ` | Idle: ${metric.idleCount}` +
      ` | Waiting: ${metric.waitingCount}`
    );
  }
  
  /**
   * Check thresholds and alert if needed
   */
  private checkThresholds(metric: PoolMetrics, maxConnections: number): void {
    // High utilization warning
    if (metric.utilizationPercent > 80) {
      }%`));
      logger.warn('High database connection utilization', {
        utilization: metric.utilizationPercent,
        active: metric.activeCount,
        max: maxConnections,
      });
    }
    
    // Waiting connections warning
    if (metric.waitingCount > 5) {
      );
      logger.warn('Database connections waiting', {
        waiting: metric.waitingCount,
        active: metric.activeCount,
      });
    }
    
    // Connection leak detection
    if (metric.activeCount === maxConnections && metric.idleCount === 0) {
      );
      logger.error('Possible database connection leak detected', {
        active: metric.activeCount,
        max: maxConnections,
      });
    }
  }
  
  /**
   * Print summary statistics
   */
  private printSummary(): void {
    if (this.metrics.length === 0) return;
    
    );
    
    // Calculate averages
    const avgActive = this.metrics.reduce((sum, m) => sum + m.activeCount, 0) / this.metrics.length;
    const avgUtilization = this.metrics.reduce((sum, m) => sum + m.utilizationPercent, 0) / this.metrics.length;
    const maxActive = Math.max(...this.metrics.map(m => m.activeCount));
    const maxWaiting = Math.max(...this.metrics.map(m => m.waitingCount));
    
    }`);
    }%`);
    }
}

/**
 * Run database queries to generate load (for testing)
 */
async function generateTestLoad(): Promise<void> {
  );
  
  const queries = [
    'SELECT * FROM players LIMIT 100',
    'SELECT COUNT(*) FROM player_stats',
    'SELECT * FROM teams',
    'SELECT * FROM games ORDER BY game_date DESC LIMIT 50',
  ];
  
  // Run multiple concurrent queries
  const promises = [];
  for (let i = 0; i < 20; i++) {
    const query = queries[i % queries.length];
    promises.push(
      db.query(query).catch(err => 
        , err.message)
      )
    );
  }
  
  await Promise.all(promises);
  );
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const monitor = new ConnectionPoolMonitor();
  
  if (command === 'test') {
    // Monitor with test load
    await monitor.start(1000); // Check every second
    
    // Generate load periodically
    setInterval(async () => {
      await generateTestLoad();
    }, 10000); // Every 10 seconds
    
  } else {
    // Normal monitoring
    const interval = parseInt(args[0]) || 5000;
    await monitor.start(interval);
  }
}

// Run if called directly
if (require.main === module) {
  );
  main().catch(err => {
    , err);
    process.exit(1);
  });
}

export { ConnectionPoolMonitor };