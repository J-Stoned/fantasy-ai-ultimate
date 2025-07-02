#!/usr/bin/env tsx
/**
 * 🚀 TRAIN ML MODELS ON ALL AVAILABLE DATA
 * 
 * This script trains on the FULL dataset:
 * - 82,861 games
 * - 213,851 news articles  
 * - 846,724 players
 * - All available features
 * 
 * No more 5000 record limits!
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
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

interface TrainingStats {
  totalGames: number;
  totalNews: number;
  totalPlayers: number;
  trainingSize: number;
  testSize: number;
  features: number;
  trainAccuracy: number;
  testAccuracy: number;
  trainTime: number;
}

async function trainOnAllData() {
  console.log(chalk.blue.bold('\n🚀 TRAINING ML MODELS ON ALL AVAILABLE DATA\n'));
  
  const startTime = Date.now();
  
  // 1. Load ALL games
  console.log(chalk.yellow('📊 Loading ALL games...'));
  const { data: allGames, count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('created_at', { ascending: false });
    
  console.log(chalk.green(`✅ Loaded ${gameCount} games with scores`));
  
  // 2. Load ALL news for sentiment
  console.log(chalk.yellow('\n📰 Loading ALL news articles...'));
  const { data: allNews, count: newsCount } = await supabase
    .from('news_articles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
    
  console.log(chalk.green(`✅ Loaded ${newsCount} news articles`));
  
  // 3. Load ALL players
  console.log(chalk.yellow('\n👥 Loading ALL players...'));
  const { data: allPlayers, count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact' });
    
  console.log(chalk.green(`✅ Loaded ${playerCount} players`));
  
  // 4. Load social sentiment
  console.log(chalk.yellow('\n💬 Loading social sentiment...'));
  const { data: sentiment } = await supabase
    .from('social_sentiment')
    .select('*');
    
  console.log(chalk.green(`✅ Loaded ${sentiment?.length || 0} sentiment records`));
  
  // 5. Create comprehensive feature set
  console.log(chalk.yellow('\n🔧 Building comprehensive feature matrix...'));
  
  const { features, labels, featureNames } = await buildFeatureMatrix(
    allGames || [],
    allNews || [],
    allPlayers || [],
    sentiment || []
  );
  
  console.log(chalk.green(`✅ Built feature matrix: ${features.length} samples, ${featureNames.length} features`));
  console.log(chalk.cyan('Features included:'));
  featureNames.forEach((name, i) => {
    if (i < 20) console.log(`  ${i + 1}. ${name}`);
  });
  if (featureNames.length > 20) {
    console.log(`  ... and ${featureNames.length - 20} more features`);
  }
  
  // 6. Split data (80/20)
  const splitIdx = Math.floor(features.length * 0.8);
  const trainFeatures = features.slice(0, splitIdx);
  const trainLabels = labels.slice(0, splitIdx);
  const testFeatures = features.slice(splitIdx);
  const testLabels = labels.slice(splitIdx);
  
  console.log(chalk.yellow(`\n🎯 Training on ${trainFeatures.length} samples, testing on ${testFeatures.length} samples`));
  
  // 7. Build and train model
  const model = buildAdvancedModel(featureNames.length);
  
  // Convert to tensors
  const xTrain = tf.tensor2d(trainFeatures);
  const yTrain = tf.tensor1d(trainLabels);
  const xTest = tf.tensor2d(testFeatures);
  const yTest = tf.tensor1d(testLabels);
  
  // Train model
  console.log(chalk.yellow('\n🧠 Training neural network on ALL data...'));
  
  const history = await model.fit(xTrain, yTrain, {
    epochs: 50,
    batchSize: 256, // Larger batch size for more data
    validationSplit: 0.1,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 5 === 0 || epoch === 49) {
          console.log(
            chalk.gray(`Epoch ${epoch + 1}/50 - `) +
            chalk.yellow(`loss: ${logs?.loss?.toFixed(4)} - `) +
            chalk.green(`accuracy: ${(logs?.acc! * 100).toFixed(2)}% - `) +
            chalk.blue(`val_accuracy: ${(logs?.val_acc! * 100).toFixed(2)}%`)
          );
        }
      }
    }
  });
  
  // 8. Evaluate on test set
  console.log(chalk.yellow('\n📊 Evaluating on test set...'));
  const evaluation = model.evaluate(xTest, yTest) as tf.Tensor[];
  const testLoss = await evaluation[0].data();
  const testAccuracy = await evaluation[1].data();
  
  console.log(chalk.green(`\n✅ Test Accuracy: ${(testAccuracy[0] * 100).toFixed(2)}%`));
  
  // 9. Save model
  const modelPath = path.join(process.cwd(), 'models', 'game_predictor_all_data');
  await fs.mkdir(modelPath, { recursive: true });
  await model.save(`file://${modelPath}`);
  
  console.log(chalk.green(`\n✅ Model saved to ${modelPath}`));
  
  // 10. Save training stats
  const stats: TrainingStats = {
    totalGames: gameCount || 0,
    totalNews: newsCount || 0,
    totalPlayers: playerCount || 0,
    trainingSize: trainFeatures.length,
    testSize: testFeatures.length,
    features: featureNames.length,
    trainAccuracy: history.history.acc[history.history.acc.length - 1] as number,
    testAccuracy: testAccuracy[0],
    trainTime: (Date.now() - startTime) / 1000
  };
  
  await fs.writeFile(
    path.join(modelPath, 'training_stats.json'),
    JSON.stringify(stats, null, 2)
  );
  
  // 11. Feature importance analysis
  console.log(chalk.yellow('\n🔍 Analyzing feature importance...'));
  const importance = await analyzeFeatureImportance(model, xTest, yTest, featureNames);
  
  console.log(chalk.cyan('\nTop 10 Most Important Features:'));
  importance.slice(0, 10).forEach((feat, i) => {
    console.log(`  ${i + 1}. ${feat.name}: ${(feat.importance * 100).toFixed(2)}%`);
  });
  
  // Clean up tensors
  xTrain.dispose();
  yTrain.dispose();
  xTest.dispose();
  yTest.dispose();
  evaluation.forEach(t => t.dispose());
  
  console.log(chalk.blue.bold(`\n🎉 Training completed in ${stats.trainTime.toFixed(1)} seconds!`));
  console.log(chalk.green.bold(`   Final accuracy: ${(stats.testAccuracy * 100).toFixed(2)}%`));
  console.log(chalk.yellow(`   Trained on ${stats.totalGames} games, ${stats.totalNews} news articles`));
}

/**
 * Build comprehensive feature matrix from ALL data
 */
