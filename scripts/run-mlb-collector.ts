#!/usr/bin/env tsx
/**
 * ⚾ RUN MLB MASTER COLLECTOR
 * Collects all MLB teams and players
 */

import { MLBMasterCollector } from './collectors/mlb-master-collector-v2';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMLBCollection() {
  console.log(chalk.bold.cyan('\n⚾ MLB MASTER COLLECTOR\n'));
  console.log(chalk.yellow('This will collect all MLB teams and players.'));
  console.log(chalk.yellow('Teams will use full names (e.g., "New York Yankees").'));
  console.log(chalk.yellow('The collector will handle duplicates using external_id.\n'));
  
  // First run schema verification
  console.log(chalk.yellow('Running schema verification first...\n'));
  const { exec } = require('child_process');
  
  exec('npx tsx scripts/database/verify-schema-before-collection.ts', (error: any, stdout: string, stderr: string) => {
    if (error) {
      console.error(chalk.red('Schema verification failed!'), error);
      process.exit(1);
    }
    
    console.log(stdout);
    
    if (stdout.includes('DATABASE SCHEMA IS COMPATIBLE')) {
      console.log(chalk.green('\n✅ Schema verified! Starting MLB collection...\n'));
      
      const collector = new MLBMasterCollector();
      
      collector.collect()
        .then(() => {
          console.log(chalk.bold.green('\n✅ MLB collection completed successfully!'));
          console.log(chalk.cyan('\nNext steps:'));
          console.log(chalk.cyan('1. Verify the data quality'));
          console.log(chalk.cyan('2. Run NHL collector: npx tsx scripts/run-nhl-collector.ts\n'));
        })
        .catch(error => {
          console.error(chalk.red('\n❌ MLB collection failed:'), error);
          process.exit(1);
        });
    } else {
      console.error(chalk.red('Schema verification failed!'));
      process.exit(1);
    }
  });
}

// Execute
if (require.main === module) {
  runMLBCollection();
}