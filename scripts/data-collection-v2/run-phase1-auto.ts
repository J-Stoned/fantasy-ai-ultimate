#!/usr/bin/env tsx
/**
 * 🚀 RUN PHASE 1: Database Preparation (Automated)
 * 
 * Runs Phase 1 without interactive prompts
 */

import chalk from 'chalk';
import { DatabaseBackup } from './phase1-backup-database';
import { DatabaseCleanup } from './phase1-clean-database';
import { SchemaCreator } from './phase1-create-schema';
import { pgPool } from '../fantasy-ml/config/database';

export class Phase1AutoRunner {
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('\n🚀 PHASE 1: DATABASE PREPARATION (AUTOMATED)\n'));
    console.log(chalk.yellow('This process will:'));
    console.log('  1. Backup current player/team data');
    console.log('  2. Clean the database (remove game/stat data)');
    console.log('  3. Create new standardized schema\n');
    
    try {
      // Step 1: Backup
      console.log(chalk.cyan.bold('\n📦 STEP 1: BACKUP DATABASE'));
      const backup = new DatabaseBackup();
      await backup.run();
      
      // Step 2: Clean
      console.log(chalk.cyan.bold('\n🧹 STEP 2: CLEAN DATABASE'));
      const cleanup = new DatabaseCleanup(true); // Skip confirmation
      await cleanup.run();
      
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
      throw error;
    } finally {
      await pgPool.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new Phase1AutoRunner();
  runner.run().catch(console.error);
}