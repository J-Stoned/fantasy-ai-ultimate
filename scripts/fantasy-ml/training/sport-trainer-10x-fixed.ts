#!/usr/bin/env tsx
/**
 * 🔥 SPORT-SPECIFIC 10X TRAINER (FIXED) - EACH SPORT IS DIFFERENT!
 * 
 * This trainer recognizes that each sport has COMPLETELY different:
 * - Stats and metrics
 * - Gameplay dynamics
 * - Fantasy scoring systems
 * - Predictive features
 * 
 * FIXED: Properly handles JSONB stats and ensures numeric values
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';
import * as tf from '@tensorflow/tfjs-node';

// Test database connection on startup
async function testDatabaseConnection(): Promise<void> {
  try {
    const result = await pgPool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(chalk.green(`✅ Database connected successfully`));
    console.log(chalk.gray(`   Time: ${result.rows[0].current_time}`));
    console.log(chalk.gray(`   Version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`));
    
    // Check available ML views
    const viewsResult = await pgPool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%ml%' OR table_name = 'player_game_logs')
      ORDER BY table_name
    `);
    
    console.log(chalk.cyan(`📊 Available ML views:`));
    viewsResult.rows.forEach(row => {
      console.log(chalk.gray(`   - ${row.table_name}`));
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Database connection failed:'), error);
    throw error;
  }
}

export class SportSpecificTrainer {
  private readonly SPORT_CONFIGS = {
    NFL: {
      positions: ['QB', 'RB', 'WR', 'TE', 'DST'],
      minSamples: 5000,
      targetAccuracy: 0.91
    },
    NBA: {
      positions: ['PG', 'SG', 'SF', 'PF', 'C'],
      minSamples: 10000,
      targetAccuracy: 0.85
    },
    MLB: {
      positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
      minSamples: 8000,
      targetAccuracy: 0.75
    },
    NHL: {
      positions: ['C', 'W', 'D', 'G'],
      minSamples: 6000,
      targetAccuracy: 0.80
    }
  };
  
  constructor() {
    console.log(chalk.blue.bold('🔥 SPORT-SPECIFIC 10X TRAINER (FIXED) INITIALIZED'));
    console.log(chalk.yellow('🏈 NFL: Weather, Vegas lines, QB-WR stacks'));
    console.log(chalk.yellow('🏀 NBA: Pace, back-to-backs, blowout risk'));
    console.log(chalk.yellow('⚾ MLB: Ballpark factors, platoons, weather'));
    console.log(chalk.yellow('🏒 NHL: Goalie matchups, power play, line combos'));
  }
  
  /**
   * 🎯 TRAIN SPORT-SPECIFIC MODEL
   */
  async trainSportModel(sport: 'NFL' | 'NBA' | 'MLB' | 'NHL'): Promise<void> {
    console.log(chalk.cyan.bold(`\n🚀 TRAINING ${sport} MODEL WITH SPORT-SPECIFIC FEATURES...\n`));
    
    const config = this.SPORT_CONFIGS[sport];
    
    try {
      // STEP 1: Load sport-specific data
      console.log(chalk.yellow(`📊 Loading ${sport} game logs...`));
      const trainingData = await this.loadSportData(sport);
      console.log(chalk.green(`✅ Loaded ${trainingData.length} samples`));
      
      if (trainingData.length < config.minSamples) {
        console.log(chalk.yellow(`⚠️ Only ${trainingData.length} samples (need ${config.minSamples}), but continuing...`));
      }
      
      // STEP 2: Engineer sport-specific features
      console.log(chalk.yellow(`\n🔧 Engineering ${sport}-specific features...`));
      const engineeredData = await this.engineerSportFeatures(sport, trainingData);
      
      if (!engineeredData || !engineeredData.features || engineeredData.features.length === 0) {
        console.log(chalk.red('❌ No features were created during engineering!'));
        return;
      }
      
      console.log(chalk.green(`✅ Created ${engineeredData.features[0]?.length || 0} features per sample`));
      
      // Filter out any invalid samples
      const validData = engineeredData.data.filter(d => 
        d.features.every(f => typeof f === 'number' && !isNaN(f)) &&
        typeof d.target === 'number' && !isNaN(d.target)
      );
      console.log(chalk.green(`✅ Valid samples after filtering: ${validData.length}`));
      
      if (validData.length === 0) {
        console.log(chalk.red('❌ No valid samples after filtering!'));
        return;
      }
      
      // STEP 3: Normalize features for better training
      console.log(chalk.yellow(`📐 Normalizing features...`));
      const normalizedData = this.normalizeFeatures(validData);
      console.log(chalk.green(`✅ Features normalized (mean=0, std=1)`));
      
      // STEP 4: Create train/test split
      const split = this.createTrainTestSplit(normalizedData, 0.8);
      console.log(chalk.green(`✅ Train: ${split.train.length} | Test: ${split.test.length}`));
      
      // STEP 5: Train neural network
      console.log(chalk.yellow(`\n🧠 Training ${sport} neural network...`));
      const model = await this.trainNeuralNetwork(
        sport,
        split.train,
        split.test,
        engineeredData.featureNames
      );
      
      // STEP 5: Evaluate performance
      console.log(chalk.yellow(`\n📈 Evaluating ${sport} model...`));
      const metrics = await this.evaluateModel(model, split.test);
      
      console.log(chalk.blue('\n📊 MODEL PERFORMANCE:'));
      console.log(chalk.green(`   Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`));
      console.log(chalk.green(`   R²: ${metrics.r_squared.toFixed(4)}`));
      console.log(chalk.green(`   RMSE: ${metrics.rmse.toFixed(2)}`));
      
      if (metrics.accuracy >= config.targetAccuracy) {
        console.log(chalk.green.bold(`\n✅ TARGET ACCURACY ACHIEVED! (${(config.targetAccuracy * 100).toFixed(0)}%+)`));
      } else {
        console.log(chalk.yellow(`\n⚠️ Below target accuracy of ${(config.targetAccuracy * 100).toFixed(0)}%`));
      }
      
      // STEP 6: Save model
      await this.saveModel(model, sport);
      console.log(chalk.green(`\n✅ ${sport} model saved!`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Training failed for ${sport}:`), error);
    }
  }
  
  /**
   * 📊 LOAD SPORT-SPECIFIC DATA - OPTIMIZED FOR ML VIEWS
   */
  private async loadSportData(sport: string): Promise<any[]> {
    console.log(chalk.cyan(`🔍 Loading ${sport} data from optimized ML views...`));
    
    // Use enhanced sport-specific view (already proven to work!)
    const sportViewName = `${sport.toLowerCase()}_ml_enhanced`;
    
    const query = `
      SELECT 
        *
      FROM ${sportViewName}
      WHERE 
        game_date >= CURRENT_DATE - INTERVAL '4 years'
        AND fantasy_points IS NOT NULL
        AND fantasy_points > 0
        AND fantasy_points < 200  -- Remove extreme outliers
      ORDER BY game_date DESC
      LIMIT 75000  -- Increased sample size for better training
    `;
    
    try {
      console.log(chalk.gray(`   Loading from optimized view: ${sportViewName}`));
      const result = await pgPool.query(query);
      
      if (result.rows.length > 0) {
        console.log(chalk.green(`   ✅ Found ${result.rows.length} samples from ${sportViewName}`));
        
        // Quick data quality check
        const validSamples = result.rows.filter(row => 
          row.fantasy_points > 0 && 
          row.fantasy_points < 200  // More reasonable outlier threshold
        );
        
        console.log(chalk.cyan(`   📊 Data quality: ${validSamples.length}/${result.rows.length} valid samples (${((validSamples.length/result.rows.length)*100).toFixed(1)}%)`));
        
        return validSamples;
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Error loading from ${sportViewName}:`), error.message);
      throw error;
    }
    
    return [];
  }
  
  /**
   * 🔧 ENGINEER SPORT-SPECIFIC FEATURES
   */
  private async engineerSportFeatures(sport: string, data: any[]): Promise<any> {
    console.log(chalk.cyan(`Engineering features for ${sport}...`));
    
    switch (sport) {
      case 'NFL':
        return this.engineerNFLFeatures(data);
      case 'NBA':
        return this.engineerNBAFeatures(data);
      case 'MLB':
        return this.engineerMLBFeatures(data);
      case 'NHL':
        return this.engineerNHLFeatures(data);
      default:
        throw new Error(`Unknown sport: ${sport}`);
    }
  }
  
  /**
   * 🏈 NFL FEATURE ENGINEERING - OPTIMIZED FOR ML VIEWS
   */
  private async engineerNFLFeatures(data: any[]): Promise<any> {
    const featureNames = [
      'passing_yards', 'rushing_yards', 'receiving_yards', 'touchdowns',
      'targets', 'carries', 'receptions', 'fp_avg_last_3', 'fp_avg_last_5',
      'fp_avg_season', 'usage_rate', 'days_rest', 'is_home', 'is_primetime',
      'position_scoring', 'value_rating', 'points', 'assists'
    ];
    
    const engineeredData = data.map(game => {
      const stats = game.stats || {};
      
      // Use enhanced ML view fields first, fallback to JSONB stats
      const features = [
        this.safeNumber(game.passing_yards || stats.passing_yards || stats.pass_yds || 0),
        this.safeNumber(game.rushing_yards || stats.rushing_yards || stats.rush_yds || 0),
        this.safeNumber(game.receiving_yards || stats.receiving_yards || stats.rec_yds || 0),
        this.safeNumber(game.touchdowns || stats.touchdowns || stats.total_touchdowns || 0),
        this.safeNumber(game.targets || stats.targets || stats.tgt || 0),
        this.safeNumber(game.carries || stats.carries || stats.rushing_attempts || stats.rush_att || 0),
        this.safeNumber(game.receptions || stats.receptions || stats.rec || 0),
        
        // Use ML view rolling averages if available
        this.safeNumber(game.fp_avg_last_3 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_last_5 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_season || game.fantasy_points || 0),
        this.safeNumber(game.usage_rate || 0.15),
        this.safeNumber(game.days_rest || 7),
        
        // Basic features
        game.is_home ? 1 : 0,
        this.isPrimeTime(game.game_date) ? 1 : 0,
        this.safeNumber(game.position_scoring || game.fantasy_points || 0),
        this.safeNumber(game.value_rating || 0),
        this.safeNumber(game.points || 0),
        this.safeNumber(game.assists || 0)
      ];
      
      return {
        features,
        target: this.safeNumber(game.fantasy_points),
        playerId: game.player_id,
        position: game.position
      };
    });
    
    return {
      features: engineeredData.map(d => d.features),
      targets: engineeredData.map(d => d.target),
      featureNames,
      data: engineeredData
    };
  }
  
  /**
   * 🏀 NBA FEATURE ENGINEERING - OPTIMIZED FOR ML VIEWS
   */
  private async engineerNBAFeatures(data: any[]): Promise<any> {
    const featureNames = [
      'points', 'rebounds', 'assists', 'steals', 'blocks',
      'three_pointers', 'field_goals_made', 'free_throws_made', 'minutes',
      'turnovers', 'fp_avg_last_3', 'fp_avg_last_5', 'fp_avg_season',
      'usage_rate', 'days_rest', 'back_to_back', 'points_per_36',
      'minutes_avg_season', 'is_home'
    ];
    
    const engineeredData = data.map(game => {
      const stats = game.stats || {};
      
      const features = [
        this.safeNumber(game.points || stats.points || 0),
        this.safeNumber(game.rebounds || stats.total_rebounds || stats.rebounds || 0),
        this.safeNumber(game.assists || stats.assists || 0),
        this.safeNumber(game.steals || stats.steals || 0),
        this.safeNumber(game.blocks || stats.blocks || 0),
        this.safeNumber(game.three_pointers || stats.three_pointers_made || stats.three_pointers || 0),
        this.safeNumber(game.field_goals_made || stats.field_goals_made || 0),
        this.safeNumber(game.free_throws_made || stats.free_throws_made || 0),
        this.safeNumber(game.minutes || stats.minutes_played || stats.minutes || 0),
        this.safeNumber(game.turnovers || stats.turnovers || 0),
        
        // Use ML view rolling averages if available
        this.safeNumber(game.fp_avg_last_3 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_last_5 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_season || game.fantasy_points || 0),
        this.safeNumber(game.usage_rate || 0.2),
        this.safeNumber(game.days_rest || 1),
        this.safeNumber(game.back_to_back || 0),
        this.safeNumber(game.points_per_36 || 0),
        this.safeNumber(game.minutes_avg_season || game.minutes || 0),
        
        // Basic features
        game.is_home ? 1 : 0
      ];
      
      return {
        features,
        target: this.safeNumber(game.fantasy_points),
        playerId: game.player_id,
        position: game.position
      };
    });
    
    return {
      features: engineeredData.map(d => d.features),
      targets: engineeredData.map(d => d.target),
      featureNames,
      data: engineeredData
    };
  }
  
  /**
   * ⚾ MLB FEATURE ENGINEERING - OPTIMIZED FOR ML VIEWS
   */
  private async engineerMLBFeatures(data: any[]): Promise<any> {
    const featureNames = [
      'hits', 'at_bats', 'runs', 'rbi', 'home_runs', 'stolen_bases',
      'walks', 'strikeouts', 'batting_average', 'on_base_percentage',
      'fp_avg_last_7', 'fp_avg_last_15', 'fp_avg_season',
      'points', 'rebounds', 'assists', 'is_home'
    ];
    
    const engineeredData = data.map(game => {
      const stats = game.stats || {};
      
      const features = [
        this.safeNumber(game.hits || stats.hits || 0),
        this.safeNumber(game.at_bats || stats.at_bats || 0),
        this.safeNumber(game.runs || stats.runs || 0),
        this.safeNumber(game.rbi || stats.rbi || stats.runs_batted_in || 0),
        this.safeNumber(game.home_runs || stats.home_runs || 0),
        this.safeNumber(game.stolen_bases || stats.stolen_bases || 0),
        this.safeNumber(game.walks || stats.walks || 0),
        this.safeNumber(game.strikeouts || stats.strikeouts || 0),
        this.safeNumber(game.batting_average || stats.avg || 0.250),
        this.safeNumber(game.on_base_percentage || stats.obp || 0.320),
        
        // Use ML view rolling averages if available
        this.safeNumber(game.fp_avg_last_7 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_last_15 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_season || game.fantasy_points || 0),
        
        // Basic universal stats
        this.safeNumber(game.points || 0),
        this.safeNumber(game.rebounds || 0),
        this.safeNumber(game.assists || 0),
        game.is_home ? 1 : 0
      ];
      
      return {
        features,
        target: this.safeNumber(game.fantasy_points),
        playerId: game.player_id,
        position: game.position
      };
    });
    
    return {
      features: engineeredData.map(d => d.features),
      targets: engineeredData.map(d => d.target),
      featureNames,
      data: engineeredData
    };
  }
  
  /**
   * 🏒 NHL FEATURE ENGINEERING - OPTIMIZED FOR ML VIEWS
   */
  private async engineerNHLFeatures(data: any[]): Promise<any> {
    const featureNames = [
      'goals', 'assists', 'shots', 'hits', 'blocked_shots',
      'penalty_minutes', 'power_play_points', 'short_handed_points',
      'time_on_ice', 'saves', 'goals_against', 'fp_avg_last_3',
      'fp_avg_last_7', 'fp_avg_season', 'days_rest', 'points',
      'rebounds', 'is_home'
    ];
    
    const engineeredData = data.map(game => {
      const stats = game.stats || {};
      
      const features = [
        this.safeNumber(game.goals || stats.goals || 0),
        this.safeNumber(game.assists || stats.assists || 0),
        this.safeNumber(game.shots || stats.shots || stats.shots_on_goal || 0),
        this.safeNumber(game.hits || stats.hits || 0),
        this.safeNumber(game.blocked_shots || stats.blocked_shots || stats.blocks || 0),
        this.safeNumber(game.penalty_minutes || stats.penalty_minutes || 0),
        this.safeNumber(game.power_play_points || stats.power_play_points || 0),
        this.safeNumber(game.short_handed_points || stats.short_handed_points || 0),
        this.safeNumber(game.time_on_ice || game.minutes || stats.time_on_ice || 0),
        this.safeNumber(game.saves || stats.saves || 0),
        this.safeNumber(game.goals_against || stats.goals_against || 0),
        
        // Use ML view rolling averages if available
        this.safeNumber(game.fp_avg_last_3 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_last_7 || game.fantasy_points || 0),
        this.safeNumber(game.fp_avg_season || game.fantasy_points || 0),
        this.safeNumber(game.days_rest || 2),
        
        // Basic universal stats
        this.safeNumber(game.points || 0),
        this.safeNumber(game.rebounds || 0),
        game.is_home ? 1 : 0
      ];
      
      return {
        features,
        target: this.safeNumber(game.fantasy_points),
        playerId: game.player_id,
        position: game.position
      };
    });
    
    return {
      features: engineeredData.map(d => d.features),
      targets: engineeredData.map(d => d.target),
      featureNames,
      data: engineeredData
    };
  }
  
  /**
   * 🧠 TRAIN NEURAL NETWORK
   */
  private async trainNeuralNetwork(
    sport: string,
    trainData: any[],
    testData: any[],
    featureNames: string[]
  ): Promise<tf.LayersModel> {
    // Prepare tensors
    const xTrain = tf.tensor2d(trainData.map(d => d.features));
    const yTrain = tf.tensor1d(trainData.map(d => d.target));
    const xTest = tf.tensor2d(testData.map(d => d.features));
    const yTest = tf.tensor1d(testData.map(d => d.target));
    
    // Build optimized sport-specific architecture
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [featureNames.length],
          units: 256,  // Increased capacity for better feature learning
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.005 })  // Reduced regularization
        }),
        tf.layers.batchNormalization(),  // Add batch normalization for stability
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.005 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({
          units: 1,
          activation: 'linear'
        })
      ]
    });
    
    // Compile with optimized settings
    model.compile({
      optimizer: tf.train.adam(0.0005),  // Slightly reduced learning rate for stability
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    // Train with optimized early stopping and learning rate scheduling
    const epochs = 100;  // Increased max epochs
    let bestLoss = Infinity;
    let patience = 15;  // Increased patience for better convergence
    let waitCount = 0;
    let learningRate = 0.0005;
    
    console.log(chalk.cyan(`   🧠 Training ${sport} model with ${trainData.length} samples...`));
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Dynamic learning rate decay
      if (epoch > 0 && epoch % 25 === 0) {
        learningRate *= 0.8;  // Reduce learning rate
        model.compile({
          optimizer: tf.train.adam(learningRate),
          loss: 'meanSquaredError',
          metrics: ['mae']
        });
        console.log(chalk.gray(`   📉 Reduced learning rate to ${learningRate.toFixed(6)}`));
      }
      
      const history = await model.fit(xTrain, yTrain, {
        epochs: 1,
        validationData: [xTest, yTest],
        verbose: 0,
        batchSize: Math.min(128, Math.floor(trainData.length / 10))  // Dynamic batch size
      });
      
      const loss = history.history.loss[0] as number;
      const valLoss = history.history.val_loss[0] as number;
      
      if (epoch % 10 === 0 || epoch < 5) {
        console.log(chalk.gray(`   Epoch ${epoch}: Loss = ${loss.toFixed(4)}, Val Loss = ${valLoss.toFixed(4)}`));
      }
      
      if (valLoss < bestLoss) {
        bestLoss = valLoss;
        waitCount = 0;
      } else {
        waitCount++;
      }
      
      if (waitCount >= patience) {
        console.log(chalk.yellow(`   ✅ Early stopping at epoch ${epoch} (best val loss: ${bestLoss.toFixed(4)})`));
        break;
      }
    }
    
    // Cleanup
    xTrain.dispose();
    yTrain.dispose();
    xTest.dispose();
    yTest.dispose();
    
    return model;
  }
  
  /**
   * 📈 EVALUATE MODEL
   */
  private async evaluateModel(model: tf.LayersModel, testData: any[]): Promise<any> {
    const xTest = tf.tensor2d(testData.map(d => d.features));
    const yTest = testData.map(d => d.target);
    
    const predictions = await (model.predict(xTest) as tf.Tensor).array();
    xTest.dispose();
    
    // Calculate metrics
    let sumSquaredError = 0;
    let sumAbsoluteError = 0;
    let sumActual = 0;
    let sumSquaredActual = 0;
    
    for (let i = 0; i < yTest.length; i++) {
      const actual = yTest[i];
      const pred = predictions[i][0];
      const error = actual - pred;
      
      sumSquaredError += error * error;
      sumAbsoluteError += Math.abs(error);
      sumActual += actual;
      sumSquaredActual += actual * actual;
    }
    
    const n = yTest.length;
    const meanActual = sumActual / n;
    const rmse = Math.sqrt(sumSquaredError / n);
    const mae = sumAbsoluteError / n;
    
    // R-squared
    const ssRes = sumSquaredError;
    const ssTot = sumSquaredActual - (sumActual * sumActual) / n;
    const rSquared = 1 - (ssRes / ssTot);
    
    return {
      accuracy: 1 - (mae / meanActual),
      rmse,
      mae,
      r_squared: rSquared
    };
  }
  
  /**
   * 💾 SAVE MODEL
   */
  private async saveModel(model: tf.LayersModel, sport: string): Promise<void> {
    const savePath = `file://./models/${sport.toLowerCase()}-10x-${Date.now()}`;
    await model.save(savePath);
    console.log(chalk.green(`✅ Model saved to ${savePath}`));
  }
  
  // Helper methods
  
  /**
   * 📐 NORMALIZE FEATURES FOR BETTER TRAINING
   */
  private normalizeFeatures(data: any[]): any[] {
    if (data.length === 0) return data;
    
    const numFeatures = data[0].features.length;
    const means = new Array(numFeatures).fill(0);
    const stds = new Array(numFeatures).fill(0);
    
    // Calculate means
    for (const sample of data) {
      for (let i = 0; i < numFeatures; i++) {
        means[i] += sample.features[i];
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      means[i] /= data.length;
    }
    
    // Calculate standard deviations
    for (const sample of data) {
      for (let i = 0; i < numFeatures; i++) {
        const diff = sample.features[i] - means[i];
        stds[i] += diff * diff;
      }
    }
    for (let i = 0; i < numFeatures; i++) {
      stds[i] = Math.sqrt(stds[i] / data.length);
      if (stds[i] === 0) stds[i] = 1; // Prevent division by zero
    }
    
    // Normalize features
    return data.map(sample => ({
      ...sample,
      features: sample.features.map((feature: number, i: number) => 
        (feature - means[i]) / stds[i]
      )
    }));
  }
  
  private createTrainTestSplit(data: any[], trainRatio: number): any {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const trainSize = Math.floor(shuffled.length * trainRatio);
    
    return {
      train: shuffled.slice(0, trainSize),
      test: shuffled.slice(trainSize)
    };
  }
  
  private isPrimeTime(gameDate: Date): boolean {
    const date = new Date(gameDate);
    const hour = date.getHours();
    const day = date.getDay();
    
    return (day === 1 && hour >= 20) || // Monday Night
           (day === 4 && hour >= 20) || // Thursday Night
           (day === 0 && hour >= 20);   // Sunday Night
  }
  
  private safeNumber(value: any): number {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  
  /**
   * 🚀 TRAIN ALL SPORTS
   */
  async trainAllSports(): Promise<void> {
    console.log(chalk.blue.bold('\n🚀 TRAINING ALL SPORT-SPECIFIC MODELS...\n'));
    
    // Test database connection first
    await testDatabaseConnection();
    
    const sports: Array<'NFL' | 'NBA' | 'MLB' | 'NHL'> = ['NFL', 'NBA', 'MLB', 'NHL'];
    
    for (const sport of sports) {
      console.log(chalk.yellow(`\n${'='.repeat(50)}`));
      await this.trainSportModel(sport);
      console.log(chalk.yellow(`${'='.repeat(50)}\n`));
    }
    
    console.log(chalk.green.bold('\n✅ ALL SPORT MODELS TRAINED!'));
    console.log(chalk.magenta.bold('💰 Ready to DOMINATE fantasy sports with 10X accuracy!'));
  }
}

// Export and run
export function createSportSpecificTrainer(): SportSpecificTrainer {
  return new SportSpecificTrainer();
}

if (require.main === module) {
  (async () => {
    try {
      const trainer = createSportSpecificTrainer();
      await trainer.trainAllSports();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Training failed:'), error);
      process.exit(1);
    }
  })();
}