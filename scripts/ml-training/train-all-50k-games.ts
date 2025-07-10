#!/usr/bin/env tsx
/**
 * 🎯 TRAIN ON ALL 50K+ GAMES
 * Using the full dataset for maximum accuracy
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

async function trainAll50K() {
  console.log(chalk.bold.cyan('🎯 TRAINING ON ALL 50K+ GAMES'));
  console.log(chalk.yellow('Using full dataset for 65% accuracy target'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load ALL games - no limit, ALL SPORTS!
    console.log(chalk.cyan('1️⃣ Loading ALL games from ALL SPORTS...'));
    
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    console.log(chalk.green(`✅ Loaded ${games?.length} games with scores!`));
    
    // 2. Load player stats efficiently
    console.log(chalk.cyan('2️⃣ Loading player stats...'));
    
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('game_id, team_id, points, assists, rebounds')
      .order('game_id');
    
    console.log(chalk.green(`✅ Loaded ${playerStats?.length} player stats`));
    
    // Create player stats index
    const statsByGame = new Map();
    playerStats?.forEach(stat => {
      const key = stat.game_id;
      if (!statsByGame.has(key)) {
        statsByGame.set(key, { home: [], away: [] });
      }
      // We'll assign to home/away when processing games
      statsByGame.get(key)[stat.team_id] = stat;
    });
    
    // 3. Process games by sport for better features
    console.log(chalk.cyan('\n3️⃣ Building features from 50K+ games...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    
    // Group by sport
    const sportGroups = new Map();
    games?.forEach(game => {
      const sport = game.sport_id || 'nfl';
      if (!sportGroups.has(sport)) {
        sportGroups.set(sport, []);
      }
      sportGroups.get(sport).push(game);
    });
    
    console.log(chalk.cyan('\nGames by sport:'));
    sportGroups.forEach((games, sport) => {
      console.log(chalk.yellow(`  ${sport}: ${games.length} games`));
    });
    
    // Process each sport
    for (const [sport, sportGames] of sportGroups) {
      console.log(chalk.yellow(`\nProcessing ${sport}...`));
      
      // Sport-specific config - includes ALL sports
      const config = {
        nfl: { avgScore: 45, homeAdv: 0.57, minGames: 3 },
        football: { avgScore: 45, homeAdv: 0.57, minGames: 3 },
        nba: { avgScore: 110, homeAdv: 0.60, minGames: 5 },
        basketball: { avgScore: 110, homeAdv: 0.60, minGames: 5 },
        mlb: { avgScore: 9, homeAdv: 0.54, minGames: 10 },
        baseball: { avgScore: 9, homeAdv: 0.54, minGames: 10 },
        nhl: { avgScore: 6, homeAdv: 0.55, minGames: 5 },
        hockey: { avgScore: 6, homeAdv: 0.55, minGames: 5 },
        ncaaf: { avgScore: 50, homeAdv: 0.60, minGames: 3 },
        ncaab: { avgScore: 140, homeAdv: 0.65, minGames: 5 },
        soccer: { avgScore: 3, homeAdv: 0.60, minGames: 5 },
        mls: { avgScore: 3, homeAdv: 0.60, minGames: 5 }
      }[sport] || { avgScore: 45, homeAdv: 0.55, minGames: 3 };
      
      const teamStats = new Map();
      const teamSchedule = new Map();
      const h2hRecords = new Map();
      let featuresBuilt = 0;
      
      // Sort chronologically
      sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      // Process each game
      for (let i = 0; i < sportGames.length; i++) {
        const game = sportGames[i];
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
              rolling7: [],
              streak: 0,
              momentum: 0.5,
              elo: 1500,
              topPlayers: []
            });
          }
          if (!teamSchedule.has(teamId)) {
            teamSchedule.set(teamId, []);
          }
        });
        
        if (!h2hRecords.has(h2hKey)) {
          h2hRecords.set(h2hKey, { team1Wins: 0, team2Wins: 0 });
        }
        
        const home = teamStats.get(homeId);
        const away = teamStats.get(awayId);
        const h2h = h2hRecords.get(h2hKey);
        
        // Build features after minimum games
        if (home.games >= config.minGames && away.games >= config.minGames) {
          // Get player stats for this game
          const gameStats = statsByGame.get(game.id);
          let homePlayerPower = 0;
          let awayPlayerPower = 0;
          let homePlayerCount = 0;
          let awayPlayerCount = 0;
          
          if (gameStats) {
            // Calculate player impact
            Object.entries(gameStats).forEach(([teamId, stats]: [string, any]) => {
              if (stats && typeof stats === 'object' && 'points' in stats) {
                const power = (stats.points || 0) + 
                             (stats.assists || 0) * 0.5 + 
                             (stats.rebounds || 0) * 0.3;
                if (teamId === homeId || stats.team_id === homeId) {
                  homePlayerPower += power;
                  homePlayerCount++;
                } else if (teamId === awayId || stats.team_id === awayId) {
                  awayPlayerPower += power;
                  awayPlayerCount++;
                }
              }
            });
          }
          
          // Normalize player power
          if (homePlayerCount > 0) homePlayerPower /= homePlayerCount;
          if (awayPlayerCount > 0) awayPlayerPower /= awayPlayerCount;
          
          // Calculate rest days
          const homeLastGame = teamSchedule.get(homeId);
          const awayLastGame = teamSchedule.get(awayId);
          
          const homeRest = homeLastGame.length > 0 ?
            Math.min(7, Math.floor((gameDate.getTime() - homeLastGame[homeLastGame.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          const awayRest = awayLastGame.length > 0 ?
            Math.min(7, Math.floor((gameDate.getTime() - awayLastGame[awayLastGame.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          
          // Time features
          const dayOfWeek = gameDate.getDay();
          const hour = gameDate.getHours();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
          const isPrimeTime = hour >= 19 ? 1 : 0;
          
          // Team stats
          const homeWR = home.wins / home.games;
          const awayWR = away.wins / away.games;
          const homeHomeWR = home.homeGames > 0 ? home.homeWins / home.homeGames : homeWR;
          const awayAwayWR = away.awayGames > 0 ? away.awayWins / away.awayGames : awayWR;
          
          const homeAvgFor = home.totalFor / home.games;
          const awayAvgFor = away.totalFor / away.games;
          const homeAvgAgainst = home.totalAgainst / away.games;
          const awayAvgAgainst = away.totalAgainst / away.games;
          
          // Recent form
          const homeLast10 = home.last10.slice(-10);
          const awayLast10 = away.last10.slice(-10);
          const homeForm = homeLast10.length > 0 ? 
            homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
          const awayForm = awayLast10.length > 0 ?
            awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
          
          // Rolling average
          const homeRolling = home.rolling7.length > 0 ?
            home.rolling7.reduce((a, b) => a + b, 0) / home.rolling7.length : 0.5;
          const awayRolling = away.rolling7.length > 0 ?
            away.rolling7.reduce((a, b) => a + b, 0) / away.rolling7.length : 0.5;
          
          // H2H record
          const h2hTotal = h2h.team1Wins + h2h.team2Wins;
          const h2hHomeAdvantage = h2hTotal > 0 ?
            (homeId < awayId ? h2h.team1Wins : h2h.team2Wins) / h2hTotal : 0.5;
          
          // Build feature vector (optimized for 50K+ games)
          const features = [
            // Core differentials (10)
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            (homeAvgFor - awayAvgFor) / config.avgScore,
            (awayAvgAgainst - homeAvgAgainst) / config.avgScore,
            homeForm - awayForm,
            (home.elo - away.elo) / 400,
            home.momentum - away.momentum,
            (home.streak - away.streak) / 5,
            homeRolling - awayRolling,
            (homePlayerPower - awayPlayerPower) / 30,
            
            // Context (5)
            (homeRest - awayRest) / 3,
            dayOfWeek / 6,
            isWeekend,
            isPrimeTime,
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
            
            // Scoring (6)
            homeAvgFor / config.avgScore,
            awayAvgFor / config.avgScore,
            homeAvgAgainst / config.avgScore,
            awayAvgAgainst / config.avgScore,
            (homeAvgFor + homeAvgAgainst) / (2 * config.avgScore),
            (awayAvgFor + awayAvgAgainst) / (2 * config.avgScore),
            
            // Matchup (4)
            homeAvgFor / Math.max(awayAvgAgainst, config.avgScore * 0.5),
            awayAvgFor / Math.max(homeAvgAgainst, config.avgScore * 0.5),
            h2hHomeAdvantage,
            h2hTotal / 20,
            
            // Recent (4)
            home.last5.filter(x => x === 1).length / 5,
            away.last5.filter(x => x === 1).length / 5,
            Math.max(...home.last10.slice(-3).map((_, i, arr) => 
              arr.slice(i).filter(x => x === 1).length)) / 3,
            Math.max(...away.last10.slice(-3).map((_, i, arr) => 
              arr.slice(i).filter(x => x === 1).length)) / 3,
            
            // Sport indicators (dynamic - one-hot encoding)
            sport === 'nfl' || sport === 'football' ? 1 : 0,
            sport === 'mlb' || sport === 'baseball' ? 1 : 0,
            sport === 'nba' || sport === 'basketball' ? 1 : 0,
            sport === 'nhl' || sport === 'hockey' ? 1 : 0,
            sport === 'ncaaf' ? 1 : 0,
            sport === 'ncaab' ? 1 : 0,
            sport === 'soccer' || sport === 'mls' ? 1 : 0
          ];
          
          allFeatures.push(features);
          allLabels.push(game.home_score > game.away_score ? 1 : 0);
          featuresBuilt++;
          
          // Progress indicator
          if (featuresBuilt % 1000 === 0) {
            process.stdout.write(`\r  Built ${featuresBuilt} features...`);
          }
        }
        
        // Update stats
        const homeWon = game.home_score > game.away_score;
        const margin = Math.abs(game.home_score - game.away_score);
        
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
          home.last5.push(1);
          home.last10.push(1);
          home.last20.push(1);
          home.rolling7.push(1);
          away.last5.push(0);
          away.last10.push(0);
          away.last20.push(0);
          away.rolling7.push(0);
          home.streak = Math.max(1, home.streak + 1);
          away.streak = Math.min(-1, away.streak - 1);
          
          if (homeId < awayId) {
            h2h.team1Wins++;
          } else {
            h2h.team2Wins++;
          }
        } else {
          away.wins++;
          away.awayWins++;
          home.last5.push(0);
          home.last10.push(0);
          home.last20.push(0);
          home.rolling7.push(0);
          away.last5.push(1);
          away.last10.push(1);
          away.last20.push(1);
          away.rolling7.push(1);
          home.streak = Math.min(-1, home.streak - 1);
          away.streak = Math.max(1, away.streak + 1);
          
          if (awayId < homeId) {
            h2h.team1Wins++;
          } else {
            h2h.team2Wins++;
          }
        }
        
        // Update ELO
        const K = 20 + (margin / config.avgScore * 10);
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
        if (home.last5.length > 5) home.last5.shift();
        if (home.last10.length > 10) home.last10.shift();
        if (home.last20.length > 20) home.last20.shift();
        if (home.rolling7.length > 7) home.rolling7.shift();
        if (away.last5.length > 5) away.last5.shift();
        if (away.last10.length > 10) away.last10.shift();
        if (away.last20.length > 20) away.last20.shift();
        if (away.rolling7.length > 7) away.rolling7.shift();
      }
      
      console.log(chalk.green(`\n  ✅ Built ${featuresBuilt} features from ${sport}`));
    }
    
    console.log(chalk.green(`\n✅ Total features: ${allFeatures.length} from ${games?.length} games`));
    
    // Check balance
    const homeWins = allLabels.filter(l => l === 1).length;
    const awayWins = allLabels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Distribution: ${homeWins} home (${(homeWins/allLabels.length*100).toFixed(1)}%), ${awayWins} away`));
    
    // 4. Split data
    console.log(chalk.cyan('\n4️⃣ Splitting data (80/20)...'));
    const splitIdx = Math.floor(allFeatures.length * 0.8);
    
    const xTrain = allFeatures.slice(0, splitIdx);
    const yTrain = allLabels.slice(0, splitIdx);
    const xTest = allFeatures.slice(splitIdx);
    const yTest = allLabels.slice(splitIdx);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 5. Train single optimized model (for speed with 50K games)
    console.log(chalk.cyan('\n5️⃣ Training optimized Random Forest on 50K+ games...'));
    console.log(chalk.gray('This may take a few minutes...'));
    
    const startTime = Date.now();
    
    const model = new RandomForestClassifier({
      nEstimators: 200,      // Good balance
      maxDepth: 20,          // Deep enough for complex patterns
      minSamplesLeaf: 10,    // Prevent overfitting with 50K games
      maxFeatures: 0.7,      // Use 70% of features
      seed: 2025
    });
    
    model.train(xTrain, yTrain);
    
    console.log(chalk.green(`✅ Training completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
    
    // 6. Test model
    console.log(chalk.cyan(`\n6️⃣ Testing on ${xTest.length} games...`));
    
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
    
    console.log(chalk.bold.green('\n📊 PERFORMANCE ON 50K+ GAMES:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home Accuracy: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away Accuracy: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance Score: ${(balance * 100).toFixed(1)}%`));
    
    // 7. Save model
    console.log(chalk.cyan('\n7️⃣ Saving 50K+ games model...'));
    
    const modelData = {
      model: model.toJSON(),
      metadata: {
        name: '50K Games Model',
        totalGames: games?.length || 0,
        features: 44, // Updated for more sports
        trainingGames: allFeatures.length,
        performance: {
          accuracy,
          homeAcc,
          awayAcc,
          balance
        },
        featureGroups: {
          coreDifferentials: 10,
          context: 5,
          absoluteValues: 8,
          scoring: 6,
          matchup: 4,
          recent: 4,
          sport: 7 // Updated for all sports
        },
        configuration: {
          nEstimators: 200,
          maxDepth: 20,
          minSamplesLeaf: 10,
          maxFeatures: 0.7
        },
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        trainedOn: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./models/50k-games-model.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Model saved!'));
    
    // Success message
    console.log(chalk.bold.cyan('\n\n🎯 50K+ GAMES MODEL COMPLETE!'));
    console.log(chalk.bold.green(`📊 ACHIEVED ${(accuracy * 100).toFixed(1)}% ACCURACY`));
    console.log(chalk.yellow(`🎮 Trained on ${games?.length} games`));
    console.log(chalk.yellow(`📈 Used ${allFeatures.length} feature vectors`));
    
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('\n🎉 65% TARGET ACHIEVED WITH 50K+ GAMES! 🎉'));
    } else {
      console.log(chalk.bold.yellow(`\n📈 ${((0.65 - accuracy) * 100).toFixed(1)}% improvement needed for target`));
    }
    
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
  }
}

trainAll50K().catch(console.error);