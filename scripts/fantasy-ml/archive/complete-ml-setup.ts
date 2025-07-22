#!/usr/bin/env tsx
/**
 * 🚀 Complete ML System Setup
 * One command to set up everything for the ML system
 */

import chalk from 'chalk';
import { spawn } from 'child_process';

const steps = [
  {
    name: '🗄️  Setting up ML tables',
    command: 'npx',
    args: ['tsx', 'scripts/fantasy-ml/setup-ml-tables-simple.ts']
  },
  {
    name: '🔄 Migrating existing data',
    command: 'npx',
    args: ['tsx', 'scripts/fantasy-ml/migrate-data-simple.ts']
  },
  {
    name: '🔍 Checking ML data',
    command: 'npm',
    args: ['run', 'fantasy:check-data']
  },
  {
    name: '🚀 Running ML pipeline',
    command: 'npm',
    args: ['run', 'fantasy:pipeline']
  }
];

async function runStep(step: typeof steps[0]): Promise<boolean> {
  console.log(chalk.cyan.bold(`\n${step.name}\n`));
  
  return new Promise((resolve) => {
    const proc = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: true
    });
    
    proc.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ ${step.name} completed`));
        resolve(true);
      } else {
        console.log(chalk.yellow(`⚠️  ${step.name} had issues (code: ${code})`));
        resolve(false);
      }
    });
    
    proc.on('error', (error) => {
      console.error(chalk.red(`❌ Error in ${step.name}:`), error);
      resolve(false);
    });
  });
}

async function completeMLSetup() {
  console.log(chalk.cyan.bold('\n🎯 Complete ML System Setup\n'));
  console.log(chalk.yellow('This will:'));
  console.log('  1. Create all ML database tables');
  console.log('  2. Migrate existing data to ML schema');
  console.log('  3. Verify data availability');
  console.log('  4. Train models and start API');
  console.log('');
  
  let allSuccess = true;
  
  for (const step of steps) {
    const success = await runStep(step);
    if (!success && step.name.includes('schema')) {
      console.log(chalk.red('\n❌ Schema setup failed. Cannot continue.'));
      process.exit(1);
    }
    allSuccess = allSuccess && success;
  }
  
  if (allSuccess) {
    console.log(chalk.green.bold('\n✅ ML system setup complete!'));
    console.log(chalk.cyan('\n🎉 Your Fantasy ML system is now ready to use!'));
    console.log(chalk.cyan('📌 API running at: http://localhost:3338'));
  } else {
    console.log(chalk.yellow('\n⚠️  Setup completed with some warnings.'));
    console.log(chalk.yellow('Check the logs above for details.'));
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Setup interrupted...'));
  process.exit(0);
});

// Run setup
completeMLSetup();