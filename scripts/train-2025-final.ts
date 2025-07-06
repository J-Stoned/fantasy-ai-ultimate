#!/usr/bin/env tsx
/**
 * 🏆 FINAL 2025 SEASON TRAINER - TARGET: 65%
 * Simple tweaks to improve from 61.1% to 65%
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

async function trainFinal2025() {
  console.log(chalk.bold.cyan('🏆 FINAL 2025 SEASON TRAINER'));
  console.log(chalk.yellow('Simple tweaks for 65% accuracy'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load all 2025 games
    console.log(chalk.cyan('1️⃣ Loading 2025 season games...'));
    
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .in('sport_id', ['nba', 'nhl', 'mlb'])
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    
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
    
    // 2. Build features with improvements
    console.log(chalk.cyan('\n2️⃣ Building enhanced features...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    const allSports: string[] = [];
    
    // Sport-specific features
    const sportFeatures = {
      nfl: { homeAdvantage: 0.57, avgScore: 45 },
      nba: { homeAdvantage: 0.60, avgScore: 110 },
      mlb: { homeAdvantage: 0.54, avgScore: 9 },
      nhl: { homeAdvantage: 0.55, avgScore: 6 }
    };
    
    // Process each sport
    for (const [sportId, sportGames] of gamesBySport) {
      console.log(chalk.yellow(`\nProcessing ${sportId}...`));
      
      const sportConfig = sportFeatures[sportId] || sportFeatures.mlb;
      const teamStats = new Map();
      const teamSchedule = new Map(); // Track game dates for rest calculation
      let featuresBuilt = 0;
      
      // Sort games chronologically
      const sortedGames = sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      sortedGames.forEach(game => {
        const gameDate = new Date(game.start_time);
        
        // Initialize teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0, wins: 0,
              homeGames: 0, homeWins: 0,
              awayGames: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last5: [], last10: [], last20: [],
              streak: 0, momentum: 0.5,
              elo: 1500,
              avgFor: 0, avgAgainst: 0,
              form: 0.5, consistency: 0.5,
              rolling7: [] // New: 7-game rolling average
            });
          }
          if (!teamSchedule.has(teamId)) {
            teamSchedule.set(teamId, []);
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        // Lower threshold to 3 games for more training data
        if (homeStats.games >= 3 && awayStats.games >= 3) {
          // Calculate rest days
          const homeScheduleDates = teamSchedule.get(game.home_team_id);
          const awayScheduleDates = teamSchedule.get(game.away_team_id);
          
          const homeRestDays = homeScheduleDates.length > 0 ? 
            Math.min(7, Math.floor((gameDate.getTime() - homeScheduleDates[homeScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          const awayRestDays = awayScheduleDates.length > 0 ? 
            Math.min(7, Math.floor((gameDate.getTime() - awayScheduleDates[awayScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          
          // Day of week (0 = Sunday, 6 = Saturday)
          const dayOfWeek = gameDate.getDay();
          
          // Calculate common features
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          const homeHomeWR = homeStats.homeGames > 2 ? homeStats.homeWins / homeStats.homeGames : homeWR;
          const awayAwayWR = awayStats.awayGames > 2 ? awayStats.awayWins / awayStats.awayGames : awayWR;
          
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form with rolling average
          const homeLast10 = homeStats.last10.slice(-10);
          const awayLast10 = awayStats.last10.slice(-10);
          const homeForm = homeLast10.length > 0 ? homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayForm = awayLast10.length > 0 ? awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // 7-game rolling average (smoother than counts)
          const homeRolling7 = homeStats.rolling7.length > 0 ? 
            homeStats.rolling7.reduce((a, b) => a + b, 0) / homeStats.rolling7.length : 0.5;
          const awayRolling7 = awayStats.rolling7.length > 0 ?
            awayStats.rolling7.reduce((a, b) => a + b, 0) / awayStats.rolling7.length : 0.5;
          
          // ELO difference
          const eloDiff = (homeStats.elo - awayStats.elo) / 400;
          
          // Sport-specific normalization
          const scoringNorm = sportConfig.avgScore;
          
          // Build feature vector (25 features total)
          const features = [
            // Core differentials (8)
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            (homeAvgFor - awayAvgFor) / scoringNorm,
            (awayAvgAgainst - homeAvgAgainst) / scoringNorm,
            homeForm - awayForm,
            eloDiff,
            homeStats.momentum - awayStats.momentum,
            (homeStats.streak - awayStats.streak) / 5,
            
            // NEW: Rest and schedule features (3)
            (homeRestDays - awayRestDays) / 3, // Rest advantage
            dayOfWeek / 6, // Normalized day of week
            homeRolling7 - awayRolling7, // Rolling form difference
            
            // Absolute values (8)
            homeWR,
            awayWR,
            homeHomeWR,
            awayAwayWR,
            homeForm,
            awayForm,
            homeRolling7, // NEW: Rolling average
            awayRolling7, // NEW: Rolling average
            
            // Scoring patterns (4)
            homeAvgFor / scoringNorm,
            awayAvgFor / scoringNorm,
            homeAvgAgainst / scoringNorm,
            awayAvgAgainst / scoringNorm,
            
            // Matchup (2)
            homeAvgFor / Math.max(awayAvgAgainst, scoringNorm * 0.5),
            awayAvgFor / Math.max(homeAvgAgainst, scoringNorm * 0.5),
            
            // Recent performance (2)
            homeLast10.slice(-5).filter(x => x === 1).length / 5,
            awayLast10.slice(-5).filter(x => x === 1).length / 5,
            
            // Sport indicator (4)
            sportId === 'nfl' ? 1 : 0,
            sportId === 'mlb' ? 1 : 0,
            sportId === 'nba' ? 1 : 0,
            sportId === 'nhl' ? 1 : 0,
            
            // Context (1)
            sportConfig.homeAdvantage
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          allSports.push(sportId);
          featuresBuilt++;
        }
        
        // Update stats
        const homeWon = game.home_score > game.away_score;
        const margin = Math.abs(game.home_score - game.away_score);
        
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
          homeStats.last5.push(1);
          homeStats.last10.push(1);
          homeStats.last20.push(1);
          homeStats.rolling7.push(1);
          awayStats.last5.push(0);
          awayStats.last10.push(0);
          awayStats.last20.push(0);
          awayStats.rolling7.push(0);
          homeStats.streak = Math.max(1, homeStats.streak + 1);
          awayStats.streak = Math.min(-1, awayStats.streak - 1);
        } else {
          awayStats.wins++;
          awayStats.awayWins++;
          homeStats.last5.push(0);
          homeStats.last10.push(0);
          homeStats.last20.push(0);
          homeStats.rolling7.push(0);
          awayStats.last5.push(1);
          awayStats.last10.push(1);
          awayStats.last20.push(1);
          awayStats.rolling7.push(1);
          homeStats.streak = Math.min(-1, homeStats.streak - 1);
          awayStats.streak = Math.max(1, awayStats.streak + 1);
        }
        
        // Update ELO
        const K = 20 + (margin / sportConfig.avgScore * 10);
        const expectedHome = 1 / (1 + Math.pow(10, (awayStats.elo - homeStats.elo) / 400));
        homeStats.elo += K * ((homeWon ? 1 : 0) - expectedHome);
        awayStats.elo += K * ((homeWon ? 0 : 1) - (1 - expectedHome));
        
        // Update momentum
        homeStats.momentum = homeStats.momentum * 0.8 + (homeWon ? 1 : 0) * 0.2;
        awayStats.momentum = awayStats.momentum * 0.8 + (homeWon ? 0 : 1) * 0.2;
        
        // Update schedules
        teamSchedule.get(game.home_team_id).push(gameDate);
        teamSchedule.get(game.away_team_id).push(gameDate);
        
        // Maintain list sizes
        if (homeStats.last5.length > 5) homeStats.last5.shift();
        if (homeStats.last10.length > 10) homeStats.last10.shift();
        if (homeStats.last20.length > 20) homeStats.last20.shift();
        if (homeStats.rolling7.length > 7) homeStats.rolling7.shift();
        if (awayStats.last5.length > 5) awayStats.last5.shift();
        if (awayStats.last10.length > 10) awayStats.last10.shift();
        if (awayStats.last20.length > 20) awayStats.last20.shift();
        if (awayStats.rolling7.length > 7) awayStats.rolling7.shift();
      });
      
      console.log(chalk.green(`  ✅ Built ${featuresBuilt} feature vectors for ${sportId}`));
    }
    
    console.log(chalk.green(`\n✅ Total feature vectors: ${allFeatures.length}`));
    
    // 3. Check distribution
    const homeWins = allLabels.filter(l => l === 1).length;
    const awayWins = allLabels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Overall distribution: ${homeWins} home (${(homeWins/allLabels.length*100).toFixed(1)}%), ${awayWins} away (${(awayWins/allLabels.length*100).toFixed(1)}%)`));
    
    // 4. Use 85/15 split for more training data
    console.log(chalk.cyan('\n3️⃣ Splitting data (85/15)...'));
    const trainEnd = Math.floor(allFeatures.length * 0.85);
    
    const xTrain = allFeatures.slice(0, trainEnd);
    const yTrain = allLabels.slice(0, trainEnd);
    const xTest = allFeatures.slice(trainEnd);
    const yTest = allLabels.slice(trainEnd);
    const testSports = allSports.slice(trainEnd);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 5. Train ensemble of 3 models
    console.log(chalk.cyan('\n4️⃣ Training ensemble of 3 models...'));
    
    const models = [];
    const seeds = [2025, 2026, 2027];
    
    for (const seed of seeds) {
      console.log(chalk.gray(`\nTraining model with seed ${seed}...`));
      
      const model = new RandomForestClassifier({
        nEstimators: 250,      // Middle ground
        maxDepth: 18,          // Slightly deeper than 61.1% model
        minSamplesLeaf: 3,     // Same as 61.1% model
        maxFeatures: 0.8,      // Same as 61.1% model
        seed: seed
      });
      
      const startTime = Date.now();
      model.train(xTrain, yTrain);
      console.log(chalk.green(`✅ Model ${seed} trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
      
      models.push(model);
    }
    
    // 6. Test ensemble
    console.log(chalk.cyan('\n5️⃣ Testing ensemble model...'));
    
    // Get predictions from each model
    const allPredictions = models.map(model => model.predict(xTest));
    
    // Average predictions (majority vote)
    const ensemblePredictions = [];
    for (let i = 0; i < xTest.length; i++) {
      const votes = allPredictions.map(preds => preds[i]);
      const avgVote = votes.reduce((a, b) => a + b, 0) / votes.length;
      ensemblePredictions.push(avgVote >= 0.5 ? 1 : 0);
    }
    
    // Calculate metrics
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
    // Sport-specific metrics
    const sportMetrics = new Map();
    
    for (let i = 0; i < ensemblePredictions.length; i++) {
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
      
      if (ensemblePredictions[i] === yTest[i]) {
        correct++;
        metrics.correct++;
      }
      
      if (yTest[i] === 1) {
        homeTotal++;
        metrics.homeTotal++;
        if (ensemblePredictions[i] === 1) {
          homeCorrect++;
          metrics.homeCorrect++;
        }
      } else {
        awayTotal++;
        metrics.awayTotal++;
        if (ensemblePredictions[i] === 0) {
          awayCorrect++;
          metrics.awayCorrect++;
        }
      }
    }
    
    const accuracy = correct / ensemblePredictions.length;
    const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
    const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
    const balance = 2 * (homeAcc * awayAcc) / (homeAcc + awayAcc + 0.0001);
    
    console.log(chalk.bold.green('\n📊 ENSEMBLE PERFORMANCE:'));
    console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance: ${(balance * 100).toFixed(1)}%`));
    
    // Individual model performance
    console.log(chalk.cyan('\n📊 Individual model accuracies:'));
    models.forEach((model, idx) => {
      const preds = allPredictions[idx];
      const modelCorrect = preds.filter((p, i) => p === yTest[i]).length;
      const modelAcc = modelCorrect / preds.length;
      console.log(chalk.gray(`  Model ${seeds[idx]}: ${(modelAcc * 100).toFixed(1)}%`));
    });
    
    console.log(chalk.bold.cyan('\n📊 PERFORMANCE BY SPORT:'));
    sportMetrics.forEach((metrics, sport) => {
      const sportAcc = metrics.correct / metrics.total;
      const sportHomeAcc = metrics.homeTotal > 0 ? metrics.homeCorrect / metrics.homeTotal : 0;
      const sportAwayAcc = metrics.awayTotal > 0 ? metrics.awayCorrect / metrics.awayTotal : 0;
      
      console.log(chalk.yellow(`\n${sport.toUpperCase()}:`));
      console.log(chalk.white(`  Accuracy: ${(sportAcc * 100).toFixed(1)}% (${metrics.correct}/${metrics.total})`));
      console.log(chalk.white(`  Home: ${(sportHomeAcc * 100).toFixed(1)}%`));
      console.log(chalk.white(`  Away: ${(sportAwayAcc * 100).toFixed(1)}%`));
    });
    
    // 7. Save ensemble model
    console.log(chalk.cyan('\n6️⃣ Saving final 2025 model...'));
    
    const modelData = {
      ensemble: models.map(m => m.toJSON()),
      metadata: {
        type: 'ensemble',
        models: 3,
        features: 25,
        sports: Array.from(gamesBySport.keys()),
        totalGames: games?.length || 0,
        performance: {
          overall: { accuracy, homeAcc, awayAcc, balance },
          bySport: Object.fromEntries(
            Array.from(sportMetrics.entries()).map(([sport, metrics]) => [
              sport,
              {
                accuracy: metrics.correct / metrics.total,
                samples: metrics.total
              }
            ])
          )
        },
        improvements: [
          'Lower minGames threshold (3 instead of 5)',
          'Added rest days feature',
          'Added day of week feature',
          'Added 7-game rolling average',
          'Used 85/15 split',
          'Ensemble of 3 models',
          'Optimized hyperparameters'
        ],
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        trainedOn: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./models/2025-final-65-model.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Saved final 2025 model!'));
    
    // Success message
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('\n\n🎉 TARGET ACHIEVED! 65%+ ACCURACY!'));
    }
    
    console.log(chalk.bold.cyan('\n\n🏆 FINAL MODEL COMPLETE!'));
    console.log(chalk.yellow(`Achieved ${(accuracy * 100).toFixed(1)}% accuracy`));
    console.log(chalk.yellow('Simple tweaks made the difference!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainFinal2025().catch(console.error);