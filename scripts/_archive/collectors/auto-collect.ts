#!/usr/bin/env tsx
/**
 * AUTO COLLECTOR - Keeps data collection running
 * Monitors and restarts collectors if they crash
 */

import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import * as path from 'path';

console.log(chalk.red.bold('🤖 FANTASY AI AUTO COLLECTOR'));
console.log(chalk.red('=============================\n'));

interface Collector {
  name: string;
  script: string;
  process?: ChildProcess;
  restarts: number;
  lastRestart?: Date;
}

const collectors: Collector[] = [
  {
    name: 'Mega Collector',
    script: 'mega-data-collector.ts',
    restarts: 0
  },
  {
    name: 'Simple Collector', 
    script: 'simple-data-collector.ts',
    restarts: 0
  }
];

function startCollector(collector: Collector) {
  console.log(chalk.yellow(`🚀 Starting ${collector.name}...`));
  
  const scriptPath = path.join(__dirname, collector.script);
  collector.process = spawn('tsx', [scriptPath], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  collector.lastRestart = new Date();
  
  // Log output
  collector.process.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach((line: string) => {
      if (line.includes('TOTAL RECORDS:') || line.includes('collected')) {
        console.log(chalk.green(`[${collector.name}] ${line.trim()}`));
      }
    });
  });
  
  // Log errors but don't crash
  collector.process.stderr?.on('data', (data) => {
    const error = data.toString().trim();
    if (error && !error.includes('401') && !error.includes('404')) {
      console.log(chalk.red(`[${collector.name}] Error: ${error}`));
    }
  });
  
  // Handle exit
  collector.process.on('exit', (code) => {
    console.log(chalk.yellow(`\n⚠️  ${collector.name} exited with code ${code}`));
    collector.restarts++;
    
    // Restart if less than 10 restarts in last hour
    if (collector.restarts < 10) {
      console.log(chalk.cyan(`🔄 Restarting ${collector.name} (attempt ${collector.restarts})...`));
      setTimeout(() => startCollector(collector), 5000);
    } else {
      console.log(chalk.red(`❌ ${collector.name} failed too many times. Stopping.`));
    }
  });
}

// Start all collectors
collectors.forEach(collector => {
  startCollector(collector);
  // Stagger starts
  setTimeout(() => {}, 2000);
});

// Status update every 30 seconds
setInterval(() => {
  console.log(chalk.cyan('\n📊 Collector Status:'));
  collectors.forEach(collector => {
    const status = collector.process && !collector.process.killed ? '✅ Running' : '❌ Stopped';
    const uptime = collector.lastRestart 
      ? Math.floor((Date.now() - collector.lastRestart.getTime()) / 1000 / 60)
      : 0;
    console.log(`  ${collector.name}: ${status} (${uptime}m uptime, ${collector.restarts} restarts)`);
  });
}, 30000);

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down collectors...'));
  collectors.forEach(collector => {
    if (collector.process && !collector.process.killed) {
      collector.process.kill();
    }
  });
  process.exit(0);
});

console.log(chalk.green('\n✅ Auto collector active!'));
console.log(chalk.gray('Monitoring and restarting collectors as needed...\n'));