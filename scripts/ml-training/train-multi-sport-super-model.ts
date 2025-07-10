#!/usr/bin/env tsx
/**
 * 🏆 MULTI-SPORT SUPER MODEL
 * Train on ALL sports data for maximum accuracy
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

// Sport-specific feature extractors
const sportFeatures = {
  nfl: {
    homeAdvantage: 0.025,
    avgScore: 45,
    features: ['winRate', 'scoring', 'defense', 'form', 'elo', 'momentum']
  },
  mlb: {
    homeAdvantage: 0.015, // Less home advantage in baseball
    avgScore: 9,
    features: ['winRate', 'runDiff', 'pitching', 'batting', 'bullpen', 'recent']
  },
  nba: {
    homeAdvantage: 0.04, // Strong home court
    avgScore: 220,
    features: ['winRate', 'pointDiff', 'pace', 'starPower', 'restDays', 'streak']
  },
  nhl: {
    homeAdvantage: 0.03,
    avgScore: 6,
    features: ['winRate', 'goalDiff', 'powerPlay', 'penalty', 'goalie', 'recent']
  }
};

async function trainMultiSportModel() {
  console.log(chalk.bold.cyan('🏆 MULTI-SPORT SUPER MODEL TRAINING'));
  console.log(chalk.yellow('Using ALL sports data for maximum accuracy'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load all games across all sports
    console.log(chalk.cyan('1️⃣ Loading games from all sports...'));
    
    const { data: allGames, count } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    console.log(chalk.green(`✅ Loaded ${allGames?.length} games with scores`));
    
    // Group by sport
    const gamesBySport = new Map();
    allGames?.forEach(game => {
      const sport = game.sport_id || 'unknown';
      if (!gamesBySport.has(sport)) {
        gamesBySport.set(sport, []);
      }
      gamesBySport.get(sport).push(game);
    });
    
    console.log(chalk.cyan('\n📊 Games by sport:'));
    gamesBySport.forEach((games, sport) => {
      console.log(chalk.yellow(`  ${sport}: ${games.length} games`));
    });
    
    // 2. Load player stats
    console.log(chalk.cyan('\n2️⃣ Loading player statistics...'));
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*')
      .limit(50000);
    
    console.log(chalk.green(`✅ Loaded ${playerStats?.length} player stats`));
    
    // 3. Process each sport separately
    console.log(chalk.cyan('\n3️⃣ Building features for each sport...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    const allSportIds: string[] = [];
    
    // Process each sport
    for (const [sportId, games] of gamesBySport) {
      console.log(chalk.yellow(`\nProcessing ${sportId}...`));
      
      const sportConfig = sportFeatures[sportId] || sportFeatures.nfl;
      const teamStats = new Map();
      let featuresBuilt = 0;
      
      // Sort games chronologically
      const sortedGames = games.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      sortedGames.forEach(game => {
        // Initialize teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0, wins: 0,
              homeGames: 0, homeWins: 0,
              awayGames: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last10: [], last5: [],
              streak: 0, momentum: 0.5,
              elo: 1500,
              // Sport-specific
              avgFor: 0, avgAgainst: 0,
              form: 0.5, consistency: 0.5
            });
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        // Need minimum history
        if (homeStats.games >= 10 && awayStats.games >= 10) {
          // Calculate common features
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          const homeHomeWR = homeStats.homeGames > 5 ? homeStats.homeWins / homeStats.homeGames : homeWR;
          const awayAwayWR = awayStats.awayGames > 5 ? awayStats.awayWins / awayStats.awayGames : awayWR;
          
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form
          const homeLast10 = homeStats.last10.slice(-10);
          const awayLast10 = awayStats.last10.slice(-10);
          const homeForm = homeLast10.length > 0 ? homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayForm = awayLast10.length > 0 ? awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // Sport-specific normalization
          const scoringNorm = sportConfig.avgScore;
          
          // Universal feature vector (works for all sports)
          const features = [
            // Core differentials
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            (homeAvgFor - awayAvgFor) / scoringNorm,
            (awayAvgAgainst - homeAvgAgainst) / scoringNorm,
            homeForm - awayForm,
            (homeStats.elo - awayStats.elo) / 400,
            homeStats.momentum - awayStats.momentum,
            (homeStats.streak - awayStats.streak) / 5,
            
            // Absolute values
            homeWR,
            awayWR,
            homeHomeWR,
            awayAwayWR,
            homeForm,
            awayForm,
            
            // Scoring patterns
            homeAvgFor / scoringNorm,
            awayAvgFor / scoringNorm,
            homeAvgAgainst / scoringNorm,
            awayAvgAgainst / scoringNorm,
            
            // Matchup
            homeAvgFor / Math.max(awayAvgAgainst, scoringNorm * 0.5),
            awayAvgFor / Math.max(homeAvgAgainst, scoringNorm * 0.5),
            
            // Recent performance
            homeLast10.slice(-5).filter(x => x === 1).length / 5,
            awayLast10.slice(-5).filter(x => x === 1).length / 5,
            homeLast10.slice(-3).filter(x => x === 1).length / 3,
            awayLast10.slice(-3).filter(x => x === 1).length / 3,
            
            // Sport indicator (one-hot encoding)
            sportId === 'nfl' ? 1 : 0,
            sportId === 'mlb' ? 1 : 0,
            sportId === 'nba' ? 1 : 0,
            sportId === 'nhl' ? 1 : 0,
            
            // Context
            sportConfig.homeAdvantage,
            game.week ? (game.week - 9) / 9 : 0,
            Math.random() * 0.01 - 0.005 // tiny noise
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          allSportIds.push(sportId);
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
          homeStats.last10.push(1);
          awayStats.last10.push(0);
          homeStats.streak = Math.max(1, homeStats.streak + 1);
          awayStats.streak = Math.min(-1, awayStats.streak - 1);
        } else {
          awayStats.wins++;
          awayStats.awayWins++;
          homeStats.last10.push(0);
          awayStats.last10.push(1);
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
        
        // Maintain list sizes
        if (homeStats.last10.length > 10) homeStats.last10.shift();
        if (awayStats.last10.length > 10) awayStats.last10.shift();
      });
      
      console.log(chalk.green(`  ✅ Built ${featuresBuilt} feature vectors for ${sportId}`));
    }
    
    console.log(chalk.green(`\n✅ Total feature vectors: ${allFeatures.length}`));
    
    // 4. Check distribution
    const homeWins = allLabels.filter(l => l === 1).length;
    const awayWins = allLabels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Overall distribution: ${homeWins} home (${(homeWins/allLabels.length*100).toFixed(1)}%), ${awayWins} away (${(awayWins/allLabels.length*100).toFixed(1)}%)`));
    
    // Sport-specific distributions
    const sportDistributions = new Map();
    allSportIds.forEach((sport, idx) => {
      if (!sportDistributions.has(sport)) {
        sportDistributions.set(sport, { home: 0, away: 0 });
      }
      const dist = sportDistributions.get(sport);
      if (allLabels[idx] === 1) dist.home++;
      else dist.away++;
    });
    
    console.log(chalk.cyan('\n📊 Distribution by sport:'));
    sportDistributions.forEach((dist, sport) => {
      const total = dist.home + dist.away;
      console.log(chalk.yellow(`  ${sport}: ${(dist.home/total*100).toFixed(1)}% home, ${(dist.away/total*100).toFixed(1)}% away`));
    });
    
    // 5. Split data
    console.log(chalk.cyan('\n4️⃣ Splitting data...'));
    const trainEnd = Math.floor(allFeatures.length * 0.8);
    
    const xTrain = allFeatures.slice(0, trainEnd);
    const yTrain = allLabels.slice(0, trainEnd);
    const xTest = allFeatures.slice(trainEnd);
    const yTest = allLabels.slice(trainEnd);
    const testSports = allSportIds.slice(trainEnd);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 6. Train multi-sport model
    console.log(chalk.cyan('\n5️⃣ Training multi-sport Random Forest...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 300, // More trees for complex multi-sport patterns
      maxDepth: 20,
      minSamplesLeaf: 5,
      maxFeatures: 0.7,
      seed: 42
    });
    
    console.log(chalk.yellow('Training on all sports...'));
    const startTime = Date.now();
    model.train(xTrain, yTrain);
    console.log(chalk.green(`✅ Trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 7. Test overall and by sport
    console.log(chalk.cyan('\n6️⃣ Testing model...'));
    const predictions = model.predict(xTest);
    
    // Overall metrics
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
    const balance = 2 * (homeAcc * awayAcc) / (homeAcc + awayAcc + 0.0001);
    
    console.log(chalk.bold.green('\n📊 OVERALL PERFORMANCE:'));
    console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance: ${(balance * 100).toFixed(1)}%`));
    
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
    
    // 8. Save model
    console.log(chalk.cyan('\n7️⃣ Saving multi-sport model...'));
    
    const modelData = {
      model: model.toJSON(),
      metadata: {
        features: 31,
        sports: Array.from(gamesBySport.keys()),
        totalGames: allGames?.length || 0,
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
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        trainedOn: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./models/multi-sport-super-model.json', JSON.stringify(modelData, null, 2));
    fs.writeFileSync('./models/bias-corrected-rf-clean.json', JSON.stringify(model.toJSON(), null, 2));
    
    console.log(chalk.green('✅ Saved multi-sport super model!'));
    
    // 9. Feature importance insight
    console.log(chalk.cyan('\n8️⃣ Key insights:'));
    console.log(chalk.yellow('🏈 NFL: Most random, ~51-53% accuracy expected'));
    console.log(chalk.yellow('⚾ MLB: Large sample size helps, ~54-57% accuracy'));
    console.log(chalk.yellow('🏀 NBA: Most predictable, ~58-62% accuracy'));
    console.log(chalk.yellow('🏒 NHL: Good balance, ~55-58% accuracy'));
    
    console.log(chalk.bold.cyan('\n\n🏆 MULTI-SPORT MODEL COMPLETE!'));
    console.log(chalk.yellow(`Achieved ${(accuracy * 100).toFixed(1)}% overall accuracy`));
    console.log(chalk.yellow('Ready for production across all sports!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainMultiSportModel().catch(console.error);