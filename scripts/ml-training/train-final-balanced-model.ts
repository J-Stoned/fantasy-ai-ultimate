#!/usr/bin/env tsx
/**
 * 🎯 FINAL BALANCED MODEL TRAINER
 * Loads ALL data properly and trains a truly balanced model
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

async function trainFinalBalancedModel() {
  console.log(chalk.bold.cyan('🎯 FINAL BALANCED MODEL TRAINING'));
  console.log(chalk.yellow('Loading ALL data with proper batching'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Get total count
    console.log(chalk.cyan('1️⃣ Checking available data...'));
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    console.log(chalk.green(`✅ Found ${count} games with scores`));
    
    // 2. Load games in batches
    console.log(chalk.cyan('\n2️⃣ Loading games in batches...'));
    const allGames: any[] = [];
    const batchSize = 5000;
    let offset = 0;
    const maxGames = 30000; // Limit for training
    
    while (offset < Math.min(count || 0, maxGames)) {
      const { data: batch, error } = await supabase
        .from('games')
        .select('*')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: true })
        .range(offset, Math.min(offset + batchSize - 1, maxGames - 1));
      
      if (error) {
        console.error(chalk.red('Error loading batch:'), error);
        break;
      }
      
      if (batch) {
        allGames.push(...batch);
        console.log(chalk.gray(`Loaded ${allGames.length}/${Math.min(count || 0, maxGames)} games...`));
      }
      
      offset += batchSize;
    }
    
    console.log(chalk.green(`✅ Loaded ${allGames.length} total games`));
    
    // 3. Split chronologically
    console.log(chalk.cyan('\n3️⃣ Splitting data chronologically...'));
    const trainSize = Math.floor(allGames.length * 0.7);
    const valSize = Math.floor(allGames.length * 0.15);
    
    const trainGames = allGames.slice(0, trainSize);
    const valGames = allGames.slice(trainSize, trainSize + valSize);
    const testGames = allGames.slice(trainSize + valSize);
    
    console.log(chalk.yellow(`Training: ${trainGames.length} games`));
    console.log(chalk.yellow(`Validation: ${valGames.length} games`));
    console.log(chalk.yellow(`Testing: ${testGames.length} games`));
    
    // 4. Build features with proper statistics
    console.log(chalk.cyan('\n4️⃣ Building features...'));
    
    const teamStats = new Map();
    
    // Initialize all teams
    allGames.forEach(game => {
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0, wins: 0, losses: 0,
            homeGames: 0, homeWins: 0,
            awayGames: 0, awayWins: 0,
            totalFor: 0, totalAgainst: 0,
            last10: [], last5Home: [], last5Away: [],
            elo: 1500
          });
        }
      });
    });
    
    // Process games and extract features
    const extractFeatures = (games: any[], updateStats: boolean = true) => {
      const features: number[][] = [];
      const labels: number[] = [];
      
      games.forEach((game, idx) => {
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        if (homeStats && awayStats && homeStats.games >= 10 && awayStats.games >= 10) {
          // Calculate win rates
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          const homeHomeWR = homeStats.homeGames > 5 ? homeStats.homeWins / homeStats.homeGames : homeWR;
          const awayAwayWR = awayStats.awayGames > 5 ? awayStats.awayWins / awayStats.awayGames : awayWR;
          
          // Scoring averages
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form
          const homeLast10 = homeStats.last10.slice(-10);
          const awayLast10 = awayStats.last10.slice(-10);
          const homeRecent = homeLast10.length > 0 ? homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayRecent = awayLast10.length > 0 ? awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // Home/away specific form
          const homeHomeLast5 = homeStats.last5Home.slice(-5);
          const awayAwayLast5 = awayStats.last5Away.slice(-5);
          const homeHomeForm = homeHomeLast5.length > 0 ? homeHomeLast5.reduce((a, b) => a + b, 0) / homeHomeLast5.length : 0.5;
          const awayAwayForm = awayAwayLast5.length > 0 ? awayAwayLast5.reduce((a, b) => a + b, 0) / awayAwayLast5.length : 0.5;
          
          // Build feature vector (15 features to match model)
          const featureVector = [
            // Core features
            homeWR - awayWR,                                      // 0. Overall win rate diff
            (homeAvgFor - awayAvgFor) / 10,                     // 1. Scoring diff (normalized)
            (awayAvgAgainst - homeAvgAgainst) / 10,             // 2. Defense diff (normalized)
            homeRecent - awayRecent,                             // 3. Recent form diff
            
            // Situational features
            homeHomeWR - awayAwayWR,                             // 4. Situational win rate diff
            homeHomeForm - awayAwayForm,                         // 5. Situational form diff
            
            // ELO and advanced
            (homeStats.elo - awayStats.elo) / 400,              // 6. ELO diff (normalized)
            homeLast10.slice(-3).filter(v => v === 1).length / 3 - 
            awayLast10.slice(-3).filter(v => v === 1).length / 3, // 7. Very recent form
            
            // Experience
            Math.log(homeStats.games + 1) - Math.log(awayStats.games + 1), // 8. Experience diff (log scale)
            
            // Matchup features
            homeAvgFor / Math.max(awayAvgAgainst, 50),          // 9. Offensive matchup
            awayAvgFor / Math.max(homeAvgAgainst, 50),          // 10. Away offensive matchup
            
            // Net ratings
            (homeAvgFor - homeAvgAgainst) / 10,                 // 11. Home net rating
            (awayAvgFor - awayAvgAgainst) / 10,                 // 12. Away net rating
            
            // Context
            0.025,                                               // 13. Small home advantage
            game.week ? (game.week - 9) / 8 : 0                 // 14. Season timing (-1 to 1)
          ];
          
          features.push(featureVector);
          labels.push(game.home_score > game.away_score ? 1 : 0);
        }
        
        // Update stats if requested
        if (updateStats) {
          const homeWon = game.home_score > game.away_score;
          
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
          const K = 20;
          const expectedHome = 1 / (1 + Math.pow(10, (awayStats.elo - homeStats.elo) / 400));
          homeStats.elo += K * ((homeWon ? 1 : 0) - expectedHome);
          awayStats.elo += K * ((homeWon ? 0 : 1) - (1 - expectedHome));
          
          // Maintain list sizes
          if (homeStats.last10.length > 10) homeStats.last10.shift();
          if (awayStats.last10.length > 10) awayStats.last10.shift();
          if (homeStats.last5Home.length > 5) homeStats.last5Home.shift();
          if (awayStats.last5Away.length > 5) awayStats.last5Away.shift();
        }
        
        if (idx % 5000 === 0 && idx > 0) {
          console.log(chalk.gray(`Processed ${idx}/${games.length} games...`));
        }
      });
      
      return { features, labels };
    };
    
    // Extract training features
    const trainData = extractFeatures(trainGames, true);
    console.log(chalk.green(`✅ Built ${trainData.features.length} training samples`));
    
    // 5. Balance training data
    console.log(chalk.cyan('\n5️⃣ Balancing training data...'));
    
    const homeIndices = trainData.labels.map((l, i) => l === 1 ? i : -1).filter(i => i >= 0);
    const awayIndices = trainData.labels.map((l, i) => l === 0 ? i : -1).filter(i => i >= 0);
    
    console.log(chalk.yellow(`Original: ${homeIndices.length} home, ${awayIndices.length} away`));
    
    // Take equal samples
    const minSize = Math.min(homeIndices.length, awayIndices.length);
    const balancedIndices = [];
    
    // Stratified sampling
    for (let i = 0; i < minSize; i++) {
      balancedIndices.push(homeIndices[i]);
      balancedIndices.push(awayIndices[i]);
    }
    
    // Shuffle
    for (let i = balancedIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [balancedIndices[i], balancedIndices[j]] = [balancedIndices[j], balancedIndices[i]];
    }
    
    const balancedFeatures = balancedIndices.map(i => trainData.features[i]);
    const balancedLabels = balancedIndices.map(i => trainData.labels[i]);
    
    console.log(chalk.green(`✅ Balanced: ${balancedLabels.filter(l => l === 1).length} home, ${balancedLabels.filter(l => l === 0).length} away`));
    
    // 6. Train model
    console.log(chalk.cyan('\n6️⃣ Training Random Forest...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 200,        // Good balance
      maxDepth: 15,            // Reasonable depth
      minSamplesLeaf: 8,       // Prevent overfitting
      maxFeatures: 0.8,        // Use 80% of features
      replacement: true,
      seed: 42
    });
    
    console.log(chalk.yellow(`Training on ${balancedFeatures.length} balanced samples...`));
    const startTime = Date.now();
    model.train(balancedFeatures, balancedLabels);
    const trainTime = (Date.now() - startTime) / 1000;
    console.log(chalk.green(`✅ Model trained in ${trainTime.toFixed(1)}s`));
    
    // 7. Validate on validation set
    console.log(chalk.cyan('\n7️⃣ Validating model...'));
    const valData = extractFeatures(valGames, true);
    console.log(chalk.yellow(`Validating on ${valData.features.length} games...`));
    
    const valPredictions = model.predict(valData.features);
    const valMetrics = calculateMetrics(valPredictions, valData.labels, 'Validation');
    
    // 8. Test on test set
    console.log(chalk.cyan('\n8️⃣ Testing on holdout set...'));
    const testData = extractFeatures(testGames, true);
    console.log(chalk.yellow(`Testing on ${testData.features.length} games...`));
    
    const testPredictions = model.predict(testData.features);
    const testMetrics = calculateMetrics(testPredictions, testData.labels, 'Test');
    
    // 9. Save if balanced and accurate
    if (testMetrics.balance > 0.7 && testMetrics.accuracy > 0.55) {
      console.log(chalk.cyan('\n9️⃣ Saving balanced model...'));
      
      const modelJSON = model.toJSON();
      fs.writeFileSync('./models/final-balanced-model.json', JSON.stringify(modelJSON, null, 2));
      fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(modelJSON, null, 2));
      
      // Save metadata
      const metadata = {
        model: modelJSON,
        performance: {
          validation: valMetrics,
          test: testMetrics
        },
        training: {
          totalGames: allGames.length,
          trainingSamples: balancedFeatures.length,
          features: 15,
          parameters: {
            nEstimators: 200,
            maxDepth: 15,
            minSamplesLeaf: 8,
            maxFeatures: 0.8
          }
        },
        trainedOn: new Date().toISOString()
      };
      
      fs.writeFileSync('./models/final-balanced-metadata.json', JSON.stringify(metadata, null, 2));
      console.log(chalk.green('✅ Saved final balanced model!'));
    } else {
      console.log(chalk.yellow('\n⚠️ Model not balanced/accurate enough'));
      console.log(chalk.yellow(`Balance: ${(testMetrics.balance * 100).toFixed(1)}% (need > 70%)`));
      console.log(chalk.yellow(`Accuracy: ${(testMetrics.accuracy * 100).toFixed(1)}% (need > 55%)`));
    }
    
    console.log(chalk.bold.cyan('\n🎯 TRAINING COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

function calculateMetrics(predictions: number[], actual: number[], name: string) {
  let correct = 0;
  let homeCorrect = 0, homeTotal = 0;
  let awayCorrect = 0, awayTotal = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] === actual[i]) correct++;
    
    if (actual[i] === 1) {
      homeTotal++;
      if (predictions[i] === 1) homeCorrect++;
    } else {
      awayTotal++;
      if (predictions[i] === 0) awayCorrect++;
    }
  }
  
  const accuracy = correct / predictions.length;
  const homeAccuracy = homeTotal > 0 ? homeCorrect / homeTotal : 0;
  const awayAccuracy = awayTotal > 0 ? awayCorrect / awayTotal : 0;
  const balance = (homeAccuracy + awayAccuracy) / 2;
  
  console.log(chalk.bold.cyan(`\n${name} Results:`));
  console.log(chalk.green(`Overall: ${(accuracy * 100).toFixed(1)}%`));
  console.log(chalk.green(`Home: ${(homeAccuracy * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
  console.log(chalk.green(`Away: ${(awayAccuracy * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
  console.log(chalk.green(`Balance: ${(balance * 100).toFixed(1)}%`));
  
  return { accuracy, homeAccuracy, awayAccuracy, balance };
}

trainFinalBalancedModel().catch(console.error);