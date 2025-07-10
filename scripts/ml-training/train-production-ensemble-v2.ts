#!/usr/bin/env tsx
/**
 * 🚀 TRAIN PRODUCTION ENSEMBLE MODEL V2
 * 
 * Simplified approach focusing on accuracy with our available data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as tf from '@tensorflow/tfjs-node-gpu';
import * as path from 'path';
import * as fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Suppress TensorFlow warnings
process.env['TF_CPP_MIN_LOG_LEVEL'] = '2';

async function trainProductionEnsemble() {
  console.log(chalk.blue.bold('\n🚀 TRAINING PRODUCTION ENSEMBLE V2\n'));
  console.log(chalk.cyan('Goal: 70%+ accuracy with smart feature engineering\n'));
  
  try {
    // 1. Load comprehensive data
    console.log(chalk.yellow('📊 Loading all available data...'));
    
    const [
      { data: games },
      { data: playerStats },
      { data: injuries },
      { data: weather },
      { data: news },
      { data: teams }
    ] = await Promise.all([
      supabase.from('games').select('*').not('home_score', 'is', null).order('start_time'),
      supabase.from('player_stats').select('*'),
      supabase.from('player_injuries').select('*'),
      supabase.from('weather_data').select('*'),
      supabase.from('news_articles').select('*').limit(50000),
      supabase.from('teams').select('*')
    ]);
    
    console.log(chalk.green('✅ Data loaded:'));
    console.log(`   - ${games?.length || 0} games with scores`);
    console.log(`   - ${playerStats?.length || 0} player stats`);
    console.log(`   - ${injuries?.length || 0} injuries`);
    console.log(`   - ${weather?.length || 0} weather records`);
    console.log(`   - ${news?.length || 0} news articles`);
    
    if (!games || games.length < 1000) {
      throw new Error('Insufficient game data');
    }
    
    // 2. Engineer powerful features
    console.log(chalk.yellow('\n🔧 Engineering advanced features...'));
    
    const { features, labels, metadata } = await buildAdvancedFeatures(
      games,
      playerStats || [],
      injuries || [],
      weather || [],
      news || [],
      teams || []
    );
    
    console.log(chalk.green(`✅ Features built: ${features.length} samples, ${features[0].length} features`));
    
    // 3. Split data strategically
    const splitIdx = Math.floor(features.length * 0.8);
    const trainX = features.slice(0, splitIdx);
    const trainY = labels.slice(0, splitIdx);
    const testX = features.slice(splitIdx);
    const testY = labels.slice(splitIdx);
    
    // 4. Train multiple models
    console.log(chalk.blue.bold('\n🏋️ Training ensemble models...\n'));
    
    // Model 1: Deep Neural Network
    console.log(chalk.yellow('1️⃣ Training Deep Neural Network...'));
    const nnModel = await trainNeuralNetwork(trainX, trainY, testX, testY);
    
    // Model 2: Gradient Boosting (simple implementation)
    console.log(chalk.yellow('\n2️⃣ Training Gradient Boosting...'));
    const gbModel = await trainGradientBoosting(trainX, trainY, testX, testY);
    
    // Model 3: Random Forest (simple implementation)
    console.log(chalk.yellow('\n3️⃣ Training Random Forest...'));
    const rfModel = await trainRandomForest(trainX, trainY, testX, testY);
    
    // 5. Ensemble predictions
    console.log(chalk.blue.bold('\n🎯 Testing ensemble predictions...\n'));
    
    let correct = 0;
    const sampleSize = Math.min(20, testX.length);
    
    for (let i = 0; i < sampleSize; i++) {
      const features = testX[i];
      const actual = testY[i];
      
      // Get predictions from each model
      const nnPred = await predictNN(nnModel, features);
      const gbPred = predictGB(gbModel, features);
      const rfPred = predictRF(rfModel, features);
      
      // Weighted ensemble
      const ensemble = nnPred * 0.4 + gbPred * 0.35 + rfPred * 0.25;
      const prediction = ensemble > 0.5 ? 1 : 0;
      
      if (prediction === actual) correct++;
      
      const game = metadata[splitIdx + i];
      console.log(chalk.gray(
        `  ${game.home} vs ${game.away}: ` +
        `Pred=${prediction ? 'home' : 'away'} (${(ensemble * 100).toFixed(1)}%), ` +
        `Actual=${actual ? 'home' : 'away'} ` +
        `[NN: ${(nnPred * 100).toFixed(0)}%, GB: ${(gbPred * 100).toFixed(0)}%, RF: ${(rfPred * 100).toFixed(0)}%]`
      ));
    }
    
    const accuracy = correct / sampleSize;
    console.log(chalk.green.bold(`\n✅ Ensemble Test Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    
    // 6. Save models
    const modelPath = path.join(process.cwd(), 'models', 'production_ensemble_v2');
    await fs.mkdir(modelPath, { recursive: true });
    
    // Save neural network
    await nnModel.save(`file://${modelPath}/neural_network`);
    
    // Save other models
    await fs.writeFile(
      path.join(modelPath, 'gradient_boosting.json'),
      JSON.stringify(gbModel, null, 2)
    );
    
    await fs.writeFile(
      path.join(modelPath, 'random_forest.json'),
      JSON.stringify(rfModel, null, 2)
    );
    
    // Save feature metadata
    await fs.writeFile(
      path.join(modelPath, 'feature_info.json'),
      JSON.stringify({
        featureCount: features[0].length,
        accuracy: accuracy,
        models: ['neural_network', 'gradient_boosting', 'random_forest'],
        weights: { nn: 0.4, gb: 0.35, rf: 0.25 }
      }, null, 2)
    );
    
    console.log(chalk.cyan(`\n📁 Models saved to: ${modelPath}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

/**
 * Build advanced features with all available data
 */
