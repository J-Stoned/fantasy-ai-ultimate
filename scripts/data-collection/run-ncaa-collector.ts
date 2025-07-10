#!/usr/bin/env tsx
/**
 * Run the NCAA Master Collector for draft analysis
 */

import { NCAAMasterCollector } from './collectors/ncaa-master-collector';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

async function main() {
  console.log(chalk.bold.cyan('🎓 STARTING NCAA DATA COLLECTION FOR DRAFT ANALYSIS\n'));
  
  const collector = new NCAAMasterCollector({
    batchSize: 100,
    concurrentLimit: 5
  });
  
  await collector.collect();
  
  console.log(chalk.bold.green('\n✅ NCAA COLLECTION COMPLETE!'));
}

main().catch(console.error);