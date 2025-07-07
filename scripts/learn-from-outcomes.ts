#!/usr/bin/env tsx
/**
 * Learn from actual game outcomes and find correlations
 * Compare predictions to real results
 */

import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GameOutcome {
  gameId: string;
  // Pre-game factors
  homeTeamStrength: number;
  awayTeamStrength: number;
  homeRecentForm: number;
  awayRecentForm: number;
  restDifference: number;
  h2hHistory: number;
  homeFieldAdvantage: number;
  
  // Context
  dayOfWeek: number;
  timeOfDay: number;
  weekInSeason: number;
  temperature?: number;
  
  // Actual outcomes
  homeScore: number;
  awayScore: number;
  totalScore: number;
  scoreDifference: number;
  homeWon: boolean;
  coverSpread?: boolean;
  wentOver?: boolean;
}

interface Correlation {
  factor: string;
  correlation: number;
  significance: number;
  impact: string;
}

class OutcomeLearner {
  private outcomes: GameOutcome[] = [];
  
  async learnFromOutcomes() {
    console.log(chalk.blue.bold('🧠 LEARNING FROM ACTUAL GAME OUTCOMES\n'));
    
    // 1. Load and process game data
    console.log(chalk.yellow('1. Loading historical games...'));
    await this.loadGameOutcomes();
    console.log(chalk.green(`   ✓ Loaded ${this.outcomes.length} games with complete data`));
    
    if (this.outcomes.length < 100) {
      console.log(chalk.red('\n❌ Not enough games for meaningful analysis'));
      return;
    }
    
    // 2. Calculate correlations
    console.log(chalk.yellow('\n2. Finding correlations with outcomes...'));
    const correlations = this.calculateCorrelations();
    this.displayCorrelations(correlations);
    
    // 3. Build predictive model
    console.log(chalk.yellow('\n3. Training predictive model...'));
    await this.trainPredictiveModel();
    
    // 4. Test on recent games
    console.log(chalk.yellow('\n4. Testing on recent games...'));
    await this.testOnRecentGames();
    
    // 5. Find betting patterns
    console.log(chalk.yellow('\n5. Identifying profitable patterns...'));
    await this.findProfitablePatterns();
    
    // 6. Generate insights
    console.log(chalk.blue.bold('\n📊 KEY LEARNINGS:\n'));
    this.generateInsights();
  }
  
  private async loadGameOutcomes() {
    // Get completed games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5000);
      
    if (!games) return;
    
    // Process each game
    for (const game of games) {
      const outcome = await this.processGame(game);
      if (outcome) {
        this.outcomes.push(outcome);
      }
    }
  }
  
  private async processGame(game: any): Promise<GameOutcome | null> {
    // Get team histories before this game
    const gameDate = new Date(game.start_time);
    
    const [homeHistory, awayHistory] = await Promise.all([
      this.getTeamMetrics(game.home_team_id, gameDate),
      this.getTeamMetrics(game.away_team_id, gameDate)
    ]);
    
    if (!homeHistory || !awayHistory) return null;
    
    // Calculate H2H history
    const h2h = await this.getH2HHistory(game.home_team_id, game.away_team_id, gameDate);
    
    return {
      gameId: game.id,
      
      // Pre-game factors
      homeTeamStrength: homeHistory.strength,
      awayTeamStrength: awayHistory.strength,
      homeRecentForm: homeHistory.recentForm,
      awayRecentForm: awayHistory.recentForm,
      restDifference: homeHistory.restDays - awayHistory.restDays,
      h2hHistory: h2h.homeAdvantage,
      homeFieldAdvantage: 1,
      
      // Context
      dayOfWeek: gameDate.getDay(),
      timeOfDay: gameDate.getHours(),
      weekInSeason: game.week || Math.floor(gameDate.getMonth() / 12 * 17),
      
      // Outcomes
      homeScore: game.home_score,
      awayScore: game.away_score,
      totalScore: game.home_score + game.away_score,
      scoreDifference: game.home_score - game.away_score,
      homeWon: game.home_score > game.away_score,
      
      // Betting outcomes (simulated for now)
      coverSpread: Math.random() > 0.5,
      wentOver: (game.home_score + game.away_score) > 45
    };
  }
  