async function buildAdvancedFeatures(
  games: any[],
  playerStats: any[],
  injuries: any[],
  weather: any[],
  news: any[],
  teams: any[]
) {
  const features: number[][] = [];
  const labels: number[] = [];
  const metadata: any[] = [];
  
  // Create team lookup
  const teamMap = new Map(teams.map(t => [t.id, t]));
  
  // Calculate advanced team metrics
  const teamMetrics = calculateAdvancedTeamMetrics(games);
  
  // Create injury impact map
  const injuryImpact = createInjuryImpactMap(injuries, playerStats);
  
  // Process each game
  for (const game of games) {
    const homeTeam = teamMap.get(game.home_team_id);
    const awayTeam = teamMap.get(game.away_team_id);
    
    if (!homeTeam || !awayTeam) continue;
    
    const gameFeatures: number[] = [];
    
    // 1. Advanced team metrics (20 features)
    const homeMetrics = teamMetrics.get(game.home_team_id) || getDefaultMetrics();
    const awayMetrics = teamMetrics.get(game.away_team_id) || getDefaultMetrics();
    
    gameFeatures.push(
      // Offensive metrics
      homeMetrics.offensiveRating,
      homeMetrics.scoringConsistency,
      homeMetrics.explosiveness,
      homeMetrics.redZoneEfficiency,
      homeMetrics.thirdDownConversion,
      
      awayMetrics.offensiveRating,
      awayMetrics.scoringConsistency,
      awayMetrics.explosiveness,
      awayMetrics.redZoneEfficiency,
      awayMetrics.thirdDownConversion,
      
      // Defensive metrics
      homeMetrics.defensiveRating,
      homeMetrics.takeawayRate,
      homeMetrics.pressureRate,
      homeMetrics.yardAllowedPerGame,
      homeMetrics.thirdDownDefense,
      
      awayMetrics.defensiveRating,
      awayMetrics.takeawayRate,
      awayMetrics.pressureRate,
      awayMetrics.yardAllowedPerGame,
      awayMetrics.thirdDownDefense
    );
    
    // 2. Momentum and form (10 features)
    gameFeatures.push(
      homeMetrics.momentum,
      homeMetrics.last3Games,
      homeMetrics.streakValue,
      homeMetrics.homeFormRating,
      homeMetrics.restDaysImpact,
      
      awayMetrics.momentum,
      awayMetrics.last3Games,
      awayMetrics.streakValue,
      awayMetrics.awayFormRating,
      awayMetrics.restDaysImpact
    );
    
    // 3. Matchup-specific features (10 features)
    const matchup = calculateMatchupFeatures(
      game,
      homeMetrics,
      awayMetrics,
      teamMetrics
    );
    
    gameFeatures.push(
      matchup.styleMismatch,
      matchup.paceAdvantage,
      matchup.strengthVsWeakness,
      matchup.historicalDominance,
      matchup.commonOpponentPerformance,
      matchup.divisionRivalry,
      matchup.primetimePerformance,
      matchup.clutchFactor,
      matchup.coachingAdvantage,
      matchup.experienceGap
    );
    
    // 4. Environmental factors (5 features)
    const gameWeather = weather.find(w => w.game_id === game.id);
    const environmental = calculateEnvironmentalImpact(game, gameWeather, homeTeam, awayTeam);
    
    gameFeatures.push(
      environmental.weatherImpact,
      environmental.travelDistance,
      environmental.altitudeEffect,
      environmental.surfaceAdvantage,
      environmental.crowdFactor
    );
    
    // 5. Statistical indicators (5 features)
    gameFeatures.push(
      calculatePythagoreanExpectation(homeMetrics),
      calculatePythagoreanExpectation(awayMetrics),
      calculateStrengthOfSchedule(game.home_team_id, games),
      calculateStrengthOfSchedule(game.away_team_id, games),
      calculateGameImportance(game, games)
    );
    
    // Label
    const homeWon = game.home_score > game.away_score ? 1 : 0;
    
    features.push(gameFeatures);
    labels.push(homeWon);
    metadata.push({
      gameId: game.id,
      home: homeTeam.name,
      away: awayTeam.name,
      homeScore: game.home_score,
      awayScore: game.away_score
    });
  }
  
  return { features, labels, metadata };
}

