#!/usr/bin/env tsx
/**
 * 🎯 TRAIN A TRULY BALANCED MODEL
 * No overfitting, no bias, real accuracy
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

async function trainTrulyBalancedModel() {
  console.log(chalk.bold.cyan('🎯 TRAINING TRULY BALANCED MODEL'));
  console.log(chalk.yellow('Fixing overfitting and bias issues'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load MORE games for better generalization
    console.log(chalk.cyan('1️⃣ Loading large dataset...'));
    
    const { data: allGames } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true })
      .limit(30000); // 30K games
    
    console.log(chalk.green(`✅ Loaded ${allGames?.length} games`));
    
    // 2. Split data PROPERLY - chronologically!
    console.log(chalk.cyan('\n2️⃣ Splitting data chronologically...'));
    const splitPoint = Math.floor((allGames?.length || 0) * 0.7);
    const trainingGames = allGames?.slice(0, splitPoint) || [];
    const testGames = allGames?.slice(splitPoint) || [];
    
    console.log(chalk.yellow(`Training: ${trainingGames.length} games`));
    console.log(chalk.yellow(`Testing: ${testGames.length} games`));
    
    // 3. Build features with NORMALIZATION
    console.log(chalk.cyan('\n3️⃣ Building normalized features...'));
    
    const teamStats = new Map();
    const features: number[][] = [];
    const labels: number[] = [];
    
    // Build rolling team statistics
    const processGames = (games: any[], isTraining: boolean) => {
      const gameFeatures: number[][] = [];
      const gameLabels: number[] = [];
      
      games.forEach((game, idx) => {
        // Initialize teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0,
              wins: 0,
              totalFor: 0,
              totalAgainst: 0,
              homeGames: 0,
              homeWins: 0,
              awayGames: 0,
              awayWins: 0,
              last10: [],
              elo: 1500 // ELO rating
            });
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        // Only use games after teams have history
        if (homeStats.games >= 5 && awayStats.games >= 5) {
          // Calculate NORMALIZED features
          const homeWinRate = homeStats.wins / homeStats.games;
          const awayWinRate = awayStats.wins / awayStats.games;
          
          // Home/away specific rates
          const homeHomeWR = homeStats.homeGames > 0 ? homeStats.homeWins / homeStats.homeGames : 0.5;
          const awayAwayWR = awayStats.awayGames > 0 ? awayStats.awayWins / awayStats.awayGames : 0.5;
          
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Last 10 games form
          const homeLast10 = homeStats.last10.slice(-10);
          const awayLast10 = awayStats.last10.slice(-10);
          const homeRecent = homeLast10.length > 0 ? 
            homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayRecent = awayLast10.length > 0 ? 
            awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // ELO difference
          const eloDiff = (homeStats.elo - awayStats.elo) / 400; // Normalized
          
          // Build BALANCED feature vector
          const featureVector = [
            // Core differentials (normalized to [-1, 1] range)
            Math.tanh((homeWinRate - awayWinRate) * 3),           // 0. Overall win rate diff
            Math.tanh((homeHomeWR - awayAwayWR) * 3),             // 1. Situational win rate
            Math.tanh((homeAvgFor - awayAvgFor) / 20),            // 2. Scoring differential
            Math.tanh((awayAvgAgainst - homeAvgAgainst) / 20),    // 3. Defense differential
            Math.tanh((homeRecent - awayRecent) * 3),             // 4. Recent form diff
            
            // Context features
            Math.tanh(eloDiff),                                    // 5. ELO rating diff
            homeStats.games > 20 ? 0.1 : -0.1,                    // 6. Experience factor
            awayStats.games > 20 ? 0.1 : -0.1,                    // 7. Away experience
            
            // Matchup features
            Math.tanh((homeAvgFor / Math.max(awayAvgAgainst, 70) - 1) * 2),  // 8. Off vs Def
            Math.tanh((awayAvgFor / Math.max(homeAvgAgainst, 70) - 1) * 2),  // 9. Away Off vs Def
            
            // Performance indicators
            Math.tanh((homeAvgFor - homeAvgAgainst) / 10),        // 10. Home net rating
            Math.tanh((awayAvgFor - awayAvgAgainst) / 10),        // 11. Away net rating
            
            // Adjusted home advantage (much smaller!)
            0.02,                                                  // 12. Tiny home advantage
            
            // Streak features
            homeStats.last10.slice(-3).every(v => v === 1) ? 0.2 : 0,  // 13. Home hot streak
            awayStats.last10.slice(-3).every(v => v === 1) ? 0.2 : 0   // 14. Away hot streak
          ];
          
          gameFeatures.push(featureVector);
          gameLabels.push(game.home_score > game.away_score ? 1 : 0);
        }
        
        // Update team stats AFTER using them
        updateTeamStats(homeStats, awayStats, game);
        
        if (idx % 2000 === 0) {
          console.log(chalk.gray(`Processed ${idx}/${games.length} games...`));
        }
      });
      
      return { features: gameFeatures, labels: gameLabels };
    };
    
    // Process training data
    const trainingData = processGames(trainingGames, true);
    console.log(chalk.green(`✅ Built ${trainingData.features.length} training samples`));
    
    // 4. Balance training data PROPERLY
    console.log(chalk.cyan('\n4️⃣ Balancing training data...'));
    const balanced = smartBalance(trainingData.features, trainingData.labels);
    console.log(chalk.green(`✅ Balanced: ${balanced.labels.filter(l => l === 1).length} home, ${balanced.labels.filter(l => l === 0).length} away`));
    
    // 5. Train with REGULARIZATION
    console.log(chalk.cyan('\n5️⃣ Training with regularization...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 150,          // Not too many trees
      maxDepth: 12,              // Limited depth to prevent overfitting
      minSamplesLeaf: 10,        // Higher minimum samples
      maxFeatures: 0.7,          // Don't use all features (prevents overfitting)
      replacement: true,
      seed: 42
    });
    
    console.log(chalk.yellow('Training on balanced data...'));
    const startTime = Date.now();
    model.train(balanced.features, balanced.labels);
    const trainTime = (Date.now() - startTime) / 1000;
    console.log(chalk.green(`✅ Model trained in ${trainTime.toFixed(1)}s`));
    
    // 6. Test on SEPARATE test set
    console.log(chalk.cyan('\n6️⃣ Testing on separate test set...'));
    
    // Reset team stats and process test games
    teamStats.clear();
    const testData = processGames(testGames, false);
    console.log(chalk.yellow(`Testing on ${testData.features.length} games...`));
    
    // Make predictions
    const predictions = model.predict(testData.features);
    
    // Calculate REAL metrics
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === testData.labels[i]) correct++;
      
      if (testData.labels[i] === 1) {
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
    
    console.log(chalk.bold.green('\n📊 TRUE TEST RESULTS:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance Score: ${(balance * 100).toFixed(1)}%`));
    
    // 7. Save if good
    if (balance > 0.65 && accuracy > 0.55) {
      console.log(chalk.cyan('\n7️⃣ Saving balanced model...'));
      
      const modelJSON = model.toJSON();
      fs.writeFileSync('./models/truly-balanced-model.json', JSON.stringify(modelJSON, null, 2));
      fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(modelJSON, null, 2));
      
      console.log(chalk.green('✅ Saved truly balanced model!'));
    } else {
      console.log(chalk.yellow('\n⚠️ Model not balanced enough, not saving'));
    }
    
    console.log(chalk.bold.cyan('\n🎯 BALANCED TRAINING COMPLETE!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

function updateTeamStats(homeStats: any, awayStats: any, game: any) {
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
  } else {
    homeStats.losses++;
    awayStats.wins++;
    awayStats.awayWins++;
    homeStats.last10.push(0);
    awayStats.last10.push(1);
  }
  
  // Update ELO ratings
  const K = 32; // ELO K-factor
  const expectedHome = 1 / (1 + Math.pow(10, (awayStats.elo - homeStats.elo) / 400));
  const expectedAway = 1 - expectedHome;
  
  homeStats.elo += K * ((homeWon ? 1 : 0) - expectedHome);
  awayStats.elo += K * ((homeWon ? 0 : 1) - expectedAway);
  
  // Keep last 10 games only
  if (homeStats.last10.length > 10) homeStats.last10.shift();
  if (awayStats.last10.length > 10) awayStats.last10.shift();
}

function smartBalance(features: number[][], labels: number[]) {
  // Group by approximate team strength
  const groups: { strong: any[], medium: any[], weak: any[] } = {
    strong: [],
    medium: [],
    weak: []
  };
  
  features.forEach((feat, idx) => {
    const strength = feat[0]; // Win rate difference
    if (strength > 0.2) {
      groups.strong.push({ features: feat, label: labels[idx] });
    } else if (strength < -0.2) {
      groups.weak.push({ features: feat, label: labels[idx] });
    } else {
      groups.medium.push({ features: feat, label: labels[idx] });
    }
  });
  
  // Balance within each group
  const balanced = { features: [] as number[][], labels: [] as number[] };
  
  Object.values(groups).forEach(group => {
    const homeWins = group.filter(g => g.label === 1);
    const awayWins = group.filter(g => g.label === 0);
    const minSize = Math.min(homeWins.length, awayWins.length);
    
    // Take equal from each
    for (let i = 0; i < minSize; i++) {
      balanced.features.push(homeWins[i].features);
      balanced.labels.push(1);
      balanced.features.push(awayWins[i].features);
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
    features: indices.map(i => balanced.features[i]),
    labels: indices.map(i => balanced.labels[i])
  };
}

trainTrulyBalancedModel().catch(console.error);