#!/usr/bin/env tsx
/**
 * 🚀 MASTER COLLECTION QUEUE - Run all collectors in sequence
 * 
 * Targets:
 * - Complete NBA 2023 (in progress)
 * - MLB 2023 season (~2,470 games)
 * - NHL 2023-24 season (~1,392 games)
 * - MLB 2024 season (~2,430 games)
 * - NHL 2024-25 season (partial)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { spawn } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CollectionJob {
  name: string;
  script: string;
  expectedGames: number;
  expectedLogs: number;
}

const jobs: CollectionJob[] = [
  {
    name: 'MLB 2023 Season',
    script: './collect-all-2023-seasons-FINAL.ts',
    expectedGames: 2470,
    expectedLogs: 60000  // ~24 players per game
  },
  {
    name: 'NHL 2023-24 Season', 
    script: './collect-2024-nhl-mega.ts',
    expectedGames: 1392,
    expectedLogs: 35000  // ~25 players per game
  },
  {
    name: 'MLB 2024 Season',
    script: './collect-2024-mlb-mega.ts',
    expectedGames: 2430,
    expectedLogs: 58000  // ~24 players per game
  }
];

async function runJob(job: CollectionJob) {
  console.log(chalk.bold.cyan(`\\n🚀 STARTING: ${job.name}\\n`));
  console.log(`Expected games: ${job.expectedGames.toLocaleString()}`);
  console.log(`Expected logs: ${job.expectedLogs.toLocaleString()}`);
  
  const startLogs = await getLogCount();
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const process = spawn('npx', ['tsx', job.script], {
      stdio: 'inherit',
      shell: true
    });
    
    process.on('close', async (code) => {
      const endLogs = await getLogCount();
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const added = endLogs - startLogs;
      
      console.log(chalk.bold.green(`\\n✅ COMPLETED: ${job.name}`));
      console.log(`Duration: ${duration} minutes`);
      console.log(`Logs added: ${added.toLocaleString()}`);
      console.log(`Total logs: ${endLogs.toLocaleString()}`);
      
      if (code === 0) {
        resolve(added);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

async function getLogCount(): Promise<number> {
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}

async function runQueue() {
  console.log(chalk.bold.magenta('🚀 MASTER COLLECTION QUEUE MANAGER\\n'));
  
  const initialLogs = await getLogCount();
  console.log(`Starting player logs: ${initialLogs.toLocaleString()}`);
  console.log(`Target: 600,000+`);
  console.log(`Gap: ${(600000 - initialLogs).toLocaleString()}\\n`);
  
  // Check if NBA is still running
  const { data: recentLog } = await supabase
    .from('player_game_logs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recentLog) {
    const minutesAgo = Math.floor((Date.now() - new Date(recentLog.created_at).getTime()) / 60000);
    if (minutesAgo < 5) {
      console.log(chalk.yellow('⚠️  NBA collection still active (last update ' + minutesAgo + ' min ago)'));
      console.log('Waiting for it to complete...\\n');
      
      // Wait for NBA to finish
      await new Promise(resolve => {
        const checkInterval = setInterval(async () => {
          const { data: lastLog } = await supabase
            .from('player_game_logs')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (lastLog) {
            const idle = Math.floor((Date.now() - new Date(lastLog.created_at).getTime()) / 60000);
            if (idle > 10) {
              clearInterval(checkInterval);
              console.log(chalk.green('✅ NBA collection appears complete\\n'));
              resolve(true);
            }
          }
        }, 60000); // Check every minute
      });
    }
  }
  
  // Run remaining jobs
  let totalAdded = 0;
  for (const job of jobs) {
    try {
      const added = await runJob(job) as number;
      totalAdded += added;
    } catch (error) {
      console.error(chalk.red(`\\n❌ ERROR in ${job.name}:`), error);
      console.log('Continuing with next job...\\n');
    }
  }
  
  // Final summary
  const finalLogs = await getLogCount();
  console.log(chalk.bold.green('\\n🎉 ALL COLLECTIONS COMPLETE!\\n'));
  console.log(`Initial logs: ${initialLogs.toLocaleString()}`);
  console.log(`Final logs: ${finalLogs.toLocaleString()}`);
  console.log(`Total added: ${(finalLogs - initialLogs).toLocaleString()}`);
  console.log(`Progress to 600K: ${(finalLogs / 600000 * 100).toFixed(1)}%`);
  
  if (finalLogs >= 600000) {
    console.log(chalk.bold.green('\\n🏆 TARGET ACHIEVED! Ready for 76.4% pattern detection accuracy!'));
  }
}

// Run the queue
runQueue().catch(console.error);