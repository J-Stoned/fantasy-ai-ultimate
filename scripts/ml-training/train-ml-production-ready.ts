#!/usr/bin/env tsx
/**
 * 🚀 PRODUCTION-READY ML TRAINING
 * Target: 75%+ accuracy with smart feature engineering
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

interface TeamStats {
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  last5: number[];
  last10: number[];
  homeRecord: { wins: number; losses: number };
  awayRecord: { wins: number; losses: number };
  streakType: 'W' | 'L';
  streakLength: number;
}

async function trainProductionModel() {
  console.log(chalk.blue.bold('\n🚀 PRODUCTION ML TRAINING - TARGET: 75%+ ACCURACY\n'));
  
  const startTime = Date.now();
  
  // Load all data
  console.log(chalk.yellow('📊 Loading comprehensive dataset...'));
  
  // Load games in batches
  const games: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + 999);
    
    if (!data || data.length === 0) break;
    games.push(...data);
    offset += 1000;
    console.log(`  Loaded ${games.length} games...`);
  }
  
  console.log(chalk.green(`✅ Loaded ${games.length} games`));
  
  // Load supplementary data
  const [playerStats, injuries, weather, sentiment] = await Promise.all([
    supabase.from('player_stats').select('*').then(r => r.data || []),
    supabase.from('player_injuries').select('*').then(r => r.data || []),
    supabase.from('weather_data').select('*').then(r => r.data || []),
    supabase.from('social_sentiment').select('*').then(r => r.data || [])
  ]);
  
  console.log(chalk.green(`✅ Loaded all supplementary data`));
  
  // Create lookup maps
  const statsByGame = new Map();
  playerStats.forEach(stat => {
    if (!statsByGame.has(stat.game_id)) {
      statsByGame.set(stat.game_id, []);
    }
    statsByGame.get(stat.game_id).push(stat);
  });
  
  const injuriesByTeam = new Map();
  injuries.forEach(injury => {
    if (!injuriesByTeam.has(injury.team_id)) {
      injuriesByTeam.set(injury.team_id, 0);
    }
    injuriesByTeam.set(injury.team_id, injuriesByTeam.get(injury.team_id) + 1);
  });
  
  const weatherByGame = new Map();
  weather.forEach(w => {
    if (w.game_id) weatherByGame.set(w.game_id, w);
  });
  
  const sentimentByTeam = new Map();
  sentiment.forEach(s => {
    if (!sentimentByTeam.has(s.team_id)) {
      sentimentByTeam.set(s.team_id, { total: 0, count: 0 });
    }
    const teamSent = sentimentByTeam.get(s.team_id);
    teamSent.total += s.sentiment_score || 0;
    teamSent.count += 1;
  });
  
  // Build feature matrix
  console.log(chalk.yellow('\n🔧 Engineering advanced features...'));
  
  const features: number[][] = [];
  const labels: number[] = [];
  const teamStats = new Map<string, TeamStats>();
  
  // Initialize team stats
  games.forEach(game => {
    [game.home_team_id, game.away_team_id].forEach(teamId => {
      if (!teamStats.has(teamId)) {
        teamStats.set(teamId, {
          games: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          last5: [],
          last10: [],
          homeRecord: { wins: 0, losses: 0 },
          awayRecord: { wins: 0, losses: 0 },
          streakType: 'W',
          streakLength: 0
        });
      }
    });
  });
  
  // Process games chronologically
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const homeStats = teamStats.get(game.home_team_id)!;
    const awayStats = teamStats.get(game.away_team_id)!;
    
    // Skip if teams don't have enough history
    if (homeStats.games < 10 || awayStats.games < 10) {
      // Update stats for future games
      updateTeamStats(game, homeStats, awayStats);
      continue;
    }
    
    // Calculate features
    const gameFeatures = [
      // Basic performance metrics
      homeStats.wins / homeStats.games,
      awayStats.wins / awayStats.games,
      homeStats.pointsFor / homeStats.games,
      awayStats.pointsFor / awayStats.games,
      homeStats.pointsAgainst / homeStats.games,
      awayStats.pointsAgainst / awayStats.games,
      
      // Recent form (last 5 and 10 games)
      homeStats.last5.reduce((a, b) => a + b, 0) / Math.max(homeStats.last5.length, 1),
      awayStats.last5.reduce((a, b) => a + b, 0) / Math.max(awayStats.last5.length, 1),
      homeStats.last10.reduce((a, b) => a + b, 0) / Math.max(homeStats.last10.length, 1),
      awayStats.last10.reduce((a, b) => a + b, 0) / Math.max(awayStats.last10.length, 1),
      
      // Home/away specific performance
      homeStats.homeRecord.wins / Math.max(homeStats.homeRecord.wins + homeStats.homeRecord.losses, 1),
      awayStats.awayRecord.wins / Math.max(awayStats.awayRecord.wins + awayStats.awayRecord.losses, 1),
      
      // Momentum (streak)
      homeStats.streakType === 'W' ? homeStats.streakLength / 10 : -homeStats.streakLength / 10,
      awayStats.streakType === 'W' ? awayStats.streakLength / 10 : -awayStats.streakLength / 10,
      
      // Head-to-head (from previous games)
      getH2HRecord(games.slice(0, i), game.home_team_id, game.away_team_id),
      
      // Rest days (simplified - using index difference)
      getRestDays(games.slice(Math.max(0, i - 20), i), game.home_team_id),
      getRestDays(games.slice(Math.max(0, i - 20), i), game.away_team_id),
      
      // Player stats aggregates
      ...getPlayerStatsFeatures(statsByGame.get(game.id) || []),
      
      // Injuries
      Math.min(injuriesByTeam.get(game.home_team_id) || 0, 5) / 5,
      Math.min(injuriesByTeam.get(game.away_team_id) || 0, 5) / 5,
      
      // Weather
      weatherByGame.has(game.id) ? weatherByGame.get(game.id).temperature / 100 : 0.7,
      weatherByGame.has(game.id) ? weatherByGame.get(game.id).wind_speed / 30 : 0.2,
      
      // Sentiment
      getSentimentScore(sentimentByTeam, game.home_team_id),
      getSentimentScore(sentimentByTeam, game.away_team_id),
      
      // Time features
      new Date(game.created_at).getHours() / 24,
      new Date(game.created_at).getDay() / 7,
      new Date(game.created_at).getMonth() / 12,
      
      // Advanced differentials
      (homeStats.pointsFor - homeStats.pointsAgainst) / homeStats.games,
      (awayStats.pointsFor - awayStats.pointsAgainst) / awayStats.games,
      
      // Win probability estimate (simple)
      homeStats.wins / (homeStats.wins + awayStats.wins),
      
      // Home advantage
      1.0
    ];
    
    features.push(gameFeatures);
    labels.push(game.home_score > game.away_score ? 1 : 0);
    
    // Update stats
    updateTeamStats(game, homeStats, awayStats);
  }
  
  console.log(chalk.green(`✅ Created ${features.length} samples with ${features[0].length} features`));
  
  // Split data
  const splitIdx = Math.floor(features.length * 0.7);
  const valIdx = Math.floor(features.length * 0.85);
  
  const xTrain = tf.tensor2d(features.slice(0, splitIdx));
  const yTrain = tf.tensor1d(labels.slice(0, splitIdx));
  const xVal = tf.tensor2d(features.slice(splitIdx, valIdx));
  const yVal = tf.tensor1d(labels.slice(splitIdx, valIdx));
  const xTest = tf.tensor2d(features.slice(valIdx));
  const yTest = tf.tensor1d(labels.slice(valIdx));
  
  console.log(chalk.cyan(`📊 Train: ${splitIdx}, Val: ${valIdx - splitIdx}, Test: ${features.length - valIdx}`));
  
  // Build optimized model
  console.log(chalk.yellow('\n🧠 Building optimized neural network...'));
  
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [features[0].length],
        units: 256,
        activation: 'relu',
        kernelInitializer: 'heNormal',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
      }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.4 }),
      
      tf.layers.dense({
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
      }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.3 }),
      
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.2 }),
      
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
  
  // Compile with optimal settings
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // Custom callback for better monitoring
  let bestValAcc = 0;
  let patience = 0;
  const maxPatience = 20;
  
  console.log(chalk.yellow('\n🚀 Training model...'));
  
  for (let epoch = 0; epoch < 100; epoch++) {
    const history = await model.fit(xTrain, yTrain, {
      validationData: [xVal, yVal],
      epochs: 1,
      batchSize: 64,
      verbose: 0
    });
    
    const trainAcc = history.history.acc[0] as number;
    const valAcc = history.history.val_acc[0] as number;
    const loss = history.history.loss[0] as number;
    
    if (epoch % 5 === 0 || valAcc > bestValAcc) {
      console.log(
        `Epoch ${epoch + 1} - ` +
        chalk.yellow(`loss: ${loss.toFixed(4)} - `) +
        chalk.green(`acc: ${(trainAcc * 100).toFixed(2)}% - `) +
        chalk.blue(`val_acc: ${(valAcc * 100).toFixed(2)}%`) +
        (valAcc > bestValAcc ? chalk.magenta(' ← Best!') : '')
      );
    }
    
    if (valAcc > bestValAcc) {
      bestValAcc = valAcc;
      patience = 0;
      // Save best model
      await model.save(`file://${path.join(process.cwd(), 'models', 'production_best')}`);
    } else {
      patience++;
      if (patience >= maxPatience) {
        console.log(chalk.yellow(`\nEarly stopping at epoch ${epoch + 1}`));
        break;
      }
    }
  }
  
  // Load best model
  const bestModel = await tf.loadLayersModel(`file://${path.join(process.cwd(), 'models', 'production_best', 'model.json')}`) as tf.Sequential;
  
  // Recompile the loaded model
  bestModel.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // Final evaluation
  const testEval = bestModel.evaluate(xTest, yTest) as tf.Tensor[];
  const testAcc = await testEval[1].data();
  
  console.log(chalk.green.bold(`\n🎯 FINAL TEST ACCURACY: ${(testAcc[0] * 100).toFixed(2)}%`));
  
  // Save metadata
  const metadata = {
    accuracy: testAcc[0],
    trainingSamples: features.length,
    features: features[0].length,
    trainTime: (Date.now() - startTime) / 1000,
    timestamp: new Date().toISOString(),
    dataStats: {
      totalGames: games.length,
      playerStats: playerStats.length,
      injuries: injuries.length,
      weather: weather.length,
      sentiment: sentiment.length
    }
  };
  
  await fs.writeFile(
    path.join(process.cwd(), 'models', 'production_best', 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // Cleanup
  xTrain.dispose();
  yTrain.dispose();
  xVal.dispose();
  yVal.dispose();
  xTest.dispose();
  yTest.dispose();
  testEval.forEach(t => t.dispose());
  
  console.log(chalk.blue.bold(`\n✨ Training complete in ${metadata.trainTime.toFixed(1)}s`));
}

function updateTeamStats(game: any, homeStats: TeamStats, awayStats: TeamStats) {
  const homeWon = game.home_score > game.away_score;
  
  // Update basic stats
  homeStats.games++;
  awayStats.games++;
  homeStats.pointsFor += game.home_score;
  awayStats.pointsFor += game.away_score;
  homeStats.pointsAgainst += game.away_score;
  awayStats.pointsAgainst += game.home_score;
  
  if (homeWon) {
    homeStats.wins++;
    awayStats.losses++;
    homeStats.homeRecord.wins++;
    awayStats.awayRecord.losses++;
    
    // Update streaks
    if (homeStats.streakType === 'W') {
      homeStats.streakLength++;
    } else {
      homeStats.streakType = 'W';
      homeStats.streakLength = 1;
    }
    
    if (awayStats.streakType === 'L') {
      awayStats.streakLength++;
    } else {
      awayStats.streakType = 'L';
      awayStats.streakLength = 1;
    }
  } else {
    homeStats.losses++;
    awayStats.wins++;
    homeStats.homeRecord.losses++;
    awayStats.awayRecord.wins++;
    
    // Update streaks
    if (homeStats.streakType === 'L') {
      homeStats.streakLength++;
    } else {
      homeStats.streakType = 'L';
      homeStats.streakLength = 1;
    }
    
    if (awayStats.streakType === 'W') {
      awayStats.streakLength++;
    } else {
      awayStats.streakType = 'W';
      awayStats.streakLength = 1;
    }
  }
  
  // Update recent form
  homeStats.last5.push(homeWon ? 1 : 0);
  homeStats.last10.push(homeWon ? 1 : 0);
  awayStats.last5.push(homeWon ? 0 : 1);
  awayStats.last10.push(homeWon ? 0 : 1);
  
  if (homeStats.last5.length > 5) homeStats.last5.shift();
  if (homeStats.last10.length > 10) homeStats.last10.shift();
  if (awayStats.last5.length > 5) awayStats.last5.shift();
  if (awayStats.last10.length > 10) awayStats.last10.shift();
}

function getH2HRecord(previousGames: any[], team1: string, team2: string): number {
  let team1Wins = 0;
  let totalGames = 0;
  
  for (const game of previousGames.slice(-20)) { // Last 20 games
    if ((game.home_team_id === team1 && game.away_team_id === team2) ||
        (game.home_team_id === team2 && game.away_team_id === team1)) {
      totalGames++;
      if ((game.home_team_id === team1 && game.home_score > game.away_score) ||
          (game.away_team_id === team1 && game.away_score > game.home_score)) {
        team1Wins++;
      }
    }
  }
  
  return totalGames > 0 ? team1Wins / totalGames : 0.5;
}

function getRestDays(recentGames: any[], teamId: string): number {
  for (let i = recentGames.length - 1; i >= 0; i--) {
    const game = recentGames[i];
    if (game.home_team_id === teamId || game.away_team_id === teamId) {
      return Math.min((recentGames.length - i) / 10, 1); // Normalized
    }
  }
  return 1; // Max rest
}

function getPlayerStatsFeatures(stats: any[]): number[] {
  if (stats.length === 0) {
    return [0, 0, 0, 0, 0, 0];
  }
  
  const totalPoints = stats.reduce((sum, s) => sum + (s.points || 0), 0);
  const totalRebounds = stats.reduce((sum, s) => sum + (s.rebounds || 0), 0);
  const totalAssists = stats.reduce((sum, s) => sum + (s.assists || 0), 0);
  const maxPoints = Math.max(...stats.map(s => s.points || 0));
  
  return [
    totalPoints / 200, // Normalized
    totalRebounds / 100,
    totalAssists / 50,
    maxPoints / 50,
    stats.length / 20, // Number of players
    stats.filter(s => (s.points || 0) > 20).length / 5 // Star players
  ];
}

function getSentimentScore(sentimentMap: Map<string, any>, teamId: string): number {
  const sentiment = sentimentMap.get(teamId);
  if (!sentiment || sentiment.count === 0) return 0;
  return Math.tanh(sentiment.total / sentiment.count);
}

// Run training
trainProductionModel().catch(console.error);