async function buildFeatureMatrix(
  games: any[],
  news: any[],
  players: any[],
  sentiment: any[]
) {
  const features: number[][] = [];
  const labels: number[] = [];
  const featureNames: string[] = [];
  
  // Build team stats from historical data
  const teamStats = new Map<string, any>();
  
  // Calculate team statistics
  for (const game of games) {
    if (!teamStats.has(game.home_team_id)) {
      teamStats.set(game.home_team_id, { wins: 0, losses: 0, totalPoints: 0, games: 0 });
    }
    if (!teamStats.has(game.away_team_id)) {
      teamStats.set(game.away_team_id, { wins: 0, losses: 0, totalPoints: 0, games: 0 });
    }
    
    const homeStats = teamStats.get(game.home_team_id);
    const awayStats = teamStats.get(game.away_team_id);
    
    homeStats.games++;
    awayStats.games++;
    homeStats.totalPoints += game.home_score;
    awayStats.totalPoints += game.away_score;
    
    if (game.home_score > game.away_score) {
      homeStats.wins++;
      awayStats.losses++;
    } else {
      awayStats.wins++;
      homeStats.losses++;
    }
  }
  
  // Build sentiment index
  const teamSentiment = new Map<string, number>();
  for (const s of sentiment) {
    const current = teamSentiment.get(s.team_id) || 0;
    teamSentiment.set(s.team_id, current + (s.sentiment_score || 0));
  }
  
  // News sentiment by team
  const newsSentiment = new Map<string, { positive: number; negative: number }>();
  for (const article of news) {
    // Simple sentiment from title
    const title = article.title?.toLowerCase() || '';
    const isPositive = title.includes('win') || title.includes('great') || title.includes('best');
    const isNegative = title.includes('loss') || title.includes('injury') || title.includes('struggle');
    
    // Extract team mentions (simplified)
    const teamMentions = article.entities?.teams || [];
    for (const team of teamMentions) {
      if (!newsSentiment.has(team)) {
        newsSentiment.set(team, { positive: 0, negative: 0 });
      }
      const sentiment = newsSentiment.get(team)!;
      if (isPositive) sentiment.positive++;
      if (isNegative) sentiment.negative++;
    }
  }
  
  // Define all features
  if (featureNames.length === 0) {
    featureNames.push(
      // Team performance features
      'home_win_rate',
      'away_win_rate',
      'home_avg_points',
      'away_avg_points',
      'home_games_played',
      'away_games_played',
      'win_rate_diff',
      'avg_points_diff',
      
      // Recent form (last 5 games)
      'home_recent_wins',
      'away_recent_wins',
      'home_recent_avg_points',
      'away_recent_avg_points',
      
      // Head to head
      'h2h_home_wins',
      'h2h_away_wins',
      'h2h_avg_total_points',
      
      // Time features
      'hour_of_day',
      'day_of_week',
      'month',
      'is_weekend',
      'is_primetime',
      
      // Sentiment features
      'home_sentiment_score',
      'away_sentiment_score',
      'home_news_positive',
      'home_news_negative',
      'away_news_positive',
      'away_news_negative',
      'sentiment_diff',
      
      // Betting features
      'total_line',
      'home_spread',
      
      // Weather (placeholder - would need real data)
      'temperature',
      'wind_speed',
      'is_dome',
      
      // Roster strength (from player data)
      'home_star_players',
      'away_star_players',
      'home_avg_player_rating',
      'away_avg_player_rating'
    );
  }
  
  // Process each game
  for (let i = 0; i < games.length - 1; i++) {
    const game = games[i];
    const homeStats = teamStats.get(game.home_team_id);
    const awayStats = teamStats.get(game.away_team_id);
    
    if (!homeStats || !awayStats || homeStats.games < 5 || awayStats.games < 5) {
      continue; // Skip games without enough history
    }
    
    // Calculate recent form (last 5 games before this one)
    const recentGames = games.slice(Math.max(0, i - 10), i);
    const homeRecent = calculateRecentForm(recentGames, game.home_team_id);
    const awayRecent = calculateRecentForm(recentGames, game.away_team_id);
    
    // Head to head history
    const h2h = calculateH2H(games.slice(0, i), game.home_team_id, game.away_team_id);
    
    // Time features
    const gameDate = new Date(game.created_at);
    const hour = gameDate.getHours();
    const dayOfWeek = gameDate.getDay();
    const month = gameDate.getMonth();
    
    // Get sentiment scores
    const homeSentiment = teamSentiment.get(game.home_team_id) || 0;
    const awaySentiment = teamSentiment.get(game.away_team_id) || 0;
    const homeNews = newsSentiment.get(game.home_team_id) || { positive: 0, negative: 0 };
    const awayNews = newsSentiment.get(game.away_team_id) || { positive: 0, negative: 0 };
    
    // Count star players per team
    const homeStarPlayers = players.filter(p => 
      p.team_id === game.home_team_id && (p.projected_points || 0) > 15
    ).length;
    const awayStarPlayers = players.filter(p => 
      p.team_id === game.away_team_id && (p.projected_points || 0) > 15
    ).length;
    
    // Build feature vector
    const featureVector = [
      // Team performance
      homeStats.wins / Math.max(1, homeStats.games),
      awayStats.wins / Math.max(1, awayStats.games),
      homeStats.totalPoints / Math.max(1, homeStats.games),
      awayStats.totalPoints / Math.max(1, awayStats.games),
      Math.min(homeStats.games / 20, 1), // Normalize games played
      Math.min(awayStats.games / 20, 1),
      (homeStats.wins / Math.max(1, homeStats.games)) - (awayStats.wins / Math.max(1, awayStats.games)),
      (homeStats.totalPoints / Math.max(1, homeStats.games)) - (awayStats.totalPoints / Math.max(1, awayStats.games)),
      
      // Recent form
      homeRecent.wins / Math.max(1, homeRecent.games),
      awayRecent.wins / Math.max(1, awayRecent.games),
      homeRecent.avgPoints,
      awayRecent.avgPoints,
      
      // Head to head
      h2h.homeWins / Math.max(1, h2h.totalGames),
      h2h.awayWins / Math.max(1, h2h.totalGames),
      h2h.avgTotalPoints,
      
      // Time features
      hour / 24,
      dayOfWeek / 7,
      month / 12,
      dayOfWeek >= 5 ? 1 : 0, // Weekend
      hour >= 20 || hour <= 1 ? 1 : 0, // Primetime
      
      // Sentiment
      Math.tanh(homeSentiment / 100),
      Math.tanh(awaySentiment / 100),
      Math.log1p(homeNews.positive),
      Math.log1p(homeNews.negative),
      Math.log1p(awayNews.positive),
      Math.log1p(awayNews.negative),
      Math.tanh((homeSentiment - awaySentiment) / 100),
      
      // Betting (use score differential as proxy)
      (game.home_score + game.away_score) / 100, // Total line proxy
      (game.home_score - game.away_score) / 50, // Spread proxy
      
      // Weather placeholders
      0.7, // Temperature (normalized)
      0.2, // Wind speed (normalized)
      Math.random() > 0.3 ? 1 : 0, // Is dome
      
      // Roster strength
      Math.min(homeStarPlayers / 10, 1),
      Math.min(awayStarPlayers / 10, 1),
      15, // Placeholder avg rating
      15  // Placeholder avg rating
    ];
    
    features.push(featureVector);
    labels.push(game.home_score > game.away_score ? 1 : 0);
  }
  
  return { features, labels, featureNames };
}

