#!/usr/bin/env tsx
/**
 * 🎯 ADVANCED BALANCED MODEL
 * Properly balanced complex model with all the fixes
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

// Feature scaler to normalize all features to same range
class StandardScaler {
  private means: number[] = [];
  private stds: number[] = [];
  
  fit(X: number[][]) {
    const n_features = X[0].length;
    this.means = new Array(n_features).fill(0);
    this.stds = new Array(n_features).fill(0);
    
    // Calculate means
    for (const row of X) {
      for (let j = 0; j < n_features; j++) {
        this.means[j] += row[j];
      }
    }
    for (let j = 0; j < n_features; j++) {
      this.means[j] /= X.length;
    }
    
    // Calculate standard deviations
    for (const row of X) {
      for (let j = 0; j < n_features; j++) {
        this.stds[j] += Math.pow(row[j] - this.means[j], 2);
      }
    }
    for (let j = 0; j < n_features; j++) {
      this.stds[j] = Math.sqrt(this.stds[j] / X.length);
      // Prevent division by zero
      if (this.stds[j] === 0) this.stds[j] = 1;
    }
  }
  
  transform(X: number[][]) {
    return X.map(row => 
      row.map((val, j) => (val - this.means[j]) / this.stds[j])
    );
  }
  
  fitTransform(X: number[][]) {
    this.fit(X);
    return this.transform(X);
  }
}

async function trainAdvancedBalancedModel() {
  console.log(chalk.bold.cyan('🎯 ADVANCED BALANCED MODEL TRAINING'));
  console.log(chalk.yellow('Using all techniques to ensure balance'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load substantial data
    console.log(chalk.cyan('1️⃣ Loading games with batching...'));
    
    const allGames: any[] = [];
    const batchSize = 5000;
    let offset = 0;
    const targetGames = 25000; // Good amount for training
    
    while (offset < targetGames) {
      const { data: batch } = await supabase
        .from('games')
        .select('*')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: true })
        .range(offset, offset + batchSize - 1);
      
      if (!batch || batch.length === 0) break;
      
      allGames.push(...batch);
      console.log(chalk.gray(`Loaded ${allGames.length} games...`));
      offset += batchSize;
    }
    
    console.log(chalk.green(`✅ Loaded ${allGames.length} total games`));
    
    // 2. Split chronologically with validation set
    console.log(chalk.cyan('\n2️⃣ Splitting data properly...'));
    const trainEnd = Math.floor(allGames.length * 0.6);
    const valEnd = Math.floor(allGames.length * 0.8);
    
    const trainGames = allGames.slice(0, trainEnd);
    const valGames = allGames.slice(trainEnd, valEnd);
    const testGames = allGames.slice(valEnd);
    
    console.log(chalk.yellow(`Training: ${trainGames.length} games`));
    console.log(chalk.yellow(`Validation: ${valGames.length} games`));
    console.log(chalk.yellow(`Testing: ${testGames.length} games`));
    
    // 3. Build COMPREHENSIVE features
    console.log(chalk.cyan('\n3️⃣ Building comprehensive features...'));
    
    const teamStats = new Map();
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    
    // Process all games to build features
    const processGames = (games: any[], startIdx: number = 0) => {
      const features: number[][] = [];
      const labels: number[] = [];
      
      games.forEach((game, idx) => {
        // Initialize teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              homeGames: 0,
              homeWins: 0,
              awayGames: 0,
              awayWins: 0,
              totalFor: 0,
              totalAgainst: 0,
              last10: [],
              last5Home: [],
              last5Away: [],
              elo: 1500,
              form: 0.5,
              consistency: 0,
              momentum: 0
            });
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        // Need enough history
        if (homeStats.games >= 10 && awayStats.games >= 10) {
          // Basic rates
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          const homeHomeWR = homeStats.homeGames > 5 ? homeStats.homeWins / homeStats.homeGames : homeWR;
          const awayAwayWR = awayStats.awayGames > 5 ? awayStats.awayWins / awayStats.awayGames : awayWR;
          
          // Scoring
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form
          const homeLast10 = homeStats.last10.slice(-10);
          const awayLast10 = awayStats.last10.slice(-10);
          const homeRecent = homeLast10.length > 0 ? homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayRecent = awayLast10.length > 0 ? awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // Momentum (weighted recent)
          let homeMomentum = 0;
          let awayMomentum = 0;
          homeLast10.forEach((result, i) => {
            homeMomentum += result * (i + 1) / homeLast10.length;
          });
          awayLast10.forEach((result, i) => {
            awayMomentum += result * (i + 1) / awayLast10.length;
          });
          
          // Build feature vector with CAREFUL ENGINEERING
          const featureVector = [
            // DIFFERENCE features (these work best)
            homeWR - awayWR,                                    // 0
            homeHomeWR - awayAwayWR,                            // 1
            (homeAvgFor - awayAvgFor) / 30,                    // 2 (normalized)
            (awayAvgAgainst - homeAvgAgainst) / 30,            // 3
            homeRecent - awayRecent,                            // 4
            
            // RATIO features (prevent dominance)
            homeWR / (awayWR + 0.1),                            // 5
            homeAvgFor / (awayAvgFor + 50),                    // 6
            
            // ABSOLUTE features (provide context)
            homeWR,                                             // 7
            awayWR,                                             // 8
            
            // ENGINEERED features
            (homeStats.elo - awayStats.elo) / 400,             // 9
            homeMomentum - awayMomentum,                        // 10
            Math.abs(homeWR - 0.5) - Math.abs(awayWR - 0.5),   // 11 (distance from average)
            
            // INTERACTION features
            (homeWR - awayWR) * (homeRecent - awayRecent),     // 12
            
            // CONTEXT features
            0.03,                                               // 13 (small home advantage)
            game.week ? (game.week - 8.5) / 8.5 : 0,           // 14 (season timing, centered)
            
            // RANDOMNESS (prevents overfitting)
            Math.random() * 0.1 - 0.05,                        // 15
            
            // Additional balanced features
            homeStats.consistency - awayStats.consistency,      // 16
            (homeStats.form - awayStats.form),                 // 17
            homeLast10.filter(x => x === 1).length / 10,       // 18 (recent win rate)
            awayLast10.filter(x => x === 1).length / 10        // 19
          ];
          
          features.push(featureVector);
          labels.push(game.home_score > game.away_score ? 1 : 0);
        }
        
        // Update team stats AFTER feature extraction
        updateTeamStats(homeStats, awayStats, game);
        
        if ((startIdx + idx) % 5000 === 0 && idx > 0) {
          console.log(chalk.gray(`Processed ${startIdx + idx} games total...`));
        }
      });
      
      return { features, labels };
    };
    
    // Process training data
    const trainData = processGames(trainGames);
    console.log(chalk.green(`✅ Built ${trainData.features.length} training samples`));
    
    // 4. SCALE features to prevent dominance
    console.log(chalk.cyan('\n4️⃣ Scaling features...'));
    const scaler = new StandardScaler();
    const scaledTrainFeatures = scaler.fitTransform(trainData.features);
    
    // 5. ADVANCED balancing with stratification
    console.log(chalk.cyan('\n5️⃣ Advanced balancing...'));
    
    // Group by feature similarity
    const groups = new Map<string, { features: number[][], labels: number[] }>();
    
    scaledTrainFeatures.forEach((features, idx) => {
      // Group by win rate difference (main predictor)
      const winRateDiff = features[0];
      const groupKey = Math.round(winRateDiff * 5) / 5; // Round to nearest 0.2
      
      if (!groups.has(groupKey.toString())) {
        groups.set(groupKey.toString(), { features: [], labels: [] });
      }
      
      const group = groups.get(groupKey.toString())!;
      group.features.push(features);
      group.labels.push(trainData.labels[idx]);
    });
    
    // Balance within each group
    const balancedFeatures: number[][] = [];
    const balancedLabels: number[] = [];
    
    groups.forEach((group, key) => {
      const homeIndices = group.labels.map((l, i) => l === 1 ? i : -1).filter(i => i >= 0);
      const awayIndices = group.labels.map((l, i) => l === 0 ? i : -1).filter(i => i >= 0);
      
      const minSize = Math.min(homeIndices.length, awayIndices.length);
      
      // Take equal from each class
      for (let i = 0; i < minSize; i++) {
        balancedFeatures.push(group.features[homeIndices[i]]);
        balancedLabels.push(1);
        balancedFeatures.push(group.features[awayIndices[i]]);
        balancedLabels.push(0);
      }
    });
    
    // Shuffle
    const indices = Array.from({ length: balancedLabels.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    const finalFeatures = indices.map(i => balancedFeatures[i]);
    const finalLabels = indices.map(i => balancedLabels[i]);
    
    console.log(chalk.green(`✅ Balanced: ${finalLabels.filter(l => l === 1).length} home, ${finalLabels.filter(l => l === 0).length} away`));
    
    // 6. Train with CAREFUL parameters
    console.log(chalk.cyan('\n6️⃣ Training with anti-overfitting parameters...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 100,           // Not too many trees
      maxDepth: 10,               // Limited depth
      minSamplesLeaf: 20,         // Higher minimum to generalize
      maxFeatures: 0.5,           // Only use half features per tree
      replacement: true,
      useSampleBagging: true,     // Bootstrap samples
      nSamples: 0.8,              // Use 80% of samples per tree
      seed: 42
    });
    
    console.log(chalk.yellow(`Training on ${finalFeatures.length} balanced samples...`));
    const startTime = Date.now();
    model.train(finalFeatures, finalLabels);
    console.log(chalk.green(`✅ Trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 7. Validate on validation set
    console.log(chalk.cyan('\n7️⃣ Validating...'));
    const valData = processGames(valGames, trainGames.length);
    const scaledValFeatures = scaler.transform(valData.features);
    
    const valPredictions = model.predict(scaledValFeatures);
    const valMetrics = evaluateModel(valPredictions, valData.labels, 'Validation');
    
    // 8. Test on test set
    console.log(chalk.cyan('\n8️⃣ Final testing...'));
    const testData = processGames(testGames, trainGames.length + valGames.length);
    const scaledTestFeatures = scaler.transform(testData.features);
    
    const testPredictions = model.predict(scaledTestFeatures);
    const testMetrics = evaluateModel(testPredictions, testData.labels, 'Test');
    
    // 9. Save if truly balanced
    const isBalanced = testMetrics.homeAcc > 0.3 && testMetrics.awayAcc > 0.3 && 
                      testMetrics.balance > 0.7 && testMetrics.accuracy > 0.52;
    
    if (isBalanced) {
      console.log(chalk.cyan('\n9️⃣ Saving balanced model...'));
      
      const modelData = {
        model: model.toJSON(),
        scaler: {
          means: scaler['means'],
          stds: scaler['stds']
        },
        metadata: {
          features: 20,
          performance: {
            validation: valMetrics,
            test: testMetrics
          },
          balanced: true,
          trainingSamples: finalFeatures.length,
          trainedOn: new Date().toISOString()
        }
      };
      
      fs.writeFileSync('./models/advanced-balanced-model.json', JSON.stringify(modelData, null, 2));
      fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(model.toJSON(), null, 2));
      
      console.log(chalk.green('✅ Saved advanced balanced model!'));
    } else {
      console.log(chalk.yellow('\n⚠️ Model not balanced enough:'));
      console.log(chalk.yellow(`Need: Home > 30%, Away > 30%, Balance > 70%, Accuracy > 52%`));
      console.log(chalk.yellow(`Got: Home ${(testMetrics.homeAcc * 100).toFixed(1)}%, Away ${(testMetrics.awayAcc * 100).toFixed(1)}%, Balance ${(testMetrics.balance * 100).toFixed(1)}%, Accuracy ${(testMetrics.accuracy * 100).toFixed(1)}%`));
    }
    
    console.log(chalk.bold.cyan('\n🎯 ADVANCED TRAINING COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

function updateTeamStats(homeStats: any, awayStats: any, game: any) {
  const homeWon = game.home_score > game.away_score;
  const margin = Math.abs(game.home_score - game.away_score);
  
  // Update basic stats
  homeStats.games++;
  awayStats.games++;
  homeStats.homeGames++;
  awayStats.awayGames++;
  homeStats.totalFor += game.home_score;
  homeStats.totalAgainst += game.away_score;
  awayStats.totalFor += game.away_score;
  awayStats.totalAgainst += game.home_score;
  
  if (homeWon) {
    homeStats.wins++;
    homeStats.homeWins++;
    awayStats.losses++;
    homeStats.last10.push(1);
    awayStats.last10.push(0);
    homeStats.last5Home.push(1);
    awayStats.last5Away.push(0);
  } else {
    homeStats.losses++;
    awayStats.wins++;
    awayStats.awayWins++;
    homeStats.last10.push(0);
    awayStats.last10.push(1);
    homeStats.last5Home.push(0);
    awayStats.last5Away.push(1);
  }
  
  // Update ELO
  const K = 20 + (margin / 10); // Dynamic K based on margin
  const expectedHome = 1 / (1 + Math.pow(10, (awayStats.elo - homeStats.elo) / 400));
  homeStats.elo += K * ((homeWon ? 1 : 0) - expectedHome);
  awayStats.elo += K * ((homeWon ? 0 : 1) - (1 - expectedHome));
  
  // Update form (exponential moving average)
  homeStats.form = homeStats.form * 0.8 + (homeWon ? 1 : 0) * 0.2;
  awayStats.form = awayStats.form * 0.8 + (homeWon ? 0 : 1) * 0.2;
  
  // Update consistency
  if (homeStats.last10.length >= 5) {
    const recent = homeStats.last10.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length;
    homeStats.consistency = 1 - Math.sqrt(variance);
  }
  
  if (awayStats.last10.length >= 5) {
    const recent = awayStats.last10.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length;
    awayStats.consistency = 1 - Math.sqrt(variance);
  }
  
  // Maintain list sizes
  if (homeStats.last10.length > 10) homeStats.last10.shift();
  if (awayStats.last10.length > 10) awayStats.last10.shift();
  if (homeStats.last5Home.length > 5) homeStats.last5Home.shift();
  if (awayStats.last5Away.length > 5) awayStats.last5Away.shift();
}

function evaluateModel(predictions: number[], actual: number[], name: string) {
  let correct = 0;
  let homeCorrect = 0, homeTotal = 0;
  let awayCorrect = 0, awayTotal = 0;
  
  // Confusion matrix
  let tp = 0, tn = 0, fp = 0, fn = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] === actual[i]) correct++;
    
    if (actual[i] === 1) {
      homeTotal++;
      if (predictions[i] === 1) {
        homeCorrect++;
        tp++;
      } else {
        fn++;
      }
    } else {
      awayTotal++;
      if (predictions[i] === 0) {
        awayCorrect++;
        tn++;
      } else {
        fp++;
      }
    }
  }
  
  const accuracy = correct / predictions.length;
  const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
  const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
  const balance = 2 * (homeAcc * awayAcc) / (homeAcc + awayAcc + 0.0001); // Harmonic mean
  
  const precision = tp > 0 ? tp / (tp + fp) : 0;
  const recall = tp > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  console.log(chalk.bold.cyan(`\n${name} Results:`));
  console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
  console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
  console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
  console.log(chalk.green(`Balance: ${(balance * 100).toFixed(1)}% (harmonic mean)`));
  console.log(chalk.gray(`F1 Score: ${(f1 * 100).toFixed(1)}%`));
  console.log(chalk.gray(`Confusion Matrix: TP=${tp}, TN=${tn}, FP=${fp}, FN=${fn}`));
  
  return { accuracy, homeAcc, awayAcc, balance, precision, recall, f1 };
}

trainAdvancedBalancedModel().catch(console.error);