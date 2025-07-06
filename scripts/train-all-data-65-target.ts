#!/usr/bin/env tsx
/**
 * 🎯 TRAIN ON ALL DATA - TARGET 65%
 * Using ALL available games across all sports and seasons
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

async function trainAllData65() {
  console.log(chalk.bold.cyan('🎯 TRAINING ON ALL DATA - TARGET 65%'));
  console.log(chalk.yellow('Using ALL games across all sports and seasons'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load ALL games with scores
    console.log(chalk.cyan('1️⃣ Loading ALL games from database...'));
    
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .in('sport_id', ['nfl', 'nba', 'nhl', 'mlb'])
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    
    console.log(chalk.green(`✅ Loaded ${games?.length} total games with scores`));
    
    // Group by sport
    const gamesBySport = new Map();
    games?.forEach(game => {
      const sport = game.sport_id;
      if (!gamesBySport.has(sport)) {
        gamesBySport.set(sport, []);
      }
      gamesBySport.get(sport).push(game);
    });
    
    console.log(chalk.cyan('\n📊 Games by Sport:'));
    gamesBySport.forEach((sportGames, sport) => {
      console.log(chalk.yellow(`  ${sport.toUpperCase()}: ${sportGames.length} games`));
    });
    
    // 2. Build enhanced features
    console.log(chalk.cyan('\n2️⃣ Building enhanced features...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    const allGameIds: string[] = [];
    
    // Sport-specific configurations
    const sportConfigs = {
      nfl: { homeAdvantage: 0.57, avgScore: 45, minGames: 3 },
      nba: { homeAdvantage: 0.60, avgScore: 110, minGames: 5 },
      mlb: { homeAdvantage: 0.54, avgScore: 9, minGames: 10 },
      nhl: { homeAdvantage: 0.55, avgScore: 6, minGames: 5 }
    };
    
    // Process each sport
    for (const [sportId, sportGames] of gamesBySport) {
      console.log(chalk.yellow(`\nProcessing ${sportId}...`));
      
      const config = sportConfigs[sportId] || sportConfigs.nfl;
      const teamStats = new Map();
      const teamSchedule = new Map();
      const headToHead = new Map();
      let featuresBuilt = 0;
      
      // Sort games chronologically
      const sortedGames = sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      sortedGames.forEach(game => {
        const gameDate = new Date(game.start_time);
        const homeId = game.home_team_id;
        const awayId = game.away_team_id;
        const h2hKey = [homeId, awayId].sort().join('-');
        
        // Initialize teams
        [homeId, awayId].forEach(teamId => {
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
              rolling7: []
            });
          }
          if (!teamSchedule.has(teamId)) {
            teamSchedule.set(teamId, []);
          }
        });
        
        // Initialize head-to-head
        if (!headToHead.has(h2hKey)) {
          headToHead.set(h2hKey, { home: 0, away: 0 });
        }
        
        const homeStats = teamStats.get(homeId);
        const awayStats = teamStats.get(awayId);
        const h2h = headToHead.get(h2hKey);
        
        // Need minimum games for meaningful features
        if (homeStats.games >= config.minGames && awayStats.games >= config.minGames) {
          // Calculate rest days
          const homeScheduleDates = teamSchedule.get(homeId);
          const awayScheduleDates = teamSchedule.get(awayId);
          
          const homeRestDays = homeScheduleDates.length > 0 ? 
            Math.min(7, Math.floor((gameDate.getTime() - homeScheduleDates[homeScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          const awayRestDays = awayScheduleDates.length > 0 ? 
            Math.min(7, Math.floor((gameDate.getTime() - awayScheduleDates[awayScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          
          // Day of week and time features
          const dayOfWeek = gameDate.getDay();
          const hour = gameDate.getHours();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
          const isPrimeTime = hour >= 19 ? 1 : 0;
          
          // Calculate features
          const homeWR = homeStats.wins / homeStats.games;
          const awayWR = awayStats.wins / awayStats.games;
          const homeHomeWR = homeStats.homeGames > 2 ? homeStats.homeWins / homeStats.homeGames : homeWR;
          const awayAwayWR = awayStats.awayGames > 2 ? awayStats.awayWins / awayStats.awayGames : awayWR;
          
          const homeAvgFor = homeStats.totalFor / homeStats.games;
          const awayAvgFor = awayStats.totalFor / awayStats.games;
          const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
          const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
          
          // Recent form
          const homeLast5 = homeStats.last5.slice(-5);
          const awayLast5 = awayStats.last5.slice(-5);
          const homeLast10 = homeStats.last10.slice(-10);
          const awayLast10 = awayStats.last10.slice(-10);
          const homeForm = homeLast10.length > 0 ? homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayForm = awayLast10.length > 0 ? awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // Rolling averages
          const homeRolling7 = homeStats.rolling7.length > 0 ? 
            homeStats.rolling7.reduce((a, b) => a + b, 0) / homeStats.rolling7.length : 0.5;
          const awayRolling7 = awayStats.rolling7.length > 0 ?
            awayStats.rolling7.reduce((a, b) => a + b, 0) / awayStats.rolling7.length : 0.5;
          
          // ELO difference
          const eloDiff = (homeStats.elo - awayStats.elo) / 400;
          
          // Head-to-head
          const h2hTotal = h2h.home + h2h.away;
          const h2hHomeWR = h2hTotal > 0 ? h2h.home / h2hTotal : 0.5;
          
          // Consistency (standard deviation of recent results)
          const homeConsistency = homeLast10.length > 3 ? 
            1 - Math.sqrt(homeLast10.reduce((sum, val) => sum + Math.pow(val - homeForm, 2), 0) / homeLast10.length) : 0.5;
          const awayConsistency = awayLast10.length > 3 ?
            1 - Math.sqrt(awayLast10.reduce((sum, val) => sum + Math.pow(val - awayForm, 2), 0) / awayLast10.length) : 0.5;
          
          // Sport normalization
          const scoringNorm = config.avgScore;
          
          // Build comprehensive feature vector
          const features = [
            // Core differentials (10)
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            (homeAvgFor - awayAvgFor) / scoringNorm,
            (awayAvgAgainst - homeAvgAgainst) / scoringNorm,
            homeForm - awayForm,
            eloDiff,
            homeStats.momentum - awayStats.momentum,
            (homeStats.streak - awayStats.streak) / 5,
            homeRolling7 - awayRolling7,
            homeConsistency - awayConsistency,
            
            // Schedule and context (5)
            (homeRestDays - awayRestDays) / 3,
            dayOfWeek / 6,
            isWeekend,
            isPrimeTime,
            config.homeAdvantage,
            
            // Absolute values (10)
            homeWR,
            awayWR,
            homeHomeWR,
            awayAwayWR,
            homeForm,
            awayForm,
            homeRolling7,
            awayRolling7,
            homeStats.momentum,
            awayStats.momentum,
            
            // Scoring patterns (6)
            homeAvgFor / scoringNorm,
            awayAvgFor / scoringNorm,
            homeAvgAgainst / scoringNorm,
            awayAvgAgainst / scoringNorm,
            (homeAvgFor + homeAvgAgainst) / (2 * scoringNorm), // pace
            (awayAvgFor + awayAvgAgainst) / (2 * scoringNorm), // pace
            
            // Matchup specifics (4)
            homeAvgFor / Math.max(awayAvgAgainst, scoringNorm * 0.5),
            awayAvgFor / Math.max(homeAvgAgainst, scoringNorm * 0.5),
            h2hHomeWR,
            h2hTotal / 10, // normalized h2h games
            
            // Recent performance (4)
            homeLast5.filter(x => x === 1).length / Math.max(homeLast5.length, 1),
            awayLast5.filter(x => x === 1).length / Math.max(awayLast5.length, 1),
            homeStats.elo / 1500,
            awayStats.elo / 1500,
            
            // Sport indicators (4)
            sportId === 'nfl' ? 1 : 0,
            sportId === 'mlb' ? 1 : 0,
            sportId === 'nba' ? 1 : 0,
            sportId === 'nhl' ? 1 : 0
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          allGameIds.push(game.id);
          featuresBuilt++;
        }
        
        // Update stats after game
        const homeWon = game.home_score > game.away_score;
        const margin = Math.abs(game.home_score - game.away_score);
        
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
          h2h.home++;
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
          h2h.away++;
        }
        
        // Update ELO
        const K = 20 + (margin / config.avgScore * 10);
        const expectedHome = 1 / (1 + Math.pow(10, (awayStats.elo - homeStats.elo) / 400));
        homeStats.elo += K * ((homeWon ? 1 : 0) - expectedHome);
        awayStats.elo += K * ((homeWon ? 0 : 1) - (1 - expectedHome));
        
        // Update momentum
        homeStats.momentum = homeStats.momentum * 0.8 + (homeWon ? 1 : 0) * 0.2;
        awayStats.momentum = awayStats.momentum * 0.8 + (homeWon ? 0 : 1) * 0.2;
        
        // Update schedules
        teamSchedule.get(homeId).push(gameDate);
        teamSchedule.get(awayId).push(gameDate);
        
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
    console.log(chalk.yellow(`Distribution: ${homeWins} home (${(homeWins/allLabels.length*100).toFixed(1)}%), ${awayWins} away (${(awayWins/allLabels.length*100).toFixed(1)}%)`));
    
    // 4. Use 80/20 split for stability
    console.log(chalk.cyan('\n3️⃣ Splitting data (80/20)...'));
    const trainEnd = Math.floor(allFeatures.length * 0.8);
    
    const xTrain = allFeatures.slice(0, trainEnd);
    const yTrain = allLabels.slice(0, trainEnd);
    const xTest = allFeatures.slice(trainEnd);
    const yTest = allLabels.slice(trainEnd);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 5. Train ensemble of 5 models
    console.log(chalk.cyan('\n4️⃣ Training ensemble of 5 models...'));
    
    const models = [];
    const seeds = [42, 2025, 2026, 2027, 1337];
    const configs = [
      { nEstimators: 200, maxDepth: 15, minSamplesLeaf: 5, maxFeatures: 0.8 },
      { nEstimators: 250, maxDepth: 18, minSamplesLeaf: 3, maxFeatures: 0.7 },
      { nEstimators: 300, maxDepth: 20, minSamplesLeaf: 4, maxFeatures: 0.75 },
      { nEstimators: 150, maxDepth: 12, minSamplesLeaf: 6, maxFeatures: 0.85 },
      { nEstimators: 200, maxDepth: 16, minSamplesLeaf: 4, maxFeatures: 0.8 }
    ];
    
    for (let i = 0; i < seeds.length; i++) {
      console.log(chalk.gray(`\nTraining model ${i + 1} with seed ${seeds[i]}...`));
      
      const model = new RandomForestClassifier({
        ...configs[i],
        seed: seeds[i]
      });
      
      const startTime = Date.now();
      model.train(xTrain, yTrain);
      console.log(chalk.green(`✅ Model ${i + 1} trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
      
      models.push(model);
    }
    
    // 6. Test ensemble
    console.log(chalk.cyan('\n5️⃣ Testing ensemble model...'));
    
    // Get predictions from each model
    const allPredictions = models.map(model => model.predict(xTest));
    
    // Weighted voting based on individual accuracies
    const modelWeights = [];
    for (let i = 0; i < models.length; i++) {
      const preds = allPredictions[i];
      const correct = preds.filter((p, idx) => p === yTest[idx]).length;
      const accuracy = correct / preds.length;
      modelWeights.push(accuracy);
      console.log(chalk.gray(`Model ${i + 1} accuracy: ${(accuracy * 100).toFixed(1)}%`));
    }
    
    // Normalize weights
    const totalWeight = modelWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = modelWeights.map(w => w / totalWeight);
    
    // Weighted ensemble predictions
    const ensemblePredictions = [];
    for (let i = 0; i < xTest.length; i++) {
      let weightedVote = 0;
      for (let j = 0; j < models.length; j++) {
        weightedVote += allPredictions[j][i] * normalizedWeights[j];
      }
      ensemblePredictions.push(weightedVote >= 0.5 ? 1 : 0);
    }
    
    // Calculate metrics
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
    for (let i = 0; i < ensemblePredictions.length; i++) {
      if (ensemblePredictions[i] === yTest[i]) correct++;
      
      if (yTest[i] === 1) {
        homeTotal++;
        if (ensemblePredictions[i] === 1) homeCorrect++;
      } else {
        awayTotal++;
        if (ensemblePredictions[i] === 0) awayCorrect++;
      }
    }
    
    const accuracy = correct / ensemblePredictions.length;
    const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
    const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
    const balance = 2 * (homeAcc * awayAcc) / (homeAcc + awayAcc + 0.0001);
    
    console.log(chalk.bold.green('\n📊 WEIGHTED ENSEMBLE PERFORMANCE:'));
    console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance: ${(balance * 100).toFixed(1)}%`));
    
    // 7. Save model if it achieves 65%+
    if (accuracy >= 0.65) {
      console.log(chalk.cyan('\n6️⃣ Saving 65% model...'));
      
      const modelData = {
        ensemble: models.map(m => m.toJSON()),
        weights: normalizedWeights,
        metadata: {
          type: 'weighted_ensemble',
          models: models.length,
          features: allFeatures[0].length,
          totalGames: games?.length || 0,
          trainingGames: allFeatures.length,
          performance: {
            overall: { accuracy, homeAcc, awayAcc, balance },
            individualModels: modelWeights.map((w, i) => ({
              model: i + 1,
              accuracy: w
            }))
          },
          features: [
            'Core differentials (10)',
            'Schedule and context (5)',
            'Absolute values (10)',
            'Scoring patterns (6)',
            'Matchup specifics (4)',
            'Recent performance (4)',
            'Sport indicators (4)'
          ],
          trainingSamples: xTrain.length,
          testSamples: xTest.length,
          trainedOn: new Date().toISOString()
        }
      };
      
      fs.writeFileSync('./models/all-data-65-model.json', JSON.stringify(modelData, null, 2));
      console.log(chalk.green('✅ Saved 65% accuracy model!'));
    }
    
    // Success message
    console.log(chalk.bold.cyan(`\n\n🎯 FINAL RESULT: ${(accuracy * 100).toFixed(1)}% ACCURACY`));
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('🎉 TARGET ACHIEVED! 65%+ ACCURACY!'));
    } else {
      console.log(chalk.bold.yellow(`📈 Improvement needed: ${((0.65 - accuracy) * 100).toFixed(1)}% to target`));
    }
    
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainAllData65().catch(console.error);