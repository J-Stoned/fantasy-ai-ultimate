#!/usr/bin/env tsx

/**
 * 📊 Query Performance Monitor CLI
 * Real-time monitoring of database query performance
 */

import { queryMonitor } from '../src/lib/services/query-monitor';
import { optimizedDB } from '../src/lib/services/optimized-database';
import { cache } from '../src/lib/services/cache';

async function monitorQueries() {
  console.clear();
  console.log('📊 Fantasy AI Query Performance Monitor');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Listen for slow queries
  queryMonitor.on('slowQuery', (query) => {
    console.log(`⚠️  SLOW QUERY DETECTED (${query.duration}ms)`);
    console.log(`   Query: ${query.query.substring(0, 100)}...`);
    console.log(`   Time: ${new Date(query.timestamp).toLocaleTimeString()}\n`);
  });

  // Listen for query errors
  queryMonitor.on('queryError', (query) => {
    console.log(`❌ QUERY ERROR`);
    console.log(`   Query: ${query.query.substring(0, 100)}...`);
    console.log(`   Error: ${query.error}\n`);
  });

  // Display stats every 5 seconds
  setInterval(async () => {
    console.clear();
    console.log('📊 Fantasy AI Query Performance Monitor');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get current stats
    const stats = queryMonitor.getStats();
    const cacheStats = cache.getStats();
    const health = await optimizedDB.healthCheck();
    const recommendations = queryMonitor.getOptimizationRecommendations();

    // Display query statistics
    console.log('📈 Query Statistics:');
    console.log(`   Total Queries: ${stats.totalQueries}`);
    console.log(`   Avg Duration: ${stats.averageDuration.toFixed(2)}ms`);
    console.log(`   Slow Queries: ${stats.slowQueries} (>100ms)`);
    console.log(`   Error Queries: ${stats.errorQueries}`);
    console.log();

    // Display cache statistics
    console.log('💾 Cache Statistics:');
    console.log(`   Hit Rate: ${cacheStats.hitRate.toFixed(1)}%`);
    console.log(`   Total Entries: ${cacheStats.totalEntries}`);
    console.log(`   Cache Size: ${(cacheStats.totalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Avg Hits/Entry: ${cacheStats.avgHitsPerEntry.toFixed(1)}`);
    console.log();

    // Display connection pool stats
    console.log('🔌 Connection Pool:');
    console.log(`   Total: ${health.poolStats.totalConnections}`);
    console.log(`   Idle: ${health.poolStats.idleConnections}`);
    console.log(`   Waiting: ${health.poolStats.waitingRequests}`);
    console.log(`   Ping: ${health.poolStats.pingTime}ms`);
    console.log();

    // Display slow queries
    const slowQueries = queryMonitor.getSlowQueries(3);
    if (slowQueries.length > 0) {
      console.log('⚠️  Recent Slow Queries:');
      slowQueries.forEach((q, i) => {
        console.log(`   ${i + 1}. ${q.query.substring(0, 60)}... (${q.duration}ms)`);
      });
      console.log();
    }

    // Display N+1 patterns
    const n1Patterns = queryMonitor.detectN1Patterns();
    if (n1Patterns.length > 0) {
      console.log('🔍 Potential N+1 Query Patterns:');
      n1Patterns.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.pattern.substring(0, 60)}... (${p.count} queries in ${p.timeWindow}ms)`);
      });
      console.log();
    }

    // Display recommendations
    if (recommendations.length > 0) {
      console.log('💡 Optimization Recommendations:');
      recommendations.forEach((r, i) => {
        const icon = r.severity === 'high' ? '🔴' : r.severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${icon} ${r.message}`);
      });
      console.log();
    }

    // Display most frequent queries
    const frequent = queryMonitor.getFrequentQueries(3);
    if (frequent.length > 0) {
      console.log('📊 Most Frequent Queries:');
      frequent.forEach((q, i) => {
        console.log(`   ${i + 1}. ${q.query.substring(0, 50)}... (${q.count}x, avg ${q.avgDuration.toFixed(1)}ms)`);
      });
      console.log();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Press Ctrl+C to exit\n');
  }, 5000);

  // Test some queries to generate data
  console.log('🔄 Running test queries...\n');
  
  try {
    // Run some test queries
    await optimizedDB.query('SELECT * FROM fantasy_players LIMIT 10');
    await optimizedDB.query('SELECT * FROM contests WHERE sport = $1', ['NFL']);
    await optimizedDB.getPlayersWithStats('test-league');
    
    // Simulate some cache hits
    await cache.set('test:1', { data: 'test' }, { ttl: 300 });
    await cache.get('test:1');
    await cache.get('test:1');
    await cache.get('test:missing');
    
  } catch (error) {
    console.log('Note: Some test queries may fail if tables don\'t exist yet.\n');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n📊 Final Statistics:');
  const stats = queryMonitor.exportMetrics();
  console.log(JSON.stringify(stats.stats, null, 2));
  
  await optimizedDB.cleanup();
  process.exit(0);
});

// Run the monitor
monitorQueries().catch(console.error);