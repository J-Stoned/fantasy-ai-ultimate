#!/usr/bin/env node
/**
 * Quick API Test - Simple verification of fixes
 */

import axios from 'axios';
import chalk from 'chalk';

const API_BASE = 'http://localhost:3000';

async function testAPI() {
  console.log(chalk.bold.blue('\n🧪 Quick API Test\n'));
  
  const tests = [
    {
      name: 'Health Check',
      endpoint: '/api/health',
      method: 'GET' as const,
      check: (data: any) => data.status === 'healthy'
    },
    {
      name: 'Dashboard Stats',
      endpoint: '/api/stats/overview',
      method: 'GET' as const,
      check: (data: any) => data.database && data.patterns
    },
    {
      name: 'Lineup Optimizer Info',
      endpoint: '/api/optimize/lineup',
      method: 'GET' as const,
      check: (data: any) => data.endpoint && data.request
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(chalk.yellow(`Testing ${test.name}...`));
      const response = await axios({
        method: test.method,
        url: `${API_BASE}${test.endpoint}`,
        timeout: 5000
      });
      
      if (test.check(response.data)) {
        console.log(chalk.green(`✅ ${test.name} - PASSED`));
        console.log(chalk.gray(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`));
      } else {
        console.log(chalk.red(`❌ ${test.name} - FAILED (invalid response)`));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ ${test.name} - FAILED`));
      console.log(chalk.gray(`   Error: ${error.message}`));
    }
    console.log();
  }
  
  console.log(chalk.bold.yellow('\n⚠️  Note: Make sure the Next.js server is running (npm run dev:web)\n'));
}

testAPI();