#!/usr/bin/env tsx
/**
 * 🚀 WINDOWS PERFORMANCE MONITOR
 * 
 * Native Windows console performance monitor for PostgreSQL
 * Works perfectly in Command Prompt!
 */

import { Client } from 'pg';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Test queries for monitoring
const testQueries = [
  {
    name: 'Simple Count',
    sql: 'SELECT COUNT(*) FROM games WHERE status = \'final\'',
    threshold: 50
  },
  {
    name: 'JSON Points Query',
    sql: 'SELECT COUNT(*) FROM player_game_logs WHERE (stats::json->>\'points\')::int > 30',
    threshold: 100
  },
  {
    name: 'Elite Fantasy',
    sql: 'SELECT COUNT(*) FROM player_game_logs WHERE fantasy_points > 50',
    threshold: 50
  },
  {
    name: 'Pattern Detection',
    sql: `SELECT COUNT(*) FROM games g 
          JOIN teams ht ON ht.id = g.home_team_id 
          WHERE ht.city = 'Denver'`,
    threshold: 100
  },
  {
    name: 'Home Team Stats',
    sql: `SELECT COUNT(*) 
          FROM player_game_logs pgl
          WHERE pgl.is_home = true`,
    threshold: 200
  }
];

// Performance history
const performanceHistory: Map<string, number[]> = new Map();
let totalQueries = 0;
let slowQueries = 0;

// Database connection
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres'
});

// Clear console and show header
function showHeader() {
  console.clear();
  console.log(chalk.blue('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║') + chalk.cyan.bold('        POSTGRESQL PERFORMANCE MONITOR - WINDOWS EDITION        ') + chalk.blue('║'));
  console.log(chalk.blue('╚════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray('Press Ctrl+C to exit\n'));
}

// Run performance test
async function runPerformanceTest() {
  const results: any[] = [];
  
  for (const test of testQueries) {
    const start = performance.now();
    try {
      const result = await client.query(test.sql);
      const duration = performance.now() - start;
      
      // Update history
      if (!performanceHistory.has(test.name)) {
        performanceHistory.set(test.name, []);
      }
      const history = performanceHistory.get(test.name)!;
      history.push(duration);
      if (history.length > 10) history.shift(); // Keep last 10
      
      // Track slow queries
      totalQueries++;
      if (duration > test.threshold) slowQueries++;
      
      results.push({
        name: test.name,
        duration,
        count: result.rows[0]?.count || 0,
        status: duration <= test.threshold ? 'FAST' : 'SLOW',
        avg: history.reduce((a, b) => a + b, 0) / history.length
      });
    } catch (error: any) {
      results.push({
        name: test.name,
        duration: 0,
        count: 0,
        status: 'ERROR',
        error: error.message
      });
    }
  }
  
  return results;
}

// Display results
function displayResults(results: any[]) {
  // Query Performance Table
  console.log(chalk.yellow('\n📊 QUERY PERFORMANCE'));
  console.log(chalk.gray('─'.repeat(70)));
  console.log(
    chalk.cyan('Query'.padEnd(25)) +
    chalk.cyan('Time'.padEnd(10)) +
    chalk.cyan('Avg'.padEnd(10)) +
    chalk.cyan('Status'.padEnd(10)) +
    chalk.cyan('Count'.padEnd(15))
  );
  console.log(chalk.gray('─'.repeat(70)));
  
  results.forEach(r => {
    const timeColor = r.status === 'FAST' ? chalk.green : 
                     r.status === 'SLOW' ? chalk.yellow : chalk.red;
    const statusIcon = r.status === 'FAST' ? '✅' : 
                      r.status === 'SLOW' ? '⚠️ ' : '❌';
    
    console.log(
      chalk.white(r.name.padEnd(25)) +
      timeColor(`${r.duration.toFixed(0)}ms`.padEnd(10)) +
      chalk.gray(`${r.avg ? r.avg.toFixed(0) + 'ms' : 'N/A'}`.padEnd(10)) +
      `${statusIcon} ${r.status}`.padEnd(10) +
      chalk.gray(r.count.toString().padEnd(15))
    );
  });
}

// Display statistics
async function displayStats() {
  try {
    // Database stats
    const dbStats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM games) as games,
        (SELECT COUNT(*) FROM player_game_logs) as logs,
        pg_size_pretty(pg_database_size(current_database())) as size,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as connections
    `);
    
    const stats = dbStats.rows[0];
    const slowRate = totalQueries > 0 ? (slowQueries / totalQueries * 100).toFixed(1) : '0';
    
    console.log(chalk.yellow('\n📈 DATABASE STATISTICS'));
    console.log(chalk.gray('─'.repeat(70)));
    console.log(`${chalk.cyan('Total Games:')} ${stats.games.toLocaleString()}`);
    console.log(`${chalk.cyan('Player Logs:')} ${stats.logs.toLocaleString()}`);
    console.log(`${chalk.cyan('Database Size:')} ${stats.size}`);
    console.log(`${chalk.cyan('Active Connections:')} ${stats.connections}`);
    console.log(`${chalk.cyan('Queries Monitored:')} ${totalQueries}`);
    console.log(`${chalk.cyan('Slow Query Rate:')} ${slowRate}%`);
    
    // Performance summary
    const allTimes: number[] = [];
    performanceHistory.forEach(history => allTimes.push(...history));
    if (allTimes.length > 0) {
      const avgTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
      const maxTime = Math.max(...allTimes);
      const minTime = Math.min(...allTimes);
      
      console.log(chalk.yellow('\n⚡ PERFORMANCE SUMMARY'));
      console.log(chalk.gray('─'.repeat(70)));
      console.log(`${chalk.cyan('Average Query Time:')} ${avgTime.toFixed(1)}ms`);
      console.log(`${chalk.cyan('Fastest Query:')} ${minTime.toFixed(1)}ms`);
      console.log(`${chalk.cyan('Slowest Query:')} ${maxTime.toFixed(1)}ms`);
      
      if (avgTime < 50) {
        console.log(chalk.green('\n🚀 EXCELLENT PERFORMANCE! Sub-50ms average!'));
      } else if (avgTime < 100) {
        console.log(chalk.yellow('\n⚡ GOOD PERFORMANCE! Sub-100ms average!'));
      } else {
        console.log(chalk.red('\n⚠️  PERFORMANCE NEEDS OPTIMIZATION'));
      }
    }
    
  } catch (error: any) {
    console.log(chalk.red('\n❌ Error fetching stats:'), error.message);
  }
}

// Main monitoring loop
async function monitor() {
  try {
    await client.connect();
    console.log(chalk.green('✅ Connected to PostgreSQL\n'));
    
    // Main loop
    while (true) {
      showHeader();
      
      const results = await runPerformanceTest();
      displayResults(results);
      await displayStats();
      
      console.log(chalk.gray('\n\nRefreshing in 5 seconds...'));
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
  } catch (error: any) {
    console.error(chalk.red('❌ Connection Error:'), error.message);
    console.log(chalk.yellow('\nMake sure PostgreSQL is running on Windows!'));
    process.exit(1);
  }
}

// Handle exit
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nShutting down monitor...'));
  await client.end();
  process.exit(0);
});

// Start monitoring
console.log(chalk.cyan('🚀 Starting Windows Performance Monitor...'));
monitor().catch(console.error);