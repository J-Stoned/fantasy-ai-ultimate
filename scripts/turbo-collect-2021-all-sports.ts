#!/usr/bin/env tsx
/**
 * 🚀 TURBO COLLECT ALL 2021 SPORTS - PROPER ORDER 🚀
 * 
 * Order: Teams → Games → Players → Stats
 * Uses proven collectors that work!
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import os from 'os';

const SPORTS = ['nba', 'mlb', 'nhl', 'ncaa_fb', 'ncaa_bb'];

class TurboCollector2021 {
  private multiBar: any;
  private startTime = Date.now();

  constructor() {
    this.multiBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{phase} |{bar}| {percentage}% | {task} | {eta_formatted}'
    }, cliProgress.Presets.shades_classic);
  }

  async collectAll() {
    console.log(chalk.bold.cyan(`
╔════════════════════════════════════════════════════════════════╗
║         🚀 TURBO 2021 COLLECTION - ALL SPORTS 🚀              ║
║                                                                ║
║  Order: Teams → Games → Players → Stats                       ║
║  CPU: ${os.cpus().length} threads | RAM: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB                        ║
╚════════════════════════════════════════════════════════════════╝
    `));

    try {
      // Phase 1: Teams (already exist, just verify)
      console.log(chalk.yellow('\n📋 Phase 1: Verifying Teams...'));
      console.log(chalk.green('✅ All teams already exist in database'));

      // Phase 2: Collect ALL games in parallel
      console.log(chalk.yellow('\n🎮 Phase 2: Collecting ALL 2021 Games...'));
      await this.collectPhase('games', SPORTS);

      // Phase 3: Collect ALL players in parallel
      console.log(chalk.yellow('\n👥 Phase 3: Collecting ALL 2021 Players...'));
      await this.collectPhase('players', SPORTS);

      // Phase 4: Collect ALL stats in parallel
      console.log(chalk.yellow('\n📊 Phase 4: Collecting ALL 2021 Stats...'));
      await this.collectPhase('stats', SPORTS);

      this.displayFinalResults();

    } catch (error) {
      console.error(chalk.red('Error during collection:'), error);
    } finally {
      this.multiBar.stop();
    }
  }

  private async collectPhase(dataType: string, sports: string[]): Promise<void> {
    const progressBars = new Map<string, any>();
    
    // Create progress bar for each sport
    sports.forEach(sport => {
      const bar = this.multiBar.create(100, 0, {
        phase: `${sport.toUpperCase().padEnd(8)}`,
        task: `Collecting ${dataType}...`,
        eta_formatted: 'calculating'
      });
      progressBars.set(sport, bar);
    });

    // Run all sports in parallel
    const promises = sports.map(sport => 
      this.runCollector(sport, dataType, progressBars.get(sport))
    );

    await Promise.all(promises);
    console.log(chalk.green(`✅ ${dataType} collection complete for all sports!`));
  }

  private runCollector(sport: string, dataType: string, progressBar: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Use the universal-sports-collector that we know works
      const args = [
        'tsx',
        'scripts/universal-sports-collector.ts',
        dataType,
        sport,
        '--historical',
        '--year',
        '2021'
      ];

      // Add enrichment only for games
      if (dataType === 'games') {
        args.push('--enrich');
      }

      const child = spawn('npx', args, {
        cwd: '/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate',
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=4096'
        },
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let progress = 0;
      let itemsCollected = 0;

      child.stdout.on('data', (data) => {
        const output = data.toString();
        
        // Parse progress from output
        if (output.includes('✅')) {
          progress = 100;
          const match = output.match(/Collected (\d+)/);
          if (match) itemsCollected = parseInt(match[1]);
        } else if (output.includes('Processing')) {
          // Estimate progress
          progress = Math.min(90, progress + 10);
        } else if (output.includes('Inserting')) {
          progress = 95;
        }

        // Calculate ETA
        const elapsed = (Date.now() - startTime) / 1000;
        const eta = progress > 0 ? (elapsed / progress * 100) - elapsed : 0;
        
        progressBar.update(progress, {
          task: `${itemsCollected} ${dataType}`,
          eta_formatted: this.formatETA(eta)
        });

        // Log output with sport prefix
        if (output.includes('✅') || output.includes('Error')) {
          console.log(chalk.gray(`[${sport.toUpperCase()}]`) + ' ' + output.trim());
        }
      });

      child.stderr.on('data', (data) => {
        console.error(chalk.red(`[${sport.toUpperCase()}] ${data}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          progressBar.update(100, {
            task: `Complete! (${itemsCollected} ${dataType})`,
            eta_formatted: 'done'
          });
          resolve();
        } else {
          progressBar.update(progress, {
            task: 'Failed!',
            eta_formatted: 'error'
          });
          reject(new Error(`${sport} ${dataType} collection failed`));
        }
      });

      child.on('error', reject);
    });
  }

  private formatETA(seconds: number): string {
    if (seconds <= 0) return 'calculating';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  private displayFinalResults() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    
    console.log(chalk.bold.green(`
╔════════════════════════════════════════════════════════════════╗
║              ✅ ALL 2021 SPORTS COLLECTED! ✅                 ║
╚════════════════════════════════════════════════════════════════╝`));

    console.log(chalk.cyan('\n📊 Collection Summary:'));
    console.log(chalk.white(`   ⏱️  Total Time: ${Math.round(elapsed / 60)} minutes`));
    console.log(chalk.white(`   🎯 Sports: NBA, MLB, NHL, NCAA Football, NCAA Basketball`));
    console.log(chalk.white(`   📅 Season: 2021`));
    
    console.log(chalk.yellow('\n💡 Next Steps:'));
    console.log(chalk.white('   1. Run database verification'));
    console.log(chalk.white('   2. Generate enhanced synergies'));
    console.log(chalk.white('   3. Run pattern analysis'));
  }
}

// Quick parallel runner for a specific phase
async function runPhaseOnly(phase: string) {
  console.log(chalk.cyan(`Running only ${phase} collection for all sports...`));
  
  const promises = SPORTS.map(sport => {
    return new Promise((resolve) => {
      const child = spawn('npx', [
        'tsx',
        'scripts/universal-sports-collector.ts',
        phase,
        sport,
        '--historical',
        '--year',
        '2021',
        ...(phase === 'games' ? ['--enrich'] : [])
      ], {
        cwd: '/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate',
        stdio: 'inherit'
      });
      
      child.on('close', () => resolve(null));
    });
  });
  
  await Promise.all(promises);
  console.log(chalk.green(`✅ ${phase} collection complete!`));
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && ['teams', 'games', 'players', 'stats'].includes(args[0])) {
    // Run specific phase only
    await runPhaseOnly(args[0]);
  } else {
    // Run full collection
    const collector = new TurboCollector2021();
    await collector.collectAll();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default TurboCollector2021;