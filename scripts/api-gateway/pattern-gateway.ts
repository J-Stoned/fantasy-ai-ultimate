/**
 * 🔥 FANTASY AI PATTERN API GATEWAY 🔥
 * Unifies Pattern API V4 (port 3337) and Unified Pattern API (port 3336)
 * Provides single endpoint for all pattern detection needs
 */

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { PatternCache, cacheMiddleware } from './redis-cache';

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);

// API endpoints configuration
const PATTERN_API_V4 = 'http://localhost:3337';
const UNIFIED_PATTERN_API = 'http://localhost:3336';

// Health check
app.get('/health', async (req, res) => {
  const cacheStats = await PatternCache.getStats();
  
  res.json({ 
    status: 'healthy', 
    service: 'pattern-gateway',
    timestamp: new Date().toISOString(),
    apis: {
      v4: PATTERN_API_V4,
      unified: UNIFIED_PATTERN_API
    },
    cache: cacheStats
  });
});

// Cache management endpoints
app.post('/api/cache/clear', async (req, res) => {
  await PatternCache.flush();
  res.json({ success: true, message: 'Cache cleared' });
});

app.get('/api/cache/stats', async (req, res) => {
  const stats = await PatternCache.getStats();
  res.json(stats);
});

/**
 * GET /api/patterns/all
 * Combines patterns from both APIs
 */
app.get('/api/patterns/all', 
  cacheMiddleware(() => 'patterns:all', 300),
  async (req, res) => {
  try {
    // Fetch from both APIs in parallel
    const [v4Response, unifiedResponse] = await Promise.all([
      axios.get(`${PATTERN_API_V4}/api/v4/patterns`).catch(err => ({ data: [] })),
      axios.get(`${UNIFIED_PATTERN_API}/api/unified/stats`).catch(err => ({ data: {} }))
    ]);

    // Combine results
    const combinedPatterns = {
      v4Patterns: v4Response.data,
      unifiedStats: unifiedResponse.data,
      totalPatterns: (v4Response.data?.length || 0) + (unifiedResponse.data?.patterns?.length || 0),
      timestamp: new Date().toISOString()
    };

    res.json(combinedPatterns);
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: 'Failed to fetch patterns' });
  }
});

/**
 * POST /api/patterns/analyze
 * Analyze a game using both pattern systems
 */
app.post('/api/patterns/analyze', async (req, res) => {
  const { gameId, sport, homeTeam, awayTeam } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'gameId is required' });
  }

  // Check cache first
  const cached = await PatternCache.get(`analysis:${gameId}`);
  if (cached) {
    return res.json(cached);
  }
  const { gameId, sport, homeTeam, awayTeam } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'gameId is required' });
  }

  try {
    // Analyze with both APIs
    const [v4Analysis, unifiedAnalysis] = await Promise.all([
      axios.post(`${PATTERN_API_V4}/api/v4/analyze`, { gameId }).catch(err => ({ data: null })),
      axios.post(`${UNIFIED_PATTERN_API}/api/unified/analyze`, { 
        sport, 
        homeTeam, 
        awayTeam 
      }).catch(err => ({ data: null }))
    ]);

    // Combine analyses
    const combinedAnalysis = {
      gameId,
      v4Analysis: v4Analysis.data,
      unifiedAnalysis: unifiedAnalysis.data,
      recommendedBet: determineRecommendation(v4Analysis.data, unifiedAnalysis.data),
      confidence: calculateCombinedConfidence(v4Analysis.data, unifiedAnalysis.data),
      timestamp: new Date().toISOString()
    };

    // Store in database for tracking
    await storeAnalysis(combinedAnalysis);

    // Cache the analysis
    await PatternCache.cacheAnalysis(gameId, combinedAnalysis);

    res.json(combinedAnalysis);
  } catch (error) {
    console.error('Error analyzing game:', error);
    res.status(500).json({ error: 'Failed to analyze game' });
  }
});

/**
 * GET /api/patterns/opportunities
 * Get current high-value betting opportunities
 */
