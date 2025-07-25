#!/usr/bin/env ts-node

/**
 * Database Optimization and Query Analysis Tool
 * Comprehensive database performance analysis and optimization recommendations
 */

import { executeQuery } from '@/lib/services/database';
import { logger } from '@/lib/logging/logger';
import { enterpriseLogger } from '@/lib/logging/enterprise-logger';
import fs from 'fs/promises';
import path from 'path';

interface QueryAnalysis {
  query: string;
  executionTime: number;
  planCost: number;
  rowsReturned: number;
  indexesUsed: string[];
  recommendations: string[];
  optimization: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface DatabaseMetrics {
  connectionCount: number;
  activeQueries: number;
  slowQueries: number;
  indexEfficiency: number;
  cacheHitRatio: number;
  diskIO: number;
  tableStats: TableStats[];
}

interface TableStats {
  tableName: string;
  rowCount: number;
  tableSize: string;
  indexSize: string;
  lastAnalyzed: string;
  fragmentationLevel: number;
  missingIndexes: string[];
}

interface OptimizationReport {
  timestamp: string;
  databaseVersion: string;
  overallHealth: number;
  criticalIssues: number;
  recommendations: string[];
  queryAnalysis: QueryAnalysis[];
  metrics: DatabaseMetrics;
  indexOptimizations: IndexOptimization[];
  performanceBaseline: PerformanceBaseline;
}

interface IndexOptimization {
  table: string;
  column: string;
  type: 'create' | 'drop' | 'rebuild';
  impact: 'high' | 'medium' | 'low';
  sql: string;
  reasoning: string;
}

interface PerformanceBaseline {
  avgQueryTime: number;
  p95QueryTime: number;
  connectionsPerSecond: number;
  transactionsPerSecond: number;
  memoryUsage: number;
  diskUsage: number;
}

export class DatabaseOptimizationAnalyzer {
  private commonQueries: string[] = [
    // Player queries
    `SELECT p.*, s.* FROM players p 
     LEFT JOIN player_stats s ON p.id = s.player_id 
     WHERE p.sport = $1 AND p.active = true`,
    
    // League queries
    `SELECT l.*, COUNT(t.id) as team_count 
     FROM leagues l 
     LEFT JOIN teams t ON l.id = t.league_id 
     GROUP BY l.id`,
    
    // DFS optimization queries
    `SELECT p.id, p.name, p.position, p.salary, p.projected_points,
            ROUND(p.projected_points / p.salary * 1000, 2) as value
     FROM dfs_players p 
     WHERE p.slate_id = $1 AND p.injury_status = 'active'
     ORDER BY value DESC`,
    
    // Fantasy scoring queries
    `SELECT fs.*, p.name, p.position, p.team
     FROM fantasy_scores fs
     JOIN players p ON fs.player_id = p.id
     WHERE fs.week = $1 AND fs.season = $2`,
    
    // User league queries
    `SELECT ul.*, l.name as league_name, l.sport
     FROM user_leagues ul
     JOIN leagues l ON ul.league_id = l.id
     WHERE ul.user_id = $1`,
  ];

