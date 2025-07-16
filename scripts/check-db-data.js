#!/usr/bin/env node

/**
 * Quick database data check script
 * Run with: node scripts/check-db-data.js
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Running comprehensive database data check...\n');

const scriptPath = path.join(__dirname, 'database/checks/check-comprehensive-data.ts');

const child = spawn('npx', ['tsx', scriptPath], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

child.on('error', (error) => {
  console.error('Failed to run database check:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Database check exited with code ${code}`);
    process.exit(code);
  }
});