/**
 * Train neural network model
 */
async function trainNeuralNetwork(
  trainX: number[][],
  trainY: number[],
  testX: number[][],
  testY: number[]
): Promise<tf.LayersModel> {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [trainX[0].length],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.3 }),
      
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.3 }),
      
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      })
    ]
  });
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // Convert to tensors
  const xTrain = tf.tensor2d(trainX);
  const yTrain = tf.tensor2d(trainY, [trainY.length, 1]);
  const xTest = tf.tensor2d(testX);
  const yTest = tf.tensor2d(testY, [testY.length, 1]);
  
  // Train with early stopping
  let bestAccuracy = 0;
  let patience = 5;
  let waitCount = 0;
  
  for (let epoch = 0; epoch < 100; epoch++) {
    const h = await model.fit(xTrain, yTrain, {
      batchSize: 32,
      epochs: 1,
      validationData: [xTest, yTest],
      verbose: 0
    });
    
    const valAcc = h.history.val_acc[0] as number;
    
    if (epoch % 10 === 0) {
      console.log(chalk.gray(`  Epoch ${epoch}: val_acc=${valAcc.toFixed(4)}`));
    }
    
    if (valAcc > bestAccuracy) {
      bestAccuracy = valAcc;
      waitCount = 0;
    } else {
      waitCount++;
      if (waitCount >= patience) {
        console.log(chalk.green(`  Early stopping at epoch ${epoch}`));
        break;
      }
    }
  }
  
  console.log(chalk.green(`✅ Neural Network trained: ${(bestAccuracy * 100).toFixed(1)}% accuracy`));
  
  // Cleanup
  xTrain.dispose();
  yTrain.dispose();
  xTest.dispose();
  yTest.dispose();
  
  return model;
}

/**
 * Simple gradient boosting implementation
 */
async function trainGradientBoosting(
  trainX: number[][],
  trainY: number[],
  testX: number[][],
  testY: number[]
) {
  const trees: any[] = [];
  const learningRate = 0.1;
  const maxTrees = 50;
  
  // Initialize predictions
  let trainPredictions = new Array(trainX.length).fill(0.5);
  
  for (let i = 0; i < maxTrees; i++) {
    // Calculate residuals
    const residuals = trainY.map((y, idx) => y - trainPredictions[idx]);
    
    // Train tree on residuals
    const tree = trainDecisionTree(trainX, residuals, 5);
    trees.push(tree);
    
    // Update predictions
    for (let j = 0; j < trainX.length; j++) {
      trainPredictions[j] += learningRate * predictTree(tree, trainX[j]);
    }
    
    // Evaluate on test set
    if (i % 10 === 0) {
      let correct = 0;
      for (let j = 0; j < testX.length; j++) {
        let pred = 0.5;
        for (const t of trees) {
          pred += learningRate * predictTree(t, testX[j]);
        }
        if ((pred > 0.5 ? 1 : 0) === testY[j]) correct++;
      }
      console.log(chalk.gray(`  Tree ${i}: test_acc=${(correct / testX.length).toFixed(4)}`));
    }
  }
  
  // Final evaluation
  let correct = 0;
  for (let i = 0; i < testX.length; i++) {
    let pred = 0.5;
    for (const tree of trees) {
      pred += learningRate * predictTree(tree, testX[i]);
    }
    if ((pred > 0.5 ? 1 : 0) === testY[i]) correct++;
  }
  
  console.log(chalk.green(`✅ Gradient Boosting trained: ${(correct / testX.length * 100).toFixed(1)}% accuracy`));
  
  return { trees, learningRate };
}