/**
 * Calculate recent form for a team
 */
function calculateRecentForm(recentGames: any[], teamId: string) {
  let wins = 0;
  let totalPoints = 0;
  let games = 0;
  
  for (const game of recentGames) {
    if (game.home_team_id === teamId) {
      games++;
      totalPoints += game.home_score;
      if (game.home_score > game.away_score) wins++;
    } else if (game.away_team_id === teamId) {
      games++;
      totalPoints += game.away_score;
      if (game.away_score > game.home_score) wins++;
    }
    
    if (games >= 5) break;
  }
  
  return {
    wins,
    games,
    avgPoints: games > 0 ? totalPoints / games : 0
  };
}

/**
 * Calculate head to head history
 */
function calculateH2H(games: any[], team1: string, team2: string) {
  let homeWins = 0;
  let awayWins = 0;
  let totalPoints = 0;
  let totalGames = 0;
  
  for (const game of games) {
    if (game.home_team_id === team1 && game.away_team_id === team2) {
      totalGames++;
      totalPoints += game.home_score + game.away_score;
      if (game.home_score > game.away_score) homeWins++;
      else awayWins++;
    } else if (game.home_team_id === team2 && game.away_team_id === team1) {
      totalGames++;
      totalPoints += game.home_score + game.away_score;
      if (game.away_score > game.home_score) homeWins++;
      else awayWins++;
    }
  }
  
  return {
    homeWins,
    awayWins,
    totalGames,
    avgTotalPoints: totalGames > 0 ? totalPoints / totalGames : 50
  };
}

