#!/usr/bin/env tsx
/**
 * 🚀 Fantasy ML Production API Service
 * High-performance API for serving ML predictions
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { playerPredictor } from '../models/player-performance-predictor';
import { dfsOptimizer, DFSPlayer, LineupConstraints } from '../models/dfs-lineup-optimizer';
import { propAnalyzer, PropBet } from '../models/prop-bet-analyzer';
import { fantasyDataLoader } from '../data-pipeline/fantasy-data-loader';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.FANTASY_API_PORT || 3338;

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting by tier
const freeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Free tier limit exceeded. Upgrade to Pro for unlimited access!'
});

const proLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100 // 100 requests per window
});

const eliteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000 // Essentially unlimited
});

// Auth middleware
async function authenticateUser(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    req.tier = 'free';
    return next();
  }
  
  // In production, validate API key against database
  // For now, simple tier assignment
  if (apiKey.startsWith('elite_')) {
    req.tier = 'elite';
  } else if (apiKey.startsWith('pro_')) {
    req.tier = 'pro';
  } else {
    req.tier = 'free';
  }
  
  next();
}

// Apply rate limiting based on tier
function applyRateLimit(req: any, res: any, next: any) {
  switch (req.tier) {
    case 'elite':
      return eliteLimiter(req, res, next);
    case 'pro':
      return proLimiter(req, res, next);
    default:
      return freeLimiter(req, res, next);
  }
}

// 🏠 Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Fantasy ML API',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// 🎯 Player Projections
app.get('/api/v1/projections/:sport/:date', authenticateUser, applyRateLimit, async (req, res) => {
  try {
    const { sport, date } = req.params;
    const { players } = req.query;
    
    console.log(chalk.cyan(`📊 Projections request: ${sport} for ${date}`));
    
    // Load player data
    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30); // Last 30 days
    
    const playerStats = await fantasyDataLoader.loadPlayerGameLogs(
      sport,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    // Prepare features and make predictions
    const features = await fantasyDataLoader.prepareFeatures(playerStats);
    const predictions = await playerPredictor.predict(features);
    
    // Filter by requested players if specified
    let results = predictions;
    if (players) {
      const playerList = (players as string).split(',');
      results = predictions.filter(p => playerList.includes(p.player_id));
    }
    
    // Limit results based on tier
    if (req.tier === 'free') {
      results = results.slice(0, 10); // Free tier gets top 10 only
    }
    
    res.json({
      success: true,
      sport,
      date,
      projections: results,
      count: results.length,
      tier: req.tier
    });
    
  } catch (error) {
    console.error(chalk.red('Projection error:'), error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate projections'
    });
  }
});

// 🚀 DFS Lineup Optimizer
app.post('/api/v1/optimize-lineup', authenticateUser, applyRateLimit, async (req, res) => {
  try {
    const { sport, site, slateId, strategy = 'balanced', numLineups = 1 } = req.body;
    
    console.log(chalk.cyan(`🎮 DFS optimization: ${sport} on ${site}`));
    
    // Free tier restrictions
    const maxLineups = req.tier === 'free' ? 1 : req.tier === 'pro' ? 20 : 150;
    const requestedLineups = Math.min(numLineups, maxLineups);
    
    // Load DFS data
    const { data: salaries } = await supabase
      .from('dfs_salaries')
      .select('*')
      .eq('slate_id', slateId)
      .eq('site', site);
    
    const { data: ownership } = await supabase
      .from('dfs_ownership_projections')
      .select('*')
      .eq('slate_id', slateId)
      .eq('site', site);
    
    // Convert to DFSPlayer format
    const players: DFSPlayer[] = salaries?.map(s => {
      const own = ownership?.find(o => o.external_id === s.external_id);
      return {
        id: s.external_id,
        name: s.player_name,
        position: s.position,
        team: s.team,
        opponent: s.opponent,
        salary: s.salary,
        projected_points: s.projected_points || 0,
        projected_ownership: own?.projected_ownership || 5,
        floor: 0,
        ceiling: 0,
        boom_probability: 0
      };
    }) || [];
    
    // Set constraints based on sport/site
    const constraints: LineupConstraints = this.getConstraints(sport, site);
    
    // Optimize lineups
    const lineups = await dfsOptimizer.optimizeLineups(
      players,
      constraints,
      requestedLineups,
      strategy as any
    );
    
    res.json({
      success: true,
      sport,
      site,
      slateId,
      strategy,
      lineups,
      count: lineups.length,
      tier: req.tier
    });
    
  } catch (error) {
    console.error(chalk.red('DFS optimization error:'), error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize lineups'
    });
  }
});

// 🎯 Prop Bet Analysis
app.get('/api/v1/props/:sport/:date', authenticateUser, applyRateLimit, async (req, res) => {
  try {
    const { sport, date } = req.params;
    
    console.log(chalk.cyan(`🎲 Prop analysis: ${sport} for ${date}`));
    
    // Elite tier only
    if (req.tier !== 'elite') {
      return res.status(403).json({
        success: false,
        error: 'Prop analysis requires Elite subscription'
      });
    }
    
    // Load prop bets for date
    const { data: props } = await supabase
      .from('prop_bets')
      .select('*')
      .eq('game_date', date)
      .eq('sport', sport);
    
    if (!props || props.length === 0) {
      return res.json({
        success: true,
        props: [],
        message: 'No props available for this date'
      });
    }
    
    // Analyze each prop
    const playerStatsMap = new Map();
    const analyzedProps = [];
    
    for (const prop of props) {
      // Load player stats if not cached
      if (!playerStatsMap.has(prop.player_id)) {
        const stats = await fantasyDataLoader.loadPlayerGameLogs(
          sport,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          date
        );
        playerStatsMap.set(prop.player_id, stats.filter(s => s.player_id === prop.player_id));
      }
      
      const playerStats = playerStatsMap.get(prop.player_id);
      const analysis = await propAnalyzer.analyzeProp(prop as PropBet, playerStats);
      
      if (analysis.recommended_bet !== 'pass') {
        analyzedProps.push(analysis);
      }
    }
    
    // Sort by edge
    analyzedProps.sort((a, b) => b.edge_percentage - a.edge_percentage);
    
    res.json({
      success: true,
      sport,
      date,
      props: analyzedProps.slice(0, 10), // Top 10 props
      count: analyzedProps.length
    });
    
  } catch (error) {
    console.error(chalk.red('Prop analysis error:'), error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze props'
    });
  }
});

// 📊 Historical Performance
app.get('/api/v1/performance/:playerId', authenticateUser, applyRateLimit, async (req, res) => {
  try {
    const { playerId } = req.params;
    const { sport, startDate, endDate } = req.query;
    
    const stats = await fantasyDataLoader.loadPlayerGameLogs(
      sport as string,
      startDate as string,
      endDate as string
    );
    
    const playerGames = stats.filter(s => s.player_id === playerId);
    
    res.json({
      success: true,
      playerId,
      games: playerGames,
      averagePoints: playerGames.reduce((sum, g) => sum + (g.fantasy_points || 0), 0) / playerGames.length,
      consistency: this.calculateConsistency(playerGames)
    });
    
  } catch (error) {
    console.error(chalk.red('Performance error:'), error);
    res.status(500).json({
      success: false,
      error: 'Failed to load performance data'
    });
  }
});

// Helper functions
function getConstraints(sport: string, site: string): LineupConstraints {
  const constraints: Record<string, Record<string, LineupConstraints>> = {
    NFL: {
      draftkings: {
        salary_cap: 50000,
        positions: new Map([
          ['QB', 1], ['RB', 2], ['WR', 3], ['TE', 1], ['FLEX', 1], ['DST', 1]
        ])
      },
      fanduel: {
        salary_cap: 60000,
        positions: new Map([
          ['QB', 1], ['RB', 2], ['WR', 3], ['TE', 1], ['FLEX', 1], ['DST', 1]
        ])
      }
    },
    NBA: {
      draftkings: {
        salary_cap: 50000,
        positions: new Map([
          ['PG', 1], ['SG', 1], ['SF', 1], ['PF', 1], ['C', 1], ['G', 1], ['F', 1], ['UTIL', 1]
        ])
      },
      fanduel: {
        salary_cap: 60000,
        positions: new Map([
          ['PG', 2], ['SG', 2], ['SF', 2], ['PF', 2], ['C', 1]
        ])
      }
    }
  };
  
  return constraints[sport]?.[site] || {
    salary_cap: 50000,
    positions: new Map()
  };
}

function calculateConsistency(games: any[]): number {
  if (games.length < 3) return 0;
  
  const points = games.map(g => g.fantasy_points || 0);
  const avg = points.reduce((a, b) => a + b, 0) / points.length;
  const variance = points.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / points.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower std dev relative to average = more consistent
  return Math.max(0, 1 - (stdDev / avg));
}

// Start server
app.listen(PORT, () => {
  console.log(chalk.bold.green(`
🚀 FANTASY ML API RUNNING!
📍 Port: ${PORT}
🔗 Health: http://localhost:${PORT}/health

Available Endpoints:
- GET  /api/v1/projections/:sport/:date
- POST /api/v1/optimize-lineup
- GET  /api/v1/props/:sport/:date
- GET  /api/v1/performance/:playerId

Tiers:
- Free: 10 requests/15min, limited features
- Pro: 100 requests/15min, full projections
- Elite: 1000 requests/15min, all features
  `));
});