#!/usr/bin/env tsx
/**
 * 🚀 TRAIN PRODUCTION ML MODELS 🚀
 * 
 * Trains neural networks on REAL game data with proper features
 * No more fake predictions!
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface GameWithStats {
  game: any;
  features: number[];
  label: number;
}

console.log(chalk.red.bold('\n🚀 PRODUCTION MODEL TRAINING'));
console.log(chalk.red('============================\n'));

async function collectTrainingData(): Promise<GameWithStats[]> {
  console.log(chalk.cyan('📊 Collecting training data...'));
  
  // Get completed games with scores
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5000);
  
  if (error || !games) {
    console.error(chalk.red('Failed to fetch games'), error);
    return [];
  }
  
  console.log(chalk.green(`✅ Found ${games.length} completed games`));
  
  const trainingData: GameWithStats[] = [];
  const teamStatsCache = new Map();
  
  // Process each game
  for (const game of games) {
    try {
      // Get historical stats for teams BEFORE this game
      const homeStats = await getTeamStatsBeforeGame(game.home_team_id, game.start_time, teamStatsCache);
      const awayStats = await getTeamStatsBeforeGame(game.away_team_id, game.start_time, teamStatsCache);
      
      // Extract features (what the model would see before the game)
      const features = [
        homeStats.winRate,
        awayStats.winRate,
        homeStats.winRate - awayStats.winRate,
        homeStats.avgPointsFor / 100,
        awayStats.avgPointsFor / 100,
        homeStats.avgPointsAgainst / 100,
        awayStats.avgPointsAgainst / 100,
        homeStats.last5Form / 5,
        awayStats.last5Form / 5,
        homeStats.homeWinRate,
        awayStats.awayWinRate
      ];
      
      // Label: did home team win?
      const label = game.home_score > game.away_score ? 1 : 0;
      
      trainingData.push({ game, features, label });
      
    } catch (error) {
      // Skip games with errors
    }
  }
  
  console.log(chalk.green(`✅ Processed ${trainingData.length} games for training`));
  
  // Show label distribution
  const homeWins = trainingData.filter(d => d.label === 1).length;
  const awayWins = trainingData.length - homeWins;
  console.log(chalk.yellow(`📊 Home wins: ${homeWins} (${(homeWins/trainingData.length*100).toFixed(1)}%)`));
  console.log(chalk.yellow(`📊 Away wins: ${awayWins} (${(awayWins/trainingData.length*100).toFixed(1)}%)`));
  
  return trainingData;
}

async function getTeamStatsBeforeGame(teamId: number, gameDate: string, cache: Map<string, any>) {
  const cacheKey = `${teamId}-${gameDate}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // Get games BEFORE this date
  const { data: previousGames } = await supabase
    .from('games')
    .select('*')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .lt('start_time', gameDate)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(20);
  
  if (!previousGames || previousGames.length === 0) {
    // Return neutral stats if no history
    const defaultStats = {
      winRate: 0.5,
      avgPointsFor: 100,
      avgPointsAgainst: 100,
      last5Form: 2.5,
      homeWinRate: 0.5,
      awayWinRate: 0.5
    };
    cache.set(cacheKey, defaultStats);
    return defaultStats;
  }
  
  // Calculate stats from previous games
  let wins = 0, losses = 0;
  let totalPointsFor = 0, totalPointsAgainst = 0;
  let homeWins = 0, homeGames = 0;
  let awayWins = 0, awayGames = 0;
  let last5Wins = 0;
  
  previousGames.forEach((game, index) => {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    
    totalPointsFor += teamScore;
    totalPointsAgainst += oppScore;
    
    if (teamScore > oppScore) {
      wins++;
      if (index < 5) last5Wins++;
      if (isHome) {
        homeWins++;
      } else {
        awayWins++;
      }
    } else {
      losses++;
    }
    
    if (isHome) homeGames++;
    else awayGames++;
  });
  
  const stats = {
    winRate: wins / (wins + losses || 1),
    avgPointsFor: totalPointsFor / previousGames.length,
    avgPointsAgainst: totalPointsAgainst / previousGames.length,
    last5Form: Math.min(previousGames.length, 5) > 0 ? last5Wins : 2.5,
    homeWinRate: homeGames > 0 ? homeWins / homeGames : 0.5,
    awayWinRate: awayGames > 0 ? awayWins / awayGames : 0.5
  };
  
  cache.set(cacheKey, stats);
  return stats;
}

async function trainModel(trainingData: GameWithStats[]) {
  console.log(chalk.cyan('\n🧠 Training neural network...'));
  
  // Shuffle data
  const shuffled = [...trainingData].sort(() => Math.random() - 0.5);
  
  // Split into train/test
  const splitIndex = Math.floor(shuffled.length * 0.8);
  const trainData = shuffled.slice(0, splitIndex);
  const testData = shuffled.slice(splitIndex);
  
  console.log(chalk.yellow(`📊 Training set: ${trainData.length} games`));
  console.log(chalk.yellow(`📊 Test set: ${testData.length} games`));
  
  // Prepare tensors
  const trainFeatures = trainData.map(d => d.features);
  const trainLabels = trainData.map(d => d.label);
  const testFeatures = testData.map(d => d.features);
  const testLabels = testData.map(d => d.label);
  
  const xTrain = tf.tensor2d(trainFeatures);
  const yTrain = tf.tensor1d(trainLabels);
  const xTest = tf.tensor2d(testFeatures);
  const yTest = tf.tensor1d(testLabels);
  
  // Build model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [11],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      })
    ]
  });
  
  // Compile with appropriate optimizer
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  console.log(chalk.cyan('\n📊 Model architecture:'));
  model.summary();
  
  // Train the model
  console.log(chalk.cyan('\n⚡ Training with GPU acceleration...'));
  
  const history = await model.fit(xTrain, yTrain, {
    epochs: 100,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 10 === 0 || epoch === 99) {
          console.log(chalk.gray(`Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, acc=${logs?.acc?.toFixed(4)}, val_acc=${logs?.val_acc?.toFixed(4)}`));
        }
      }
    }
  });
  
  // Evaluate on test set
  console.log(chalk.cyan('\n📊 Evaluating on test set...'));
  const evaluation = model.evaluate(xTest, yTest) as tf.Tensor[];
  const testLoss = await evaluation[0].data();
  const testAccuracy = await evaluation[1].data();
  
  console.log(chalk.green(`\n✅ Test accuracy: ${(testAccuracy[0] * 100).toFixed(2)}%`));
  
  // Make some sample predictions
  console.log(chalk.cyan('\n🔮 Sample predictions:'));
  for (let i = 0; i < 5 && i < testData.length; i++) {
    const sample = testData[i];
    const prediction = model.predict(tf.tensor2d([sample.features])) as tf.Tensor;
    const prob = (await prediction.data())[0];
    const actual = sample.label;
    
    const homeTeam = sample.game.home_team_id;
    const awayTeam = sample.game.away_team_id;
    const correct = (prob > 0.5 ? 1 : 0) === actual;
    
    console.log(chalk[correct ? 'green' : 'red'](
      `Game ${i+1}: Team ${homeTeam} vs Team ${awayTeam} - ` +
      `Predicted: ${(prob * 100).toFixed(1)}% home win, ` +
      `Actual: ${actual ? 'HOME' : 'AWAY'} ${correct ? '✅' : '❌'}`
    ));
    
    prediction.dispose();
  }
  
  // Save the model
  const modelPath = path.join(process.cwd(), 'models', 'game_predictor_gpu');
  await model.save(`file://${modelPath}`);
  console.log(chalk.green(`\n✅ Model saved to ${modelPath}`));
  
  // Save metadata
  const metadata = {
    trainedAt: new Date().toISOString(),
    trainSamples: trainData.length,
    testSamples: testData.length,
    testAccuracy: testAccuracy[0],
    features: [
      'home_win_rate',
      'away_win_rate',
      'win_rate_differential',
      'home_avg_points_for',
      'away_avg_points_for',
      'home_avg_points_against',
      'away_avg_points_against',
      'home_last_5_form',
      'away_last_5_form',
      'home_home_win_rate',
      'away_away_win_rate'
    ]
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'models', 'game_predictor_metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // Clean up tensors
  xTrain.dispose();
  yTrain.dispose();
  xTest.dispose();
  yTest.dispose();
  evaluation.forEach(t => t.dispose());
  
  return model;
}

// Main execution
async function main() {
  try {
    // Collect training data
    const trainingData = await collectTrainingData();
    
    if (trainingData.length < 100) {
      console.error(chalk.red('❌ Not enough training data!'));
      return;
    }
    
    // Train the model
    await trainModel(trainingData);
    
    console.log(chalk.green.bold('\n✅ PRODUCTION MODEL TRAINING COMPLETE!'));
    console.log(chalk.green('The model is now ready for real predictions!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Training failed:'), error);
  }
}

// Run the training
main();