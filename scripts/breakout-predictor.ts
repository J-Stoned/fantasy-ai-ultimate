#!/usr/bin/env node
import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🚀 BREAKOUT CANDIDATE PREDICTOR');
console.log('⚡ Using bat speed + xStats trends to identify future stars\n');

interface BreakoutCandidate {
  player_name: string;
  player_id: string;
  team: string;
  breakout_score: number; // 0-100
  confidence: number; // 0-1
  key_indicators: string[];
  projected_improvements: {
    avg_increase?: number;
    hr_increase?: number;
    ops_increase?: number;
  };
  risk_factors: string[];
}

interface PlayerTrend {
  player_id: string;
  player_name: string;
  // Current season stats
  current_avg: number;
  current_ops: number;
  current_hr: number;
  // Expected stats
  xba: number;
  xslg: number;
  xwoba: number;
  // Bat tracking
  bat_speed_avg: number;
  bat_speed_trend: number; // % change over last 30 days
  squared_up_rate: number;
  barrel_percent: number;
  // Historical performance
  career_avg: number;
  age: number;
  games_played: number;
}

class BreakoutPredictor {
  private model: tf.LayersModel | null = null;
  
  async initialize() {
    console.log('🧠 Initializing breakout prediction model...\n');
    
    // Load or create the model
    try {
      // Try to load existing model
      this.model = await tf.loadLayersModel('file://./models/breakout-predictor/model.json');
      console.log('✅ Loaded existing breakout model');
    } catch (error) {
      // Create new model
      console.log('📊 Creating new breakout prediction model...');
      this.model = this.createModel();
      console.log('✅ Model created successfully');
    }
  }
  
  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Input layer - 15 features
        tf.layers.dense({
          inputShape: [15],
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        // Dropout for regularization
        tf.layers.dropout({ rate: 0.3 }),
        
        // Hidden layers
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        // Output layer - breakout probability
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });
    
