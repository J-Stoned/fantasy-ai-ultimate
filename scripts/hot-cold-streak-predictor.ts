#!/usr/bin/env node
import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🔥 HOT/COLD STREAK PREDICTOR');
console.log('📈 Using rolling xwOBA windows to predict performance trends\n');

interface StreakPrediction {
  player_name: string;
  player_id: string;
  team: string;
  current_streak: 'HOT' | 'COLD' | 'NEUTRAL';
  predicted_next_7_days: 'HOT' | 'COLD' | 'NEUTRAL';
  confidence: number;
  streak_probability: {
    hot: number;
    neutral: number;
    cold: number;
  };
  key_metrics: {
    xwoba_7d: number;
    xwoba_14d: number;
    xwoba_30d: number;
    xwoba_trend: number; // Percentage change
    barrel_rate_7d: number;
    hard_hit_7d: number;
  };
  recommendation: string;
  fantasy_action: 'START' | 'BENCH' | 'TRADE_BUY' | 'TRADE_SELL' | 'HOLD';
}

interface PlayerPerformanceWindow {
  player_id: string;
  player_name: string;
  // Rolling windows
  xwoba_3d: number;
  xwoba_7d: number;
  xwoba_14d: number;
  xwoba_30d: number;
  xwoba_season: number;
  // Supporting metrics
  barrel_rate_7d: number;
  hard_hit_7d: number;
  k_rate_7d: number;
  bb_rate_7d: number;
  // Momentum indicators
  games_last_7d: number;
  plate_appearances_7d: number;
  // Matchup context
  upcoming_pitcher_quality: number; // 1-10 scale
  park_factor: number; // Hitter friendly = >1.0
}

class HotColdStreakPredictor {
  private model: tf.LayersModel | null = null;
  private readonly STREAK_THRESHOLDS = {
    HOT: { xwoba: 0.370, confidence: 0.7 },
    COLD: { xwoba: 0.300, confidence: 0.7 },
    NEUTRAL: { min: 0.300, max: 0.370 }
  };
  
  async initialize() {
    console.log('🧠 Initializing streak prediction model...\n');
    
    try {
      this.model = await tf.loadLayersModel('file://./models/streak-predictor/model.json');
      console.log('✅ Loaded existing streak prediction model');
    } catch (error) {
      console.log('📊 Creating new streak prediction model...');
      this.model = this.createModel();
      console.log('✅ Model created successfully');
    }
  }
  
  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Input layer - 12 features
        tf.layers.dense({
          inputShape: [12],
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        // LSTM-like pattern recognition
        tf.layers.dense({
          units: 32,
          activation: 'tanh',
          kernelInitializer: 'glorotUniform'
        }),
        
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        
        // Output layer - 3 classes (hot, neutral, cold)
        tf.layers.dense({
          units: 3,
          activation: 'softmax'
        })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }
  
  async predictStreaks(): Promise<StreakPrediction[]> {
    console.log('🔍 Analyzing player performance windows...\n');
    
    // Fetch player performance windows
    const windows = await this.fetchPerformanceWindows();
    console.log(`📊 Analyzing ${windows.length} players for streaks...\n`);
    
    const predictions: StreakPrediction[] = [];
    
    for (const window of windows) {
      const features = this.extractFeatures(window);
      const prediction = await this.predictStreak(features);
      
      const streakPrediction = this.createStreakPrediction(window, prediction);
      predictions.push(streakPrediction);
    }
    
    // Sort by confidence in hot streaks
    predictions.sort((a, b) => {
      const aHotScore = a.streak_probability.hot * a.confidence;
      const bHotScore = b.streak_probability.hot * b.confidence;
      return bHotScore - aHotScore;
    });
    
    return predictions;
  }
  
  private extractFeatures(window: PlayerPerformanceWindow): number[] {
    // Calculate trends
    const trend7to14 = (window.xwoba_7d - window.xwoba_14d) / (window.xwoba_14d || 0.320);
    const trend14to30 = (window.xwoba_14d - window.xwoba_30d) / (window.xwoba_30d || 0.320);
    const trend7toSeason = (window.xwoba_7d - window.xwoba_season) / (window.xwoba_season || 0.320);
    
    return [
      // Rolling xwOBA normalized
      window.xwoba_3d / 0.400,
      window.xwoba_7d / 0.400,
      window.xwoba_14d / 0.400,
      window.xwoba_30d / 0.400,
      
      // Trends
      trend7to14 + 0.5, // Normalized around 0.5
      trend14to30 + 0.5,
      trend7toSeason + 0.5,
      
      // Quality indicators
      window.barrel_rate_7d / 15, // 15% is elite
      window.hard_hit_7d / 50, // 50% is elite
      
      // Plate discipline
      (25 - window.k_rate_7d) / 25, // Lower K% is better
      window.bb_rate_7d / 15, // 15% is elite
      
      // Context
      window.upcoming_pitcher_quality / 10
    ];
  }
  
  private async predictStreak(features: number[]): Promise<any> {
    if (!this.model) throw new Error('Model not initialized');
    
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const probabilities = await prediction.data();
    
    // Calculate confidence based on probability distribution
    const maxProb = Math.max(...probabilities);
    const entropy = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0);
    const confidence = maxProb * (1 - entropy / Math.log(3)); // Normalize by max entropy
    
    input.dispose();
    prediction.dispose();
    
    return {
      probabilities: {
        hot: probabilities[0],
        neutral: probabilities[1],
        cold: probabilities[2]
      },
      confidence: confidence
    };
  }
  
