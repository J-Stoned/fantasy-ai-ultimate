#!/usr/bin/env tsx
/**
 * 🚀 RUN AFTER ADDING COLUMNS TO DATABASE
 * 
 * 1. First run the SQL in Supabase to add missing columns
 * 2. Then run this script to populate all data
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log(chalk.bold.cyan('🚀 10X DEVELOPER DATA FIX\n'));

console.log(chalk.yellow('📋 Step 1: Add missing columns to betting_lines'));
console.log(chalk.white('Run this SQL in Supabase:\n'));
console.log(chalk.gray(`ALTER TABLE betting_lines 
ADD COLUMN IF NOT EXISTS away_moneyline INTEGER,
ADD COLUMN IF NOT EXISTS home_spread_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS away_spread_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS over_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS under_odds INTEGER DEFAULT -110;`));

console.log(chalk.green('\n✅ Press Enter after running the SQL in Supabase...'));

// Wait for user confirmation
process.stdin.once('data', async () => {
  console.log(chalk.yellow('\n📊 Step 2: Running data fix scripts...'));
  
  try {
    // Run the CPU-optimized backfill
    console.log(chalk.cyan('\nRunning CPU-optimized backfill...'));
    const { stdout, stderr } = await execAsync('npx tsx scripts/cpu-optimized-backfill.ts');
    
    if (stderr) {
      console.error(chalk.red('Errors:', stderr));
    }
    
    // Extract key numbers from output
    const bettingMatch = stdout.match(/Betting lines: (\d+)/);
    const synergyMatch = stdout.match(/Team synergies: (\d+)/);
    
    console.log(chalk.bold.green('\n✅ DATA FIX COMPLETE!'));
    console.log(chalk.green('\n📊 Final Results:'));
    console.log(`  💰 Betting lines: ${bettingMatch ? bettingMatch[1] : '?'}`);
    console.log(`  🤝 Team synergies: ${synergyMatch ? synergyMatch[1] : '?'}`);
    
    if (parseInt(synergyMatch?.[1] || '0') < 4000) {
      console.log(chalk.yellow('\n⚠️  Synergies still low. Running enhanced synergy calculation...'));
      // Could run another script here to boost synergies
    }
    
  } catch (error) {
    console.error(chalk.red('Error running scripts:'), error);
  }
  
  process.exit(0);
});