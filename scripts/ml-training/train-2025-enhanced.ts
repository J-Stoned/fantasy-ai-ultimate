#!/usr/bin/env tsx
/**
 * 🏆 ENHANCED 2025 SEASON TRAINER
 * Target: 65%+ accuracy with advanced features
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

// Enhanced sport-specific configurations
const sportConfigs = {
  nba: {
    homeAdvantage: 0.604, // 60.4% historical
    avgScore: 110,
    scoreVariance: 15,
    features: ['pace', 'efficiency', 'starPower', 'restDays', 'b2b'],
    eloK: 20,
    minGames: 10
  },
  mlb: {
    homeAdvantage: 0.542, // 54.2% historical
    avgScore: 4.5,
    scoreVariance: 3,
    features: ['pitching', 'batting', 'bullpen', 'weather', 'dayGame'],
    eloK: 15,
    minGames: 20
  },
  nhl: {
    homeAdvantage: 0.548, // 54.8% historical
    avgScore: 3,
    scoreVariance: 2,
    features: ['powerplay', 'penaltyKill', 'goalie', 'backToBack'],
    eloK: 18,
    minGames: 10
  }
};

class EnhancedTrainer2025 {
  private teamElo = new Map();
  private headToHead = new Map();
  
  async train() {
    console.log(chalk.bold.cyan('🏆 ENHANCED 2025 SEASON TRAINER'));
    console.log(chalk.yellow('Advanced features for 65%+ accuracy!'));
    console.log(chalk.yellow('═'.repeat(60)));
    
    try {
      // 1. Load all games with enhanced data
      console.log(chalk.cyan('1️⃣ Loading enhanced game data...'));
      
      const { data: games, error } = await supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*)
        `)
        .in('sport_id', ['nba', 'nhl', 'mlb'])
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      
      console.log(chalk.green(`✅ Loaded ${games?.length} games with enhanced data`));
      
      // 2. Initialize ELO ratings
      this.initializeEloRatings(games);
      
      // 3. Build enhanced features
      console.log(chalk.cyan('\n2️⃣ Building enhanced features...'));
      
      const { features, labels, sports, gameIds } = await this.buildEnhancedFeatures(games);
      
      console.log(chalk.green(`✅ Built ${features.length} enhanced feature vectors`));
      console.log(chalk.gray(`   Features per vector: ${features[0]?.length || 0}`));
      
      // 4. Check class balance
      const homeWins = labels.filter(l => l === 1).length;
      const awayWins = labels.filter(l => l === 0).length;
      console.log(chalk.yellow(`\n📊 Class distribution: ${homeWins} home (${(homeWins/labels.length*100).toFixed(1)}%), ${awayWins} away`));
      
      // 5. Advanced train/validation/test split
      console.log(chalk.cyan('\n3️⃣ Creating stratified train/val/test split...'));
      const { trainSet, valSet, testSet } = this.stratifiedSplit(features, labels, sports, gameIds);
      
      console.log(chalk.yellow(`Training: ${trainSet.features.length} samples`));
      console.log(chalk.yellow(`Validation: ${valSet.features.length} samples`));
      console.log(chalk.yellow(`Testing: ${testSet.features.length} samples`));
      
      // 6. Hyperparameter optimization
      console.log(chalk.cyan('\n4️⃣ Optimizing hyperparameters...'));
      const bestParams = await this.optimizeHyperparameters(trainSet, valSet);
      
      // 7. Train final model with best parameters
      console.log(chalk.cyan('\n5️⃣ Training final model with optimized parameters...'));
      
      const finalModel = new RandomForestClassifier({
        nEstimators: bestParams.nEstimators,
        maxDepth: bestParams.maxDepth,
        minSamplesLeaf: bestParams.minSamplesLeaf,
        maxFeatures: bestParams.maxFeatures,
        seed: 2025
      });
      
      const startTime = Date.now();
      finalModel.train(trainSet.features, trainSet.labels);
      console.log(chalk.green(`✅ Trained in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
      
      // 8. Comprehensive evaluation
      console.log(chalk.cyan('\n6️⃣ Evaluating model performance...'));
      const testResults = this.evaluateModel(finalModel, testSet);
      
      // 9. Save enhanced model
      if (testResults.accuracy >= 0.65) {
        console.log(chalk.bold.green('\n🎉 TARGET ACHIEVED! Saving enhanced model...'));
      } else {
        console.log(chalk.cyan('\n7️⃣ Saving enhanced model...'));
      }
      
      const modelData = {
        model: finalModel.toJSON(),
        metadata: {
          name: '2025 Enhanced Multi-Sport Model',
          version: '2.0',
          features: features[0]?.length || 0,
          sports: ['nba', 'nhl', 'mlb'],
          totalGames: games?.length || 0,
          performance: testResults,
          hyperparameters: bestParams,
          enhancements: [
            'ELO rating system',
            'Head-to-head history',
            'Rest days tracking',
            'Home/away streaks',
            'Pythagorean expectation',
            'Sport-specific features',
            'Advanced momentum metrics'
          ],
          trainingSamples: trainSet.features.length,
          validationSamples: valSet.features.length,
          testSamples: testSet.features.length,
          trainedOn: new Date().toISOString()
        }
      };
      
      fs.writeFileSync('./models/2025-enhanced-model.json', JSON.stringify(modelData, null, 2));
      console.log(chalk.green('✅ Saved enhanced model!'));
      
      // 10. Feature importance analysis
      console.log(chalk.cyan('\n8️⃣ Analyzing feature importance...'));
      this.analyzeFeatureImportance(finalModel, features[0]?.length || 0);
      
      console.log(chalk.bold.cyan('\n\n🏆 ENHANCED MODEL COMPLETE!'));
      console.log(chalk.yellow(`Achieved ${(testResults.accuracy * 100).toFixed(1)}% accuracy`));
      if (testResults.accuracy >= 0.65) {
        console.log(chalk.bold.green('🎯 65% TARGET REACHED!'));
      }
      console.log(chalk.yellow('═'.repeat(60)));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    }
  }
  
  private initializeEloRatings(games: any[]) {
    console.log(chalk.gray('Initializing ELO ratings...'));
    
    // Initialize all teams at 1500
    const allTeams = new Set();
    games.forEach(game => {
      allTeams.add(`${game.sport_id}-${game.home_team_id}`);
      allTeams.add(`${game.sport_id}-${game.away_team_id}`);
    });
    
    allTeams.forEach(teamKey => {
      this.teamElo.set(teamKey, 1500);
    });
  }
  
  private async buildEnhancedFeatures(games: any[]) {
    const features: number[][] = [];
    const labels: number[] = [];
    const sports: string[] = [];
    const gameIds: number[] = [];
    
    // Group by sport for processing
    const gamesBySport = new Map();
    games.forEach(game => {
      if (!gamesBySport.has(game.sport_id)) {
        gamesBySport.set(game.sport_id, []);
      }
      gamesBySport.get(game.sport_id).push(game);
    });
    
    // Process each sport
    for (const [sportId, sportGames] of gamesBySport) {
      console.log(chalk.yellow(`\nProcessing ${sportId}...`));
      
      const config = sportConfigs[sportId] || sportConfigs.mlb;
      const teamStats = new Map();
      const teamSchedule = new Map();
      let featuresBuilt = 0;
      
      // Sort games chronologically
      const sortedGames = sportGames.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      for (let i = 0; i < sortedGames.length; i++) {
        const game = sortedGames[i];
        const gameDate = new Date(game.start_time);
        
        // Initialize teams
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!teamStats.has(teamId)) {
            teamStats.set(teamId, {
              games: 0, wins: 0, losses: 0,
              homeGames: 0, homeWins: 0,
              awayGames: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last5: [], last10: [], last20: [],
              homeStreak: 0, awayStreak: 0,
              momentum: 0.5, consistency: 0.5,
              avgFor: 0, avgAgainst: 0,
              pythagWins: 0, // Pythagorean wins
              strengthOfSchedule: 0,
              divisionRecord: { wins: 0, games: 0 }
            });
          }
          if (!teamSchedule.has(teamId)) {
            teamSchedule.set(teamId, []);
          }
        });
        
        const homeStats = teamStats.get(game.home_team_id);
        const awayStats = teamStats.get(game.away_team_id);
        
        // Need minimum games for meaningful features
        if (homeStats.games >= config.minGames && awayStats.games >= config.minGames) {
          // Get rest days
          const homeSchedule = teamSchedule.get(game.home_team_id);
          const awaySchedule = teamSchedule.get(game.away_team_id);
          const homeRestDays = this.calculateRestDays(homeSchedule, gameDate);
          const awayRestDays = this.calculateRestDays(awaySchedule, gameDate);
          
          // Get head-to-head record
          const h2hKey = `${Math.min(game.home_team_id, game.away_team_id)}-${Math.max(game.home_team_id, game.away_team_id)}`;
          const h2hRecord = this.headToHead.get(h2hKey) || { team1Wins: 0, team2Wins: 0, games: 0 };
          
          // Get current ELO ratings
          const homeEloKey = `${sportId}-${game.home_team_id}`;
          const awayEloKey = `${sportId}-${game.away_team_id}`;
          const homeElo = this.teamElo.get(homeEloKey) || 1500;
          const awayElo = this.teamElo.get(awayEloKey) || 1500;
          
          // Build enhanced feature vector
          const featureVector = this.createEnhancedFeatures(
            game, homeStats, awayStats, 
            homeRestDays, awayRestDays,
            h2hRecord, homeElo, awayElo,
            sportId, config, gameDate
          );
          
          features.push(featureVector);
          labels.push(game.home_score > game.away_score ? 1 : 0);
          sports.push(sportId);
          gameIds.push(game.id);
          featuresBuilt++;
        }
        
        // Update stats after game
        this.updateTeamStats(game, homeStats, awayStats, teamStats, sportId);
        
        // Update schedules
        teamSchedule.get(game.home_team_id).push(gameDate);
        teamSchedule.get(game.away_team_id).push(gameDate);
        
        // Update head-to-head
        const h2hKey = `${Math.min(game.home_team_id, game.away_team_id)}-${Math.max(game.home_team_id, game.away_team_id)}`;
        if (!this.headToHead.has(h2hKey)) {
          this.headToHead.set(h2hKey, { team1Wins: 0, team2Wins: 0, games: 0 });
        }
        const h2h = this.headToHead.get(h2hKey);
        h2h.games++;
        if (game.home_score > game.away_score) {
          if (game.home_team_id < game.away_team_id) h2h.team1Wins++;
          else h2h.team2Wins++;
        } else {
          if (game.away_team_id < game.home_team_id) h2h.team1Wins++;
          else h2h.team2Wins++;
        }
        
        // Update ELO ratings
        this.updateEloRatings(game, sportId, config.eloK);
      }
      
      console.log(chalk.green(`  ✅ Built ${featuresBuilt} feature vectors`));
    }
    
    return { features, labels, sports, gameIds };
  }
  
  private createEnhancedFeatures(
    game: any, homeStats: any, awayStats: any,
    homeRestDays: number, awayRestDays: number,
    h2hRecord: any, homeElo: number, awayElo: number,
    sportId: string, config: any, gameDate: Date
  ): number[] {
    const scoringNorm = config.avgScore;
    
    // Basic win rates
    const homeWR = homeStats.wins / homeStats.games;
    const awayWR = awayStats.wins / awayStats.games;
    const homeHomeWR = homeStats.homeGames > 5 ? homeStats.homeWins / homeStats.homeGames : homeWR;
    const awayAwayWR = awayStats.awayGames > 5 ? awayStats.awayWins / awayStats.awayGames : awayWR;
    
    // Scoring metrics
    const homeAvgFor = homeStats.totalFor / homeStats.games;
    const awayAvgFor = awayStats.totalFor / awayStats.games;
    const homeAvgAgainst = homeStats.totalAgainst / homeStats.games;
    const awayAvgAgainst = awayStats.totalAgainst / awayStats.games;
    
    // Recent form (weighted)
    const homeLast5 = homeStats.last5.slice(-5);
    const homeLast10 = homeStats.last10.slice(-10);
    const homeLast20 = homeStats.last20.slice(-20);
    const awayLast5 = awayStats.last5.slice(-5);
    const awayLast10 = awayStats.last10.slice(-10);
    const awayLast20 = awayStats.last20.slice(-20);
    
    const homeForm5 = homeLast5.length > 0 ? homeLast5.reduce((a, b) => a + b, 0) / homeLast5.length : 0.5;
    const awayForm5 = awayLast5.length > 0 ? awayLast5.reduce((a, b) => a + b, 0) / awayLast5.length : 0.5;
    const homeForm10 = homeLast10.length > 0 ? homeLast10.reduce((a, b) => a + b, 0) / homeLast10.length : 0.5;
    const awayForm10 = awayLast10.length > 0 ? awayLast10.reduce((a, b) => a + b, 0) / awayLast10.length : 0.5;
    
    // Pythagorean expectation
    const homePythag = homeStats.games > 20 ? 
      Math.pow(homeAvgFor, 2) / (Math.pow(homeAvgFor, 2) + Math.pow(homeAvgAgainst, 2)) : 0.5;
    const awayPythag = awayStats.games > 20 ? 
      Math.pow(awayAvgFor, 2) / (Math.pow(awayAvgFor, 2) + Math.pow(awayAvgAgainst, 2)) : 0.5;
    
    // Head-to-head
    const h2hHomeAdvantage = h2hRecord.games > 0 ? 
      (game.home_team_id < game.away_team_id ? h2hRecord.team1Wins : h2hRecord.team2Wins) / h2hRecord.games : 0.5;
    
    // ELO probability
    const eloProbability = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
    
    // Time features
    const hour = gameDate.getHours();
    const dayOfWeek = gameDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
    const isDayGame = hour < 18 ? 1 : 0;
    
    // Rest advantage
    const restAdvantage = Math.tanh((homeRestDays - awayRestDays) / 3);
    const homeFatigue = homeRestDays === 0 ? -0.1 : homeRestDays === 1 ? -0.05 : 0;
    const awayFatigue = awayRestDays === 0 ? -0.1 : awayRestDays === 1 ? -0.05 : 0;
    
    // Consistency (lower variance = more consistent)
    const homeConsistency = this.calculateConsistency(homeLast20);
    const awayConsistency = this.calculateConsistency(awayLast20);
    
    // Build comprehensive feature vector
    return [
      // Win rate differentials (5)
      homeWR - awayWR,
      homeHomeWR - awayAwayWR,
      homePythag - awayPythag,
      (homeStats.homeStreak - awayStats.awayStreak) / 5,
      homeStats.momentum - awayStats.momentum,
      
      // ELO and ratings (3)
      (homeElo - awayElo) / 400,
      eloProbability,
      eloProbability - config.homeAdvantage,
      
      // Scoring differentials (4)
      (homeAvgFor - awayAvgFor) / scoringNorm,
      (awayAvgAgainst - homeAvgAgainst) / scoringNorm,
      (homeAvgFor / homeAvgAgainst) - (awayAvgFor / awayAvgAgainst),
      Math.log((homeAvgFor + 1) / (homeAvgAgainst + 1)) - Math.log((awayAvgFor + 1) / (awayAvgAgainst + 1)),
      
      // Form metrics (6)
      homeForm5 - awayForm5,
      homeForm10 - awayForm10,
      (homeForm5 - homeForm10) - (awayForm5 - awayForm10), // form trend
      homeConsistency - awayConsistency,
      homeStats.consistency - awayStats.consistency,
      (homeLast5.filter(w => w === 1).length - awayLast5.filter(w => w === 1).length) / 5,
      
      // Head-to-head (2)
      h2hHomeAdvantage,
      h2hRecord.games > 0 ? Math.min(h2hRecord.games / 10, 1) : 0, // h2h reliability
      
      // Rest and schedule (4)
      restAdvantage,
      homeFatigue - awayFatigue,
      homeRestDays > 2 ? 1 : 0,
      awayRestDays > 2 ? 1 : 0,
      
      // Absolute values (8)
      homeWR,
      awayWR,
      homeHomeWR,
      awayAwayWR,
      homePythag,
      awayPythag,
      homeForm5,
      awayForm5,
      
      // Context features (6)
      config.homeAdvantage,
      isWeekend,
      isDayGame,
      sportId === 'nba' ? 1 : 0,
      sportId === 'mlb' ? 1 : 0,
      sportId === 'nhl' ? 1 : 0,
      
      // Advanced metrics (5)
      homeStats.strengthOfSchedule - awayStats.strengthOfSchedule,
      homeStats.divisionRecord.games > 0 ? homeStats.divisionRecord.wins / homeStats.divisionRecord.games : 0.5,
      awayStats.divisionRecord.games > 0 ? awayStats.divisionRecord.wins / awayStats.divisionRecord.games : 0.5,
      Math.abs(homeElo - 1500) / 500, // team quality indicator
      Math.abs(awayElo - 1500) / 500
    ];
  }
  
  private calculateRestDays(schedule: Date[], gameDate: Date): number {
    if (schedule.length === 0) return 3; // assume well-rested if no history
    
    const lastGame = schedule[schedule.length - 1];
    const daysDiff = Math.floor((gameDate.getTime() - lastGame.getTime()) / (1000 * 60 * 60 * 24));
    return Math.min(daysDiff, 7); // cap at 7 days
  }
  
  private calculateConsistency(results: number[]): number {
    if (results.length < 5) return 0.5;
    
    const winRate = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((sum, r) => sum + Math.pow(r - winRate, 2), 0) / results.length;
    
    // Lower variance = more consistent = higher score
    return 1 - Math.min(variance * 2, 1);
  }
  
  private updateTeamStats(game: any, homeStats: any, awayStats: any, teamStats: Map<any, any>, sportId: string) {
    const homeWon = game.home_score > game.away_score;
    
    // Update basic stats
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
      homeStats.last20.push(1);
      awayStats.last5.push(0);
      awayStats.last10.push(0);
      awayStats.last20.push(0);
      homeStats.homeStreak = Math.max(1, homeStats.homeStreak + 1);
      awayStats.awayStreak = Math.min(-1, awayStats.awayStreak - 1);
    } else {
      awayStats.wins++;
      awayStats.awayWins++;
      homeStats.losses++;
      homeStats.last5.push(0);
      homeStats.last10.push(0);
      homeStats.last20.push(0);
      awayStats.last5.push(1);
      awayStats.last10.push(1);
      awayStats.last20.push(1);
      awayStats.streak = Math.max(1, awayStats.streak + 1);
      homeStats.streak = Math.min(-1, homeStats.streak - 1);
    }
    
    // Update scoring
    homeStats.totalFor += game.home_score;
    homeStats.totalAgainst += game.away_score;
    awayStats.totalFor += game.away_score;
    awayStats.totalAgainst += game.home_score;
    
    // Update momentum (exponential moving average)
    homeStats.momentum = homeStats.momentum * 0.7 + (homeWon ? 1 : 0) * 0.3;
    awayStats.momentum = awayStats.momentum * 0.7 + (homeWon ? 0 : 1) * 0.3;
    
    // Update consistency
    if (homeStats.last10.length >= 10) {
      homeStats.consistency = this.calculateConsistency(homeStats.last10);
    }
    if (awayStats.last10.length >= 10) {
      awayStats.consistency = this.calculateConsistency(awayStats.last10);
    }
    
    // Maintain list sizes
    if (homeStats.last5.length > 5) homeStats.last5.shift();
    if (homeStats.last10.length > 10) homeStats.last10.shift();
    if (homeStats.last20.length > 20) homeStats.last20.shift();
    if (awayStats.last5.length > 5) awayStats.last5.shift();
    if (awayStats.last10.length > 10) awayStats.last10.shift();
    if (awayStats.last20.length > 20) awayStats.last20.shift();
    
    // Update Pythagorean wins
    homeStats.avgFor = homeStats.totalFor / homeStats.games;
    homeStats.avgAgainst = homeStats.totalAgainst / homeStats.games;
    awayStats.avgFor = awayStats.totalFor / awayStats.games;
    awayStats.avgAgainst = awayStats.totalAgainst / awayStats.games;
    
    homeStats.pythagWins = homeStats.games * Math.pow(homeStats.avgFor, 2) / 
      (Math.pow(homeStats.avgFor, 2) + Math.pow(homeStats.avgAgainst, 2));
    awayStats.pythagWins = awayStats.games * Math.pow(awayStats.avgFor, 2) / 
      (Math.pow(awayStats.avgFor, 2) + Math.pow(awayStats.avgAgainst, 2));
    
    // Update strength of schedule (average opponent win rate)
    // This is simplified - in reality would track all opponents
    const avgOpponentWR = 0.5; // placeholder
    homeStats.strengthOfSchedule = (homeStats.strengthOfSchedule * (homeStats.games - 1) + awayStats.wins / Math.max(awayStats.games, 1)) / homeStats.games;
    awayStats.strengthOfSchedule = (awayStats.strengthOfSchedule * (awayStats.games - 1) + homeStats.wins / Math.max(homeStats.games, 1)) / awayStats.games;
  }
  
  private updateEloRatings(game: any, sportId: string, K: number) {
    const homeEloKey = `${sportId}-${game.home_team_id}`;
    const awayEloKey = `${sportId}-${game.away_team_id}`;
    
    const homeElo = this.teamElo.get(homeEloKey) || 1500;
    const awayElo = this.teamElo.get(awayEloKey) || 1500;
    
    const expectedHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
    const homeWon = game.home_score > game.away_score ? 1 : 0;
    
    // Adjust K factor based on margin of victory
    const config = sportConfigs[sportId];
    const marginOfVictory = Math.abs(game.home_score - game.away_score);
    const movMultiplier = Math.log(marginOfVictory / config.avgScore + 1) + 1;
    const adjustedK = K * movMultiplier;
    
    const homeNewElo = homeElo + adjustedK * (homeWon - expectedHome);
    const awayNewElo = awayElo + adjustedK * ((1 - homeWon) - (1 - expectedHome));
    
    this.teamElo.set(homeEloKey, homeNewElo);
    this.teamElo.set(awayEloKey, awayNewElo);
  }
  
  private stratifiedSplit(features: number[][], labels: number[], sports: string[], gameIds: number[]) {
    // Group by sport and outcome for stratified sampling
    const stratifiedData = new Map();
    
    for (let i = 0; i < features.length; i++) {
      const key = `${sports[i]}-${labels[i]}`;
      if (!stratifiedData.has(key)) {
        stratifiedData.set(key, []);
      }
      stratifiedData.get(key).push({
        features: features[i],
        label: labels[i],
        sport: sports[i],
        gameId: gameIds[i]
      });
    }
    
    // Split each stratum
    const trainSet = { features: [], labels: [], sports: [], gameIds: [] };
    const valSet = { features: [], labels: [], sports: [], gameIds: [] };
    const testSet = { features: [], labels: [], sports: [], gameIds: [] };
    
    stratifiedData.forEach((data, key) => {
      // Shuffle within stratum
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }
      
      const trainEnd = Math.floor(data.length * 0.7);
      const valEnd = Math.floor(data.length * 0.85);
      
      // Add to sets
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (i < trainEnd) {
          trainSet.features.push(item.features);
          trainSet.labels.push(item.label);
          trainSet.sports.push(item.sport);
          trainSet.gameIds.push(item.gameId);
        } else if (i < valEnd) {
          valSet.features.push(item.features);
          valSet.labels.push(item.label);
          valSet.sports.push(item.sport);
          valSet.gameIds.push(item.gameId);
        } else {
          testSet.features.push(item.features);
          testSet.labels.push(item.label);
          testSet.sports.push(item.sport);
          testSet.gameIds.push(item.gameId);
        }
      }
    });
    
    return { trainSet, valSet, testSet };
  }
  
  private async optimizeHyperparameters(trainSet: any, valSet: any) {
    console.log(chalk.gray('Testing hyperparameter combinations...'));
    
    const paramGrid = {
      nEstimators: [300, 400, 500],
      maxDepth: [20, 25, 30],
      minSamplesLeaf: [2, 3],
      maxFeatures: [0.7, 0.8]
    };
    
    let bestParams = {
      nEstimators: 400,
      maxDepth: 25,
      minSamplesLeaf: 2,
      maxFeatures: 0.8,
      accuracy: 0
    };
    
    let tested = 0;
    const total = paramGrid.nEstimators.length * paramGrid.maxDepth.length * 
                   paramGrid.minSamplesLeaf.length * paramGrid.maxFeatures.length;
    
    for (const nEstimators of paramGrid.nEstimators) {
      for (const maxDepth of paramGrid.maxDepth) {
        for (const minSamplesLeaf of paramGrid.minSamplesLeaf) {
          for (const maxFeatures of paramGrid.maxFeatures) {
            tested++;
            process.stdout.write(chalk.gray(`\rTesting combination ${tested}/${total}...`));
            
            const model = new RandomForestClassifier({
              nEstimators,
              maxDepth,
              minSamplesLeaf,
              maxFeatures,
              seed: 42
            });
            
            model.train(trainSet.features, trainSet.labels);
            const predictions = model.predict(valSet.features);
            
            let correct = 0;
            for (let i = 0; i < predictions.length; i++) {
              if (predictions[i] === valSet.labels[i]) correct++;
            }
            
            const accuracy = correct / predictions.length;
            
            if (accuracy > bestParams.accuracy) {
              bestParams = {
                nEstimators,
                maxDepth,
                minSamplesLeaf,
                maxFeatures,
                accuracy
              };
            }
          }
        }
      }
    }
    
    console.log(chalk.green(`\n✅ Best validation accuracy: ${(bestParams.accuracy * 100).toFixed(1)}%`));
    console.log(chalk.gray(`   nEstimators: ${bestParams.nEstimators}`));
    console.log(chalk.gray(`   maxDepth: ${bestParams.maxDepth}`));
    console.log(chalk.gray(`   minSamplesLeaf: ${bestParams.minSamplesLeaf}`));
    console.log(chalk.gray(`   maxFeatures: ${bestParams.maxFeatures}`));
    
    return bestParams;
  }
  
  private evaluateModel(model: RandomForestClassifier, testSet: any) {
    const predictions = model.predict(testSet.features);
    
    let correct = 0;
    let homeCorrect = 0, homeTotal = 0;
    let awayCorrect = 0, awayTotal = 0;
    
    const sportMetrics = new Map();
    
    for (let i = 0; i < predictions.length; i++) {
      const sport = testSet.sports[i];
      if (!sportMetrics.has(sport)) {
        sportMetrics.set(sport, {
          correct: 0, total: 0,
          homeCorrect: 0, homeTotal: 0,
          awayCorrect: 0, awayTotal: 0
        });
      }
      
      const metrics = sportMetrics.get(sport);
      metrics.total++;
      
      if (predictions[i] === testSet.labels[i]) {
        correct++;
        metrics.correct++;
      }
      
      if (testSet.labels[i] === 1) {
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
    
    console.log(chalk.bold.green('\n📊 TEST SET PERFORMANCE:'));
    console.log(chalk.green(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(homeAcc * 100).toFixed(1)}% (${homeCorrect}/${homeTotal})`));
    console.log(chalk.green(`Away: ${(awayAcc * 100).toFixed(1)}% (${awayCorrect}/${awayTotal})`));
    console.log(chalk.green(`Balance Score: ${(balance * 100).toFixed(1)}%`));
    
    console.log(chalk.bold.cyan('\n📊 BY SPORT:'));
    const bySport = {};
    sportMetrics.forEach((metrics, sport) => {
      if (metrics.total > 0) {
        const sportAcc = metrics.correct / metrics.total;
        const sportHomeAcc = metrics.homeTotal > 0 ? metrics.homeCorrect / metrics.homeTotal : 0;
        const sportAwayAcc = metrics.awayTotal > 0 ? metrics.awayCorrect / metrics.awayTotal : 0;
        
        console.log(chalk.yellow(`\n${sport.toUpperCase()}:`));
        console.log(chalk.white(`  Accuracy: ${(sportAcc * 100).toFixed(1)}% (${metrics.correct}/${metrics.total})`));
        console.log(chalk.white(`  Home: ${(sportHomeAcc * 100).toFixed(1)}%`));
        console.log(chalk.white(`  Away: ${(sportAwayAcc * 100).toFixed(1)}%`));
        
        bySport[sport] = {
          accuracy: sportAcc,
          homeAccuracy: sportHomeAcc,
          awayAccuracy: sportAwayAcc,
          samples: metrics.total
        };
      }
    });
    
    return {
      accuracy,
      homeAccuracy: homeAcc,
      awayAccuracy: awayAcc,
      balanceScore: balance,
      bySport
    };
  }
  
  private analyzeFeatureImportance(model: RandomForestClassifier, numFeatures: number) {
    // Feature names for interpretation
    const featureNames = [
      // Win rate differentials (5)
      'WR_diff', 'Home/Away_WR_diff', 'Pythag_diff', 'Streak_diff', 'Momentum_diff',
      // ELO and ratings (3)
      'ELO_diff', 'ELO_probability', 'ELO_vs_home_advantage',
      // Scoring differentials (4)
      'Scoring_diff', 'Defense_diff', 'Efficiency_ratio_diff', 'Log_scoring_ratio_diff',
      // Form metrics (6)
      'Form5_diff', 'Form10_diff', 'Form_trend', 'Consistency_diff', 'Team_consistency_diff', 'Recent_wins_diff',
      // Head-to-head (2)
      'H2H_advantage', 'H2H_reliability',
      // Rest and schedule (4)
      'Rest_advantage', 'Fatigue_diff', 'Home_well_rested', 'Away_well_rested',
      // Absolute values (8)
      'Home_WR', 'Away_WR', 'Home_home_WR', 'Away_away_WR', 'Home_pythag', 'Away_pythag', 'Home_form5', 'Away_form5',
      // Context features (6)
      'Home_advantage', 'Weekend_game', 'Day_game', 'Is_NBA', 'Is_MLB', 'Is_NHL',
      // Advanced metrics (5)
      'SOS_diff', 'Home_division_WR', 'Away_division_WR', 'Home_quality', 'Away_quality'
    ];
    
    console.log(chalk.yellow('\nTop 10 Most Important Features:'));
    
    // Since ml-random-forest doesn't provide feature importance,
    // we'll note this as a future enhancement
    console.log(chalk.gray('(Feature importance analysis requires model introspection)'));
    console.log(chalk.gray('Key features based on domain knowledge:'));
    console.log(chalk.white('  1. ELO probability'));
    console.log(chalk.white('  2. Pythagorean expectation differential'));
    console.log(chalk.white('  3. Recent form (last 5 games)'));
    console.log(chalk.white('  4. Head-to-head record'));
    console.log(chalk.white('  5. Rest days advantage'));
  }
}

// Run the enhanced trainer
const trainer = new EnhancedTrainer2025();
trainer.train().catch(console.error);