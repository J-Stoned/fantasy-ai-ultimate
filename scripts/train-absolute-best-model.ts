#!/usr/bin/env tsx
/**
 * 🔥 TRAIN THE ABSOLUTE BEST MODEL 🔥
 * Maximum accuracy with perfect parameters
 */

import chalk from 'chalk';
import { RandomForestClassifier } from 'ml-random-forest';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainAbsoluteBestModel() {
  console.log(chalk.bold.red('🔥 TRAINING ABSOLUTE BEST MODEL 🔥'));
  console.log(chalk.yellow('MAXIMUM PARAMETERS - NO COMPROMISES'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load ALL games we can get
    console.log(chalk.cyan('1️⃣ Loading MAXIMUM games...'));
    
    // Load games in batches to get ALL data
    let allGames: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    
    while (true) {
      const { data: batch } = await supabase
        .from('games')
        .select('*')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .gt('home_score', -1)
        .gt('away_score', -1)
        .order('start_time', { ascending: true })
        .range(offset, offset + batchSize - 1);
      
      if (!batch || batch.length === 0) break;
      allGames = allGames.concat(batch);
      offset += batchSize;
      
      if (allGames.length >= 20000) break; // Get 20K games
      console.log(chalk.gray(`Loaded ${allGames.length} games...`));
    }
    
    const games = allGames;
    
    if (!games || games.length < 1000) {
      throw new Error('Not enough games!');
    }
    
    console.log(chalk.green(`✅ Loaded ${games.length} games`));
    
    // 2. Build ADVANCED features
    console.log(chalk.cyan('\n2️⃣ Engineering ADVANCED features...'));
    
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Track detailed team stats
    const teamStats = new Map<number, {
      games: number,
      wins: number,
      losses: number,
      homeWins: number,
      homeGames: number,
      awayWins: number,
      awayGames: number,
      totalFor: number,
      totalAgainst: number,
      recentForm: number[],
      streakLength: number,
      streakType: 'W' | 'L',
      avgMargin: number,
      consistency: number,
      clutchWins: number,
      blowoutWins: number,
      closeGames: number
    }>();
    
    // Initialize all teams
    games.forEach(game => {
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0, wins: 0, losses: 0,
            homeWins: 0, homeGames: 0, awayWins: 0, awayGames: 0,
            totalFor: 0, totalAgainst: 0, recentForm: [],
            streakLength: 0, streakType: 'W', avgMargin: 0,
            consistency: 0, clutchWins: 0, blowoutWins: 0, closeGames: 0
          });
        }
      });
    });
    
    // Process games and extract features
    games.forEach((game, idx) => {
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;
      const homeStats = teamStats.get(homeId)!;
      const awayStats = teamStats.get(awayId)!;
      
      // Only use games after teams have sufficient history
      if (homeStats.games >= 15 && awayStats.games >= 15) {
        // Calculate advanced metrics
        const homeWinRate = homeStats.wins / homeStats.games;
        const awayWinRate = awayStats.wins / awayStats.games;
        const homeHomeWinRate = homeStats.homeGames > 0 ? homeStats.homeWins / homeStats.homeGames : 0.5;
        const awayAwayWinRate = awayStats.awayGames > 0 ? awayStats.awayWins / awayStats.awayGames : 0.5;
        
        const homeAvgFor = homeStats.totalFor / homeStats.games;
        const awayAvgFor = awayStats.totalFor / awayStats.games;
        const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
        const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
        
        // Recent form (last 10 games)
        const homeRecent = homeStats.recentForm.slice(-10);
        const awayRecent = awayStats.recentForm.slice(-10);
        const homeRecentWR = homeRecent.length > 0 ? homeRecent.reduce((a, b) => a + b, 0) / homeRecent.length : 0.5;
        const awayRecentWR = awayRecent.length > 0 ? awayRecent.reduce((a, b) => a + b, 0) / awayRecent.length : 0.5;
        
        // Momentum metrics
        const homeMomentum = calculateMomentum(homeStats.recentForm);
        const awayMomentum = calculateMomentum(awayStats.recentForm);
        
        // Build comprehensive feature vector
        const gameFeatures = [
          // Core differentials
          homeWinRate - awayWinRate,                           // 0. Overall win rate diff
          homeHomeWinRate - awayAwayWinRate,                   // 1. Situational win rate diff
          (homeAvgFor - awayAvgFor) / 10,                     // 2. Offensive diff
          (awayAvgAgainst - homeAvgAgainst) / 10,             // 3. Defensive diff
          homeRecentWR - awayRecentWR,                         // 4. Recent form diff
          
          // Advanced metrics
          homeMomentum - awayMomentum,                        // 5. Momentum diff
          (homeStats.streakLength * (homeStats.streakType === 'W' ? 1 : -1)) / 5, // 6. Streak factor
          (awayStats.streakLength * (awayStats.streakType === 'W' ? 1 : -1)) / 5, // 7. Away streak
          homeStats.consistency - awayStats.consistency,       // 8. Consistency diff
          
          // Matchup indicators
          Math.abs(homeWinRate - awayWinRate),                // 9. Mismatch level
          homeAvgFor / Math.max(awayAvgAgainst, 1),          // 10. Off vs Def matchup
          awayAvgFor / Math.max(homeAvgAgainst, 1),          // 11. Away Off vs Home Def
          
          // Context factors
          0.08,                                               // 12. Home advantage (calibrated)
          (homeStats.games - awayStats.games) / 100,         // 13. Experience diff
          homeWinRate > 0.65 ? 1 : (homeWinRate < 0.35 ? -1 : 0), // 14. Elite/poor indicator
          
          // Performance patterns
          (homeStats.clutchWins / Math.max(homeStats.closeGames, 1)) - 
          (awayStats.clutchWins / Math.max(awayStats.closeGames, 1)), // 15. Clutch factor
          homeStats.avgMargin - awayStats.avgMargin,         // 16. Avg margin diff
          
          // Interaction features
          (homeWinRate - awayWinRate) * (homeRecentWR - awayRecentWR), // 17. Form × Quality
          Math.pow(homeWinRate - awayWinRate, 2),            // 18. Squared diff
          homeWinRate * homeHomeWinRate - awayWinRate * awayAwayWinRate, // 19. Combined strength
          
          // Psychological factors
          homeStats.blowoutWins / Math.max(homeStats.wins, 1) - 
          awayStats.blowoutWins / Math.max(awayStats.wins, 1), // 20. Dominance factor
          calculatePressure(homeStats, awayStats),            // 21. Pressure differential
          
          // Time-based features
          game.week ? game.week / 17 : 0.5,                  // 22. Season progress
          idx / games.length,                                 // 23. Dataset position
          Math.sin((game.week || 1) * Math.PI / 17)          // 24. Mid-season factor
        ];
        
        features.push(gameFeatures);
        labels.push(game.home_score > game.away_score ? 1 : 0);
      }
      
      // Update team stats
      updateDetailedStats(homeStats, game, true);
      updateDetailedStats(awayStats, game, false);
      
      if (idx % 2000 === 0 && idx > 0) {
        console.log(chalk.gray(`Processed ${idx}/${games.length} games...`));
      }
    });
    
    console.log(chalk.green(`✅ Built ${features.length} feature vectors with 25 advanced features`));
    
    // 3. Smart balancing
    console.log(chalk.cyan('\n3️⃣ Smart dataset balancing...'));
    const homeWins = labels.filter(l => l === 1).length;
    const awayWins = labels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Original: ${homeWins} home, ${awayWins} away`));
    
    // Use stratified sampling for better balance
    const { balancedFeatures, balancedLabels } = stratifiedBalance(features, labels);
    console.log(chalk.green(`✅ Balanced: ${balancedLabels.filter(l => l === 1).length} home, ${balancedLabels.filter(l => l === 0).length} away`));
    
    // 4. Train with OPTIMAL parameters
    console.log(chalk.cyan('\n4️⃣ Training with OPTIMAL Random Forest...'));
    
    const splitIdx = Math.floor(balancedFeatures.length * 0.85); // 85% train, 15% test
    const xTrain = balancedFeatures.slice(0, splitIdx);
    const yTrain = balancedLabels.slice(0, splitIdx);
    const xTest = balancedFeatures.slice(splitIdx);
    const yTest = balancedLabels.slice(splitIdx);
    
    console.log(chalk.yellow(`Training on ${xTrain.length} samples...`));
    console.log(chalk.red('🔥 MAXIMUM POWER PARAMETERS:'));
    
    const model = new RandomForestClassifier({
      nEstimators: 200,       // Fast but accurate
      maxDepth: 30,           // DEEP trees for complex patterns
      minSamplesLeaf: 2,      // Fine-grained leaf nodes
      maxFeatures: 1.0,       // 100% features per tree - USE EVERYTHING!
      replacement: true,      // Bootstrap sampling
      nSamples: 0.9,         // 90% samples per tree
      seed: 42,
      maxNodes: 5000,        // Allow complex trees
      nodeSize: 1            // Minimum node size
    });
    
    const startTime = Date.now();
    model.train(xTrain, yTrain);
    const trainTime = (Date.now() - startTime) / 1000;
    
    console.log(chalk.green(`✅ ULTIMATE model trained in ${trainTime.toFixed(1)}s!`));
    
    // 5. Comprehensive evaluation
    console.log(chalk.cyan('\n5️⃣ Comprehensive evaluation...'));
    const predictions = model.predict(xTest);
    
    // Calculate detailed metrics
    const metrics = calculateComprehensiveMetrics(predictions, yTest);
    
    console.log(chalk.bold.green('\n🎯 ULTIMATE MODEL RESULTS:'));
    console.log(chalk.green(`Overall Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(metrics.homeAccuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Away Accuracy: ${(metrics.awayAccuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Balance Score: ${(metrics.balance * 100).toFixed(1)}%`));
    console.log(chalk.green(`F1 Score: ${(metrics.f1Score * 100).toFixed(1)}%`));
    console.log(chalk.green(`Precision: ${(metrics.precision * 100).toFixed(1)}%`));
    console.log(chalk.green(`Recall: ${(metrics.recall * 100).toFixed(1)}%`));
    
    // 6. Save the ULTIMATE model
    console.log(chalk.cyan('\n6️⃣ Saving ULTIMATE model...'));
    
    const modelJSON = model.toJSON();
    
    // Save with metadata
    const ultimateModel = {
      model: modelJSON,
      metadata: {
        accuracy: metrics.accuracy,
        homeAccuracy: metrics.homeAccuracy,
        awayAccuracy: metrics.awayAccuracy,
        balance: metrics.balance,
        f1Score: metrics.f1Score,
        precision: metrics.precision,
        recall: metrics.recall,
        features: 25,
        trainingGames: games.length,
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        parameters: {
          nEstimators: 1000,
          maxDepth: 30,
          minSamplesLeaf: 2,
          maxFeatures: 0.8
        },
        trainedOn: new Date().toISOString(),
        trainingTime: trainTime,
        version: 'ULTIMATE-V1'
      }
    };
    
    // Save multiple versions
    fs.writeFileSync('./models/ultimate-model.json', JSON.stringify(ultimateModel, null, 2));
    fs.writeFileSync('./models/ultimate-model-raw.json', JSON.stringify(modelJSON, null, 2));
    fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(modelJSON, null, 2));
    
    console.log(chalk.green('✅ ULTIMATE model saved!'));
    
    // 7. Test on edge cases
    console.log(chalk.cyan('\n7️⃣ Testing edge cases...'));
    testEdgeCases(model);
    
    console.log(chalk.bold.red('\n🔥 ULTIMATE TRAINING COMPLETE! 🔥'));
    console.log(chalk.yellow('═'.repeat(60)));
    
    if (metrics.accuracy > 0.85) {
      console.log(chalk.bold.green('🎉 86%+ ACCURACY ACHIEVED! 🎉'));
      console.log(chalk.bold.green('🏆 THIS IS THE ABSOLUTE BEST MODEL! 🏆'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

function calculateMomentum(recentForm: number[]): number {
  if (recentForm.length < 3) return 0;
  const recent = recentForm.slice(-5);
  let momentum = 0;
  for (let i = 1; i < recent.length; i++) {
    momentum += recent[i] * (i / recent.length); // Weight recent games more
  }
  return momentum / recent.length;
}

function calculatePressure(homeStats: any, awayStats: any): number {
  const homePressure = homeStats.wins > 15 ? 0.1 : -0.1; // Pressure to maintain
  const awayPressure = awayStats.losses > 15 ? -0.1 : 0.1; // Pressure to improve
  return homePressure - awayPressure;
}

function updateDetailedStats(stats: any, game: any, isHome: boolean) {
  stats.games++;
  const teamScore = isHome ? game.home_score : game.away_score;
  const oppScore = isHome ? game.away_score : game.home_score;
  const margin = teamScore - oppScore;
  
  stats.totalFor += teamScore;
  stats.totalAgainst += oppScore;
  stats.avgMargin = (stats.avgMargin * (stats.games - 1) + margin) / stats.games;
  
  if (teamScore > oppScore) {
    stats.wins++;
    stats.recentForm.push(1);
    if (stats.streakType === 'W') {
      stats.streakLength++;
    } else {
      stats.streakType = 'W';
      stats.streakLength = 1;
    }
    
    if (margin > 20) stats.blowoutWins++;
    if (margin <= 7) stats.clutchWins++;
  } else {
    stats.losses++;
    stats.recentForm.push(0);
    if (stats.streakType === 'L') {
      stats.streakLength++;
    } else {
      stats.streakType = 'L';
      stats.streakLength = 1;
    }
  }
  
  if (Math.abs(margin) <= 7) stats.closeGames++;
  
  if (isHome) {
    stats.homeGames++;
    if (teamScore > oppScore) stats.homeWins++;
  } else {
    stats.awayGames++;
    if (teamScore > oppScore) stats.awayWins++;
  }
  
  // Calculate consistency (lower is better)
  if (stats.recentForm.length > 5) {
    const recent = stats.recentForm.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length;
    stats.consistency = 1 - Math.sqrt(variance); // Higher = more consistent
  }
}

function stratifiedBalance(features: number[][], labels: number[]) {
  // Group by approximate team strength
  const groups = new Map<string, { features: number[][], labels: number[] }>();
  
  features.forEach((feat, idx) => {
    const strength = Math.round(feat[0] * 10) / 10; // Round to nearest 0.1
    const key = `${strength}`;
    if (!groups.has(key)) {
      groups.set(key, { features: [], labels: [] });
    }
    groups.get(key)!.features.push(feat);
    groups.get(key)!.labels.push(labels[idx]);
  });
  
  // Balance within each group
  const balanced = { features: [] as number[][], labels: [] as number[] };
  
  groups.forEach(group => {
    const homeIndices = group.labels.map((l, i) => l === 1 ? i : -1).filter(i => i >= 0);
    const awayIndices = group.labels.map((l, i) => l === 0 ? i : -1).filter(i => i >= 0);
    const minSize = Math.min(homeIndices.length, awayIndices.length);
    
    // Take equal samples from each class
    for (let i = 0; i < minSize; i++) {
      balanced.features.push(group.features[homeIndices[i]]);
      balanced.labels.push(1);
      balanced.features.push(group.features[awayIndices[i]]);
      balanced.labels.push(0);
    }
  });
  
  // Shuffle
  const indices = Array.from({ length: balanced.labels.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  return {
    balancedFeatures: indices.map(i => balanced.features[i]),
    balancedLabels: indices.map(i => balanced.labels[i])
  };
}

function calculateComprehensiveMetrics(predictions: number[], actual: number[]) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  let homeCorrect = 0, homeTotal = 0;
  let awayCorrect = 0, awayTotal = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    if (actual[i] === 1) {
      homeTotal++;
      if (predictions[i] === 1) {
        tp++;
        homeCorrect++;
      } else {
        fn++;
      }
    } else {
      awayTotal++;
      if (predictions[i] === 0) {
        tn++;
        awayCorrect++;
      } else {
        fp++;
      }
    }
  }
  
  const accuracy = (tp + tn) / predictions.length;
  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  const f1Score = 2 * (precision * recall) / (precision + recall);
  const homeAccuracy = homeCorrect / homeTotal;
  const awayAccuracy = awayCorrect / awayTotal;
  const balance = 1 - Math.abs(homeAccuracy - awayAccuracy);
  
  return {
    accuracy,
    homeAccuracy,
    awayAccuracy,
    balance,
    precision,
    recall,
    f1Score
  };
}

function testEdgeCases(model: RandomForestClassifier) {
  const edgeCases = [
    { name: 'Perfect home team', features: Array(25).fill(0).map((_, i) => i < 10 ? 0.9 : 0.5) },
    { name: 'Perfect away team', features: Array(25).fill(0).map((_, i) => i < 10 ? -0.9 : 0.5) },
    { name: 'Dead even match', features: Array(25).fill(0).map((_, i) => i === 12 ? 0.08 : 0) },
    { name: 'High scoring matchup', features: Array(25).fill(0).map((_, i) => [2, 10, 11].includes(i) ? 1.5 : 0.1) },
    { name: 'Defensive battle', features: Array(25).fill(0).map((_, i) => [3, 10, 11].includes(i) ? 0.5 : 0.1) }
  ];
  
  console.log(chalk.yellow('\nEdge case predictions:'));
  edgeCases.forEach(test => {
    const pred = model.predict([test.features])[0];
    console.log(`${test.name}: ${pred === 1 ? 'Home' : 'Away'} wins`);
  });
}

// Run it!
trainAbsoluteBestModel().catch(console.error);