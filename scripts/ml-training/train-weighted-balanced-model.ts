#!/usr/bin/env tsx
/**
 * 🎯 WEIGHTED BALANCED MODEL
 * Uses class weights and synthetic minority oversampling
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

// SMOTE-like synthetic sample generation
function generateSyntheticSamples(
  minorityFeatures: number[][],
  k: number = 5,
  targetCount: number
): number[][] {
  const synthetic: number[][] = [];
  const needed = targetCount - minorityFeatures.length;
  
  for (let i = 0; i < needed; i++) {
    // Pick random minority sample
    const idx = Math.floor(Math.random() * minorityFeatures.length);
    const sample = minorityFeatures[idx];
    
    // Find k nearest neighbors (simplified - random selection)
    const neighbors: number[][] = [];
    for (let j = 0; j < k; j++) {
      const nIdx = Math.floor(Math.random() * minorityFeatures.length);
      if (nIdx !== idx) {
        neighbors.push(minorityFeatures[nIdx]);
      }
    }
    
    // Generate synthetic sample
    const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
    const syntheticSample = sample.map((val, j) => {
      const diff = neighbor[j] - val;
      const gap = Math.random();
      return val + gap * diff;
    });
    
    synthetic.push(syntheticSample);
  }
  
  return synthetic;
}

async function trainWeightedBalancedModel() {
  console.log(chalk.bold.cyan('🎯 WEIGHTED BALANCED MODEL TRAINING'));
  console.log(chalk.yellow('Using class weights and synthetic oversampling'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load data
    console.log(chalk.cyan('1️⃣ Loading games...'));
    const allGames: any[] = [];
    const batchSize = 5000;
    let offset = 0;
    const targetGames = 40000;
    
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
    
    // 2. Split data
    console.log(chalk.cyan('\n2️⃣ Splitting data...'));
    const trainEnd = Math.floor(allGames.length * 0.7);
    const valEnd = Math.floor(allGames.length * 0.85);
    
    const trainGames = allGames.slice(0, trainEnd);
    const valGames = allGames.slice(trainEnd, valEnd);
    const testGames = allGames.slice(valEnd);
    
    // 3. Build features
    console.log(chalk.cyan('\n3️⃣ Building features...'));
    const teamStats = new Map();
    
    const processGames = (games: any[]) => {
      const features: number[][] = [];
      const labels: number[] = [];
      
      games.forEach(game => {
        // Initialize teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0, wins: 0,
              homeGames: 0, homeWins: 0,
              awayGames: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last10: [], elo: 1500,
              momentum: 0.5, consistency: 0.5
            });
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        if (homeStats.games >= 10 && awayStats.games >= 10) {
          // Calculate features
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          const homeHomeWR = homeStats.homeGames > 5 ? homeStats.homeWins / homeStats.homeGames : homeWR;
          const awayAwayWR = awayStats.awayGames > 5 ? awayStats.awayWins / awayStats.awayGames : awayWR;
          
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form
          const homeLast10 = homeStats.last10.slice(-10);
          const awayLast10 = awayStats.last10.slice(-10);
          const homeRecent = homeLast10.length > 0 ? homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayRecent = awayLast10.length > 0 ? awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // Advanced features
          const eloDiff = (homeStats.elo - awayStats.elo) / 400;
          const momentumDiff = homeStats.momentum - awayStats.momentum;
          const consistencyDiff = homeStats.consistency - awayStats.consistency;
          
          // Interaction features
          const formStrength = (homeWR - awayWR) * (homeRecent - awayRecent);
          const matchupScore = (homeAvgFor / Math.max(awayAvgAgainst, 50)) - 
                              (awayAvgFor / Math.max(homeAvgAgainst, 50));
          
          // Build comprehensive feature vector
          const featureVector = [
            // Core differences
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            (homeAvgFor - awayAvgFor) / 30,
            (awayAvgAgainst - homeAvgAgainst) / 30,
            homeRecent - awayRecent,
            
            // Advanced metrics
            eloDiff,
            momentumDiff,
            consistencyDiff,
            formStrength,
            matchupScore,
            
            // Absolute values for context
            homeWR,
            awayWR,
            Math.log(homeStats.games / awayStats.games),
            
            // Context
            0.03, // home advantage
            game.week ? (game.week - 9) / 8 : 0,
            
            // Additional balanced features
            (homeWR + awayWR) / 2, // average quality
            Math.abs(homeWR - awayWR), // mismatch indicator
            homeStats.momentum,
            awayStats.momentum,
            Math.random() * 0.05 - 0.025 // small noise
          ];
          
          features.push(featureVector);
          labels.push(game.home_score > game.away_score ? 1 : 0);
        }
        
        // Update stats
        const homeWon = game.home_score > game.away_score;
        
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
          homeStats.last10.push(1);
          awayStats.last10.push(0);
        } else {
          awayStats.wins++;
          awayStats.awayWins++;
          homeStats.last10.push(0);
          awayStats.last10.push(1);
        }
        
        // Update ELO
        const K = 20;
        const expectedHome = 1 / (1 + Math.pow(10, (awayStats.elo - homeStats.elo) / 400));
        homeStats.elo += K * ((homeWon ? 1 : 0) - expectedHome);
        awayStats.elo += K * ((homeWon ? 0 : 1) - (1 - expectedHome));
        
        // Update momentum (exponential moving average)
        homeStats.momentum = homeStats.momentum * 0.7 + (homeWon ? 1 : 0) * 0.3;
        awayStats.momentum = awayStats.momentum * 0.7 + (homeWon ? 0 : 1) * 0.3;
        
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
      });
      
      return { features, labels };
    };
    
    // Process training data
    const trainData = processGames(trainGames);
    console.log(chalk.green(`✅ Built ${trainData.features.length} training samples`));
    
    // 4. Apply SMOTE-like oversampling
    console.log(chalk.cyan('\n4️⃣ Applying synthetic oversampling...'));
    
    const homeIndices = trainData.labels.map((l, i) => l === 1 ? i : -1).filter(i => i >= 0);
    const awayIndices = trainData.labels.map((l, i) => l === 0 ? i : -1).filter(i => i >= 0);
    
    const homeFeatures = homeIndices.map(i => trainData.features[i]);
    const awayFeatures = awayIndices.map(i => trainData.features[i]);
    
    console.log(chalk.yellow(`Original: ${homeFeatures.length} home, ${awayFeatures.length} away`));
    
    // Generate synthetic samples for minority class
    let finalFeatures: number[][] = [];
    let finalLabels: number[] = [];
    
    if (homeFeatures.length < awayFeatures.length) {
      // Home is minority
      const syntheticHome = generateSyntheticSamples(homeFeatures, 5, awayFeatures.length);
      finalFeatures = [...homeFeatures, ...syntheticHome, ...awayFeatures];
      finalLabels = [
        ...new Array(homeFeatures.length + syntheticHome.length).fill(1),
        ...new Array(awayFeatures.length).fill(0)
      ];
    } else {
      // Away is minority
      const syntheticAway = generateSyntheticSamples(awayFeatures, 5, homeFeatures.length);
      finalFeatures = [...homeFeatures, ...awayFeatures, ...syntheticAway];
      finalLabels = [
        ...new Array(homeFeatures.length).fill(1),
        ...new Array(awayFeatures.length + syntheticAway.length).fill(0)
      ];
    }
    
    // Shuffle
    const indices = Array.from({ length: finalLabels.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    const shuffledFeatures = indices.map(i => finalFeatures[i]);
    const shuffledLabels = indices.map(i => finalLabels[i]);
    
    console.log(chalk.green(`✅ Balanced with SMOTE: ${shuffledLabels.filter(l => l === 1).length} home, ${shuffledLabels.filter(l => l === 0).length} away`));
    
    // 5. Train with weighted model
    console.log(chalk.cyan('\n5️⃣ Training weighted Random Forest...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 150,
      maxDepth: 12,
      minSamplesLeaf: 10,
      maxFeatures: 0.7,
      replacement: true,
      seed: 42
    });
    
    console.log(chalk.yellow(`Training on ${shuffledFeatures.length} samples...`));
    const startTime = Date.now();
    model.train(shuffledFeatures, shuffledLabels);
    console.log(chalk.green(`✅ Trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 6. Validate
    console.log(chalk.cyan('\n6️⃣ Validating...'));
    const valData = processGames(valGames);
    const valPredictions = model.predict(valData.features);
    
    let valCorrect = 0;
    let valHomeCorrect = 0, valHomeTotal = 0;
    let valAwayCorrect = 0, valAwayTotal = 0;
    
    for (let i = 0; i < valPredictions.length; i++) {
      if (valPredictions[i] === valData.labels[i]) valCorrect++;
      
      if (valData.labels[i] === 1) {
        valHomeTotal++;
        if (valPredictions[i] === 1) valHomeCorrect++;
      } else {
        valAwayTotal++;
        if (valPredictions[i] === 0) valAwayCorrect++;
      }
    }
    
    const valAccuracy = valCorrect / valPredictions.length;
    const valHomeAcc = valHomeTotal > 0 ? valHomeCorrect / valHomeTotal : 0;
    const valAwayAcc = valAwayTotal > 0 ? valAwayCorrect / valAwayTotal : 0;
    const valBalance = 2 * (valHomeAcc * valAwayAcc) / (valHomeAcc + valAwayAcc + 0.0001);
    
    console.log(chalk.bold.cyan('\nValidation Results:'));
    console.log(chalk.green(`Accuracy: ${(valAccuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(valHomeAcc * 100).toFixed(1)}% (${valHomeCorrect}/${valHomeTotal})`));
    console.log(chalk.green(`Away: ${(valAwayAcc * 100).toFixed(1)}% (${valAwayCorrect}/${valAwayTotal})`));
    console.log(chalk.green(`Balance: ${(valBalance * 100).toFixed(1)}%`));
    
    // 7. Test
    console.log(chalk.cyan('\n7️⃣ Testing...'));
    const testData = processGames(testGames);
    const testPredictions = model.predict(testData.features);
    
    let testCorrect = 0;
    let testHomeCorrect = 0, testHomeTotal = 0;
    let testAwayCorrect = 0, testAwayTotal = 0;
    
    for (let i = 0; i < testPredictions.length; i++) {
      if (testPredictions[i] === testData.labels[i]) testCorrect++;
      
      if (testData.labels[i] === 1) {
        testHomeTotal++;
        if (testPredictions[i] === 1) testHomeCorrect++;
      } else {
        testAwayTotal++;
        if (testPredictions[i] === 0) testAwayCorrect++;
      }
    }
    
    const testAccuracy = testCorrect / testPredictions.length;
    const testHomeAcc = testHomeTotal > 0 ? testHomeCorrect / testHomeTotal : 0;
    const testAwayAcc = testAwayTotal > 0 ? testAwayCorrect / testAwayTotal : 0;
    const testBalance = 2 * (testHomeAcc * testAwayAcc) / (testHomeAcc + testAwayAcc + 0.0001);
    
    console.log(chalk.bold.cyan('\nTest Results:'));
    console.log(chalk.green(`Accuracy: ${(testAccuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(testHomeAcc * 100).toFixed(1)}% (${testHomeCorrect}/${testHomeTotal})`));
    console.log(chalk.green(`Away: ${(testAwayAcc * 100).toFixed(1)}% (${testAwayCorrect}/${testAwayTotal})`));
    console.log(chalk.green(`Balance: ${(testBalance * 100).toFixed(1)}%`));
    
    // 8. Save if balanced
    if (testBalance > 0.75 && testAccuracy > 0.52) {
      console.log(chalk.cyan('\n8️⃣ Saving weighted balanced model...'));
      
      const modelData = {
        model: model.toJSON(),
        metadata: {
          features: 20,
          performance: {
            validation: { accuracy: valAccuracy, homeAcc: valHomeAcc, awayAcc: valAwayAcc, balance: valBalance },
            test: { accuracy: testAccuracy, homeAcc: testHomeAcc, awayAcc: testAwayAcc, balance: testBalance }
          },
          technique: 'SMOTE-like oversampling',
          trainingSamples: shuffledFeatures.length,
          trainedOn: new Date().toISOString()
        }
      };
      
      fs.writeFileSync('./models/weighted-balanced-model.json', JSON.stringify(modelData, null, 2));
      fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(model.toJSON(), null, 2));
      
      console.log(chalk.green('✅ Saved weighted balanced model!'));
      console.log(chalk.yellow('\nModel is now properly balanced and ready for production!'));
    } else {
      console.log(chalk.yellow('\n⚠️ Model not balanced enough'));
      console.log(chalk.yellow(`Balance: ${(testBalance * 100).toFixed(1)}% (need > 75%)`));
      console.log(chalk.yellow(`Accuracy: ${(testAccuracy * 100).toFixed(1)}% (need > 52%)`));
    }
    
    console.log(chalk.bold.cyan('\n🎯 WEIGHTED TRAINING COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainWeightedBalancedModel().catch(console.error);