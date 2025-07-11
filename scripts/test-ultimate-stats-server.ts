import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { ultimateStatsService } from '../lib/services/ultimate-stats-service';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🚀 ULTIMATE STATS TEST SERVER');
console.log('=============================\n');

// Health check endpoint
app.get('/api/v3/ultimate-stats/health', async (req, res) => {
  try {
    const { count: logsWithMetrics } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('computed_metrics', 'eq', '{}');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        api: 'healthy',
        database: 'healthy',
        metrics_coverage: `${logsWithMetrics} logs with metrics`
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Main endpoint
app.get('/api/v3/ultimate-stats', async (req, res) => {
  try {
    const { sport, limit = '10', offset = '0' } = req.query;
    
    let query = supabase
      .from('player_game_logs')
      .select(`
        *,
        players!inner(name, position, team, sport),
        games!inner(sport, home_team, away_team, start_time, status)
      `)
      .not('computed_metrics', 'eq', '{}')
      .order('games.start_time', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);
    
    if (sport) {
      query = query.eq('games.sport', sport);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    res.json({
      data,
      meta: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch ultimate stats',
      details: error.message
    });
  }
});

// Player endpoint
app.get('/api/v3/ultimate-stats/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const { data: gameLogs } = await supabase
      .from('player_game_logs')
      .select(`
        *,
        games!inner(*)
      `)
      .eq('player_id', id)
      .not('computed_metrics', 'eq', '{}')
      .order('games.start_time', { ascending: false })
      .limit(10);
    
    res.json({
      player,
      stats: {
        games_played: gameLogs?.length || 0,
        recent_games: gameLogs
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to fetch player stats',
      details: error.message
    });
  }
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log(`  GET http://localhost:${PORT}/api/v3/ultimate-stats/health`);
  console.log(`  GET http://localhost:${PORT}/api/v3/ultimate-stats`);
  console.log(`  GET http://localhost:${PORT}/api/v3/ultimate-stats/players/:id`);
  console.log('\nPress Ctrl+C to stop\n');
});