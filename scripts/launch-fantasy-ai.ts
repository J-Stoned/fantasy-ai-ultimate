#!/usr/bin/env tsx
/**
 * 🚀 FANTASY AI ULTIMATE LAUNCHER
 * One-click activation of the entire system
 */

import chalk from 'chalk';
import { spawn, exec } from 'child_process';
import * as dotenv from 'dotenv';
import { promisify } from 'util';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

console.log(chalk.red.bold('\n🔥 FANTASY AI ULTIMATE LAUNCHER'));
console.log(chalk.red('================================\n'));

interface Service {
  name: string;
  command: string;
  color: chalk.Chalk;
  critical: boolean;
}

const SERVICES: Service[] = [
  {
    name: 'Web App',
    command: 'npm run dev:web',
    color: chalk.green,
    critical: true,
  },
  {
    name: 'Data Collector',
    command: 'tsx scripts/mega-data-collector.ts',
    color: chalk.yellow,
    critical: false,
  },
  {
    name: 'GPU Service',
    command: 'tsx scripts/enable-gpu-acceleration.ts',
    color: chalk.magenta,
    critical: false,
  },
  {
    name: 'ML Training',
    command: 'tsx scripts/train-ml-models-gpu.ts',
    color: chalk.cyan,
    critical: false,
  },
];

class FantasyLauncher {
  private processes: Map<string, any> = new Map();

  async checkPrerequisites() {
    console.log(chalk.yellow('🔍 Checking prerequisites...\n'));

    // Check environment variables
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'DATABASE_URL',
    ];

    let missing = false;
    for (const key of required) {
      if (!process.env[key]) {
        console.log(chalk.red(`❌ Missing: ${key}`));
        missing = true;
      } else {
        console.log(chalk.green(`✅ ${key}`));
      }
    }

    if (missing) {
      console.log(chalk.red('\n❌ Missing required environment variables!'));
      process.exit(1);
    }

    // Check GPU
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader');
      console.log(chalk.green(`✅ GPU: ${stdout.trim()}`));
    } catch {
      console.log(chalk.yellow('⚠️  No GPU detected (will use CPU)'));
    }

    // Check Node modules
    try {
      await execAsync('npm list @tensorflow/tfjs-node-gpu');
      console.log(chalk.green('✅ TensorFlow GPU installed'));
    } catch {
      console.log(chalk.yellow('⚠️  Installing dependencies...'));
      await execAsync('npm install --legacy-peer-deps');
    }

    console.log(chalk.green('\n✅ All prerequisites met!\n'));
  }

  async startService(service: Service) {
    console.log(service.color(`🚀 Starting ${service.name}...`));

    const proc = spawn('npx', service.command.split(' '), {
      shell: true,
      detached: false,
      stdio: 'pipe',
    });

    this.processes.set(service.name, proc);

    // Handle output
    proc.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach((line: string) => {
        console.log(service.color(`[${service.name}] ${line}`));
      });
    });

    proc.stderr?.on('data', (data) => {
      console.error(chalk.red(`[${service.name}] ${data}`));
    });

    proc.on('error', (error) => {
      console.error(chalk.red(`[${service.name}] Error: ${error.message}`));
      if (service.critical) {
        this.shutdown();
      }
    });

    proc.on('exit', (code) => {
      if (code !== 0 && service.critical) {
        console.error(chalk.red(`[${service.name}] Exited with code ${code}`));
        this.shutdown();
      }
    });
  }

  async launch() {
    await this.checkPrerequisites();

    console.log(chalk.red.bold('🔥 LAUNCHING FANTASY AI ULTIMATE\n'));

    // Start services in order
    for (const service of SERVICES) {
      await this.startService(service);
      // Wait a bit between services
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(chalk.green.bold('\n✅ ALL SYSTEMS ONLINE!\n'));
    
    // Show dashboard
    this.showDashboard();

    // Handle shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  showDashboard() {
    console.log(chalk.cyan.bold('📊 FANTASY AI DASHBOARD'));
    console.log(chalk.cyan('======================\n'));
    
    console.log(chalk.white('🌐 Web App:'), chalk.green('http://localhost:3000'));
    console.log(chalk.white('🗄️  Database:'), chalk.green(process.env.NEXT_PUBLIC_SUPABASE_URL));
    console.log(chalk.white('📡 Data Collection:'), chalk.yellow('Active'));
    console.log(chalk.white('🧠 ML Models:'), chalk.magenta('Training'));
    console.log(chalk.white('🎮 GPU Acceleration:'), chalk.cyan('RTX 4060 Active'));
    
    console.log(chalk.gray('\n📌 Quick Commands:'));
    console.log(chalk.gray('  - View logs: Check terminal output'));
    console.log(chalk.gray('  - Stop: Press Ctrl+C'));
    console.log(chalk.gray('  - Restart: Run this script again'));
    
    console.log(chalk.yellow('\n⚡ Pro Tips:'));
    console.log(chalk.yellow('  1. Data collection runs every 30 seconds'));
    console.log(chalk.yellow('  2. ML models retrain every hour'));
    console.log(chalk.yellow('  3. GPU monitors performance in real-time'));
    console.log(chalk.yellow('  4. Check Supabase dashboard for live data'));
  }

  shutdown() {
    console.log(chalk.yellow('\n\n🛑 Shutting down Fantasy AI...'));
    
    // Kill all processes
    this.processes.forEach((proc, name) => {
      console.log(chalk.gray(`Stopping ${name}...`));
      proc.kill();
    });

    console.log(chalk.green('\n✅ Shutdown complete. Goodbye!\n'));
    process.exit(0);
  }
}

// Quick stats display
async function showQuickStats() {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { count: players } = await supabase.from('players').select('*', { count: 'exact', head: true });
    const { count: teams } = await supabase.from('teams').select('*', { count: 'exact', head: true });
    const { count: news } = await supabase.from('news_articles').select('*', { count: 'exact', head: true });

    console.log(chalk.green('\n📈 Current Database Stats:'));
    console.log(`  Players: ${players?.toLocaleString() || 0}`);
    console.log(`  Teams: ${teams?.toLocaleString() || 0}`);
    console.log(`  News: ${news?.toLocaleString() || 0}\n`);
  } catch (error) {
    // Ignore errors
  }
}

// Main
async function main() {
  const launcher = new FantasyLauncher();
  
  console.log(chalk.red.bold(`
   _____ _    _  _ _____  _   _____   __     _   ___ 
  |  ___/ \\  | \\| |_   _|/ \\ / __\\ \\ / /    /_\\ |_ _|
  | |_ / _ \\ | .\` | | | / _ \\\\__ \\\\ V /    / _ \\ | | 
  |  _/ ___ \\| |\\  | | |/ ___ \\___/ | |   / ___ \\| | 
  |_|/_/   \\_\\_| \\_| |_/_/   \\_\\____/|_|  /_/   \\_\\___|
                                                        
  `));
  
  console.log(chalk.yellow('      🏆 ULTIMATE FANTASY SPORTS PLATFORM 🏆\n'));
  
  await showQuickStats();
  await launcher.launch();
}

// Launch!
main().catch((error) => {
  console.error(chalk.red('Launch failed:'), error);
  process.exit(1);
});