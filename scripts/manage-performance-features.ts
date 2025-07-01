#!/usr/bin/env node

/**
 * Performance Features Management Script
 * Manages materialized views, partitions, and other performance optimizations
 */

import { getProductionDatabasePool } from '../lib/database/ProductionDatabasePool';
import { createHighPerformanceRedis } from '../lib/cache/RedisHighPerformance';

class PerformanceManager {
  private db = getProductionDatabasePool();
  private redis = createHighPerformanceRedis();

  async run(): Promise<void> {
    console.log('🚀 Performance Features Management');
    console.log('==================================\n');

    try {
      // Check current status
      await this.checkPartitions();
      await this.checkMaterializedViews();
      await this.checkIndexes();
      
      // Perform maintenance
      await this.createUpcomingPartitions();
      await this.refreshMaterializedViews();
      await this.analyzeStatistics();
      
      // Verify performance
      await this.runPerformanceTests();
      
      console.log('\n✅ Performance management complete!');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Check current partitions
   */
  private async checkPartitions(): Promise<void> {
    console.log('📊 Checking Partitions');
    console.log('---------------------');

    const partitions = await this.db.query<any>(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE tablename LIKE 'game_events_%'
      ORDER BY tablename DESC
      LIMIT 10
    `);

    console.log(`Found ${partitions.length} partitions:`);
    partitions.forEach(p => {
      console.log(`  - ${p.tablename}: ${p.size}`);
    });

    // Check if tomorrow's partition exists
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const partitionName = `game_events_${tomorrow.toISOString().split('T')[0].replace(/-/g, '_')}`;
    
    const exists = partitions.some(p => p.tablename === partitionName);
    if (!exists) {
      console.log(`\n⚠️  Tomorrow's partition (${partitionName}) doesn't exist yet`);
    }
  }

  /**
   * Create upcoming partitions
   */
  private async createUpcomingPartitions(): Promise<void> {
    console.log('\n📅 Creating Upcoming Partitions');
    console.log('-------------------------------');

    // Create partitions for next 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      try {
        await this.db.execute('SELECT create_daily_partition()');
        console.log(`✅ Created partition for ${date.toISOString().split('T')[0]}`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`   Partition for ${date.toISOString().split('T')[0]} already exists`);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Check materialized views
   */
  private async checkMaterializedViews(): Promise<void> {
    console.log('\n📊 Checking Materialized Views');
    console.log('-----------------------------');

    const views = await this.db.query<any>(`
      SELECT 
        schemaname,
        matviewname,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
        CASE 
          WHEN last_refresh IS NULL THEN 'Never'
          ELSE to_char(last_refresh, 'YYYY-MM-DD HH24:MI:SS')
        END as last_refresh
      FROM pg_matviews
      LEFT JOIN LATERAL (
        SELECT MAX(last_autovacuum) as last_refresh
        FROM pg_stat_user_tables
        WHERE tablename = matviewname
      ) refresh ON true
      WHERE schemaname = 'public'
    `);

    views.forEach(v => {
      console.log(`${v.matviewname}:`);
      console.log(`  Size: ${v.size}`);
      console.log(`  Last Refresh: ${v.last_refresh}`);
    });
  }

  /**
   * Refresh materialized views
   */
  private async refreshMaterializedViews(): Promise<void> {
    console.log('\n🔄 Refreshing Materialized Views');
    console.log('--------------------------------');

    const views = [
      'player_performance_summary',
      'realtime_game_stats'
    ];

    for (const view of views) {
      const start = Date.now();
      try {
        await this.db.execute(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        const duration = Date.now() - start;
        console.log(`✅ Refreshed ${view} in ${duration}ms`);
      } catch (error: any) {
        console.log(`❌ Failed to refresh ${view}: ${error.message}`);
      }
    }
  }

  /**
   * Check indexes
   */
  private async checkIndexes(): Promise<void> {
    console.log('\n📊 Checking Index Usage');
    console.log('----------------------');

    const unusedIndexes = await this.db.query<any>(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size,
        idx_scan as scans
      FROM pg_stat_user_indexes
      WHERE idx_scan < 100
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 10
    `);

    if (unusedIndexes.length > 0) {
      console.log('Potentially unused indexes:');
      unusedIndexes.forEach(idx => {
        console.log(`  - ${idx.indexname} on ${idx.tablename} (${idx.size}, ${idx.scans} scans)`);
      });
    } else {
      console.log('✅ All indexes are being used effectively');
    }

    // Check for missing indexes
    const missingIndexes = await this.db.query<any>(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats
      WHERE schemaname = 'public'
        AND n_distinct > 100
        AND correlation < 0.1
        AND tablename IN ('game_events', 'player_stats', 'games')
      LIMIT 5
    `);

    if (missingIndexes.length > 0) {
      console.log('\nColumns that might benefit from indexes:');
      missingIndexes.forEach(col => {
        console.log(`  - ${col.tablename}.${col.attname} (${col.n_distinct} distinct values)`);
      });
    }
  }

  /**
   * Analyze table statistics
   */
  private async analyzeStatistics(): Promise<void> {
    console.log('\n📈 Updating Table Statistics');
    console.log('---------------------------');

    const tables = [
      'game_events',
      'players',
      'player_stats',
      'games',
      'gpu_optimization_cache',
      'websocket_connections'
    ];

    for (const table of tables) {
      try {
        await this.db.execute(`ANALYZE ${table}`);
        console.log(`✅ Analyzed ${table}`);
      } catch (error: any) {
        console.log(`❌ Failed to analyze ${table}: ${error.message}`);
      }
    }
  }

  /**
   * Run performance tests
   */
  private async runPerformanceTests(): Promise<void> {
    console.log('\n⚡ Running Performance Tests');
    console.log('---------------------------');

    // Test 1: Partition query performance
    const partitionStart = Date.now();
    const recentEvents = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM game_events 
       WHERE timestamp > NOW() - INTERVAL '1 hour'`,
      [],
      'realtime'
    );
    const partitionTime = Date.now() - partitionStart;
    console.log(`Partition query: ${partitionTime}ms (${recentEvents[0].count} events)`);

    // Test 2: Materialized view query
    const mvStart = Date.now();
    const playerStats = await this.db.query(
      `SELECT * FROM player_performance_summary 
       WHERE avg_points > 20 
       LIMIT 10`,
      [],
      'read'
    );
    const mvTime = Date.now() - mvStart;
    console.log(`Materialized view query: ${mvTime}ms (${playerStats.length} players)`);

    // Test 3: Index performance
    const indexStart = Date.now();
    const indexedQuery = await this.db.query(
      `SELECT * FROM game_events 
       WHERE game_id = $1 AND processed = false 
       ORDER BY sequence_number DESC 
       LIMIT 100`,
      ['test-game-123'],
      'realtime'
    );
    const indexTime = Date.now() - indexStart;
    console.log(`Indexed query: ${indexTime}ms`);

    // Test 4: Cache hit rate
    const cacheKey = 'perf:test:player:123';
    await this.redis.setGPUCache(cacheKey, { test: true }, 60);
    const cacheStart = Date.now();
    await this.redis.getGPUCache(cacheKey);
    const cacheTime = Date.now() - cacheStart;
    console.log(`Cache retrieval: ${cacheTime}ms`);

    // Performance summary
    console.log('\nPerformance Summary:');
    console.log('==================');
    const avgTime = (partitionTime + mvTime + indexTime + cacheTime) / 4;
    console.log(`Average query time: ${avgTime.toFixed(2)}ms`);
    
    if (avgTime < 10) {
      console.log('🏆 Performance: EXCELLENT (Second Spectrum level!)');
    } else if (avgTime < 50) {
      console.log('✅ Performance: GOOD');
    } else if (avgTime < 100) {
      console.log('⚠️  Performance: ACCEPTABLE');
    } else {
      console.log('❌ Performance: NEEDS IMPROVEMENT');
    }
  }

  /**
   * Cleanup
   */
  private async cleanup(): Promise<void> {
    await this.db.shutdown();
    await this.redis.disconnect();
  }
}

// Run the script
async function main() {
  const manager = new PerformanceManager();
  await manager.run();
}

main().catch(console.error);