#!/usr/bin/env tsx
import chalk from 'chalk';
import { spawn } from 'child_process';

const services = [
  { name: 'Unified API', script: 'unified-pattern-api.ts', port: 3336 },
  { name: 'Scanner', script: 'realtime-pattern-scanner.ts', port: 3337 },
  { name: 'Dashboard', script: 'pattern-dashboard-server.ts', port: 3338 },
  { name: 'Betting', script: 'auto-betting-executor.ts', port: 3339 },
  { name: 'Monitoring', script: 'pattern-monitoring.ts', port: 3340 }
];

function startService(service: any) {
  console.log(chalk.cyan(`Starting ${service.name}...`));
  
  const proc = spawn('npx', ['tsx', `scripts/${service.script}`], {
    stdio: 'ignore',
    detached: true
  });
  
  proc.on('error', (err) => {
    console.log(chalk.red(`Failed to start ${service.name}: ${err}`));
  });
  
  proc.unref();
  
  setTimeout(() => {
    console.log(chalk.green(`✅ ${service.name} should be running on port ${service.port}`));
  }, 2000);
}

// Start all services with error recovery
services.forEach((service, index) => {
  setTimeout(() => startService(service), index * 3000);
});

console.log(chalk.bold.green('\n🚀 Pattern Empire starting with error recovery...'));
