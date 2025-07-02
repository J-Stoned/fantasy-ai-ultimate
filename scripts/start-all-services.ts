#!/usr/bin/env tsx
/**
 * START ALL BACKEND SERVICES
 * 
 * Launches all real-time services:
 * - WebSocket Server (Port 3001)
 * - Continuous Learning AI
 * - Real-Time Event Processor
 * - Data Collectors
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import * as path from 'path';

console.log(chalk.red.bold(`
╔═══════════════════════════════════════════════╗
║       🚀 STARTING ALL SERVICES 🚀             ║
╚═══════════════════════════════════════════════╝
`));

interface Service {
  name: string;
  script: string;
  color: string;
  port?: number;
}

const services: Service[] = [
  {
    name: 'Real-Time Server',
    script: 'scripts/start-realtime-server.ts',
    color: 'blue',
    port: 8080
  },
  {
    name: 'Continuous Learning AI',
    script: 'scripts/continuous-learning-ai.ts',
    color: 'green'
  },
  {
    name: 'Real-Time Event Processor',
    script: 'lib/ml/start-event-processor.ts',
    color: 'yellow'
  },
  {
    name: 'Data Collector V3',
    script: 'scripts/mega-data-collector-v3.ts',
    color: 'magenta'
  }
];

const processes: any[] = [];

function startService(service: Service) {
  console.log(chalk[service.color as any](`\n📦 Starting ${service.name}...`));
  
  const scriptPath = path.join(process.cwd(), service.script);
  const proc = spawn('npx', ['tsx', scriptPath], {
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  
  // Prefix output with service name
  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach((line: string) => {
      console.log(chalk[service.color as any](`[${service.name}]`), line);
    });
  });
  
  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach((line: string) => {
      console.error(chalk.red(`[${service.name} ERROR]`), line);
    });
  });
  
  proc.on('close', (code) => {
    console.log(chalk.red(`[${service.name}] Process exited with code ${code}`));
    
    // Restart service after 5 seconds
    setTimeout(() => {
      console.log(chalk.yellow(`Restarting ${service.name}...`));
      startService(service);
    }, 5000);
  });
  
  processes.push(proc);
  
  if (service.port) {
    console.log(chalk[service.color as any](`✅ ${service.name} starting on port ${service.port}`));
  } else {
    console.log(chalk[service.color as any](`✅ ${service.name} started`));
  }
}

// Start all services
services.forEach((service, index) => {
  // Stagger service starts to avoid conflicts
  setTimeout(() => {
    startService(service);
  }, index * 2000);
});

// Service health check
setInterval(() => {
  console.log(chalk.cyan('\n📊 Service Status:'));
  services.forEach((service, index) => {
    const proc = processes[index];
    if (proc && !proc.killed) {
      console.log(chalk.green(`  ✅ ${service.name}: Running`));
    } else {
      console.log(chalk.red(`  ❌ ${service.name}: Stopped`));
    }
  });
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down all services...'));
  
  processes.forEach((proc, index) => {
    if (proc && !proc.killed) {
      console.log(chalk.red(`Stopping ${services[index].name}...`));
      proc.kill();
    }
  });
  
  setTimeout(() => {
    console.log(chalk.green('✅ All services stopped'));
    process.exit(0);
  }, 2000);
});

console.log(chalk.green.bold(`
✅ Service manager started!

Services will be available at:
- Real-Time WebSocket: ws://localhost:8080
- Next.js App: http://localhost:3000
- Voice Assistant: Available through the app
- ML Predictions: Updated every 30 seconds

Press Ctrl+C to stop all services.
`));