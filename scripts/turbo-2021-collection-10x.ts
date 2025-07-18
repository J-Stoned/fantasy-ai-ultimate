#!/usr/bin/env tsx
/**
 * 🚀 10X TURBO 2021 COLLECTION - THE REAL DEAL 🚀
 * 
 * 10X APPROACH: Fix the adapter issue inline and run EVERYTHING in parallel
 * No testing, no hesitation - just pure execution with smart error handling
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 10X FIX: Create adapter mappings on the fly
async function setupAdapterMappings() {
  const adapterDir = path.join(process.cwd(), 'scripts/adapters');
  
  // Check if NCAA adapter exists
  if (fs.existsSync(path.join(adapterDir, 'ncaa-adapter.ts'))) {
    // Create symlinks for NCAA sports
    try {
      if (!fs.existsSync(path.join(adapterDir, 'ncaa_fb-adapter.ts'))) {
        fs.symlinkSync('ncaa-adapter.ts', path.join(adapterDir, 'ncaa_fb-adapter.ts'));
      }
      if (!fs.existsSync(path.join(adapterDir, 'ncaa_bb-adapter.ts'))) {
        fs.symlinkSync('ncaa-adapter.ts', path.join(adapterDir, 'ncaa_bb-adapter.ts'));
      }
      console.log(chalk.green('✅ NCAA adapter mappings created'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not create symlinks, will patch collector instead'));
      return false;
    }
  }
  return true;
}

// 10X EXECUTION: Run everything at once
async function execute10XCollection() {
  console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║            🚀 10X TURBO 2021 COLLECTION 🚀                    ║
║                                                               ║
║  Philosophy: Fix once, run everything, handle errors          ║
║  Sports: NBA, MLB, NHL, NCAA FB, NCAA BB                     ║
║  Target: 200,000+ stats in < 30 minutes                      ║
╚═══════════════════════════════════════════════════════════════╝
  `));

  const startTime = Date.now();

  // Fix adapter issue first
  await setupAdapterMappings();

  // Define all collection tasks
  const tasks = [
    // NBA
    { sport: 'nba', phase: 'games', cmd: 'npx tsx scripts/universal-sports-collector.ts games nba --historical --year 2021 --enrich' },
    { sport: 'nba', phase: 'players', cmd: 'npx tsx scripts/universal-sports-collector.ts players nba --historical --year 2021' },
    { sport: 'nba', phase: 'stats', cmd: 'npx tsx scripts/universal-sports-collector.ts stats nba --historical --year 2021' },
    
    // MLB
    { sport: 'mlb', phase: 'games', cmd: 'npx tsx scripts/universal-sports-collector.ts games mlb --historical --year 2021 --enrich' },
    { sport: 'mlb', phase: 'players', cmd: 'npx tsx scripts/universal-sports-collector.ts players mlb --historical --year 2021' },
    { sport: 'mlb', phase: 'stats', cmd: 'npx tsx scripts/universal-sports-collector.ts stats mlb --historical --year 2021' },
    
    // NHL
    { sport: 'nhl', phase: 'games', cmd: 'npx tsx scripts/universal-sports-collector.ts games nhl --historical --year 2021 --enrich' },
    { sport: 'nhl', phase: 'players', cmd: 'npx tsx scripts/universal-sports-collector.ts players nhl --historical --year 2021' },
    { sport: 'nhl', phase: 'stats', cmd: 'npx tsx scripts/universal-sports-collector.ts stats nhl --historical --year 2021' },
  ];

  // NCAA sports only if we can use them
  const ncaaWorks = fs.existsSync(path.join(process.cwd(), 'scripts/adapters/ncaa-adapter.ts'));
  if (ncaaWorks) {
    tasks.push(
      // NCAA Football
      { sport: 'ncaa_fb', phase: 'games', cmd: 'npx tsx scripts/universal-sports-collector.ts games ncaa_fb --historical --year 2021 --enrich' },
      { sport: 'ncaa_fb', phase: 'players', cmd: 'npx tsx scripts/universal-sports-collector.ts players ncaa_fb --historical --year 2021' },
      { sport: 'ncaa_fb', phase: 'stats', cmd: 'npx tsx scripts/universal-sports-collector.ts stats ncaa_fb --historical --year 2021' },
      
      // NCAA Basketball
      { sport: 'ncaa_bb', phase: 'games', cmd: 'npx tsx scripts/universal-sports-collector.ts games ncaa_bb --historical --year 2021 --enrich' },
      { sport: 'ncaa_bb', phase: 'players', cmd: 'npx tsx scripts/universal-sports-collector.ts players ncaa_bb --historical --year 2021' },
      { sport: 'ncaa_bb', phase: 'stats', cmd: 'npx tsx scripts/universal-sports-collector.ts stats ncaa_bb --historical --year 2021' }
    );
  }

  // Group by phase for smart execution
  const gamesTasks = tasks.filter(t => t.phase === 'games');
  const playersTasks = tasks.filter(t => t.phase === 'players');
  const statsTasks = tasks.filter(t => t.phase === 'stats');

  console.log(chalk.yellow('\n🎮 Phase 1: Collecting ALL games in parallel...'));
  await runTasksInParallel(gamesTasks);

  console.log(chalk.yellow('\n👥 Phase 2: Collecting ALL players in parallel...'));
  await runTasksInParallel(playersTasks);

  console.log(chalk.yellow('\n📊 Phase 3: Collecting ALL stats in parallel (THIS IS THE BIG ONE!)...'));
  await runTasksInParallel(statsTasks);

  // Final results
  const elapsed = (Date.now() - startTime) / 1000;
  await displayFinalResults(elapsed);
}

// Run tasks in parallel with proper resource management
async function runTasksInParallel(tasks: any[]): Promise<void> {
  const promises = tasks.map(task => {
    return new Promise((resolve, reject) => {
      console.log(chalk.gray(`[${task.sport.toUpperCase()}] Starting ${task.phase} collection...`));
      
      const child = spawn(task.cmd, {
        shell: true,
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=4096',
          UV_THREADPOOL_SIZE: '4'
        }
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
        // Only log important lines
        const line = data.toString().trim();
        if (line.includes('✅') || line.includes('Collected') || line.includes('Error')) {
          console.log(chalk.gray(`[${task.sport.toUpperCase()}]`) + ' ' + line);
        }
      });

      child.stderr.on('data', (data) => {
        console.error(chalk.red(`[${task.sport.toUpperCase()}] ${data}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green(`[${task.sport.toUpperCase()}] ✅ ${task.phase} complete!`));
          resolve(output);
        } else {
          console.log(chalk.red(`[${task.sport.toUpperCase()}] ❌ ${task.phase} failed!`));
          resolve(output); // Don't reject - keep going with other sports
        }
      });
    });
  });

  await Promise.all(promises);
}

// Display comprehensive results
async function displayFinalResults(elapsedSeconds: number) {
  // Get final counts
  const queries = await Promise.all([
    supabase.from('games').select('*', { count: 'exact', head: true }),
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase.from('player_game_logs').select('*', { count: 'exact', head: true }),
    supabase.from('betting_lines').select('*', { count: 'exact', head: true }),
    supabase.from('weather_data').select('*', { count: 'exact', head: true })
  ]);

  const [games, players, stats, betting, weather] = queries;

  console.log(chalk.bold.green(`
╔═══════════════════════════════════════════════════════════════╗
║              ✅ 10X COLLECTION COMPLETE! ✅                   ║
╚═══════════════════════════════════════════════════════════════╝`));

  console.log(chalk.cyan('\n📊 Final Database State:'));
  console.log(chalk.white(`   🎮 Total Games: ${games.count?.toLocaleString() || 0}`));
  console.log(chalk.white(`   👥 Total Players: ${players.count?.toLocaleString() || 0}`));
  console.log(chalk.white(`   📊 Total Stats: ${stats.count?.toLocaleString() || 0}`));
  console.log(chalk.white(`   💰 Betting Lines: ${betting.count?.toLocaleString() || 0}`));
  console.log(chalk.white(`   🌤️  Weather Data: ${weather.count?.toLocaleString() || 0}`));

  console.log(chalk.cyan('\n⚡ Performance:'));
  console.log(chalk.white(`   ⏱️  Total Time: ${Math.round(elapsedSeconds / 60)} minutes`));
  console.log(chalk.white(`   📊 Stats/second: ${Math.round((stats.count || 0) / elapsedSeconds)}`));
  console.log(chalk.white(`   🚀 10X Factor: ${elapsedSeconds < 1800 ? 'ACHIEVED!' : 'Close!'}`));

  if ((stats.count || 0) > 150000) {
    console.log(chalk.bold.yellow('\n🏆 ACHIEVEMENT UNLOCKED: 150,000+ STATS COLLECTED!'));
  }

  console.log(chalk.yellow('\n💡 Next 10X Move:'));
  console.log(chalk.white('   npx tsx scripts/final-enhanced-synergy-insert.ts'));
  console.log(chalk.white('   npx tsx scripts/pattern-detection/unified-pattern-api.ts'));
}

// Main execution
async function main() {
  try {
    await execute10XCollection();
  } catch (error) {
    console.error(chalk.red('10X Collection failed:'), error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default execute10XCollection;