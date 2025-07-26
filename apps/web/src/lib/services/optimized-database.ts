/**
 * 🚀 Optimized Database Service
 * High-performance database operations with caching and N+1 prevention
 */

import { Pool, PoolClient } from 'pg';
import { cache } from './cache';
import { logger } from '../logging/logger';

export interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number; // seconds
  includeRelations?: string[];
  batchSize?: number;
}

export interface QueryMetrics {
  queryTime: number;
  cacheHit: boolean;
  rowCount: number;
  query: string;
}

export class OptimizedDatabaseService {
  private pool: Pool;
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();
  private slowQueryThreshold = 100; // milliseconds

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fantasy_ai_local',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 30, // Increased pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statement_timeout: 5000, // 5 second query timeout
      query_timeout: 5000,
    });

    // Enable query logging in development
    if (process.env.NODE_ENV === 'development') {
      this.pool.on('acquire', () => {
        logger.info('🔌 Database connection acquired');
      });
      this.pool.on('release', () => {
        logger.info('🔓 Database connection released');
      });
    }
  }

  /**
   * Execute optimized query with caching
   */
  async query<T>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(text, params);
    
    // Check cache first
    if (options.cache) {
      const cached = await cache.get<T[]>(cacheKey);
      if (cached) {
        this.recordMetrics(text, {
          queryTime: Date.now() - startTime,
          cacheHit: true,
          rowCount: cached.length,
          query: text
        });
        return cached;
      }
    }

    // Execute query
    const result = await this.pool.query(text, params);
    const queryTime = Date.now() - startTime;

    // Log slow queries
    if (queryTime > this.slowQueryThreshold) {
      logger.warn('⚠️ Slow query detected (${queryTime}ms):'text.substring(0, 100));
    }

    // Cache result
    if (options.cache && result.rows.length > 0) {
      await cache.set(cacheKey, result.rows, options.cacheTTL || 300);
    }

    this.recordMetrics(text, {
      queryTime,
      cacheHit: false,
      rowCount: result.rowCount || 0,
      query: text
    });

    return result.rows;
  }

  /**
   * Batch insert with prepared statements
   */
  async batchInsert<T>(
    table: string,
    columns: string[],
    values: T[][],
    options: { onConflict?: string; batchSize?: number } = {}
  ): Promise<number> {
    const batchSize = options.batchSize || 1000;
    let totalInserted = 0;
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Process in batches
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const placeholders = batch.map((_, rowIndex) => 
          `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
        ).join(', ');
        
        const flatValues = batch.flat();
        // Escape table and column names to prevent SQL injection
        const escapedTable = `"${table.replace(/"/g, '""')}"`;
        const escapedColumns = columns.map(col => `"${col.replace(/"/g, '""')}"`);
        
        const query = `
          INSERT INTO ${escapedTable} (${escapedColumns.join(', ')})
          VALUES ${placeholders}
          ${options.onConflict || ''}
        `;
        
        const result = await client.query(query, flatValues);
        totalInserted += result.rowCount || 0;
      }
      
      await client.query('COMMIT');
      return totalInserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Optimized player queries with JOINs to prevent N+1
   */
  async getPlayersWithStats(leagueId: string): Promise<any[]> {
    const query = `
      SELECT 
        p.*,
        ps.games_played,
        ps.total_points,
        ps.avg_points,
        ps.last_game_points,
        t.name as team_name,
        t.abbreviation as team_abbr,
        COALESCE(pp.points, 0) as projected_points
      FROM fantasy_players p
      LEFT JOIN player_stats ps ON p.id = ps.player_id
      LEFT JOIN teams t ON p.team = t.abbreviation
      LEFT JOIN player_projections pp ON p.id = pp.player_id
      WHERE p.league_id = $1
      ORDER BY ps.avg_points DESC NULLS LAST
    `;
    
    return this.query(query, [leagueId], { cache: true, cacheTTL: 60 });
  }

  /**
   * Optimized league queries with aggregated data
   */
  async getLeagueWithDetails(leagueId: string): Promise<any> {
    const query = `
      WITH league_stats AS (
        SELECT 
          l.*,
          COUNT(DISTINCT p.id) as total_players,
          COUNT(DISTINCT p.team_id) as teams_with_players,
          AVG(ps.avg_points) as league_avg_points
        FROM fantasy_leagues l
        LEFT JOIN fantasy_players p ON l.id = p.league_id
        LEFT JOIN player_stats ps ON p.id = ps.player_id
        WHERE l.id = $1
        GROUP BY l.id
      )
      SELECT * FROM league_stats
    `;
    
    const result = await this.query(query, [leagueId], { cache: true, cacheTTL: 300 });
    return result[0] || null;
  }

  /**
   * Optimized contest queries with lineup data
   */
  async getContestsWithLineups(userId: string, limit = 20): Promise<any[]> {
    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT l.id) as lineup_count,
        COALESCE(SUM(l.projected_points), 0) as total_projected,
        COALESCE(AVG(l.actual_points), 0) as avg_actual,
        json_agg(
          json_build_object(
            'id', l.id,
            'name', l.name,
            'projected', l.projected_points,
            'actual', l.actual_points
          ) ORDER BY l.projected_points DESC
        ) FILTER (WHERE l.id IS NOT NULL) as lineups
      FROM contests c
      LEFT JOIN lineups l ON c.id = l.contest_id AND l.user_id = $1
      WHERE c.start_time > NOW()
      GROUP BY c.id
      ORDER BY c.start_time ASC
      LIMIT $2
    `;
    
    return this.query(query, [userId, limit], { cache: true, cacheTTL: 30 });
  }

  /**
   * Batch load related data to prevent N+1
   */
  async batchLoadRelations<T extends { id: string }>(
    items: T[],
    relation: string,
    foreignKey: string
  ): Promise<Map<string, any[]>> {
    if (items.length === 0) return new Map();
    
    const ids = items.map(item => item.id);
    // Escape table and column names to prevent SQL injection
    const escapedRelation = `"${relation.replace(/"/g, '""')}"`;
    const escapedForeignKey = `"${foreignKey.replace(/"/g, '""')}"`;
    
    const query = `
      SELECT * FROM ${escapedRelation}
      WHERE ${escapedForeignKey} = ANY($1)
    `;
    
    const relations = await this.query(query, [ids], { cache: true });
    
    // Group by foreign key
    const grouped = new Map<string, any[]>();
    for (const rel of relations) {
      const key = rel[foreignKey];
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(rel);
    }
    
    return grouped;
  }

  /**
   * Create optimized indexes for common queries
   */
  async createOptimizedIndexes(): Promise<void> {
    const indexes = [
      // Player queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_league_position ON fantasy_players(league_id, position)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_team ON fantasy_players(team)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_projected ON fantasy_players(projected_points DESC)',
      
      // Stats queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_player_avg ON player_stats(player_id, avg_points DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_recent ON player_stats(updated_at DESC)',
      
      // Contest queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contests_start ON contests(start_time)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contests_sport_type ON contests(sport, contest_type)',
      
      // Lineup queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lineups_user_contest ON lineups(user_id, contest_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lineups_points ON lineups(projected_points DESC)',
      
      // ML queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_player_date ON ml_predictions(player_id, prediction_date DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_sport ON ml_training_data(sport, created_at DESC)',
    ];

    for (const index of indexes) {
      try {
        await this.pool.query(index);
        logger.info('✅ Index created:', { data: index.match(/idx_\w+/ })?.[0]);
      } catch (error) {
        logger.error('Failed to create index:', { error: error });
      }
    }
  }

  /**
   * Query performance monitoring
   */
  async getQueryPerformanceStats(): Promise<{
    slowQueries: QueryMetrics[];
    averageQueryTime: number;
    cacheHitRate: number;
  }> {
    const allMetrics = Array.from(this.queryMetrics.values()).flat();
    const slowQueries = allMetrics
      .filter(m => m.queryTime > this.slowQueryThreshold)
      .sort((a, b) => b.queryTime - a.queryTime)
      .slice(0, 10);
    
    const avgTime = allMetrics.reduce((sum, m) => sum + m.queryTime, 0) / allMetrics.length || 0;
    const cacheHits = allMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = (cacheHits / allMetrics.length) * 100 || 0;
    
    return {
      slowQueries,
      averageQueryTime: avgTime,
      cacheHitRate
    };
  }

  /**
   * Connection pool health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    poolStats: any;
    queryStats: any;
  }> {
    try {
      const start = Date.now();
      await this.pool.query('SELECT 1');
      const pingTime = Date.now() - start;
      
      const poolStats = {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingRequests: this.pool.waitingCount,
        pingTime
      };
      
      const queryStats = await this.getQueryPerformanceStats();
      
      return {
        healthy: pingTime < 100,
        poolStats,
        queryStats
      };
    } catch (error) {
      return {
        healthy: false,
        poolStats: { error: error.message },
        queryStats: null
      };
    }
  }

  /**
   * Helper methods
   */
  private getCacheKey(query: string, params?: any[]): string {
    return `db:${Buffer.from(query + JSON.stringify(params || [])).toString('base64').substring(0, 64)}`;
  }

  private recordMetrics(query: string, metrics: QueryMetrics): void {
    const key = query.substring(0, 50);
    if (!this.queryMetrics.has(key)) {
      this.queryMetrics.set(key, []);
    }
    
    const metricsList = this.queryMetrics.get(key)!;
    metricsList.push(metrics);
    
    // Keep only last 100 metrics per query
    if (metricsList.length > 100) {
      metricsList.shift();
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.pool.end();
    logger.info('🧹 Optimized database connections closed');
  }
}

// Export singleton instance
export const optimizedDB = new OptimizedDatabaseService();