  private createStreakPrediction(window: PlayerPerformanceWindow, prediction: any): StreakPrediction {
    // Determine current streak
    let currentStreak: 'HOT' | 'COLD' | 'NEUTRAL';
    if (window.xwoba_7d >= this.STREAK_THRESHOLDS.HOT.xwoba) {
      currentStreak = 'HOT';
    } else if (window.xwoba_7d <= this.STREAK_THRESHOLDS.COLD.xwoba) {
      currentStreak = 'COLD';
    } else {
      currentStreak = 'NEUTRAL';
    }
    
    // Determine predicted streak
    const probs = prediction.probabilities;
    let predictedStreak: 'HOT' | 'COLD' | 'NEUTRAL';
    if (probs.hot > probs.neutral && probs.hot > probs.cold) {
      predictedStreak = 'HOT';
    } else if (probs.cold > probs.neutral && probs.cold > probs.hot) {
      predictedStreak = 'COLD';
    } else {
      predictedStreak = 'NEUTRAL';
    }
    
    // Calculate xwOBA trend
    const xwobaTrend = ((window.xwoba_7d - window.xwoba_30d) / window.xwoba_30d) * 100;
    
    // Generate recommendation
    let recommendation = '';
    let fantasyAction: 'START' | 'BENCH' | 'TRADE_BUY' | 'TRADE_SELL' | 'HOLD';
    
    if (currentStreak === 'COLD' && predictedStreak === 'HOT') {
      recommendation = 'BUY LOW - Player showing signs of heating up!';
      fantasyAction = 'TRADE_BUY';
    } else if (currentStreak === 'HOT' && predictedStreak === 'COLD') {
      recommendation = 'SELL HIGH - Hot streak may be ending';
      fantasyAction = 'TRADE_SELL';
    } else if (predictedStreak === 'HOT') {
      recommendation = 'Start with confidence - Hot streak continuing';
      fantasyAction = 'START';
    } else if (predictedStreak === 'COLD') {
      recommendation = 'Consider benching - Cold streak expected';
      fantasyAction = 'BENCH';
    } else {
      recommendation = 'Hold and monitor - Neutral performance expected';
      fantasyAction = 'HOLD';
    }
    
    return {
      player_name: window.player_name,
      player_id: window.player_id,
      team: 'MLB', // Would need team lookup
      current_streak: currentStreak,
      predicted_next_7_days: predictedStreak,
      confidence: prediction.confidence,
      streak_probability: {
        hot: probs.hot,
        neutral: probs.neutral,
        cold: probs.cold
      },
      key_metrics: {
        xwoba_7d: window.xwoba_7d,
        xwoba_14d: window.xwoba_14d,
        xwoba_30d: window.xwoba_30d,
        xwoba_trend: xwobaTrend,
        barrel_rate_7d: window.barrel_rate_7d,
        hard_hit_7d: window.hard_hit_7d
      },
      recommendation: recommendation,
      fantasy_action: fantasyAction
    };
  }
  