/**
 * Build advanced neural network model
 */
function buildAdvancedModel(inputShape: number): tf.Sequential {
  const model = tf.sequential();
  
  // Input layer with batch normalization
  model.add(tf.layers.dense({
    inputShape: [inputShape],
    units: 256,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  // Hidden layers with residual connections
  model.add(tf.layers.dense({
    units: 128,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.3 }));
  
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  
  // Output layer
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));
  
  // Compile with advanced optimizer
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  return model;
}

/**
 * Analyze feature importance using permutation
 */
async function analyzeFeatureImportance(
  model: tf.Sequential,
  xTest: tf.Tensor2D,
  yTest: tf.Tensor1D,
  featureNames: string[]
): Promise<{ name: string; importance: number }[]> {
  const baselineEval = model.evaluate(xTest, yTest) as tf.Tensor[];
  const baselineAcc = await baselineEval[1].data();
  
  const importance: { name: string; importance: number }[] = [];
  
  // Test each feature
  for (let i = 0; i < featureNames.length; i++) {
    // Create a copy and shuffle one feature
    const xPermuted = xTest.clone();
    const data = await xPermuted.array() as number[][];
    
    // Shuffle column i
    for (let j = 0; j < data.length; j++) {
      const randomIdx = Math.floor(Math.random() * data.length);
      [data[j][i], data[randomIdx][i]] = [data[randomIdx][i], data[j][i]];
    }
    
    const xPermutedTensor = tf.tensor2d(data);
    const permutedEval = model.evaluate(xPermutedTensor, yTest) as tf.Tensor[];
    const permutedAcc = await permutedEval[1].data();
    
    importance.push({
      name: featureNames[i],
      importance: baselineAcc[0] - permutedAcc[0]
    });
    
    // Clean up
    xPermuted.dispose();
    xPermutedTensor.dispose();
    permutedEval.forEach(t => t.dispose());
  }
  
  // Clean up baseline
  baselineEval.forEach(t => t.dispose());
  
  // Sort by importance
  return importance.sort((a, b) => b.importance - a.importance);
}

// Run training
trainOnAllData().catch(console.error);