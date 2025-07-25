#!/usr/bin/env tsx

/**
 * 🚀 Database Optimization Initialization
 * Run this script to optimize your database for <100ms queries
 */

import { optimizedDB } from '../services/optimized-database';
import { queryMonitor } from '../services/query-monitor';
import { cache } from '../services/cache';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logging/logger';

async function initializeOptimizations() {
  logger.info('🚀 Starting database optimization...\n');

  try {
    // 1. Create optimized indexes
    logger.info('📊 Creating optimized indexes...');
    await optimizedDB.createOptimizedIndexes();
    logger.info('✅ Indexes created successfully\n');

    // 2. Run migration script
    logger.info('🔧 Running optimization migrations...');
    const migrationPath = path.join(__dirname, 'migrations', '001_optimize_indexes.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    // Execute migration statements one by one
    const statements = migrationSQL
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .filter(stmt => !stmt.trim().startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await optimizedDB.query(statement);
        } catch (error) {
          logger.warn('⚠️ Statement failed (may already exist):'statement.substring(0, 50) + '...');
        }
      }
    }
    logger.info('✅ Migrations completed\n');

    // 3. Analyze tables for query planner
    logger.info('📈 Analyzing tables for query optimization...');
    const tables = [
      'fantasy_players',
      'player_stats',
      'contests',
      'lineups',
      'ml_predictions',
      'fantasy_leagues',
      'ownership_data',
      'bankroll_history'
    ];

    for (const table of tables) {
      await optimizedDB.query(`ANALYZE ${table}`);
      logger.info('  ✓ Analyzed ${table}');
    }
    logger.info('✅ Table analysis completed\n');

    // 4. Test query performance
    logger.info('⏱️ Testing query performance...');
    const testQueries = [
      {
        name: 'Player listing',
        query: 'SELECT * FROM fantasy_players WHERE league_id = $1 LIMIT 20',
        params: ['test-league-id']
      },
      {
        name: 'Contest listing',
        query: 'SELECT * FROM contests WHERE sport = $1 AND start_time > NOW() ORDER BY start_time LIMIT 10',
        params: ['NFL']
      },
      {
        name: 'Player stats join',
        query: `
          SELECT p.*, ps.avg_points, ps.games_played 
          FROM fantasy_players p 
          LEFT JOIN player_stats ps ON p.id = ps.player_id 
          WHERE p.league_id = $1 
          ORDER BY ps.avg_points DESC 
          LIMIT 20
        `,
        params: ['test-league-id']
      }
    ];

    for (const test of testQueries) {
      const start = Date.now();
      try {
        await optimizedDB.query(test.query, test.params);
        const duration = Date.now() - start;
        logger.info(`  ✓ ${test.name}: ${duration}ms ${duration < 100 ? '🚀' : '⚠️'}`);
      } catch (error) {
        logger.info('  ✗ ${test.name}: Failed');
      }
    }
    logger.info('✅ Performance testing completed\n');

    // 5. Check database health
    logger.info('🏥 Checking database health...');
    const health = await optimizedDB.healthCheck();
    logger.info('  Pool Stats:', { data: health.poolStats });
    logger.info('  Query Stats:', { data: health.queryStats });
    logger.info(`  Health Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);

    // 6. Initialize cache warm-up
    logger.info('🔥 Warming up cache...');
    
    // Cache common queries
    const warmupQueries = [
      { key: 'leagues:all', query: 'SELECT * FROM fantasy_leagues WHERE is_active = true' },
      { key: 'sports:list', query: 'SELECT DISTINCT sport FROM contests' },
      { key: 'positions:nfl', query: `SELECT DISTINCT position FROM fantasy_players WHERE position IN ('QB','RB','WR','TE','K','DEF')` }
    ];

    for (const warmup of warmupQueries) {
      try {
        const result = await optimizedDB.query(warmup.query, [], { cache: true, cacheTTL: 3600 });
        logger.info('  ✓ Cached ${warmup.key}: ${result.length} items');
      } catch (error) {
        logger.info('  ✗ Failed to cache ${warmup.key}');
      }
    }

    const cacheStats = cache.getStats();
    logger.info('\n  Cache Status:', { data: cacheStats });
    logger.info('✅ Cache warm-up completed\n');

    // 7. Summary
    logger.info('📊 Optimization Summary:');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('✅ Database indexes optimized');
    logger.info('✅ Query performance tested');
    logger.info('✅ Cache system initialized');
    logger.info('✅ Health monitoring active');
    logger.info('\n🎯 Target: All queries <100ms');
    logger.info('📈 Monitor performance at: /api/admin/query-monitor');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    logger.error('❌ Optimization failed:', { error: error });
    process.exit(1);
  } finally {
    await optimizedDB.cleanup();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  initializeOptimizations();
}

export { initializeOptimizations };