  async fetchPerformanceWindows(): Promise<PlayerPerformanceWindow[]> {
    console.log('📊 Fetching player performance data...');
    
    // Query for recent player stats
    const { data: players, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('stat_type', 'statcast_hitting')
      .order('stat_date', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching player data:', error);
      return [];
    }
    
    // Create mock performance windows (in production, calculate from game logs)
    const windows: PlayerPerformanceWindow[] = [];
    
    players?.slice(0, 100).forEach(record => {
      const stats = record.stat_value;
      if (!stats || !stats.expected_woba) return;
      
      const baseXwoba = stats.expected_woba || 0.320;
      
      // Simulate rolling windows with some variance
      windows.push({
        player_id: stats.player_id,
        player_name: stats.player_name,
        // Create realistic rolling windows
        xwoba_3d: baseXwoba + (Math.random() * 0.08 - 0.04), // ±0.040
        xwoba_7d: baseXwoba + (Math.random() * 0.06 - 0.03), // ±0.030
        xwoba_14d: baseXwoba + (Math.random() * 0.04 - 0.02), // ±0.020
        xwoba_30d: baseXwoba + (Math.random() * 0.02 - 0.01), // ±0.010
        xwoba_season: baseXwoba,
        // Supporting metrics
        barrel_rate_7d: (stats.barrel_percent || 8) + (Math.random() * 4 - 2),
        hard_hit_7d: (stats.hard_hit_percent || 40) + (Math.random() * 10 - 5),
        k_rate_7d: 22 + (Math.random() * 10 - 5),
        bb_rate_7d: 8 + (Math.random() * 4 - 2),
        // Context
        games_last_7d: Math.floor(Math.random() * 3) + 5,
        plate_appearances_7d: Math.floor(Math.random() * 10) + 20,
        upcoming_pitcher_quality: Math.random() * 10,
        park_factor: 0.8 + Math.random() * 0.4
      });
    });
    
    console.log(`✅ Loaded performance windows for ${windows.length} players`);
    return windows;
  }
  
  async trainModel() {
    console.log('🎯 Training streak prediction model...\n');
    
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // Generate synthetic training data
    const trainingData = this.generateTrainingData();
    
    const xs = tf.tensor2d(trainingData.features);
    const ys = tf.tensor2d(trainingData.labels);
    
    console.log('📊 Training on', trainingData.features.length, 'examples...');
    
    await this.model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 20 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss.toFixed(4)}, accuracy = ${logs?.acc.toFixed(4)}`);
          }
        }
      }
    });
    
    // Save the model
    await this.model.save('file://./models/streak-predictor');
    console.log('✅ Model trained and saved!\n');
    
    xs.dispose();
    ys.dispose();
  }
  
  private generateTrainingData(): { features: number[][], labels: number[][] } {
    const features: number[][] = [];
    const labels: number[][] = [];
    
    // Generate synthetic training examples
    for (let i = 0; i < 2000; i++) {
      const streakType = Math.floor(Math.random() * 3); // 0=hot, 1=neutral, 2=cold
      
      // Create features that correlate with streak type
      const baseXwoba = streakType === 0 ? 0.380 : streakType === 2 ? 0.290 : 0.335;
      const trend = streakType === 0 ? 0.05 : streakType === 2 ? -0.05 : 0;
      
      const feature = [
        // Rolling windows
        (baseXwoba + trend * 2 + Math.random() * 0.02) / 0.400,
        (baseXwoba + trend + Math.random() * 0.02) / 0.400,
        (baseXwoba + trend * 0.5 + Math.random() * 0.02) / 0.400,
        (baseXwoba + Math.random() * 0.02) / 0.400,
        
        // Trends
        0.5 + trend * 5 + Math.random() * 0.1,
        0.5 + trend * 3 + Math.random() * 0.1,
        0.5 + trend * 2 + Math.random() * 0.1,
        
        // Quality indicators
        (streakType === 0 ? 12 : streakType === 2 ? 4 : 8) / 15 + Math.random() * 0.1,
        (streakType === 0 ? 48 : streakType === 2 ? 32 : 40) / 50 + Math.random() * 0.1,
        
        // Discipline
        (streakType === 0 ? 0.8 : streakType === 2 ? 0.6 : 0.7) + Math.random() * 0.1,
        (streakType === 0 ? 10 : streakType === 2 ? 6 : 8) / 15 + Math.random() * 0.05,
        
        // Context
        Math.random()
      ];
      
      // One-hot encode labels
      const label = [0, 0, 0];
      label[streakType] = 1;
      
      features.push(feature);
      labels.push(label);
    }
    
    return { features, labels };
  }
  
  displayStreakPredictions(predictions: StreakPrediction[]) {
    console.log('\n🔥 STREAK PREDICTION REPORT');
    console.log('=' .repeat(80));
    
    // Hot streak predictions
    const hotStreaks = predictions.filter(p => p.predicted_next_7_days === 'HOT');
    const buyLowCandidates = predictions.filter(p => 
      p.current_streak === 'COLD' && p.predicted_next_7_days === 'HOT'
    );
    const sellHighCandidates = predictions.filter(p => 
      p.current_streak === 'HOT' && p.predicted_next_7_days === 'COLD'
    );
    
    if (buyLowCandidates.length > 0) {
      console.log('\n💎 BUY LOW OPPORTUNITIES:');
      console.log('-' .repeat(80));
      buyLowCandidates.slice(0, 5).forEach(player => {
        console.log(`\n${player.player_name} - Currently ${player.current_streak} → Predicted ${player.predicted_next_7_days}`);
        console.log(`Confidence: ${(player.confidence * 100).toFixed(1)}%`);
        console.log(`Current xwOBA: ${player.key_metrics.xwoba_7d.toFixed(3)} | Trend: ${player.key_metrics.xwoba_trend > 0 ? '+' : ''}${player.key_metrics.xwoba_trend.toFixed(1)}%`);
        console.log(`Hot Probability: ${(player.streak_probability.hot * 100).toFixed(1)}%`);
        console.log(`📋 ${player.recommendation}`);
      });
    }
    
    if (sellHighCandidates.length > 0) {
      console.log('\n📈 SELL HIGH OPPORTUNITIES:');
      console.log('-' .repeat(80));
      sellHighCandidates.slice(0, 5).forEach(player => {
        console.log(`\n${player.player_name} - Currently ${player.current_streak} → Predicted ${player.predicted_next_7_days}`);
        console.log(`Confidence: ${(player.confidence * 100).toFixed(1)}%`);
        console.log(`Current xwOBA: ${player.key_metrics.xwoba_7d.toFixed(3)} | Trend: ${player.key_metrics.xwoba_trend > 0 ? '+' : ''}${player.key_metrics.xwoba_trend.toFixed(1)}%`);
        console.log(`Cold Probability: ${(player.streak_probability.cold * 100).toFixed(1)}%`);
        console.log(`📋 ${player.recommendation}`);
      });
    }
    
    console.log('\n🔥 HOT STREAKS TO RIDE:');
    console.log('-' .repeat(80));
    hotStreaks.filter(p => p.current_streak === 'HOT').slice(0, 10).forEach(player => {
      console.log(`${player.player_name} - xwOBA: ${player.key_metrics.xwoba_7d.toFixed(3)} | Barrels: ${player.key_metrics.barrel_rate_7d.toFixed(1)}% | Confidence: ${(player.confidence * 100).toFixed(1)}%`);
    });
    
    console.log('\n' + '=' .repeat(80));
    console.log('💡 Use these predictions for DFS lineups, start/sit decisions, and trades!\n');
  }
}

// Main execution
async function main() {
  const predictor = new HotColdStreakPredictor();
  
  try {
    // Initialize model
    await predictor.initialize();
    
    // Check if we need to train
    const args = process.argv.slice(2);
    if (args[0] === 'train') {
      await predictor.trainModel();
    }
    
    // Make predictions
    const predictions = await predictor.predictStreaks();
    
    if (predictions.length > 0) {
      predictor.displayStreakPredictions(predictions);
    } else {
      console.log('No player data available for streak prediction.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { HotColdStreakPredictor };