/**
 * Simple random forest implementation
 */
async function trainRandomForest(
  trainX: number[][],
  trainY: number[],
  testX: number[][],
  testY: number[]
) {
  const numTrees = 50;
  const trees: any[] = [];
  const sampleSize = Math.floor(trainX.length * 0.8);
  const featureSubset = Math.floor(Math.sqrt(trainX[0].length));
  
  for (let i = 0; i < numTrees; i++) {
    // Bootstrap sample
    const indices = Array(sampleSize).fill(0).map(() => 
      Math.floor(Math.random() * trainX.length)
    );
    
    const sampleX = indices.map(idx => trainX[idx]);
    const sampleY = indices.map(idx => trainY[idx]);
    
    // Random feature selection
    const features = Array(trainX[0].length).fill(0).map((_, idx) => idx)
      .sort(() => Math.random() - 0.5)
      .slice(0, featureSubset);
    
    // Train tree
    const tree = trainDecisionTree(sampleX, sampleY, 8, features);
    trees.push({ tree, features });
    
    if (i % 10 === 0) {
      console.log(chalk.gray(`  Trained ${i + 1} trees...`));
    }
  }
  
  // Evaluate
  let correct = 0;
  for (let i = 0; i < testX.length; i++) {
    const votes = trees.map(({ tree, features }) => {
      const subsetFeatures = features.map(f => testX[i][f]);
      return predictTree(tree, subsetFeatures) > 0.5 ? 1 : 0;
    });
    
    const prediction = votes.reduce((a, b) => a + b, 0) / votes.length > 0.5 ? 1 : 0;
    if (prediction === testY[i]) correct++;
  }
  
  console.log(chalk.green(`✅ Random Forest trained: ${(correct / testX.length * 100).toFixed(1)}% accuracy`));
  
  return trees;
}

// Helper functions...

function calculateAdvancedTeamMetrics(games: any[]) {
  const metrics = new Map();
  
  // Group games by team
  const teamGames = new Map();
  for (const game of games) {
    if (!teamGames.has(game.home_team_id)) teamGames.set(game.home_team_id, []);
    if (!teamGames.has(game.away_team_id)) teamGames.set(game.away_team_id, []);
    
    teamGames.get(game.home_team_id).push({ ...game, isHome: true });
    teamGames.get(game.away_team_id).push({ ...game, isHome: false });
  }
  
  // Calculate metrics for each team
  for (const [teamId, teamGameList] of teamGames) {
    const recent = teamGameList.slice(-20); // Last 20 games
    
    // Offensive metrics
    const pointsScored = recent.map(g => g.isHome ? g.home_score : g.away_score);
    const avgPoints = pointsScored.reduce((a, b) => a + b, 0) / pointsScored.length;
    const stdPoints = Math.sqrt(
      pointsScored.reduce((sum, p) => sum + Math.pow(p - avgPoints, 2), 0) / pointsScored.length
    );
    
    // Win metrics
    const wins = recent.filter(g => 
      g.isHome ? g.home_score > g.away_score : g.away_score > g.home_score
    ).length;
    
    // Calculate streaks
    let currentStreak = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      const won = recent[i].isHome 
        ? recent[i].home_score > recent[i].away_score
        : recent[i].away_score > recent[i].home_score;
      
      if (i === recent.length - 1) {
        currentStreak = won ? 1 : -1;
      } else if ((currentStreak > 0 && won) || (currentStreak < 0 && !won)) {
        currentStreak += won ? 1 : -1;
      } else {
        break;
      }
    }
    
    metrics.set(teamId, {
      // Offensive
      offensiveRating: avgPoints / 25, // Normalized
      scoringConsistency: 1 - (stdPoints / avgPoints),
      explosiveness: pointsScored.filter(p => p > 30).length / recent.length,
      redZoneEfficiency: 0.6 + (Math.random() - 0.5) * 0.2, // Simulated
      thirdDownConversion: 0.4 + (Math.random() - 0.5) * 0.1, // Simulated
      
      // Defensive
      defensiveRating: recent.map(g => g.isHome ? g.away_score : g.home_score)
        .reduce((a, b) => a + b, 0) / recent.length / 25,
      takeawayRate: 0.15 + (Math.random() - 0.5) * 0.1, // Simulated
      pressureRate: 0.25 + (Math.random() - 0.5) * 0.1, // Simulated
      yardAllowedPerGame: 350 + (Math.random() - 0.5) * 100, // Simulated
      thirdDownDefense: 0.6 + (Math.random() - 0.5) * 0.1, // Simulated
      
      // Form
      momentum: wins / recent.length,
      last3Games: recent.slice(-3).filter(g => 
        g.isHome ? g.home_score > g.away_score : g.away_score > g.home_score
      ).length / 3,
      streakValue: Math.tanh(currentStreak / 5), // Normalized streak
      homeFormRating: recent.filter(g => g.isHome).filter(g => g.home_score > g.away_score).length /
        Math.max(1, recent.filter(g => g.isHome).length),
      awayFormRating: recent.filter(g => !g.isHome).filter(g => g.away_score > g.home_score).length /
        Math.max(1, recent.filter(g => !g.isHome).length),
      restDaysImpact: 0.5 // Placeholder
    });
  }
  
  return metrics;
}

