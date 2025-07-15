#!/usr/bin/env node
import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🏥 INJURY RISK DETECTION SYSTEM');
console.log('⚠️  Analyzing swing mechanics degradation patterns\n');

interface InjuryRiskAssessment {
  player_name: string;
  player_id: string;
  team: string;
  risk_score: number; // 0-100 (100 = highest risk)
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  confidence: number; // 0-1
  warning_signs: string[];
  mechanics_changes: {
    bat_speed_decline?: number;
    swing_length_increase?: number;
    squared_up_decline?: number;
    exit_velo_decline?: number;
  };
  historical_injuries?: string[];
  recommendation: string;
}

interface PlayerMechanics {
  player_id: string;
  player_name: string;
  // Current mechanics (last 10 games)
  current_bat_speed: number;
  current_swing_length: number;
  current_squared_up: number;
  current_exit_velo: number;
  current_sprint_speed: number;
  // 30-day averages
  avg_bat_speed_30d: number;
  avg_swing_length_30d: number;
  avg_squared_up_30d: number;
  avg_exit_velo_30d: number;
  // Season averages
  season_bat_speed: number;
  season_swing_length: number;
  season_squared_up: number;
  season_exit_velo: number;
  // Additional factors
  age: number;
  games_played_last_30: number;
  days_since_last_rest: number;
}

class InjuryRiskDetector {
  private model: tf.LayersModel | null = null;
  private readonly RISK_THRESHOLDS = {
    LOW: 25,
    MODERATE: 50,
    HIGH: 75,
    CRITICAL: 90
  };
  
  async initialize() {
    console.log('🧠 Initializing injury risk detection model...\n');
    
    try {
      this.model = await tf.loadLayersModel('file://./models/injury-risk-detector/model.json');
      console.log('✅ Loaded existing injury risk model');
    } catch (error) {
      console.log('📊 Creating new injury risk detection model...');
      this.model = this.createModel();
      console.log('✅ Model created successfully');
    }
  }
  
  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Input layer - 17 features
        tf.layers.dense({
          inputShape: [17],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        // Batch normalization for stability
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.4 }),
        