  /**
   * Run comprehensive database optimization analysis
   */
  async runAnalysis(): Promise<OptimizationReport> {
    console.log('🔍 Starting Database Optimization Analysis...');
    console.log(`📅 Started: ${new Date().toISOString()}\n`);

    try {
      // Get database version and basic info
      const dbInfo = await this.getDatabaseInfo();
      console.log(`📊 Database: ${dbInfo.version}`);

      // Analyze current metrics
      const metrics = await this.analyzeCurrentMetrics();
      console.log(`📈 Current Metrics: ${metrics.activeQueries} active queries`);

      // Analyze common queries
      const queryAnalysis = await this.analyzeCommonQueries();
      console.log(`🔍 Analyzed ${queryAnalysis.length} common queries`);

      // Analyze table statistics
      const tableStats = await this.analyzeTableStatistics();
      console.log(`📋 Analyzed ${tableStats.length} tables`);

      // Generate index optimization recommendations
      const indexOptimizations = await this.generateIndexOptimizations(tableStats);
      console.log(`🎯 Generated ${indexOptimizations.length} index recommendations`);

      // Establish performance baseline
      const performanceBaseline = await this.establishPerformanceBaseline();
      console.log(`⚡ Performance baseline established`);

      // Calculate overall health score
      const overallHealth = this.calculateHealthScore(metrics, queryAnalysis, tableStats);
      console.log(`🏥 Overall health score: ${overallHealth}/100`);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        metrics, queryAnalysis, tableStats, indexOptimizations
      );

      const report: OptimizationReport = {
        timestamp: new Date().toISOString(),
        databaseVersion: dbInfo.version,
        overallHealth,
        criticalIssues: queryAnalysis.filter(q => q.priority === 'critical').length,
        recommendations,
        queryAnalysis,
        metrics: {
          ...metrics,
          tableStats,
        },
        indexOptimizations,
        performanceBaseline,
      };

      // Save report
      await this.saveReport(report);

      // Log results
      this.logResults(report);

      return report;

    } catch (error) {
      logger.error('Database optimization analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get database version and configuration info
   */
  private async getDatabaseInfo(): Promise<any> {
    try {
      const versionResult = await executeQuery('SELECT version()');
      const configResult = await executeQuery(`
        SELECT name, setting, unit 
        FROM pg_settings 
        WHERE name IN (
          'shared_buffers', 'work_mem', 'maintenance_work_mem',
          'effective_cache_size', 'max_connections', 'checkpoint_completion_target'
        )
      `);

      return {
        version: versionResult[0]?.version || 'Unknown',
        config: configResult.reduce((acc: any, row: any) => {
          acc[row.name] = { value: row.setting, unit: row.unit };
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.warn('Could not retrieve database info', { error: error.message });
      return { version: 'Unknown', config: {} };
    }
  }

  /**
   * Analyze current database metrics
   */
  private async analyzeCurrentMetrics(): Promise<DatabaseMetrics> {
    try {
      // Get connection and activity stats
      const connectionStats = await executeQuery(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity
      `);

      // Get slow queries from pg_stat_statements if available
      let slowQueries = 0;
      try {
        const slowQueryResult = await executeQuery(`
          SELECT count(*) as slow_count
          FROM pg_stat_statements 
          WHERE mean_exec_time > 1000
        `);
        slowQueries = slowQueryResult[0]?.slow_count || 0;
      } catch {
        // pg_stat_statements not available
      }

      // Get cache hit ratio
      const cacheStats = await executeQuery(`
        SELECT 
          round(
            100 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read) + 1)
          ) as cache_hit_ratio
        FROM pg_stat_database
      `);

      // Get index usage stats
      const indexStats = await executeQuery(`
        SELECT 
          round(
            100 * sum(idx_tup_fetch) / (sum(seq_tup_read) + sum(idx_tup_fetch) + 1)
          ) as index_usage_ratio
        FROM pg_stat_user_tables
      `);

      return {
        connectionCount: connectionStats[0]?.total_connections || 0,
        activeQueries: connectionStats[0]?.active_connections || 0,
        slowQueries,
        indexEfficiency: indexStats[0]?.index_usage_ratio || 0,
        cacheHitRatio: cacheStats[0]?.cache_hit_ratio || 0,
        diskIO: 0, // Would need system-level monitoring
        tableStats: [], // Will be populated separately
      };
    } catch (error) {
      logger.error('Failed to analyze current metrics', { error: error.message });
      return {
        connectionCount: 0,
        activeQueries: 0,
        slowQueries: 0,
        indexEfficiency: 0,
        cacheHitRatio: 0,
        diskIO: 0,
        tableStats: [],
      };
    }
  }

  /**
   * Analyze common queries for performance issues
   */
  private async analyzeCommonQueries(): Promise<QueryAnalysis[]> {
    const analyses: QueryAnalysis[] = [];

    for (const query of this.commonQueries) {
      try {
        console.log(`   🔍 Analyzing query: ${query.substring(0, 50)}...`);

        // Get query execution plan
        const planResult = await executeQuery(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`, ['NFL']);
        const plan = planResult[0]?.['QUERY PLAN'][0];

        // Execute query to get actual performance
        const startTime = Date.now();
        const result = await executeQuery(query, ['NFL']);
        const executionTime = Date.now() - startTime;

        // Analyze the plan
        const analysis = this.analyzePlan(query, plan, executionTime, result.length);
        analyses.push(analysis);

      } catch (error) {
        logger.warn('Failed to analyze query', { 
          query: query.substring(0, 100),
          error: error.message 
        });

        // Add failed analysis
        analyses.push({
          query: query.substring(0, 100) + '...',
          executionTime: 0,
          planCost: 0,
          rowsReturned: 0,
          indexesUsed: [],
          recommendations: [`Query analysis failed: ${error.message}`],
          optimization: 'Unable to analyze',
          priority: 'medium',
        });
      }
    }

    return analyses;
  }

  /**
   * Analyze PostgreSQL execution plan
   */
  private analyzePlan(
    query: string, 
    plan: any, 
    executionTime: number, 
    rowsReturned: number
  ): QueryAnalysis {
    const recommendations: string[] = [];
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let optimization = 'Query appears optimal';

    if (!plan) {
      return {
        query: query.substring(0, 100) + '...',
        executionTime,
        planCost: 0,
        rowsReturned,
        indexesUsed: [],
        recommendations: ['Unable to analyze execution plan'],
        optimization: 'Analysis failed',
        priority: 'medium',
      };
    }

    const totalCost = plan['Total Cost'] || 0;
    const actualTime = plan['Actual Total Time'] || executionTime;

    // Extract indexes used
    const indexesUsed = this.extractIndexesFromPlan(plan);

    // Analyze for performance issues
    if (actualTime > 1000) {
      recommendations.push('Query takes longer than 1 second to execute');
      priority = 'critical';
      optimization = 'Requires immediate optimization';
    } else if (actualTime > 500) {
      recommendations.push('Query performance could be improved');
      priority = 'high';
      optimization = 'Consider adding indexes or query optimization';
    }

    if (totalCost > 10000) {
      recommendations.push('High query cost detected - consider query optimization');
      if (priority === 'low') priority = 'medium';
    }

    // Check for sequential scans
    if (this.hasSequentialScan(plan)) {
      recommendations.push('Sequential scan detected - consider adding appropriate indexes');
      if (priority === 'low') priority = 'medium';
      optimization = 'Add indexes to eliminate sequential scans';
    }

    // Check for nested loops with high cost
    if (this.hasExpensiveNestedLoop(plan)) {
      recommendations.push('Expensive nested loop detected - review join conditions');
      if (priority === 'low') priority = 'high';
    }

    // Check for missing index usage
    if (indexesUsed.length === 0 && rowsReturned > 1000) {
      recommendations.push('No indexes used for large result set');
      if (priority === 'low') priority = 'medium';
    }

    if (recommendations.length === 0) {
      recommendations.push('Query performance is acceptable');
      optimization = 'No optimization needed';
    }

    return {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      executionTime: actualTime,
      planCost: totalCost,
      rowsReturned,
      indexesUsed,
      recommendations,
      optimization,
      priority,
    };
  }

  /**
   * Extract indexes used from execution plan
   */
  private extractIndexesFromPlan(plan: any): string[] {
    const indexes: string[] = [];

    function traverse(node: any) {
      if (node['Node Type'] === 'Index Scan' || node['Node Type'] === 'Index Only Scan') {
        if (node['Index Name']) {
          indexes.push(node['Index Name']);
        }
      }

      if (node['Plans']) {
        node['Plans'].forEach(traverse);
      }
    }

    traverse(plan);
    return [...new Set(indexes)]; // Remove duplicates
  }

  /**
   * Check if plan contains sequential scans
   */
  private hasSequentialScan(plan: any): boolean {
    function traverse(node: any): boolean {
      if (node['Node Type'] === 'Seq Scan') {
        return true;
      }

      if (node['Plans']) {
        return node['Plans'].some(traverse);
      }

      return false;
    }

    return traverse(plan);
  }

  /**
   * Check for expensive nested loops
   */
  private hasExpensiveNestedLoop(plan: any): boolean {
    function traverse(node: any): boolean {
      if (node['Node Type'] === 'Nested Loop' && node['Total Cost'] > 5000) {
        return true;
      }

      if (node['Plans']) {
        return node['Plans'].some(traverse);
      }

      return false;
    }

    return traverse(plan);
  }

  /**
   * Analyze table statistics
   */
  private async analyzeTableStatistics(): Promise<TableStats[]> {
    try {
      const tableStatsQuery = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
        FROM pg_stat_user_tables 
        ORDER BY n_live_tup DESC
      `;

      const results = await executeQuery(tableStatsQuery);

      const tableStats: TableStats[] = [];

      for (const row of results) {
        // Calculate fragmentation level
        const fragmentationLevel = row.dead_tuples / Math.max(row.live_tuples, 1) * 100;

        // Get missing indexes for this table
        const missingIndexes = await this.findMissingIndexes(row.tablename);

        tableStats.push({
          tableName: row.tablename,
          rowCount: row.live_tuples,
          tableSize: row.table_size,
          indexSize: row.index_size,
          lastAnalyzed: row.last_analyze || row.last_autoanalyze || 'Never',
          fragmentationLevel: Math.round(fragmentationLevel),
          missingIndexes,
        });
      }

      return tableStats;

    } catch (error) {
      logger.error('Failed to analyze table statistics', { error: error.message });
      return [];
    }
  }

  /**
   * Find missing indexes for a table
   */
  private async findMissingIndexes(tableName: string): Promise<string[]> {
    try {
      // Check for sequential scans on this table
      const seqScanQuery = `
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch
        FROM pg_stat_user_tables 
        WHERE tablename = $1
      `;

      const result = await executeQuery(seqScanQuery, [tableName]);
      if (result.length === 0) return [];

      const stats = result[0];
      const missingIndexes: string[] = [];

      // If sequential scans are much higher than index scans
      if (stats.seq_scan > stats.idx_scan * 2 && stats.seq_tup_read > 1000) {
        missingIndexes.push(`Consider adding indexes to reduce sequential scans on ${tableName}`);
      }

      // Check for foreign key columns without indexes
      const fkQuery = `
        SELECT 
          tc.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
      `;

      const fkResults = await executeQuery(fkQuery, [tableName]);
      for (const fk of fkResults) {
        // Check if there's an index on this foreign key column
        const indexCheckQuery = `
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = $1 
            AND indexdef LIKE '%${fk.column_name}%'
        `;

        const indexExists = await executeQuery(indexCheckQuery, [tableName]);
        if (indexExists.length === 0) {
          missingIndexes.push(`Add index on foreign key column: ${fk.column_name}`);
        }
      }

      return missingIndexes;

    } catch (error) {
      logger.warn('Failed to find missing indexes', { 
        tableName, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Generate index optimization recommendations
   */
  private async generateIndexOptimizations(tableStats: TableStats[]): Promise<IndexOptimization[]> {
    const optimizations: IndexOptimization[] = [];

    for (const table of tableStats) {
      // Recommend indexes for large tables with missing indexes
      if (table.rowCount > 10000 && table.missingIndexes.length > 0) {
        for (const missingIndex of table.missingIndexes) {
          if (missingIndex.includes('foreign key column:')) {
            const columnName = missingIndex.split(':')[1].trim();
            optimizations.push({
              table: table.tableName,
              column: columnName,
              type: 'create',
              impact: 'high',
              sql: `CREATE INDEX CONCURRENTLY idx_${table.tableName}_${columnName} ON ${table.tableName} (${columnName});`,
              reasoning: 'Foreign key columns should be indexed for better join performance',
            });
          }
        }
      }

      // Recommend rebuilding indexes for highly fragmented tables
      if (table.fragmentationLevel > 20) {
        optimizations.push({
          table: table.tableName,
          column: '*',
          type: 'rebuild',
          impact: 'medium',
          sql: `REINDEX TABLE ${table.tableName};`,
          reasoning: `Table has ${table.fragmentationLevel}% fragmentation - rebuild indexes`,
        });
      }

      // Recommend dropping unused indexes
      const unusedIndexes = await this.findUnusedIndexes(table.tableName);
      for (const unusedIndex of unusedIndexes) {
        optimizations.push({
          table: table.tableName,
          column: unusedIndex.column,
          type: 'drop',
          impact: 'low',
          sql: `DROP INDEX CONCURRENTLY ${unusedIndex.indexName};`,
          reasoning: 'Index is not being used and consuming unnecessary space',
        });
      }
    }

    return optimizations;
  }

  /**
   * Find unused indexes
   */
  private async findUnusedIndexes(tableName: string): Promise<any[]> {
    try {
      const unusedIndexQuery = `
        SELECT 
          indexrelname as index_name,
          idx_scan,
          pg_size_pretty(pg_relation_size(indexrelname::regclass)) as index_size
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
          AND relname = $1
          AND idx_scan < 10
          AND indexrelname NOT LIKE '%_pkey'
        ORDER BY idx_scan, pg_relation_size(indexrelname::regclass) DESC
      `;

      const results = await executeQuery(unusedIndexQuery, [tableName]);
      return results.map(row => ({
        indexName: row.index_name,
        column: 'unknown', // Would need more complex query to get column
        scanCount: row.idx_scan,
        size: row.index_size,
      }));

    } catch (error) {
      logger.warn('Failed to find unused indexes', { tableName, error: error.message });
      return [];
    }
  }

  /**
   * Establish performance baseline
   */
  private async establishPerformanceBaseline(): Promise<PerformanceBaseline> {
    try {
      // Run a series of representative queries to establish baseline
      const testQueries = [
        'SELECT COUNT(*) FROM players',
        'SELECT * FROM leagues LIMIT 10',
        'SELECT * FROM users WHERE id = $1',
      ];

      const queryTimes: number[] = [];

      for (const query of testQueries) {
        const startTime = Date.now();
        try {
          if (query.includes('$1')) {
            await executeQuery(query, ['test-id']);
          } else {
            await executeQuery(query);
          }
        } catch {
          // Query might fail, but we still measure time
        }
        queryTimes.push(Date.now() - startTime);
      }

      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const p95QueryTime = queryTimes.sort((a, b) => b - a)[Math.floor(queryTimes.length * 0.05)];

      // Get current memory usage
      const memoryUsage = process.memoryUsage().heapUsed;

      return {
        avgQueryTime,
        p95QueryTime,
        connectionsPerSecond: 0, // Would need monitoring over time
        transactionsPerSecond: 0, // Would need monitoring over time
        memoryUsage,
        diskUsage: 0, // Would need system-level monitoring
      };

    } catch (error) {
      logger.error('Failed to establish performance baseline', { error: error.message });
      return {
        avgQueryTime: 0,
        p95QueryTime: 0,
        connectionsPerSecond: 0,
        transactionsPerSecond: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        diskUsage: 0,
      };
    }
  }

  /**
   * Calculate overall database health score
   */
  private calculateHealthScore(
    metrics: DatabaseMetrics,
    queryAnalysis: QueryAnalysis[],
    tableStats: TableStats[]
  ): number {
    let score = 100;

    // Deduct points for poor cache hit ratio
    if (metrics.cacheHitRatio < 95) {
      score -= (95 - metrics.cacheHitRatio) * 0.5;
    }

    // Deduct points for low index efficiency
    if (metrics.indexEfficiency < 90) {
      score -= (90 - metrics.indexEfficiency) * 0.3;
    }

    // Deduct points for slow queries
    const criticalQueries = queryAnalysis.filter(q => q.priority === 'critical').length;
    const highPriorityQueries = queryAnalysis.filter(q => q.priority === 'high').length;
    
    score -= criticalQueries * 15;
    score -= highPriorityQueries * 8;

    // Deduct points for fragmented tables
    const fragmentedTables = tableStats.filter(t => t.fragmentationLevel > 20).length;
    score -= fragmentedTables * 5;

    // Deduct points for tables that haven't been analyzed
    const unanalyzedTables = tableStats.filter(t => t.lastAnalyzed === 'Never').length;
    score -= unanalyzedTables * 3;

    return Math.max(0, Math.round(score));
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    metrics: DatabaseMetrics,
    queryAnalysis: QueryAnalysis[],
    tableStats: TableStats[],
    indexOptimizations: IndexOptimization[]
  ): string[] {
    const recommendations: string[] = [];

    // Cache hit ratio recommendations
    if (metrics.cacheHitRatio < 95) {
      recommendations.push(
        `Cache hit ratio is ${metrics.cacheHitRatio}% - consider increasing shared_buffers`
      );
    }

    // Index efficiency recommendations
    if (metrics.indexEfficiency < 90) {
      recommendations.push(
        `Index efficiency is ${metrics.indexEfficiency}% - review and add missing indexes`
      );
    }

    // Slow query recommendations
    const slowQueries = queryAnalysis.filter(q => q.executionTime > 500);
    if (slowQueries.length > 0) {
      recommendations.push(
        `${slowQueries.length} slow queries detected - optimize high-impact queries first`
      );
    }

    // Fragmentation recommendations
    const fragmentedTables = tableStats.filter(t => t.fragmentationLevel > 20);
    if (fragmentedTables.length > 0) {
      recommendations.push(
        `${fragmentedTables.length} tables have high fragmentation - schedule VACUUM/REINDEX operations`
      );
    }

    // Statistics recommendations
    const unanalyzedTables = tableStats.filter(t => t.lastAnalyzed === 'Never');
    if (unanalyzedTables.length > 0) {
      recommendations.push(
        `${unanalyzedTables.length} tables need ANALYZE - update table statistics for better query planning`
      );
    }

    // Index optimization recommendations
    const highImpactIndexes = indexOptimizations.filter(i => i.impact === 'high').length;
    if (highImpactIndexes > 0) {
      recommendations.push(
        `${highImpactIndexes} high-impact index optimizations available - implement for immediate performance gains`
      );
    }

    // Connection recommendations
    if (metrics.connectionCount > 100) {
      recommendations.push(
        'High connection count detected - consider connection pooling optimization'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Database performance is optimal - continue regular monitoring');
    }

    return recommendations;
  }

  /**
   * Save optimization report to file
   */
  private async saveReport(report: OptimizationReport): Promise<void> {
    const reportPath = path.join(process.cwd(), 'database-optimization-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Also save SQL script with optimizations
    const sqlOptimizations = report.indexOptimizations
      .map(opt => `-- ${opt.reasoning}\n${opt.sql}`)
      .join('\n\n');
    
    const sqlPath = path.join(process.cwd(), 'database-optimizations.sql');
    await fs.writeFile(sqlPath, sqlOptimizations);

    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`📄 SQL optimizations saved to: ${sqlPath}`);
  }

  /**
   * Log analysis results
   */
  private logResults(report: OptimizationReport): void {
    // Log to enterprise audit system
    enterpriseLogger.logBusinessOperation(
      'database-optimization-analysis',
      'completed',
      {
        overallHealth: report.overallHealth,
        criticalIssues: report.criticalIssues,
        totalRecommendations: report.recommendations.length,
        businessContext: 'performance-optimization',
      }
    );

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 DATABASE OPTIMIZATION ANALYSIS COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🏥 Overall Health Score: ${report.overallHealth}/100`);
    console.log(`🚨 Critical Issues: ${report.criticalIssues}`);
    console.log(`💡 Total Recommendations: ${report.recommendations.length}`);
    console.log(`📈 Cache Hit Ratio: ${report.metrics.cacheHitRatio}%`);
    console.log(`🔍 Index Efficiency: ${report.metrics.indexEfficiency}%`);
    console.log(`📊 Active Connections: ${report.metrics.activeQueries}`);
    console.log('═══════════════════════════════════════════════════');

    if (report.recommendations.length > 0) {
      console.log('\n🔧 TOP RECOMMENDATIONS:');
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    console.log('\n✅ Analysis complete! Check the report files for detailed recommendations.');
  }
}

// Main execution
if (require.main === module) {
  const analyzer = new DatabaseOptimizationAnalyzer();
  
  analyzer.runAnalysis().then(report => {
    const exitCode = report.overallHealth >= 70 && report.criticalIssues === 0 ? 0 : 1;
    process.exit(exitCode);
  }).catch(error => {
    console.error('❌ Database optimization analysis failed:', error);
    process.exit(1);
  });
}

export { DatabaseOptimizationAnalyzer };