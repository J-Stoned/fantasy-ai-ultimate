#!/usr/bin/env node

/**
 * 🔥 COMPREHENSIVE ENDPOINT DATABASE VERIFICATION 🔥
 * Verifies ALL API endpoints are connected to the local Docker database with 1.3M game logs
 */

import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import fetch from 'node-fetch';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

console.log(chalk.bold.red(`
╔═══════════════════════════════════════════════════════════════╗
║   🔥 VERIFYING ALL ENDPOINTS USE 1.3M GAME LOGS DB! 🔥       ║
╚═══════════════════════════════════════════════════════════════╝
`));

interface EndpointTest {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  body?: any;
  expectedDataIndicator?: string;
  checkGameLogs?: boolean;
}

const endpoints: EndpointTest[] = [
  // Player endpoints
  {
    name: 'Players API',
    path: '/api/players?sport=NFL',
    method: 'GET',
    expectedDataIndicator: 'players',
    checkGameLogs: true
  },
  {
    name: 'Player Avatar',
    path: '/api/players/121497385/avatar',
    method: 'GET',
    expectedDataIndicator: 'tier'
  },
  
  // Predictions endpoints
  {
    name: 'Predictions',
    path: '/api/predictions?sport=NFL',
    method: 'GET',
    expectedDataIndicator: 'predictions'
  },
  {
    name: 'Player Predictions',
    path: '/api/predictions/players?sport=NFL',
    method: 'GET',
    expectedDataIndicator: 'players'
  },
  {
    name: 'Trending Players',
    path: '/api/predictions/trending',
    method: 'GET',
    expectedDataIndicator: 'trending'
  },
  {
    name: 'Breakout Players',
    path: '/api/predictions/breakouts',
    method: 'GET',
    expectedDataIndicator: 'breakouts'
  },
  
  // ML endpoints
  {
    name: 'ML Predictions',
    path: '/api/ml/predict',
    method: 'POST',
    body: { sport: 'NFL', players: [] }
  },
  {
    name: 'ML Training Data',
    path: '/api/ml/training-data?sport=NFL',
    method: 'GET',
    expectedDataIndicator: 'data'
  },
  
  // Health checks
  {
    name: 'Health Check',
    path: '/api/health',
    method: 'GET',
    expectedDataIndicator: 'status'
  },
  {
    name: 'Database Health',
    path: '/api/health/database',
    method: 'GET',
    expectedDataIndicator: 'healthy'
  },
  
  // Roster/Waiver endpoints (now fixed to use local DB)
  {
    name: 'Waiver Claims',
    path: '/api/waivers/claims?leagueId=test&userId=test',
    method: 'GET'
  },
  {
    name: 'Drop Candidates',
    path: '/api/roster/drop-candidates?leagueId=test&userId=test',
    method: 'GET'
  },
  
  // DFS endpoints
  {
    name: 'Contests',
    path: '/api/contests',
    method: 'GET',
    expectedDataIndicator: 'contests'
  },
  {
    name: 'Ownership Data',
    path: '/api/ownership?sport=NFL',
    method: 'GET'
  },
  {
    name: 'Lineup Builder',
    path: '/api/lineup-builder/players?sport=NFL',
    method: 'GET'
  },
  
  // Analytics
  {
    name: 'Analytics Voice Query',
    path: '/api/analytics/voice-query',
    method: 'POST',
    body: { query: 'top players' }
  }
];

