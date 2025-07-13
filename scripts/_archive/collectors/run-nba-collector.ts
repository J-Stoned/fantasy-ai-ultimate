#!/usr/bin/env tsx
/**
 * 🏀 RUN NBA MASTER COLLECTOR
 * Collects all NBA teams and players from ESPN
 */

import { NBAMasterCollector } from './collectors/nba-master-collector';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runNBACollection() {
  console.log(chalk.bold.cyan('\n🏀 NBA MASTER COLLECTOR\n'));
  console.log(chalk.yellow('This will collect all NBA teams and players from ESPN.'));
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
      console.log(chalk.green('\n✅ Schema verified! Starting NBA collection...\n'));
      
      const collector = new NBAMasterCollector();
      
      collector.collect()
        .then(() => {
          console.log(chalk.bold.green('\n✅ NBA collection completed successfully!'));
          console.log(chalk.cyan('\nNext steps:'));
          console.log(chalk.cyan('1. Verify the data quality'));
          console.log(chalk.cyan('2. Run MLB collector: npx tsx scripts/run-mlb-collector.ts'));
          console.log(chalk.cyan('3. Run NHL collector: npx tsx scripts/run-nhl-collector.ts\n'));
        })
        .catch(error => {
          console.error(chalk.red('\n❌ NBA collection failed:'), error);
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
  runNBACollection();
}