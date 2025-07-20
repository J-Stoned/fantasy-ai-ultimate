#!/usr/bin/env tsx
/**
 * 🚀 PRODUCTION PATTERN API V4 - CLEAN VERSION
 * 
 * Simplified API with working SQL queries
 */

import express from 'express';
import cors from 'cors';
import chalk from 'chalk';
import { Pool } from 'pg';

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Simple query helper
async function query(sql: string) {
  try {
    const result = await pool.query(sql);
    return result.rows;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
}

// Root route
app.get('/', (req, res) => {
  res.json({ message: '🚀 Fantasy AI Pattern Detection API V4', status: 'running' });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      version: 'v4-clean'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Get all patterns summary
app.get('/patterns', async (req, res) => {
  try {
    // Simple queries to test each pattern
    const backToBackCount = await query(`
      SELECT COUNT(*) as count
      FROM games g1
      JOIN games g2 ON g1.away_team_id = g2.away_team_id
      WHERE g1.status = 'final' 
        AND g2.status = 'final'
        AND g1.id != g2.id
        AND g1.start_time > g2.start_time
        AND (EXTRACT(EPOCH FROM (g1.start_time::timestamp - g2.start_time::timestamp))/3600) < 30
      LIMIT 1
    `);

    const revengeCount = await query(`
      SELECT COUNT(*) as count
      FROM games
      WHERE status = 'final'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        AND ABS(home_score - away_score) >= 20
      LIMIT 1
    `);

    res.json({
      patterns: {
        backToBackFade: {
          description: 'Teams playing back-to-back games',
          count: backToBackCount[0]?.count || 0
        },
        revengeGame: {
          description: 'Teams seeking revenge after big loss',
          count: revengeCount[0]?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific pattern games
app.get('/patterns/backToBackFade', async (req, res) => {
  try {
    const games = await query(`
      SELECT 
        g1.id,
        g1.away_team_id,
        g1.home_team_id,
        g1.start_time,
        g1.sport,
        g1.home_score,
        g1.away_score
      FROM games g1
      WHERE g1.status = 'final'
        AND EXISTS (
          SELECT 1 FROM games g2
          WHERE g2.away_team_id = g1.away_team_id
            AND g2.status = 'final'
            AND g2.id != g1.id
            AND g2.start_time < g1.start_time
            AND (EXTRACT(EPOCH FROM (g1.start_time::timestamp - g2.start_time::timestamp))/3600) < 30
        )
      ORDER BY g1.start_time DESC
      LIMIT 20
    `);

    res.json({
      pattern: 'backToBackFade',
      count: games.length,
      games: games
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get revenge games
app.get('/patterns/revengeGame', async (req, res) => {
  try {
    const games = await query(`
      SELECT 
        id,
        home_team_id,
        away_team_id,
        start_time,
        sport,
        home_score,
        away_score,
        ABS(home_score - away_score) as margin
      FROM games
      WHERE status = 'final'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        AND ABS(home_score - away_score) >= 20
      ORDER BY margin DESC
      LIMIT 20
    `);

    res.json({
      pattern: 'revengeGame',
      count: games.length,
      games: games
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database stats
app.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM games WHERE status = 'final') as total_games,
        (SELECT COUNT(*) FROM teams) as total_teams,
        (SELECT COUNT(*) FROM players) as total_players,
        (SELECT COUNT(*) FROM games WHERE home_score IS NOT NULL) as completed_games
    `);

    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3337;

app.listen(PORT, () => {
  console.log(chalk.green(`\n🚀 FANTASY AI PATTERN DETECTION API V4 (CLEAN)`));
  console.log(chalk.blue(`📡 Server running on http://localhost:${PORT}`));
  console.log(chalk.cyan(`\n📊 API ENDPOINTS:`));
  console.log(chalk.gray(`  GET  /                      - API info`));
  console.log(chalk.gray(`  GET  /health                - Health check`));
  console.log(chalk.gray(`  GET  /patterns              - Pattern summary`));
  console.log(chalk.gray(`  GET  /patterns/backToBackFade - Back to back games`));
  console.log(chalk.gray(`  GET  /patterns/revengeGame  - Revenge games`));
  console.log(chalk.gray(`  GET  /stats                 - Database stats`));
  console.log(chalk.green(`\n✨ Ready for testing!`));
});