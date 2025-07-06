#!/usr/bin/env tsx
/**
 * 🏆 2025 SEASON MULTI-SPORT TRAINER
 * Using ALL 2025 season data!
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

async function train2025Seasons() {
  console.log(chalk.bold.cyan('🏆 2025 SEASON MULTI-SPORT TRAINER'));
  console.log(chalk.yellow('Training on NBA playoffs, NHL finals, MLB peak season!'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load 2025 games
    console.log(chalk.cyan('1️⃣ Loading 2025 season games...'));
    
    // Get all games with scores from our active sports
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .in('sport_id', ['nba', 'nhl', 'mlb'])
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error(chalk.red('Error loading games:'), error);
      return;
    }
    
    console.log(chalk.green(`✅ Loaded ${games?.length} games with scores`));
    
    // Group by sport
    const gamesBySport = new Map();
    games?.forEach(game => {
      const sport = game.sport_id;
      if (!gamesBySport.has(sport)) {
        gamesBySport.set(sport, []);
      }
      gamesBySport.get(sport).push(game);
    });
    
    console.log(chalk.cyan('\n📊 2025 Season Games:'));
    gamesBySport.forEach((sportGames, sport) => {
      console.log(chalk.yellow(`  ${sport.toUpperCase()}: ${sportGames.length} games`));
    });
    
    // 2. Build features
    console.log(chalk.cyan('\n2️⃣ Building features...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    const allSports: string[] = [];
    
    // Process each sport
    for (const [sportId, sportGames] of gamesBySport) {
      console.log(chalk.yellow(`\nProcessing ${sportId}...`));
      
      // Track team stats
      const teamStats = new Map();
      let featuresBuilt = 0;
      
      // Sort games chronologically
      const sortedGames = sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      sortedGames.forEach(game => {
        // Initialize teams if needed
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0,
              wins: 0,
              losses: 0,
              homeGames: 0,
              homeWins: 0,
              awayGames: 0,
              awayWins: 0,
              totalFor: 0,
              totalAgainst: 0,
              last5: [],
              last10: [],
              streak: 0,
              momentum: 0.5,
              avgFor: 0,
              avgAgainst: 0
            });
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        // Need minimum games for meaningful features
        if (homeStats.games >= 5 && awayStats.games >= 5) {
          // Calculate features
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          
          const homeHomeWR = homeStats.homeGames > 0 ? homeStats.homeWins / homeStats.homeGames : 0.5;
          const awayAwayWR = awayStats.awayGames > 0 ? awayStats.awayWins / awayStats.awayGames : 0.5;
          
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form
          const homeLast5 = homeStats.last5.slice(-5);
          const awayLast5 = awayStats.last5.slice(-5);
          const homeForm = homeLast5.length > 0 ? homeLast5.reduce((a, b) => a + b, 0) / homeLast5.length : 0.5;
          const awayForm = awayLast5.length > 0 ? awayLast5.reduce((a, b) => a + b, 0) / awayLast5.length : 0.5;
          
          // Sport-specific scoring normalization
          const scoringNorm = sportId === 'nba' ? 110 : sportId === 'mlb' ? 5 : sportId === 'nhl' ? 3 : 50;
          
          // Build feature vector
          const features = [
            // Win rate differentials
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            
            // Scoring differentials (normalized)
            (homeAvgFor - awayAvgFor) / scoringNorm,
            (awayAvgAgainst - homeAvgAgainst) / scoringNorm,
            
            // Form and momentum
            homeForm - awayForm,
            homeStats.momentum - awayStats.momentum,
            (homeStats.streak - awayStats.streak) / 5,
            
            // Absolute values
            homeWR,
            awayWR,
            homeForm,
            awayForm,
            
            // Scoring patterns
            homeAvgFor / scoringNorm,
            awayAvgFor / scoringNorm,
            homeAvgAgainst / scoringNorm,
            awayAvgAgainst / scoringNorm,
            
            // Head-to-head potential
            homeAvgFor / Math.max(awayAvgAgainst, 1),
            awayAvgFor / Math.max(homeAvgAgainst, 1),
            
            // Sport indicators
            sportId === 'nba' ? 1 : 0,
            sportId === 'mlb' ? 1 : 0,
            sportId === 'nhl' ? 1 : 0,
            
            // Context
            sportId === 'nba' ? 0.6 : sportId === 'nhl' ? 0.55 : 0.54, // home advantage
            Math.random() * 0.01 // tiny noise
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          allSports.push(sportId);
          featuresBuilt++;
        }
        
        // Update stats
        const homeWon = game.home_score > game.away_score;
        
        homeStats.games++;
        awayStats.games++;
        homeStats.homeGames++;
        awayStats.awayGames++;
        
        if (homeWon) {
          homeStats.wins++;
          homeStats.homeWins++;
          awayStats.losses++;
          homeStats.last5.push(1);
          homeStats.last10.push(1);
          awayStats.last5.push(0);
          awayStats.last10.push(0);
          homeStats.streak = Math.max(1, homeStats.streak + 1);
          awayStats.streak = Math.min(-1, awayStats.streak - 1);
        } else {
          awayStats.wins++;
          awayStats.awayWins++;
          homeStats.losses++;
          homeStats.last5.push(0);
          homeStats.last10.push(0);
          awayStats.last5.push(1);
          awayStats.last10.push(1);
          awayStats.streak = Math.max(1, awayStats.streak + 1);
          homeStats.streak = Math.min(-1, homeStats.streak - 1);
        }
        
        homeStats.totalFor += game.home_score;
        homeStats.totalAgainst += game.away_score;
        awayStats.totalFor += game.away_score;
        awayStats.totalAgainst += game.home_score;
        
        // Update momentum
        homeStats.momentum = homeStats.momentum * 0.7 + (homeWon ? 1 : 0) * 0.3;
        awayStats.momentum = awayStats.momentum * 0.7 + (homeWon ? 0 : 1) * 0.3;
        
        // Maintain list sizes
        if (homeStats.last5.length > 5) homeStats.last5.shift();
        if (homeStats.last10.length > 10) homeStats.last10.shift();
        if (awayStats.last5.length > 5) awayStats.last5.shift();
        if (awayStats.last10.length > 10) awayStats.last10.shift();
      });
      
      console.log(chalk.green(`  ✅ Built ${featuresBuilt} feature vectors`));
    }
    
    console.log(chalk.green(`\n✅ Total feature vectors: ${allFeatures.length}`));
    
    if (allFeatures.length === 0) {
      console.log(chalk.red('No features built! Need more games.'));
      return;
    }
    
    // 3. Check distribution
    const homeWins = allLabels.filter(l => l === 1).length;
    const awayWins = allLabels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Distribution: ${homeWins} home (${(homeWins/allLabels.length*100).toFixed(1)}%), ${awayWins} away`));
    
    // 4. Split data
    console.log(chalk.cyan('\n3️⃣ Splitting data (80/20)...'));
    const trainEnd = Math.floor(allFeatures.length * 0.8);
    
    const xTrain = allFeatures.slice(0, trainEnd);
    const yTrain = allLabels.slice(0, trainEnd);
    const xTest = allFeatures.slice(trainEnd);
    const yTest = allLabels.slice(trainEnd);
    const testSports = allSports.slice(trainEnd);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 5. Train model
    console.log(chalk.cyan('\n4️⃣ Training 2025 Season Random Forest...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 200,
      maxDepth: 15,
      minSamplesLeaf: 3,
      maxFeatures: 0.8,
      seed: 2025
    });
    
    const startTime = Date.now();
    model.train(xTrain, yTrain);
    console.log(chalk.green(`✅ Trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 6. Test model
    console.log(chalk.cyan('\n5️⃣ Testing model...'));
    const predictions = model.predict(xTest);
    
    // Calculate metrics
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
    // Sport-specific metrics
    const sportMetrics = new Map();
    
    for (let i = 0; i < predictions.length; i++) {
      const sport = testSports[i];
      if (!sportMetrics.has(sport)) {
        sportMetrics.set(sport, {
          correct: 0, total: 0,
          homeCorrect: 0, homeTotal: 0,
          awayCorrect: 0, awayTotal: 0
        });
      }
      
      const metrics = sportMetrics.get(sport);
      metrics.total++;
      
      if (predictions[i] === yTest[i]) {
        correct++;
        metrics.correct++;
      }
      
      if (yTest[i] === 1) {
        homeTotal++;
        metrics.homeTotal++;
        if (predictions[i] === 1) {
          homeCorrect++;
          metrics.homeCorrect++;
        }
      } else {
        awayTotal++;
        metrics.awayTotal++;
        if (predictions[i] === 0) {
          awayCorrect++;
          metrics.awayCorrect++;
        }
      }
    }
    
    const accuracy = correct / predictions.length;
    const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
    const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
    
    console.log(chalk.bold.green('\n📊 2025 SEASON PERFORMANCE:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    
    console.log(chalk.bold.cyan('\n📊 BY SPORT:'));
    sportMetrics.forEach((metrics, sport) => {
      if (metrics.total > 0) {
        const sportAcc = metrics.correct / metrics.total;
        console.log(chalk.yellow(`\n${sport.toUpperCase()}:`));
        console.log(chalk.white(`  Accuracy: ${(sportAcc * 100).toFixed(1)}% (${metrics.correct}/${metrics.total})`));
      }
    });
    
    // 7. Save model
    console.log(chalk.cyan('\n6️⃣ Saving 2025 season model...'));
    
    const modelData = {
      model: model.toJSON(),
      metadata: {
        name: '2025 Multi-Sport Model',
        features: 22,
        sports: Array.from(gamesBySport.keys()),
        totalGames: games?.length || 0,
        performance: {
          overall: { accuracy, homeAcc, awayAcc },
          bySport: Object.fromEntries(
            Array.from(sportMetrics.entries()).map(([sport, metrics]) => [
              sport,
              {
                accuracy: metrics.total > 0 ? metrics.correct / metrics.total : 0,
                samples: metrics.total
              }
            ])
          )
        },
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        trainedOn: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./models/2025-season-model.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Saved 2025 season model!'));
    
    console.log(chalk.bold.cyan('\n\n🏆 2025 SEASON MODEL COMPLETE!'));
    console.log(chalk.yellow(`Achieved ${(accuracy * 100).toFixed(1)}% accuracy on current season data`));
    console.log(chalk.yellow('NBA Playoffs + NHL Finals + MLB Season = Best predictions!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

train2025Seasons().catch(console.error);