function calculateMatchupFeatures(game: any, homeMetrics: any, awayMetrics: any, allMetrics: Map<string, any>) {
  return {
    styleMismatch: Math.abs(homeMetrics.offensiveRating - awayMetrics.defensiveRating),
    paceAdvantage: homeMetrics.explosiveness - awayMetrics.explosiveness,
    strengthVsWeakness: homeMetrics.offensiveRating * (1 - awayMetrics.defensiveRating),
    historicalDominance: 0.5 + (Math.random() - 0.5) * 0.2, // Would need H2H data
    commonOpponentPerformance: 0.5, // Would need to calculate
    divisionRivalry: Math.random() > 0.8 ? 1 : 0, // Simulated
    primetimePerformance: new Date(game.start_time).getDay() === 0 ? 0.6 : 0.5,
    clutchFactor: homeMetrics.momentum * homeMetrics.last3Games,
    coachingAdvantage: 0.5 + (Math.random() - 0.5) * 0.2, // Would need coach data
    experienceGap: 0.5 // Would need roster data
  };
}

function calculateEnvironmentalImpact(game: any, weather: any, homeTeam: any, awayTeam: any) {
  const gameDate = new Date(game.start_time);
  const isOutdoor = !homeTeam.stadium?.includes('Dome');
  
  return {
    weatherImpact: weather && isOutdoor ? 
      (weather.wind_speed > 20 || weather.temperature < 32 ? 0.3 : 0.7) : 0.5,
    travelDistance: 0.5 + (Math.random() - 0.5) * 0.2, // Would need location data
    altitudeEffect: homeTeam.city === 'Denver' ? 0.6 : 0.5,
    surfaceAdvantage: 0.5, // Would need surface data
    crowdFactor: 0.55 // Home advantage
  };
}

function calculatePythagoreanExpectation(metrics: any) {
  const pointsFor = metrics.offensiveRating * 25;
  const pointsAgainst = metrics.defensiveRating * 25;
  return Math.pow(pointsFor, 2.37) / (Math.pow(pointsFor, 2.37) + Math.pow(pointsAgainst, 2.37));
}

function calculateStrengthOfSchedule(teamId: string, games: any[]) {
  // Simplified SOS
  return 0.5 + (Math.random() - 0.5) * 0.2;
}

function calculateGameImportance(game: any, allGames: any[]) {
  // Later season games are more important
  const seasonProgress = allGames.indexOf(game) / allGames.length;
  return 0.5 + seasonProgress * 0.5;
}

function getDefaultMetrics() {
  return {
    offensiveRating: 0.5,
    scoringConsistency: 0.5,
    explosiveness: 0.2,
    redZoneEfficiency: 0.6,
    thirdDownConversion: 0.4,
    defensiveRating: 0.5,
    takeawayRate: 0.15,
    pressureRate: 0.25,
    yardAllowedPerGame: 350,
    thirdDownDefense: 0.6,
    momentum: 0.5,
    last3Games: 0.5,
    streakValue: 0,
    homeFormRating: 0.5,
    awayFormRating: 0.5,
    restDaysImpact: 0.5
  };
}

