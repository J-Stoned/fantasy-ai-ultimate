#!/usr/bin/env tsx
/**
 * 🚀 OPTIMIZED ML TRAINING - FAST & ACCURATE
 * 
 * Focuses on the most predictive features to achieve 75%+ accuracy quickly
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainOptimized() {
  console.log(chalk.red.bold('\n🚀 OPTIMIZED ML TRAINING - TARGETING 75%+\n'));
  
  const startTime = Date.now();
  
  // 1. LOAD ONLY ESSENTIAL DATA
  console.log(chalk.yellow('📊 Loading essential data...'));
  
  // Games with scores
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('created_at', { ascending: true });
    
  console.log(chalk.green(`✅ Loaded ${games?.length || 0} games`));
  
  // Load player stats for fantasy points
  console.log(chalk.yellow('📊 Loading player stats...'));
  const { data: playerStats } = await supabase
    .from('player_stats')
    .select('game_id, team_id, fantasy_points')
    .not('fantasy_points', 'is', null);
    
  console.log(chalk.green(`✅ Loaded ${playerStats?.length || 0} player stats`));
  
  // Group stats by game
  const fantasyByGame = new Map<string, { home: number; away: number }>();
  playerStats?.forEach(stat => {
    if (!fantasyByGame.has(stat.game_id)) {
      fantasyByGame.set(stat.game_id, { home: 0, away: 0 });
    }
    const game = games?.find(g => g.id === stat.game_id);
    if (game) {
      const fantasy = fantasyByGame.get(stat.game_id)!;
      if (stat.team_id === game.home_team_id) {
        fantasy.home += stat.fantasy_points || 0;
      } else if (stat.team_id === game.away_team_id) {
        fantasy.away += stat.fantasy_points || 0;
      }
    }
  });
  
  // 2. BUILD SIMPLE BUT EFFECTIVE FEATURES
  console.log(chalk.yellow('\n🧠 Engineering optimized features...'));
  
  const features: number[][] = [];
  const labels: number[] = [];
  
  // Team performance tracking
  const teamStats = new Map<string, {
    games: number;
    wins: number;
    pointsFor: number;
    pointsAgainst: number;
    last5: boolean[];
    homeWins: number;
    homeGames: number;
    awayWins: number;
    awayGames: number;
    avgFantasy: number;
    momentum: number;
  }>();
  
  // ELO ratings for each team
  const eloRatings = new Map<string, number>();
  const K = 32; // ELO K-factor
  
  // Process games chronologically
  let includedGames = 0;
  let skippedGames = 0;
  
  for (const game of games || []) {
    // Initialize teams if needed
    [game.home_team_id, game.away_team_id].forEach(teamId => {
      if (!teamStats.has(teamId)) {
        teamStats.set(teamId, {
          games: 0,
          wins: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          last5: [],
          homeWins: 0,
          homeGames: 0,
          awayWins: 0,
          awayGames: 0,
          avgFantasy: 0,
          momentum: 0
        });
        eloRatings.set(teamId, 1500);
      }
    });
    
    const homeStats = teamStats.get(game.home_team_id)!;
    const awayStats = teamStats.get(game.away_team_id)!;
    
    // Skip games where teams have < 5 games history
    if (homeStats.games < 5 || awayStats.games < 5) {
      skippedGames++;
      // Update stats for future games
      updateTeamStats(game, homeStats, awayStats, fantasyByGame.get(game.id));
      updateElo(game, eloRatings);
      continue;
    }
    
    // Get ELO ratings
    const homeElo = eloRatings.get(game.home_team_id)!;
    const awayElo = eloRatings.get(game.away_team_id)!;
    
    // Extract KEY features that actually predict outcomes
    const gameFeatures = [
      // === ELO & Win Rates (most predictive) ===
      homeElo / 1500,
      awayElo / 1500,
      (homeElo - awayElo) / 400, // ELO difference
      homeStats.wins / homeStats.games, // Win rate
      awayStats.wins / awayStats.games,
      
      // === Scoring Power ===
      homeStats.pointsFor / homeStats.games / 25, // Avg points scored
      awayStats.pointsFor / awayStats.games / 25,
      homeStats.pointsAgainst / homeStats.games / 25, // Avg points allowed
      awayStats.pointsAgainst / awayStats.games / 25,
      
      // === Recent Form ===
      homeStats.last5.filter(w => w).length / 5, // Last 5 games
      awayStats.last5.filter(w => w).length / 5,
      homeStats.momentum,
      awayStats.momentum,
      
      // === Home/Away Performance ===
      homeStats.homeGames > 0 ? homeStats.homeWins / homeStats.homeGames : 0.55,
      awayStats.awayGames > 0 ? awayStats.awayWins / awayStats.awayGames : 0.45,
      
      // === Fantasy Points (player quality indicator) ===
      homeStats.avgFantasy / 200,
      awayStats.avgFantasy / 200,
      
      // === Matchup Factors ===
      1.0, // Home field advantage
      calculateRestDays(games, game, game.home_team_id) / 7,
      calculateRestDays(games, game, game.away_team_id) / 7
    ];
    
    features.push(gameFeatures);
    labels.push(game.home_score > game.away_score ? 1 : 0);
    includedGames++;
    
    // Update stats AFTER using them
    updateTeamStats(game, homeStats, awayStats, fantasyByGame.get(game.id));
    updateElo(game, eloRatings);
  }
  
  console.log(chalk.green(`✅ Created ${includedGames} samples (skipped ${skippedGames} with insufficient history)`));
  console.log(chalk.cyan(`   Features: ${features[0]?.length || 0}`));
  
  // 3. TRAIN FOCUSED MODEL
  console.log(chalk.yellow('\n🏋️ Training optimized model...'));
  
  // Split data
  const trainSize = Math.floor(features.length * 0.8);
  const valSize = Math.floor(features.length * 0.1);
  
  const xTrain = tf.tensor2d(features.slice(0, trainSize));
  const yTrain = tf.tensor1d(labels.slice(0, trainSize));
  const xVal = tf.tensor2d(features.slice(trainSize, trainSize + valSize));
  const yVal = tf.tensor1d(labels.slice(trainSize, trainSize + valSize));
  const xTest = tf.tensor2d(features.slice(trainSize + valSize));
  const yTest = tf.tensor1d(labels.slice(trainSize + valSize));
  
  console.log(chalk.green(`✅ Train: ${trainSize} | Val: ${valSize} | Test: ${features.length - trainSize - valSize}`));
  
  // Build efficient model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [features[0].length],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.3 }),
      
      tf.layers.dense({
        units: 64,
        activation: 'relu'
      }),
      tf.layers.dropout({ rate: 0.3 }),
      
      tf.layers.dense({
        units: 32,
        activation: 'relu'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      
      tf.layers.dense({
        units: 16,
        activation: 'relu'
      }),
      
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
  
  // Train with early stopping
  console.log(chalk.yellow('\n🚀 Training...'));
  
  let bestValAcc = 0;
  let patience = 0;
  let bestEpoch = 0;
  
  for (let epoch = 0; epoch < 200; epoch++) {
    const h = await model.fit(xTrain, yTrain, {
      batchSize: 128,
      epochs: 1,
      validationData: [xVal, yVal],
      shuffle: true,
      verbose: 0
    });
    
    const loss = h.history.loss[0] as number;
    const acc = h.history.acc[0] as number;
    const valAcc = h.history.val_acc[0] as number;
    
    if (valAcc > bestValAcc) {
      bestValAcc = valAcc;
      bestEpoch = epoch;
      patience = 0;
      await model.save(`file://${path.join(process.cwd(), 'models/optimized_best')}`);
    } else {
      patience++;
    }
    
    if (epoch % 10 === 0 || patience >= 15) {
      console.log(
        chalk.gray(`Epoch ${epoch + 1} - `) +
        chalk.yellow(`loss: ${loss.toFixed(4)} - `) +
        chalk.green(`acc: ${(acc * 100).toFixed(2)}% - `) +
        chalk.blue(`val_acc: ${(valAcc * 100).toFixed(2)}% - `) +
        chalk.magenta(`best: ${(bestValAcc * 100).toFixed(2)}% (epoch ${bestEpoch + 1})`)
      );
    }
    
    // Stop if we hit target
    if (bestValAcc >= 0.75 && patience >= 5) {
      console.log(chalk.green.bold(`\n🎯 TARGET ACHIEVED! Stopping early.`));
      break;
    }
    
    if (patience >= 15) {
      console.log(chalk.yellow(`\nEarly stopping at epoch ${epoch + 1}`));
      break;
    }
  }
  
  // Load best model
  const bestModel = await tf.loadLayersModel(`file://${path.join(process.cwd(), 'models/optimized_best/model.json')}`);
  bestModel.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // Final evaluation
  const evaluation = bestModel.evaluate(xTest, yTest) as tf.Tensor[];
  const testAccuracy = (await evaluation[1].data())[0];
  
  console.log(chalk.green.bold(`\n🎯 FINAL TEST ACCURACY: ${(testAccuracy * 100).toFixed(2)}%`));
  
  // Detailed evaluation
  const predictions = bestModel.predict(xTest) as tf.Tensor;
  const predArray = await predictions.array() as number[][];
  const testLabels = await yTest.array() as number[];
  
  let tp = 0, tn = 0, fp = 0, fn = 0;
  predArray.forEach((pred, i) => {
    const predicted = pred[0] > 0.5 ? 1 : 0;
    const actual = testLabels[i];
    
    if (predicted === 1 && actual === 1) tp++;
    else if (predicted === 0 && actual === 0) tn++;
    else if (predicted === 1 && actual === 0) fp++;
    else if (predicted === 0 && actual === 1) fn++;
  });
  
  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  const f1 = 2 * (precision * recall) / (precision + recall);
  
  console.log(chalk.cyan('\n📊 Detailed Metrics:'));
  console.log(chalk.cyan(`   Precision: ${(precision * 100).toFixed(2)}%`));
  console.log(chalk.cyan(`   Recall: ${(recall * 100).toFixed(2)}%`));
  console.log(chalk.cyan(`   F1 Score: ${(f1 * 100).toFixed(2)}%`));
  
  // Save model
  const modelPath = path.join(process.cwd(), 'models/production_optimized');
  await fs.mkdir(modelPath, { recursive: true });
  await bestModel.save(`file://${modelPath}`);
  
  // Save metadata
  await fs.writeFile(
    path.join(modelPath, 'metadata.json'),
    JSON.stringify({
      accuracy: testAccuracy,
      precision,
      recall,
      f1Score: f1,
      trainingSamples: features.length,
      features: {
        count: features[0].length,
        names: [
          'home_elo', 'away_elo', 'elo_diff',
          'home_win_rate', 'away_win_rate',
          'home_ppg', 'away_ppg', 'home_papg', 'away_papg',
          'home_last5', 'away_last5', 'home_momentum', 'away_momentum',
          'home_home_record', 'away_away_record',
          'home_fantasy_avg', 'away_fantasy_avg',
          'home_advantage', 'home_rest', 'away_rest'
        ]
      },
      bestValidation: bestValAcc,
      bestEpoch: bestEpoch + 1,
      trainTime: (Date.now() - startTime) / 1000,
      timestamp: new Date().toISOString()
    }, null, 2)
  );
  
  // Track in database
  await supabase.from('ml_model_performance').insert({
    model_name: 'optimized_game_predictor',
    model_version: 1,
    evaluation_date: new Date().toISOString().split('T')[0],
    total_predictions: testLabels.length,
    correct_predictions: Math.round(testLabels.length * testAccuracy),
    accuracy: testAccuracy,
    precision_score: precision,
    recall_score: recall,
    f1_score: f1,
    confusion_matrix: { tp, tn, fp, fn },
    metadata: {
      features: features[0].length,
      trainingSamples: trainSize,
      validationSamples: valSize,
      testSamples: testLabels.length
    }
  });
  
  // Cleanup
  xTrain.dispose();
  yTrain.dispose();
  xVal.dispose();
  yVal.dispose();
  xTest.dispose();
  yTest.dispose();
  predictions.dispose();
  evaluation.forEach(t => t.dispose());
  
  console.log(chalk.red.bold(`
🚀 OPTIMIZED TRAINING COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Model Performance:
  • Test Accuracy: ${(testAccuracy * 100).toFixed(2)}%
  • Best Validation: ${(bestValAcc * 100).toFixed(2)}%
  • Precision: ${(precision * 100).toFixed(2)}%
  • Recall: ${(recall * 100).toFixed(2)}%
  • F1 Score: ${(f1 * 100).toFixed(2)}%
  
📊 Data Used:
  • Total Games: ${games?.length || 0}
  • Training Samples: ${features.length}
  • Features: ${features[0].length} (focused on most predictive)
  
✅ Model saved to: ${modelPath}
✅ Performance tracked in database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${testAccuracy >= 0.75 ? '🏆 TARGET ACHIEVED! 75%+ ACCURACY!' : testAccuracy >= 0.70 ? '✅ GREAT! Above 70%!' : '📈 Good progress!'}
`));
}

// Helper functions
function updateTeamStats(game: any, homeStats: any, awayStats: any, fantasy?: { home: number; away: number }) {
  const homeWon = game.home_score > game.away_score;
  
  // Update home team
  homeStats.games++;
  homeStats.wins += homeWon ? 1 : 0;
  homeStats.pointsFor += game.home_score;
  homeStats.pointsAgainst += game.away_score;
  homeStats.last5.push(homeWon);
  if (homeStats.last5.length > 5) homeStats.last5.shift();
  homeStats.homeWins += homeWon ? 1 : 0;
  homeStats.homeGames++;
  
  // Update fantasy average
  if (fantasy) {
    homeStats.avgFantasy = (homeStats.avgFantasy * (homeStats.games - 1) + fantasy.home) / homeStats.games;
  }
  
  // Calculate momentum (weighted recent performance)
  let momentum = 0;
  homeStats.last5.forEach((won: boolean, i: number) => {
    const weight = (i + 1) / homeStats.last5.length;
    momentum += (won ? 1 : -1) * weight;
  });
  homeStats.momentum = (momentum + 1) / 2;
  
  // Update away team
  awayStats.games++;
  awayStats.wins += !homeWon ? 1 : 0;
  awayStats.pointsFor += game.away_score;
  awayStats.pointsAgainst += game.home_score;
  awayStats.last5.push(!homeWon);
  if (awayStats.last5.length > 5) awayStats.last5.shift();
  awayStats.awayWins += !homeWon ? 1 : 0;
  awayStats.awayGames++;
  
  if (fantasy) {
    awayStats.avgFantasy = (awayStats.avgFantasy * (awayStats.games - 1) + fantasy.away) / awayStats.games;
  }
  
  momentum = 0;
  awayStats.last5.forEach((won: boolean, i: number) => {
    const weight = (i + 1) / awayStats.last5.length;
    momentum += (won ? 1 : -1) * weight;
  });
  awayStats.momentum = (momentum + 1) / 2;
}

function updateElo(game: any, eloRatings: Map<string, number>) {
  const K = 32;
  const homeElo = eloRatings.get(game.home_team_id) || 1500;
  const awayElo = eloRatings.get(game.away_team_id) || 1500;
  
  const expectedHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
  const expectedAway = 1 - expectedHome;
  
  const homeWon = game.home_score > game.away_score;
  const homeResult = homeWon ? 1 : 0;
  const awayResult = 1 - homeResult;
  
  eloRatings.set(game.home_team_id, homeElo + K * (homeResult - expectedHome));
  eloRatings.set(game.away_team_id, awayElo + K * (awayResult - expectedAway));
}

function calculateRestDays(games: any[], currentGame: any, teamId: string): number {
  const gameDate = new Date(currentGame.created_at);
  const currentIndex = games.indexOf(currentGame);
  
  // Look backwards for previous game
  for (let i = currentIndex - 1; i >= 0; i--) {
    const game = games[i];
    if (game.home_team_id === teamId || game.away_team_id === teamId) {
      const prevDate = new Date(game.created_at);
      const days = (gameDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.min(days, 14);
    }
  }
  
  return 7; // Default
}

// Run training
trainOptimized().catch(console.error);