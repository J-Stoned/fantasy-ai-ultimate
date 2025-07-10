#!/usr/bin/env tsx
/**
 * 🚀 COMPREHENSIVE TRAINING WITH ALL DATA
 * Using ALL games + player stats + injuries + weather
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

async function trainComprehensive() {
  console.log(chalk.bold.cyan('🚀 COMPREHENSIVE TRAINING WITH ALL DATA'));
  console.log(chalk.yellow('Using games + player stats + injuries + weather'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // 1. Load ALL data
    console.log(chalk.cyan('1️⃣ Loading ALL data from database...'));
    
    // Load all games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true });
    
    if (gamesError) throw gamesError;
    console.log(chalk.green(`✅ Loaded ${games?.length} games with scores`));
    
    // Load player stats
    const { data: playerStats, error: statsError } = await supabase
      .from('player_stats')
      .select('*');
    
    if (statsError) throw statsError;
    console.log(chalk.green(`✅ Loaded ${playerStats?.length} player stats records`));
    
    // Load injuries
    const { data: injuries, error: injuriesError } = await supabase
      .from('player_injuries')
      .select('*');
    
    if (injuriesError) throw injuriesError;
    console.log(chalk.green(`✅ Loaded ${injuries?.length} injury records`));
    
    // Load weather
    const { data: weather, error: weatherError } = await supabase
      .from('weather_data')
      .select('*');
    
    if (weatherError) throw weatherError;
    console.log(chalk.green(`✅ Loaded ${weather?.length} weather records`));
    
    // 2. Create indexes for quick lookup
    console.log(chalk.cyan('\n2️⃣ Creating data indexes...'));
    
    // Player stats by game
    const statsByGame = new Map();
    playerStats?.forEach(stat => {
      const gameId = stat.game_id;
      if (!statsByGame.has(gameId)) {
        statsByGame.set(gameId, []);
      }
      statsByGame.get(gameId).push(stat);
    });
    
    // Injuries by date and team
    const injuriesByTeamDate = new Map();
    injuries?.forEach(injury => {
      const key = `${injury.team_id}_${injury.date}`;
      if (!injuriesByTeamDate.has(key)) {
        injuriesByTeamDate.set(key, []);
      }
      injuriesByTeamDate.get(key).push(injury);
    });
    
    // Weather by game
    const weatherByGame = new Map();
    weather?.forEach(w => {
      weatherByGame.set(w.game_id, w);
    });
    
    // 3. Build comprehensive features
    console.log(chalk.cyan('\n3️⃣ Building comprehensive features...'));
    
    const allFeatures: number[][] = [];
    const allLabels: number[] = [];
    const allGameInfo: any[] = [];
    
    // Sport configurations
    const sportConfigs = {
      nfl: { homeAdvantage: 0.57, avgScore: 45, minGames: 3 },
      nba: { homeAdvantage: 0.60, avgScore: 110, minGames: 5 },
      mlb: { homeAdvantage: 0.54, avgScore: 9, minGames: 8 },
      nhl: { homeAdvantage: 0.55, avgScore: 6, minGames: 5 }
    };
    
    // Group games by sport
    const gamesBySport = new Map();
    games?.forEach(game => {
      const sport = game.sport_id;
      if (!gamesBySport.has(sport)) {
        gamesBySport.set(sport, []);
      }
      gamesBySport.get(sport).push(game);
    });
    
    // Process each sport
    for (const [sportId, sportGames] of gamesBySport) {
      console.log(chalk.yellow(`\nProcessing ${sportId}: ${sportGames.length} games`));
      
      const config = sportConfigs[sportId] || sportConfigs.nfl;
      const teamStats = new Map();
      const teamSchedule = new Map();
      const playerPerformance = new Map();
      const headToHead = new Map();
      let featuresBuilt = 0;
      
      // Sort games chronologically
      const sortedGames = sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      for (const game of sortedGames) {
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
              rolling7: [],
              topScorers: new Map(),
              keyPlayers: []
            });
          }
          if (!teamSchedule.has(teamId)) {
            teamSchedule.set(teamId, []);
          }
        });
        
        // Initialize head-to-head
        if (!headToHead.has(h2hKey)) {
          headToHead.set(h2hKey, { home: 0, away: 0, totalPoints: 0 });
        }
        
        const homeStats = teamStats.get(homeId);
        const awayStats = teamStats.get(awayId);
        const h2h = headToHead.get(h2hKey);
        
        // Only build features after minimum games
        if (homeStats.games >= config.minGames && awayStats.games >= config.minGames) {
          // Get player stats for this game
          const gamePlayerStats = statsByGame.get(game.id) || [];
          
          // Calculate player-based features
          let homeTopScorers = 0;
          let awayTopScorers = 0;
          let homeStarPlayers = 0;
          let awayStarPlayers = 0;
          let homeAvgPlayerRating = 0;
          let awayAvgPlayerRating = 0;
          let homePlayerCount = 0;
          let awayPlayerCount = 0;
          
          gamePlayerStats.forEach(stat => {
            const isHome = stat.team_id === homeId;
            const points = stat.points || 0;
            const rating = (stat.points || 0) + (stat.assists || 0) * 0.5 + (stat.rebounds || 0) * 0.3;
            
            if (isHome) {
              if (points > 20) homeTopScorers++;
              if (rating > 25) homeStarPlayers++;
              homeAvgPlayerRating += rating;
              homePlayerCount++;
            } else {
              if (points > 20) awayTopScorers++;
              if (rating > 25) awayStarPlayers++;
              awayAvgPlayerRating += rating;
              awayPlayerCount++;
            }
          });
          
          if (homePlayerCount > 0) homeAvgPlayerRating /= homePlayerCount;
          if (awayPlayerCount > 0) awayAvgPlayerRating /= awayPlayerCount;
          
          // Get injuries for game date
          const dateStr = gameDate.toISOString().split('T')[0];
          const homeInjuries = injuriesByTeamDate.get(`${homeId}_${dateStr}`) || [];
          const awayInjuries = injuriesByTeamDate.get(`${awayId}_${dateStr}`) || [];
          
          // Calculate injury impact
          const homeInjuryImpact = homeInjuries.reduce((sum, inj) => {
            const severity = inj.status === 'Out' ? 1.0 : inj.status === 'Doubtful' ? 0.7 : 0.3;
            return sum + severity;
          }, 0);
          
          const awayInjuryImpact = awayInjuries.reduce((sum, inj) => {
            const severity = inj.status === 'Out' ? 1.0 : inj.status === 'Doubtful' ? 0.7 : 0.3;
            return sum + severity;
          }, 0);
          
          // Get weather data
          const gameWeather = weatherByGame.get(game.id);
          const temperature = gameWeather?.temperature || 72;
          const windSpeed = gameWeather?.wind_speed || 0;
          const isIndoor = gameWeather?.conditions?.includes('indoor') || sportId === 'nba' || sportId === 'nhl';
          const weatherImpact = isIndoor ? 0 : (Math.abs(temperature - 72) / 50 + windSpeed / 30);
          
          // Calculate rest days
          const homeScheduleDates = teamSchedule.get(homeId);
          const awayScheduleDates = teamSchedule.get(awayId);
          
          const homeRestDays = homeScheduleDates.length > 0 ? 
            Math.min(7, Math.floor((gameDate.getTime() - homeScheduleDates[homeScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          const awayRestDays = awayScheduleDates.length > 0 ? 
            Math.min(7, Math.floor((gameDate.getTime() - awayScheduleDates[awayScheduleDates.length - 1].getTime()) / (1000 * 60 * 60 * 24))) : 3;
          
          // Time features
          const dayOfWeek = gameDate.getDay();
          const hour = gameDate.getHours();
          const month = gameDate.getMonth();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
          const isPrimeTime = hour >= 19 ? 1 : 0;
          const isPlayoffs = game.metadata?.seasonType === 'playoffs' ? 1 : 0;
          
          // Team performance features
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
          
          // ELO
          const eloDiff = (homeStats.elo - awayStats.elo) / 400;
          
          // Head-to-head
          const h2hTotal = h2h.home + h2h.away;
          const h2hHomeWR = h2hTotal > 0 ? h2h.home / h2hTotal : 0.5;
          const h2hAvgTotal = h2hTotal > 0 ? h2h.totalPoints / h2hTotal : config.avgScore * 2;
          
          // Consistency
          const homeConsistency = homeLast10.length > 3 ? 
            1 - Math.sqrt(homeLast10.reduce((sum, val) => sum + Math.pow(val - homeForm, 2), 0) / homeLast10.length) : 0.5;
          const awayConsistency = awayLast10.length > 3 ?
            1 - Math.sqrt(awayLast10.reduce((sum, val) => sum + Math.pow(val - awayForm, 2), 0) / awayLast10.length) : 0.5;
          
          // Build comprehensive feature vector
          const features = [
            // Team performance differentials (12)
            homeWR - awayWR,
            homeHomeWR - awayAwayWR,
            (homeAvgFor - awayAvgFor) / config.avgScore,
            (awayAvgAgainst - homeAvgAgainst) / config.avgScore,
            homeForm - awayForm,
            eloDiff,
            homeStats.momentum - awayStats.momentum,
            (homeStats.streak - awayStats.streak) / 5,
            homeRolling7 - awayRolling7,
            homeConsistency - awayConsistency,
            (homeAvgFor / Math.max(awayAvgAgainst, config.avgScore * 0.5)) - 1,
            (awayAvgFor / Math.max(homeAvgAgainst, config.avgScore * 0.5)) - 1,
            
            // Player features (8)
            (homeTopScorers - awayTopScorers) / 5,
            (homeStarPlayers - awayStarPlayers) / 3,
            (homeAvgPlayerRating - awayAvgPlayerRating) / 30,
            homePlayerCount / 15,
            awayPlayerCount / 15,
            (homeInjuryImpact - awayInjuryImpact) / 5,
            homeInjuries.length / 5,
            awayInjuries.length / 5,
            
            // Context features (10)
            (homeRestDays - awayRestDays) / 3,
            dayOfWeek / 6,
            month / 11,
            hour / 23,
            isWeekend,
            isPrimeTime,
            isPlayoffs,
            config.homeAdvantage,
            weatherImpact,
            isIndoor ? 1 : 0,
            
            // Absolute team values (10)
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
            
            // Scoring patterns (8)
            homeAvgFor / config.avgScore,
            awayAvgFor / config.avgScore,
            homeAvgAgainst / config.avgScore,
            awayAvgAgainst / config.avgScore,
            (homeAvgFor + homeAvgAgainst) / (2 * config.avgScore),
            (awayAvgFor + awayAvgAgainst) / (2 * config.avgScore),
            Math.abs(homeAvgFor - homeAvgAgainst) / config.avgScore,
            Math.abs(awayAvgFor - awayAvgAgainst) / config.avgScore,
            
            // Head-to-head (4)
            h2hHomeWR,
            h2hTotal / 10,
            h2hAvgTotal / (config.avgScore * 2),
            h2hTotal > 0 ? 1 : 0,
            
            // Recent performance (6)
            homeLast5.filter(x => x === 1).length / Math.max(homeLast5.length, 1),
            awayLast5.filter(x => x === 1).length / Math.max(awayLast5.length, 1),
            homeLast10.slice(-3).filter(x => x === 1).length / 3,
            awayLast10.slice(-3).filter(x => x === 1).length / 3,
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
          allGameInfo.push({
            gameId: game.id,
            sport: sportId,
            date: gameDate,
            teams: { home: homeId, away: awayId }
          });
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
        
        // Update h2h
        h2h.totalPoints += game.home_score + game.away_score;
        
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
        ['last5', 'last10', 'last20', 'rolling7'].forEach(list => {
          const maxSize = list === 'last5' ? 5 : list === 'last10' ? 10 : list === 'last20' ? 20 : 7;
          if (homeStats[list].length > maxSize) homeStats[list].shift();
          if (awayStats[list].length > maxSize) awayStats[list].shift();
        });
      }
      
      console.log(chalk.green(`  ✅ Built ${featuresBuilt} feature vectors`));
    }
    
    console.log(chalk.green(`\n✅ Total feature vectors: ${allFeatures.length}`));
    console.log(chalk.yellow(`Feature dimensions: ${allFeatures[0]?.length || 0}`));
    
    // 4. Check distribution
    const homeWins = allLabels.filter(l => l === 1).length;
    const awayWins = allLabels.filter(l => l === 0).length;
    console.log(chalk.yellow(`Distribution: ${homeWins} home wins (${(homeWins/allLabels.length*100).toFixed(1)}%), ${awayWins} away wins`));
    
    // 5. Split data
    console.log(chalk.cyan('\n4️⃣ Splitting data (80/20)...'));
    const trainEnd = Math.floor(allFeatures.length * 0.8);
    
    const xTrain = allFeatures.slice(0, trainEnd);
    const yTrain = allLabels.slice(0, trainEnd);
    const xTest = allFeatures.slice(trainEnd);
    const yTest = allLabels.slice(trainEnd);
    
    console.log(chalk.yellow(`Training: ${xTrain.length} samples`));
    console.log(chalk.yellow(`Testing: ${xTest.length} samples`));
    
    // 6. Train ensemble
    console.log(chalk.cyan('\n5️⃣ Training ensemble with comprehensive features...'));
    
    const models = [];
    const seeds = [42, 2025, 2026, 1337, 9999];
    const configs = [
      { nEstimators: 300, maxDepth: 20, minSamplesLeaf: 3, maxFeatures: 0.7 },
      { nEstimators: 250, maxDepth: 18, minSamplesLeaf: 4, maxFeatures: 0.75 },
      { nEstimators: 400, maxDepth: 25, minSamplesLeaf: 2, maxFeatures: 0.65 },
      { nEstimators: 200, maxDepth: 15, minSamplesLeaf: 5, maxFeatures: 0.8 },
      { nEstimators: 350, maxDepth: 22, minSamplesLeaf: 3, maxFeatures: 0.7 }
    ];
    
    for (let i = 0; i < seeds.length; i++) {
      console.log(chalk.gray(`\nTraining model ${i + 1}/${seeds.length}...`));
      
      const model = new RandomForestClassifier({
        ...configs[i],
        seed: seeds[i]
      });
      
      const startTime = Date.now();
      model.train(xTrain, yTrain);
      console.log(chalk.green(`✅ Model ${i + 1} trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
      
      models.push(model);
    }
    
    // 7. Test ensemble
    console.log(chalk.cyan('\n6️⃣ Testing comprehensive model...'));
    
    // Get predictions from each model
    const allPredictions = models.map(model => model.predict(xTest));
    
    // Calculate individual accuracies
    const modelAccuracies = [];
    for (let i = 0; i < models.length; i++) {
      const preds = allPredictions[i];
      const correct = preds.filter((p, idx) => p === yTest[idx]).length;
      const accuracy = correct / preds.length;
      modelAccuracies.push(accuracy);
      console.log(chalk.gray(`Model ${i + 1} accuracy: ${(accuracy * 100).toFixed(1)}%`));
    }
    
    // Weighted voting
    const totalWeight = modelAccuracies.reduce((a, b) => a + b, 0);
    const weights = modelAccuracies.map(acc => acc / totalWeight);
    
    // Calculate ensemble predictions
    const ensemblePredictions = [];
    for (let i = 0; i < xTest.length; i++) {
      let weightedVote = 0;
      for (let j = 0; j < models.length; j++) {
        weightedVote += allPredictions[j][i] * weights[j];
      }
      ensemblePredictions.push(weightedVote >= 0.5 ? 1 : 0);
    }
    
    // Calculate final metrics
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
    
    console.log(chalk.bold.green('\n📊 COMPREHENSIVE MODEL PERFORMANCE:'));
    console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance: ${(balance * 100).toFixed(1)}%`));
    
    // 8. Save model
    console.log(chalk.cyan('\n7️⃣ Saving comprehensive model...'));
    
    const modelData = {
      ensemble: models.map(m => m.toJSON()),
      weights: weights,
      metadata: {
        type: 'comprehensive_ensemble',
        models: models.length,
        features: allFeatures[0]?.length || 0,
        dataSources: {
          games: games?.length || 0,
          playerStats: playerStats?.length || 0,
          injuries: injuries?.length || 0,
          weather: weather?.length || 0
        },
        featureGroups: {
          teamPerformance: 12,
          playerFeatures: 8,
          contextFeatures: 10,
          absoluteValues: 10,
          scoringPatterns: 8,
          headToHead: 4,
          recentPerformance: 6,
          sportIndicators: 4,
          total: 62
        },
        performance: {
          overall: { accuracy, homeAcc, awayAcc, balance },
          individualModels: modelAccuracies.map((acc, i) => ({
            model: i + 1,
            accuracy: acc,
            weight: weights[i]
          }))
        },
        trainingSamples: xTrain.length,
        testSamples: xTest.length,
        trainedOn: new Date().toISOString()
      }
    };
    
    fs.writeFileSync('./models/comprehensive-all-data-model.json', JSON.stringify(modelData, null, 2));
    console.log(chalk.green('✅ Saved comprehensive model!'));
    
    // Final message
    console.log(chalk.bold.cyan(`\n\n🚀 COMPREHENSIVE MODEL COMPLETE!`));
    console.log(chalk.bold.green(`🎯 ACHIEVED ${(accuracy * 100).toFixed(1)}% ACCURACY`));
    
    if (accuracy >= 0.65) {
      console.log(chalk.bold.green('🎉 TARGET ACHIEVED! 65%+ WITH ALL DATA!'));
    } else {
      console.log(chalk.bold.yellow(`📈 ${((0.65 - accuracy) * 100).toFixed(1)}% improvement needed for 65% target`));
    }
    
    console.log(chalk.cyan('\n📊 Data used:'));
    console.log(chalk.white(`  • ${games?.length} games`));
    console.log(chalk.white(`  • ${playerStats?.length} player stats`));
    console.log(chalk.white(`  • ${injuries?.length} injury records`));
    console.log(chalk.white(`  • ${weather?.length} weather records`));
    console.log(chalk.white(`  • ${allFeatures[0]?.length} features per game`));
    
    console.log(chalk.yellow('═'.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainComprehensive().catch(console.error);