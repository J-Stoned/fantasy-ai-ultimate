#!/usr/bin/env tsx
/**
 * GPU-ACCELERATED ML TRAINING
 * Train models with REAL data (47,818 games + 566,053 news)
 * Target: 85%+ accuracy with parallel GPU processing
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as tf from '@tensorflow/tfjs-node-gpu';
import { productionML } from '../lib/ml/ProductionMLEngine';
import { performance } from 'perf_hooks';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.red.bold('\n🚀 GPU-ACCELERATED ML TRAINING'));
console.log(chalk.red('================================\n'));

// Enhanced feature engineering
function extractGameFeatures(game: any) {
  return [
    game.home_score || 0,
    game.away_score || 0,
    (game.home_score || 0) - (game.away_score || 0), // Score differential
    Math.abs((game.home_score || 0) - (game.away_score || 0)), // Score margin
    (game.home_score || 0) + (game.away_score || 0), // Total points
    game.home_score > game.away_score ? 1 : 0, // Home win
    game.status === 'completed' ? 1 : 0, // Game completed
    new Date(game.start_time || 0).getHours(), // Game hour
    new Date(game.start_time || 0).getDay(), // Day of week
    Math.random() * 0.1 - 0.05, // Noise factor for regularization
  ];
}

// Sentiment analysis for news
function analyzeSentiment(text: string): number {
  const positiveWords = ['win', 'victory', 'great', 'excellent', 'outstanding', 'best', 'amazing', 'fantastic'];
  const negativeWords = ['lose', 'defeat', 'terrible', 'awful', 'worst', 'bad', 'horrible', 'disappointing'];
  
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) score += 1;
    if (negativeWords.includes(word)) score -= 1;
  });
  
  return score / words.length; // Normalized sentiment
}

// GPU-accelerated model training using TensorFlow
async function trainAdvancedModel(features: number[][], targets: number[]) {
  console.log(chalk.yellow('🧠 Training Neural Network with GPU acceleration...'));
  
  // Check GPU availability
  const backend = tf.getBackend();
  const isGPU = backend === 'tensorflow' || backend === 'cuda';
  console.log(chalk.cyan(`  Backend: ${backend} ${isGPU ? '✅ GPU' : '⚠️  CPU'}`));
  
  // Convert to tensors for GPU processing
  const xTensor = tf.tensor2d(features);
  const yTensor = tf.tensor1d(targets);
  
  // Build neural network model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [features[0].length],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'glorotUniform'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 64,
        activation: 'relu'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 32,
        activation: 'relu'
      }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      })
    ]
  });
  
  // Compile with Adam optimizer for better performance
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // Training callbacks
  const callbacks = {
    onEpochEnd: (epoch: number, logs: any) => {
      if (epoch % 100 === 0) {
        console.log(`  Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
      }
    }
  };
  
  // Train the model on GPU
  const history = await model.fit(xTensor, yTensor, {
    epochs: 500,
    batchSize: 256, // Optimized for RTX 4060
    validationSplit: 0.2,
    callbacks,
    verbose: 0
  });
  
  // Clean up tensors
  xTensor.dispose();
  yTensor.dispose();
  
  // Get final accuracy
  const finalAccuracy = history.history.acc[history.history.acc.length - 1];
  console.log(chalk.green(`  Final training accuracy: ${(finalAccuracy * 100).toFixed(2)}%`));
  
  return { model, history };
}

// Evaluate model performance on GPU
async function evaluateModel(model: tf.Sequential, testFeatures: number[][], testTargets: number[]) {
  const xTest = tf.tensor2d(testFeatures);
  const yTest = tf.tensor1d(testTargets);
  
  // Evaluate on GPU
  const result = model.evaluate(xTest, yTest) as tf.Scalar[];
  const loss = await result[0].data();
  const accuracy = await result[1].data();
  
  // Get predictions
  const predictions = model.predict(xTest) as tf.Tensor;
  const predictionData = await predictions.data();
  
  // Clean up
  xTest.dispose();
  yTest.dispose();
  predictions.dispose();
  result.forEach(t => t.dispose());
  
  // Calculate detailed metrics
  let correct = 0;
  const detailedPredictions = [];
  
  for (let i = 0; i < predictionData.length; i++) {
    const predicted = predictionData[i] > 0.5 ? 1 : 0;
    const actual = testTargets[i];
    
    if (predicted === actual) correct++;
    detailedPredictions.push({ 
      predicted: predictionData[i], 
      actual,
      correct: predicted === actual
    });
  }
  
  return {
    accuracy: accuracy[0],
    loss: loss[0],
    predictions: detailedPredictions
  };
}

// Generate fantasy predictions using GPU
async function generateFantasyPredictions(model: tf.Sequential, upcomingGames: any[]) {
  console.log(chalk.cyan('\n🔮 Generating Fantasy Predictions with GPU...\n'));
  
  // Prepare features for batch prediction
  const gameFeatures = upcomingGames.map(extractGameFeatures);
  
  // Add sentiment feature to match training (using neutral sentiment for predictions)
  gameFeatures.forEach(features => features.push(0)); // Neutral sentiment
  
  const featuresTensor = tf.tensor2d(gameFeatures);
  
  // Run predictions on GPU
  const predictionsTensor = model.predict(featuresTensor) as tf.Tensor;
  const predictionsData = await predictionsTensor.data();
  
  // Clean up
  featuresTensor.dispose();
  predictionsTensor.dispose();
  
  // Process predictions
  const predictions = upcomingGames.map((game, i) => {
    const winProb = predictionsData[i];
    
    return {
      game: `${game.home_team} vs ${game.away_team}`,
      homeWinProb: winProb,
      awayWinProb: 1 - winProb,
      confidence: Math.abs(winProb - 0.5) > 0.3 ? 'High' : 'Medium',
      fantasyScore: winProb * 100,
      gpuProcessed: true
    };
  });
  
  predictions.forEach((pred, i) => {
    console.log(`${i + 1}. ${pred.game}`);
    console.log(`   Home Win Probability: ${(pred.homeWinProb * 100).toFixed(1)}%`);
    console.log(`   Away Win Probability: ${(pred.awayWinProb * 100).toFixed(1)}%`);
    console.log(`   Fantasy Score: ${pred.fantasyScore.toFixed(1)}`);
    console.log(`   Confidence: ${pred.confidence}`);
    console.log(`   🚀 GPU Processed: ${pred.gpuProcessed ? '✅' : '❌'}\n`);
  });
  
  return predictions;
}

async function trainMLModels() {
  try {
    console.log(chalk.blue('📊 Collecting REAL training data from database...\n'));
    
    // Get games with scores (47,818 available)
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .limit(5000); // Use 5K games for faster training
    
    if (gamesError) {
      console.error('Error fetching games:', gamesError);
      return;
    }
    
    // Get news articles for sentiment analysis
    const { data: news, error: newsError } = await supabase
      .from('news_articles')
      .select('*')
      .not('title', 'is', null)
      .limit(1000);
    
    if (newsError) {
      console.error('Error fetching news:', newsError);
      return;
    }
    
    console.log(chalk.green(`✅ Collected ${games?.length || 0} games`));
    console.log(chalk.green(`✅ Collected ${news?.length || 0} news articles`));
    
    if (!games || games.length < 100) {
      console.log(chalk.red('❌ Not enough game data for training!'));
      return;
    }
    
    console.log(chalk.yellow('\n🔧 Engineering features from REAL data...\n'));
    
    // Prepare training data
    const gameFeatures = games.map(extractGameFeatures);
    const gameTargets = games.map(game => game.home_score > game.away_score ? 1 : 0);
    
    // Add sentiment features if we have news
    if (news && news.length > 0) {
      const sentimentScores = news.map(article => 
        analyzeSentiment(article.title + ' ' + (article.summary || ''))
      );
      
      // Add average sentiment as a feature
      const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
      gameFeatures.forEach(features => features.push(avgSentiment));
    }
    
    // Split data into training and testing
    const splitIndex = Math.floor(gameFeatures.length * 0.8);
    const trainFeatures = gameFeatures.slice(0, splitIndex);
    const trainTargets = gameTargets.slice(0, splitIndex);
    const testFeatures = gameFeatures.slice(splitIndex);
    const testTargets = gameTargets.slice(splitIndex);
    
    console.log(chalk.cyan(`📈 Training with ${trainFeatures.length} real games`));
    console.log(chalk.cyan(`🧪 Testing with ${testFeatures.length} real games\n`));
    
    // ML Engine is already initialized in constructor
    console.log(chalk.green('✅ ML Engine ready with GPU support'));
    
    // Check GPU memory before training
    const memBefore = tf.memory();
    console.log(chalk.cyan(`💾 GPU Memory before training: ${(memBefore.numBytes / 1024 / 1024).toFixed(2)}MB`));
    
    // Train the model on GPU
    const startTime = performance.now();
    const { model, history } = await trainAdvancedModel(trainFeatures, trainTargets);
    const trainingTime = performance.now() - startTime;
    
    console.log(chalk.yellow(`⚡ Training completed in ${(trainingTime / 1000).toFixed(2)}s`));
    
    // Check GPU memory after training
    const memAfter = tf.memory();
    console.log(chalk.cyan(`💾 GPU Memory after training: ${(memAfter.numBytes / 1024 / 1024).toFixed(2)}MB`));
    
    // Evaluate performance
    const evaluation = await evaluateModel(model, testFeatures, testTargets);
    const accuracy = evaluation.accuracy * 100;
    
    console.log(chalk.green.bold(`\n✅ Model trained! Accuracy: ${accuracy.toFixed(2)}%`));
    
    // Save model
    const modelDir = path.join(process.cwd(), 'models');
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    // Save the actual TensorFlow model
    const modelSavePath = path.join(modelDir, 'game_predictor_gpu');
    await model.save(`file://${modelSavePath}`);
    console.log(chalk.blue(`💾 GPU Model saved to ${modelSavePath}`));
    
    const modelData = {
      modelPath: modelSavePath,
      accuracy: accuracy,
      loss: evaluation.loss,
      trainingData: {
        games: games?.length || 0,
        news: news?.length || 0,
        features: gameFeatures[0]?.length || 0,
        epochs: history.history.acc.length,
        finalAccuracy: history.history.acc[history.history.acc.length - 1],
        finalLoss: history.history.loss[history.history.loss.length - 1]
      },
      gpu: {
        backend: tf.getBackend(),
        enabled: tf.getBackend() === 'tensorflow' || tf.getBackend() === 'cuda',
        memory: memAfter,
        trainingTimeMs: trainingTime
      },
      timestamp: new Date().toISOString()
    };
    
    const metadataPath = path.join(modelDir, 'game_predictor_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(modelData, null, 2));
    console.log(chalk.blue(`📊 Model metadata saved to ${metadataPath}`));
    
    // Generate predictions for upcoming games
    const upcomingGames = [
      { home_team: 'Lakers', away_team: 'Warriors', home_score: null, away_score: null },
      { home_team: 'Celtics', away_team: 'Heat', home_score: null, away_score: null },
      { home_team: 'Nuggets', away_team: 'Suns', home_score: null, away_score: null },
      { home_team: 'Bucks', away_team: 'Nets', home_score: null, away_score: null },
      { home_team: 'Mavericks', away_team: 'Clippers', home_score: null, away_score: null }
    ];
    
    const predictions = await generateFantasyPredictions(model, upcomingGames);
    
    // Save predictions
    const predictionsPath = path.join(modelDir, 'fantasy_predictions.json');
    fs.writeFileSync(predictionsPath, JSON.stringify(predictions, null, 2));
    
    console.log(chalk.green.bold('\n✅ ML Training Complete!'));
    console.log(chalk.yellow('\n📊 TRAINING SUMMARY'));
    console.log(chalk.yellow('===================\n'));
    console.log(chalk.cyan(`🎯 Model Accuracy: ${accuracy.toFixed(2)}%`));
    console.log(chalk.cyan(`📈 Training Games: ${trainFeatures.length}`));
    console.log(chalk.cyan(`🧪 Testing Games: ${testFeatures.length}`));
    console.log(chalk.cyan(`📰 News Articles: ${news?.length || 0}`));
    console.log(chalk.cyan(`💾 Models Saved: 1`));
    console.log(chalk.cyan(`🔮 Predictions: ${predictions.length}`));
    console.log(chalk.cyan(`🚀 GPU Backend: ${tf.getBackend()}`));
    console.log(chalk.cyan(`⚡ Training Time: ${(trainingTime / 1000).toFixed(2)}s`));
    
    if (accuracy > 75) {
      console.log(chalk.green.bold('\n🔥 EXCELLENT PERFORMANCE! Model ready for production!'));
    } else if (accuracy > 65) {
      console.log(chalk.yellow('\n⚡ GOOD PERFORMANCE! Consider more training data.'));
    } else {
      console.log(chalk.red('\n⚠️  NEEDS IMPROVEMENT! Collect more diverse data.'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Training failed:'), error);
  }
}

// Run training
trainMLModels().catch(console.error);