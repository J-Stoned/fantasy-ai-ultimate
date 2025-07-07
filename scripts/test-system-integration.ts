#!/usr/bin/env tsx
/**
 * System Integration Test
 * Verifies all components are connected and working
 */

import chalk from 'chalk';
import WebSocket from 'ws';

interface TestResult {
  service: string;
  status: 'pass' | 'fail';
  message: string;
  latency?: number;
}

const tests: TestResult[] = [];

async function testService(
  name: string, 
  url: string, 
  expectedStatus = 200
): Promise<void> {
  const start = Date.now();
  try {
    const response = await fetch(url);
    const latency = Date.now() - start;
    
    if (response.status === expectedStatus) {
      tests.push({
        service: name,
        status: 'pass',
        message: `HTTP ${response.status}`,
        latency
      });
    } else {
      tests.push({
        service: name,
        status: 'fail',
        message: `Expected ${expectedStatus}, got ${response.status}`,
        latency
      });
    }
  } catch (error: any) {
    tests.push({
      service: name,
      status: 'fail',
      message: error.message
    });
  }
}

async function testWebSocket(url: string): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const ws = new WebSocket(url);
    
    ws.on('open', () => {
      const latency = Date.now() - start;
      tests.push({
        service: 'WebSocket Server',
        status: 'pass',
        message: 'Connected',
        latency
      });
      ws.close();
      resolve();
    });
    
    ws.on('error', (error) => {
      tests.push({
        service: 'WebSocket Server',
        status: 'fail',
        message: error.message
      });
      resolve();
    });
    
    setTimeout(() => {
      ws.close();
      resolve();
    }, 5000);
  });
}

async function testPatternAPI(): Promise<void> {
  try {
    const response = await fetch('http://localhost:3336/api/unified/stats');
    const data = await response.json();
    
    if (data.stats && data.stats.totalGames) {
      tests.push({
        service: 'Pattern Stats',
        status: 'pass',
        message: `${data.stats.totalGames} games analyzed, ${data.stats.totalPatterns} patterns`
      });
    } else {
      tests.push({
        service: 'Pattern Stats',
        status: 'fail',
        message: 'Invalid response format'
      });
    }
  } catch (error: any) {
    tests.push({
      service: 'Pattern Stats',
      status: 'fail',
      message: error.message
    });
  }
}

async function runTests() {
  console.log(chalk.blue.bold('\n🧪 Fantasy AI System Integration Test\n'));
  
  // Test core services
  await testService('Next.js Frontend', 'http://localhost:3000/api/health', 200);
  await testService('Pattern API (Unified)', 'http://localhost:3336/health');
  await testService('Pattern API (Working)', 'http://localhost:3338/health');
  await testWebSocket('ws://localhost:8080');
  
  // Test API endpoints
  await testService('Patterns Endpoint', 'http://localhost:3000/api/patterns');
  await testService('Predictions Endpoint', 'http://localhost:3000/api/predictions');
  await testService('Unified Predictions', 'http://localhost:3000/api/predictions/unified');
  
  // Test pattern API functionality
  await testPatternAPI();
  
  // Display results
  console.log(chalk.cyan('\n📊 Test Results:\n'));
  
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  
  tests.forEach(test => {
    const icon = test.status === 'pass' ? '✅' : '❌';
    const color = test.status === 'pass' ? chalk.green : chalk.red;
    const latencyStr = test.latency ? chalk.gray(` (${test.latency}ms)`) : '';
    
    console.log(`${icon} ${color(test.service.padEnd(25))} ${test.message}${latencyStr}`);
  });
  
  console.log(chalk.cyan('\n📈 Summary:'));
  console.log(`   Passed: ${chalk.green(passed)}`);
  console.log(`   Failed: ${chalk.red(failed)}`);
  console.log(`   Total:  ${tests.length}`);
  
  if (failed === 0) {
    console.log(chalk.green.bold('\n🎉 All systems operational!'));
  } else {
    console.log(chalk.yellow.bold('\n⚠️  Some services need attention'));
    
    // Provide recommendations
    console.log(chalk.cyan('\n💡 Recommendations:'));
    
    if (tests.find(t => t.service === 'Next.js Frontend' && t.status === 'fail')) {
      console.log('   - Start Next.js: npm run dev:web');
    }
    
    if (tests.find(t => t.service.includes('Pattern API') && t.status === 'fail')) {
      console.log('   - Start Pattern API: npx tsx scripts/unified-pattern-api.ts');
    }
    
    if (tests.find(t => t.service === 'WebSocket Server' && t.status === 'fail')) {
      console.log('   - Start WebSocket: npx tsx scripts/simple-websocket-server.ts');
    }
  }
  
  // Test data flow
  console.log(chalk.blue.bold('\n🔄 Testing Data Flow:'));
  
  try {
    // Test pattern detection flow
    const patternTest = await fetch('http://localhost:3336/api/unified/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: 'test-game-1', sport: 'NFL' })
    });
    
    if (patternTest.ok) {
      console.log('✅ Pattern analysis working');
    } else {
      console.log('❌ Pattern analysis failed');
    }
  } catch (error) {
    console.log('❌ Pattern analysis unreachable');
  }
}

runTests().catch(console.error);