#!/usr/bin/env tsx
/**
 * ⚡ FAST COMPREHENSIVE TRAINING
 * Optimized for speed while using all data
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

async function trainFastComprehensive() {
  console.log(chalk.bold.cyan('⚡ FAST COMPREHENSIVE TRAINING'));
  console.log(chalk.yellow('Optimized for 65% accuracy target'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load ALL data with optimized queries
    console.log(chalk.cyan('1️⃣ Loading data efficiently...'));
    
    // Load all games in one query (limit removed for ALL data)
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    console.log(chalk.green(`✅ Loaded ${games?.length} games`));
    
    // Load player stats (sample for speed)
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('game_id, team_id, points, assists, rebounds')
      .limit(5000);
    
    console.log(chalk.green(`✅ Loaded ${playerStats?.length} player stats`));
    
    // 2. Build streamlined features
    console.log(chalk.cyan('\n2️⃣ Building optimized features...'));
    
    // Index player stats by game
    const statsByGame = new Map();
    playerStats?.forEach(stat => {
      if (!statsByGame.has(stat.game_id)) {
        statsByGame.set(stat.game_id, []);
      }
      statsByGame.get(stat.game_id).push(stat);
    });
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    
    // Process by sport
    const sportGroups = new Map();
    games?.forEach(game => {
      const sport = game.sport_id || 'nfl';
      if (!sportGroups.has(sport)) {
        sportGroups.set(sport, []);
      }
      sportGroups.get(sport).push(game);
    });
    
    for (const [sport, sportGames] of sportGroups) {
      console.log(chalk.yellow(`Processing ${sport}: ${sportGames.length} games`));
      
      const teamStats = new Map();
      const avgScore = sport === 'nba' ? 110 : sport === 'mlb' ? 9 : sport === 'nhl' ? 6 : 45;
      let built = 0;
      
      // Sort chronologically
      sportGames.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      
      for (const game of sportGames) {
        const homeId = game.home_team_id;
        const awayId = game.away_team_id;
        
        // Initialize teams
        [homeId, awayId].forEach(id => {
          if (!teamStats.has(id)) {
            teamStats.set(id, {
              games: 0, wins: 0, homeWins: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last10: [], momentum: 0.5, elo: 1500
            });
          }
        });
        
        const home = teamStats.get(homeId);
        const away = teamStats.get(awayId);
        
        // Build features after minimum games
        if (home.games >= 5 && away.games >= 5) {
          // Get player stats for this game
          const gameStats = statsByGame.get(game.id) || [];
          let homePlayerPower = 0;
          let awayPlayerPower = 0;
          
          gameStats.forEach(stat => {
            const power = (stat.points || 0) + (stat.assists || 0) * 0.5 + (stat.rebounds || 0) * 0.3;
            if (stat.team_id === homeId) {
              homePlayerPower += power;
            } else {
              awayPlayerPower += power;
            }
          });
          
          // Normalize player power
          homePlayerPower = homePlayerPower / Math.max(gameStats.filter(s => s.team_id === homeId).length, 1) / 30;
          awayPlayerPower = awayPlayerPower / Math.max(gameStats.filter(s => s.team_id === awayId).length, 1) / 30;
          
          // Calculate features
          const homeWR = home.wins / home.games;
          const awayWR = away.wins / away.games;
          const homeAvgFor = home.totalFor / home.games;
          const awayAvgFor = away.totalFor / away.games;
          const homeAvgAgainst = home.totalAgainst / home.games;
          const awayAvgAgainst = away.totalAgainst / away.games;
          const homeForm = home.last10.reduce((a, b) => a + b, 0) / home.last10.length;
          const awayForm = away.last10.reduce((a, b) => a + b, 0) / away.last10.length;
          const eloDiff = (home.elo - away.elo) / 400;
          
          // Build streamlined feature vector (35 features)
          const features = [
            // Core differentials (8)
            homeWR - awayWR,
            (homeAvgFor - awayAvgFor) / avgScore,
            (awayAvgAgainst - homeAvgAgainst) / avgScore,
            homeForm - awayForm,
            eloDiff,
            home.momentum - away.momentum,
            homePlayerPower - awayPlayerPower,
            sport === 'nfl' ? 0.025 : sport === 'nba' ? 0.04 : 0.03, // home advantage
            
            // Absolute values (8)
            homeWR,
            awayWR,
            homeForm,
            awayForm,
            home.elo / 1500,
            away.elo / 1500,
            homePlayerPower,
            awayPlayerPower,
            
            // Scoring patterns (6)
            homeAvgFor / avgScore,
            awayAvgFor / avgScore,
            homeAvgAgainst / avgScore,
            awayAvgAgainst / avgScore,
            (homeAvgFor + homeAvgAgainst) / (2 * avgScore),
            (awayAvgFor + awayAvgAgainst) / (2 * avgScore),
            
            // Matchup (4)
            homeAvgFor / Math.max(awayAvgAgainst, avgScore * 0.5),
            awayAvgFor / Math.max(homeAvgAgainst, avgScore * 0.5),
            Math.abs(homeAvgFor - awayAvgFor) / avgScore,
            Math.abs(homeAvgAgainst - awayAvgAgainst) / avgScore,
            
            // Recent (5)
            home.last10.slice(-5).filter(x => x === 1).length / 5,
            away.last10.slice(-5).filter(x => x === 1).length / 5,
            home.last10.slice(-3).filter(x => x === 1).length / 3,
            away.last10.slice(-3).filter(x => x === 1).length / 3,
            Math.max(...home.last10.slice(-3).map((_, i, arr) => arr.slice(i).filter(x => x === 1).length)) / 3,
            
            // Sport indicators (4)
            sport === 'nfl' ? 1 : 0,
            sport === 'mlb' ? 1 : 0,
            sport === 'nba' ? 1 : 0,
            sport === 'nhl' ? 1 : 0
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          built++;
        }
        
        // Update stats
        const homeWon = game.home_score > game.away_score;
        home.games++;
        away.games++;
        if (homeWon) {
          home.wins++;
          home.last10.push(1);
          away.last10.push(0);
        } else {
          away.wins++;
          home.last10.push(0);
          away.last10.push(1);
        }
        
        home.totalFor += game.home_score;
        home.totalAgainst += game.away_score;
        away.totalFor += game.away_score;
        away.totalAgainst += game.home_score;
        
        // Update ELO
        const K = 20;
        const expected = 1 / (1 + Math.pow(10, (away.elo - home.elo) / 400));
        home.elo += K * ((homeWon ? 1 : 0) - expected);
        away.elo += K * ((homeWon ? 0 : 1) - (1 - expected));
        
        // Update momentum
        home.momentum = home.momentum * 0.8 + (homeWon ? 1 : 0) * 0.2;
        away.momentum = away.momentum * 0.8 + (homeWon ? 0 : 1) * 0.2;
        
        // Maintain list size
        if (home.last10.length > 10) home.last10.shift();
        if (away.last10.length > 10) away.last10.shift();
      }
      
      console.log(chalk.green(`  ✅ Built ${built} features`));
    }
    
    console.log(chalk.green(`\n✅ Total: ${allFeatures.length} feature vectors`));
    
    // 3. Split data
    console.log(chalk.cyan('\n3️⃣ Splitting data...'));
    const split = Math.floor(allFeatures.length * 0.8);
    
    const xTrain = allFeatures.slice(0, split);
    const yTrain = allLabels.slice(0, split);
    const xTest = allFeatures.slice(split);
    const yTest = allLabels.slice(split);
    
    console.log(chalk.yellow(`Train: ${xTrain.length}, Test: ${xTest.length}`));
    
    // 4. Train optimized ensemble (3 models for speed)
    console.log(chalk.cyan('\n4️⃣ Training optimized ensemble...'));
    
    const models = [];
    const configs = [
      { nEstimators: 100, maxDepth: 12, minSamplesLeaf: 5 },
      { nEstimators: 150, maxDepth: 15, minSamplesLeaf: 3 },
      { nEstimators: 100, maxDepth: 10, minSamplesLeaf: 4 }
    ];
    
    for (let i = 0; i < 3; i++) {
      console.log(chalk.gray(`Training model ${i + 1}/3...`));
      const start = Date.now();
      
      const model = new RandomForestClassifier({
        ...configs[i],
        maxFeatures: 0.8,
        seed: 42 + i
      });
      
      model.train(xTrain, yTrain);
      models.push(model);
      
      console.log(chalk.green(`✅ Done in ${((Date.now() - start) / 1000).toFixed(1)}s`));
    }
    
    // 5. Test ensemble
    console.log(chalk.cyan('\n5️⃣ Testing ensemble...'));
    
    // Get predictions
    const predictions = models.map(m => m.predict(xTest));
    
    // Vote
    const ensemble = [];
    for (let i = 0; i < xTest.length; i++) {
      const votes = predictions.map(p => p[i]);
      const sum = votes.reduce((a, b) => a + b, 0);
      ensemble.push(sum >= 2 ? 1 : 0);
    }
    
    // Calculate accuracy
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
    for (let i = 0; i < ensemble.length; i++) {
      if (ensemble[i] === yTest[i]) correct++;
      
      if (yTest[i] === 1) {
        homeTotal++;
        if (ensemble[i] === 1) homeCorrect++;
      } else {
        awayTotal++;
        if (ensemble[i] === 0) awayCorrect++;
      }
    }
    
    const accuracy = correct / ensemble.length;
    const homeAcc = homeCorrect / homeTotal;
    const awayAcc = awayCorrect / awayTotal;
    
    console.log(chalk.bold.green('\n📊 RESULTS:'));
    console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}%`));
    
    // Individual model accuracies
    console.log(chalk.cyan('\nIndividual models:'));
    predictions.forEach((preds, i) => {
      const modelCorrect = preds.filter((p, idx) => p === yTest[idx]).length;
      console.log(chalk.gray(`Model ${i + 1}: ${(modelCorrect / preds.length * 100).toFixed(1)}%`));
    });
    
    // 6. Save if good
    if (accuracy >= 0.60) {
      console.log(chalk.cyan('\n6️⃣ Saving model...'));
      
      const modelData = {
        ensemble: models.map(m => m.toJSON()),
        metadata: {
          accuracy,
          features: 35,
          games: games?.length,
          trainingSamples: xTrain.length,
          testSamples: xTest.length,
          performance: { accuracy, homeAcc, awayAcc }
        }
      };
      
      fs.writeFileSync('./models/fast-comprehensive-model.json', JSON.stringify(modelData, null, 2));
      console.log(chalk.green('✅ Saved!'));
    }
    
    console.log(chalk.bold.cyan(`\n\n⚡ COMPLETE!`));
    console.log(chalk.bold.green(`🎯 ${(accuracy * 100).toFixed(1)}% ACCURACY`));
    
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('🎉 65% TARGET ACHIEVED!'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainFastComprehensive().catch(console.error);