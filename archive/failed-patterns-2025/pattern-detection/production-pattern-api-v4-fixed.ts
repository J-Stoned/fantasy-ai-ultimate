#!/usr/bin/env tsx
/**
 * 🚀 PRODUCTION PATTERN API V4 - FIXED VERSION
 * 
 * Fixed initialization issues with cache and middleware
 */

import express from 'express';
import cors from 'cors';
import chalk from 'chalk';

const app = express();
app.use(cors());
app.use(express.json());

// Add a root route
app.get('/', (req, res) => {
  res.json({ message: '🚀 Fantasy AI Pattern Detection API V4', status: 'running' });
});

// Health check (no dependencies)
app.get('/health', async (req, res) => {
  res.json({
    status: 'healthy',
    message: 'API is running',
    version: 'v4-fixed',
    endpoints: [
      'GET /',
      'GET /health',
      'GET /patterns',
      'GET /patterns/:pattern',
      'GET /stats'
    ]
  });
});

// Simplified pattern queries
const PATTERN_QUERIES = {
  backToBackFade: `
    WITH team_games AS (
      SELECT 
        g.id,
        g.away_team_id,
        g.home_team_id,
        g.start_time::timestamp,
        g.sport,
        g.home_score,
        g.away_score,
        LAG(g.start_time::timestamp) OVER (PARTITION BY g.away_team_id ORDER BY g.start_time) as prev_game_time
      FROM games g
      WHERE g.status = 'final'
        AND g.start_time IS NOT NULL
    )
    SELECT 
      tg.*,
      EXTRACT(EPOCH FROM (tg.start_time - tg.prev_game_time))/3600 as hours_between_games
    FROM team_games tg
    WHERE tg.prev_game_time IS NOT NULL
      AND EXTRACT(EPOCH FROM (tg.start_time - tg.prev_game_time))/3600 < 30
    LIMIT 100
  `,
  
  revengeGame: `
    WITH matchups AS (
      SELECT 
        g1.id,
        g1.home_team_id,
        g1.away_team_id,
        g1.start_time::timestamp,
        g1.sport,
        g1.home_score,
        g1.away_score,
        g2.id as prev_game_id,
        g2.home_score as prev_home_score,
        g2.away_score as prev_away_score,
        ABS(g2.home_score - g2.away_score) as prev_margin
      FROM games g1
      JOIN games g2 ON 
        ((g1.home_team_id = g2.away_team_id AND g1.away_team_id = g2.home_team_id) OR
         (g1.home_team_id = g2.home_team_id AND g1.away_team_id = g2.away_team_id))
        AND g2.start_time < g1.start_time
        AND g2.status = 'final'
        AND g1.sport = g2.sport
      WHERE g1.status = 'final'
        AND g1.home_score IS NOT NULL
        AND g1.away_score IS NOT NULL
        AND g2.home_score IS NOT NULL
        AND g2.away_score IS NOT NULL
    )
    SELECT DISTINCT ON (id) *
    FROM matchups
    WHERE prev_margin >= 20
    ORDER BY id, prev_game_id DESC
    LIMIT 100
  `
};

// Lazy load dependencies after server starts
let dbPool: any = null;
let cache: any = null;

async function initializeDependencies() {
  try {
    console.log(chalk.yellow('🔄 Initializing dependencies...'));
    
    // Load database pool
    const poolModule = await import('../utils/local-db-pool');
    dbPool = poolModule;
    console.log(chalk.green('✅ Database pool loaded'));
    
    // Load cache (but don't let it crash the server)
    try {
      const cacheModule = await import('../cache/hybrid-cache');
      cache = cacheModule.getHybridCache();
      console.log(chalk.green('✅ Cache loaded'));
    } catch (cacheError) {
      console.log(chalk.yellow('⚠️  Cache initialization failed, running without cache'));
      console.log(chalk.gray(`   ${cacheError.message}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to initialize dependencies:'), error);
  }
}

// Pattern endpoints
app.get('/patterns/:pattern', async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database not initialized yet' });
  }
  
  const { pattern } = req.params;
  const patternQuery = PATTERN_QUERIES[pattern];
  
  if (!patternQuery) {
    return res.status(404).json({ error: 'Pattern not found' });
  }
  
  try {
    const start = Date.now();
    const games = await dbPool.queryMany(patternQuery);
    const queryTime = Date.now() - start;
    
    res.json({
      pattern,
      count: games.length,
      queryTime: `${queryTime}ms`,
      games: games.slice(0, 10) // Return first 10 for testing
    });
  } catch (error) {
    console.error(chalk.red(`Error in pattern ${pattern}:`), error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/patterns', async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database not initialized yet' });
  }
  
  try {
    const patterns = Object.keys(PATTERN_QUERIES);
    const results = {};
    let totalQueryTime = 0;
    
    for (const pattern of patterns) {
      const start = Date.now();
      // Don't append LIMIT to queries that already have it
      const query = PATTERN_QUERIES[pattern];
      const games = await dbPool.queryMany(query);
      const queryTime = Date.now() - start;
      totalQueryTime += queryTime;
      
      results[pattern] = {
        count: games.length,
        queryTime: `${queryTime}ms`,
        sample: games.slice(0, 5) // Take first 5 for sample
      };
    }
    
    res.json({
      patterns: results,
      totalQueryTime: `${totalQueryTime}ms`,
      avgQueryTime: `${(totalQueryTime / patterns.length).toFixed(0)}ms`
    });
  } catch (error) {
    console.error(chalk.red('Error fetching patterns:'), error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/stats', async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({ error: 'Database not initialized yet' });
  }
  
  try {
    const stats = await dbPool.queryOne(`
      SELECT 
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT g.id) FILTER (WHERE g.home_score IS NOT NULL) as completed_games,
        COUNT(DISTINCT t.id) as total_teams,
        COUNT(DISTINCT p.id) as total_players
      FROM games g
      CROSS JOIN teams t
      CROSS JOIN players p
      WHERE g.status = 'final'
    `);
    
    res.json({
      database: stats,
      cache: cache ? cache.getStats() : { status: 'not available' }
    });
  } catch (error) {
    console.error(chalk.red('Error fetching stats:'), error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found', 
    path: req.path,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /patterns',
      'GET /patterns/:pattern',
      'GET /stats'
    ]
  });
});

const PORT = process.env.PORT || 3337;

app.listen(PORT, async () => {
  console.log(chalk.green(`\n🚀 FANTASY AI PATTERN DETECTION API V4 (FIXED)`));
  console.log(chalk.blue(`📡 Server running on http://localhost:${PORT}`));
  console.log(chalk.yellow(`\n🔄 Initializing database and cache...`));
  
  // Initialize dependencies after server starts
  await initializeDependencies();
  
  console.log(chalk.cyan(`\n📊 API ENDPOINTS:`));
  console.log(chalk.gray(`  GET  /                    - API info`));
  console.log(chalk.gray(`  GET  /health              - Health check`));
  console.log(chalk.gray(`  GET  /patterns            - All patterns`));
  console.log(chalk.gray(`  GET  /patterns/:pattern   - Specific pattern`));
  console.log(chalk.gray(`  GET  /stats               - Database stats`));
  
  console.log(chalk.cyan(`\n📊 AVAILABLE PATTERNS:`));
  Object.keys(PATTERN_QUERIES).forEach(pattern => {
    console.log(chalk.gray(`  - ${pattern}`));
  });
  
  console.log(chalk.green(`\n✨ API READY! Test with:`));
  console.log(chalk.yellow(`curl http://localhost:${PORT}/health`));
});