    return model;
  }
  
  async predictBreakouts(): Promise<BreakoutCandidate[]> {
    console.log('🔍 Analyzing players for breakout potential...\n');
    
    // Fetch player trends
    const trends = await this.fetchPlayerTrends();
    console.log(`📊 Analyzing ${trends.length} players...\n`);
    
    const candidates: BreakoutCandidate[] = [];
    
    for (const trend of trends) {
      const features = this.extractFeatures(trend);
      const prediction = await this.predictSingle(features);
      
      if (prediction.probability > 0.7) { // High breakout potential
        const candidate = this.analyzeBreakoutCandidate(trend, prediction);
        candidates.push(candidate);
      }
    }
    
    // Sort by breakout score
    candidates.sort((a, b) => b.breakout_score - a.breakout_score);
    
    return candidates;
  }
  
  private extractFeatures(trend: PlayerTrend): number[] {
    return [
      // Performance gap indicators
      trend.xba - trend.current_avg, // Expected vs actual BA gap
      trend.xwoba - (trend.current_ops * 0.32), // Rough xwOBA vs actual
      trend.xslg - (trend.current_ops - trend.current_avg), // xSLG vs actual SLG
      
      // Bat speed indicators
      trend.bat_speed_avg / 80, // Normalized (80 MPH = elite)
      trend.bat_speed_trend / 10, // Trend normalized
      trend.squared_up_rate / 100,
      trend.barrel_percent / 15, // Normalized (15% = elite)
      
      // Age and experience
      (27 - trend.age) / 10, // Peak age proximity (27 is typical peak)
      Math.min(trend.games_played / 500, 1), // Experience factor
      
      // Current performance
      trend.current_avg / 0.300, // Normalized to .300
      trend.current_ops / 0.900, // Normalized to .900
      trend.current_hr / 30, // Normalized to 30 HR
      
      // Improvement potential
      (trend.current_avg < trend.career_avg) ? 1 : 0, // Underperforming career
      trend.age < 26 ? 1 : 0, // Young player bonus
      trend.bat_speed_avg > 72 ? 1 : 0 // Fast swing indicator
    ];
  }
  
  private async predictSingle(features: number[]): Promise<{ probability: number, confidence: number }> {
    if (!this.model) throw new Error('Model not initialized');
    
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const probability = (await prediction.data())[0];
    
    // Calculate confidence based on feature strength
    const featureStrength = features.reduce((sum, f) => sum + Math.abs(f), 0) / features.length;
    const confidence = Math.min(featureStrength * probability, 1);
    
    input.dispose();
    prediction.dispose();
    
    return { probability, confidence };
  }
  
  private analyzeBreakoutCandidate(trend: PlayerTrend, prediction: any): BreakoutCandidate {
    const keyIndicators: string[] = [];
    const riskFactors: string[] = [];
    
    // Analyze key positive indicators
    const xbaGap = trend.xba - trend.current_avg;
    if (xbaGap > 0.020) {
      keyIndicators.push(`xBA ${(trend.xba * 1000).toFixed(0)} vs actual ${(trend.current_avg * 1000).toFixed(0)} (+${(xbaGap * 1000).toFixed(0)} points)`);
    }
    
    if (trend.bat_speed_avg > 72) {
      keyIndicators.push(`Elite bat speed: ${trend.bat_speed_avg.toFixed(1)} MPH`);
    }
    
    if (trend.bat_speed_trend > 2) {
      keyIndicators.push(`Bat speed improving: +${trend.bat_speed_trend.toFixed(1)}% last 30 days`);
    }
    
    if (trend.barrel_percent > 8) {
      keyIndicators.push(`High barrel rate: ${trend.barrel_percent.toFixed(1)}%`);
    }
    
    if (trend.age < 26) {
      keyIndicators.push(`Young player entering prime (age ${trend.age})`);
    }
    
    // Analyze risk factors
    if (trend.games_played < 100) {
      riskFactors.push('Limited MLB experience');
    }
    
    if (trend.squared_up_rate < 25) {
      riskFactors.push('Below-average contact quality');
    }
    
    if (trend.current_avg < 0.220) {
      riskFactors.push('Currently struggling (.220 or below)');
    }
    
    // Calculate projected improvements
    const avgIncrease = Math.max(0, Math.min(xbaGap, 0.050));
    const opsIncrease = avgIncrease * 2.5; // Rough estimate
    const hrIncrease = trend.barrel_percent > 10 ? 5 : 3;
    
    return {
      player_name: trend.player_name,
      player_id: trend.player_id,
      team: 'MLB', // Would need team lookup
      breakout_score: Math.round(prediction.probability * 100),
      confidence: prediction.confidence,
      key_indicators: keyIndicators,
      projected_improvements: {
        avg_increase: Math.round(avgIncrease * 1000),
        hr_increase: hrIncrease,
        ops_increase: Math.round(opsIncrease * 1000)
      },
      risk_factors: riskFactors
    };
  }
  
  async fetchPlayerTrends(): Promise<PlayerTrend[]> {
    console.log('📊 Fetching player statistics and trends...');
    
    // Query for players with both traditional and Statcast data
    const { data: players, error } = await supabase
      .from('player_stats')
      .select('*')
      .in('stat_type', ['current_mlb_stats', 'statcast_hitting'])
      .order('stat_date', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching player data:', error);
      return [];
    }
    
    // Group by player and merge stats
    const playerMap = new Map<string, any>();
    
    players?.forEach(record => {
      const playerId = record.stat_value?.player_id;
      if (!playerId) return;
      
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          player_id: playerId,
          player_name: record.stat_value.player_name,
          team: record.stat_value.team
        });
      }
      
      const player = playerMap.get(playerId);
      
      if (record.stat_type === 'current_mlb_stats') {
        player.current_avg = record.stat_value.avg || 0;
        player.current_ops = record.stat_value.ops || 0;
        player.current_hr = record.stat_value.homeRuns || 0;
      } else if (record.stat_type === 'statcast_hitting') {
        player.xba = record.stat_value.expected_batting_average || 0;
        player.xslg = record.stat_value.expected_slugging || 0;
        player.xwoba = record.stat_value.expected_woba || 0;
        player.bat_speed_avg = record.stat_value.bat_speed_avg || 0;
        player.squared_up_rate = record.stat_value.squared_up_rate || 0;
        player.barrel_percent = record.stat_value.barrel_percent || 0;
      }
    });
    
    // Filter for players with complete data
    const trends = Array.from(playerMap.values()).filter(p => 
      p.current_avg !== undefined && 
      p.xba !== undefined && 
      p.bat_speed_avg !== undefined
    );
    
    // Add mock trend data (in production, calculate from historical)
    trends.forEach(player => {
      player.bat_speed_trend = Math.random() * 10 - 2; // -2% to +8%
      player.career_avg = player.current_avg + (Math.random() * 0.020 - 0.010);
      player.age = Math.floor(Math.random() * 12) + 22; // 22-33 years old
      player.games_played = Math.floor(Math.random() * 800) + 50;
    });
    
    console.log(`✅ Loaded data for ${trends.length} players`);
    return trends;
  }
  
  async trainModel(historicalData?: any[]) {
    console.log('🎯 Training breakout prediction model...\n');
    
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // In production, load historical breakout data
    // For now, create synthetic training data
    const trainingData = this.generateTrainingData();
    
    const xs = tf.tensor2d(trainingData.features);
    const ys = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1]);
    
    console.log('📊 Training on', trainingData.features.length, 'examples...');
    
    await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss.toFixed(4)}, accuracy = ${logs?.acc.toFixed(4)}`);
          }
        }
      }
    });
    
    // Save the model
    await this.model.save('file://./models/breakout-predictor');
    console.log('✅ Model trained and saved!\n');
    
    xs.dispose();
    ys.dispose();
  }
  
  private generateTrainingData(): { features: number[][], labels: number[] } {
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Generate synthetic training examples
    for (let i = 0; i < 1000; i++) {
      const isBreakout = Math.random() > 0.7; // 30% breakout rate
      
      const feature = [
        // Performance gaps (bigger gap = more likely breakout)
        isBreakout ? Math.random() * 0.05 + 0.01 : Math.random() * 0.02 - 0.01, // xBA gap
        isBreakout ? Math.random() * 0.08 + 0.02 : Math.random() * 0.04 - 0.02, // xwOBA gap
        isBreakout ? Math.random() * 0.10 + 0.03 : Math.random() * 0.05 - 0.02, // xSLG gap
        
        // Bat speed (higher = better)
        isBreakout ? 0.9 + Math.random() * 0.2 : 0.7 + Math.random() * 0.3,
        isBreakout ? Math.random() * 0.8 + 0.2 : Math.random() * 0.4 - 0.2, // Trend
        isBreakout ? 0.7 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3, // Squared up
        isBreakout ? 0.6 + Math.random() * 0.4 : 0.3 + Math.random() * 0.4, // Barrels
        
        // Age and experience
        isBreakout ? 0.5 + Math.random() * 0.3 : Math.random() * 0.8,
        Math.random(), // Games played
        
        // Current performance
        isBreakout ? 0.7 + Math.random() * 0.3 : 0.5 + Math.random() * 0.5,
        isBreakout ? 0.6 + Math.random() * 0.4 : 0.4 + Math.random() * 0.6,
        isBreakout ? 0.5 + Math.random() * 0.5 : 0.3 + Math.random() * 0.7,
        
        // Indicators
        isBreakout ? Math.random() > 0.3 ? 1 : 0 : Math.random() > 0.7 ? 1 : 0,
        isBreakout ? Math.random() > 0.4 ? 1 : 0 : Math.random() > 0.8 ? 1 : 0,
        isBreakout ? Math.random() > 0.2 ? 1 : 0 : Math.random() > 0.6 ? 1 : 0
      ];
      
      features.push(feature);
      labels.push(isBreakout ? 1 : 0);
    }
    
    return { features, labels };
  }
  
  displayBreakoutCandidates(candidates: BreakoutCandidate[]) {
    console.log('\n🌟 TOP BREAKOUT CANDIDATES FOR 2025');
    console.log('=' .repeat(70));
    
    candidates.slice(0, 10).forEach((candidate, index) => {
      console.log(`\n${index + 1}. ${candidate.player_name} - Breakout Score: ${candidate.breakout_score}`);
      console.log(`   Confidence: ${(candidate.confidence * 100).toFixed(1)}%`);
      
      console.log('   📈 Key Indicators:');
      candidate.key_indicators.forEach(indicator => {
        console.log(`      • ${indicator}`);
      });
      
      console.log('   🎯 Projected Improvements:');
      if (candidate.projected_improvements.avg_increase) {
        console.log(`      • AVG: +${candidate.projected_improvements.avg_increase} points`);
      }
      if (candidate.projected_improvements.hr_increase) {
        console.log(`      • HR: +${candidate.projected_improvements.hr_increase}`);
      }
      if (candidate.projected_improvements.ops_increase) {
        console.log(`      • OPS: +${candidate.projected_improvements.ops_increase} points`);
      }
      
      if (candidate.risk_factors.length > 0) {
        console.log('   ⚠️  Risk Factors:');
        candidate.risk_factors.forEach(risk => {
          console.log(`      • ${risk}`);
        });
      }
    });
    
    console.log('\n' + '=' .repeat(70));
    console.log('💡 Fantasy Advice: Target these players in late rounds or via trade!\n');
  }
}

// Main execution
async function main() {
  const predictor = new BreakoutPredictor();
  
  try {
    // Initialize model
    await predictor.initialize();
    
    // Check if we need to train
    const args = process.argv.slice(2);
    if (args[0] === 'train') {
      await predictor.trainModel();
    }
    
    // Make predictions
    const candidates = await predictor.predictBreakouts();
    
    if (candidates.length > 0) {
      predictor.displayBreakoutCandidates(candidates);
    } else {
      console.log('No breakout candidates found with high confidence.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { BreakoutPredictor };