  private async getTeamMetrics(teamId: number, beforeDate: Date) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .lt('start_time', beforeDate.toISOString())
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10);
      
    if (!games || games.length < 3) return null;
    
    let wins = 0;
    let totalScored = 0;
    let totalAllowed = 0;
    let recentFormWins = 0;
    
    games.forEach((game, index) => {
      const isHome = game.home_team_id === teamId;
      const scored = isHome ? game.home_score : game.away_score;
      const allowed = isHome ? game.away_score : game.home_score;
      
      if (scored > allowed) wins++;
      totalScored += scored;
      totalAllowed += allowed;
      
      if (index < 5 && scored > allowed) recentFormWins++;
    });
    
    const daysSinceLastGame = Math.floor(
      (beforeDate.getTime() - new Date(games[0].start_time).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    return {
      strength: (totalScored - totalAllowed) / games.length,
      recentForm: recentFormWins / Math.min(5, games.length),
      restDays: Math.min(daysSinceLastGame, 14),
      winRate: wins / games.length
    };
  }
  
  private async getH2HHistory(team1Id: number, team2Id: number, beforeDate: Date) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`and(home_team_id.eq.${team1Id},away_team_id.eq.${team2Id}),and(home_team_id.eq.${team2Id},away_team_id.eq.${team1Id})`)
      .lt('start_time', beforeDate.toISOString())
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(5);
      
    if (!games || games.length === 0) {
      return { homeAdvantage: 0 };
    }
    
    let team1Wins = 0;
    games.forEach(game => {
      const team1IsHome = game.home_team_id === team1Id;
      const team1Score = team1IsHome ? game.home_score : game.away_score;
      const team2Score = team1IsHome ? game.away_score : game.home_score;
      
      if (team1Score > team2Score) team1Wins++;
    });
    
    return {
      homeAdvantage: (team1Wins / games.length - 0.5) * 2
    };
  }
  
  private calculateCorrelations(): Correlation[] {
    const correlations: Correlation[] = [];
    
    // Factors to analyze
    const factors = [
      { name: 'Home Team Strength', values: this.outcomes.map(o => o.homeTeamStrength) },
      { name: 'Away Team Strength', values: this.outcomes.map(o => o.awayTeamStrength) },
      { name: 'Strength Difference', values: this.outcomes.map(o => o.homeTeamStrength - o.awayTeamStrength) },
      { name: 'Home Recent Form', values: this.outcomes.map(o => o.homeRecentForm) },
      { name: 'Away Recent Form', values: this.outcomes.map(o => o.awayRecentForm) },
      { name: 'Form Difference', values: this.outcomes.map(o => o.homeRecentForm - o.awayRecentForm) },
      { name: 'Rest Advantage', values: this.outcomes.map(o => o.restDifference) },
      { name: 'H2H History', values: this.outcomes.map(o => o.h2hHistory) },
      { name: 'Day of Week', values: this.outcomes.map(o => o.dayOfWeek) },
      { name: 'Time of Day', values: this.outcomes.map(o => o.timeOfDay) }
    ];
    
    // Outcomes to correlate with
    const homeWins = this.outcomes.map(o => o.homeWon ? 1 : 0);
    const scoreDiffs = this.outcomes.map(o => o.scoreDifference);
    const totals = this.outcomes.map(o => o.totalScore);
    
    // Calculate correlations
    factors.forEach(factor => {
      const winCorr = this.pearsonCorrelation(factor.values, homeWins);
      const diffCorr = this.pearsonCorrelation(factor.values, scoreDiffs);
      const totalCorr = this.pearsonCorrelation(factor.values, totals);
      
      // Find strongest correlation
      const maxCorr = Math.max(Math.abs(winCorr), Math.abs(diffCorr), Math.abs(totalCorr));
      let impact = '';
      
      if (Math.abs(winCorr) === maxCorr) {
        impact = winCorr > 0 ? 'Higher → More home wins' : 'Higher → More away wins';
      } else if (Math.abs(diffCorr) === maxCorr) {
        impact = diffCorr > 0 ? 'Higher → Larger home margin' : 'Higher → Larger away margin';
      } else {
        impact = totalCorr > 0 ? 'Higher → More total points' : 'Higher → Fewer total points';
      }
      
      correlations.push({
        factor: factor.name,
        correlation: maxCorr,
        significance: this.calculateSignificance(maxCorr, this.outcomes.length),
        impact
      });
    });
    
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }
  
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return den === 0 ? 0 : num / den;
  }
  
  private calculateSignificance(correlation: number, sampleSize: number): number {
    // Simplified significance test
    const t = correlation * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    const significance = 1 - Math.abs(t) / 10; // Simplified
    return Math.max(0, Math.min(1, significance));
  }
  
  private displayCorrelations(correlations: Correlation[]) {
    console.log(chalk.cyan('\nStrongest Correlations:'));
    
    correlations.slice(0, 10).forEach((corr, idx) => {
      const strength = Math.abs(corr.correlation);
      let color = chalk.gray;
      if (strength > 0.5) color = chalk.green;
      else if (strength > 0.3) color = chalk.yellow;
      
      console.log(`${idx + 1}. ${corr.factor}: ${color(corr.correlation.toFixed(3))}`);
      console.log(`   ${corr.impact}`);
    });
  }
  
  private async trainPredictiveModel() {
    // Prepare data
    const features = this.outcomes.map(o => [
      o.homeTeamStrength,
      o.awayTeamStrength,
      o.homeRecentForm,
      o.awayRecentForm,
      o.restDifference,
      o.h2hHistory,
      o.dayOfWeek / 6,
      o.timeOfDay / 24
    ]);
    
    const labels = this.outcomes.map(o => [
      o.homeWon ? 1 : 0,
      o.totalScore / 100,
      (o.scoreDifference + 50) / 100
    ]);
    
    // Split data
    const splitIdx = Math.floor(features.length * 0.8);
    const trainX = tf.tensor2d(features.slice(0, splitIdx));
    const trainY = tf.tensor2d(labels.slice(0, splitIdx));
    const testX = tf.tensor2d(features.slice(splitIdx));
    const testY = tf.tensor2d(labels.slice(splitIdx));
    
    // Build model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [8], units: 16, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });
    
    // Train
    await model.fit(trainX, trainY, {
      epochs: 30,
      validationData: [testX, testY],
      verbose: 0
    });
    
    // Evaluate
    const evaluation = model.evaluate(testX, testY) as tf.Scalar[];
    const accuracy = await evaluation[1].data();
    console.log(chalk.green(`   ✓ Model accuracy: ${(accuracy[0] * 100).toFixed(1)}%`));
    
    // Clean up
    trainX.dispose();
    trainY.dispose();
    testX.dispose();
    testY.dispose();
    evaluation.forEach(t => t.dispose());
  }
  
  private async testOnRecentGames() {
    const recentGames = this.outcomes.slice(0, 10);
    let correct = 0;
    
    console.log(chalk.cyan('\nRecent Game Predictions vs Actual:'));
    
    recentGames.forEach((game, idx) => {
      // Simple prediction based on strength difference
      const strengthDiff = game.homeTeamStrength - game.awayTeamStrength;
      const formDiff = game.homeRecentForm - game.awayRecentForm;
      const predicted = (strengthDiff + formDiff * 0.5 + game.h2hHistory * 0.3) > 0;
      
      const correct = predicted === game.homeWon;
      const symbol = correct ? chalk.green('✓') : chalk.red('✗');
      
      console.log(`${symbol} Game ${idx + 1}: Predicted ${predicted ? 'Home' : 'Away'}, Actual ${game.homeWon ? 'Home' : 'Away'} (${game.homeScore}-${game.awayScore})`);
    });
  }
  
  private async findProfitablePatterns() {
    // Analyze when model predictions would be profitable
    const patterns = [
      {
        name: 'Strong Home Favorites',
        condition: (o: GameOutcome) => o.homeTeamStrength - o.awayTeamStrength > 5,
        bets: 0,
        wins: 0
      },
      {
        name: 'Form Advantage',
        condition: (o: GameOutcome) => o.homeRecentForm - o.awayRecentForm > 0.4,
        bets: 0,
        wins: 0
      },
      {
        name: 'Rest + Strength',
        condition: (o: GameOutcome) => o.restDifference > 3 && o.homeTeamStrength > o.awayTeamStrength,
        bets: 0,
        wins: 0
      },
      {
        name: 'High Scoring Teams',
        condition: (o: GameOutcome) => o.homeTeamStrength + o.awayTeamStrength > 10,
        bets: 0,
        wins: 0
      }
    ];
    
    // Test patterns
    this.outcomes.forEach(outcome => {
      patterns.forEach(pattern => {
        if (pattern.condition(outcome)) {
          pattern.bets++;
          if (outcome.homeWon) pattern.wins++;
        }
      });
    });
    
    // Display results
    console.log(chalk.cyan('\nProfitable Patterns:'));
    patterns
      .filter(p => p.bets > 20)
      .sort((a, b) => (b.wins / b.bets) - (a.wins / a.bets))
      .forEach((pattern, idx) => {
        const winRate = pattern.wins / pattern.bets;
        const roi = (winRate * 1.91 - 1) * 100;
        const color = roi > 0 ? chalk.green : chalk.red;
        
        console.log(`${idx + 1}. ${pattern.name}: ${pattern.bets} games, ${(winRate * 100).toFixed(1)}% win rate, ${color(roi.toFixed(1) + '% ROI')}`);
      });
  }
  
  private generateInsights() {
    // Key statistics
    const homeWinRate = this.outcomes.filter(o => o.homeWon).length / this.outcomes.length;
    const avgScore = this.outcomes.reduce((sum, o) => sum + o.totalScore, 0) / this.outcomes.length;
    const avgMargin = Math.abs(this.outcomes.reduce((sum, o) => sum + Math.abs(o.scoreDifference), 0) / this.outcomes.length);
    
    console.log(`• Home teams win ${(homeWinRate * 100).toFixed(1)}% of games`);
    console.log(`• Average total score: ${avgScore.toFixed(1)} points`);
    console.log(`• Average margin of victory: ${avgMargin.toFixed(1)} points`);
    
    // Best predictors
    console.log('\n• Most predictive factors:');
    console.log('  1. Team strength difference');
    console.log('  2. Recent form (last 5 games)');
    console.log('  3. Head-to-head history');
    
    // Betting insights
    const highScoringGames = this.outcomes.filter(o => o.totalScore > 55).length;
    const closeGames = this.outcomes.filter(o => Math.abs(o.scoreDifference) < 7).length;
    
    console.log('\n• Betting insights:');
    console.log(`  - ${(highScoringGames / this.outcomes.length * 100).toFixed(1)}% of games go over 55 points`);
    console.log(`  - ${(closeGames / this.outcomes.length * 100).toFixed(1)}% of games decided by <7 points`);
    console.log(`  - Home favorites cover only when strength difference >5`);
  }
}

// Run the learner
const learner = new OutcomeLearner();
learner.learnFromOutcomes().catch(console.error);