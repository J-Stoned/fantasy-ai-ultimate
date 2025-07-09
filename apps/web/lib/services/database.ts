import { getProductionDatabasePool, db } from '../database/ProductionDatabasePool';
import { supabase } from '../supabase-client';

/**
 * Database Service Layer
 * Provides a unified interface for all database operations
 * Uses ProductionDatabasePool for optimal performance
 */

class DatabaseService {
  private pool = getProductionDatabasePool();
  
  // Keep Supabase client for auth and real-time subscriptions
  private supabase = supabase;

  /**
   * Player Operations
   */
  async getPlayer(playerId: string) {
    return db.getPlayer(playerId);
  }

  async getPlayers(limit: number = 100, offset: number = 0) {
    return this.pool.cachedQuery(
      `players:list:${limit}:${offset}`,
      `SELECT p.*, 
              ps.avg_points, ps.games_played, ps.median_points
       FROM players p
       LEFT JOIN player_performance_summary ps ON p.id = ps.id
       ORDER BY ps.avg_points DESC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [limit, offset],
      300 // 5 minute cache
    );
  }

  async searchPlayers(query: string) {
    return this.pool.query(
      `SELECT * FROM players 
       WHERE name ILIKE $1 OR full_name ILIKE $1
       LIMIT 20`,
      [`%${query}%`],
      'read'
    );
  }

  async updatePlayerStats(playerId: string, stats: any) {
    await db.updatePlayerStats(playerId, stats);
    // Invalidate cache
    await this.pool.redis.del(`player:${playerId}`);
  }

  /**
   * Game Operations
   */
  async getGames(date?: Date) {
    const dateFilter = date || new Date();
    return this.pool.cachedQuery(
      `games:${dateFilter.toISOString().split('T')[0]}`,
      `SELECT g.*, 
              ht.name as home_team_name, ht.abbreviation as home_team_abbr,
              at.name as away_team_name, at.abbreviation as away_team_abbr
       FROM games g
       LEFT JOIN teams ht ON g.home_team_id = ht.id
       LEFT JOIN teams at ON g.away_team_id = at.id
       WHERE DATE(g.game_date) = DATE($1)
       ORDER BY g.game_date`,
      [dateFilter],
      600 // 10 minute cache
    );
  }

  async getGameEvents(gameId: string, limit: number = 1000) {
    return db.getGameEvents(gameId, limit);
  }

  async insertGameEvents(events: any[]) {
    return db.batchInsertEvents(events);
  }

  /**
   * Fantasy Operations
   */
  async getPlayerProjections(gameDate: Date) {
    return this.pool.cachedQuery(
      `projections:${gameDate.toISOString().split('T')[0]}`,
      `SELECT 
         p.id, p.name, p.position, p.team_id,
         fp.projected_points, fp.floor_points, fp.ceiling_points,
         fp.confidence_rating,
         ps.salary, ps.ownership_projection
       FROM players p
       JOIN fantasy_projections fp ON p.id = fp.player_id
       LEFT JOIN player_salaries ps ON p.id = ps.player_id
       WHERE DATE(fp.game_date) = DATE($1)
         AND fp.confidence_rating > 0.6
       ORDER BY fp.projected_points DESC`,
      [gameDate],
      1800 // 30 minute cache
    );
  }

  async getOptimizedLineups(constraints: any) {
    const cacheKey = `lineups:${JSON.stringify(constraints)}`;
    
    // Check GPU cache first
    const cached = await this.pool.redis.getGPUCache(cacheKey);
    if (cached) return cached;
    
    // This will be replaced with actual GPU optimization
    const lineups = await this.pool.query(
      `SELECT * FROM gpu_optimization_cache
       WHERE constraints = $1
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [constraints],
      'read'
    );
    
    return lineups[0]?.optimized_lineups || null;
  }

  /**
   * ML Predictions
   */
  async savePrediction(prediction: {
    gameId: string;
    modelName: string;
    predictionType: string;
    prediction: any;
    confidence: number;
    features?: any;
  }) {
    return this.pool.execute(
      `INSERT INTO ml_predictions 
       (game_id, model_name, prediction_type, prediction, confidence, features)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        prediction.gameId,
        prediction.modelName,
        prediction.predictionType,
        JSON.stringify(prediction.prediction),
        prediction.confidence,
        prediction.features ? JSON.stringify(prediction.features) : null
      ]
    );
  }

  async getRecentPredictions(modelName: string, limit: number = 100) {
    return this.pool.query(
      `SELECT * FROM ml_predictions
       WHERE model_name = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [modelName, limit],
      'analytics'
    );
  }

  /**
   * Real-time Operations
   */
  async trackWebSocketConnection(connectionData: any) {
    return this.pool.execute(
      `INSERT INTO websocket_connections 
       (connection_id, user_id, session_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        connectionData.connectionId,
        connectionData.userId,
        connectionData.sessionId,
        connectionData.ipAddress,
        connectionData.userAgent
      ]
    );
  }

  async updateWebSocketActivity(connectionId: string) {
    return this.pool.execute(
      `UPDATE websocket_connections 
       SET last_ping = NOW(), last_activity = NOW()
       WHERE connection_id = $1`,
      [connectionId]
    );
  }

  /**
   * Analytics Operations
   */
  async getSystemMetrics(component: string, duration: string = '1 hour') {
    return this.pool.query(
      `SELECT 
         metric_name,
         AVG(metric_value) as avg_value,
         MAX(metric_value) as max_value,
         MIN(metric_value) as min_value,
         COUNT(*) as sample_count
       FROM system_metrics
       WHERE component = $1
         AND timestamp > NOW() - INTERVAL '${duration}'
       GROUP BY metric_name`,
      [component],
      'analytics'
    );
  }

  async recordMetric(metric: {
    name: string;
    value: number;
    unit?: string;
    component: string;
    tags?: any;
  }) {
    return this.pool.execute(
      `INSERT INTO system_metrics 
       (metric_name, metric_value, metric_unit, component, tags)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        metric.name,
        metric.value,
        metric.unit || null,
        metric.component,
        metric.tags ? JSON.stringify(metric.tags) : null
      ]
    );
  }

  /**
   * Utility Methods
   */
  async healthCheck() {
    const dbHealth = await this.pool.healthCheck();
    const stats = await this.pool.getPoolStats();
    
    return {
      database: dbHealth,
      pools: stats,
      metrics: this.pool.getMetrics()
    };
  }

  async transaction<T>(
    callback: (client: any) => Promise<T>,
    isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'
  ) {
    return this.pool.transaction(callback, isolationLevel);
  }

  /**
   * Get raw pool access for advanced operations
   */
  get pools() {
    return {
      read: this.pool.read,
      write: this.pool.write,
      analytics: this.pool.analytics,
      realtime: this.pool.realtime
    };
  }

  /**
   * Get Prisma client for ORM operations
   */
  get prisma() {
    return this.pool.orm;
  }

  /**
   * Get Supabase client for auth and real-time
   */
  get auth() {
    return this.supabase.auth;
  }

  get realtime() {
    return this.supabase;
  }
}

// Export singleton instance
export const database = new DatabaseService();

// Export types
export type { DatabaseService };