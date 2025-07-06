#!/usr/bin/env tsx
/**
 * 🏆 OPTIMIZED 2025 SEASON TRAINER
 * Practical improvements for 65%+ accuracy
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

// Sport-specific configurations
const sportConfigs = {
  nba: {
    homeAdvantage: 0.604,
    avgScore: 110,
    momentum_weight: 0.35,
    recent_games_weight: 0.4,
    minGames: 3 // Lower threshold for more data
  },
  mlb: {
    homeAdvantage: 0.542,
    avgScore: 4.5,
    momentum_weight: 0.25,
    recent_games_weight: 0.3,
    minGames: 5
  },
  nhl: {
    homeAdvantage: 0.548,
    avgScore: 3,
    momentum_weight: 0.3,
    recent_games_weight: 0.35,
    minGames: 3
  }
};

async function trainOptimized2025() {
  console.log(chalk.bold.cyan('🏆 OPTIMIZED 2025 SEASON TRAINER'));
  console.log(chalk.yellow('Practical improvements for 65%+ accuracy'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load all 2025 games
    console.log(chalk.cyan('1️⃣ Loading 2025 season games...'));
    
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .in('sport_id', ['nba', 'nhl', 'mlb'])
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    
    console.log(chalk.green(`✅ Loaded ${games?.length} games`));
    
    // 2. Build optimized features
    console.log(chalk.cyan('\n2️⃣ Building optimized features...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    const allSports: string[] = [];
    
    // Group by sport
    const gamesBySport = new Map();
    games?.forEach(game => {
      if (!gamesBySport.has(game.sport_id)) {
        gamesBySport.set(game.sport_id, []);
      }
      gamesBySport.get(game.sport_id).push(game);
    });
    
    // Process each sport
    for (const [sportId, sportGames] of gamesBySport) {
      console.log(chalk.yellow(`\nProcessing ${sportId}...`));
      
      const config = sportConfigs[sportId];
      const teamStats = new Map();
      const teamElo = new Map();
      const h2hRecords = new Map();
      let featuresBuilt = 0;
      
      // Initialize ELO ratings
      sportGames.forEach(game => {
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamElo.has(teamId)) {
            teamElo.set(teamId, 1500);
          }
        });
      });
      
      // Sort games chronologically
      const sortedGames = sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      for (const game of sortedGames) {
        // Initialize teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0, wins: 0,
              homeGames: 0, homeWins: 0,
              awayGames: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last3: [], last5: [], last10: [],
              homeStreak: 0, awayStreak: 0,
              momentum: 0.5,
              form: 0.5,
              consistency: 0.5
            });
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        // Build features if we have minimum games
        if (homeStats.games >= config.minGames && awayStats.games >= config.minGames) {
          // Get ELO ratings
          const homeElo = teamElo.get(game.home_team_id) || 1500;
          const awayElo = teamElo.get(game.away_team_id) || 1500;
          const eloDiff = homeElo - awayElo;
          const eloProb = 1 / (1 + Math.pow(10, -eloDiff / 400));
          
          // Calculate win rates
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          const homeHomeWR = homeStats.homeGames > 0 ? homeStats.homeWins / homeStats.homeGames : homeWR;
          const awayAwayWR = awayStats.awayGames > 0 ? awayStats.awayWins / awayStats.awayGames : awayWR;
          
          // Scoring averages
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form (weighted by recency)
          const homeRecent = [...homeStats.last3.map((v, i) => v * (1 + i * 0.1)), 
                             ...homeStats.last5.slice(3).map(v => v * 0.8),
                             ...homeStats.last10.slice(5).map(v => v * 0.6)];
          const awayRecent = [...awayStats.last3.map((v, i) => v * (1 + i * 0.1)),
                             ...awayStats.last5.slice(3).map(v => v * 0.8),
                             ...awayStats.last10.slice(5).map(v => v * 0.6)];
          
          const homeForm = homeRecent.length > 0 ? 
            homeRecent.reduce((a, b) => a + b, 0) / homeRecent.reduce((a, b) => a + (b > 0 ? 1 : 1), 0) : 0.5;
          const awayForm = awayRecent.length > 0 ? 
            awayRecent.reduce((a, b) => a + b, 0) / awayRecent.reduce((a, b) => a + (b > 0 ? 1 : 1), 0) : 0.5;
          
          // Pythagorean expectation
          const homePythag = Math.pow(homeAvgFor, 2) / (Math.pow(homeAvgFor, 2) + Math.pow(homeAvgAgainst, 2));
          const awayPythag = Math.pow(awayAvgFor, 2) / (Math.pow(awayAvgFor, 2) + Math.pow(awayAvgAgainst, 2));
          
          // Head-to-head
          const h2hKey = `${Math.min(game.home_team_id, game.away_team_id)}-${Math.max(game.home_team_id, game.away_team_id)}`;
          const h2h = h2hRecords.get(h2hKey) || { home: 0, away: 0, games: 0 };
          const h2hRate = h2h.games > 0 ? 
            (game.home_team_id < game.away_team_id ? h2h.home : h2h.away) / h2h.games : 0.5;
          
          // Consistency (lower variance in last 10)
          const homeVar = homeStats.last10.length > 5 ? 
            homeStats.last10.reduce((sum, v, _, arr) => sum + Math.pow(v - arr.reduce((a,b) => a+b) / arr.length, 2), 0) / homeStats.last10.length : 0.25;
          const awayVar = awayStats.last10.length > 5 ?
            awayStats.last10.reduce((sum, v, _, arr) => sum + Math.pow(v - arr.reduce((a,b) => a+b) / arr.length, 2), 0) / awayStats.last10.length : 0.25;
          
          // Build optimized feature vector
          const features = [
            // Core differentials (10 features)
            eloDiff / 400,
            eloProb,
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            homePythag - awayPythag,
            homeForm - awayForm,
            homeStats.momentum - awayStats.momentum,
            (homeAvgFor - awayAvgFor) / config.avgScore,
            (awayAvgAgainst - homeAvgAgainst) / config.avgScore,
            (homeStats.homeStreak - awayStats.awayStreak) / 5,
            
            // Absolute metrics (8 features)
            homeWR,
            awayWR,
            homePythag,
            awayPythag,
            homeForm,
            awayForm,
            1 - homeVar, // consistency
            1 - awayVar,
            
            // Advanced metrics (7 features)
            h2hRate,
            h2h.games > 0 ? Math.min(h2h.games / 5, 1) : 0, // h2h reliability
            homeAvgFor / Math.max(awayAvgAgainst, 1),
            awayAvgFor / Math.max(homeAvgAgainst, 1),
            Math.log((homeAvgFor + 1) / (homeAvgAgainst + 1)),
            Math.log((awayAvgFor + 1) / (awayAvgAgainst + 1)),
            (homeStats.last3.filter(v => v === 1).length - awayStats.last3.filter(v => v === 1).length) / 3,
            
            // Context (5 features)
            config.homeAdvantage,
            sportId === 'nba' ? 1 : 0,
            sportId === 'mlb' ? 1 : 0,
            sportId === 'nhl' ? 1 : 0,
            game.metadata?.playoffs ? 1.5 : 1, // playoff intensity
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          allSports.push(sportId);
          featuresBuilt++;
        }
        
        // Update stats AFTER using them
        const homeWon = game.home_score > game.away_score;
        
        // Update basic stats
        homeStats.games++;
        awayStats.games++;
        homeStats.homeGames++;
        awayStats.awayGames++;
        
        if (homeWon) {
          homeStats.wins++;
          homeStats.homeWins++;
          homeStats.last3.push(1);
          homeStats.last5.push(1);
          homeStats.last10.push(1);
          awayStats.last3.push(0);
          awayStats.last5.push(0);
          awayStats.last10.push(0);
          homeStats.homeStreak = Math.max(1, homeStats.homeStreak + 1);
          awayStats.awayStreak = Math.min(-1, awayStats.awayStreak - 1);
        } else {
          awayStats.wins++;
          awayStats.awayWins++;
          homeStats.last3.push(0);
          homeStats.last5.push(0);
          homeStats.last10.push(0);
          awayStats.last3.push(1);
          awayStats.last5.push(1);
          awayStats.last10.push(1);
          awayStats.awayStreak = Math.max(1, awayStats.awayStreak + 1);
          homeStats.homeStreak = Math.min(-1, homeStats.homeStreak - 1);
        }
        
        // Update scoring
        homeStats.totalFor += game.home_score;
        homeStats.totalAgainst += game.away_score;
        awayStats.totalFor += game.away_score;
        awayStats.totalAgainst += game.home_score;
        
        // Update momentum
        homeStats.momentum = homeStats.momentum * (1 - config.momentum_weight) + (homeWon ? 1 : 0) * config.momentum_weight;
        awayStats.momentum = awayStats.momentum * (1 - config.momentum_weight) + (homeWon ? 0 : 1) * config.momentum_weight;
        
        // Update form
        if (homeStats.last5.length >= 3) {
          homeStats.form = homeStats.last5.slice(-5).reduce((a, b) => a + b, 0) / Math.min(homeStats.last5.length, 5);
        }
        if (awayStats.last5.length >= 3) {
          awayStats.form = awayStats.last5.slice(-5).reduce((a, b) => a + b, 0) / Math.min(awayStats.last5.length, 5);
        }
        
        // Maintain list sizes
        if (homeStats.last3.length > 3) homeStats.last3.shift();
        if (homeStats.last5.length > 5) homeStats.last5.shift();
        if (homeStats.last10.length > 10) homeStats.last10.shift();
        if (awayStats.last3.length > 3) awayStats.last3.shift();
        if (awayStats.last5.length > 5) awayStats.last5.shift();
        if (awayStats.last10.length > 10) awayStats.last10.shift();
        
        // Update ELO
        const K = 20 + Math.log(Math.abs(game.home_score - game.away_score) + 1) * 5;
        const expectedHome = 1 / (1 + Math.pow(10, (teamElo.get(game.away_team_id) - teamElo.get(game.home_team_id)) / 400));
        teamElo.set(game.home_team_id, teamElo.get(game.home_team_id) + K * ((homeWon ? 1 : 0) - expectedHome));
        teamElo.set(game.away_team_id, teamElo.get(game.away_team_id) + K * ((homeWon ? 0 : 1) - (1 - expectedHome)));
        
        // Update h2h
        const h2hKey = `${Math.min(game.home_team_id, game.away_team_id)}-${Math.max(game.home_team_id, game.away_team_id)}`;
        if (!h2hRecords.has(h2hKey)) {
          h2hRecords.set(h2hKey, { home: 0, away: 0, games: 0 });
        }
        const h2h = h2hRecords.get(h2hKey);
        h2h.games++;
        if (homeWon) {
          if (game.home_team_id < game.away_team_id) h2h.home++;
          else h2h.away++;
        } else {
          if (game.away_team_id < game.home_team_id) h2h.home++;
          else h2h.away++;
        }
      }
      
      console.log(chalk.green(`  ✅ Built ${featuresBuilt} feature vectors`));
    }
    
    console.log(chalk.green(`\n✅ Total feature vectors: ${allFeatures.length}`));
    
    if (allFeatures.length < 100) {
      console.log(chalk.red('Insufficient data for reliable training'));
      return;
    }
    
    // 3. Balance check
    const homeWins = allLabels.filter(l => l === 1).length;
    console.log(chalk.yellow(`Distribution: ${homeWins} home (${(homeWins/allLabels.length*100).toFixed(1)}%), ${allLabels.length - homeWins} away`));
    
    // 4. Smart split with temporal ordering
    console.log(chalk.cyan('\n3️⃣ Creating temporal train/test split...'));
    const trainEnd = Math.floor(allFeatures.length * 0.85);
    
    const xTrain = allFeatures.slice(0, trainEnd);
    const yTrain = allLabels.slice(0, trainEnd);
    const xTest = allFeatures.slice(trainEnd);
    const yTest = allLabels.slice(trainEnd);
    const testSports = allSports.slice(trainEnd);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 5. Train optimized model
    console.log(chalk.cyan('\n4️⃣ Training optimized Random Forest...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 500,      // More trees
      maxDepth: 25,          // Deeper trees
      minSamplesLeaf: 2,     // Allow smaller leaves
      maxFeatures: 0.8,      // Use 80% of features
      seed: 2025
    });
    
    const startTime = Date.now();
    model.train(xTrain, yTrain);
    console.log(chalk.green(`✅ Trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 6. Evaluate
    console.log(chalk.cyan('\n5️⃣ Evaluating model...'));
    const predictions = model.predict(xTest);
    
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
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
    
    console.log(chalk.bold.green('\n📊 OPTIMIZED MODEL PERFORMANCE:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    
    // 7. Save if good enough
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('\n🎉 65% TARGET ACHIEVED!'));
    }
    
    console.log(chalk.cyan('\n6️⃣ Saving optimized model...'));
    
    const modelData = {
      model: model.toJSON(),
      metadata: {
        name: '2025 Optimized Multi-Sport Model',
        version: '3.0',
        features: 30,
        sports: Array.from(gamesBySport.keys()),
        totalGames: games?.length || 0,
        performance: {
          overall: { 
            accuracy, 
            homeAccuracy: homeAcc, 
            awayAccuracy: awayAcc,
            samples: xTest.length
          },
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
        features: [
          'ELO-based probability',
          'Pythagorean expectation',
          'Weighted recent form',
          'Head-to-head history',
          'Home/away specific rates',
          'Momentum tracking',
          'Consistency metrics',
          'Playoff intensity boost'
        ],
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        trainedOn: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./models/2025-optimized-model.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Saved optimized model!'));
    
    // Sport breakdown
    console.log(chalk.bold.cyan('\n📊 PERFORMANCE BY SPORT:'));
    sportMetrics.forEach((metrics, sport) => {
      if (metrics.total > 0) {
        const sportAcc = metrics.correct / metrics.total;
        console.log(chalk.yellow(`\n${sport.toUpperCase()}:`));
        console.log(chalk.white(`  Accuracy: ${(sportAcc * 100).toFixed(1)}% (${metrics.correct}/${metrics.total})`));
        
        if (metrics.homeTotal > 0) {
          const homeRate = metrics.homeCorrect / metrics.homeTotal;
          console.log(chalk.white(`  Home: ${(homeRate * 100).toFixed(1)}%`));
        }
        if (metrics.awayTotal > 0) {
          const awayRate = metrics.awayCorrect / metrics.awayTotal;
          console.log(chalk.white(`  Away: ${(awayRate * 100).toFixed(1)}%`));
        }
      }
    });
    
    console.log(chalk.bold.cyan('\n\n🏆 OPTIMIZED MODEL COMPLETE!'));
    console.log(chalk.yellow(`Final accuracy: ${(accuracy * 100).toFixed(1)}%`));
    
    if (accuracy < 0.65) {
      console.log(chalk.yellow('\n💡 To reach 65%+ accuracy:'));
      console.log(chalk.white('  • Collect more games (need 1000+ per sport)'));
      console.log(chalk.white('  • Add player-level statistics'));
      console.log(chalk.white('  • Integrate weather data for MLB'));
      console.log(chalk.white('  • Add injury reports'));
      console.log(chalk.white('  • Include betting odds (when API is ready)'));
    }
    
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainOptimized2025().catch(console.error);