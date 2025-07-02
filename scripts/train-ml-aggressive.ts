#!/usr/bin/env tsx
/**
 * 🚀 AGGRESSIVE ML TRAINING - USE ALL DATA
 * 
 * This script aggressively uses ALL available data
 * to achieve 75%+ accuracy by:
 * - Using simpler features that work with all games
 * - Not requiring historical data
 * - Focusing on what we actually have
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

async function trainAggressively() {
  console.log(chalk.red.bold('\n🔥 AGGRESSIVE ML TRAINING - USING ALL DATA!\n'));
  
  const startTime = Date.now();
  
  // 1. Load ALL games with pagination
  console.log(chalk.yellow('📊 Loading ALL games with pagination...'));
  
  const allGames = [];
  const pageSize = 10000;
  let page = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('created_at', { ascending: true });
      
    if (!batch || batch.length === 0) break;
    
    allGames.push(...batch);
    console.log(chalk.gray(`  Loaded batch ${page + 1}: ${batch.length} games (total: ${allGames.length})`));
    
    if (batch.length < pageSize) break;
    page++;
  }
  
  const games = allGames;
  console.log(chalk.green(`✅ Loaded ${games.length} games total!`));
  
  // 2. Load player stats grouped by game
  console.log(chalk.yellow('📊 Loading player stats...'));
  
  const allPlayerStats = [];
  page = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('player_stats')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (!batch || batch.length === 0) break;
    
    allPlayerStats.push(...batch);
    
    if (batch.length < pageSize) break;
    page++;
  }
  
  const playerStats = allPlayerStats;
  console.log(chalk.green(`✅ Loaded ${playerStats.length} player stats`));
    
  // Group by game
  const statsByGame = new Map<string, any[]>();
  playerStats?.forEach(stat => {
    if (!statsByGame.has(stat.game_id)) {
      statsByGame.set(stat.game_id, []);
    }
    statsByGame.get(stat.game_id)!.push(stat);
  });
  
  console.log(chalk.green(`✅ Loaded stats for ${statsByGame.size} games`));
  
  // 3. Build features for EVERY game
  console.log(chalk.yellow('🔧 Building features for ALL games...'));
  
  const features: number[][] = [];
  const labels: number[] = [];
  const gameIds: string[] = [];
  
  // Team stats accumulator
  const teamStats = new Map<string, {
    games: number;
    wins: number;
    losses: number;
    totalPointsFor: number;
    totalPointsAgainst: number;
    last5: boolean[];
  }>();
  
  // Process EVERY game
  for (const game of games || []) {
    // Initialize team stats if needed
    if (!teamStats.has(game.home_team_id)) {
      teamStats.set(game.home_team_id, {
        games: 0, wins: 0, losses: 0, 
        totalPointsFor: 0, totalPointsAgainst: 0,
        last5: []
      });
    }
    if (!teamStats.has(game.away_team_id)) {
      teamStats.set(game.away_team_id, {
        games: 0, wins: 0, losses: 0,
        totalPointsFor: 0, totalPointsAgainst: 0,
        last5: []
      });
    }
    
    const homeStats = teamStats.get(game.home_team_id)!;
    const awayStats = teamStats.get(game.away_team_id)!;
    
    // Extract features (even with no history)
    const gameFeatures = extractFeatures(
      game,
      homeStats,
      awayStats,
      statsByGame.get(game.id) || []
    );
    
    features.push(gameFeatures);
    labels.push(game.home_score > game.away_score ? 1 : 0);
    gameIds.push(game.id);
    
    // Update team stats AFTER using them
    const homeWon = game.home_score > game.away_score;
    
    homeStats.games++;
    homeStats.totalPointsFor += game.home_score;
    homeStats.totalPointsAgainst += game.away_score;
    homeStats.last5.push(homeWon);
    if (homeStats.last5.length > 5) homeStats.last5.shift();
    if (homeWon) homeStats.wins++; else homeStats.losses++;
    
    awayStats.games++;
    awayStats.totalPointsFor += game.away_score;
    awayStats.totalPointsAgainst += game.home_score;
    awayStats.last5.push(!homeWon);
    if (awayStats.last5.length > 5) awayStats.last5.shift();
    if (!homeWon) awayStats.wins++; else awayStats.losses++;
  }
  
  console.log(chalk.green(`✅ Created ${features.length} training samples!`));
  
  // 4. Split data 70/15/15
  const trainEnd = Math.floor(features.length * 0.7);
  const valEnd = Math.floor(features.length * 0.85);
  
  const xTrain = tf.tensor2d(features.slice(0, trainEnd));
  const yTrain = tf.tensor1d(labels.slice(0, trainEnd));
  const xVal = tf.tensor2d(features.slice(trainEnd, valEnd));
  const yVal = tf.tensor1d(labels.slice(trainEnd, valEnd));
  const xTest = tf.tensor2d(features.slice(valEnd));
  const yTest = tf.tensor1d(labels.slice(valEnd));
  
  console.log(chalk.green(`✅ Train: ${trainEnd} | Val: ${valEnd - trainEnd} | Test: ${features.length - valEnd}`));
  
  // 5. Build DEEP model
  console.log(chalk.yellow('\n🧠 Building DEEP neural network...'));
  
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({
    inputShape: [features[0].length],
    units: 256,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.batchNormalization());
  
  // Hidden layers
  model.add(tf.layers.dense({
    units: 128,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.batchNormalization());
  
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu'
  }));
  
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu'
  }));
  
  // Output
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  // 6. Train with callbacks
  console.log(chalk.yellow('\n🏋️ Training on ALL data...'));
  
  let bestAccuracy = 0;
  
  await model.fit(xTrain, yTrain, {
    epochs: 100,
    batchSize: 128,
    validationData: [xVal, yVal],
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        if (logs?.val_acc && logs.val_acc > bestAccuracy) {
          bestAccuracy = logs.val_acc;
          await model.save(`file://${path.join(process.cwd(), 'models/aggressive_best')}`);
        }
        
        if (epoch % 5 === 0) {
          console.log(
            chalk.gray(`Epoch ${epoch + 1}/100 - `) +
            chalk.yellow(`loss: ${logs?.loss?.toFixed(4)} - `) +
            chalk.green(`acc: ${(logs?.acc! * 100).toFixed(2)}% - `) +
            chalk.blue(`val_acc: ${(logs?.val_acc! * 100).toFixed(2)}%`)
          );
        }
      }
    }
  });
  
  // 7. Load best and evaluate
  const bestModel = await tf.loadLayersModel(`file://${path.join(process.cwd(), 'models/aggressive_best/model.json')}`);
  bestModel.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  const evaluation = bestModel.evaluate(xTest, yTest) as tf.Tensor[];
  const testAccuracy = (await evaluation[1].data())[0];
  
  console.log(chalk.green.bold(`\n🎯 FINAL TEST ACCURACY: ${(testAccuracy * 100).toFixed(2)}%`));
  
  // 8. Save final model
  const modelPath = path.join(process.cwd(), 'models/production_aggressive');
  await fs.mkdir(modelPath, { recursive: true });
  await bestModel.save(`file://${modelPath}`);
  
  // Save metadata
  await fs.writeFile(
    path.join(modelPath, 'metadata.json'),
    JSON.stringify({
      accuracy: testAccuracy,
      trainingSamples: features.length,
      features: features[0].length,
      trainTime: (Date.now() - startTime) / 1000,
      timestamp: new Date().toISOString()
    }, null, 2)
  );
  
  // Clean up
  xTrain.dispose();
  yTrain.dispose();
  xVal.dispose();
  yVal.dispose();
  xTest.dispose();
  yTest.dispose();
  evaluation.forEach(t => t.dispose());
  
  console.log(chalk.red.bold(`
🔥 TRAINING COMPLETE!
━━━━━━━━━━━━━━━━━━━━
📊 Samples: ${features.length}
🎯 Accuracy: ${(testAccuracy * 100).toFixed(2)}%
⏱️  Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s
━━━━━━━━━━━━━━━━━━━━
`));
}

function extractFeatures(
  game: any,
  homeStats: any,
  awayStats: any,
  gamePlayerStats: any[]
): number[] {
  const features: number[] = [];
  
  // 1. Basic team performance (with defaults for new teams)
  const homeWinRate = homeStats.games > 0 ? homeStats.wins / homeStats.games : 0.5;
  const awayWinRate = awayStats.games > 0 ? awayStats.wins / awayStats.games : 0.5;
  
  features.push(homeWinRate);
  features.push(awayWinRate);
  features.push(homeWinRate - awayWinRate);
  
  // 2. Scoring averages
  const homeAvgFor = homeStats.games > 0 ? homeStats.totalPointsFor / homeStats.games : 100;
  const homeAvgAgainst = homeStats.games > 0 ? homeStats.totalPointsAgainst / homeStats.games : 100;
  const awayAvgFor = awayStats.games > 0 ? awayStats.totalPointsFor / awayStats.games : 100;
  const awayAvgAgainst = awayStats.games > 0 ? awayStats.totalPointsAgainst / awayStats.games : 100;
  
  features.push(homeAvgFor / 100);
  features.push(homeAvgAgainst / 100);
  features.push(awayAvgFor / 100);
  features.push(awayAvgAgainst / 100);
  
  // 3. Recent form
  const homeLast5 = homeStats.last5.length > 0 
    ? homeStats.last5.filter(w => w).length / homeStats.last5.length 
    : 0.5;
  const awayLast5 = awayStats.last5.length > 0 
    ? awayStats.last5.filter(w => w).length / awayStats.last5.length 
    : 0.5;
    
  features.push(homeLast5);
  features.push(awayLast5);
  
  // 4. Momentum
  const homeMomentum = calculateMomentum(homeStats.last5);
  const awayMomentum = calculateMomentum(awayStats.last5);
  
  features.push(homeMomentum);
  features.push(awayMomentum);
  
  // 5. Experience
  features.push(Math.min(homeStats.games / 20, 1));
  features.push(Math.min(awayStats.games / 20, 1));
  
  // 6. Player stats features
  const homePlayerStats = gamePlayerStats.filter(ps => ps.team_id === game.home_team_id);
  const awayPlayerStats = gamePlayerStats.filter(ps => ps.team_id === game.away_team_id);
  
  const homeFantasyTotal = homePlayerStats.reduce((sum, ps) => sum + (ps.fantasy_points || 0), 0);
  const awayFantasyTotal = awayPlayerStats.reduce((sum, ps) => sum + (ps.fantasy_points || 0), 0);
  
  features.push(homeFantasyTotal / 100);
  features.push(awayFantasyTotal / 100);
  features.push((homeFantasyTotal - awayFantasyTotal) / 100);
  
  // 7. Time features
  const gameDate = new Date(game.created_at);
  features.push(gameDate.getHours() / 24);
  features.push(gameDate.getDay() / 7);
  features.push(gameDate.getMonth() / 12);
  
  // 8. Is primetime
  features.push(gameDate.getHours() >= 20 || gameDate.getHours() <= 1 ? 1 : 0);
  
  // 9. Days since season start (normalized)
  const seasonStart = new Date(gameDate.getFullYear(), 8, 1); // September 1
  const daysSinceStart = (gameDate.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24);
  features.push(Math.min(daysSinceStart / 200, 1));
  
  return features;
}

function calculateMomentum(last5: boolean[]): number {
  if (last5.length === 0) return 0.5;
  
  let momentum = 0;
  for (let i = 0; i < last5.length; i++) {
    const weight = (i + 1) / last5.length; // More recent = higher weight
    momentum += (last5[i] ? 1 : -1) * weight;
  }
  
  return (momentum + 1) / 2; // Normalize to 0-1
}

// Run training
trainAggressively().catch(console.error);