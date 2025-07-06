#!/usr/bin/env tsx
/**
 * 🚀 OPTIMIZED SUPER MODEL
 * Fast training with best features only
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

async function trainOptimizedSuperModel() {
  console.log(chalk.bold.cyan('🚀 OPTIMIZED SUPER MODEL TRAINING'));
  console.log(chalk.yellow('Fast training with maximum accuracy'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load targeted data
    console.log(chalk.cyan('1️⃣ Loading optimized dataset...'));
    
    // Get games with all necessary data
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(20000); // Enough for good training
    
    console.log(chalk.green(`✅ Loaded ${games?.length} games`));
    
    // Load player stats efficiently
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('player_id, game_id, stat_type, stat_value, fantasy_points')
      .in('stat_type', ['passing', 'rushing', 'receiving', 'touchdown', 'turnover'])
      .limit(50000);
    
    console.log(chalk.green(`✅ Loaded ${playerStats?.length} player stats`));
    
    // Load weather data
    const { data: weather } = await supabase
      .from('weather_data')
      .select('game_id, temperature, wind_speed, precipitation')
      .limit(5000);
    
    console.log(chalk.green(`✅ Loaded ${weather?.length} weather records`));
    
    // 2. Create fast lookups
    console.log(chalk.cyan('\n2️⃣ Building fast indices...'));
    
    const weatherByGame = new Map();
    weather?.forEach(w => weatherByGame.set(w.game_id, w));
    
    const statsByGame = new Map();
    playerStats?.forEach(stat => {
      if (!statsByGame.has(stat.game_id)) {
        statsByGame.set(stat.game_id, { passing: 0, rushing: 0, touchdowns: 0 });
      }
      const gameStats = statsByGame.get(stat.game_id);
      
      if (stat.stat_type === 'passing') gameStats.passing += stat.stat_value || 0;
      else if (stat.stat_type === 'rushing') gameStats.rushing += stat.stat_value || 0;
      else if (stat.stat_type === 'touchdown') gameStats.touchdowns++;
    });
    
    // 3. Build optimized features
    console.log(chalk.cyan('\n3️⃣ Building optimized feature set...'));
    
    const features: number[][] = [];
    const labels: number[] = [];
    const teamStats = new Map();
    
    // Process games in reverse order (oldest first for proper stats)
    const sortedGames = games?.slice().reverse() || [];
    
    sortedGames.forEach((game, idx) => {
      // Initialize teams
      [game.home_team_id, game.away_team_id].forEach(teamId => {
        if (!teamStats.has(teamId)) {
          teamStats.set(teamId, {
            games: 0, wins: 0,
            homeGames: 0, homeWins: 0,
            awayGames: 0, awayWins: 0,
            totalFor: 0, totalAgainst: 0,
            last10: [], last5: [],
            elo: 1500, momentum: 0.5,
            avgPassYPG: 250, avgRushYPG: 100
          });
        }
      });
      
      const homeStats = teamStats.get(game.home_team_id);
      const awayStats = teamStats.get(game.away_team_id);
      
      // Need enough history
      if (homeStats.games >= 10 && awayStats.games >= 10) {
        // Get game data
        const gameWeather = weatherByGame.get(game.id);
        const gameStats = statsByGame.get(game.id);
        
        // Core features only (proven to work)
        const homeWR = homeStats.wins / homeStats.games;
        const awayWR = awayStats.wins / awayStats.games;
        const homeHomeWR = homeStats.homeGames > 5 ? homeStats.homeWins / homeStats.homeGames : homeWR;
        const awayAwayWR = awayStats.awayGames > 5 ? awayStats.awayWins / awayStats.awayGames : awayWR;
        
        const homeAvgFor = homeStats.totalFor / homeStats.games;
        const awayAvgFor = awayStats.totalFor / awayStats.games;
        const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
        const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
        
        // Recent form
        const homeLast5 = homeStats.last5.slice(-5);
        const awayLast5 = awayStats.last5.slice(-5);
        const homeForm = homeLast5.length > 0 ? homeLast5.reduce((a, b) => a + b, 0) / homeLast5.length : 0.5;
        const awayForm = awayLast5.length > 0 ? awayLast5.reduce((a, b) => a + b, 0) / awayLast5.length : 0.5;
        
        // Build streamlined feature vector (30 best features)
        const featureVector = [
          // Primary differentials (most important)
          homeWR - awayWR,
          homeHomeWR - awayAwayWR,
          (homeAvgFor - awayAvgFor) / 10,
          (awayAvgAgainst - homeAvgAgainst) / 10,
          homeForm - awayForm,
          (homeStats.elo - awayStats.elo) / 400,
          homeStats.momentum - awayStats.momentum,
          
          // Absolute values (context)
          homeWR,
          awayWR,
          homeHomeWR,
          awayAwayWR,
          homeForm,
          awayForm,
          
          // Scoring patterns
          homeAvgFor / 30,
          awayAvgFor / 30,
          homeAvgAgainst / 30,
          awayAvgAgainst / 30,
          
          // Matchup specifics
          homeAvgFor / Math.max(awayAvgAgainst, 20),
          awayAvgFor / Math.max(homeAvgAgainst, 20),
          
          // Recent performance
          homeLast5.filter(x => x === 1).length / 5,
          awayLast5.filter(x => x === 1).length / 5,
          
          // Environmental
          gameWeather ? (gameWeather.temperature - 60) / 30 : 0,
          gameWeather ? gameWeather.wind_speed / 20 : 0.25,
          gameWeather ? gameWeather.precipitation : 0,
          
          // Game stats if available
          gameStats ? gameStats.passing / 500 : 0.5,
          gameStats ? gameStats.rushing / 200 : 0.5,
          gameStats ? gameStats.touchdowns / 8 : 0.5,
          
          // Context
          0.025, // home advantage
          game.week ? (game.week - 9) / 9 : 0,
          Math.random() * 0.02 - 0.01 // tiny noise
        ];
        
        // Validate all features are numeric
        const isValid = featureVector.every(f => typeof f === 'number' && !isNaN(f));
        if (isValid) {
          features.push(featureVector);
          labels.push(game.home_score > game.away_score ? 1 : 0);
        }
      }
      
      // Update stats
      const homeWon = game.home_score > game.away_score;
      
      homeStats.games++;
      awayStats.games++;
      homeStats.totalFor += game.home_score;
      homeStats.totalAgainst += game.away_score;
      awayStats.totalFor += game.away_score;
      awayStats.totalAgainst += game.home_score;
      
      if (homeWon) {
        homeStats.wins++;
        homeStats.last10.push(1);
        homeStats.last5.push(1);
        awayStats.last10.push(0);
        awayStats.last5.push(0);
        
        homeStats.homeGames++;
        if (game.home_team_id === game.home_team_id) {
          homeStats.homeWins++;
        }
      } else {
        awayStats.wins++;
        homeStats.last10.push(0);
        homeStats.last5.push(0);
        awayStats.last10.push(1);
        awayStats.last5.push(1);
        
        awayStats.awayGames++;
        if (game.away_team_id === game.away_team_id) {
          awayStats.awayWins++;
        }
      }
      
      // Update ELO
      const K = 20;
      const expectedHome = 1 / (1 + Math.pow(10, (awayStats.elo - homeStats.elo) / 400));
      homeStats.elo += K * ((homeWon ? 1 : 0) - expectedHome);
      awayStats.elo += K * ((homeWon ? 0 : 1) - (1 - expectedHome));
      
      // Update momentum
      homeStats.momentum = homeStats.momentum * 0.8 + (homeWon ? 1 : 0) * 0.2;
      awayStats.momentum = awayStats.momentum * 0.8 + (homeWon ? 0 : 1) * 0.2;
      
      // Maintain list sizes
      if (homeStats.last10.length > 10) homeStats.last10.shift();
      if (awayStats.last10.length > 10) awayStats.last10.shift();
      if (homeStats.last5.length > 5) homeStats.last5.shift();
      if (awayStats.last5.length > 5) awayStats.last5.shift();
      
      if (idx % 2000 === 0 && idx > 0) {
        console.log(chalk.gray(`Processed ${idx}/${sortedGames.length} games...`));
      }
    });
    
    console.log(chalk.green(`✅ Built ${features.length} optimized feature vectors`));
    
    // 4. Check balance
    const homeWins = labels.filter(l => l === 1).length;
    const awayWins = labels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Distribution: ${homeWins} home (${(homeWins/labels.length*100).toFixed(1)}%), ${awayWins} away (${(awayWins/labels.length*100).toFixed(1)}%)`));
    
    // 5. Split data
    console.log(chalk.cyan('\n4️⃣ Splitting data...'));
    const trainEnd = Math.floor(features.length * 0.8);
    
    const xTrain = features.slice(0, trainEnd);
    const yTrain = labels.slice(0, trainEnd);
    const xTest = features.slice(trainEnd);
    const yTest = labels.slice(trainEnd);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 6. Train optimized model
    console.log(chalk.cyan('\n5️⃣ Training optimized Random Forest...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 200,
      maxDepth: 15,
      minSamplesLeaf: 8,
      maxFeatures: 0.6,
      seed: 42
    });
    
    console.log(chalk.yellow('Training...'));
    const startTime = Date.now();
    model.train(xTrain, yTrain);
    console.log(chalk.green(`✅ Trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 7. Test performance
    console.log(chalk.cyan('\n6️⃣ Testing model...'));
    const predictions = model.predict(xTest);
    
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    let tp = 0, tn = 0, fp = 0, fn = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === yTest[i]) correct++;
      
      if (yTest[i] === 1) {
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
    const balance = 2 * (homeAcc * awayAcc) / (homeAcc + awayAcc + 0.0001);
    
    const precision = tp > 0 ? tp / (tp + fp) : 0;
    const recall = tp > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    console.log(chalk.bold.green('\n📊 MODEL PERFORMANCE:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance Score: ${(balance * 100).toFixed(1)}%`));
    console.log(chalk.gray(`F1 Score: ${(f1 * 100).toFixed(1)}%`));
    console.log(chalk.gray(`Precision: ${(precision * 100).toFixed(1)}%, Recall: ${(recall * 100).toFixed(1)}%`));
    
    // 8. Save if good
    if (accuracy > 0.55 || (balance > 0.7 && accuracy > 0.52)) {
      console.log(chalk.cyan('\n7️⃣ Saving optimized model...'));
      
      const modelData = {
        model: model.toJSON(),
        metadata: {
          features: 30,
          featureNames: [
            'Win Rate Diff', 'Home/Away WR Diff', 'Score Diff', 'Defense Diff',
            'Form Diff', 'ELO Diff', 'Momentum Diff',
            'Home WR', 'Away WR', 'Home Home WR', 'Away Away WR',
            'Home Form', 'Away Form',
            'Home Avg Score', 'Away Avg Score', 'Home Avg Against', 'Away Avg Against',
            'Home vs Away D', 'Away vs Home D',
            'Home Recent Wins', 'Away Recent Wins',
            'Temperature', 'Wind Speed', 'Precipitation',
            'Passing Yards', 'Rushing Yards', 'Touchdowns',
            'Home Advantage', 'Week', 'Noise'
          ],
          performance: { accuracy, homeAcc, awayAcc, balance, precision, recall, f1 },
          trainingSamples: xTrain.length,
          testSamples: xTest.length,
          trainedOn: new Date().toISOString()
        }
      };
      
      fs.writeFileSync('./models/optimized-super-model.json', JSON.stringify(modelData, null, 2));
      fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(model.toJSON(), null, 2));
      
      console.log(chalk.green('✅ Saved optimized super model!'));
      
      // 9. Test on recent games
      console.log(chalk.cyan('\n8️⃣ Testing on most recent games...'));
      
      const recentFeatures = features.slice(-100);
      const recentLabels = labels.slice(-100);
      const recentPreds = model.predict(recentFeatures);
      
      const recentCorrect = recentPreds.filter((p, i) => p === recentLabels[i]).length;
      const recentAcc = recentCorrect / recentPreds.length;
      
      console.log(chalk.yellow(`Recent games accuracy: ${(recentAcc * 100).toFixed(1)}%`));
      
      // 10. Show sample predictions
      console.log(chalk.cyan('\n9️⃣ Sample predictions:'));
      
      for (let i = 0; i < 5 && i < xTest.length; i++) {
        const pred = predictions[i];
        const actual = yTest[i];
        const confidence = Math.abs(xTest[i][0]) + Math.abs(xTest[i][5]); // WR diff + ELO diff
        
        console.log(chalk.white(`Game ${i + 1}: Predicted ${pred === 1 ? 'HOME' : 'AWAY'}, Actual ${actual === 1 ? 'HOME' : 'AWAY'} ${pred === actual ? '✅' : '❌'} (confidence: ${confidence.toFixed(2)})`));
      }
      
      console.log(chalk.bold.cyan('\n\n🚀 OPTIMIZED MODEL COMPLETE!'));
      console.log(chalk.yellow(`Achieved ${(accuracy * 100).toFixed(1)}% accuracy`));
      console.log(chalk.yellow('Ready for production use!'));
    } else {
      console.log(chalk.yellow('\n⚠️ Model needs improvement'));
      console.log(chalk.yellow(`Current: ${(accuracy * 100).toFixed(1)}% accuracy, ${(balance * 100).toFixed(1)}% balance`));
      console.log(chalk.yellow('Need: >55% accuracy OR (>52% accuracy AND >70% balance)'));
    }
    
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainOptimizedSuperModel().catch(console.error);