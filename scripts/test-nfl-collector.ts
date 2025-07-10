#!/usr/bin/env tsx
/**
 * Test the NFL Master Collector
 */

import { NFLMasterCollector } from './collectors/nfl-master-collector';
import { config } from 'dotenv';
import chalk from 'chalk';

// Load environment variables
config({ path: '.env.local' });

async function testNFLCollector() {
  console.log(chalk.bold.cyan('🧪 TESTING NFL MASTER COLLECTOR\n'));
  
  // Initialize collector with test configuration
  const collector = new NFLMasterCollector({
    batchSize: 100, // Smaller batch for testing
    concurrentLimit: 5, // Limit concurrent requests
    retryAttempts: 2
  });
  
  try {
    // Run collection
    await collector.collect();
    
    console.log(chalk.bold.green('\n✅ TEST COMPLETED SUCCESSFULLY!'));
  } catch (error) {
    console.error(chalk.bold.red('\n❌ TEST FAILED:'), error);
    process.exit(1);
  }
}

// Run test
testNFLCollector();