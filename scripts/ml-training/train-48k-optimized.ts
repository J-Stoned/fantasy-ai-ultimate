#!/usr/bin/env tsx
/**
 * 🎯 OPTIMIZED 48K GAMES TRAINER
 * Fast training on all 48K+ games for 65% target
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

async function train48KOptimized() {
  console.log(chalk.bold.cyan('🎯 OPTIMIZED 48K GAMES TRAINER'));
  console.log(chalk.yellow('Fast training on 48K+ games'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load a strategic sample of games for faster training
    console.log(chalk.cyan('1️⃣ Loading games strategically...'));
    
    // Load recent games from each sport for better relevance
    const sportQueries = [
      { sport: 'nfl', limit: 15000 },
      { sport: 'nba', limit: 2000 },
      { sport: 'mlb', limit: 2000 },
      { sport: 'nhl', limit: 1000 }
    ];
    
    const allGames: any[] = [];
    
    for (const query of sportQueries) {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', query.sport)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(query.limit);
      
      if (data) {
        allGames.push(...data);
        console.log(chalk.gray(`  Loaded ${data.length} ${query.sport} games`));
      }
    }
    
    // Also get other sports
    const { data: otherGames } = await supabase
      .from('games')
      .select('*')
      .not('sport_id', 'in', '(nfl,nba,mlb,nhl)')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .limit(1000);
    
    if (otherGames) allGames.push(...otherGames);
    
    console.log(chalk.green(`✅ Loaded ${allGames.length} total games`));
    
    // 2. Build features efficiently
    console.log(chalk.cyan('\n2️⃣ Building optimized features...'));
    
    // Sort all games chronologically
    allGames.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    
    const features: number[][] = [];
    const labels: number[] = [];
    const teamStats = new Map();
    const teamSchedule = new Map();
    
    // Process all games together for efficiency
    let processed = 0;
    
    for (const game of allGames) {
      const sport = game.sport_id || 'unknown';
      const gameDate = new Date(game.start_time);
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;
      
      // Sport config
      const config = {
        nfl: { avgScore: 45, homeAdv: 0.57, minGames: 3 },
        nba: { avgScore: 110, homeAdv: 0.60, minGames: 5 },
        mlb: { avgScore: 9, homeAdv: 0.54, minGames: 5 },
        nhl: { avgScore: 6, homeAdv: 0.55, minGames: 5 }
      }[sport] || { avgScore: 50, homeAdv: 0.55, minGames: 3 };
      
      // Initialize teams
      [homeId, awayId].forEach(id => {
        if (!teamStats.has(id)) {
          teamStats.set(id, {
            games: 0, wins: 0,
            homeGames: 0, homeWins: 0,
            awayGames: 0, awayWins: 0,
            totalFor: 0, totalAgainst: 0,
            last10: [], rolling5: [],
            streak: 0, momentum: 0.5, elo: 1500
          });
        }
        if (!teamSchedule.has(id)) {
          teamSchedule.set(id, []);
        }
      });
      
      const home = teamStats.get(homeId);
      const away = teamStats.get(awayId);
      
      // Build features after minimum games
      if (home.games >= config.minGames && away.games >= config.minGames) {
        // Rest days
        const homeLastGames = teamSchedule.get(homeId);
        const awayLastGames = teamSchedule.get(awayId);
        
        const homeRest = homeLastGames.length > 0 ?
          Math.min(7, Math.floor((gameDate.getTime() - homeLastGames[homeLastGames.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
        const awayRest = awayLastGames.length > 0 ?
          Math.min(7, Math.floor((gameDate.getTime() - awayLastGames[awayLastGames.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
        
        // Core stats
        const homeWR = home.wins / home.games;
        const awayWR = away.wins / away.games;
        const homeHomeWR = home.homeGames > 0 ? home.homeWins / home.homeGames : homeWR;
        const awayAwayWR = away.awayGames > 0 ? away.awayWins / away.awayGames : awayWR;
        
        const homeAvgFor = home.totalFor / home.games;
        const awayAvgFor = away.totalFor / away.games;
        const homeAvgAgainst = home.totalAgainst / home.games;
        const awayAvgAgainst = away.totalAgainst / away.games;
        
        const homeForm = home.last10.reduce((a, b) => a + b, 0) / Math.max(home.last10.length, 1);
        const awayForm = away.last10.reduce((a, b) => a + b, 0) / Math.max(away.last10.length, 1);
        
        const homeRolling = home.rolling5.reduce((a, b) => a + b, 0) / Math.max(home.rolling5.length, 1);
        const awayRolling = away.rolling5.reduce((a, b) => a + b, 0) / Math.max(away.rolling5.length, 1);
        
        // Time features
        const dayOfWeek = gameDate.getDay();
        const hour = gameDate.getHours();
        
        // Build streamlined feature vector (30 features)
        const feature = [
          // Core differentials (8)
          homeWR - awayWR,
          homeHomeWR - awayAwayWR,
          (homeAvgFor - awayAvgFor) / config.avgScore,
          (awayAvgAgainst - homeAvgAgainst) / config.avgScore,
          homeForm - awayForm,
          (home.elo - away.elo) / 400,
          home.momentum - away.momentum,
          homeRolling - awayRolling,
          
          // Context (5)
          (homeRest - awayRest) / 3,
          dayOfWeek / 6,
          dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
          hour >= 19 ? 1 : 0,
          config.homeAdv,
          
          // Absolute values (8)
          homeWR,
          awayWR,
          homeHomeWR,
          awayAwayWR,
          homeForm,
          awayForm,
          home.elo / 1500,
          away.elo / 1500,
          
          // Scoring (4)
          homeAvgFor / config.avgScore,
          awayAvgFor / config.avgScore,
          homeAvgAgainst / config.avgScore,
          awayAvgAgainst / config.avgScore,
          
          // Matchup (2)
          homeAvgFor / Math.max(awayAvgAgainst, config.avgScore * 0.5),
          awayAvgFor / Math.max(homeAvgAgainst, config.avgScore * 0.5),
          
          // Sport (3)
          sport === 'nfl' ? 1 : 0,
          sport === 'nba' ? 1 : 0,
          sport === 'mlb' ? 1 : 0
        ];
        
        features.push(feature);
        labels.push(game.home_score > game.away_score ? 1 : 0);
        
        if (features.length % 5000 === 0) {
          console.log(chalk.gray(`  Built ${features.length} features...`));
        }
      }
      
      // Update stats
      const homeWon = game.home_score > game.away_score;
      
      home.games++;
      away.games++;
      home.homeGames++;
      away.awayGames++;
      home.totalFor += game.home_score;
      home.totalAgainst += game.away_score;
      away.totalFor += game.away_score;
      away.totalAgainst += game.home_score;
      
      if (homeWon) {
        home.wins++;
        home.homeWins++;
        home.last10.push(1);
        home.rolling5.push(1);
        away.last10.push(0);
        away.rolling5.push(0);
        home.streak = Math.max(1, home.streak + 1);
        away.streak = Math.min(-1, away.streak - 1);
      } else {
        away.wins++;
        away.awayWins++;
        home.last10.push(0);
        home.rolling5.push(0);
        away.last10.push(1);
        away.rolling5.push(1);
        home.streak = Math.min(-1, home.streak - 1);
        away.streak = Math.max(1, away.streak + 1);
      }
      
      // Update ELO
      const K = 20;
      const expected = 1 / (1 + Math.pow(10, (away.elo - home.elo) / 400));
      home.elo += K * ((homeWon ? 1 : 0) - expected);
      away.elo += K * ((homeWon ? 0 : 1) - (1 - expected));
      
      // Update momentum
      home.momentum = home.momentum * 0.7 + (homeWon ? 1 : 0) * 0.3;
      away.momentum = away.momentum * 0.7 + (homeWon ? 0 : 1) * 0.3;
      
      // Update schedule
      teamSchedule.get(homeId).push(gameDate);
      teamSchedule.get(awayId).push(gameDate);
      
      // Maintain list sizes
      if (home.last10.length > 10) home.last10.shift();
      if (home.rolling5.length > 5) home.rolling5.shift();
      if (away.last10.length > 10) away.last10.shift();
      if (away.rolling5.length > 5) away.rolling5.shift();
      
      processed++;
    }
    
    console.log(chalk.green(`✅ Built ${features.length} features from ${processed} games`));
    
    // Check balance
    const homeWins = labels.filter(l => l === 1).length;
    console.log(chalk.yellow(`Distribution: ${homeWins} home (${(homeWins/labels.length*100).toFixed(1)}%), ${labels.length - homeWins} away`));
    
    // 3. Split data
    console.log(chalk.cyan('\n3️⃣ Splitting data...'));
    const split = Math.floor(features.length * 0.8);
    
    const xTrain = features.slice(0, split);
    const yTrain = labels.slice(0, split);
    const xTest = features.slice(split);
    const yTest = labels.slice(split);
    
    console.log(chalk.yellow(`Train: ${xTrain.length}, Test: ${xTest.length}`));
    
    // 4. Train optimized model
    console.log(chalk.cyan('\n4️⃣ Training optimized Random Forest...'));
    
    const start = Date.now();
    
    const model = new RandomForestClassifier({
      nEstimators: 100,      // Fewer trees for speed
      maxDepth: 15,          // Moderate depth
      minSamplesLeaf: 10,    // Prevent overfitting
      maxFeatures: 0.8,      // Use 80% of features
      seed: 2025
    });
    
    model.train(xTrain, yTrain);
    
    console.log(chalk.green(`✅ Trained in ${((Date.now() - start) / 1000).toFixed(1)}s`));
    
    // 5. Test model
    console.log(chalk.cyan('\n5️⃣ Testing model...'));
    
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
    
    console.log(chalk.bold.green('\n📊 PERFORMANCE:'));
    console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}%`));
    
    // 6. Save model
    console.log(chalk.cyan('\n6️⃣ Saving model...'));
    
    const modelData = {
      model: model.toJSON(),
      metadata: {
        accuracy,
        features: 30,
        games: allGames.length,
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        performance: { accuracy, homeAcc, awayAcc }
      }
    };
    
    fs.writeFileSync('./models/48k-optimized-model.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Saved!'));
    
    console.log(chalk.bold.cyan('\n\n🎯 COMPLETE!'));
    console.log(chalk.bold.green(`📊 ${(accuracy * 100).toFixed(1)}% ACCURACY`));
    
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('🎉 65% TARGET ACHIEVED!'));
    } else {
      console.log(chalk.yellow(`📈 ${((0.65 - accuracy) * 100).toFixed(1)}% to target`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

train48KOptimized().catch(console.error);