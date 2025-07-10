import { NFLMasterCollector } from './nfl-master-collector';
import { NCAAMasterCollector } from './ncaa-master-collector';
import { NBAMasterCollector } from './nba-master-collector';
import { MLBMasterCollector } from './mlb-master-collector';
import { NHLMasterCollector } from './nhl-master-collector';
import chalk from 'chalk';

/**
 * Test all master collectors
 * Run with: npx tsx scripts/collectors/test-all-master-collectors.ts
 */
async function testAllCollectors() {
  console.log(chalk.bold.magenta('\n🚀 TESTING ALL MASTER COLLECTORS\n'));
  
  const collectors = [
    { name: 'NFL', collector: new NFLMasterCollector() },
    { name: 'NCAA', collector: new NCAAMasterCollector() },
    { name: 'NBA', collector: new NBAMasterCollector() },
    { name: 'MLB', collector: new MLBMasterCollector() },
    { name: 'NHL', collector: new NHLMasterCollector() }
  ];
  
  const results: { [key: string]: { success: boolean; error?: any } } = {};
  
  // Test each collector
  for (const { name, collector } of collectors) {
    console.log(chalk.yellow(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(chalk.bold.cyan(`Testing ${name} Master Collector...`));
    console.log(chalk.yellow(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));
    
    try {
      await collector.collect();
      results[name] = { success: true };
      console.log(chalk.green(`\n✅ ${name} collector test PASSED!\n`));
    } catch (error) {
      results[name] = { success: false, error };
      console.error(chalk.red(`\n❌ ${name} collector test FAILED:`), error, '\n');
    }
  }
  
  // Print summary
  console.log(chalk.bold.magenta('\n\n═══════════════════════════════════════'));
  console.log(chalk.bold.magenta('       COLLECTOR TEST SUMMARY          '));
  console.log(chalk.bold.magenta('═══════════════════════════════════════\n'));
  
  let allPassed = true;
  for (const [name, result] of Object.entries(results)) {
    if (result.success) {
      console.log(chalk.green(`✅ ${name}: PASSED`));
    } else {
      console.log(chalk.red(`❌ ${name}: FAILED`));
      allPassed = false;
    }
  }
  
  console.log('\n');
  
  if (allPassed) {
    console.log(chalk.bold.green('🎉 ALL COLLECTORS PASSED! 🎉\n'));
  } else {
    console.log(chalk.bold.red('⚠️  SOME COLLECTORS FAILED ⚠️\n'));
  }
}

// Run tests
testAllCollectors()
  .then(() => {
    console.log(chalk.cyan('Test suite completed.\n'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Test suite failed:'), error);
    process.exit(1);
  });