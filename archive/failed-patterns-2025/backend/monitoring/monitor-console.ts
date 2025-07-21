#!/usr/bin/env tsx
/**
 * 📊 CONSOLE MONITORING
 * 
 * Simple console-based monitoring output
 */

import chalk from 'chalk';
import { productionMonitor } from '../lib/monitoring/production-monitor';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class ConsoleMonitor {
  private startTime = Date.now();
  private predictionCount = 0;
  private errorCount = 0;
  
  async start() {
    console.log(chalk.bold.cyan('\n📊 FANTASY AI CONSOLE MONITOR'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Setup event listeners
    productionMonitor.on('alert:created', (alert) => {
      this.logAlert(alert);
    });
    
    productionMonitor.on('service:error', (health) => {
      this.errorCount++;
      console.log(chalk.red(`❌ Service Error: ${health.name} - ${health.error}`));
    });
    
    // Start monitoring
    await productionMonitor.start(30000); // Check every 30 seconds
    
    // Initial status
    await this.showFullStatus();
    
    // Show periodic updates
    setInterval(() => this.showQuickStatus(), 60000); // Every minute
    setInterval(() => this.showFullStatus(), 300000); // Every 5 minutes
    
    // Monitor predictions
    this.monitorPredictions();
    
    console.log(chalk.green('\n✅ Monitoring active'));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));
  }
  
  private async showFullStatus() {
    console.log(chalk.bold.cyan('\n📊 SYSTEM STATUS REPORT'));
    console.log(chalk.gray('='.repeat(50)));
    console.log(chalk.gray(`Time: ${new Date().toLocaleString()}`));
    
    const status = productionMonitor.getStatus();
    
    // Service health
    console.log(chalk.yellow('\n🏥 Service Health:'));
    status.services.forEach(service => {
      const icon = service.status === 'healthy' ? '✅' :
                   service.status === 'degraded' ? '⚠️' : '❌';
      console.log(`  ${icon} ${service.name.padEnd(15)} ${service.status.padEnd(10)} ${service.latency ? `${service.latency}ms` : ''}`);
    });
    
    // System metrics
    if (status.metrics) {
      console.log(chalk.yellow('\n💻 System Resources:'));
      console.log(`  CPU Usage:     ${this.getBar(status.metrics.cpu.usage)} ${status.metrics.cpu.usage.toFixed(1)}%`);
      console.log(`  Memory:        ${this.getBar(status.metrics.memory.percentage)} ${status.metrics.memory.percentage.toFixed(1)}%`);
      console.log(`  Disk:          ${this.getBar(status.metrics.disk.percentage)} ${status.metrics.disk.percentage.toFixed(1)}%`);
    }
    
    // Database stats
    await this.showDatabaseStats();
    
    // Active alerts
    if (status.alerts.length > 0) {
      console.log(chalk.red('\n🚨 Active Alerts:'));
      status.alerts.forEach(alert => {
        console.log(`  [${alert.severity}] ${alert.service}: ${alert.message}`);
      });
    }
    
    // Summary
    console.log(chalk.yellow('\n📈 Summary:'));
    console.log(`  Uptime:        ${this.formatUptime(Date.now() - this.startTime)}`);
    console.log(`  Predictions:   ${this.predictionCount}`);
    console.log(`  Errors:        ${this.errorCount}`);
    console.log(`  Health:        ${status.isHealthy ? chalk.green('HEALTHY') : chalk.red('ISSUES DETECTED')}`);
    
    console.log(chalk.gray('='.repeat(50)));
  }
  
  private async showQuickStatus() {
    const status = productionMonitor.getStatus();
    const healthIcon = status.isHealthy ? '✅' : '❌';
    const metrics = status.metrics;
    
    console.log(chalk.gray(
      `[${new Date().toLocaleTimeString()}] ${healthIcon} ` +
      `CPU: ${metrics?.cpu.usage.toFixed(0)}% | ` +
      `Mem: ${metrics?.memory.percentage.toFixed(0)}% | ` +
      `Alerts: ${status.alerts.length} | ` +
      `Predictions: ${this.predictionCount}`
    ));
  }
  
  private async showDatabaseStats() {
    try {
      // Get database statistics
      const { count: totalPredictions } = await supabase
        .from('ml_predictions')
        .select('*', { count: 'exact', head: true });
      
      const { count: todayPredictions } = await supabase
        .from('ml_predictions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]);
      
      const { count: activeGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .in('status', ['scheduled', 'in_progress']);
      
      console.log(chalk.yellow('\n🗄️  Database Stats:'));
      console.log(`  Total Predictions:   ${totalPredictions || 0}`);
      console.log(`  Today's Predictions: ${todayPredictions || 0}`);
      console.log(`  Active Games:        ${activeGames || 0}`);
      
    } catch (error) {
      console.log(chalk.yellow('\n🗄️  Database Stats: Unable to fetch'));
    }
  }
  
  private async monitorPredictions() {
    // Check for new predictions periodically
    setInterval(async () => {
      try {
        const { count } = await supabase
          .from('ml_predictions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 60000).toISOString());
        
        if (count && count > 0) {
          this.predictionCount += count;
          console.log(chalk.green(`🔮 ${count} new predictions made`));
        }
      } catch (error) {
        // Ignore errors in monitoring
      }
    }, 60000);
  }
  
  private logAlert(alert: any) {
    const timestamp = new Date().toLocaleTimeString();
    const icon = alert.severity === 'critical' ? '🔴' :
                 alert.severity === 'warning' ? '🟡' : '🔵';
    
    const color = alert.severity === 'critical' ? chalk.red :
                  alert.severity === 'warning' ? chalk.yellow :
                  chalk.blue;
    
    console.log(color(`\n${icon} [${timestamp}] ALERT: ${alert.service} - ${alert.message}`));
  }
  
  private getBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const color = percentage > 80 ? chalk.red :
                  percentage > 60 ? chalk.yellow :
                  chalk.green;
    
    return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }
  
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }
}

// Start monitoring
const monitor = new ConsoleMonitor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Stopping monitor...'));
  productionMonitor.stop();
  process.exit(0);
});

monitor.start().catch(console.error);