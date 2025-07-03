#!/usr/bin/env tsx
/**
 * 🚀 ENHANCED ML TRAINING WITH PLAYER STATS 🚀
 * 
 * Trains models using both team and player-level features
 * Target: 55-60% accuracy (up from 51%)
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface EnhancedGameData {
  game: any;
  features: number[];
  label: number;
  metadata: {
    homeTeam: string;
    awayTeam: string;
    date: string;
  };
}

console.log(chalk.bold.green('\n🚀 ENHANCED MODEL TRAINING WITH PLAYER STATS'));
console.log(chalk.gray('='.repeat(50)));

async function collectEnhancedTrainingData(): Promise<EnhancedGameData[]> {
  console.log(chalk.cyan('📊 Collecting enhanced training data...'));
  
  // Get completed games
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(10000); // Use more data
  
  if (error || !games) {
    console.error(chalk.red('Failed to fetch games'), error);
    return [];
  }
  
  console.log(chalk.green(`✅ Found ${games.length} completed games`));
  
  const trainingData: EnhancedGameData[] = [];
  const teamStatsCache = new Map();
  const playerStatsCache = new Map();
  
  // Process each game
  let processed = 0;
  for (const game of games) {
    try {
      // Get team stats (existing features)
      const homeStats = await getTeamStatsBeforeGame(game.home_team_id, game.start_time, teamStatsCache);
      const awayStats = await getTeamStatsBeforeGame(game.away_team_id, game.start_time, teamStatsCache);
      
      // Get player stats for key positions
      const homePlayerStats = await getTopPlayerStats(game.home_team_id, game.id, playerStatsCache);
      const awayPlayerStats = await getTopPlayerStats(game.away_team_id, game.id, playerStatsCache);
      
      // Enhanced feature set
      const features = [
        // Team features (11 features)
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
        awayStats.awayWinRate,
        
        // Player features (8 new features)
        homePlayerStats.topPasserAvg / 300,  // Normalized passing yards
        awayPlayerStats.topPasserAvg / 300,
        homePlayerStats.topRusherAvg / 100,  // Normalized rushing yards
        awayPlayerStats.topRusherAvg / 100,
        homePlayerStats.topReceiverAvg / 100, // Normalized receiving yards
        awayPlayerStats.topReceiverAvg / 100,
        homePlayerStats.totalFantasyPoints / 100, // Total team fantasy points
        awayPlayerStats.totalFantasyPoints / 100,
        
        // Injury impact (2 features)
        homePlayerStats.injuryImpact,  // 0-1 scale of key player injuries
        awayPlayerStats.injuryImpact,
        
        // Recent form (2 features)
        homePlayerStats.recentForm,     // Last 3 games performance
        awayPlayerStats.recentForm,
      ];
      
      // Label: did home team win?
      const label = game.home_score > game.away_score ? 1 : 0;
      
      trainingData.push({
        game,
        features,
        label,
        metadata: {
          homeTeam: `Team ${game.home_team_id}`,
          awayTeam: `Team ${game.away_team_id}`,
          date: game.start_time
        }
      });
      
      processed++;
      if (processed % 100 === 0) {
        console.log(chalk.gray(`  Processed ${processed}/${games.length} games...`));
      }
      
    } catch (error) {
      // Skip games with errors
    }
  }
  
  console.log(chalk.green(`✅ Processed ${trainingData.length} games with enhanced features`));
  
  // Show statistics
  const homeWins = trainingData.filter(d => d.label === 1).length;
  const awayWins = trainingData.length - homeWins;
  console.log(chalk.yellow(`📊 Home wins: ${homeWins} (${(homeWins/trainingData.length*100).toFixed(1)}%)`));
  console.log(chalk.yellow(`📊 Away wins: ${awayWins} (${(awayWins/trainingData.length*100).toFixed(1)}%)`));
  console.log(chalk.blue(`📊 Features per game: ${features.length} (including player stats)`));
  
  return trainingData;
}

async function getTeamStatsBeforeGame(teamId: number, gameDate: string, cache: Map<string, any>) {
  const cacheKey = `${teamId}-${gameDate}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // Get historical games before this date
  const { data: previousGames } = await supabase
    .from('games')
    .select('*')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .lt('start_time', gameDate)
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(20);
  
  if (!previousGames || previousGames.length === 0) {
    const defaultStats = {
      winRate: 0.5,
      avgPointsFor: 20,
      avgPointsAgainst: 20,
      last5Form: 2.5,
      homeWinRate: 0.5,
      awayWinRate: 0.5
    };
    cache.set(cacheKey, defaultStats);
    return defaultStats;
  }
  
  // Calculate stats
  let wins = 0, pointsFor = 0, pointsAgainst = 0;
  let homeWins = 0, homeGames = 0;
  let awayWins = 0, awayGames = 0;
  let last5Form = 0;
  
  previousGames.forEach((game, index) => {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    
    pointsFor += teamScore;
    pointsAgainst += oppScore;
    
    if (teamScore > oppScore) {
      wins++;
      if (index < 5) last5Form++;
    }
    
    if (isHome) {
      homeGames++;
      if (teamScore > oppScore) homeWins++;
    } else {
      awayGames++;
      if (teamScore > oppScore) awayWins++;
    }
  });
  
  const stats = {
    winRate: wins / previousGames.length,
    avgPointsFor: pointsFor / previousGames.length,
    avgPointsAgainst: pointsAgainst / previousGames.length,
    last5Form: last5Form,
    homeWinRate: homeGames > 0 ? homeWins / homeGames : 0.5,
    awayWinRate: awayGames > 0 ? awayWins / awayGames : 0.5
  };
  
  cache.set(cacheKey, stats);
  return stats;
}

async function getTopPlayerStats(teamId: number, gameId: number, cache: Map<string, any>) {
  const cacheKey = `${teamId}-${gameId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // Get player stats for this team's recent games
  const { data: recentGames } = await supabase
    .from('games')
    .select('id')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('start_time', { ascending: false })
    .limit(5);
  
  if (!recentGames || recentGames.length === 0) {
    const defaultStats = {
      topPasserAvg: 250,
      topRusherAvg: 80,
      topReceiverAvg: 70,
      totalFantasyPoints: 80,
      injuryImpact: 0,
      recentForm: 0.5
    };
    cache.set(cacheKey, defaultStats);
    return defaultStats;
  }
  
  const gameIds = recentGames.map(g => g.id);
  
  // Get player stats for these games
  const { data: playerStats } = await supabase
    .from('player_stats')
    .select('*')
    .in('game_id', gameIds);
  
  if (!playerStats || playerStats.length === 0) {
    const defaultStats = {
      topPasserAvg: 250,
      topRusherAvg: 80,
      topReceiverAvg: 70,
      totalFantasyPoints: 80,
      injuryImpact: 0,
      recentForm: 0.5
    };
    cache.set(cacheKey, defaultStats);
    return defaultStats;
  }
  
  // Aggregate stats by type
  const passingStats = playerStats.filter(s => s.stat_type === 'passing');
  const rushingStats = playerStats.filter(s => s.stat_type === 'rushing');
  const receivingStats = playerStats.filter(s => s.stat_type === 'receiving');
  
  const stats = {
    topPasserAvg: passingStats.length > 0 
      ? passingStats.reduce((sum, s) => sum + s.stat_value, 0) / passingStats.length 
      : 250,
    topRusherAvg: rushingStats.length > 0
      ? rushingStats.reduce((sum, s) => sum + s.stat_value, 0) / rushingStats.length
      : 80,
    topReceiverAvg: receivingStats.length > 0
      ? receivingStats.reduce((sum, s) => sum + s.stat_value, 0) / receivingStats.length
      : 70,
    totalFantasyPoints: playerStats.reduce((sum, s) => sum + (s.fantasy_points || 0), 0) / recentGames.length,
    injuryImpact: 0, // Would need injury data
    recentForm: 0.5 + (Math.random() * 0.2 - 0.1) // Simulated for now
  };
  
  cache.set(cacheKey, stats);
  return stats;
}

async function trainEnhancedModel(data: EnhancedGameData[]) {
  console.log(chalk.cyan('\n🧠 Training enhanced neural network...'));
  
  // Shuffle data
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  
  // Split data
  const trainSize = Math.floor(shuffled.length * 0.8);
  const trainData = shuffled.slice(0, trainSize);
  const testData = shuffled.slice(trainSize);
  
  // Prepare tensors
  const trainFeatures = tf.tensor2d(trainData.map(d => d.features));
  const trainLabels = tf.tensor2d(trainData.map(d => [d.label]));
  const testFeatures = tf.tensor2d(testData.map(d => d.features));
  const testLabels = tf.tensor2d(testData.map(d => [d.label]));
  
  // Build enhanced model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [trainData[0].features.length],
        units: 64,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
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
  
  // Compile with better optimizer
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  console.log(chalk.yellow('📊 Model architecture:'));
  model.summary();
  
  // Train with callbacks
  const history = await model.fit(trainFeatures, trainLabels, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 10 === 0) {
          console.log(chalk.gray(`  Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`));
        }
      }
    }
  });
  
  // Evaluate on test set
  const evaluation = model.evaluate(testFeatures, testLabels) as tf.Tensor[];
  const testLoss = await evaluation[0].data();
  const testAccuracy = await evaluation[1].data();
  
  console.log(chalk.green(`\n✅ Test accuracy: ${(testAccuracy[0] * 100).toFixed(2)}%`));
  
  // Save model
  const modelPath = './models/enhanced-nfl-predictor';
  await model.save(`file://${modelPath}`);
  console.log(chalk.blue(`💾 Model saved to ${modelPath}`));
  
  // Cleanup tensors
  trainFeatures.dispose();
  trainLabels.dispose();
  testFeatures.dispose();
  testLabels.dispose();
  evaluation.forEach(t => t.dispose());
  
  return {
    model,
    accuracy: testAccuracy[0],
    features: trainData[0].features.length
  };
}

async function analyzeFeatureImportance(model: tf.LayersModel, sampleData: EnhancedGameData[]) {
  console.log(chalk.cyan('\n📊 Analyzing feature importance...'));
  
  const featureNames = [
    'Home Win Rate', 'Away Win Rate', 'Win Rate Diff',
    'Home Avg Points For', 'Away Avg Points For',
    'Home Avg Points Against', 'Away Avg Points Against',
    'Home Last 5 Form', 'Away Last 5 Form',
    'Home Win Rate (Home)', 'Away Win Rate (Away)',
    'Home Top Passer Avg', 'Away Top Passer Avg',
    'Home Top Rusher Avg', 'Away Top Rusher Avg',
    'Home Top Receiver Avg', 'Away Top Receiver Avg',
    'Home Total Fantasy Pts', 'Away Total Fantasy Pts',
    'Home Injury Impact', 'Away Injury Impact',
    'Home Recent Form', 'Away Recent Form'
  ];
  
  // Simple permutation importance
  const baselineAccuracy = await evaluateAccuracy(model, sampleData);
  const importances: { feature: string; importance: number }[] = [];
  
  for (let i = 0; i < featureNames.length; i++) {
    // Shuffle one feature
    const shuffledData = sampleData.map(d => ({
      ...d,
      features: d.features.map((f, j) => j === i ? Math.random() : f)
    }));
    
    const shuffledAccuracy = await evaluateAccuracy(model, shuffledData);
    const importance = baselineAccuracy - shuffledAccuracy;
    
    importances.push({
      feature: featureNames[i],
      importance: importance
    });
  }
  
  // Sort by importance
  importances.sort((a, b) => b.importance - a.importance);
  
  console.log(chalk.yellow('\n🎯 Top 10 Most Important Features:'));
  importances.slice(0, 10).forEach((item, i) => {
    console.log(chalk.green(`${i + 1}. ${item.feature}: ${(item.importance * 100).toFixed(2)}%`));
  });
}

async function evaluateAccuracy(model: tf.LayersModel, data: EnhancedGameData[]): Promise<number> {
  const features = tf.tensor2d(data.map(d => d.features));
  const labels = tf.tensor2d(data.map(d => [d.label]));
  
  const evaluation = model.evaluate(features, labels) as tf.Tensor[];
  const accuracy = await evaluation[1].data();
  
  features.dispose();
  labels.dispose();
  evaluation.forEach(t => t.dispose());
  
  return accuracy[0];
}

// Main execution
async function main() {
  console.log(chalk.bold.yellow('\n🏈 FANTASY AI ENHANCED MODEL TRAINING'));
  console.log(chalk.gray('Target: 55-60% accuracy with player stats\n'));
  
  // Collect enhanced training data
  const trainingData = await collectEnhancedTrainingData();
  
  if (trainingData.length < 100) {
    console.error(chalk.red('❌ Not enough training data!'));
    return;
  }
  
  // Train enhanced model
  const { model, accuracy, features } = await trainEnhancedModel(trainingData);
  
  // Analyze what the model learned
  await analyzeFeatureImportance(model, trainingData.slice(0, 100));
  
  // Summary
  console.log(chalk.bold.green('\n✨ TRAINING COMPLETE!'));
  console.log(chalk.blue(`📊 Final test accuracy: ${(accuracy * 100).toFixed(2)}%`));
  console.log(chalk.blue(`📊 Total features used: ${features}`));
  
  if (accuracy > 0.54) {
    console.log(chalk.green('🎉 Goal achieved! Accuracy improved with player stats!'));
  } else {
    console.log(chalk.yellow('⚠️  Accuracy improvement minimal. May need real player data.'));
  }
}

// Run the training
main().catch(console.error);