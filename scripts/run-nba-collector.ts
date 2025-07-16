#!/usr/bin/env node

/**
 * 🏀 NBA Collector Runner
 * Executes the NBA Master Collector V2 with BallDontLie API
 */

import NBAMasterCollectorV2 from './collectors/nba-master-collector-v2';
import chalk from 'chalk';

async function main() {
  console.log(chalk.bold.cyan('\n========================================'));
  console.log(chalk.bold.cyan('   🏀 NBA DATA COLLECTION SYSTEM 🏀'));
  console.log(chalk.bold.cyan('========================================\n'));
  
  console.log(chalk.yellow('Configuration:'));
  console.log(chalk.gray('- API: BallDontLie (Free Tier)'));
  console.log(chalk.gray('- Rate Limit: 60 requests/minute'));
  console.log(chalk.gray('- Data: Teams, Players, Recent Games'));
  console.log(chalk.gray('- Database: Supabase\n'));
  
  try {
    const collector = new NBAMasterCollectorV2();
    
    console.log(chalk.blue('Starting NBA data collection...\n'));
    const startTime = Date.now();
    
    await collector.collect();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.bold.green(`\n✅ Collection completed in ${duration} seconds!\n`));
    
  } catch (error: any) {
    console.error(chalk.bold.red('\n❌ Collection failed:'));
    console.error(chalk.red(error.message));
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Check for required environment variables
function checkEnvironment() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(chalk.red('\n❌ Missing required environment variables:'));
    missing.forEach(key => console.error(chalk.red(`  - ${key}`)));
    console.error(chalk.yellow('\nPlease ensure .env or .env.local contains these variables.\n'));
    process.exit(1);
  }
  
  // Check for BallDontLie API key (optional, has default)
  if (!process.env.BALLDONTLIE_API_KEY) {
    console.log(chalk.yellow('⚠️  Using default BallDontLie API key. Consider setting BALLDONTLIE_API_KEY in .env\n'));
  }
}

// Run the collector
checkEnvironment();
main().catch(console.error);