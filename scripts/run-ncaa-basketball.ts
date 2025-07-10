#!/usr/bin/env tsx
/**
 * 🏀 NCAA BASKETBALL COLLECTOR RUNNER
 * Collects NCAA basketball players from top programs
 */

import { NCAAMasterCollector } from './collectors/ncaa-master-collector';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class NCAABasketballCollector extends NCAAMasterCollector {
  async collect(): Promise<void> {
    console.log(chalk.bold.blue('\n🏀 NCAA BASKETBALL COLLECTION STARTING\n'));
    
    try {
      // Only collect college basketball
      await this.collectCollegeBasketball();
      
      this.printStats();
    } catch (error) {
      console.error(chalk.red('Collection failed:'), error);
    } finally {
      this.cleanup();
    }
  }
  
  /**
   * Print collection statistics
   */
  protected printStats(): void {
    console.log(chalk.bold.green('\n📊 NCAA BASKETBALL COLLECTION COMPLETE!'));
    console.log(chalk.green('=' .repeat(50)));
    console.log(chalk.white(`Players created: ${this.stats.playersCreated}`));
    console.log(chalk.white(`Players updated: ${this.stats.playersUpdated}`));
    console.log(chalk.white(`Duplicates avoided: ${this.stats.duplicatesAvoided}`));
    console.log(chalk.white(`Cache hits: ${this.stats.cacheHits}`));
    console.log(chalk.white(`API calls: ${this.stats.apiCalls}`));
    console.log(chalk.white(`Errors: ${this.stats.errors}`));
    
    const duration = (Date.now() - this.stats.startTime) / 1000;
    console.log(chalk.cyan(`\nTime taken: ${duration.toFixed(2)} seconds`));
    
    if (this.stats.playersCreated > 0) {
      console.log(chalk.bold.magenta('\n🎯 Ready for draft analysis!'));
    }
  }
}

// Run the collector
async function run() {
  console.log(chalk.bold.cyan('🏀 Starting NCAA Basketball Collection...'));
  console.log(chalk.cyan('This will collect players from top basketball programs\n'));
  
  const collector = new NCAABasketballCollector();
  
  try {
    await collector.collect();
    console.log(chalk.green('\n✅ NCAA Basketball collection completed successfully!'));
  } catch (error) {
    console.error(chalk.red('\n❌ NCAA Basketball collection failed:'), error);
    process.exit(1);
  }
}

// Execute
run().catch(console.error);