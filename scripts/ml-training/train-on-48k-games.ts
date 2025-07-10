#!/usr/bin/env tsx
/**
 * 🔥 TRAIN ON ALL 48K GAMES! 🔥
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
  console.log(chalk.bold.red('🔥 TRAINING ON ALL 48K GAMES! 🔥'));
  console.log(chalk.yellow('THIS IS IT - MAXIMUM DATA!'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load ALL games with scores
    console.log(chalk.cyan('1️⃣ Loading ALL 48K games...'));
    
    const allGames: any[] = [];
    const batchSize = 5000;
    let offset = 0;
    
    // Get total count
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    console.log(chalk.green(`Found ${count} games with scores!`));
    
    // Load in batches
    while (offset < (count || 0)) {
      const { data: batch } = await supabase
        .from('games')
        .select('*')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: true })
        .range(offset, Math.min(offset + batchSize - 1, (count || 0) - 1));
      
      if (batch) {
        allGames.push(...batch);
        console.log(chalk.gray(`Loaded ${allGames.length}/${count} games...`));
      }
      offset += batchSize;
    }
    
    console.log(chalk.green(`✅ Loaded ${allGames.length} games!`));
    
    // 2. Build features with team stats
    console.log(chalk.cyan('\n2️⃣ Building features from ALL games...'));
    
    const features: number[][] = [];
    const labels: number[] = [];
    const teamStats = new Map();
    
    // Initialize team stats
    allGames.forEach(game => {
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0, wins: 0, losses: 0,
            totalFor: 0, totalAgainst: 0,
            homeWins: 0, homeGames: 0,
            awayWins: 0, awayGames: 0,
            recentForm: [], lastGames: []
          });
        }
      });
    });
    
    // Process games
    let featuresBuilt = 0;
    allGames.forEach((game, idx) => {
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;
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
        
        // Recent form
        const homeRecent = homeStats.recentForm.slice(-5).reduce((a: number, b: number) => a + b, 0) / Math.min(homeStats.recentForm.length, 5);
        const awayRecent = awayStats.recentForm.slice(-5).reduce((a: number, b: number) => a + b, 0) / Math.min(awayStats.recentForm.length, 5);
        
        // Build feature vector (15 features matching the model)
        const gameFeatures = [
          homeWinRate - awayWinRate,                    // Win rate difference
          (homeAvgFor - awayAvgFor) / 10,              // Scoring difference
          (awayAvgAgainst - homeAvgAgainst) / 10,       // Defense difference
          homeRecent - awayRecent,                      // Recent form
          0.1,                                          // Consistency placeholder
          0.0,                                          // SOS placeholder
          0.0,                                          // H2H placeholder
          homeStats.recentForm.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3 - 
          awayStats.recentForm.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3, // Short-term momentum
          (homeStats.games - awayStats.games) / 100,   // Experience
          homeAvgFor / Math.max(awayAvgAgainst, 1),    // Offensive matchup
          awayAvgFor / Math.max(homeAvgAgainst, 1),    // Defensive matchup
          0.03,                                         // Home field
          game.week ? game.week / 17 : 0.5,            // Season progress
          Math.abs(homeWinRate - 0.5) - Math.abs(awayWinRate - 0.5), // Distance from .500
          (homeAvgFor - homeAvgAgainst) / 10 - (awayAvgFor - awayAvgAgainst) / 10  // Net rating diff
        ];
        
        features.push(gameFeatures);
        labels.push(game.home_score > game.away_score ? 1 : 0);
        featuresBuilt++;
      }
      
      // Update stats
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
        homeStats.homeWins++;
      } else {
        homeStats.losses++;
        awayStats.wins++;
        homeStats.recentForm.push(0);
        awayStats.recentForm.push(1);
        awayStats.awayWins++;
      }
      
      homeStats.homeGames++;
      awayStats.awayGames++;
      
      if (idx % 5000 === 0 && idx > 0) {
        console.log(chalk.gray(`Processed ${idx}/${allGames.length} games, built ${featuresBuilt} features...`));
      }
    });
    
    console.log(chalk.green(`✅ Built ${features.length} feature vectors from ${allGames.length} games!`));
    
    // 3. Balance dataset
    console.log(chalk.cyan('\n3️⃣ Balancing massive dataset...'));
    const homeWins = labels.filter(l => l === 1).length;
    const awayWins = labels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Original: ${homeWins} home wins, ${awayWins} away wins`));
    
    // Balance by taking equal samples
    const minClass = Math.min(homeWins, awayWins);
    const balanced = { features: [] as number[][], labels: [] as number[] };
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
    
    // 4. Train ULTIMATE model
    console.log(chalk.cyan('\n4️⃣ Training ULTIMATE Random Forest on ${balanced.features.length} samples...'));
    
    const splitIdx = Math.floor(balanced.features.length * 0.85);
    const xTrain = balanced.features.slice(0, splitIdx);
    const yTrain = balanced.labels.slice(0, splitIdx);
    const xTest = balanced.features.slice(splitIdx);
    const yTest = balanced.labels.slice(splitIdx);
    
    console.log(chalk.yellow(`Training on ${xTrain.length} samples...`));
    console.log(chalk.red('🔥 ULTIMATE PARAMETERS:'));
    
    const model = new RandomForestClassifier({
      nEstimators: 300,        // High but not too high
      maxDepth: 20,            // Deep trees
      minSamplesLeaf: 3,       // Fine detail
      maxFeatures: 1.0,        // USE ALL FEATURES!
      replacement: true,
      seed: 42
    });
    
    const startTime = Date.now();
    model.train(xTrain, yTrain);
    const trainTime = (Date.now() - startTime) / 1000;
    
    console.log(chalk.green(`✅ Model trained in ${trainTime.toFixed(1)}s!`));
    
    // 5. Evaluate
    console.log(chalk.cyan('\n5️⃣ Evaluating on test set...'));
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
    const balance = (homeAcc + awayAcc) / 2;
    
    console.log(chalk.bold.green('\n🎯 RESULTS ON 48K GAMES:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Balance: ${(balance * 100).toFixed(1)}%`));
    
    // 6. Save the ULTIMATE model
    console.log(chalk.cyan('\n6️⃣ Saving 48K game model...'));
    
    const modelJSON = model.toJSON();
    
    // Save all versions
    fs.writeFileSync('./models/ultimate-48k-model.json', JSON.stringify(modelJSON, null, 2));
    fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(modelJSON, null, 2));
    
    // Save with metadata
    const metadata = {
      model: modelJSON,
      stats: {
        accuracy,
        homeAccuracy: homeAcc,
        awayAccuracy: awayAcc,
        balance,
        totalGames: allGames.length,
        trainingGames: xTrain.length,
        testGames: xTest.length,
        features: 15,
        trainedOn: new Date().toISOString(),
        trainingTime: trainTime
      }
    };
    
    fs.writeFileSync('./models/ultimate-48k-metadata.json', JSON.stringify(metadata, null, 2));
    
    console.log(chalk.green('✅ Saved ultimate 48K game model!'));
    
    console.log(chalk.bold.red('\n🔥 ULTIMATE TRAINING COMPLETE! 🔥'));
    console.log(chalk.yellow('═'.repeat(60)));
    
    if (accuracy >= 0.86) {
      console.log(chalk.bold.green('🎉🎉 86%+ ACCURACY ACHIEVED WITH 48K GAMES! 🎉🎉'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainOnAllGames().catch(console.error);