async function testEndpoint(endpoint: EndpointTest): Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
  dataSource?: string;
}> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        success: false,
        responseTime,
        error: `HTTP ${response.status}`
      };
    }
    
    const data = await response.json();
    
    // Check if response indicates local database usage
    let dataSource = 'Unknown';
    
    // Check for our metadata indicating 1.3M logs
    if (data.metadata?.dataSource?.includes('1.57M') || 
        data.metadata?.dataSource?.includes('1.3M')) {
      dataSource = '1.3M Local DB';
    }
    // Check for player/game counts that match our local DB
    else if (data.metadata?.totalPlayers > 80000 || 
             data.totalGameLogs > 1000000) {
      dataSource = '1.3M Local DB';
    }
    // Check response size/content
    else if (endpoint.checkGameLogs && Array.isArray(data.players) && data.players.length > 0) {
      dataSource = 'Local DB (inferred)';
    }
    
    return {
      success: true,
      responseTime,
      dataSource
    };
    
  } catch (error: any) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function runTests() {
  console.log(chalk.yellow('\n📡 Testing all API endpoints...\n'));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const spinner = ora(`Testing ${endpoint.name}...`).start();
    const result = await testEndpoint(endpoint);
    
    if (result.success) {
      spinner.succeed(`${endpoint.name}: ${chalk.green('OK')} (${result.responseTime}ms)`);
    } else {
      spinner.fail(`${endpoint.name}: ${chalk.red('FAILED')} - ${result.error}`);
    }
    
    results.push({
      ...endpoint,
      ...result
    });
  }
  
  // Summary table
  console.log(chalk.bold.yellow('\n📊 ENDPOINT DATABASE VERIFICATION SUMMARY:\n'));
  
  const table = new Table({
    head: ['Endpoint', 'Status', 'Response Time', 'Data Source'],
    colWidths: [30, 10, 15, 20],
    style: { head: [], border: ['grey'] }
  });
  
  let successCount = 0;
  let localDbCount = 0;
  
  results.forEach(result => {
    const status = result.success ? chalk.green('✅') : chalk.red('❌');
    const responseTime = result.success ? `${result.responseTime}ms` : '-';
    const dataSource = result.dataSource || '-';
    
    if (result.success) successCount++;
    if (dataSource.includes('Local DB')) localDbCount++;
    
    table.push([
      result.name,
      status,
      responseTime,
      dataSource
    ]);
  });
  
  console.log(table.toString());
  
  // Final summary
  const successRate = ((successCount / results.length) * 100).toFixed(1);
  const localDbRate = ((localDbCount / successCount) * 100).toFixed(1);
  
  console.log(chalk.bold(`\n📈 RESULTS:`));
  console.log(chalk.white(`• Total Endpoints Tested: ${results.length}`));
  console.log(chalk.white(`• Successful Responses: ${successCount} (${successRate}%)`));
  console.log(chalk.white(`• Using Local DB: ${localDbCount} (${localDbRate}% of successful)`));
  
  if (localDbCount === successCount && successCount > 0) {
    console.log(chalk.bold.green(`
╔═══════════════════════════════════════════════════════════════╗
║   🎉 ALL ENDPOINTS USING LOCAL DATABASE WITH 1.3M LOGS! 🎉   ║
╚═══════════════════════════════════════════════════════════════╝
    `));
  } else {
    console.log(chalk.bold.yellow(`
⚠️  Some endpoints may not be using the local database.
    Check the table above for details.
    `));
  }
  
  // Check direct database connection
  console.log(chalk.bold.yellow('\n🔍 Direct Database Connection Test:'));
  
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://fantasy_user:fantasy_password@localhost:5432/fantasy_ai'
    });
    
    const { rows: [gameLogCount] } = await pool.query('SELECT COUNT(*) FROM player_game_logs');
    const { rows: [playerCount] } = await pool.query('SELECT COUNT(*) FROM players');
    
    console.log(chalk.green(`✅ Direct connection successful!`));
    console.log(chalk.gray(`   Game Logs: ${parseInt(gameLogCount.count).toLocaleString()}`));
    console.log(chalk.gray(`   Players: ${parseInt(playerCount.count).toLocaleString()}`));
    
    await pool.end();
  } catch (error) {
    console.log(chalk.red('❌ Direct database connection failed'));
  }
}

// Run the tests
console.log(chalk.gray(`Testing endpoints at: ${BASE_URL}`));
console.log(chalk.gray(`Make sure the Next.js server is running!\n`));

runTests().catch(console.error);