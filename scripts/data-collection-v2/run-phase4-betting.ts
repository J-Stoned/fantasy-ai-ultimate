#!/usr/bin/env tsx
/**
 * 🎰 RUN PHASE 4: BETTING & PROPS COLLECTION
 * 
 * Executes all betting data collectors:
 * 1. Game betting lines (spreads, totals, moneylines)
 * 2. Player props (points, yards, etc.)
 * 3. Historical odds tracking
 */

import chalk from 'chalk';
import { BettingDataCollector } from './phase4-betting-collector';
import { PlayerPropsCollector } from './player-props-collector';

async function runPhase4() {
  console.log(chalk.red.bold('\n' + '='.repeat(60)));
  console.log(chalk.red.bold('🎰 PHASE 4: BETTING DATA COLLECTION'));
  console.log(chalk.red.bold('='.repeat(60) + '\n'));
  
  const startTime = Date.now();
  
  try {
    // Step 1: Collect betting lines
    console.log(chalk.yellow.bold('📊 STEP 1: COLLECTING BETTING LINES...\n'));
    const bettingCollector = new BettingDataCollector();
    await bettingCollector.collect();
    
    // Step 2: Collect player props
    console.log(chalk.yellow.bold('🎯 STEP 2: COLLECTING PLAYER PROPS...\n'));
    const propsCollector = new PlayerPropsCollector();
    await propsCollector.collect();
    
    // Summary
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    console.log(chalk.green.bold('\n' + '='.repeat(60)));
    console.log(chalk.green.bold('✅ PHASE 4 COMPLETE!'));
    console.log(chalk.green.bold('='.repeat(60)));
    console.log(chalk.yellow(`\n⏱️  Total time: ${totalTime.toFixed(1)} minutes`));
    
    // Next steps
    console.log(chalk.cyan.bold('\n🚀 NEXT STEPS:'));
    console.log(chalk.cyan('1. Phase 5: Calculate fantasy points for all platforms'));
    console.log(chalk.cyan('2. Phase 6: Build ML models with complete dataset'));
    console.log(chalk.cyan('3. Integrate real-time odds feeds for production'));
    console.log(chalk.cyan('4. Add MCP web scraping for comprehensive coverage\n'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ PHASE 4 FAILED:'), error);
    process.exit(1);
  }
}

// Run Phase 4
if (require.main === module) {
  runPhase4().catch(console.error);
}