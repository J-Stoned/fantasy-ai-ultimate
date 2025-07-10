#!/usr/bin/env tsx
/**
 * 🎯 SIMPLE BALANCED MODEL
 * Start simple, get it balanced, then improve
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

async function trainSimpleBalanced() {
  console.log(chalk.bold.cyan('🎯 SIMPLE BALANCED MODEL'));
  console.log(chalk.yellow('Starting with basics to ensure balance'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load a moderate amount of data
    console.log(chalk.cyan('1️⃣ Loading games...'));
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10000);
    
    console.log(chalk.green(`✅ Loaded ${games?.length} games`));
    
    // 2. Simple feature extraction
    console.log(chalk.cyan('\n2️⃣ Extracting simple features...'));
    
    const features: number[][] = [];
    const labels: number[] = [];
    const teamStats = new Map();
    
    // Build basic team stats
    games?.forEach(game => {
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0,
            wins: 0,
            totalScored: 0,
            totalAllowed: 0
          });
        }
      });
      
      const homeStats = teamStats.get(game.home_team_id);
      const awayStats = teamStats.get(game.away_team_id);
      
      // Only use games after teams have played at least 20 games
      if (homeStats.games >= 20 && awayStats.games >= 20) {
        // SIMPLE features - just 5
        const homeWinRate = homeStats.wins / homeStats.games;
        const awayWinRate = awayStats.wins / awayStats.games;
        const homeAvgScored = homeStats.totalScored / homeStats.games;
        const awayAvgScored = awayStats.totalScored / awayStats.games;
        
        const simpleFeatures = [
          homeWinRate - awayWinRate,              // Win rate difference
          (homeAvgScored - awayAvgScored) / 100,  // Normalized scoring diff
          0.05,                                   // Small home advantage
          Math.random() * 0.2 - 0.1,              // Random noise to prevent overfitting
          game.week ? game.week / 20 : 0.5        // Season progress
        ];
        
        features.push(simpleFeatures);
        labels.push(game.home_score > game.away_score ? 1 : 0);
      }
      
      // Update stats
      homeStats.games++;
      awayStats.games++;
      homeStats.totalScored += game.home_score;
      homeStats.totalAllowed += game.away_score;
      awayStats.totalScored += game.away_score;
      awayStats.totalAllowed += game.home_score;
      
      if (game.home_score > game.away_score) {
        homeStats.wins++;
      } else {
        awayStats.wins++;
      }
    });
    
    console.log(chalk.green(`✅ Built ${features.length} feature vectors`));
    
    // 3. Check original distribution
    const homeWins = labels.filter(l => l === 1).length;
    const awayWins = labels.filter(l => l === 0).length;
    console.log(chalk.yellow(`\nOriginal distribution: ${homeWins} home (${(homeWins/labels.length*100).toFixed(1)}%), ${awayWins} away (${(awayWins/labels.length*100).toFixed(1)}%)`));
    
    // 4. Balance perfectly
    console.log(chalk.cyan('\n3️⃣ Creating perfectly balanced dataset...'));
    
    const homeIndices = labels.map((l, i) => l === 1 ? i : -1).filter(i => i >= 0);
    const awayIndices = labels.map((l, i) => l === 0 ? i : -1).filter(i => i >= 0);
    
    // Shuffle indices
    const shuffleArray = (array: number[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };
    
    shuffleArray(homeIndices);
    shuffleArray(awayIndices);
    
    // Take equal amounts
    const sampleSize = Math.min(homeIndices.length, awayIndices.length, 2000); // Limit size
    const balancedIndices = [];
    
    for (let i = 0; i < sampleSize; i++) {
      balancedIndices.push(homeIndices[i]);
      balancedIndices.push(awayIndices[i]);
    }
    
    shuffleArray(balancedIndices);
    
    const balancedFeatures = balancedIndices.map(i => features[i]);
    const balancedLabels = balancedIndices.map(i => labels[i]);
    
    console.log(chalk.green(`✅ Perfectly balanced: ${balancedLabels.filter(l => l === 1).length} home, ${balancedLabels.filter(l => l === 0).length} away`));
    
    // 5. Split 80/20
    const splitIdx = Math.floor(balancedFeatures.length * 0.8);
    const xTrain = balancedFeatures.slice(0, splitIdx);
    const yTrain = balancedLabels.slice(0, splitIdx);
    const xTest = balancedFeatures.slice(splitIdx);
    const yTest = balancedLabels.slice(splitIdx);
    
    // 6. Train SIMPLE model
    console.log(chalk.cyan('\n4️⃣ Training simple model...'));
    
    // Try different parameters
    const models = [
      {
        name: 'Conservative',
        params: {
          nEstimators: 50,
          maxDepth: 5,
          minSamplesLeaf: 20,
          maxFeatures: 1.0,
          seed: 42
        }
      },
      {
        name: 'Balanced',
        params: {
          nEstimators: 100,
          maxDepth: 8,
          minSamplesLeaf: 15,
          maxFeatures: 0.8,
          seed: 123
        }
      },
      {
        name: 'Aggressive',
        params: {
          nEstimators: 150,
          maxDepth: 10,
          minSamplesLeaf: 10,
          maxFeatures: 0.6,
          seed: 456
        }
      }
    ];
    
    let bestModel = null;
    let bestBalance = 0;
    let bestAccuracy = 0;
    let bestName = '';
    
    for (const config of models) {
      console.log(chalk.gray(`\nTraining ${config.name} model...`));
      
      const model = new RandomForestClassifier(config.params);
      model.train(xTrain, yTrain);
      
      // Test
      const predictions = model.predict(xTest);
      
      let correct = 0;
      let homeCorrect = 0, homeTotal = 0;
      let awayCorrect = 0, awayTotal = 0;
      
      for (let i = 0; i < predictions.length; i++) {
        if (predictions[i] === yTest[i]) correct++;
        
        if (yTest[i] === 1) {
          homeTotal++;
          if (predictions[i] === 1) homeCorrect++;
        } else {
          awayTotal++;
          if (predictions[i] === 0) awayCorrect++;
        }
      }
      
      const accuracy = correct / predictions.length;
      const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
      const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
      const balance = Math.min(homeAcc, awayAcc) / Math.max(homeAcc, awayAcc); // Ratio of balance
      
      console.log(chalk.yellow(`${config.name}: ${(accuracy * 100).toFixed(1)}% accuracy`));
      console.log(chalk.yellow(`  Home: ${(homeAcc * 100).toFixed(1)}%, Away: ${(awayAcc * 100).toFixed(1)}%, Balance: ${(balance * 100).toFixed(1)}%`));
      
      // Keep best balanced model
      if (balance > bestBalance || (balance === bestBalance && accuracy > bestAccuracy)) {
        bestModel = model;
        bestBalance = balance;
        bestAccuracy = accuracy;
        bestName = config.name;
      }
    }
    
    // 7. Final test on unbalanced data
    console.log(chalk.cyan('\n5️⃣ Testing best model on real distribution...'));
    
    // Get recent games for final test
    const testFeatures = features.slice(-1000);
    const testLabels = labels.slice(-1000);
    
    if (bestModel && testFeatures.length > 0) {
      const finalPredictions = bestModel.predict(testFeatures);
      
      let correct = 0;
      let homeCorrect = 0, homeTotal = 0;
      let awayCorrect = 0, awayTotal = 0;
      
      for (let i = 0; i < finalPredictions.length; i++) {
        if (finalPredictions[i] === testLabels[i]) correct++;
        
        if (testLabels[i] === 1) {
          homeTotal++;
          if (finalPredictions[i] === 1) homeCorrect++;
        } else {
          awayTotal++;
          if (finalPredictions[i] === 0) awayCorrect++;
        }
      }
      
      const accuracy = correct / finalPredictions.length;
      const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
      const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
      const balance = Math.min(homeAcc, awayAcc) / Math.max(homeAcc, awayAcc);
      
      console.log(chalk.bold.green('\n📊 FINAL RESULTS:'));
      console.log(chalk.green(`Model: ${bestName}`));
      console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
      console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
      console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
      console.log(chalk.green(`Balance Ratio: ${(balance * 100).toFixed(1)}%`));
      
      // Save if balanced
      if (balance > 0.7) {
        console.log(chalk.cyan('\n6️⃣ Saving balanced model...'));
        
        const modelJSON = bestModel.toJSON();
        fs.writeFileSync('./models/simple-balanced-model.json', JSON.stringify(modelJSON, null, 2));
        fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(modelJSON, null, 2));
        
        console.log(chalk.green('✅ Saved simple balanced model!'));
      } else {
        console.log(chalk.yellow('\n⚠️ Model still not balanced enough'));
      }
    }
    
    console.log(chalk.bold.cyan('\n🎯 TRAINING COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainSimpleBalanced().catch(console.error);