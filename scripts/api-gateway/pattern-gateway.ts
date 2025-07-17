/**
 * 🔥 FANTASY AI PATTERN API GATEWAY 🔥
 * Unifies Pattern API V4 (port 3337) and Unified Pattern API (port 3336)
 * Provides single endpoint for all pattern detection needs
 */

import express from 'express';
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

// Health check
app.get('/health', async (req, res) => {
  const cacheStats = await PatternCache.getStats();
  
  // Test database connection
  const { count: patternCount } = await supabase
    .from('pattern_performance')
    .select('*', { count: 'exact', head: true });
  
  res.json({ 
    status: 'healthy', 
    service: 'pattern-gateway',
    timestamp: new Date().toISOString(),
    database: {
      connected: true,
      patterns: patternCount || 0
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
 * Get all patterns from pattern_performance table
 */
app.get('/api/patterns/all', 
  cacheMiddleware(() => 'patterns:all', 300),
  async (req, res) => {
  try {
    // Get all patterns from pattern_performance
    const { data: patterns, error } = await supabase
      .from('pattern_performance')
      .select('*')
      .order('accuracy_rate', { ascending: false });

    if (error) throw error;

    // Get pattern multipliers
    const { data: multipliers } = await supabase
      .from('pattern_multipliers')
      .select('*');

    // Group patterns by sport
    const patternsBySport = patterns?.reduce((acc, pattern) => {
      const sport = pattern.sport || 'ALL';
      if (!acc[sport]) acc[sport] = [];
      
      // Find multiplier for this pattern
      const multiplier = multipliers?.find(
        m => m.pattern_type === pattern.pattern_type && m.sport === pattern.sport
      );
      
      acc[sport].push({
        ...pattern,
        adjustedAccuracy: pattern.accuracy_rate * (multiplier?.adjusted_multiplier || 1),
        multiplier: multiplier?.adjusted_multiplier || 1
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate overall stats
    const totalPatterns = patterns?.length || 0;
    const avgAccuracy = patterns?.reduce((sum, p) => sum + (p.accuracy_rate || 0), 0) / totalPatterns || 0;
    const totalProfit = patterns?.reduce((sum, p) => sum + parseFloat(p.total_profit_loss || '0'), 0) || 0;

    res.json({
      patterns: patterns || [],
      patternsBySport,
      multipliers: multipliers || [],
      stats: {
        totalPatterns,
        averageAccuracy: avgAccuracy.toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        topPattern: patterns?.[0],
        activeSports: Object.keys(patternsBySport || {})
      },
      timestamp: new Date().toISOString()
    });
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

  try {
    // Query fantasy_betting_insights for this game's patterns
    const { data: insights, error: insightsError } = await supabase
      .from('fantasy_betting_insights')
      .select(`
        *,
        games!inner(*),
        players!inner(*)
      `)
      .eq('game_id', gameId);

    if (insightsError) throw insightsError;

    // Get pattern performance data
    const patterns = insights?.flatMap(i => i.active_patterns || []) || [];
    const uniquePatterns = [...new Set(patterns)];

    const { data: patternPerf, error: perfError } = await supabase
      .from('pattern_performance')
      .select('*')
      .in('pattern_type', uniquePatterns);

    if (perfError) throw perfError;

    // Calculate combined analysis
    const patternAnalysis = uniquePatterns.map(pattern => {
      const perf = patternPerf?.find(p => p.pattern_type === pattern);
      const insightCount = insights?.filter(i => i.active_patterns?.includes(pattern)).length || 0;
      
      return {
        pattern,
        accuracy: perf?.accuracy_rate || 0,
        roi: perf?.roi || 0,
        occurrences: perf?.total_occurrences || 0,
        activeInGame: insightCount > 0,
        confidence: perf?.accuracy_rate || 0
      };
    });

    const totalConfidence = patternAnalysis.reduce((sum, p) => sum + p.confidence, 0) / Math.max(patternAnalysis.length, 1);
    const highConfidencePatterns = patternAnalysis.filter(p => p.accuracy > 0.65);

    const combinedAnalysis = {
      gameId,
      sport,
      homeTeam,
      awayTeam,
      patterns: patternAnalysis,
      highValueOpportunities: insights || [],
      totalPatterns: uniquePatterns.length,
      highConfidencePatterns: highConfidencePatterns.length,
      confidence: totalConfidence,
      recommendedBet: totalConfidence > 0.65 ? 'STRONG BET' : totalConfidence > 0.6 ? 'MODERATE BET' : 'PASS',
      kellyBet: calculateKellyBet(totalConfidence, 1.5),
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
 * Get current high-value opportunities from fantasy_betting_insights
 */
app.get('/api/patterns/opportunities', 
  cacheMiddleware(
    (req) => `opportunities:${req.query.sport || 'all'}:${req.query.minConfidence || 0.6}`,
    30
  ),
  async (req, res) => {
  const { sport, minConfidence = 0.6 } = req.query;

  try {
    // Query fantasy_betting_insights for active patterns
    let query = supabase
      .from('fantasy_betting_insights')
      .select(`
        *,
        games!inner(
          id,
          sport,
          home_team_id,
          away_team_id,
          start_time,
          status,
          teams_home:teams!fantasy_betting_insights_game_id_fkey(name, abbreviation),
          teams_away:teams!fantasy_betting_insights_game_id_fkey1(name, abbreviation)
        ),
        players!inner(
          id,
          name,
          position,
          team
        )
      `)
      .not('active_patterns', 'is', null)
      .gte('pattern_confidence', Number(minConfidence))
      .eq('has_betting_edge', true);

    if (sport && sport !== 'all') {
      query = query.eq('games.sport', sport);
    }

    // Only upcoming games
    query = query.gte('games.start_time', new Date().toISOString());

    const { data: insights, error } = await query
      .order('expected_value', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Transform to opportunities format
    const opportunities = (insights || []).map(insight => ({
      id: `opp_${insight.id}`,
      gameId: insight.game_id,
      playerId: insight.player_id,
      playerName: insight.players?.name,
      sport: insight.games?.sport,
      homeTeam: insight.games?.teams_home?.name,
      awayTeam: insight.games?.teams_away?.name,
      startTime: insight.games?.start_time,
      patterns: insight.active_patterns || [],
      confidence: insight.pattern_confidence || 0,
      expectedValue: insight.expected_value || 0,
      recommendation: insight.recommended_action,
      edgeType: insight.edge_type,
      edgeDescription: insight.edge_description,
      fantasyProjection: insight.fantasy_points_projected,
      dfsValueDK: insight.dfs_salary_dk ? 
        (insight.fantasy_points_projected / insight.dfs_salary_dk * 1000).toFixed(2) : null,
      dfsValueFD: insight.dfs_salary_fd ? 
        (insight.fantasy_points_projected / insight.dfs_salary_fd * 1000).toFixed(2) : null,
      kellyBet: calculateKellyBet(insight.pattern_confidence || 0, insight.expected_value || 1)
    }));

    res.json({
      opportunities,
      totalCount: opportunities.length,
      sport: sport || 'all',
      minConfidence,
      dataSource: 'fantasy_betting_insights',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

/**
 * GET /api/patterns/performance
 * Track pattern performance over time from existing database
 */
app.get('/api/patterns/performance', 
  cacheMiddleware(
    (req) => `performance:${req.query.pattern || 'all'}:${req.query.sport || 'all'}`,
    3600
  ),
  async (req, res) => {
  const { pattern, sport, days = 30 } = req.query;

  try {
    // Query existing pattern_performance table
    let query = supabase
      .from('pattern_performance')
      .select('*');
    
    if (pattern && pattern !== 'all') {
      query = query.eq('pattern_type', pattern);
    }
    
    if (sport && sport !== 'all') {
      query = query.eq('sport', sport);
    }
    
    const { data: performance, error } = await query
      .order('last_updated', { ascending: false });

    if (error) throw error;

    // Get temporal pattern performance for trends
    const { data: temporalPerf } = await supabase
      .from('temporal_pattern_performance')
      .select('*')
      .eq('pattern_type', pattern || '')
      .eq('sport', sport || '')
      .limit(10);

    // Calculate aggregated metrics
    const aggregated = performance?.reduce((acc, perf) => {
      return {
        totalOccurrences: acc.totalOccurrences + (perf.total_occurrences || 0),
        successfulPredictions: acc.successfulPredictions + (perf.successful_predictions || 0),
        totalWagered: acc.totalWagered + parseFloat(perf.total_wagered || 0),
        totalProfit: acc.totalProfit + parseFloat(perf.total_profit_loss || 0),
        patterns: acc.patterns + 1
      };
    }, {
      totalOccurrences: 0,
      successfulPredictions: 0,
      totalWagered: 0,
      totalProfit: 0,
      patterns: 0
    });

    const avgAccuracy = aggregated.totalOccurrences > 0 
      ? (aggregated.successfulPredictions / aggregated.totalOccurrences) * 100 
      : 0;
    
    const roi = aggregated.totalWagered > 0
      ? (aggregated.totalProfit / aggregated.totalWagered) * 100
      : 0;

    res.json({
      performance: performance || [],
      temporalTrends: temporalPerf || [],
      aggregated: {
        ...aggregated,
        averageAccuracy: avgAccuracy.toFixed(2),
        roi: roi.toFixed(2)
      },
      topPatterns: performance?.slice(0, 5) || [],
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
  console.log(`📊 Connected to Supabase database`);
  console.log(`   - Querying pattern_performance table`);
  console.log(`   - Querying fantasy_betting_insights table`);
  console.log(`   - Redis caching enabled`);
  console.log(`🚀 Ready to serve pattern data!`);
});

export default app;