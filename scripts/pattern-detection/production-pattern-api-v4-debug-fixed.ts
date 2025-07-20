import express from 'express';
import cors from 'cors';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { getHybridCache } from '../cache/hybrid-cache.js';
// Fixed import path - using absolute path from utils directory
import { queryMany, queryOne, getPool } from '../utils/local-db-pool.js';
import { FIXED_PATTERN_QUERIES } from './fix-pattern-queries-v3.js';

// Load environment variables from root .env file
dotenv.config({ path: './.env' });

const app = express();
app.use(cors());
app.use(express.json());

// Simple API key configuration
const API_KEYS = {
  'sk_starter_test_key': 'starter',
  'sk_pro_test_key': 'professional',
  'sk_enterprise_test_key': 'enterprise'
};

// Rate limit tracking (simple in-memory)
const rateLimitMap = new Map();
const RATE_LIMITS = {
  starter: { max: 100, window: 15 * 60 * 1000 },
  professional: { max: 500, window: 15 * 60 * 1000 },
  enterprise: { max: 10000, window: 15 * 60 * 1000 }
};

// Clean up old rate limit entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (data.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

// Simple API key middleware
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'No API key provided' });
  }

  const tier = API_KEYS[apiKey];
  if (!tier) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Set both tier and user for compatibility
  req.tier = tier;
  req.user = {
    id: `api-${tier}-${apiKey.slice(-6)}`,
    tier: tier,
    email: `${tier}@fantasy-ai.com`
  };

  // Simple rate limiting
  const now = Date.now();
  const limitKey = apiKey;
  const limit = RATE_LIMITS[tier];
  
  let userLimit = rateLimitMap.get(limitKey);
  if (!userLimit || userLimit.resetTime < now) {
    userLimit = {
      count: 0,
      resetTime: now + limit.window
    };
    rateLimitMap.set(limitKey, userLimit);
  }

  userLimit.count++;

  if (userLimit.count > limit.max) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Try again in ${retryAfter} seconds`,
      limit: limit.max,
      window: limit.window,
      tier
    });
  }

  // Set rate limit headers
  res.set('X-RateLimit-Limit', limit.max.toString());
  res.set('X-RateLimit-Remaining', (limit.max - userLimit.count).toString());
  res.set('X-RateLimit-Reset', new Date(userLimit.resetTime).toISOString());

  next();
};

// Tier-based access control
const requireTier = (minTier) => {
  const tiers = ['starter', 'professional', 'enterprise'];
  return (req, res, next) => {
    const userTierIndex = tiers.indexOf(req.tier);
    const minTierIndex = tiers.indexOf(minTier);
    
    if (userTierIndex < minTierIndex) {
      return res.status(403).json({ 
        error: 'Insufficient tier',
        message: `This endpoint requires ${minTier} tier or higher. Current tier: ${req.tier}` 
      });
    }
    next();
  };
};

// Cache configuration
const CACHE_CONFIG = {
  patternResults: {
    namespace: 'pattern_results',
    ttl: 5 * 60 * 1000, // 5 minutes
  },
  dbStats: {
    namespace: 'db_stats',
    ttl: 15 * 60 * 1000, // 15 minutes
  }
};

// Initialize
const cache = getHybridCache();
let dbPool = null;

// Log current database configuration
console.log(chalk.cyan('Database Configuration:'));
console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

try {
  dbPool = getPool();
  console.log(chalk.green('🚀 PostgreSQL pool created successfully'));
} catch (error) {
  console.error(chalk.red('❌ Failed to create database pool:'), error);
  // Don't exit, let the error propagate when queries are made
}

// Health check endpoint (no auth required)
app.get('/health', async (req, res) => {
  try {
    const result = await queryOne('SELECT COUNT(*) as count FROM games');
    const cacheStatus = await cache.health();
    
    res.json({ 
      status: 'healthy',
      database: 'connected',
      cache: cacheStatus,
      gameCount: parseInt(result.count),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// DEBUG endpoint to run queries directly (no cache)
app.get('/debug/pattern/:pattern', apiKeyMiddleware, requireTier('professional'), async (req, res) => {
  try {
    const { pattern } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    
    if (!FIXED_PATTERN_QUERIES[pattern]) {
      return res.status(404).json({ 
        success: false,
        error: `Pattern '${pattern}' not found` 
      });
    }
    
    const query = FIXED_PATTERN_QUERIES[pattern] + ` LIMIT ${limit}`;
    
    console.log(chalk.yellow(`\n🔍 DEBUG: Running query for pattern '${pattern}'`));
    console.log(chalk.gray(query.substring(0, 200) + '...'));
    
    const startTime = Date.now();
    const results = await queryMany(query);
    const duration = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Query completed in ${duration}ms, found ${results.length} results`));
    
    res.json({
      success: true,
      pattern,
      query: query,
      executionTime: duration,
      count: results.length,
      data: results,
      debug: true
    });
  } catch (error) {
    console.error(chalk.red(`❌ Debug query error:`), error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Pattern detection endpoints with cache bypass option
app.get('/patterns', apiKeyMiddleware, requireTier('starter'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const pattern = req.query.pattern;
    const nocache = req.query.nocache === 'true';
    
    if (nocache) {
      console.log(chalk.yellow('🔍 Cache bypass requested'));
    }
    
    const cacheKey = { pattern, limit, offset };
    
    const fetchData = async () => {
      if (pattern && FIXED_PATTERN_QUERIES[pattern]) {
        const query = `${FIXED_PATTERN_QUERIES[pattern]} LIMIT $1 OFFSET $2`;
        console.log(chalk.gray(`Executing pattern query: ${pattern}`));
        return await queryMany(query, [limit, offset]);
      } else {
        // Return all patterns
        const allResults = {};
        for (const [patternName, query] of Object.entries(FIXED_PATTERN_QUERIES)) {
          const limitedQuery = `${query} LIMIT $1 OFFSET $2`;
          console.log(chalk.gray(`Executing pattern query: ${patternName}`));
          allResults[patternName] = await queryMany(limitedQuery, [limit, offset]);
        }
        return allResults;
      }
    };
    
    const results = nocache 
      ? await fetchData()
      : await cache.get(
          CACHE_CONFIG.patternResults.namespace,
          cacheKey,
          fetchData,
          CACHE_CONFIG.patternResults.ttl
        );
    
    res.json({
      success: true,
      data: results,
      limit,
      offset,
      cached: nocache ? false : (results._cached || false)
    });
  } catch (error) {
    console.error('Pattern detection error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Specific pattern endpoint with cache bypass
app.get('/patterns/:pattern', apiKeyMiddleware, requireTier('starter'), async (req, res) => {
  try {
    const { pattern } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const nocache = req.query.nocache === 'true';
    
    if (!FIXED_PATTERN_QUERIES[pattern]) {
      // List available patterns
      const availablePatterns = Object.keys(FIXED_PATTERN_QUERIES);
      return res.status(404).json({ 
        success: false,
        error: `Pattern '${pattern}' not found`,
        availablePatterns: availablePatterns,
        hint: `Try one of: ${availablePatterns.join(', ')}`
      });
    }
    
    if (nocache) {
      console.log(chalk.yellow(`🔍 Cache bypass requested for pattern: ${pattern}`));
    }
    
    const cacheKey = { pattern, limit, offset };
    
    const fetchData = async () => {
      const query = `${FIXED_PATTERN_QUERIES[pattern]} LIMIT $1 OFFSET $2`;
      console.log(chalk.gray(`Executing query for pattern: ${pattern}`));
      console.log(chalk.gray(`Query preview: ${query.substring(0, 150)}...`));
      
      const results = await queryMany(query, [limit, offset]);
      console.log(chalk.green(`Found ${results.length} results`));
      return results;
    };
    
    const results = nocache
      ? await fetchData()
      : await cache.get(
          CACHE_CONFIG.patternResults.namespace,
          cacheKey,
          fetchData,
          CACHE_CONFIG.patternResults.ttl
        );
    
    res.json({
      success: true,
      pattern,
      data: results,
      count: results.length,
      limit,
      offset,
      cached: nocache ? false : (results._cached || false)
    });
  } catch (error) {
    console.error(`Pattern ${req.params.pattern} error:`, error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      hint: 'Check database connection and query syntax'
    });
  }
});

// Database stats endpoint
app.get('/stats', apiKeyMiddleware, requireTier('professional'), async (req, res) => {
  try {
    const stats = await cache.get(
      CACHE_CONFIG.dbStats.namespace,
      'overall',
      async () => {
        const [games, players, teams, stats] = await Promise.all([
          queryOne('SELECT COUNT(*) as count FROM games'),
          queryOne('SELECT COUNT(*) as count FROM players'),
          queryOne('SELECT COUNT(*) as count FROM teams'),
          queryOne('SELECT COUNT(*) as count FROM player_game_logs')
        ]);
        
        return {
          games: parseInt(games.count),
          players: parseInt(players.count),
          teams: parseInt(teams.count),
          playerStats: parseInt(stats.count)
        };
      },
      CACHE_CONFIG.dbStats.ttl
    );
    
    res.json({
      success: true,
      data: stats,
      cached: stats._cached || false
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Cache stats endpoint
app.get('/cache/stats', apiKeyMiddleware, requireTier('professional'), async (req, res) => {
  try {
    const stats = await cache.stats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Fixed cache invalidation endpoint
app.post('/cache/invalidate', apiKeyMiddleware, requireTier('enterprise'), async (req, res) => {
  try {
    // Accept both with and without pattern
    const pattern = req.body?.pattern;
    
    if (pattern) {
      const count = await cache.invalidatePattern(pattern);
      res.json({ 
        success: true,
        message: `Invalidated ${count} cache entries matching pattern: ${pattern}` 
      });
    } else {
      await cache.clear();
      res.json({ 
        success: true,
        message: 'All cache entries cleared' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 3337;

app.listen(PORT, async () => {
  console.log(chalk.green(`\n🚀 10X OPTIMIZED PATTERN DETECTION API (DEBUG VERSION - FIXED)`));
  console.log(chalk.blue(`📡 Server running on http://localhost:${PORT}`));
  console.log(chalk.yellow(`\n⚡ DEBUG FEATURES:`));
  console.log(chalk.green(`  ✅ Cache bypass with ?nocache=true`));
  console.log(chalk.green(`  ✅ Debug endpoint at /debug/pattern/:pattern`));
  console.log(chalk.green(`  ✅ Query logging in console`));
  console.log(chalk.green(`  ✅ Fixed cache invalidation`));
  console.log(chalk.green(`  ✅ Using main .env file for database config`));
  
  console.log(chalk.cyan(`\n🔑 API KEYS:`));
  console.log(chalk.gray(`  Starter:      sk_starter_test_key`));
  console.log(chalk.gray(`  Professional: sk_pro_test_key`));
  console.log(chalk.gray(`  Enterprise:   sk_enterprise_test_key`));
  
  console.log(chalk.cyan(`\n📊 API ENDPOINTS:`));
  console.log(chalk.gray(`  GET  /health                    - Health check (no auth)`));
  console.log(chalk.gray(`  GET  /patterns?nocache=true     - All patterns with cache bypass`));
  console.log(chalk.gray(`  GET  /patterns/:pattern?nocache=true - Specific pattern`));
  console.log(chalk.gray(`  GET  /debug/pattern/:pattern    - Debug query execution`));
  console.log(chalk.gray(`  GET  /stats                     - Database stats`));
  console.log(chalk.gray(`  GET  /cache/stats               - Cache performance`));
  console.log(chalk.gray(`  POST /cache/invalidate          - Clear cache`));
  
  console.log(chalk.magenta(`\n💎 RATE LIMITS:`));
  console.log(chalk.gray(`  Starter:      100 requests / 15 minutes`));
  console.log(chalk.gray(`  Professional: 500 requests / 15 minutes`));
  console.log(chalk.gray(`  Enterprise:   10,000 requests / 15 minutes`));
  
  // Don't warm cache on startup to avoid caching empty results
  console.log(chalk.yellow(`\n⚠️  Cache warming DISABLED to prevent empty result caching`));
  
  console.log(chalk.green(`\n✨ DEBUG API READY! Test with nocache=true 🚀`));
});