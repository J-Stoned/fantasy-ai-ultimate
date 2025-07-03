#!/usr/bin/env tsx
/**
 * 🔥 MASTER CONTROL - Manage Everything
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function masterControl() {
  console.log(chalk.red.bold('\n🎮 FANTASY AI MASTER CONTROL\n'));
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'status':
      await showStatus();
      break;
      
    case 'start-all':
      await startAll();
      break;
      
    case 'stop-collectors':
      await stopCollectors();
      break;
      
    case 'train-all':
      await trainAll();
      break;
      
    case 'clean-processes':
      await cleanProcesses();
      break;
      
    default:
      console.log(chalk.cyan('Available commands:'));
      console.log('  status         - Show system status');
      console.log('  start-all      - Start all systems');
      console.log('  stop-collectors - Stop duplicate collectors');
      console.log('  train-all      - Train all ML models');
      console.log('  clean-processes - Kill old processes');
  }
}

async function showStatus() {
  console.log(chalk.yellow('📊 System Status:\n'));
  
  // Database stats
  const { count: players } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: games } = await supabase.from('games').select('*', { count: 'exact', head: true });
  const { count: predictions } = await supabase.from('ml_predictions').select('*', { count: 'exact', head: true });
  
  console.log(`Players: ${players?.toLocaleString() || 0}`);
  console.log(`Games: ${games?.toLocaleString() || 0}`);
  console.log(`Predictions: ${predictions?.toLocaleString() || 0}`);
  
  // Running processes
  const { stdout } = await execAsync('ps aux | grep tsx | grep -v grep | wc -l');
  console.log(`\nRunning processes: ${stdout.trim()}`);
}

async function startAll() {
  console.log(chalk.green('🚀 Starting all systems...\n'));
  
  // Kill any existing processes first
  try {
    await execAsync('pkill -f mega-data-collector.ts');
    await execAsync('pkill -f continuous-learning-ai.ts');
    await execAsync('pkill -f ultimate-dashboard.ts');
    await execAsync('pkill -f production-prediction-service.ts');
  } catch (e) {
    // Ignore if no processes to kill
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  
  // 1. Start ONE mega collector
  console.log('Starting mega collector...');
  execAsync('nohup npx tsx scripts/mega-data-collector.ts > logs/mega-collector.log 2>&1 &');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 2. Start continuous learning AI
  console.log('Starting AI learning system...');
  execAsync('nohup npx tsx scripts/continuous-learning-ai.ts > logs/ai-learning.log 2>&1 &');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 3. Start production prediction service
  console.log('Starting prediction service...');
  execAsync('nohup npx tsx scripts/production-prediction-service.ts > logs/prediction-service.log 2>&1 &');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 4. Start dashboard
  console.log('Starting dashboard...');
  execAsync('nohup npx tsx scripts/ultimate-dashboard.ts > logs/dashboard.log 2>&1 &');
  
  console.log(chalk.green('\n✅ All systems started!'));
}

async function stopCollectors() {
  console.log(chalk.yellow('🛑 Stopping duplicate collectors...\n'));
  
  // Kill all but the most recent collector
  const { stdout } = await execAsync('ps aux | grep collector | grep tsx | grep -v grep | awk \'{print $2}\' | head -n -1');
  const pids = stdout.trim().split('\n').filter(pid => pid);
  
  for (const pid of pids) {
    console.log(`Killing process ${pid}`);
    try {
      await execAsync(`kill ${pid}`);
    } catch (e) {
      // Process might already be dead
    }
  }
  
  console.log(chalk.green(`\n✅ Killed ${pids.length} duplicate collectors`));
}

async function trainAll() {
  console.log(chalk.magenta('🧠 Training all models...\n'));
  
  // 1. Train ML models
  console.log('Training ML models with GPU...');
  await execAsync('npx tsx scripts/train-ml-models-gpu.ts');
  
  // 2. Create voice training if needed
  console.log('Checking voice agent...');
  // Voice training would go here
  
  console.log(chalk.green('\n✅ Training complete!'));
}

async function cleanProcesses() {
  console.log(chalk.red('🧹 Cleaning old processes...\n'));
  
  // Kill all tsx processes older than today
  const { stdout } = await execAsync('ps aux | grep tsx | grep "Jun30" | awk \'{print $2}\'');
  const pids = stdout.trim().split('\n').filter(pid => pid);
  
  for (const pid of pids) {
    console.log(`Killing old process ${pid}`);
    try {
      await execAsync(`kill ${pid}`);
    } catch (e) {
      // Process might already be dead
    }
  }
  
  console.log(chalk.green(`\n✅ Killed ${pids.length} old processes`));
}

// Create logs directory
execAsync('mkdir -p logs').then(() => {
  masterControl().catch(console.error);
});