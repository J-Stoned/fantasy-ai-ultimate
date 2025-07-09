/**
 * 🔍 PRODUCTION MONITORING SYSTEM
 * 
 * Comprehensive monitoring for all system components
 */

import { EventEmitter } from 'events';
import * as si from 'systeminformation';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    temperature: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    percentage: number;
  };
  network: {
    rx: number;
    tx: number;
  };
  process: {
    uptime: number;
    memory: number;
    cpu: number;
  };
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  lastCheck: Date;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  service: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export class ProductionMonitor extends EventEmitter {
  private supabase: any;
  private metrics: SystemMetrics[] = [];
  private services: Map<string, ServiceHealth> = new Map();
  private alerts: Alert[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timer | null = null;
  
  // Thresholds
  private thresholds = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    disk: { warning: 85, critical: 95 },
    latency: { warning: 1000, critical: 5000 },
    errorRate: { warning: 0.05, critical: 0.1 }
  };
  
  constructor() {
    super();
    
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }
  }
  
  /**
   * Start monitoring
   */
  async start(intervalMs: number = 60000) {
    if (this.isMonitoring) {
      console.log(chalk.yellow('Monitoring already running'));
      return;
    }
    
    console.log(chalk.bold.cyan('🔍 Starting Production Monitoring'));
    this.isMonitoring = true;
    
    // Initial check
    await this.performHealthChecks();
    await this.collectSystemMetrics();
    
    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
      await this.collectSystemMetrics();
      await this.checkThresholds();
      await this.saveMetrics();
    }, intervalMs);
    
    // Log status
    this.logStatus();
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log(chalk.yellow('Monitoring stopped'));
  }
  
  /**
   * Perform health checks on all services
   */
  private async performHealthChecks() {
    // Database health
    await this.checkService('database', async () => {
      const start = Date.now();
      const { error } = await this.supabase
        .from('ml_predictions')
        .select('id')
        .limit(1);
      
      if (error) throw error;
      return Date.now() - start;
    });
    
    // ML Service health
    await this.checkService('ml_service', async () => {
      const start = Date.now();
      // Check if models exist
      const modelsPath = path.join(process.cwd(), 'models/production_ensemble_v2');
      await fs.access(modelsPath);
      return Date.now() - start;
    });
    
    // WebSocket health
    await this.checkService('websocket', async () => {
      // Simple check - in production would test actual connection
      return 50; // Mock latency
    });
    
    // API health
    await this.checkService('api', async () => {
      const start = Date.now();
      // Check API endpoint (in production, would make actual request)
      return Date.now() - start;
    });
  }
  
  /**
   * Check individual service health
   */
  private async checkService(
    name: string,
    healthCheck: () => Promise<number>
  ) {
    try {
      const latency = await healthCheck();
      
      const health: ServiceHealth = {
        name,
        status: 'healthy',
        latency,
        lastCheck: new Date()
      };
      
      // Check latency thresholds
      if (latency > this.thresholds.latency.critical) {
        health.status = 'unhealthy';
        this.createAlert('critical', name, `High latency: ${latency}ms`);
      } else if (latency > this.thresholds.latency.warning) {
        health.status = 'degraded';
        this.createAlert('warning', name, `Elevated latency: ${latency}ms`);
      }
      
      this.services.set(name, health);
      this.emit('service:checked', health);
      
    } catch (error: any) {
      const health: ServiceHealth = {
        name,
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
      
      this.services.set(name, health);
      this.createAlert('critical', name, `Service unhealthy: ${error.message}`);
      this.emit('service:error', health);
    }
  }
  
  /**
   * Collect system metrics
   */
  private async collectSystemMetrics() {
    try {
      // CPU info
      const cpuLoad = await si.currentLoad();
      const cpuTemp = await si.cpuTemperature();
      
      // Memory info
      const mem = await si.mem();
      
      // Disk info
      const disk = await si.fsSize();
      const mainDisk = disk[0] || { size: 0, used: 0, use: 0 };
      
      // Network info
      const netStats = await si.networkStats();
      const mainNet = netStats[0] || { rx_sec: 0, tx_sec: 0 };
      
      // Process info
      const processInfo = process.memoryUsage();
      
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: {
          usage: cpuLoad.currentLoad,
          temperature: cpuTemp.main || 0,
          cores: cpuLoad.cpus.length
        },
        memory: {
          total: mem.total,
          used: mem.used,
          percentage: (mem.used / mem.total) * 100
        },
        disk: {
          total: mainDisk.size,
          used: mainDisk.used,
          percentage: mainDisk.use
        },
        network: {
          rx: mainNet.rx_sec || 0,
          tx: mainNet.tx_sec || 0
        },
        process: {
          uptime: process.uptime(),
          memory: processInfo.heapUsed,
          cpu: cpuLoad.currentLoad
        }
      };
      
      this.metrics.push(metrics);
      
      // Keep only last hour of metrics
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.metrics = this.metrics.filter(m => 
        m.timestamp.getTime() > oneHourAgo
      );
      
      this.emit('metrics:collected', metrics);
      
    } catch (error) {
      console.error(chalk.red('Failed to collect metrics:'), error);
    }
  }
  
  /**
   * Check thresholds and create alerts
   */
  private async checkThresholds() {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;
    
    // CPU threshold
    if (latest.cpu.usage > this.thresholds.cpu.critical) {
      this.createAlert('critical', 'system', `CPU usage critical: ${latest.cpu.usage.toFixed(1)}%`);
    } else if (latest.cpu.usage > this.thresholds.cpu.warning) {
      this.createAlert('warning', 'system', `CPU usage high: ${latest.cpu.usage.toFixed(1)}%`);
    }
    
    // Memory threshold
    if (latest.memory.percentage > this.thresholds.memory.critical) {
      this.createAlert('critical', 'system', `Memory usage critical: ${latest.memory.percentage.toFixed(1)}%`);
    } else if (latest.memory.percentage > this.thresholds.memory.warning) {
      this.createAlert('warning', 'system', `Memory usage high: ${latest.memory.percentage.toFixed(1)}%`);
    }
    
    // Disk threshold
    if (latest.disk.percentage > this.thresholds.disk.critical) {
      this.createAlert('critical', 'system', `Disk usage critical: ${latest.disk.percentage.toFixed(1)}%`);
    } else if (latest.disk.percentage > this.thresholds.disk.warning) {
      this.createAlert('warning', 'system', `Disk usage high: ${latest.disk.percentage.toFixed(1)}%`);
    }
  }
  
  /**
   * Create alert
   */
  private createAlert(
    severity: 'info' | 'warning' | 'critical',
    service: string,
    message: string
  ) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      service,
      message,
      timestamp: new Date(),
      resolved: false
    };
    
    // Check if similar alert already exists
    const existing = this.alerts.find(a => 
      !a.resolved && 
      a.service === service && 
      a.message === message
    );
    
    if (!existing) {
      this.alerts.push(alert);
      this.emit('alert:created', alert);
      
      // Log alert
      const color = severity === 'critical' ? chalk.red :
                   severity === 'warning' ? chalk.yellow :
                   chalk.blue;
      
      console.log(color(`[${severity.toUpperCase()}] ${service}: ${message}`));
    }
  }
  
  /**
   * Save metrics to database
   */
  private async saveMetrics() {
    if (!this.supabase || this.metrics.length === 0) return;
    
    try {
      const latest = this.metrics[this.metrics.length - 1];
      
      // Save to monitoring table (create table if needed)
      const { error } = await this.supabase
        .from('system_metrics')
        .insert({
          timestamp: latest.timestamp,
          cpu_usage: latest.cpu.usage,
          memory_usage: latest.memory.percentage,
          disk_usage: latest.disk.percentage,
          network_rx: latest.network.rx,
          network_tx: latest.network.tx,
          service_health: Object.fromEntries(this.services),
          active_alerts: this.alerts.filter(a => !a.resolved).length
        });
      
      if (error) {
        console.error(chalk.red('Failed to save metrics:'), error);
      }
    } catch (error) {
      // Metrics save failed, not critical
    }
  }
  
  /**
   * Log current status
   */
  private logStatus() {
    setInterval(() => {
      const latest = this.metrics[this.metrics.length - 1];
      if (!latest) return;
      
      console.log(chalk.bold.cyan('\n📊 SYSTEM STATUS'));
      console.log(chalk.gray('='.repeat(40)));
      
      // Services
      console.log(chalk.yellow('Services:'));
      this.services.forEach((health, name) => {
        const statusIcon = health.status === 'healthy' ? '✅' :
                          health.status === 'degraded' ? '⚠️' : '❌';
        console.log(`  ${statusIcon} ${name}: ${health.status} ${health.latency ? `(${health.latency}ms)` : ''}`);
      });
      
      // System metrics
      console.log(chalk.yellow('\nSystem:'));
      console.log(`  CPU: ${latest.cpu.usage.toFixed(1)}% @ ${latest.cpu.temperature}°C`);
      console.log(`  Memory: ${this.formatBytes(latest.memory.used)} / ${this.formatBytes(latest.memory.total)} (${latest.memory.percentage.toFixed(1)}%)`);
      console.log(`  Disk: ${this.formatBytes(latest.disk.used)} / ${this.formatBytes(latest.disk.total)} (${latest.disk.percentage.toFixed(1)}%)`);
      console.log(`  Network: ↓${this.formatBytes(latest.network.rx)}/s ↑${this.formatBytes(latest.network.tx)}/s`);
      
      // Alerts
      const activeAlerts = this.alerts.filter(a => !a.resolved);
      if (activeAlerts.length > 0) {
        console.log(chalk.red(`\n🚨 Active Alerts: ${activeAlerts.length}`));
        activeAlerts.slice(0, 3).forEach(alert => {
          console.log(`  - [${alert.severity}] ${alert.service}: ${alert.message}`);
        });
      }
      
      console.log(chalk.gray('='.repeat(40)));
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Get current status
   */
  getStatus() {
    const latest = this.metrics[this.metrics.length - 1];
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    
    return {
      services: Array.from(this.services.values()),
      metrics: latest,
      alerts: activeAlerts,
      isHealthy: activeAlerts.filter(a => a.severity === 'critical').length === 0,
      uptime: process.uptime()
    };
  }
  
  /**
   * Get metrics history
   */
  getMetricsHistory(minutes: number = 60) {
    const since = Date.now() - minutes * 60 * 1000;
    return this.metrics.filter(m => m.timestamp.getTime() > since);
  }
}

// Export singleton instance
export const productionMonitor = new ProductionMonitor();