#!/usr/bin/env tsx
/**
 * Test All APIs
 * 
 * Verifies that all configured APIs are working correctly
 */

import chalk from 'chalk';
import * as dotenv from 'dotenv';
// Mock redis for testing
const redis = {
  get: async () => null,
  setex: async () => null
};

// Mock imports that are needed
global.redis = redis;

dotenv.config({ path: '.env.local' });

console.log(chalk.blue.bold('\n🧪 FANTASY AI API TESTER'));
console.log(chalk.blue('========================\n'));

async function testAPI(name: string, testFn: () => Promise<any>): Promise<boolean> {
  console.log(chalk.yellow(`Testing ${name}...`));
  
  try {
    const startTime = Date.now();
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    if (result) {
      console.log(chalk.green(`✅ ${name} - OK (${duration}ms)`));
      console.log(chalk.gray(`   Sample data: ${JSON.stringify(result).substring(0, 100)}...`));
      return true;
    } else {
      console.log(chalk.red(`❌ ${name} - No data returned`));
      return false;
    }
  } catch (error: any) {
    console.log(chalk.red(`❌ ${name} - Failed`));
    console.log(chalk.gray(`   Error: ${error.message}`));
    return false;
  }
}

async function runTests() {
  const results: Record<string, boolean> = {};
  
  // Test NFL Official API (no key needed)
  console.log(chalk.cyan('\n📡 Testing Free APIs (No Key Required)\n'));
  
  results['NFL Official'] = await testAPI('NFL Official API', async () => {
    const scores = await nflAPI.getCurrentScores();
    return scores.length > 0 ? scores[0] : null;
  });
  
  results['ESPN Fantasy'] = await testAPI('ESPN Fantasy API', async () => {
    const rankings = await espnFantasyAPI.getPlayerRankings('QB', 1);
    return rankings.length > 0 ? rankings[0] : null;
  });
  
  // Test APIs that require keys
  console.log(chalk.cyan('\n🔑 Testing APIs with Keys\n'));
  
  if (twitterAPI.isConfigured()) {
    results['Twitter'] = await testAPI('Twitter API', async () => {
      const trends = await twitterAPI.getFantasyTrends();
      return trends.length > 0 ? trends : null;
    });
  } else {
    console.log(chalk.gray('⏭️  Twitter API - Skipped (no key configured)'));
  }
  
  if (sportsDataAPI.isConfigured()) {
    results['SportsData.io'] = await testAPI('SportsData.io API', async () => {
      const remaining = await sportsDataAPI.getRemainingCalls();
      console.log(chalk.blue(`   Remaining calls: ${remaining.daily} daily, ${remaining.monthly} monthly`));
      return remaining;
    });
  } else {
    console.log(chalk.gray('⏭️  SportsData.io API - Skipped (no key configured)'));
  }
  
  // Test Data Aggregator
  console.log(chalk.cyan('\n🔄 Testing Data Aggregator\n'));
  
  results['Data Aggregator'] = await testAPI('Data Aggregator', async () => {
    const sources = await dataAggregator.getAllSourcesData();
    console.log(chalk.blue(`   Active sources: ${sources.sources.join(', ')}`));
    return sources;
  });
  
  // Test player analysis with aggregated data
  results['Player Analysis'] = await testAPI('Player Analysis (Patrick Mahomes)', async () => {
    const analysis = await dataAggregator.getPlayerAnalysis('Patrick Mahomes');
    return analysis;
  });
  
  // Summary
  console.log(chalk.cyan('\n📊 TEST SUMMARY\n'));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  const percentage = Math.round((passed / total) * 100);
  
  Object.entries(results).forEach(([api, passed]) => {
    console.log(`${passed ? chalk.green('✅') : chalk.red('❌')} ${api}`);
  });
  
  console.log(chalk.yellow(`\n🎯 ${passed}/${total} tests passed (${percentage}%)`));
  
  if (percentage === 100) {
    console.log(chalk.green.bold('\n🚀 All APIs working perfectly!'));
  } else if (percentage >= 50) {
    console.log(chalk.yellow('\n⚠️  Some APIs need configuration'));
  } else {
    console.log(chalk.red('\n❌ Most APIs are not configured'));
  }
  
  // Show configuration tips
  console.log(chalk.cyan('\n💡 Configuration Tips:\n'));
  
  if (!twitterAPI.isConfigured()) {
    console.log(chalk.gray('• Twitter: Get a Bearer Token from https://developer.twitter.com'));
  }
  if (!sportsDataAPI.isConfigured()) {
    console.log(chalk.gray('• SportsData.io: Get a free API key from https://sportsdata.io'));
  }
  
  console.log(chalk.gray('\n• ESPN and NFL APIs work without keys!'));
  console.log(chalk.gray('• Check .env.local for all API key placeholders'));
}

// Run tests
console.log(chalk.blue('Starting API tests...\n'));
runTests().catch(console.error);