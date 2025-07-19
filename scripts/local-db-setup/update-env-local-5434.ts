#!/usr/bin/env tsx
/**
 * Update .env.local to use local PostgreSQL on port 5434
 */

import * as fs from 'fs';
import chalk from 'chalk';

const ENV_FILE = '.env.local';
const BACKUP_FILE = '.env.local.backup-5434';

function updateEnvFile() {
  console.log(chalk.bold.cyan('🔧 Updating .env.local for PostgreSQL on Port 5434'));
  console.log(chalk.gray('='.repeat(50)));
  
  if (!fs.existsSync(ENV_FILE)) {
    console.error(chalk.red('❌ .env.local not found!'));
    console.log('Creating from example...');
    
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', ENV_FILE);
      console.log(chalk.green('✅ Created .env.local from .env.example'));
    } else {
      console.error('Please create .env.local first');
      return;
    }
  }
  
  // Read current env file
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  
  // Create backup
  fs.writeFileSync(BACKUP_FILE, envContent);
  console.log(chalk.green(`✅ Backup created: ${BACKUP_FILE}`));
  
  // Parse current values
  const lines = envContent.split('\n');
  const updatedLines: string[] = [];
  
  // Local database configuration with port 5434
  const localDbConfig = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5434/fantasy_ai_local',
    DIRECT_URL: 'postgresql://postgres:postgres@localhost:5434/fantasy_ai_local',
  };
  
  let foundDatabaseUrl = false;
  
  // Update existing DATABASE_URL or add if missing
  lines.forEach(line => {
    if (line.startsWith('DATABASE_URL=') || line.startsWith('DIRECT_URL=')) {
      // Comment out the Supabase URL
      updatedLines.push(`# Supabase (Cloud) - Commented out for local development`);
      updatedLines.push(`# ${line}`);
      
      // Add local URL
      const key = line.startsWith('DATABASE_URL') ? 'DATABASE_URL' : 'DIRECT_URL';
      updatedLines.push(`${key}=${localDbConfig[key]}`);
      foundDatabaseUrl = true;
    } else {
      updatedLines.push(line);
    }
  });
  
  // Add DATABASE_URL if not found
  if (!foundDatabaseUrl) {
    updatedLines.push('');
    updatedLines.push('# Local PostgreSQL Database (Port 5434)');
    updatedLines.push(`DATABASE_URL=${localDbConfig.DATABASE_URL}`);
    updatedLines.push(`DIRECT_URL=${localDbConfig.DIRECT_URL}`);
  }
  
  // Write updated file
  fs.writeFileSync(ENV_FILE, updatedLines.join('\n'));
  
  console.log(chalk.green('\n✅ .env.local updated for PostgreSQL on port 5434!'));
  console.log('\nLocal connection strings added:');
  console.log(chalk.yellow(`  DATABASE_URL=${localDbConfig.DATABASE_URL}`));
  console.log(chalk.yellow(`  DIRECT_URL=${localDbConfig.DIRECT_URL}`));
  
  console.log(chalk.bold('\n⚠️  IMPORTANT:'));
  console.log('1. PostgreSQL is running on port 5434 (not default 5432)');
  console.log('2. Update password in connection string if you used a different one');
  console.log('3. Original Supabase URLs have been commented out');
  console.log('4. To switch back: restore from ' + BACKUP_FILE);
  
  console.log(chalk.green('\n✅ Configuration complete!'));
}

updateEnvFile();