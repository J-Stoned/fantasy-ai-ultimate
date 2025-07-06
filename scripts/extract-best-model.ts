#!/usr/bin/env tsx
/**
 * 🎯 EXTRACT BEST MODEL
 * Get the actual high-performing model
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

async function extractBestModel() {
  console.log(chalk.bold.cyan('🎯 EXTRACTING BEST PERFORMING MODEL'));
  console.log(chalk.yellow('Training a properly balanced model'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load games
    console.log(chalk.cyan('1️⃣ Loading games...'));
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .gt('home_score', 0)
      .gt('away_score', 0)
      .order('start_time', { ascending: true })
      .limit(3000);
    
    console.log(chalk.green(`✅ Loaded ${games?.length || 0} games`));
    
    // 2. Build features focusing on recent games
    console.log(chalk.cyan('\n2️⃣ Building features...'));
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Build team stats
    const teamStats = new Map();
    
    games?.forEach(game => {
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;
      
      if (!teamStats.has(homeId)) {
        teamStats.set(homeId, { wins: 0, losses: 0, totalFor: 0, totalAgainst: 0, games: 0 });
      }
      if (!teamStats.has(awayId)) {
        teamStats.set(awayId, { wins: 0, losses: 0, totalFor: 0, totalAgainst: 0, games: 0 });
      }
      
      const homeStats = teamStats.get(homeId);
      const awayStats = teamStats.get(awayId);
      
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
      } else {
        homeStats.losses++;
        awayStats.wins++;
      }
      
      // After enough games, start making features
      if (homeStats.games >= 10 && awayStats.games >= 10) {
        const homeWinRate = homeStats.wins / homeStats.games;
        const awayWinRate = awayStats.wins / awayStats.games;
        const homeAvgFor = homeStats.totalFor / homeStats.games;
        const awayAvgFor = awayStats.totalFor / awayStats.games;
        const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
        const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
        
        // Simple but effective features
        const gameFeatures = [
          homeWinRate,
          awayWinRate,
          homeAvgFor / 100,
          awayAvgFor / 100,
          homeAvgAgainst / 100,
          awayAvgAgainst / 100,
          homeWinRate - awayWinRate,
          (homeAvgFor - awayAvgFor) / 10,
          (homeAvgAgainst - awayAvgAgainst) / 10,
          homeWinRate > awayWinRate ? 1 : 0,
          Math.abs(homeWinRate - awayWinRate),
          1.0, // home field
          homeStats.games / 100,
          awayStats.games / 100,
          (homeAvgFor - homeAvgAgainst) / 10,
          (awayAvgFor - awayAvgAgainst) / 10
        ];
        
        features.push(gameFeatures);
        labels.push(game.home_score > game.away_score ? 1 : 0);
      }
    });
    
    console.log(chalk.green(`✅ Built ${features.length} training samples`));
    
    // 3. Split 80/20
    console.log(chalk.cyan('\n3️⃣ Splitting data...'));
    const splitIdx = Math.floor(features.length * 0.8);
    const xTrain = features.slice(0, splitIdx);
    const yTrain = labels.slice(0, splitIdx);
    const xTest = features.slice(splitIdx);
    const yTest = labels.slice(splitIdx);
    
    console.log(chalk.green(`✅ Train: ${xTrain.length}, Test: ${xTest.length}`));
    
    // 4. Train model with good parameters
    console.log(chalk.cyan('\n4️⃣ Training Random Forest...'));
    const model = new RandomForestClassifier({
      nEstimators: 100,
      maxDepth: 12,
      minSamplesLeaf: 5,
      replacement: true,
      seed: 42
    });
    
    model.train(xTrain, yTrain);
    console.log(chalk.green('✅ Model trained'));
    
    // 5. Evaluate
    console.log(chalk.cyan('\n5️⃣ Evaluating...'));
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
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance: ${((homeAcc + awayAcc) / 2 * 100).toFixed(1)}%`));
    
    // 6. Save if good
    if (accuracy > 0.55) {
      console.log(chalk.cyan('\n6️⃣ Saving model...'));
      
      const modelJSON = model.toJSON();
      fs.writeFileSync('./models/best-balanced-rf.json', JSON.stringify(modelJSON, null, 2));
      
      // Save with metadata
      const withMeta = {
        ...modelJSON,
        metadata: {
          accuracy,
          homeAccuracy: homeAcc,
          awayAccuracy: awayAcc,
          balance: (homeAcc + awayAcc) / 2,
          features: 16,
          trainingSamples: xTrain.length,
          testSamples: xTest.length,
          trainedOn: new Date().toISOString()
        }
      };
      
      fs.writeFileSync('./models/best-balanced-rf-meta.json', JSON.stringify(withMeta, null, 2));
      console.log(chalk.green('✅ Model saved!'));
    }
    
    console.log(chalk.yellow('\n═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

extractBestModel().catch(console.error);