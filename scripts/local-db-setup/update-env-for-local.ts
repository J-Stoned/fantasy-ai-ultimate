#!/usr/bin/env tsx
import * as fs from 'fs';
import chalk from 'chalk';

const ENV_FILE = '.env.local';

// Read current env file
const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
const lines = envContent.split('\n');
const updatedLines: string[] = [];

// Update DATABASE_URL to use local PostgreSQL
lines.forEach(line => {
  if (line.startsWith('DATABASE_URL=') && !line.includes('localhost')) {
    // Comment out Supabase URL
    updatedLines.push('# Supabase URL (commented for local development)');
    updatedLines.push(`# ${line}`);
    // Add local URL
    updatedLines.push('DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fantasy_ai_local');
  } else if (line.startsWith('DIRECT_URL=') && !line.includes('localhost')) {
    // Comment out Supabase direct URL
    updatedLines.push(`# ${line}`);
    // Add local URL
    updatedLines.push('DIRECT_URL=postgresql://postgres:postgres@localhost:5432/fantasy_ai_local');
  } else {
    updatedLines.push(line);
  }
});

// Write updated file
fs.writeFileSync(ENV_FILE, updatedLines.join('\n'));

console.log(chalk.green('✅ Updated .env.local to use local PostgreSQL!'));
console.log(chalk.yellow('\nNew connection strings:'));
console.log('DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fantasy_ai_local');
console.log('DIRECT_URL=postgresql://postgres:postgres@localhost:5432/fantasy_ai_local');