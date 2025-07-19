#!/usr/bin/env tsx
/**
 * 🚀 TURBO SPORT FIELD STANDARDIZATION
 * 
 * Fixes inconsistent sport values across all tables
 * Uses parallel processing for maximum speed
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Performance settings
const CPU_CORES = os.cpus().length;
const dbLimit = pLimit(CPU_CORES);
const BATCH_SIZE = 5000;

// Sport mappings
const SPORT_MAPPINGS: Record<string, string> = {
  'football': 'NFL',
  'Football': 'NFL',
  'nfl': 'NFL',
  'Basketball': 'NBA',
  'basketball': 'NBA',
  'nba': 'NBA',
  'Baseball': 'MLB',
  'baseball': 'MLB',
  'Hockey': 'NHL',
  'hockey': 'NHL',
  // Keep correct values as-is
  'NFL': 'NFL',
  'NBA': 'NBA',
  'MLB': 'MLB',
  'NHL': 'NHL',
  'NCAA_FB': 'NCAA_FB',
  'NCAA_BB': 'NCAA_BB',
  'NCAA_BASEBALL': 'NCAA_BASEBALL',
  'NCAA_HKY': 'NCAA_HKY',
  'MILB': 'MILB'
};

interface SportFixResult {
  table: string;
  fixed: number;
  duration: number;
}

async function fixSportFields() {
  console.log(chalk.bold.cyan('🚀 TURBO SPORT FIELD STANDARDIZATION\n'));
  console.log(chalk.yellow(`Using ${CPU_CORES} CPU cores for parallel processing\n`));

  const startTime = Date.now();
  const results: SportFixResult[] = [];

  try {
    // Get counts of incorrect sport values
    console.log(chalk.blue('📊 Analyzing sport field issues...\n'));
    
    const issues = await analyzeSportIssues();
    const totalIssues = Object.values(issues).reduce((sum, table) => 
      sum + Object.values(table).reduce((s, c) => s + c, 0), 0
    );

    if (totalIssues === 0) {
      console.log(chalk.green('✅ No sport field issues found!'));
      return;
    }

    console.log(chalk.yellow(`Found ${totalIssues.toLocaleString()} records to fix\n`));

    // Fix each table in parallel
    const tables = ['teams', 'players', 'games'];
    const promises = tables.map(table => fixTableSports(table, issues[table] || {}));
    const tableResults = await Promise.all(promises);
    results.push(...tableResults);

    // Generate report
    generateReport(results, startTime);

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function analyzeSportIssues(): Promise<Record<string, Record<string, number>>> {
  const issues: Record<string, Record<string, number>> = {};
  const tables = ['teams', 'players', 'games'];

  for (const table of tables) {
    issues[table] = {};
    
    // Get all unique sport values
    const { data } = await supabase
      .from(table)
      .select('sport')
      .not('sport', 'in', '(NFL,NBA,MLB,NHL,NCAA_FB,NCAA_BB,NCAA_BASEBALL,NCAA_HKY,MILB)');

    if (data) {
      data.forEach(record => {
        const sport = record.sport || 'NULL';
        issues[table][sport] = (issues[table][sport] || 0) + 1;
      });
    }
  }

  // Display issues found
  for (const [table, sportIssues] of Object.entries(issues)) {
    if (Object.keys(sportIssues).length > 0) {
      console.log(chalk.yellow(`${table}:`));
      for (const [sport, count] of Object.entries(sportIssues)) {
        console.log(`  "${sport}": ${count} records`);
      }
    }
  }

  return issues;
}

async function fixTableSports(
  table: string, 
  sportIssues: Record<string, number>
): Promise<SportFixResult> {
  const tableStart = Date.now();
  let totalFixed = 0;

  if (Object.keys(sportIssues).length === 0) {
    return { table, fixed: 0, duration: 0 };
  }

  console.log(chalk.blue(`\n🔧 Fixing ${table}...`));

  const progress = new cliProgress.SingleBar({
    format: `${table} |{bar}| {percentage}% | {value}/{total} | {duration_formatted}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });

  const totalToFix = Object.values(sportIssues).reduce((sum, count) => sum + count, 0);
  progress.start(totalToFix, 0);

  // Fix each incorrect sport value
  for (const [incorrectSport, count] of Object.entries(sportIssues)) {
    const correctSport = SPORT_MAPPINGS[incorrectSport];
    
    if (!correctSport) {
      console.log(chalk.red(`\n⚠️  No mapping for sport: "${incorrectSport}"`));
      continue;
    }

    // Update in batches
    let offset = 0;
    while (offset < count) {
      const { data: records } = await supabase
        .from(table)
        .select('id')
        .eq('sport', incorrectSport)
        .range(offset, offset + BATCH_SIZE - 1);

      if (!records || records.length === 0) break;

      // Parallel batch update
      const updatePromises = records.map(record =>
        dbLimit(async () => {
          await supabase
            .from(table)
            .update({ sport: correctSport })
            .eq('id', record.id);
        })
      );

      await Promise.all(updatePromises);
      
      totalFixed += records.length;
      progress.update(totalFixed);
      offset += BATCH_SIZE;
    }
  }

  progress.stop();

  return {
    table,
    fixed: totalFixed,
    duration: (Date.now() - tableStart) / 1000
  };
}

function generateReport(results: SportFixResult[], startTime: number) {
  const totalDuration = (Date.now() - startTime) / 1000;
  const totalFixed = results.reduce((sum, r) => sum + r.fixed, 0);

  console.log(chalk.bold.cyan('\n\n📊 SPORT STANDARDIZATION COMPLETE!\n'));
  console.log(chalk.gray('='.repeat(60)));

  results.forEach(result => {
    if (result.fixed > 0) {
      console.log(chalk.green(`✅ ${result.table}: Fixed ${result.fixed.toLocaleString()} records (${result.duration.toFixed(1)}s)`));
    } else {
      console.log(chalk.gray(`✓  ${result.table}: No issues found`));
    }
  });

  console.log(chalk.gray('='.repeat(60)));
  console.log(chalk.blue(`\n⏱️  Total time: ${totalDuration.toFixed(1)} seconds`));
  console.log(chalk.blue(`🚀 Performance: ${Math.round(totalFixed / totalDuration).toLocaleString()} updates/second`));
  console.log(chalk.green(`\n✅ Standardized ${totalFixed.toLocaleString()} sport fields!`));

  // Verify fix
  console.log(chalk.blue('\n🔍 Verifying standardization...'));
  verifyStandardization();
}

async function verifyStandardization() {
  const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL', 'NCAA_HKY', 'MILB'];
  const tables = ['teams', 'players', 'games'];
  
  let anyIssues = false;

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .not('sport', 'in', `(${validSports.join(',')})`);

    if (count && count > 0) {
      console.log(chalk.red(`❌ ${table}: Still has ${count} non-standard sport values`));
      anyIssues = true;
    }
  }

  if (!anyIssues) {
    console.log(chalk.green('✅ All sport fields are now standardized!'));
  }
}

// Run the fix
fixSportFields().catch(console.error);