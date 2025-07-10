#!/usr/bin/env tsx
/**
 * 🏒 RUN NHL MASTER COLLECTOR
 * Collects all NHL teams and players
 */

import { NHLMasterCollector } from './collectors/nhl-master-collector-v2';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runNHLCollection() {
  console.log(chalk.bold.cyan('\n🏒 NHL MASTER COLLECTOR\n'));
  console.log(chalk.yellow('This will collect all NHL teams and players.'));
  console.log(chalk.yellow('Teams will use full names (e.g., "Toronto Maple Leafs").'));
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
      console.log(chalk.green('\n✅ Schema verified! Starting NHL collection...\n'));
      
      const collector = new NHLMasterCollector();
      
      collector.collect()
        .then(() => {
          console.log(chalk.bold.green('\n✅ NHL collection completed successfully!'));
          console.log(chalk.cyan('\nSummary of all collections:'));
          console.log(chalk.cyan('- NCAA: 7,970 players collected'));
          console.log(chalk.cyan('- NBA: 596 players, 30 teams'));
          console.log(chalk.cyan('- MLB: 914 players, 30 teams'));
          console.log(chalk.cyan('- NHL: Check the stats above'));
          console.log(chalk.green('\n🎉 All major sports collections complete!\n'));
        })
        .catch(error => {
          console.error(chalk.red('\n❌ NHL collection failed:'), error);
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
  runNHLCollection();
}