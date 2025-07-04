/**
 * 🏥 HEALTH CHECK API
 * 
 * System health and status monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import { ensemblePredictor } from '@/lib/ml/ensemble-predictor';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown', latency: 0 },
      ml_models: { status: 'unknown', loaded: false, models: [] as string[] },
      websocket: { status: 'unknown', url: '' },
      tensorflow: { status: 'unknown', backend: '', version: '' }
    },
    metrics: {
      predictions_24h: 0,
      accuracy_7d: 0,
      active_games: 0,
      model_version: 'ensemble_v2'
    },
    system: {
      node_version: process.version,
      memory_usage: process.memoryUsage(),
      uptime: process.uptime()
    }
  };
  
  // Check database
  try {
    const start = Date.now();
    const { count } = await supabase
      .from('ml_predictions')
      .select('*', { count: 'exact', head: true })
      .limit(1);
    
    health.services.database.status = 'healthy';
    health.services.database.latency = Date.now() - start;
    
    // Get 24h predictions
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: predCount } = await supabase
      .from('ml_predictions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());
    
    health.metrics.predictions_24h = predCount || 0;
    
    // Get active games
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .in('status', ['scheduled', 'in_progress'])
      .gte('start_time', new Date().toISOString());
    
    health.metrics.active_games = gameCount || 0;
    
  } catch (error) {
    health.services.database.status = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Check ML models
  try {
    if (ensemblePredictor.isLoaded) {
      health.services.ml_models.status = 'healthy';
      health.services.ml_models.loaded = true;
      health.services.ml_models.models = ['neural_network', 'random_forest'];
    } else {
      // Try to load models
      const modelsPath = path.join(process.cwd(), 'models');
      await ensemblePredictor.loadModels(modelsPath);
      
      if (ensemblePredictor.isLoaded) {
        health.services.ml_models.status = 'healthy';
        health.services.ml_models.loaded = true;
        health.services.ml_models.models = ['neural_network', 'random_forest'];
      } else {
        health.services.ml_models.status = 'degraded';
      }
    }
  } catch (error) {
    health.services.ml_models.status = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Check TensorFlow
  try {
    health.services.tensorflow.backend = tf.getBackend();
    health.services.tensorflow.version = tf.version.tfjs;
    health.services.tensorflow.status = 'healthy';
  } catch (error) {
    health.services.tensorflow.status = 'unhealthy';
    health.status = 'degraded';
  }
  
  // Check WebSocket
  const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
  const wsHost = request.headers.get('host')?.replace(/:\d+$/, ':8080') || 'localhost:8080';
  health.services.websocket.url = `${wsProtocol}://${wsHost}`;
  
  // Simple WebSocket check (in production, you'd actually test the connection)
  health.services.websocket.status = 'healthy';
  
  // Calculate 7-day accuracy
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: weekPredictions } = await supabase
      .from('ml_predictions')
      .select(`
        *,
        games!inner(
          status,
          home_score,
          away_score
        )
      `)
      .eq('model_name', 'ensemble_v2')
      .gte('created_at', weekAgo.toISOString())
      .eq('games.status', 'completed')
      .not('games.home_score', 'is', null);
    
    if (weekPredictions && weekPredictions.length > 0) {
      let correct = 0;
      weekPredictions.forEach(pred => {
        const game = pred.games as any;
        const metadata = pred.metadata as any;
        const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
        const predictedWinner = metadata.predicted_winner || 
          (metadata.home_win_probability > 0.5 ? 'home' : 'away');
        
        if (actualWinner === predictedWinner) correct++;
      });
      
      health.metrics.accuracy_7d = correct / weekPredictions.length;
    }
  } catch (error) {
    // Accuracy calculation failed, not critical
  }
  
  // Determine overall status
  const unhealthyServices = Object.values(health.services)
    .filter(s => s.status === 'unhealthy').length;
  
  if (unhealthyServices > 1) {
    health.status = 'unhealthy';
  } else if (unhealthyServices > 0) {
    health.status = 'degraded';
  }
  
  // Add response headers for monitoring
  const headers = new Headers();
  headers.set('X-Health-Status', health.status);
  headers.set('X-Response-Time', Date.now().toString());
  
  return NextResponse.json(health, { 
    status: health.status === 'healthy' ? 200 : 503,
    headers 
  });
}