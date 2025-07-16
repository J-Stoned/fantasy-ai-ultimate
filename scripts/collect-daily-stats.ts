#!/usr/bin/env tsx
/**
 * 📊 DAILY STATS COLLECTOR - Runs all sports with deduplication
 * Safe for automated daily runs via cron/scheduler
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

// Configuration for daily runs
const CONFIG = {
  // Only collect stats from last N days (to avoid re-processing old games)
  DAYS_BACK: process.env.STATS_DAYS_BACK ? parseInt(process.env.STATS_DAYS_BACK) : 3,
  // Run sports in parallel or serial
  PARALLEL_EXECUTION: process.env.STATS_PARALLEL === 'true',
  // Which sports to collect
  SPORTS_TO_COLLECT: process.env.STATS_SPORTS?.split(',') || ['nba', 'nfl', 'nhl', 'mlb']
};

const COLLECTORS = {
  nba: 'scripts/collect-nba-stats-yahoo-dedup.ts',
  nfl: 'scripts/collect-nfl-stats-yahoo-dedup.ts', 
  nhl: 'scripts/collect-nhl-stats-batch-dedup.ts',
  mlb: 'scripts/collect-mlb-stats-yahoo-fixed.ts' // Already has dedup
};

interface CollectionResult {
  sport: string;
  success: boolean;
  duration: number;
  statsCollected?: number;
  error?: string;
}

async function runCollector(sport: string): Promise<CollectionResult> {
  const startTime = Date.now();
  const collector = COLLECTORS[sport as keyof typeof COLLECTORS];
  
  if (!collector) {
    return {
      sport,
      success: false,
      duration: 0,
      error: `No collector found for ${sport}`
    };
  }
  
  console.log(chalk.cyan(`\n▶️  Starting ${sport.toUpperCase()} collection...`));
  
  try {
    // Set environment variable for days back
    const env = {
      ...process.env,
      [`${sport.toUpperCase()}_DAYS_BACK`]: CONFIG.DAYS_BACK.toString()
    };
    
    const { stdout, stderr } = await execAsync(`npx tsx ${collector}`, { 
      env,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    // Parse stats collected from output
    const statsMatch = stdout.match(/Stats Collected: ([\d,]+)/);
    const statsCollected = statsMatch ? parseInt(statsMatch[1].replace(/,/g, '')) : 0;
    
    if (stderr && !stderr.includes('DeprecationWarning')) {
      console.error(chalk.yellow(`⚠️  ${sport.toUpperCase()} warnings: ${stderr}`));
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(chalk.green(`✅ ${sport.toUpperCase()} completed in ${duration.toFixed(1)}s`));
    
    return {
      sport,
      success: true,
      duration,
      statsCollected
    };
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(chalk.red(`❌ ${sport.toUpperCase()} failed: ${error.message}`));
    
    return {
      sport,
      success: false,
      duration,
      error: error.message
    };
  }
}

async function collectDailyStats() {
  console.log(chalk.bold.magenta('📊 DAILY STATS COLLECTION STARTING\n'));
  console.log(chalk.gray(`Configuration:`));
  console.log(chalk.gray(`- Days back: ${CONFIG.DAYS_BACK}`));
  console.log(chalk.gray(`- Sports: ${CONFIG.SPORTS_TO_COLLECT.join(', ')}`));
  console.log(chalk.gray(`- Mode: ${CONFIG.PARALLEL_EXECUTION ? 'Parallel' : 'Serial'}`));
  console.log(chalk.gray(`- Time: ${new Date().toLocaleString()}\n`));
  
  const startTime = Date.now();
  let results: CollectionResult[] = [];
  
  if (CONFIG.PARALLEL_EXECUTION) {
    // Run all collectors in parallel
    results = await Promise.all(
      CONFIG.SPORTS_TO_COLLECT.map(sport => runCollector(sport))
    );
  } else {
    // Run collectors one by one
    for (const sport of CONFIG.SPORTS_TO_COLLECT) {
      const result = await runCollector(sport);
      results.push(result);
    }
  }
  
  // Summary
  const totalDuration = (Date.now() - startTime) / 1000;
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalStats = successful.reduce((sum, r) => sum + (r.statsCollected || 0), 0);
  
  console.log(chalk.bold.yellow('\n📈 COLLECTION SUMMARY\n'));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Success summary
  if (successful.length > 0) {
    console.log(chalk.green('✅ Successful:'));
    successful.forEach(r => {
      console.log(chalk.green(`   ${r.sport.toUpperCase()}: ${r.statsCollected?.toLocaleString() || 0} stats in ${r.duration.toFixed(1)}s`));
    });
  }
  
  // Failure summary
  if (failed.length > 0) {
    console.log(chalk.red('\n❌ Failed:'));
    failed.forEach(r => {
      console.log(chalk.red(`   ${r.sport.toUpperCase()}: ${r.error}`));
    });
  }
  
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.cyan(`Total Stats Collected: ${totalStats.toLocaleString()}`));
  console.log(chalk.cyan(`Total Time: ${(totalDuration / 60).toFixed(1)} minutes`));
  console.log(chalk.cyan(`Success Rate: ${successful.length}/${results.length} sports`));
  
  // Return exit code based on results
  if (failed.length > 0) {
    console.log(chalk.yellow('\n⚠️  Some collections failed. Check logs above.'));
    process.exit(1);
  } else {
    console.log(chalk.green('\n🎉 All collections completed successfully!'));
    process.exit(0);
  }
}

// Handle errors
process.on('unhandledRejection', (error: any) => {
  console.error(chalk.red('\n💥 Unhandled error:'), error);
  process.exit(1);
});

// Run the collector
collectDailyStats();