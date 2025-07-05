#!/usr/bin/env tsx
/**
 * 🌳 TRAIN REAL RANDOM FOREST
 * No bullshit - train on actual game data for real accuracy
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

interface GameRecord {
  id: number;
  date: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  season: number;
  week: number;
}

async function trainRealRandomForest() {
  console.log(chalk.bold.cyan('🌳 TRAINING REAL RANDOM FOREST'));
  console.log(chalk.yellow('No synthetic data - using actual games for real accuracy'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load real games with scores
    console.log(chalk.cyan('\n1️⃣ Loading real games from database...'));
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .gt('home_score', 0)
      .gt('away_score', 0)
      .order('start_time', { ascending: true })
      .limit(5000); // Start with 5K games for faster training
    
    if (!games || games.length === 0) {
      throw new Error('No games found with scores');
    }
    
    console.log(chalk.green(`✅ Loaded ${games.length} real games with scores`));
    
    // 2. Extract meaningful features from real data
    console.log(chalk.cyan('\n2️⃣ Extracting meaningful features...'));
    
    const trainingFeatures: number[][] = [];
    const trainingLabels: number[] = [];
    
    // Group games by team to calculate running stats
    const teamStats = new Map<number, { 
      games: GameRecord[], 
      totalScore: number, 
      totalAllowed: number, 
      wins: number 
    }>();
    
    for (const game of games) {
      // Initialize team stats
      if (!teamStats.has(game.home_team_id)) {
        teamStats.set(game.home_team_id, { games: [], totalScore: 0, totalAllowed: 0, wins: 0 });
      }
      if (!teamStats.has(game.away_team_id)) {
        teamStats.set(game.away_team_id, { games: [], totalScore: 0, totalAllowed: 0, wins: 0 });
      }
      
      const homeStats = teamStats.get(game.home_team_id)!;
      const awayStats = teamStats.get(game.away_team_id)!;
      
      // Only create features if teams have some history
      if (homeStats.games.length >= 3 && awayStats.games.length >= 3) {
        // Calculate meaningful features
        const features = [
          // Win rates
          homeStats.wins / homeStats.games.length,
          awayStats.wins / awayStats.games.length,
          
          // Scoring averages
          homeStats.totalScore / homeStats.games.length,
          awayStats.totalScore / awayStats.games.length,
          homeStats.totalAllowed / homeStats.games.length,
          awayStats.totalAllowed / awayStats.games.length,
          
          // Recent form (last 3 games)
          calculateRecentForm(homeStats.games.slice(-3)),
          calculateRecentForm(awayStats.games.slice(-3)),
          
          // Home field advantage (simple)
          1.0, // home team gets +1
          
          // Score differential
          (homeStats.totalScore - homeStats.totalAllowed) / homeStats.games.length,
          (awayStats.totalScore - awayStats.totalAllowed) / awayStats.games.length,
          
          // Season progress
          game.week / 17,
          
          // Head to head (simplified)
          Math.random() > 0.5 ? 1 : 0, // TODO: Calculate real H2H
          
          // Rest (games since last week - simplified)
          1.0, // Assume 1 week rest
          
          // Season strength (early vs late season performance)
          homeStats.games.length / 17,
          awayStats.games.length / 17
        ];
        
        const homeWon = game.home_score > game.away_score ? 1 : 0;
        
        trainingFeatures.push(features);
        trainingLabels.push(homeWon);
      }
      
      // Update team stats after processing
      homeStats.games.push(game);
      awayStats.games.push(game);
      homeStats.totalScore += game.home_score;
      homeStats.totalAllowed += game.away_score;
      if (game.home_score > game.away_score) homeStats.wins++;
      
      awayStats.games.push(game);
      awayStats.totalScore += game.away_score;
      awayStats.totalAllowed += game.home_score;
      if (game.away_score > game.home_score) awayStats.wins++;
    }
    
    console.log(chalk.green(`✅ Extracted features from ${trainingFeatures.length} games`));
    console.log(chalk.green(`✅ Feature count: ${trainingFeatures[0]?.length || 0} per game`));
    
    // 3. Split data temporally (don't peek into future)
    console.log(chalk.cyan('\n3️⃣ Creating temporal train/test split...'));
    
    const splitIndex = Math.floor(trainingFeatures.length * 0.8);
    const xTrain = trainingFeatures.slice(0, splitIndex);
    const yTrain = trainingLabels.slice(0, splitIndex);
    const xTest = trainingFeatures.slice(splitIndex);
    const yTest = trainingLabels.slice(splitIndex);
    
    console.log(chalk.green(`✅ Training set: ${xTrain.length} games`));
    console.log(chalk.green(`✅ Test set: ${xTest.length} games`));
    
    // 4. Train Random Forest
    console.log(chalk.cyan('\n4️⃣ Training Random Forest...'));
    
    const rf = new RandomForestClassifier({
      nEstimators: 100,
      maxDepth: 10,
      minSamplesLeaf: 5,
      maxFeatures: 0.8,
      seed: 42
    });
    
    console.log(chalk.gray('Training forest...'));
    rf.train(xTrain, yTrain);
    
    // 5. Evaluate on test set
    console.log(chalk.cyan('\n5️⃣ Evaluating model...'));
    
    const predictions = rf.predict(xTest);
    let correct = 0;
    let homeWins = 0;
    let homeCorrect = 0;
    let awayWins = 0;
    let awayCorrect = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const predicted = predictions[i];
      const actual = yTest[i];
      
      if (predicted === actual) correct++;
      
      if (actual === 1) {
        homeWins++;
        if (predicted === 1) homeCorrect++;
      } else {
        awayWins++;
        if (predicted === 0) awayCorrect++;
      }
    }
    
    const accuracy = correct / predictions.length;
    const homeAccuracy = homeCorrect / homeWins;
    const awayAccuracy = awayCorrect / awayWins;
    
    console.log(chalk.green(`✅ Overall Accuracy: ${(accuracy * 100).toFixed(2)}%`));
    console.log(chalk.green(`✅ Home Team Accuracy: ${(homeAccuracy * 100).toFixed(2)}% (${homeCorrect}/${homeWins})`));
    console.log(chalk.green(`✅ Away Team Accuracy: ${(awayAccuracy * 100).toFixed(2)}% (${awayCorrect}/${awayWins})`));
    
    // 6. Save model
    console.log(chalk.cyan('\n6️⃣ Saving trained model...'));
    
    if (!fs.existsSync('./models')) {
      fs.mkdirSync('./models', { recursive: true });
    }
    
    const modelData = {
      ...rf.toJSON(),
      metadata: {
        trainedOn: new Date().toISOString(),
        accuracy: accuracy,
        homeAccuracy: homeAccuracy,
        awayAccuracy: awayAccuracy,
        trainingGames: xTrain.length,
        testGames: xTest.length,
        features: trainingFeatures[0]?.length || 0
      }
    };
    
    fs.writeFileSync('./models/real-random-forest.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Model saved to ./models/real-random-forest.json'));
    
    // 7. Show sample predictions
    console.log(chalk.cyan('\n7️⃣ Sample predictions:'));
    for (let i = 0; i < Math.min(5, xTest.length); i++) {
      const pred = predictions[i] === 1 ? 'HOME' : 'AWAY';
      const actual = yTest[i] === 1 ? 'HOME' : 'AWAY';
      const correct = predictions[i] === yTest[i] ? '✅' : '❌';
      console.log(`${correct} Predicted: ${pred}, Actual: ${actual}`);
    }
    
    console.log(chalk.bold.green('\n🏆 REAL RANDOM FOREST TRAINING COMPLETE!'));
    console.log(chalk.green('═'.repeat(60)));
    console.log(chalk.white('✅ Trained on actual game data'));
    console.log(chalk.white('✅ Proper temporal validation'));
    console.log(chalk.white('✅ Real accuracy measurements'));
    console.log(chalk.white(`✅ ${(accuracy * 100).toFixed(1)}% accuracy achieved`));
    
    if (accuracy > 0.52) {
      console.log(chalk.bold.green('\n🎉 BEATS RANDOM GUESSING! 🎉'));
    } else {
      console.log(chalk.bold.yellow('\n⚠️ Need better features for higher accuracy'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ TRAINING FAILED:'), error);
  }
}

function calculateRecentForm(games: GameRecord[]): number {
  if (games.length === 0) return 0.5;
  
  let wins = 0;
  for (const game of games) {
    if (game.home_score > game.away_score) wins++;
  }
  
  return wins / games.length;
}

trainRealRandomForest().catch(console.error);