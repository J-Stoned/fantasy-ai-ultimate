#!/usr/bin/env tsx
/**
 * 🚀 PRODUCTION PATTERN API - REAL VERSION!
 * 
 * Uses ACTUAL pattern detection logic, not Math.random()
 * Integrates with real pattern detector
 */

import express from 'express';
import cors from 'cors';
import chalk from 'chalk';
import { realPatternDetector } from '../real-pattern-detector';
import { enhancedDb } from '../../lib/services/enhanced-database-service';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3338; // New port for real API

// Real stats from our pattern detection
let REAL_STATS = {
  totalGames: 0,
  patternsDetected: 0,
  accuracy: {
    overall: 0,
    byPattern: {} as Record<string, number>
  },
  lastUpdated: new Date()
};

// Initialize stats
async function initializeStats() {
  console.log(chalk.cyan('Loading real pattern statistics...'));
  
  // Get recent pattern detections
  const stats = realPatternDetector.getAccuracyStats();
  
  REAL_STATS.accuracy.overall = parseFloat(stats.overall) || 0;
  REAL_STATS.accuracy.byPattern = stats.patternStats.reduce((acc, stat) => {
    acc[stat.pattern] = parseFloat(stat.accuracy) || 0;
    return acc;
  }, {} as Record<string, number>);
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Real Pattern API V5 - No more Math.random()!',
    stats: REAL_STATS,
    timestamp: new Date().toISOString()
  });
});

// Get patterns for a specific game
app.get('/patterns/game/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    console.log(chalk.cyan(`Detecting patterns for game ${gameId}...`));
    
    const patterns = await realPatternDetector.detectPatterns(gameId);
    
    res.json({
      gameId,
      patterns: patterns.map(p => ({
        name: p.pattern,
        detected: p.detected,
        confidence: p.confidence,
        reasoning: p.reasoning,
        recommendation: p.betRecommendation
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error(chalk.red('Error detecting patterns:'), error);
    res.status(500).json({ error: error.message });
  }
});

// Get patterns for upcoming games
app.get('/patterns/upcoming', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    
    // Get upcoming games
    const { data: games } = await enhancedDb.getClient()
      .from('games')
      .select('id, home_team_id, away_team_id, start_time, sport')
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + hours * 60 * 60 * 1000).toISOString())
      .order('start_time', { ascending: true })
      .limit(50);
    
    if (!games || games.length === 0) {
      return res.json({ games: [], message: 'No upcoming games found' });
    }
    
    // Detect patterns for each game
    const gamesWithPatterns = [];
    
    for (const game of games) {
      const patterns = await realPatternDetector.detectPatterns(game.id);
      
      if (patterns.length > 0) {
        gamesWithPatterns.push({
          gameId: game.id,
          startTime: game.start_time,
          sport: game.sport,
          patterns: patterns.map(p => ({
            name: p.pattern,
            confidence: p.confidence,
            recommendation: p.betRecommendation
          }))
        });
      }
    }
    
    res.json({
      totalGames: games.length,
      gamesWithPatterns: gamesWithPatterns.length,
      games: gamesWithPatterns,
      accuracy: REAL_STATS.accuracy,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error(chalk.red('Error getting upcoming patterns:'), error);
    res.status(500).json({ error: error.message });
  }
});

// Get current accuracy stats
app.get('/stats/accuracy', (req, res) => {
  const stats = realPatternDetector.getAccuracyStats();
  
  res.json({
    overall: stats.overall,
    totalPredictions: stats.totalPredictions,
    correctPredictions: stats.correctPredictions,
    byPattern: stats.patternStats,
    lastUpdated: REAL_STATS.lastUpdated
  });
});

// Analyze historical patterns
app.post('/analyze/historical', async (req, res) => {
  try {
    const { startDate, endDate, sport } = req.body;
    
    let query = enhancedDb.getClient()
      .from('games')
      .select('id, home_team_id, away_team_id, home_score, away_score, start_time')
      .not('home_score', 'is', null);
    
    if (startDate) query = query.gte('start_time', startDate);
    if (endDate) query = query.lte('start_time', endDate);
    if (sport) query = query.eq('sport', sport);
    
    const { data: games } = await query.limit(100);
    
    if (!games) {
      return res.json({ error: 'No games found' });
    }
    
    let totalPatterns = 0;
    let correctPredictions = 0;
    
    for (const game of games) {
      const patterns = await realPatternDetector.detectPatterns(game.id);
      
      if (patterns.length > 0) {
        totalPatterns++;
        
        // Check accuracy
        await realPatternDetector.checkAccuracy(game.id);
      }
    }
    
    const updatedStats = realPatternDetector.getAccuracyStats();
    
    res.json({
      gamesAnalyzed: games.length,
      patternsFound: totalPatterns,
      accuracy: updatedStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error(chalk.red('Error analyzing historical:'), error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  await initializeStats();
  
  app.listen(PORT, () => {
    console.log(chalk.bold.green(`\n🚀 REAL PATTERN API RUNNING ON PORT ${PORT}`));
    console.log(chalk.yellow('No more Math.random() - using actual pattern detection!'));
    console.log(chalk.cyan('\nEndpoints:'));
    console.log(chalk.white(`  GET  /health - Health check`));
    console.log(chalk.white(`  GET  /patterns/game/:gameId - Get patterns for specific game`));
    console.log(chalk.white(`  GET  /patterns/upcoming - Get patterns for upcoming games`));
    console.log(chalk.white(`  GET  /stats/accuracy - Get current accuracy stats`));
    console.log(chalk.white(`  POST /analyze/historical - Analyze historical patterns`));
    console.log(chalk.gray('\nPress Ctrl+C to stop\n'));
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down Real Pattern API...'));
  process.exit(0);
});

// Start the server
startServer().catch(console.error);