app.get('/api/patterns/opportunities', 
  cacheMiddleware(
    (req) => `opportunities:${req.query.sport || 'all'}:${req.query.minConfidence || 0.6}`,
    30
  ),
  async (req, res) => {
  const { sport, minConfidence = 0.6 } = req.query;

  try {
    // Get opportunities from V4 API
    const v4Opportunities = await axios.get(`${PATTERN_API_V4}/api/v4/opportunities`, {
      params: { sport, minConfidence }
    }).then(r => r.data).catch(() => []);

    // Get live games for unified analysis
    const liveGames = await axios.get(`${UNIFIED_PATTERN_API}/api/unified/live`)
      .then(r => r.data?.games || [])
      .catch(() => []);

    // Filter and enhance opportunities
    const enhancedOpportunities = v4Opportunities.map((opp: any) => ({
      ...opp,
      unifiedPatterns: findUnifiedPatterns(opp, liveGames),
      combinedConfidence: opp.confidence,
      kellyBet: calculateKellyBet(opp.confidence, opp.expectedValue)
    }));

    res.json({
      opportunities: enhancedOpportunities,
      totalCount: enhancedOpportunities.length,
      sport: sport || 'all',
      minConfidence,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

/**
 * GET /api/patterns/performance
 * Track pattern performance over time
 */
app.get('/api/patterns/performance', 
  cacheMiddleware(
    (req) => `performance:${req.query.pattern || 'all'}:${req.query.days || 30}`,
    3600
  ),
  async (req, res) => {
  const { pattern, days = 30 } = req.query;

  try {
    // Get performance from V4 API
    const v4Performance = await axios.get(`${PATTERN_API_V4}/api/v4/performance`, {
      params: { pattern }
    }).then(r => r.data).catch(() => []);

    // Get historical accuracy from database
    const { data: dbPerformance } = await supabase
      .from('pattern_performance')
      .select('*')
      .gte('created_at', new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    res.json({
      v4Performance,
      historicalPerformance: dbPerformance || [],
      averageAccuracy: calculateAverageAccuracy(v4Performance, dbPerformance),
      trend: calculateTrend(dbPerformance),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

/**
 * POST /api/patterns/alert-preferences
 * Set user alert preferences
 */
app.post('/api/patterns/alert-preferences', async (req, res) => {
  const { userId, preferences } = req.body;

  if (!userId || !preferences) {
    return res.status(400).json({ error: 'userId and preferences are required' });
  }

  try {
    const { data, error } = await supabase
      .from('user_pattern_preferences')
      .upsert({
        user_id: userId,
        preferences,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error saving preferences:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// Helper functions
function determineRecommendation(v4Analysis: any, unifiedAnalysis: any): string {
  if (!v4Analysis && !unifiedAnalysis) return 'No recommendation';
  
  const v4Confidence = v4Analysis?.totalConfidence || 0;
  const unifiedConfidence = unifiedAnalysis?.confidence || 0;
  const avgConfidence = (v4Confidence + unifiedConfidence) / 2;

  if (avgConfidence > 0.7) return 'STRONG BET';
  if (avgConfidence > 0.6) return 'MODERATE BET';
  if (avgConfidence > 0.5) return 'SMALL BET';
  return 'PASS';
}

function calculateCombinedConfidence(v4Analysis: any, unifiedAnalysis: any): number {
  const v4Confidence = v4Analysis?.totalConfidence || 0;
  const unifiedConfidence = unifiedAnalysis?.confidence || 0;
  
  // Weight V4 higher since it has 48K games analyzed
  return (v4Confidence * 0.7 + unifiedConfidence * 0.3);
}

function calculateKellyBet(confidence: number, expectedValue: number): number {
  // Kelly Criterion: f = (bp - q) / b
  // where f = fraction to bet, b = odds, p = probability of winning, q = probability of losing
  const p = confidence;
  const q = 1 - confidence;
  const b = expectedValue; // Simplified - should be actual odds
  
  const kelly = (b * p - q) / b;
  
  // Conservative Kelly (25% of full Kelly for safety)
  return Math.max(0, Math.min(0.25, kelly * 0.25));
}

function findUnifiedPatterns(opportunity: any, liveGames: any[]): any[] {
  // Match opportunity with live game data
  const game = liveGames.find(g => 
    g.homeTeam === opportunity.homeTeam && 
    g.awayTeam === opportunity.awayTeam
  );
  
  return game?.patterns || [];
}

function calculateAverageAccuracy(v4Perf: any[], dbPerf: any[]): number {
  const allAccuracies = [
    ...v4Perf.map(p => p.accuracy || 0),
    ...dbPerf.map(p => p.accuracy || 0)
  ].filter(a => a > 0);
  
  if (allAccuracies.length === 0) return 0;
  
  return allAccuracies.reduce((sum, acc) => sum + acc, 0) / allAccuracies.length;
}

function calculateTrend(performance: any[]): string {
  if (!performance || performance.length < 2) return 'STABLE';
  
  const recent = performance.slice(0, 5);
  const older = performance.slice(5, 10);
  
  const recentAvg = recent.reduce((sum, p) => sum + (p.accuracy || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, p) => sum + (p.accuracy || 0), 0) / older.length;
  
  if (recentAvg > olderAvg * 1.05) return 'IMPROVING';
  if (recentAvg < olderAvg * 0.95) return 'DECLINING';
  return 'STABLE';
}

async function storeAnalysis(analysis: any): Promise<void> {
  try {
    await supabase
      .from('pattern_analysis_history')
      .insert({
        game_id: analysis.gameId,
        analysis_data: analysis,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error storing analysis:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🔥 Pattern API Gateway running on port ${PORT}`);
  console.log(`📊 Routing to:`);
  console.log(`   - Pattern API V4: ${PATTERN_API_V4}`);
  console.log(`   - Unified Pattern API: ${UNIFIED_PATTERN_API}`);
  console.log(`🚀 Ready to unify pattern detection!`);
});

export default app;