#!/usr/bin/env tsx
/**
 * Test Full System Integration
 * Verifies all components are connected properly
 */

import axios from 'axios';
import WebSocket from 'ws';
import chalk from 'chalk';

async function testIntegration() {
  console.log(chalk.blue.bold('🧪 TESTING FULL SYSTEM INTEGRATION\n'));
  
  const results = {
    frontend: false,
    patternAPI: false,
    websocket: false,
    database: false,
    dataFlow: false
  };
  
  // 1. Test Frontend
  console.log(chalk.yellow('1. Testing Frontend (Next.js)...'));
  try {
    const response = await axios.get('http://localhost:3000', {
      timeout: 5000,
      validateStatus: () => true
    });
    results.frontend = response.status < 500;
    console.log(results.frontend ? chalk.green('  ✓ Frontend is running') : chalk.red('  ✗ Frontend error'));
  } catch (err) {
    console.log(chalk.red('  ✗ Frontend not accessible'));
  }
  
  // 2. Test Pattern API
  console.log(chalk.yellow('\n2. Testing Pattern API...'));
  try {
    const healthResponse = await axios.get('http://localhost:3336/health');
    console.log(chalk.green('  ✓ Pattern API health check passed'));
    
    const patternsResponse = await axios.get('http://localhost:3336/api/patterns/summary');
    const patterns = patternsResponse.data.patterns || [];
    console.log(chalk.green(`  ✓ Found ${patterns.length} patterns`));
    
    if (patterns.length > 0) {
      console.log(chalk.cyan('  Pattern accuracies:'));
      patterns.forEach((p: any) => {
        console.log(`    - ${p.name}: ${p.accuracy}%`);
      });
    }
    
    results.patternAPI = true;
  } catch (err) {
    console.log(chalk.red('  ✗ Pattern API error'));
  }
  
  // 3. Test WebSocket
  console.log(chalk.yellow('\n3. Testing WebSocket...'));
  
  const ws = new WebSocket('ws://localhost:8080');
  
  await new Promise<void>((resolve) => {
    ws.on('open', () => {
      console.log(chalk.green('  ✓ WebSocket connected'));
      results.websocket = true;
      
      // Test sending a message
      ws.send(JSON.stringify({
        type: 'test',
        data: 'Integration test'
      }));
      
      ws.close();
      resolve();
    });
    
    ws.on('error', () => {
      console.log(chalk.red('  ✗ WebSocket connection failed'));
      resolve();
    });
    
    setTimeout(resolve, 5000);
  });
  
  // 4. Test Data Flow
  console.log(chalk.yellow('\n4. Testing Data Flow...'));
  
  if (results.patternAPI && results.websocket) {
    console.log(chalk.green('  ✓ Pattern API → WebSocket bridge possible'));
    results.dataFlow = true;
  } else {
    console.log(chalk.red('  ✗ Data flow broken (missing components)'));
  }
  
  // 5. Test Frontend API Routes
  console.log(chalk.yellow('\n5. Testing Frontend API Routes...'));
  try {
    const apiTests = [
      { path: '/api/patterns', name: 'Patterns API' },
      { path: '/api/predictions/unified', name: 'Predictions API' },
      { path: '/api/contests', name: 'Contests API' }
    ];
    
    for (const test of apiTests) {
      try {
        const response = await axios.get(`http://localhost:3000${test.path}`, {
          timeout: 3000,
          validateStatus: () => true
        });
        
        if (response.status === 200) {
          console.log(chalk.green(`  ✓ ${test.name} working`));
        } else {
          console.log(chalk.yellow(`  ⚠ ${test.name} returned ${response.status}`));
        }
      } catch (err) {
        console.log(chalk.red(`  ✗ ${test.name} failed`));
      }
    }
  } catch (err) {
    console.log(chalk.red('  ✗ Frontend API routes not accessible'));
  }
  
  // Summary
  console.log(chalk.blue.bold('\n📊 INTEGRATION SUMMARY\n'));
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const score = (passedTests / totalTests) * 100;
  
  console.log(`Tests passed: ${passedTests}/${totalTests} (${score.toFixed(0)}%)`);
  
  if (score === 100) {
    console.log(chalk.green.bold('\n✅ ALL SYSTEMS INTEGRATED!'));
    console.log(chalk.green('The Fantasy AI platform is fully connected and operational.'));
  } else if (score >= 60) {
    console.log(chalk.yellow.bold('\n⚠️  PARTIAL INTEGRATION'));
    console.log(chalk.yellow('Some components are working but not all connections established.'));
  } else {
    console.log(chalk.red.bold('\n❌ INTEGRATION FAILED'));
    console.log(chalk.red('Major components are not connected properly.'));
  }
  
  // Recommendations
  console.log(chalk.cyan('\n💡 Next Steps:'));
  
  if (!results.frontend) {
    console.log('- Start frontend: npm run dev:web');
  }
  if (!results.patternAPI) {
    console.log('- Start pattern API: npx tsx scripts/unified-pattern-api-real.ts');
  }
  if (!results.websocket) {
    console.log('- Start WebSocket: npx tsx scripts/simple-websocket-server.ts');
  }
  if (!results.dataFlow) {
    console.log('- Start bridge: npx tsx scripts/connect-pattern-websocket.ts');
  }
  
  console.log('\nOpen http://localhost:3000 to see the integrated platform!');
}

// Run the test
testIntegration().catch(console.error);