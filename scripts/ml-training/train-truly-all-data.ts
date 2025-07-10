#!/usr/bin/env tsx
/**
 * 🚀 TRAIN ON TRULY ALL DATA - NO LIMITS!
 * Loads ALL 50K+ games using pagination
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

async function loadAllGames() {
  console.log(chalk.cyan('Loading ALL games with pagination...'));
  const allGames: any[] = [];
  const pageSize = 1000;
  let page = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allGames.push(...data);
    console.log(chalk.gray(`  Loaded ${allGames.length} games so far...`));
    
    if (data.length < pageSize) break;
    page++;
  }
  
  return allGames;
}

async function trainTrulyAllData() {
  console.log(chalk.bold.cyan('🚀 TRAINING ON TRULY ALL DATA'));
  console.log(chalk.yellow('No limits - using ALL 50K+ games!'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load ALL games with pagination
    const games = await loadAllGames();
    console.log(chalk.green(`✅ Loaded ${games.length} total games!`));
    
    // 2. Load player stats in chunks
    console.log(chalk.cyan('\n📊 Loading player stats...'));
    const playerStats: any[] = [];
    let offset = 0;
    
    while (true) {
      const { data } = await supabase
        .from('player_stats')
        .select('game_id, team_id, player_id, points, assists, rebounds')
        .range(offset, offset + 999);
      
      if (!data || data.length === 0) break;
      playerStats.push(...data);
      offset += 1000;
      
      if (data.length < 1000) break;
    }
    
    console.log(chalk.green(`✅ Loaded ${playerStats.length} player stats`));
    
    // 3. Load injuries
    const { data: injuries } = await supabase
      .from('player_injuries')
      .select('*');
    console.log(chalk.green(`✅ Loaded ${injuries?.length || 0} injuries`));
    
    // 4. Create indexes
    console.log(chalk.cyan('\n🔧 Creating data indexes...'));
    
    // Player stats by game and team
    const statsByGameTeam = new Map();
    playerStats.forEach(stat => {
      const key = `${stat.game_id}_${stat.team_id}`;
      if (!statsByGameTeam.has(key)) {
        statsByGameTeam.set(key, []);
      }
      statsByGameTeam.get(key).push(stat);
    });
    
    // Group games by sport
    const sportGroups = new Map();
    games.forEach(game => {
      const sport = game.sport_id || 'unknown';
      if (!sportGroups.has(sport)) {
        sportGroups.set(sport, []);
      }
      sportGroups.get(sport).push(game);
    });
    
    console.log(chalk.cyan('\n📊 Games by sport:'));
    sportGroups.forEach((games, sport) => {
      console.log(chalk.yellow(`  ${sport}: ${games.length} games`));
    });
    
    // 5. Build features
    console.log(chalk.cyan('\n🏗️ Building features from ALL games...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    let totalProcessed = 0;
    
    for (const [sport, sportGames] of sportGroups) {
      console.log(chalk.yellow(`\nProcessing ${sport}: ${sportGames.length} games`));
      
      // Sport config with ALL sports
      const sportConfig = {
        nfl: { avgScore: 45, homeAdv: 0.57, minGames: 3 },
        football: { avgScore: 45, homeAdv: 0.57, minGames: 3 },
        nba: { avgScore: 110, homeAdv: 0.60, minGames: 5 },
        basketball: { avgScore: 110, homeAdv: 0.60, minGames: 5 },
        mlb: { avgScore: 9, homeAdv: 0.54, minGames: 8 },
        baseball: { avgScore: 9, homeAdv: 0.54, minGames: 8 },
        nhl: { avgScore: 6, homeAdv: 0.55, minGames: 5 },
        hockey: { avgScore: 6, homeAdv: 0.55, minGames: 5 },
        ncaaf: { avgScore: 50, homeAdv: 0.60, minGames: 3 },
        ncaab: { avgScore: 140, homeAdv: 0.65, minGames: 5 },
        soccer: { avgScore: 3, homeAdv: 0.60, minGames: 5 },
        mls: { avgScore: 3, homeAdv: 0.60, minGames: 5 }
      }[sport] || { avgScore: 50, homeAdv: 0.55, minGames: 3 };
      
      const teamStats = new Map();
      const teamSchedule = new Map();
      let featuresBuilt = 0;
      
      // Sort chronologically
      sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      for (const game of sportGames) {
        const gameDate = new Date(game.start_time);
        const homeId = game.home_team_id;
        const awayId = game.away_team_id;
        
        // Initialize teams
        [homeId, awayId].forEach(id => {
          if (!teamStats.has(id)) {
            teamStats.set(id, {
              games: 0, wins: 0,
              homeGames: 0, homeWins: 0,
              awayGames: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last10: [], rolling7: [],
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
        if (home.games >= sportConfig.minGames && away.games >= sportConfig.minGames) {
          // Get player stats
          const homePlayerStats = statsByGameTeam.get(`${game.id}_${homeId}`) || [];
          const awayPlayerStats = statsByGameTeam.get(`${game.id}_${awayId}`) || [];
          
          // Calculate player power
          let homePlayerPower = 0;
          let awayPlayerPower = 0;
          
          homePlayerStats.forEach(stat => {
            homePlayerPower += (stat.points || 0) + (stat.assists || 0) * 0.5 + (stat.rebounds || 0) * 0.3;
          });
          
          awayPlayerStats.forEach(stat => {
            awayPlayerPower += (stat.points || 0) + (stat.assists || 0) * 0.5 + (stat.rebounds || 0) * 0.3;
          });
          
          // Normalize
          homePlayerPower = homePlayerStats.length > 0 ? homePlayerPower / homePlayerStats.length / 30 : 0;
          awayPlayerPower = awayPlayerStats.length > 0 ? awayPlayerPower / awayPlayerStats.length / 30 : 0;
          
          // Rest days
          const homeScheduleDates = teamSchedule.get(homeId);
          const awayScheduleDates = teamSchedule.get(awayId);
          
          const homeRest = homeScheduleDates.length > 0 ?
            Math.min(7, Math.floor((gameDate.getTime() - homeScheduleDates[homeScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          const awayRest = awayScheduleDates.length > 0 ?
            Math.min(7, Math.floor((gameDate.getTime() - awayScheduleDates[awayScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          
          // Calculate team features
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
          
          const homeRolling = home.rolling7.reduce((a, b) => a + b, 0) / Math.max(home.rolling7.length, 1);
          const awayRolling = away.rolling7.reduce((a, b) => a + b, 0) / Math.max(away.rolling7.length, 1);
          
          // Time features
          const dayOfWeek = gameDate.getDay();
          const hour = gameDate.getHours();
          
          // Build feature vector
          const features = [
            // Core differentials (10)
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            (homeAvgFor - awayAvgFor) / sportConfig.avgScore,
            (awayAvgAgainst - homeAvgAgainst) / sportConfig.avgScore,
            homeForm - awayForm,
            (home.elo - away.elo) / 400,
            home.momentum - away.momentum,
            (home.streak - away.streak) / 5,
            homeRolling - awayRolling,
            homePlayerPower - awayPlayerPower,
            
            // Context (6)
            (homeRest - awayRest) / 3,
            dayOfWeek / 6,
            hour / 23,
            dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
            hour >= 19 ? 1 : 0,
            sportConfig.homeAdv,
            
            // Absolute values (10)
            homeWR,
            awayWR,
            homeHomeWR,
            awayAwayWR,
            homeForm,
            awayForm,
            homeRolling,
            awayRolling,
            home.elo / 1500,
            away.elo / 1500,
            
            // Scoring (6)
            homeAvgFor / sportConfig.avgScore,
            awayAvgFor / sportConfig.avgScore,
            homeAvgAgainst / sportConfig.avgScore,
            awayAvgAgainst / sportConfig.avgScore,
            (homeAvgFor + homeAvgAgainst) / (2 * sportConfig.avgScore),
            (awayAvgFor + awayAvgAgainst) / (2 * sportConfig.avgScore),
            
            // Matchup (3)
            homeAvgFor / Math.max(awayAvgAgainst, sportConfig.avgScore * 0.5),
            awayAvgFor / Math.max(homeAvgAgainst, sportConfig.avgScore * 0.5),
            Math.abs(home.elo - away.elo) / 200,
            
            // Recent (3)
            home.last10.slice(-5).filter(x => x === 1).length / 5,
            away.last10.slice(-5).filter(x => x === 1).length / 5,
            Math.abs(home.streak) / 5,
            
            // Sport encoding
            sport === 'nfl' || sport === 'football' ? 1 : 0,
            sport === 'nba' || sport === 'basketball' ? 1 : 0,
            sport === 'mlb' || sport === 'baseball' ? 1 : 0,
            sport === 'nhl' || sport === 'hockey' ? 1 : 0,
            sport === 'ncaaf' || sport === 'ncaab' ? 1 : 0,
            sport === 'soccer' || sport === 'mls' ? 1 : 0
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          featuresBuilt++;
          
          // Progress
          if (featuresBuilt % 1000 === 0) {
            process.stdout.write(`\r  Built ${featuresBuilt} features...`);
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
          home.rolling7.push(1);
          away.last10.push(0);
          away.rolling7.push(0);
          home.streak = Math.max(1, home.streak + 1);
          away.streak = Math.min(-1, away.streak - 1);
        } else {
          away.wins++;
          away.awayWins++;
          home.last10.push(0);
          home.rolling7.push(0);
          away.last10.push(1);
          away.rolling7.push(1);
          home.streak = Math.min(-1, home.streak - 1);
          away.streak = Math.max(1, away.streak + 1);
        }
        
        // Update ELO
        const K = 20 + (Math.abs(game.home_score - game.away_score) / sportConfig.avgScore * 10);
        const expected = 1 / (1 + Math.pow(10, (away.elo - home.elo) / 400));
        home.elo += K * ((homeWon ? 1 : 0) - expected);
        away.elo += K * ((homeWon ? 0 : 1) - (1 - expected));
        
        // Update momentum
        home.momentum = home.momentum * 0.8 + (homeWon ? 1 : 0) * 0.2;
        away.momentum = away.momentum * 0.8 + (homeWon ? 0 : 1) * 0.2;
        
        // Update schedule
        teamSchedule.get(homeId).push(gameDate);
        teamSchedule.get(awayId).push(gameDate);
        
        // Maintain list sizes
        if (home.last10.length > 10) home.last10.shift();
        if (home.rolling7.length > 7) home.rolling7.shift();
        if (away.last10.length > 10) away.last10.shift();
        if (away.rolling7.length > 7) away.rolling7.shift();
        
        totalProcessed++;
      }
      
      console.log(chalk.green(`\n  ✅ Built ${featuresBuilt} features from ${sport}`));
    }
    
    console.log(chalk.bold.green(`\n✅ Total: ${allFeatures.length} features from ${games.length} games!`));
    
    // Check distribution
    const homeWins = allLabels.filter(l => l === 1).length;
    const awayWins = allLabels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Distribution: ${homeWins} home (${(homeWins/allLabels.length*100).toFixed(1)}%), ${awayWins} away`));
    
    // 6. Split data
    console.log(chalk.cyan('\n🔀 Splitting data (80/20)...'));
    const splitIdx = Math.floor(allFeatures.length * 0.8);
    
    const xTrain = allFeatures.slice(0, splitIdx);
    const yTrain = allLabels.slice(0, splitIdx);
    const xTest = allFeatures.slice(splitIdx);
    const yTest = allLabels.slice(splitIdx);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 7. Train model
    console.log(chalk.cyan('\n🧠 Training Random Forest on ALL data...'));
    console.log(chalk.gray('This will take a few minutes...'));
    
    const startTime = Date.now();
    
    const model = new RandomForestClassifier({
      nEstimators: 300,      // More trees for 50K+ data
      maxDepth: 25,          // Deeper for complex patterns
      minSamplesLeaf: 20,    // Higher to prevent overfitting
      maxFeatures: 0.7,      // Use 70% of features
      seed: 2025
    });
    
    model.train(xTrain, yTrain);
    
    console.log(chalk.green(`✅ Training completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 8. Test model
    console.log(chalk.cyan(`\n🎯 Testing on ${xTest.length} games...`));
    
    const predictions = model.predict(xTest);
    
    // Calculate metrics
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
    const homeAcc = homeTotal > 0 ? homeCorrect / homeTotal : 0;
    const awayAcc = awayTotal > 0 ? awayCorrect / awayTotal : 0;
    const balance = 2 * (homeAcc * awayAcc) / (homeAcc + awayAcc + 0.0001);
    
    console.log(chalk.bold.green('\n📊 PERFORMANCE ON ALL DATA:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance Score: ${(balance * 100).toFixed(1)}%`));
    
    // 9. Save model
    console.log(chalk.cyan('\n💾 Saving model...'));
    
    const modelData = {
      model: model.toJSON(),
      metadata: {
        name: 'All Data Model',
        totalGames: games.length,
        totalPlayerStats: playerStats.length,
        totalInjuries: injuries?.length || 0,
        features: 44,
        trainingGames: allFeatures.length,
        performance: {
          accuracy,
          homeAcc,
          awayAcc,
          balance
        },
        configuration: {
          nEstimators: 300,
          maxDepth: 25,
          minSamplesLeaf: 20,
          maxFeatures: 0.7
        },
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        trainedOn: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./models/all-data-model.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Model saved!'));
    
    // Final message
    console.log(chalk.bold.cyan('\n\n🚀 ALL DATA MODEL COMPLETE!'));
    console.log(chalk.bold.green(`📊 ACHIEVED ${(accuracy * 100).toFixed(1)}% ACCURACY`));
    console.log(chalk.yellow(`🎮 Trained on ${games.length} games`));
    console.log(chalk.yellow(`👥 Used ${playerStats.length} player stats`));
    console.log(chalk.yellow(`📈 Built ${allFeatures.length} feature vectors`));
    
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('\n🎉 65% TARGET ACHIEVED! 🎉'));
      console.log(chalk.bold.green('🏆 USING ALL DATA WORKED! 🏆'));
    } else {
      console.log(chalk.bold.yellow(`\n📈 ${((0.65 - accuracy) * 100).toFixed(1)}% improvement needed`));
    }
    
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

trainTrulyAllData().catch(console.error);