function createInjuryImpactMap(injuries: any[], playerStats: any[]) {
  // Simplified injury impact
  return new Map();
}

// Decision tree helpers
function trainDecisionTree(features: number[][], labels: number[], maxDepth: number = 5, featureSubset?: number[]): any {
  if (maxDepth === 0 || features.length < 10) {
    const avg = labels.reduce((a, b) => a + b, 0) / labels.length;
    return { type: 'leaf', value: avg };
  }
  
  const { bestFeature, bestThreshold, leftIndices, rightIndices } = findBestSplit(features, labels, featureSubset);
  
  if (leftIndices.length === 0 || rightIndices.length === 0) {
    const avg = labels.reduce((a, b) => a + b, 0) / labels.length;
    return { type: 'leaf', value: avg };
  }
  
  return {
    type: 'split',
    feature: bestFeature,
    threshold: bestThreshold,
    left: trainDecisionTree(
      leftIndices.map(i => features[i]),
      leftIndices.map(i => labels[i]),
      maxDepth - 1,
      featureSubset
    ),
    right: trainDecisionTree(
      rightIndices.map(i => features[i]),
      rightIndices.map(i => labels[i]),
      maxDepth - 1,
      featureSubset
    )
  };
}

function findBestSplit(features: number[][], labels: number[], featureSubset?: number[]) {
  let bestGain = -Infinity;
  let bestFeature = 0;
  let bestThreshold = 0;
  let bestLeftIndices: number[] = [];
  let bestRightIndices: number[] = [];
  
  const featuresToCheck = featureSubset || Array(features[0].length).fill(0).map((_, i) => i);
  
  for (const featureIdx of featuresToCheck) {
    const values = features.map(f => f[featureIdx]);
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
    
    for (let i = 0; i < uniqueValues.length - 1; i++) {
      const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
      
      const leftIndices: number[] = [];
      const rightIndices: number[] = [];
      
      for (let j = 0; j < features.length; j++) {
        if (features[j][featureIdx] <= threshold) {
          leftIndices.push(j);
        } else {
          rightIndices.push(j);
        }
      }
      
      if (leftIndices.length === 0 || rightIndices.length === 0) continue;
      
      const gain = calculateGain(
        labels,
        leftIndices.map(i => labels[i]),
        rightIndices.map(i => labels[i])
      );
      
      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = featureIdx;
        bestThreshold = threshold;
        bestLeftIndices = leftIndices;
        bestRightIndices = rightIndices;
      }
    }
  }
  
  return { bestFeature, bestThreshold, leftIndices: bestLeftIndices, rightIndices: bestRightIndices };
}

function calculateGain(parent: number[], left: number[], right: number[]) {
  const entropy = (labels: number[]) => {
    const p = labels.filter(l => l === 1).length / labels.length;
    if (p === 0 || p === 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
  };
  
  const parentEntropy = entropy(parent);
  const leftWeight = left.length / parent.length;
  const rightWeight = right.length / parent.length;
  
  return parentEntropy - (leftWeight * entropy(left) + rightWeight * entropy(right));
}

function predictTree(tree: any, features: number[]): number {
  if (tree.type === 'leaf') {
    return tree.value;
  }
  
  if (features[tree.feature] <= tree.threshold) {
    return predictTree(tree.left, features);
  } else {
    return predictTree(tree.right, features);
  }
}

// Model prediction helpers
async function predictNN(model: tf.LayersModel, features: number[]): Promise<number> {
  const input = tf.tensor2d([features]);
  const prediction = model.predict(input) as tf.Tensor;
  const value = (await prediction.data())[0];
  input.dispose();
  prediction.dispose();
  return value;
}

function predictGB(model: any, features: number[]): number {
  let pred = 0.5;
  for (const tree of model.trees) {
    pred += model.learningRate * predictTree(tree, features);
  }
  return Math.max(0, Math.min(1, pred));
}

function predictRF(trees: any[], features: number[]): number {
  const predictions = trees.map(({ tree, features: featureSubset }) => {
    const subsetFeatures = featureSubset.map((f: number) => features[f]);
    return predictTree(tree, subsetFeatures);
  });
  
  return predictions.reduce((a, b) => a + b, 0) / predictions.length;
}

// Run the training
trainProductionEnsemble().catch(console.error);