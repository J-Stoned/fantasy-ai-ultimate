#!/usr/bin/env tsx
/**
 * 🚀 RUN PHASE 1: Database Preparation
 * 
 * Orchestrates the complete Phase 1 process:
 * 1. Backup current data
 * 2. Clean database
 * 3. Create new schema
 */

import chalk from 'chalk';
import { DatabaseBackup } from './phase1-backup-database';
import { DatabaseCleanup } from './phase1-clean-database';
import { SchemaCreator } from './phase1-create-schema';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

export class Phase1Runner {
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('\n🚀 PHASE 1: DATABASE PREPARATION\n'));
    console.log(chalk.yellow('This process will:'));
    console.log('  1. Backup current player/team data');
    console.log('  2. Clean the database (remove game/stat data)');
    console.log('  3. Create new standardized schema\n');
    
    const proceed = await question(chalk.cyan('Ready to begin? (yes/no): '));
    if (proceed.toLowerCase() !== 'yes') {
      console.log(chalk.yellow('Phase 1 cancelled.'));
      rl.close();
      return;
    }
    
    try {
      // Step 1: Backup
      console.log(chalk.cyan.bold('\n📦 STEP 1: BACKUP DATABASE'));
      const backup = new DatabaseBackup();
      await backup.run();
      
      // Step 2: Clean
      console.log(chalk.cyan.bold('\n🧹 STEP 2: CLEAN DATABASE'));
      const cleanupConfirm = await question(chalk.red('Delete all game/stat data? (yes/no): '));
      if (cleanupConfirm.toLowerCase() !== 'yes') {
        console.log(chalk.yellow('Cleanup skipped.'));
      } else {
        const cleanup = new DatabaseCleanup(true); // Skip internal confirmation
        await cleanup.run();
      }
      
      // Step 3: Create Schema
      console.log(chalk.cyan.bold('\n🏗️  STEP 3: CREATE NEW SCHEMA'));
      const schema = new SchemaCreator();
      await schema.run();
      
      // Summary
      console.log(chalk.green.bold('\n✅ PHASE 1 COMPLETE!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log('  1. Run Phase 2 to set up collection infrastructure');
      console.log('  2. Run Phase 3 to collect all data');
      console.log('  3. Run Phase 4 for betting data');
      console.log('  4. Run Phase 5 for fantasy scoring\n');
      
    } catch (error) {
      console.error(chalk.red('\n❌ Phase 1 failed:'), error);
      console.log(chalk.yellow('\nCheck the error and try running individual scripts:'));
      console.log('  npm run phase1:backup');
      console.log('  npm run phase1:clean');
      console.log('  npm run phase1:schema\n');
    } finally {
      rl.close();
      // Import and close the pool
      const { pgPool } = await import('../fantasy-ml/config/database');
      await pgPool.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new Phase1Runner();
  runner.run().catch(console.error);
}