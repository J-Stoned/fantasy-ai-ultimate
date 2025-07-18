#!/usr/bin/env tsx
/**
 * 🚀 COLLECT ALL 2021 SPORTS - ULTIMATE TURBO MODE 🚀
 * 
 * Runs ALL sports collection in PARALLEL using all 12 CPU threads
 * Expected: Complete ALL sports in < 30 minutes
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import os from 'os';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SportTask {
  sport: string;
  displayName: string;
  expectedGames: number;
  expectedStats: number;
  thread: number;
}

const SPORTS_TASKS: SportTask[] = [
  { sport: 'nba', displayName: 'NBA 2021', expectedGames: 1315, expectedStats: 25000, thread: 1 },
  { sport: 'mlb', displayName: 'MLB 2021', expectedGames: 2470, expectedStats: 60000, thread: 2 },
  { sport: 'nhl', displayName: 'NHL 2021', expectedGames: 953, expectedStats: 18000, thread: 3 },
  { sport: 'ncaa_fb', displayName: 'NCAA FB 2021', expectedGames: 800, expectedStats: 40000, thread: 4 },
  { sport: 'ncaa_bb', displayName: 'NCAA BB 2021', expectedGames: 5000, expectedStats: 40000, thread: 5 }
];

class TurboCollectorOrchestrator {
  private startTime = Date.now();
  private multiBar: any;
  private progressBars = new Map<string, any>();
  private completed = new Set<string>();
  private stats = {
    totalGames: 0,
    totalPlayers: 0,
    totalStats: 0,
    totalTime: 0
  };

  constructor() {
    this.multiBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{sport} |{bar}| {percentage}% | {status} | {eta_formatted} remaining'
    }, cliProgress.Presets.shades_classic);
  }

  async runAllSportsParallel() {
    console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║          🚀 2021 SEASON COLLECTION - TURBO MODE 🚀            ║
║                                                               ║
║  CPU: ${os.cpus().length} threads | RAM: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB | Target: ALL SPORTS      ║
╚═══════════════════════════════════════════════════════════════╝
    `));

    console.log(chalk.cyan('📊 Collection Plan:'));
    SPORTS_TASKS.forEach(task => {
      console.log(chalk.white(`   • ${task.displayName}: ~${task.expectedGames.toLocaleString()} games, ~${task.expectedStats.toLocaleString()} stats`));
    });
    console.log('');

    // Get initial database counts
    await this.getInitialCounts();

    // Create progress bars for each sport
    SPORTS_TASKS.forEach(task => {
      const bar = this.multiBar.create(100, 0, { 
        sport: task.displayName.padEnd(12), 
        status: 'Starting...',
        eta_formatted: 'calculating'
      });
      this.progressBars.set(task.sport, bar);
    });

    // Launch all sports collections in parallel
    const collectionPromises = SPORTS_TASKS.map(task => this.collectSport(task));

    // Monitor system resources
    const monitorInterval = setInterval(() => {
      this.displaySystemStats();
    }, 5000);

    try {
      // Wait for all collections to complete
      await Promise.all(collectionPromises);
      
      clearInterval(monitorInterval);
      this.multiBar.stop();
      
      // Display final results
      await this.displayFinalResults();
      
    } catch (error) {
      clearInterval(monitorInterval);
      this.multiBar.stop();
      console.error(chalk.red('Error during parallel collection:'), error);
    }
  }

  private async collectSport(task: SportTask): Promise<void> {
    return new Promise((resolve, reject) => {
      const progressBar = this.progressBars.get(task.sport);
      
      // Set CPU affinity for load balancing
      const env = {
        ...process.env,
        UV_THREADPOOL_SIZE: '4', // Each process gets 4 threads
        NODE_OPTIONS: `--max-old-space-size=4096` // 4GB heap per process
      };

      // Spawn child process for this sport
      const child = spawn('npx', [
        'tsx',
        'scripts/universal-sports-collector-turbo.ts',
        'all',
        task.sport,
        '--historical',
        '--year',
        '2021',
        '--enrich'
      ], {
        env,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let lastUpdate = Date.now();
      let currentPhase = 'Initializing';
      let collectedStats = { games: 0, players: 0, stats: 0 };

      // Parse output to update progress
      child.stdout.on('data', (data) => {
        const output = data.toString();
        
        // Parse collection progress
        if (output.includes('Collected') && output.includes('games')) {
          const match = output.match(/Collected (\d+) .*games/);
          if (match) collectedStats.games = parseInt(match[1]);
          currentPhase = 'Games collected';
        } else if (output.includes('Collected') && output.includes('players')) {
          const match = output.match(/Collected (\d+) .*players/);
          if (match) collectedStats.players = parseInt(match[1]);
          currentPhase = 'Players collected';
        } else if (output.includes('stats/second')) {
          const match = output.match(/(\d+) stats\/second/);
          if (match) {
            const statsPerSec = parseInt(match[1]);
            currentPhase = `Collecting stats (${statsPerSec} stats/sec)`;
          }
        } else if (output.includes('Collected') && output.includes('stats')) {
          const match = output.match(/Collected ([\d,]+) .*stats/);
          if (match) {
            collectedStats.stats = parseInt(match[1].replace(/,/g, ''));
            currentPhase = 'Stats collected';
          }
        } else if (output.includes('TURBO COLLECTION COMPLETE')) {
          currentPhase = 'Complete!';
          progressBar.update(100, { status: currentPhase });
        }

        // Update progress bar
        if (Date.now() - lastUpdate > 100) { // Update every 100ms
          const progress = this.calculateProgress(collectedStats, task);
          const etaSeconds = this.calculateETA(progress, task);
          progressBar.update(progress, { 
            status: currentPhase,
            eta_formatted: this.formatETA(etaSeconds)
          });
          lastUpdate = Date.now();
        }

        // Also print the output
        process.stdout.write(chalk.gray(`[${task.displayName}] `) + output);
      });

      child.stderr.on('data', (data) => {
        process.stderr.write(chalk.red(`[${task.displayName}] `) + data);
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.completed.add(task.sport);
          progressBar.update(100, { status: 'Complete!', eta_formatted: 'done' });
          resolve();
        } else {
          progressBar.update(progressBar.value, { status: 'Failed!', eta_formatted: 'error' });
          reject(new Error(`${task.sport} collection failed with code ${code}`));
        }
      });

      child.on('error', (err) => {
        progressBar.update(progressBar.value, { status: 'Error!', eta_formatted: 'error' });
        reject(err);
      });
    });
  }

  private calculateProgress(collected: any, task: SportTask): number {
    // Weight: 20% games, 20% players, 60% stats
    const gamesProgress = Math.min(100, (collected.games / (task.expectedGames * 0.2)) * 20);
    const playersProgress = Math.min(100, (collected.players / (task.expectedGames * 2)) * 20); // Rough estimate
    const statsProgress = Math.min(100, (collected.stats / task.expectedStats) * 60);
    
    return Math.round(gamesProgress + playersProgress + statsProgress);
  }

  private calculateETA(progress: number, task: SportTask): number {
    if (progress === 0) return 0;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const estimatedTotal = elapsed / (progress / 100);
    return Math.max(0, estimatedTotal - elapsed);
  }

  private formatETA(seconds: number): string {
    if (seconds === 0) return 'calculating';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  private displaySystemStats() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    // Update title with system stats
    process.stdout.write(`\x1b]0;TURBO Collection | CPU: ${Math.round((cpuUsage.user + cpuUsage.system) / 1000000)}s | RAM: ${Math.round((totalMem - freeMem) / (1024 * 1024 * 1024))}GB / ${Math.round(totalMem / (1024 * 1024 * 1024))}GB\x07`);
  }

  private async getInitialCounts() {
    const queries = [
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('sport', 'NBA').gte('start_time', '2020-12-01').lte('start_time', '2021-08-01'),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('sport', 'MLB').gte('start_time', '2021-03-01').lte('start_time', '2021-11-30'),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('sport', 'NHL').gte('start_time', '2021-01-01').lte('start_time', '2021-08-01'),
      supabase.from('player_game_logs').select('*', { count: 'exact', head: true })
    ];

    const results = await Promise.all(queries);
    console.log(chalk.yellow('\n📊 Initial Database State:'));
    console.log(chalk.white(`   NBA 2021 games: ${results[0].count || 0}`));
    console.log(chalk.white(`   MLB 2021 games: ${results[1].count || 0}`));
    console.log(chalk.white(`   NHL 2021 games: ${results[2].count || 0}`));
    console.log(chalk.white(`   Total player stats: ${results[3].count || 0}\n`));
  }

  private async displayFinalResults() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    
    // Get final counts
    const finalQueries = [
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('player_game_logs').select('*', { count: 'exact', head: true }),
      supabase.from('betting_lines').select('*', { count: 'exact', head: true }),
      supabase.from('weather_data').select('*', { count: 'exact', head: true })
    ];

    const [games, players, stats, betting, weather] = await Promise.all(finalQueries);

    console.log(chalk.bold.green(`
╔═══════════════════════════════════════════════════════════════╗
║              ✅ TURBO COLLECTION COMPLETE! ✅                 ║
╚═══════════════════════════════════════════════════════════════╝`));

    console.log(chalk.cyan('\n📊 Final Results:'));
    console.log(chalk.white(`   ⏱️  Total Time: ${Math.round(elapsed / 60)} minutes ${Math.round(elapsed % 60)} seconds`));
    console.log(chalk.white(`   🎮 Total Games: ${games.count?.toLocaleString() || 0}`));
    console.log(chalk.white(`   👥 Total Players: ${players.count?.toLocaleString() || 0}`));
    console.log(chalk.white(`   📊 Total Stats: ${stats.count?.toLocaleString() || 0}`));
    console.log(chalk.white(`   💰 Betting Lines: ${betting.count?.toLocaleString() || 0}`));
    console.log(chalk.white(`   🌤️  Weather Data: ${weather.count?.toLocaleString() || 0}`));
    console.log(chalk.white(`   ⚡ Average Performance: ${Math.round((stats.count || 0) / elapsed)} stats/second`));

    console.log(chalk.cyan('\n✅ Completed Sports:'));
    SPORTS_TASKS.forEach(task => {
      const status = this.completed.has(task.sport) ? '✅' : '❌';
      console.log(chalk.white(`   ${status} ${task.displayName}`));
    });

    if (this.completed.size === SPORTS_TASKS.length) {
      console.log(chalk.bold.green('\n🎉 ALL SPORTS COLLECTED SUCCESSFULLY! 🎉'));
      console.log(chalk.yellow('\n💡 Next Steps:'));
      console.log(chalk.white('   1. Run enhanced synergy generation'));
      console.log(chalk.white('   2. Run pattern detection analysis'));
      console.log(chalk.white('   3. Train ML models on complete dataset'));
    }
  }
}

// Main execution
async function main() {
  const orchestrator = new TurboCollectorOrchestrator();
  
  console.log(chalk.yellow('⚠️  WARNING: This will run 5 parallel collection processes!'));
  console.log(chalk.yellow('   Each process will use ~4GB RAM and multiple CPU threads.'));
  console.log(chalk.yellow('   Total expected: ~20GB RAM usage, 100% CPU usage\n'));
  
  console.log(chalk.cyan('Press Ctrl+C to cancel, starting in 3 seconds...\n'));
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await orchestrator.runAllSportsParallel();
}

if (require.main === module) {
  main().catch(console.error);
}

export default TurboCollectorOrchestrator;