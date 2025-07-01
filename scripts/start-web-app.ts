#!/usr/bin/env tsx
/**
 * WEB APP STARTER
 * Handles common startup issues and ensures the app runs
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

console.log(chalk.cyan.bold('\n🚀 STARTING FANTASY AI ULTIMATE WEB APP'));
console.log(chalk.cyan('=====================================\n'));

// Change to web app directory
const webDir = path.join(process.cwd(), 'apps', 'web');
process.chdir(webDir);

console.log(chalk.yellow('📁 Working directory:'), webDir);

// Check if Next.js is installed
if (!fs.existsSync('node_modules/next')) {
  console.log(chalk.red('❌ Next.js not installed in web app'));
  console.log(chalk.yellow('💡 Run: npm install'));
  process.exit(1);
}

// Start Next.js
console.log(chalk.green('\n✅ Starting Next.js server...'));
console.log(chalk.cyan('🌐 App will be available at: http://localhost:3000\n'));

const next = spawn('npx', ['next', 'dev', '--port', '3000'], {
  stdio: 'inherit',
  shell: true
});

next.on('error', (err) => {
  console.error(chalk.red('❌ Failed to start:'), err);
});

next.on('exit', (code) => {
  if (code !== 0) {
    console.log(chalk.red(`\n❌ Next.js exited with code ${code}`));
    console.log(chalk.yellow('\n💡 Common fixes:'));
    console.log('  1. Make sure port 3000 is not in use');
    console.log('  2. Check .env.local has correct values');
    console.log('  3. Run: npm install');
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down...'));
  next.kill();
  process.exit(0);
});