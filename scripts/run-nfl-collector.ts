#!/usr/bin/env tsx
/**
 * Run the NFL Master Collector
 */

import { NFLMasterCollector } from './collectors/nfl-master-collector';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

async function main() {
  console.log(chalk.bold.cyan('🚀 STARTING NFL DATA COLLECTION\n'));
  
  const collector = new NFLMasterCollector({
    batchSize: 500,
    concurrentLimit: 10
  });
  
  await collector.collect();
  
  console.log(chalk.bold.green('\n✅ NFL COLLECTION COMPLETE!'));
}

main().catch(console.error);