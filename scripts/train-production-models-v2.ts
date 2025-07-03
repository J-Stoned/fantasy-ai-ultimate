#!/usr/bin/env tsx
/**
 * 🚀 TRAIN PRODUCTION ML MODELS V2 - WITH PLAYER STATS 🚀
 * 
 * Enhanced version that uses player-level statistics
 * Target: 60-65% accuracy (up from 51-56%)
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

interface GameWithEnhancedStats {
  game: any;
  features: number[];
  label: number;
  confidence: number;
}

console.log(chalk.red.bold('\n🚀 PRODUCTION MODEL TRAINING V2 - WITH PLAYER STATS'));
console.log(chalk.red('=================================================\n'));

async function collectEnhancedTrainingData(): Promise<GameWithEnhancedStats[]> {
  console.log(chalk.cyan('📊 Collecting enhanced training data...'));
  
  // Get ALL completed games (not just 5000)
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false });
  
  if (error || !games) {
    console.error(chalk.red('Failed to fetch games'), error);
    return [];
  }
  
  console.log(chalk.green(`✅ Found ${games.length} completed games`));
  
  const trainingData: GameWithEnhancedStats[] = [];
  const teamStatsCache = new Map();
  const playerStatsCache = new Map();
  
  let processedCount = 0;
  let skippedCount = 0;
  
  // Process each game
  for (const game of games) {
    try {
      // Show progress
      processedCount++;
      if (processedCount % 100 === 0) {
        console.log(chalk.gray(`  Processing game ${processedCount}/${games.length}...`));
      }
      
      // Get team stats (original features)
      const homeStats = await getTeamStatsBeforeGame(game.home_team_id, game.start_time, teamStatsCache);
      const awayStats = await getTeamStatsBeforeGame(game.away_team_id, game.start_time, teamStatsCache);
      
      // Get player stats (new features)
      const homePlayerStats = await getTopPlayerStats(game.home_team_id, game.id, game.sport_id, playerStatsCache);
      const awayPlayerStats = await getTopPlayerStats(game.away_team_id, game.id, game.sport_id, playerStatsCache);
      
      // Get contextual features
      const contextFeatures = getGameContextFeatures(game);
      
      // Combine all features (30+ total)
      const features = [
        // Team features (11 original)
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
        
        // Player features (10 new)
        homePlayerStats.topPlayerAvgPoints,
        awayPlayerStats.topPlayerAvgPoints,
        homePlayerStats.starPlayerActive ? 1 : 0,
        awayPlayerStats.starPlayerActive ? 1 : 0,
        homePlayerStats.avgFantasyPoints,
        awayPlayerStats.avgFantasyPoints,
        homePlayerStats.injuryCount / 5, // normalized
        awayPlayerStats.injuryCount / 5,
        homePlayerStats.formTrend, // -1 to 1
        awayPlayerStats.formTrend,
        
        // Context features (5 new)
        ...contextFeatures,
        
        // Head-to-head features (4 new)
        homeStats.h2hWinRate || 0.5,
        homeStats.h2hAvgPointDiff || 0,
        homeStats.streakLength || 0,
        awayStats.streakLength || 0
      ];
      
      // Validate features
      if (features.some(f => isNaN(f) || !isFinite(f))) {
        skippedCount++;
        continue;
      }
      
      // Label: did home team win?
      const label = game.home_score > game.away_score ? 1 : 0;
      
      // Confidence based on data quality
      const confidence = calculateConfidence(homeStats, awayStats, homePlayerStats, awayPlayerStats);
      
      trainingData.push({ game, features, label, confidence });
      
    } catch (error) {
      skippedCount++;
    }
  }
  
  console.log(chalk.green(`✅ Processed ${trainingData.length} games for training`));
  console.log(chalk.yellow(`⚠️  Skipped ${skippedCount} games due to missing data`));
  
  // Show feature stats
  console.log(chalk.cyan('\n📊 Feature Statistics:'));
  console.log(`  Total features: ${trainingData[0]?.features.length || 0}`);
  console.log(`  Games with player data: ${trainingData.filter(d => d.confidence > 0.7).length}`);
  
  // Show label distribution
  const homeWins = trainingData.filter(d => d.label === 1).length;
  const awayWins = trainingData.length - homeWins;
  console.log(chalk.yellow(`\n📊 Label Distribution:`));
  console.log(`  Home wins: ${homeWins} (${(homeWins/trainingData.length*100).toFixed(1)}%)`);
  console.log(`  Away wins: ${awayWins} (${(awayWins/trainingData.length*100).toFixed(1)}%)`);
  
  return trainingData;
}

async function getTopPlayerStats(teamId: number, gameId: number, sportId: string, cache: Map<string, any>) {
  const cacheKey = `${teamId}-${gameId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // Default stats if no player data
  const defaultStats = {
    topPlayerAvgPoints: 15,
    starPlayerActive: true,
    avgFantasyPoints: 100,
    injuryCount: 0,
    formTrend: 0
  };
  
  try {
    // Get player stats for this team in recent games
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select(`
        *,
        players!inner(
          id,
          firstname,
          lastname,
          position,
          team_id
        )
      `)
      .eq('players.team_id', teamId)
      .order('fantasy_points', { ascending: false })
      .limit(50);
    
    if (!playerStats || playerStats.length === 0) {
      cache.set(cacheKey, defaultStats);
      return defaultStats;
    }
    
    // Calculate aggregated stats
    const topPlayers = playerStats.slice(0, 5);
    const avgFantasyPoints = playerStats.reduce((sum, p) => sum + (p.fantasy_points || 0), 0) / playerStats.length;
    const topPlayerAvgPoints = topPlayers.reduce((sum, p) => sum + (p.fantasy_points || 0), 0) / topPlayers.length;
    
    // Simple injury count (would need injury table in real implementation)
    const injuryCount = 0; // TODO: Query injury table
    
    // Form trend (comparing recent vs season average)
    const recentGames = playerStats.slice(0, 10);
    const recentAvg = recentGames.reduce((sum, p) => sum + (p.fantasy_points || 0), 0) / recentGames.length;
    const formTrend = (recentAvg - avgFantasyPoints) / Math.max(avgFantasyPoints, 1);
    
    const stats = {
      topPlayerAvgPoints: topPlayerAvgPoints / 50, // normalize
      starPlayerActive: true, // TODO: Check injury status
      avgFantasyPoints: avgFantasyPoints / 50,
      injuryCount,
      formTrend: Math.max(-1, Math.min(1, formTrend)) // clamp to [-1, 1]
    };
    
    cache.set(cacheKey, stats);
    return stats;
    
  } catch (error) {
    cache.set(cacheKey, defaultStats);
    return defaultStats;
  }
}

function getGameContextFeatures(game: any): number[] {
  const gameDate = new Date(game.start_time);
  const month = gameDate.getMonth();
  const dayOfWeek = gameDate.getDay();
  
  // Sport-specific season progress
  let seasonProgress = 0;
  if (game.sport_id === 'nfl') {
    // NFL: Sept-Feb
    seasonProgress = month >= 8 ? (month - 8) / 5 : (month + 4) / 5;
  } else if (game.sport_id === 'nba') {
    // NBA: Oct-June
    seasonProgress = month >= 9 ? (month - 9) / 8 : (month + 3) / 8;
  } else if (game.sport_id === 'mlb') {
    // MLB: April-Oct
    seasonProgress = (month - 3) / 7;
  }
  
  return [
    seasonProgress, // 0 = start, 1 = end of season
    dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0, // weekend game
    month === 11 || month === 0 ? 1 : 0, // holiday season
    game.attendance ? Math.min(game.attendance / 50000, 1) : 0.5, // normalized attendance
    game.venue ? 0.1 : 0 // has venue info
  ];
}

function calculateConfidence(homeStats: any, awayStats: any, homePlayerStats: any, awayPlayerStats: any): number {
  let confidence = 0.5; // base confidence
  
  // More historical games = higher confidence
  if (homeStats.gameCount > 10) confidence += 0.1;
  if (awayStats.gameCount > 10) confidence += 0.1;
  
  // Player data available = higher confidence
  if (homePlayerStats.topPlayerAvgPoints > 0) confidence += 0.15;
  if (awayPlayerStats.topPlayerAvgPoints > 0) confidence += 0.15;
  
  return Math.min(confidence, 1);
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
      awayWinRate: 0.5,
      gameCount: 0,
      h2hWinRate: 0.5,
      h2hAvgPointDiff: 0,
      streakLength: 0
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
  let currentStreak = 0;
  let streakType = ''; // 'W' or 'L'
  
  previousGames.forEach((game, index) => {
    const isHome = game.home_team_id === teamId;
    const teamScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    
    totalPointsFor += teamScore;
    totalPointsAgainst += oppScore;
    
    const won = teamScore > oppScore;
    
    if (won) {
      wins++;
      if (index < 5) last5Wins++;
      if (isHome) homeWins++;
      else awayWins++;
      
      // Update streak
      if (index === 0) {
        currentStreak = 1;
        streakType = 'W';
      } else if (streakType === 'W') {
        currentStreak++;
      }
    } else {
      losses++;
      
      // Update streak
      if (index === 0) {
        currentStreak = -1;
        streakType = 'L';
      } else if (streakType === 'L') {
        currentStreak--;
      }
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
    awayWinRate: awayGames > 0 ? awayWins / awayGames : 0.5,
    gameCount: previousGames.length,
    h2hWinRate: 0.5, // TODO: Calculate actual h2h
    h2hAvgPointDiff: 0,
    streakLength: currentStreak / 10 // normalize
  };
  
  cache.set(cacheKey, stats);
  return stats;
}

async function trainEnhancedModel(trainingData: GameWithEnhancedStats[]) {
  console.log(chalk.cyan('\n🧠 Training enhanced neural network...'));
  
  // Filter by confidence if desired
  const minConfidence = 0.6;
  const confidentData = trainingData.filter(d => d.confidence >= minConfidence);
  console.log(chalk.yellow(`📊 Using ${confidentData.length} high-confidence games (>=${minConfidence})`));
  
  // Shuffle data
  const shuffled = [...confidentData].sort(() => Math.random() - 0.5);
  
  // Split into train/validation/test (60/20/20)
  const trainSize = Math.floor(shuffled.length * 0.6);
  const valSize = Math.floor(shuffled.length * 0.2);
  
  const trainData = shuffled.slice(0, trainSize);
  const valData = shuffled.slice(trainSize, trainSize + valSize);
  const testData = shuffled.slice(trainSize + valSize);
  
  console.log(chalk.yellow(`📊 Training set: ${trainData.length} games`));
  console.log(chalk.yellow(`📊 Validation set: ${valData.length} games`));
  console.log(chalk.yellow(`📊 Test set: ${testData.length} games`));
  
  // Prepare tensors
  const xTrain = tf.tensor2d(trainData.map(d => d.features));
  const yTrain = tf.tensor1d(trainData.map(d => d.label));
  const xVal = tf.tensor2d(valData.map(d => d.features));
  const yVal = tf.tensor1d(valData.map(d => d.label));
  const xTest = tf.tensor2d(testData.map(d => d.features));
  const yTest = tf.tensor1d(testData.map(d => d.label));
  
  // Build enhanced model with dropout for regularization
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ units: 256, activation: 'relu', inputShape: [xTrain.shape[1]] }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: 128, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 64, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.1 }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' })
    ]
  });
  
  // Compile with Adam optimizer
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  console.log(chalk.cyan('\n📊 Model architecture:'));
  model.summary();
  
  // Train with early stopping
  console.log(chalk.cyan('\n🏋️ Training model...'));
  
  let bestValAccuracy = 0;
  let patienceCounter = 0;
  const patience = 10;
  
  for (let epoch = 0; epoch < 100; epoch++) {
    const history = await model.fit(xTrain, yTrain, {
      epochs: 1,
      validationData: [xVal, yVal],
      verbose: 0
    });
    
    const trainAcc = history.history.acc[0];
    const valAcc = history.history.val_acc[0];
    
    if (epoch % 5 === 0) {
      console.log(chalk.gray(`Epoch ${epoch}: Train acc=${trainAcc.toFixed(3)}, Val acc=${valAcc.toFixed(3)}`));
    }
    
    // Early stopping
    if (valAcc > bestValAccuracy) {
      bestValAccuracy = valAcc;
      patienceCounter = 0;
    } else {
      patienceCounter++;
      if (patienceCounter >= patience) {
        console.log(chalk.yellow(`\n⏹️ Early stopping at epoch ${epoch}`));
        break;
      }
    }
  }
  
  // Evaluate on test set
  console.log(chalk.cyan('\n📊 Evaluating on test set...'));
  const testResult = model.evaluate(xTest, yTest) as tf.Scalar[];
  const testLoss = await testResult[0].data();
  const testAccuracy = await testResult[1].data();
  
  console.log(chalk.green(`\n✅ Test accuracy: ${(testAccuracy[0] * 100).toFixed(2)}%`));
  console.log(chalk.green(`✅ Test loss: ${testLoss[0].toFixed(4)}`));
  
  // Feature importance analysis (simple version)
  console.log(chalk.cyan('\n📊 Feature importance (approximate):'));
  await analyzeFeatureImportance(model, xTest, yTest);
  
  // Save model
  const modelDir = path.join(process.cwd(), 'models', 'enhanced-v2');
  await model.save(`file://${modelDir}`);
  console.log(chalk.green(`\n✅ Model saved to ${modelDir}`));
  
  // Save metadata
  const metadata = {
    version: '2.0',
    features: 30,
    trainedAt: new Date().toISOString(),
    accuracy: testAccuracy[0],
    totalGames: trainingData.length,
    trainSize: trainData.length,
    testSize: testData.length,
    featureNames: [
      'home_win_rate', 'away_win_rate', 'win_rate_diff',
      'home_avg_points_for', 'away_avg_points_for',
      'home_avg_points_against', 'away_avg_points_against',
      'home_last5_form', 'away_last5_form',
      'home_home_win_rate', 'away_away_win_rate',
      'home_top_player_avg', 'away_top_player_avg',
      'home_star_active', 'away_star_active',
      'home_avg_fantasy', 'away_avg_fantasy',
      'home_injury_count', 'away_injury_count',
      'home_form_trend', 'away_form_trend',
      'season_progress', 'is_weekend', 'is_holiday',
      'attendance_normalized', 'has_venue',
      'h2h_win_rate', 'h2h_point_diff',
      'home_streak', 'away_streak'
    ]
  };
  
  fs.writeFileSync(
    path.join(modelDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // Cleanup
  xTrain.dispose();
  yTrain.dispose();
  xVal.dispose();
  yVal.dispose();
  xTest.dispose();
  yTest.dispose();
  testResult.forEach(t => t.dispose());
  
  return model;
}

async function analyzeFeatureImportance(model: tf.LayersModel, xTest: tf.Tensor2d, yTest: tf.Tensor1d) {
  // Simple permutation importance
  const baselinePreds = model.predict(xTest) as tf.Tensor;
  const baselineAcc = tf.metrics.binaryAccuracy(yTest, baselinePreds.round()).dataSync()[0];
  
  const featureNames = [
    'home_win_rate', 'away_win_rate', 'win_rate_diff',
    'home_top_player_avg', 'away_top_player_avg',
    'home_star_active', 'away_star_active'
  ];
  
  const importances: { name: string; importance: number }[] = [];
  
  for (let i = 0; i < Math.min(7, xTest.shape[1]); i++) {
    // Permute feature i
    const permuted = xTest.arraySync();
    const column = permuted.map(row => row[i]).sort(() => Math.random() - 0.5);
    permuted.forEach((row, idx) => row[i] = column[idx]);
    
    const xPermuted = tf.tensor2d(permuted);
    const permutedPreds = model.predict(xPermuted) as tf.Tensor;
    const permutedAcc = tf.metrics.binaryAccuracy(yTest, permutedPreds.round()).dataSync()[0];
    
    const importance = baselineAcc - permutedAcc;
    importances.push({ 
      name: featureNames[i] || `feature_${i}`, 
      importance 
    });
    
    xPermuted.dispose();
    permutedPreds.dispose();
  }
  
  // Sort by importance
  importances.sort((a, b) => b.importance - a.importance);
  
  console.log('\nTop features by importance:');
  importances.slice(0, 5).forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name}: ${(f.importance * 100).toFixed(2)}%`);
  });
  
  baselinePreds.dispose();
}

// Main execution
async function main() {
  try {
    const trainingData = await collectEnhancedTrainingData();
    
    if (trainingData.length < 100) {
      console.error(chalk.red('❌ Not enough training data. Need at least 100 games.'));
      return;
    }
    
    await trainEnhancedModel(trainingData);
    
    console.log(chalk.green.bold('\n✨ Training complete! Enhanced model ready for production.'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log('1. Test predictions with: npx tsx scripts/test-enhanced-predictions.ts');
    console.log('2. Deploy to production: npx tsx scripts/deploy-enhanced-model.ts');
    
  } catch (error) {
    console.error(chalk.red('❌ Training failed:'), error);
  }
}

main();