        // Hidden layers with residual connections concept
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        // Output layer - injury risk probability
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.0005),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });
    
    return model;
  }
  
  async detectInjuryRisks(): Promise<InjuryRiskAssessment[]> {
    console.log('🔍 Analyzing player mechanics for injury risk...\n');
    
    // Fetch player mechanics data
    const mechanics = await this.fetchPlayerMechanics();
    console.log(`📊 Analyzing ${mechanics.length} players for injury risk...\n`);
    
    const assessments: InjuryRiskAssessment[] = [];
    
    for (const player of mechanics) {
      const features = this.extractFeatures(player);
      const prediction = await this.predictRisk(features);
      
      const assessment = this.createAssessment(player, prediction);
      assessments.push(assessment);
    }
    
    // Sort by risk score (highest first)
    assessments.sort((a, b) => b.risk_score - a.risk_score);
    
    return assessments;
  }
  
  private extractFeatures(mechanics: PlayerMechanics): number[] {
    // Calculate percentage declines
    const batSpeedDecline = (mechanics.season_bat_speed - mechanics.current_bat_speed) / mechanics.season_bat_speed;
    const swingLengthIncrease = (mechanics.current_swing_length - mechanics.season_swing_length) / mechanics.season_swing_length;
    const squaredUpDecline = (mechanics.season_squared_up - mechanics.current_squared_up) / mechanics.season_squared_up;
    const exitVeloDecline = (mechanics.season_exit_velo - mechanics.current_exit_velo) / mechanics.season_exit_velo;
    
    // 30-day trends
    const batSpeed30dTrend = (mechanics.avg_bat_speed_30d - mechanics.current_bat_speed) / mechanics.avg_bat_speed_30d;
    const swingLength30dTrend = (mechanics.current_swing_length - mechanics.avg_swing_length_30d) / mechanics.avg_swing_length_30d;
    const squaredUp30dTrend = (mechanics.avg_squared_up_30d - mechanics.current_squared_up) / mechanics.avg_squared_up_30d;
    
    return [
      // Mechanics degradation (normalized)
      Math.max(0, batSpeedDecline * 10), // Bat speed decline
      Math.max(0, swingLengthIncrease * 10), // Swing getting longer
      Math.max(0, squaredUpDecline * 10), // Contact quality decline
      Math.max(0, exitVeloDecline * 10), // Exit velo decline
      
      // 30-day trends
      Math.max(0, batSpeed30dTrend * 10),
      Math.max(0, swingLength30dTrend * 10),
      Math.max(0, squaredUp30dTrend * 10),
      
      // Sprint speed indicator (fatigue)
      mechanics.current_sprint_speed < 27 ? 1 : 0, // Below average speed
      
      // Workload indicators
      mechanics.games_played_last_30 / 30, // Games per day
      mechanics.days_since_last_rest / 14, // Days without rest (normalized to 2 weeks)
      
      // Age risk factor
      mechanics.age > 30 ? (mechanics.age - 30) / 10 : 0,
      mechanics.age > 35 ? 1 : 0,
      
      // Performance indicators
      mechanics.current_bat_speed < 70 ? 1 : 0, // Below average bat speed
      mechanics.current_squared_up < 25 ? 1 : 0, // Poor contact
      mechanics.current_swing_length > 8 ? 1 : 0, // Long swing
      
      // Fatigue indicators
      mechanics.days_since_last_rest > 10 ? 1 : 0,
      mechanics.games_played_last_30 > 25 ? 1 : 0
    ];
  }
  
  private async predictRisk(features: number[]): Promise<{ probability: number, confidence: number }> {
    if (!this.model) throw new Error('Model not initialized');
    
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const probability = (await prediction.data())[0];
    
    // Calculate confidence based on feature severity
    const severity = features.reduce((sum, f) => sum + f, 0) / features.length;
    const confidence = Math.min(0.5 + severity * 0.5, 0.95);
    
    input.dispose();
    prediction.dispose();
    
    return { probability, confidence };
  }
  
  private createAssessment(mechanics: PlayerMechanics, prediction: any): InjuryRiskAssessment {
    const riskScore = Math.round(prediction.probability * 100);
    const warningSigns: string[] = [];
    
    // Calculate mechanics changes
    const mechanicsChanges: any = {};
    
    const batSpeedDecline = ((mechanics.season_bat_speed - mechanics.current_bat_speed) / mechanics.season_bat_speed) * 100;
    if (batSpeedDecline > 3) {
      mechanicsChanges.bat_speed_decline = batSpeedDecline;
      warningSigns.push(`Bat speed down ${batSpeedDecline.toFixed(1)}% from season average`);
    }
    
    const swingLengthIncrease = ((mechanics.current_swing_length - mechanics.season_swing_length) / mechanics.season_swing_length) * 100;
    if (swingLengthIncrease > 5) {
      mechanicsChanges.swing_length_increase = swingLengthIncrease;
      warningSigns.push(`Swing length increased ${swingLengthIncrease.toFixed(1)}% (compensation pattern)`);
    }
    
    const squaredUpDecline = ((mechanics.season_squared_up - mechanics.current_squared_up) / mechanics.season_squared_up) * 100;
    if (squaredUpDecline > 10) {
      mechanicsChanges.squared_up_decline = squaredUpDecline;
      warningSigns.push(`Contact quality down ${squaredUpDecline.toFixed(1)}%`);
    }
    
    const exitVeloDecline = ((mechanics.season_exit_velo - mechanics.current_exit_velo) / mechanics.season_exit_velo) * 100;
    if (exitVeloDecline > 2) {
      mechanicsChanges.exit_velo_decline = exitVeloDecline;
      warningSigns.push(`Exit velocity down ${exitVeloDecline.toFixed(1)}%`);
    }
    
    // Workload warnings
    if (mechanics.games_played_last_30 > 25) {
      warningSigns.push(`Heavy workload: ${mechanics.games_played_last_30} games in 30 days`);
    }
    
    if (mechanics.days_since_last_rest > 10) {
      warningSigns.push(`${mechanics.days_since_last_rest} days without rest`);
    }
    
    if (mechanics.age > 32) {
      warningSigns.push(`Age ${mechanics.age} - increased injury susceptibility`);
    }
    
    // Determine risk level
    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    if (riskScore >= this.RISK_THRESHOLDS.CRITICAL) {
      riskLevel = 'CRITICAL';
    } else if (riskScore >= this.RISK_THRESHOLDS.HIGH) {
      riskLevel = 'HIGH';
    } else if (riskScore >= this.RISK_THRESHOLDS.MODERATE) {
      riskLevel = 'MODERATE';
    } else {
      riskLevel = 'LOW';
    }
    
    // Generate recommendation
    let recommendation = '';
    switch (riskLevel) {
      case 'CRITICAL':
        recommendation = 'IMMEDIATE REST RECOMMENDED. Consider IL stint to prevent serious injury.';
        break;
      case 'HIGH':
        recommendation = 'Schedule rest days ASAP. Monitor closely and limit playing time.';
        break;
      case 'MODERATE':
        recommendation = 'Monitor swing mechanics daily. Consider periodic rest.';
        break;
      case 'LOW':
        recommendation = 'Continue normal usage. Maintain regular rest schedule.';
        break;
    }
    
    return {
      player_name: mechanics.player_name,
      player_id: mechanics.player_id,
      team: 'MLB', // Would need team lookup
      risk_score: riskScore,
      risk_level: riskLevel,
      confidence: prediction.confidence,
      warning_signs: warningSigns,
      mechanics_changes: mechanicsChanges,
      recommendation: recommendation
    };
  }
  
  async fetchPlayerMechanics(): Promise<PlayerMechanics[]> {
    console.log('📊 Fetching player mechanics data...');
    
    // Query for players with Statcast data
    const { data: players, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('stat_type', 'statcast_hitting')
      .order('stat_date', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching player data:', error);
      return [];
    }
    
    // Create mock mechanics data (in production, calculate from historical)
    const mechanicsData: PlayerMechanics[] = [];
    
    players?.slice(0, 50).forEach(record => {
      const stats = record.stat_value;
      if (!stats) return;
      
      // Simulate current vs historical mechanics
      const seasonBatSpeed = stats.bat_speed_avg || 72;
      const currentBatSpeed = seasonBatSpeed - (Math.random() * 5); // 0-5 MPH decline
      
      mechanicsData.push({
        player_id: stats.player_id,
        player_name: stats.player_name,
        // Current (simulate degradation for some players)
        current_bat_speed: currentBatSpeed,
        current_swing_length: 7.5 + Math.random() * 1.5,
        current_squared_up: (stats.squared_up_rate || 30) - (Math.random() * 10),
        current_exit_velo: (stats.exit_velocity_avg || 88) - (Math.random() * 3),
        current_sprint_speed: 27 + (Math.random() * 4 - 2),
        // 30-day averages
        avg_bat_speed_30d: currentBatSpeed + 1,
        avg_swing_length_30d: 7.5 + Math.random() * 0.5,
        avg_squared_up_30d: stats.squared_up_rate || 30,
        avg_exit_velo_30d: stats.exit_velocity_avg || 88,
        // Season averages
        season_bat_speed: seasonBatSpeed,
        season_swing_length: 7.5,
        season_squared_up: stats.squared_up_rate || 30,
        season_exit_velo: stats.exit_velocity_avg || 88,
        // Additional
        age: Math.floor(Math.random() * 15) + 22,
        games_played_last_30: Math.floor(Math.random() * 30),
        days_since_last_rest: Math.floor(Math.random() * 20)
      });
    });
    
    console.log(`✅ Loaded mechanics data for ${mechanicsData.length} players`);
    return mechanicsData;
  }
  
  async trainModel() {
    console.log('🎯 Training injury risk detection model...\n');
    
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // Generate synthetic training data
    const trainingData = this.generateTrainingData();
    
    const xs = tf.tensor2d(trainingData.features);
    const ys = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1]);
    
    console.log('📊 Training on', trainingData.features.length, 'examples...');
    
    await this.model.fit(xs, ys, {
      epochs: 100,
      batchSize: 64,
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
    await this.model.save('file://./models/injury-risk-detector');
    console.log('✅ Model trained and saved!\n');
    
    xs.dispose();
    ys.dispose();
  }
  
  private generateTrainingData(): { features: number[][], labels: number[] } {
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Generate synthetic training examples
    for (let i = 0; i < 2000; i++) {
      const hasInjuryRisk = Math.random() > 0.8; // 20% injury risk
      
      const feature = [
        // Mechanics degradation
        hasInjuryRisk ? Math.random() * 0.5 + 0.3 : Math.random() * 0.3,
        hasInjuryRisk ? Math.random() * 0.4 + 0.2 : Math.random() * 0.2,
        hasInjuryRisk ? Math.random() * 0.6 + 0.3 : Math.random() * 0.3,
        hasInjuryRisk ? Math.random() * 0.3 + 0.1 : Math.random() * 0.1,
        
        // 30-day trends
        hasInjuryRisk ? Math.random() * 0.4 + 0.2 : Math.random() * 0.2,
        hasInjuryRisk ? Math.random() * 0.3 + 0.1 : Math.random() * 0.1,
        hasInjuryRisk ? Math.random() * 0.5 + 0.2 : Math.random() * 0.2,
        
        // Fatigue indicators
        hasInjuryRisk ? Math.random() > 0.3 ? 1 : 0 : Math.random() > 0.8 ? 1 : 0,
        
        // Workload
        hasInjuryRisk ? 0.7 + Math.random() * 0.3 : Math.random() * 0.8,
        hasInjuryRisk ? 0.6 + Math.random() * 0.4 : Math.random() * 0.7,
        
        // Age factors
        hasInjuryRisk ? Math.random() * 0.5 : Math.random() * 0.3,
        hasInjuryRisk ? Math.random() > 0.5 ? 1 : 0 : Math.random() > 0.9 ? 1 : 0,
        
        // Performance indicators
        hasInjuryRisk ? Math.random() > 0.4 ? 1 : 0 : Math.random() > 0.8 ? 1 : 0,
        hasInjuryRisk ? Math.random() > 0.3 ? 1 : 0 : Math.random() > 0.85 ? 1 : 0,
        hasInjuryRisk ? Math.random() > 0.4 ? 1 : 0 : Math.random() > 0.9 ? 1 : 0,
        
        // Additional fatigue
        hasInjuryRisk ? Math.random() > 0.3 ? 1 : 0 : Math.random() > 0.9 ? 1 : 0,
        hasInjuryRisk ? Math.random() > 0.4 ? 1 : 0 : Math.random() > 0.85 ? 1 : 0
      ];
      
      features.push(feature);
      labels.push(hasInjuryRisk ? 1 : 0);
    }
    
    return { features, labels };
  }
  
  displayRiskAssessments(assessments: InjuryRiskAssessment[]) {
    console.log('\n🚨 INJURY RISK ASSESSMENT REPORT');
    console.log('=' .repeat(80));
    
    // Group by risk level
    const critical = assessments.filter(a => a.risk_level === 'CRITICAL');
    const high = assessments.filter(a => a.risk_level === 'HIGH');
    const moderate = assessments.filter(a => a.risk_level === 'MODERATE');
    
    if (critical.length > 0) {
      console.log('\n🔴 CRITICAL RISK PLAYERS:');
      console.log('-' .repeat(80));
      critical.forEach(player => {
        console.log(`\n${player.player_name} - Risk Score: ${player.risk_score}`);
        console.log(`Confidence: ${(player.confidence * 100).toFixed(1)}%`);
        console.log('Warning Signs:');
        player.warning_signs.forEach(sign => {
          console.log(`  ⚠️  ${sign}`);
        });
        console.log(`\n📋 Recommendation: ${player.recommendation}`);
      });
    }
    
    if (high.length > 0) {
      console.log('\n🟠 HIGH RISK PLAYERS:');
      console.log('-' .repeat(80));
      high.slice(0, 5).forEach(player => {
        console.log(`\n${player.player_name} - Risk Score: ${player.risk_score}`);
        console.log('Key Concerns:');
        player.warning_signs.slice(0, 3).forEach(sign => {
          console.log(`  • ${sign}`);
        });
        console.log(`Recommendation: ${player.recommendation}`);
      });
    }
    
    if (moderate.length > 0) {
      console.log('\n🟡 MODERATE RISK PLAYERS:');
      console.log('-' .repeat(80));
      console.log(`${moderate.length} players with moderate injury risk.`);
      console.log('Top 3:');
      moderate.slice(0, 3).forEach(player => {
        console.log(`  • ${player.player_name} (Risk: ${player.risk_score}) - ${player.warning_signs[0] || 'Monitor closely'}`);
      });
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('💡 Fantasy Impact: Avoid or sell high-risk players, monitor moderate risks closely\n');
  }
}

// Main execution
async function main() {
  const detector = new InjuryRiskDetector();
  
  try {
    // Initialize model
    await detector.initialize();
    
    // Check if we need to train
    const args = process.argv.slice(2);
    if (args[0] === 'train') {
      await detector.trainModel();
    }
    
    // Detect injury risks
    const assessments = await detector.detectInjuryRisks();
    
    if (assessments.length > 0) {
      detector.displayRiskAssessments(assessments);
    } else {
      console.log('No player data available for injury risk assessment.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { InjuryRiskDetector };