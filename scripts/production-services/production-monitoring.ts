#!/usr/bin/env tsx
/**
 * 🔍 PRODUCTION MONITORING SERVICE
 * 
 * Monitors all system components and health
 */

import chalk from 'chalk';
import { productionMonitor } from '../lib/monitoring/production-monitor';
import { predictionBroadcaster } from '../lib/realtime/prediction-broadcaster';
import blessed from 'blessed';
import contrib from 'blessed-contrib';

class MonitoringDashboard {
  private screen: blessed.Widgets.Screen;
  private grid: any;
  private widgets: {
    statusTable: any;
    cpuLine: any;
    memoryGauge: any;
    alertsList: blessed.Widgets.Log;
    metricsTable: any;
    networkSparkline: any;
  };
  
  constructor() {
    this.initializeUI();
    this.setupMonitoring();
  }
  
  private initializeUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Fantasy AI Production Monitor'
    });
    
    // Create grid
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
    
    // Title
    this.grid.set(0, 0, 1, 12, blessed.box, {
      content: ' 🔍 FANTASY AI PRODUCTION MONITOR ',
      style: {
        fg: 'white',
        bold: true,
        border: { fg: 'cyan' }
      }
    });
    
    // Service status table
    this.widgets.statusTable = this.grid.set(1, 0, 3, 6, contrib.table, {
      label: ' Service Health ',
      columnSpacing: 2,
      columnWidth: [20, 12, 10],
      style: {
        border: { fg: 'green' }
      }
    });
    
    // CPU usage line chart
    this.widgets.cpuLine = this.grid.set(1, 6, 3, 6, contrib.line, {
      label: ' CPU Usage ',
      showLegend: false,
      wholeNumbersOnly: false,
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black'
      }
    });
    
    // Memory gauge
    this.widgets.memoryGauge = this.grid.set(4, 0, 3, 3, contrib.gauge, {
      label: ' Memory ',
      percent: 0,
      stroke: 'green',
      fill: 'white'
    });
    
    // Network sparkline
    this.widgets.networkSparkline = this.grid.set(4, 3, 3, 3, contrib.sparkline, {
      label: ' Network I/O ',
      tags: true,
      style: {
        fg: 'blue'
      }
    });
    
    // Metrics table
    this.widgets.metricsTable = this.grid.set(4, 6, 3, 6, contrib.table, {
      label: ' System Metrics ',
      columnSpacing: 2,
      columnWidth: [15, 20],
      style: {
        border: { fg: 'magenta' }
      }
    });
    
    // Alerts log
    this.widgets.alertsList = this.grid.set(7, 0, 5, 12, blessed.log, {
      label: ' Alerts & Events ',
      scrollable: true,
      alwaysScroll: true,
      style: {
        border: { fg: 'red' }
      }
    });
    
    // Quit on q or Ctrl-C
    this.screen.key(['q', 'C-c'], () => {
      productionMonitor.stop();
      process.exit(0);
    });
    
    // Initial render
    this.screen.render();
  }
  
  private async setupMonitoring() {
    // Initialize WebSocket broadcaster
    await predictionBroadcaster.initialize();
    
    // Setup event listeners
    productionMonitor.on('service:checked', (health) => {
      this.updateServiceStatus();
    });
    
    productionMonitor.on('metrics:collected', (metrics) => {
      this.updateMetrics(metrics);
    });
    
    productionMonitor.on('alert:created', (alert) => {
      this.addAlert(alert);
    });
    
    // Start monitoring
    await productionMonitor.start(10000); // Check every 10 seconds
    
    // Update UI periodically
    setInterval(() => {
      this.updateUI();
    }, 1000);
  }
  
  private updateServiceStatus() {
    const status = productionMonitor.getStatus();
    
    const tableData = {
      headers: ['Service', 'Status', 'Latency'],
      data: status.services.map(s => [
        s.name,
        this.getStatusIcon(s.status) + ' ' + s.status,
        s.latency ? `${s.latency}ms` : '-'
      ])
    };
    
    this.widgets.statusTable.setData(tableData);
  }
  
  private updateMetrics(metrics: any) {
    // Update CPU chart
    const history = productionMonitor.getMetricsHistory(10);
    const cpuData = history.map((m, i) => [i, m.cpu.usage]);
    
    this.widgets.cpuLine.setData([{
      title: 'CPU %',
      x: cpuData.map((_, i) => i.toString()),
      y: cpuData.map(d => d[1])
    }]);
    
    // Update memory gauge
    this.widgets.memoryGauge.setPercent(Math.round(metrics.memory.percentage));
    
    // Update network sparkline
    const networkData = history.map(m => m.network.rx + m.network.tx);
    this.widgets.networkSparkline.setData(
      ['Network'],
      [networkData]
    );
    
    // Update metrics table
    const metricsData = {
      headers: ['Metric', 'Value'],
      data: [
        ['CPU Usage', `${metrics.cpu.usage.toFixed(1)}%`],
        ['CPU Temperature', `${metrics.cpu.temperature}°C`],
        ['Memory Used', this.formatBytes(metrics.memory.used)],
        ['Disk Usage', `${metrics.disk.percentage.toFixed(1)}%`],
        ['Uptime', this.formatUptime(metrics.process.uptime)],
        ['Process Memory', this.formatBytes(metrics.process.memory)]
      ]
    };
    
    this.widgets.metricsTable.setData(metricsData);
  }
  
  private addAlert(alert: any) {
    const timestamp = new Date().toLocaleTimeString();
    const icon = alert.severity === 'critical' ? '🔴' :
                 alert.severity === 'warning' ? '🟡' : '🔵';
    
    const message = `[${timestamp}] ${icon} ${alert.service}: ${alert.message}`;
    
    this.widgets.alertsList.log(
      alert.severity === 'critical' ? chalk.red(message) :
      alert.severity === 'warning' ? chalk.yellow(message) :
      chalk.blue(message)
    );
    
    // Broadcast critical alerts
    if (alert.severity === 'critical' && predictionBroadcaster.isAvailable()) {
      predictionBroadcaster.broadcastModelUpdate(0, 'system_alert');
    }
  }
  
  private updateUI() {
    this.screen.render();
  }
  
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  }
  
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

// Main execution
async function main() {
  console.log(chalk.bold.cyan('🔍 PRODUCTION MONITORING SERVICE'));
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.yellow('Initializing monitoring dashboard...'));
  
  try {
    const dashboard = new MonitoringDashboard();
    
    console.log(chalk.green('✅ Monitoring dashboard started'));
    console.log(chalk.gray('Press q to quit'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start monitoring:'), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down monitoring...'));
  productionMonitor.stop();
  process.exit(0);
});

main().catch(console.error);