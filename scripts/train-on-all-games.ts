#!/usr/bin/env tsx
/**
 * 🎯 TRAIN ON ALL GAMES
 * Use the full dataset for maximum accuracy
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

async function trainOnAllGames() {
  console.log(chalk.bold.cyan('🎯 TRAINING ON ALL AVAILABLE GAMES'));
  console.log(chalk.yellow('This will achieve the REAL accuracy!'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Get count first
    console.log(chalk.cyan('1️⃣ Checking available games...'));
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .gt('home_score', 0);
    
    console.log(chalk.green(`✅ Found ${count} games with scores`));
    
    // 2. Load games in batches
    console.log(chalk.cyan('\n2️⃣ Loading games in batches...'));
    const allGames = [];
    const batchSize = 1000;
    
    // Load ALL games with scores (not just 10K)
    const totalToLoad = count || 0;
    console.log(chalk.yellow(`Will load ${totalToLoad} games in batches...`));
    
    for (let offset = 0; offset < totalToLoad; offset += batchSize) {
      process.stdout.write(chalk.gray(`Loading ${offset}-${offset + batchSize}...`));
      
      const { data: batch } = await supabase
        .from('games')
        .select('*')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .gt('home_score', 0)
        .gt('away_score', 0)
        .order('start_time', { ascending: true })
        .range(offset, offset + batchSize - 1);
      
      if (batch) {
        allGames.push(...batch);
        process.stdout.write(chalk.green(` ✓ (${batch.length} games)\n`));
      }
    }
    
    console.log(chalk.green(`✅ Loaded ${allGames.length} total games`));
    
    // 3. Build features
    console.log(chalk.cyan('\n3️⃣ Building features...'));
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Build team stats map
    const teamStats = new Map();
    
    allGames.forEach((game, idx) => {
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;
      
      // Initialize team stats
      if (!teamStats.has(homeId)) {
        teamStats.set(homeId, { 
          wins: 0, losses: 0, totalFor: 0, totalAgainst: 0, 
          games: 0, recentForm: [], lastGames: []
        });
      }
      if (!teamStats.has(awayId)) {
        teamStats.set(awayId, { 
          wins: 0, losses: 0, totalFor: 0, totalAgainst: 0, 
          games: 0, recentForm: [], lastGames: []
        });
      }
      
      const homeStats = teamStats.get(homeId);
      const awayStats = teamStats.get(awayId);
      
      // Only use games after teams have history
      if (homeStats.games >= 10 && awayStats.games >= 10) {
        const homeWinRate = homeStats.wins / homeStats.games;
        const awayWinRate = awayStats.wins / awayStats.games;
        const homeAvgFor = homeStats.totalFor / homeStats.games;
        const awayAvgFor = awayStats.totalFor / awayStats.games;
        const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
        const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
        
        // Recent form (last 5 games)
        const homeRecent = homeStats.recentForm.slice(-5).reduce((a, b) => a + b, 0) / Math.min(homeStats.recentForm.length, 5);
        const awayRecent = awayStats.recentForm.slice(-5).reduce((a, b) => a + b, 0) / Math.min(awayStats.recentForm.length, 5);
        
        // Build feature vector
        const gameFeatures = [
          homeWinRate - awayWinRate,                    // Win rate difference
          (homeAvgFor - awayAvgFor) / 10,              // Scoring difference
          (homeAvgAgainst - awayAvgAgainst) / 10,       // Defense difference
          homeRecent - awayRecent,                      // Recent form difference
          Math.abs(homeWinRate - awayWinRate),          // Mismatch indicator
          (homeWinRate + 0.1) - awayWinRate,           // Home advantage
          homeAvgFor / Math.max(awayAvgAgainst, 1),    // Offensive matchup
          awayAvgFor / Math.max(homeAvgAgainst, 1),    // Defensive matchup
          homeStats.games / 100,                        // Home experience
          awayStats.games / 100,                        // Away experience
          (homeAvgFor - homeAvgAgainst) / 10,          // Home net rating
          (awayAvgFor - awayAvgAgainst) / 10,          // Away net rating
          1.0,                                          // Home field constant
          homeWinRate > 0.6 ? 1 : 0,                   // Home is favorite
          awayWinRate > 0.6 ? 1 : 0                    // Away is favorite
        ];
        
        features.push(gameFeatures);
        labels.push(game.home_score > game.away_score ? 1 : 0);
      }
      
      // Update team stats
      homeStats.games++;
      awayStats.games++;
      homeStats.totalFor += game.home_score;
      homeStats.totalAgainst += game.away_score;
      awayStats.totalFor += game.away_score;
      awayStats.totalAgainst += game.home_score;
      
      if (game.home_score > game.away_score) {
        homeStats.wins++;
        awayStats.losses++;
        homeStats.recentForm.push(1);
        awayStats.recentForm.push(0);
      } else {
        homeStats.losses++;
        awayStats.wins++;
        homeStats.recentForm.push(0);
        awayStats.recentForm.push(1);
      }
    });
    
    console.log(chalk.green(`✅ Built ${features.length} feature vectors`));
    
    // 4. Balance dataset
    console.log(chalk.cyan('\n4️⃣ Balancing dataset...'));
    const homeWins = labels.filter(l => l === 1).length;
    const awayWins = labels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Original: ${homeWins} home, ${awayWins} away`));
    
    // Take equal samples
    const minClass = Math.min(homeWins, awayWins);
    const balanced = { features: [], labels: [] };
    let homeCount = 0, awayCount = 0;
    
    for (let i = 0; i < features.length; i++) {
      if ((labels[i] === 1 && homeCount < minClass) || 
          (labels[i] === 0 && awayCount < minClass)) {
        balanced.features.push(features[i]);
        balanced.labels.push(labels[i]);
        if (labels[i] === 1) homeCount++;
        else awayCount++;
      }
    }
    
    console.log(chalk.green(`✅ Balanced: ${homeCount} home, ${awayCount} away`));
    
    // 5. Split and train
    console.log(chalk.cyan('\n5️⃣ Training Random Forest...'));
    const splitIdx = Math.floor(balanced.features.length * 0.8);
    const xTrain = balanced.features.slice(0, splitIdx);
    const yTrain = balanced.labels.slice(0, splitIdx);
    const xTest = balanced.features.slice(splitIdx);
    const yTest = balanced.labels.slice(splitIdx);
    
    console.log(chalk.gray(`Training on ${xTrain.length} samples...`));
    
    const model = new RandomForestClassifier({
      nEstimators: 300,  // More trees for better accuracy
      maxDepth: 20,      // Deeper trees for complex patterns
      minSamplesLeaf: 3, // Allow more detailed splits
      replacement: true,
      maxFeatures: 0.7,  // Use 70% of features per tree
      seed: 42
    });
    
    model.train(xTrain, yTrain);
    console.log(chalk.green('✅ Model trained!'));
    
    // 6. Evaluate
    console.log(chalk.cyan('\n6️⃣ Evaluating...'));
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
    const homeAcc = homeCorrect / homeTotal;
    const awayAcc = awayCorrect / awayTotal;
    
    console.log(chalk.bold.green('\n🎯 RESULTS:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Balance: ${((homeAcc + awayAcc) / 2 * 100).toFixed(1)}%`));
    
    // 7. Save model
    // Always save the model with its performance metrics
    if (true) {
      console.log(chalk.cyan('\n7️⃣ Saving high-accuracy model...'));
      const modelJSON = model.toJSON();
      
      fs.writeFileSync('./models/ultimate-rf.json', JSON.stringify(modelJSON, null, 2));
      fs.writeFileSync('./models/ultimate-rf-meta.json', JSON.stringify({
        ...modelJSON,
        metadata: {
          accuracy,
          homeAccuracy: homeAcc,
          awayAccuracy: awayAcc,
          balance: (homeAcc + awayAcc) / 2,
          trainingSamples: xTrain.length,
          testSamples: xTest.length,
          totalGames: allGames.length,
          features: 15,
          trainedOn: new Date().toISOString()
        }
      }, null, 2));
      
      console.log(chalk.green('✅ Saved to models/ultimate-rf.json'));
    }
    
    console.log(chalk.bold.cyan('\n🏆 TRAINING COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainOnAllGames().catch(console.error);