#!/usr/bin/env tsx
/**
 * Debug API startup issues
 */

import express from 'express';
import chalk from 'chalk';

console.log(chalk.yellow('\n🔍 DEBUG: Starting API debug test...\n'));

// Test 1: Basic Express server
console.log(chalk.blue('Test 1: Basic Express setup'));
const app = express();
console.log('✅ Express app created');

// Test 2: Simple route
app.get('/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});
console.log('✅ Test route added');

// Test 3: Middleware
app.use(express.json());
console.log('✅ JSON middleware added');

// Test 4: Import pattern API modules one by one
console.log(chalk.blue('\nTest 4: Importing API modules...'));

async function testImports() {
  try {
    console.log('  Importing local-db-pool...');
    const dbPool = await import('../utils/local-db-pool');
    console.log('  ✅ Database pool imported');
  } catch (error) {
    console.log('  ❌ Database pool error:', error.message);
  }

  try {
    console.log('  Importing jwt-middleware...');
    const auth = await import('../auth/jwt-middleware');
    console.log('  ✅ Auth middleware imported');
  } catch (error) {
    console.log('  ❌ Auth middleware error:', error.message);
  }

  try {
    console.log('  Importing hybrid-cache...');
    const cache = await import('../cache/hybrid-cache');
    console.log('  ✅ Hybrid cache imported');
  } catch (error) {
    console.log('  ❌ Hybrid cache error:', error.message);
  }
}

testImports();

// Test 5: Start server
const PORT = 3339;
console.log(chalk.blue(`\nTest 5: Starting server on port ${PORT}...`));

const server = app.listen(PORT, () => {
  console.log(chalk.green(`\n✅ Debug server running on http://localhost:${PORT}`));
  console.log(chalk.yellow('Try: http://localhost:' + PORT + '/test'));
  
  // Test the server immediately
  setTimeout(async () => {
    console.log(chalk.blue('\nTest 6: Testing HTTP request...'));
    try {
      const response = await fetch(`http://localhost:${PORT}/test`);
      const data = await response.json();
      console.log('✅ HTTP test successful:', data);
    } catch (error) {
      console.log('❌ HTTP test failed:', error.message);
    }
    
    console.log(chalk.green('\n🎯 Debug complete! Press Ctrl+C to exit.'));
  }, 1000);
});

// Error handling
server.on('error', (error) => {
  console.error(chalk.red('Server error:'), error);
});

process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled rejection:'), error);
});