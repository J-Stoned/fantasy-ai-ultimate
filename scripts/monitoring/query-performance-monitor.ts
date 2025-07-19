#!/usr/bin/env tsx
/**
 * 🚀 QUERY PERFORMANCE MONITORING DASHBOARD
 * 
 * Real-time monitoring of PostgreSQL query performance
 * with connection pool statistics
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { getPool, query } from '../utils/local-db-pool';
import chalk from 'chalk';

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'PostgreSQL Performance Monitor'
});

// Create grid
const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

// Widgets
const queryChart = grid.set(0, 0, 4, 8, contrib.line, {
  style: { line: "yellow", text: "green", baseline: "black" },
  label: 'Query Response Time (ms)',
  showLegend: true
});

const poolGauge = grid.set(0, 8, 2, 4, contrib.gauge, {
  label: 'Connection Pool Usage',
  percent: 0,
  stroke: 'green',
  fill: 'white'
});

const statsTable = grid.set(2, 8, 2, 4, contrib.table, {
  keys: true,
  fg: 'white',
  selectedFg: 'white',
  selectedBg: 'blue',
  interactive: false,
  label: 'Pool Statistics',
  width: '30%',
  height: '30%',
  columnSpacing: 1,
  columnWidth: [15, 10]
});

const queryLog = grid.set(4, 0, 4, 12, contrib.log, {
  fg: "green",
  selectedFg: "green",
  label: 'Recent Queries',
  height: '30%',
  tags: true,
  scrollable: true
});

const performanceTable = grid.set(8, 0, 4, 6, contrib.table, {
  keys: true,
  fg: 'white',
  selectedFg: 'white',
  selectedBg: 'blue',
  interactive: false,
  label: 'Query Performance Stats',
  columnSpacing: 1,
  columnWidth: [30, 15, 15]
});

const alertLog = grid.set(8, 6, 4, 6, contrib.log, {
  fg: "yellow",
  selectedFg: "yellow",
  label: 'Performance Alerts',
  height: '30%',
  tags: true,
  scrollable: true
});

// Data storage
const queryTimes = {
  labels: [],
  datasets: [
    { title: 'Avg Response Time', x: [], y: [] },
    { title: 'Max Response Time', x: [], y: [] }
  ]
};

const performanceStats = new Map();
let queryCount = 0;

// Monitor queries
async function monitorQueries() {
  const testQueries = [
    {
      name: 'Game Count',
      sql: 'SELECT COUNT(*) FROM games WHERE status = \'final\''
    },
    {
      name: 'Elite Fantasy',
      sql: 'SELECT COUNT(*) FROM player_game_logs WHERE fantasy_points > 50'
    },
    {
      name: 'JSON Stats Query',
      sql: 'SELECT COUNT(*) FROM player_game_logs WHERE (stats::json->>\'points\')::int > 30'
    },
    {
      name: 'Pattern Detection',
      sql: `SELECT COUNT(*) FROM games g 
            JOIN teams ht ON ht.id = g.home_team_id 
            WHERE ht.city = 'Denver'`
    }
  ];

  // Run a random query
  const testQuery = testQueries[Math.floor(Math.random() * testQueries.length)];
  const start = Date.now();
  
  try {
    await query(testQuery.sql);
    const duration = Date.now() - start;
    queryCount++;
    
    // Update performance stats
    if (!performanceStats.has(testQuery.name)) {
      performanceStats.set(testQuery.name, { count: 0, totalTime: 0, maxTime: 0 });
    }
    
    const stats = performanceStats.get(testQuery.name);
    stats.count++;
    stats.totalTime += duration;
    stats.maxTime = Math.max(stats.maxTime, duration);
    
    // Log query
    const logColor = duration > 100 ? '{red-fg}' : duration > 50 ? '{yellow-fg}' : '{green-fg}';
    queryLog.log(`${logColor}[${new Date().toLocaleTimeString()}] ${testQuery.name}: ${duration}ms{/}`);
    
    // Alert on slow queries
    if (duration > 100) {
      alertLog.log(`{red-fg}⚠️  Slow query detected: ${testQuery.name} took ${duration}ms{/}`);
    }
    
    return duration;
  } catch (error) {
    queryLog.log(`{red-fg}❌ Query failed: ${error.message}{/}`);
    return 0;
  }
}

// Update displays
async function updateDisplays() {
  // Update pool statistics
  const pool = getPool();
  const poolUsage = pool.totalCount > 0 
    ? Math.round((pool.totalCount - pool.idleCount) / pool.totalCount * 100)
    : 0;
  
  poolGauge.setPercent(poolUsage);
  
  statsTable.setData({
    headers: ['Metric', 'Value'],
    data: [
      ['Total', pool.totalCount.toString()],
      ['Active', (pool.totalCount - pool.idleCount).toString()],
      ['Idle', pool.idleCount.toString()],
      ['Waiting', pool.waitingCount.toString()]
    ]
  });
  
  // Update performance table
  const perfData = Array.from(performanceStats.entries()).map(([name, stats]) => [
    name,
    `${(stats.totalTime / stats.count).toFixed(1)}ms`,
    `${stats.maxTime}ms`
  ]);
  
  performanceTable.setData({
    headers: ['Query', 'Avg Time', 'Max Time'],
    data: perfData
  });
  
  // Update query time chart
  if (queryTimes.labels.length > 20) {
    queryTimes.labels.shift();
    queryTimes.datasets[0].x.shift();
    queryTimes.datasets[0].y.shift();
    queryTimes.datasets[1].x.shift();
    queryTimes.datasets[1].y.shift();
  }
  
  const now = new Date();
  const timeLabel = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
  queryTimes.labels.push(timeLabel);
  
  // Calculate current averages
  const recentQueries = Array.from(performanceStats.values());
  const avgTime = recentQueries.reduce((sum, s) => sum + (s.totalTime / s.count), 0) / recentQueries.length || 0;
  const maxTime = Math.max(...recentQueries.map(s => s.maxTime), 0);
  
  queryTimes.datasets[0].x.push(timeLabel);
  queryTimes.datasets[0].y.push(avgTime);
  queryTimes.datasets[1].x.push(timeLabel);
  queryTimes.datasets[1].y.push(maxTime);
  
  queryChart.setData(queryTimes.datasets);
  
  screen.render();
}

// Database stats query
async function updateDatabaseStats() {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM games) as total_games,
        (SELECT COUNT(*) FROM player_game_logs) as total_stats,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
    `);
    
    const result = stats.rows[0];
    queryLog.log(`{cyan-fg}📊 Database: ${result.total_games} games, ${result.total_stats} stats, ${result.db_size}{/}`);
  } catch (error) {
    // Ignore errors
  }
}

// Keyboard controls
screen.key(['escape', 'q', 'C-c'], () => {
  getPool().end();
  return process.exit(0);
});

// Start monitoring
console.log(chalk.green('🚀 Starting PostgreSQL Performance Monitor...'));

// Initial update
updateDisplays();
updateDatabaseStats();

// Run monitoring loops
setInterval(async () => {
  await monitorQueries();
  updateDisplays();
}, 1000); // Run query every second

setInterval(updateDatabaseStats, 10000); // Update stats every 10 seconds

// Instructions
queryLog.log('{green-fg}🚀 PostgreSQL Performance Monitor Started{/}');
queryLog.log('{gray-fg}Press ESC or Q to exit{/}');
queryLog.log('{gray-fg}Monitoring query performance in real-time...{/}');

screen.render();