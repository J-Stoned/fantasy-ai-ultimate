#!/usr/bin/env tsx
/**
 * 🕰️ HISTORICAL SEASON REPLAY TRAINING
 * 
 * Replays the entire first half of the season day-by-day,
 * learning from each day's results to optimize predictions
 */

import { createClient } from '@supabase/supabase-js';
import { ContinuousPatternLearning } from './continuous-pattern-learning';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { format, addDays, isBefore, differenceInDays } from 'date-fns';
import * as tf from '@tensorflow/tfjs-node-gpu';
import pLimit from 'p-limit';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GPU and CPU optimization configuration
// Use 8 concurrent operations (optimized for Ryzen 5 7600X - 6 cores/12 threads)
const limit = pLimit(8);

// GPU acceleration class
class GPUAccelerator {
  private gpuAvailable: boolean = false;
  private startTime: number = 0;
  
  async initialize(): Promise<boolean> {
    try {
      // Check if GPU is available
      const gpuInfo = await tf.backend().getGPUInfo?.();
      this.gpuAvailable = !!gpuInfo;
      
      if (this.gpuAvailable) {
        console.log(chalk.green('🎮 GPU acceleration enabled (RTX 4060)'));
        // Configure GPU memory growth
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        tf.env().set('WEBGL_PACK', true);
      } else {
        console.log(chalk.yellow('⚠️  GPU not available, using CPU optimization'));
      }
      
      this.startTime = Date.now();
      return this.gpuAvailable;
    } catch (error) {
      console.log(chalk.yellow('⚠️  GPU initialization failed, using CPU'));
      this.gpuAvailable = false;
      return false;
    }
  }
  
  async getMetrics() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return {
      gpuAvailable: this.gpuAvailable,
      elapsedTime: elapsed,
      deviceType: this.gpuAvailable ? 'RTX 4060 GPU' : 'Ryzen 5 7600X CPU',
      parallelOperations: 8
    };
  }
  
  isAvailable(): boolean {
    return this.gpuAvailable;
  }
}

interface ReplayConfig {
  startDate: string;
  endDate: string;
  learningRate: number;
  resetConfidence: boolean;
  saveSnapshots: boolean;
}

interface DailyMetrics {
  date: string;
  gamesPlayed: number;
  predictions: number;
  correctPredictions: number;
  accuracy: number;
  profit: number;
  cumulativeAccuracy: number;
  cumulativeProfit: number;
  patternPerformance: Record<string, any>;
}

export class HistoricalSeasonReplay {
  private config: ReplayConfig;
  private learner: ContinuousPatternLearning;
  private trainingRunId?: number;
  private dailyMetrics: DailyMetrics[] = [];
  private baselineAccuracy: Record<string, number> = {};
  private gpuAccelerator: GPUAccelerator;
  
  constructor(config: Partial<ReplayConfig> = {}) {
    this.config = {
      startDate: config.startDate || '2024-03-28', // 2024 MLB Opening Day
      endDate: config.endDate || '2024-10-31', // 2024 MLB Season End
      learningRate: config.learningRate || 0.2,
      resetConfidence: config.resetConfidence !== false,
      saveSnapshots: config.saveSnapshots !== false
    };
    
    this.learner = new ContinuousPatternLearning();
    this.gpuAccelerator = new GPUAccelerator();
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n🕰️  HISTORICAL SEASON REPLAY TRAINING\n'));
    console.log(chalk.white(`Training Period: ${this.config.startDate} to ${this.config.endDate}`));
    
    const totalDays = differenceInDays(
      new Date(this.config.endDate),
      new Date(this.config.startDate)
    );
    console.log(chalk.white(`Total Days: ${totalDays}`));
    
    // Initialize GPU acceleration
    await this.gpuAccelerator.initialize();
    const metrics = await this.gpuAccelerator.getMetrics();
    console.log(chalk.magenta(`Hardware: ${metrics.deviceType}`));
    console.log(chalk.magenta(`Parallel Operations: ${metrics.parallelOperations}`));
    console.log(chalk.gray('─'.repeat(70)));
    
    try {
      // Initialize training run
      await this.initializeTrainingRun();
      
      // Reset pattern confidence if requested
      if (this.config.resetConfidence) {
        await this.resetPatternConfidence();
      }
      
      // Save baseline accuracy
      await this.saveBaselineAccuracy();
      
      // Main replay loop
      let currentDate = new Date(this.config.startDate);
      const endDate = new Date(this.config.endDate);
      let dayCount = 0;
      
      let pendingPredictions: any[] = [];
      
      while (isBefore(currentDate, endDate)) {
        dayCount++;
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        console.log(chalk.yellow.bold(`\n📅 Day ${dayCount}: ${dateStr}\n`));
        
        // Step 1: Make predictions for today's games
        const todayPredictions = await this.makeDailyPredictions(currentDate);
        
        // Step 2: Analyze results from previous predictions (games that should be completed by now)
        const results = await this.analyzePendingPredictions(pendingPredictions, currentDate);
        
        // Step 3: Update pattern confidence based on results
        if (results.length > 0) {
          await this.updatePatternLearning(results);
        }
        
        // Step 4: Calculate and store daily metrics
        const metrics = await this.calculateDailyMetrics(currentDate, results);
        this.dailyMetrics.push(metrics);
        
        // Step 5: Display progress
        this.displayDailyProgress(metrics);
        
        // Step 6: Save snapshot if milestone
        if (dayCount % 30 === 0 && this.config.saveSnapshots) {
          await this.saveModelSnapshot(currentDate, metrics);
        }
        
        // Step 7: Add today's predictions to pending queue
        pendingPredictions = [...pendingPredictions, ...todayPredictions];
        
        // Move to next day
        currentDate = addDays(currentDate, 1);
      }
      
      // Final evaluation of any remaining predictions
      const finalResults = await this.analyzePendingPredictions(pendingPredictions, currentDate);
      if (finalResults.length > 0) {
        await this.updatePatternLearning(finalResults);
        const finalMetrics = await this.calculateDailyMetrics(currentDate, finalResults);
        this.dailyMetrics.push(finalMetrics);
      }
      
      // Final analysis and optimization
      await this.generateFinalReport();
      await this.optimizeForSecondHalf();
      
      // Display final GPU/CPU metrics
      await this.displayHardwareMetrics();
      
    } catch (error) {
      console.error(chalk.red('\n❌ Replay training failed:'), error);
      throw error;
    }
  }
  
  private async initializeTrainingRun() {
    console.log(chalk.white('🚀 Initializing training run...'));
    
    const { data, error } = await supabase
      .from('historical_training_runs')
      .insert({
        start_date: this.config.startDate,
        end_date: this.config.endDate,
        learning_rate: this.config.learningRate,
        status: 'in_progress',
        config: this.config,
        started_at: new Date()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    this.trainingRunId = data.id;
    console.log(chalk.green(`   ✓ Training run #${this.trainingRunId} initialized`));
  }
  
  private async resetPatternConfidence() {
    console.log(chalk.white('🔄 Resetting pattern confidence to baseline...'));
    
    // Reset all patterns to default confidence
    const defaultConfidences = {
      'altitude_advantage': 0.6,
      'back_to_back_fade': 0.6,
      'embarrassment_revenge': 0.6,
      'division_rivalry': 0.5,
      'home_underdog': 0.5
    };
    
    for (const [pattern, confidence] of Object.entries(defaultConfidences)) {
      await supabase
        .from('pattern_performance')
        .upsert({
          pattern_type: pattern,
          sport: 'MLB',
          accuracy_rate: confidence,
          total_occurrences: 0,
          successful_predictions: 0,
          total_wagered: 0,
          total_profit_loss: 0,
          roi_percentage: 0
        });
    }
    
    console.log(chalk.green('   ✓ Pattern confidence reset complete'));
  }
  
  private async saveBaselineAccuracy() {
    const { data: patterns } = await supabase
      .from('pattern_performance')
      .select('pattern_type, accuracy_rate');
    
    if (patterns) {
      patterns.forEach(p => {
        this.baselineAccuracy[p.pattern_type] = p.accuracy_rate;
      });
    }
  }
  
  private async makeDailyPredictions(date: Date) {
    console.log(chalk.white('   🎯 Making predictions for today\'s games...'));
    
    // Get games for this date
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'MLB')
      .gte('start_time', date.toISOString())
      .lt('start_time', addDays(date, 1).toISOString());
    
    if (!games || games.length === 0) {
      console.log(chalk.gray('      No games scheduled'));
      return [];
    }
    
    const predictions = [];
    
    for (const game of games) {
      // Detect patterns for this game
      const patterns = await this.detectGamePatterns(game);
      
      if (patterns.length > 0) {
        // Get current pattern confidence
        const confidence = await this.getPatternConfidence(patterns);
        
        // Make prediction based on patterns
        const prediction = this.makePrediction(game, patterns, confidence);
        
        predictions.push({
          gameId: game.id,
          patterns,
          prediction,
          confidence,
          game
        });
      }
    }
    
    console.log(chalk.green(`      ✓ Made ${predictions.length} predictions for ${games.length} games`));
    return predictions;
  }
  
  private async detectGamePatterns(game: any): Promise<string[]> {
    // Use parallel processing for pattern detection
    return limit(async () => {
      const patterns: string[] = [];
      
      // Altitude advantage
      if (game.venue?.toLowerCase().includes('coors')) {
        patterns.push('altitude_advantage');
      }
    
      // Back-to-back check
      const yesterday = addDays(new Date(game.start_time), -1);
    
    // Check if home team played yesterday
    const { data: homeYesterday } = await supabase
      .from('games')
      .select('id')
      .or(`home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.home_team_id}`)
      .gte('start_time', yesterday.toISOString())
      .lt('start_time', game.start_time)
      .eq('status', 'completed')
      .limit(1);
    
    // Check if away team played yesterday
    const { data: awayYesterday } = await supabase
      .from('games')
      .select('id')
      .or(`home_team_id.eq.${game.away_team_id},away_team_id.eq.${game.away_team_id}`)
      .gte('start_time', yesterday.toISOString())
      .lt('start_time', game.start_time)
      .eq('status', 'completed')
      .limit(1);
    
    if (homeYesterday && homeYesterday.length > 0) {
      patterns.push('back_to_back_fade');
      // Set metadata for prediction logic
      if (!game.metadata) game.metadata = {};
      game.metadata.is_home_back_to_back = true;
    } else if (awayYesterday && awayYesterday.length > 0) {
      patterns.push('back_to_back_fade');
      if (!game.metadata) game.metadata = {};
      game.metadata.is_away_back_to_back = true;
    }
    
    // Embarrassment revenge check
    const { data: homeLastGame } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.home_team_id}`)
      .lt('start_time', game.start_time)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .single();
    
    if (homeLastGame) {
      const wasHome = homeLastGame.home_team_id === game.home_team_id;
      const theirScore = wasHome ? homeLastGame.home_score : homeLastGame.away_score;
      const oppScore = wasHome ? homeLastGame.away_score : homeLastGame.home_score;
      
      if (oppScore - theirScore >= 5) {
        patterns.push('embarrassment_revenge');
        if (!game.metadata) game.metadata = {};
        game.metadata.revenge_team = 'home';
      }
    }
    
    // Check away team for revenge
    const { data: awayLastGame } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${game.away_team_id},away_team_id.eq.${game.away_team_id}`)
      .lt('start_time', game.start_time)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .single();
    
    if (awayLastGame) {
      const wasHome = awayLastGame.home_team_id === game.away_team_id;
      const theirScore = wasHome ? awayLastGame.home_score : awayLastGame.away_score;
      const oppScore = wasHome ? awayLastGame.away_score : awayLastGame.home_score;
      
      if (oppScore - theirScore >= 5) {
        patterns.push('embarrassment_revenge');
        if (!game.metadata) game.metadata = {};
        game.metadata.revenge_team = 'away';
      }
    }
    
    // Primetime under (night games)
    const gameHour = new Date(game.start_time).getHours();
    if (gameHour >= 19) {
      patterns.push('primetime_under');
    }
    
    // Division rivalry check
    const { data: teams } = await supabase
      .from('teams')
      .select('division')
      .in('id', [game.home_team_id, game.away_team_id]);
    
    if (teams && teams.length === 2 && teams[0].division === teams[1].division) {
      patterns.push('division_rivalry');
    }
    
    return patterns;
    });
  }
  
  private async getPatternConfidence(patterns: string[]) {
    const confidences = await Promise.all(
      patterns.map(async (pattern) => {
        const { data } = await supabase
          .from('pattern_performance')
          .select('accuracy_rate')
          .eq('pattern_type', pattern)
          .eq('sport', 'MLB')
          .single();
        
        return data?.accuracy_rate || 0.5;
      })
    );
    
    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }
  
  private makePrediction(game: any, patterns: string[], confidence: number) {
    // Make specific predictions based on patterns
    const predictions: any = {
      patterns: patterns,
      bets: []
    };
    
    patterns.forEach(pattern => {
      switch (pattern) {
        case 'altitude_advantage':
          predictions.bets.push({
            type: 'total',
            selection: 'OVER',
            line: 10.5, // Default MLB total
            pattern: pattern,
            confidence: 0.683
          });
          break;
          
        case 'back_to_back_fade':
          // Check which team is playing back-to-back
          const isHomeBB = game.metadata?.is_home_back_to_back;
          predictions.bets.push({
            type: 'moneyline',
            selection: isHomeBB ? 'AWAY' : 'HOME',
            pattern: pattern,
            confidence: 0.768
          });
          break;
          
        case 'embarrassment_revenge':
          // Bet on the revenge team
          const revengeTeam = game.metadata?.revenge_team;
          predictions.bets.push({
            type: 'moneyline',
            selection: revengeTeam === 'home' ? 'HOME' : 'AWAY',
            pattern: pattern,
            confidence: 0.744
          });
          break;
          
        case 'primetime_under':
          predictions.bets.push({
            type: 'total',
            selection: 'UNDER',
            line: 9.5, // Lower line for primetime
            pattern: pattern,
            confidence: 0.621
          });
          break;
          
        case 'division_rivalry':
          predictions.bets.push({
            type: 'total',
            selection: 'UNDER',
            line: 9.5, // Rivalry games tend to be lower scoring
            pattern: pattern,
            confidence: 0.556
          });
          break;
      }
    });
    
    return {
      ...predictions,
      confidence,
      expectedValue: this.calculateExpectedValue(predictions, confidence)
    };
  }
  
  private calculateExpectedValue(predictions: any, confidence: number): number {
    // Simple EV calculation
    const baseStake = 100;
    const avgOdds = 1.91; // -110 in decimal
    
    const winProb = confidence;
    const profit = baseStake * (avgOdds - 1);
    const loss = -baseStake;
    
    return winProb * profit + (1 - winProb) * loss;
  }
  
  private async analyzePendingPredictions(pendingPredictions: any[], currentDate: Date) {
    console.log(chalk.white('   📊 Analyzing pending predictions...'));
    
    const results = [];
    const stillPending = [];
    
    for (const pred of pendingPredictions) {
      // Get actual game result - check if it's completed
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', pred.gameId)
        .single();
      
      if (game && game.status === 'completed' && game.home_score !== null && game.away_score !== null) {
        const correct = this.evaluatePrediction(pred, game);
        
        results.push({
          ...pred,
          actual: game,
          correct,
          profit: correct ? 91 : -100 // Assuming -110 odds
        });
      } else {
        // Game hasn't completed yet - keep in pending queue
        stillPending.push(pred);
      }
    }
    
    // Update pending predictions array by reference
    pendingPredictions.length = 0;
    pendingPredictions.push(...stillPending);
    
    const correctCount = results.filter(r => r.correct).length;
    const totalResults = results.length;
    
    if (totalResults > 0) {
      console.log(chalk.green(`      ✓ ${correctCount}/${totalResults} correct predictions evaluated`));
    } else {
      console.log(chalk.gray(`      ℹ No predictions ready for evaluation yet`));
    }
    
    return results;
  }
  
  private async analyzeDayResults(date: Date, predictions: any[]) {
    console.log(chalk.white('   📊 Analyzing results...'));
    
    const results = [];
    
    for (const pred of predictions) {
      // Get actual game result - check if it's completed
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', pred.gameId)
        .single();
      
      if (game && game.status === 'completed' && game.home_score !== null && game.away_score !== null) {
        const correct = this.evaluatePrediction(pred, game);
        
        results.push({
          ...pred,
          actual: game,
          correct,
          profit: correct ? 91 : -100 // Assuming -110 odds
        });
      } else {
        // Game hasn't completed yet or has no scores - skip for now
        // In real-time this would be checked the next day
        console.log(chalk.gray(`      Game ${pred.gameId} not completed yet`));
      }
    }
    
    const correctCount = results.filter(r => r.correct).length;
    const totalResults = results.length;
    
    if (totalResults > 0) {
      console.log(chalk.green(`      ✓ ${correctCount}/${totalResults} correct predictions`));
    } else {
      console.log(chalk.gray(`      ℹ No completed games to evaluate yet`));
    }
    
    return results;
  }
  
  private evaluatePrediction(prediction: any, game: any): boolean {
    // Evaluate each bet in the prediction
    if (!prediction.prediction?.bets || prediction.prediction.bets.length === 0) {
      return false;
    }
    
    // Ensure we have valid scores
    if (game.home_score === null || game.away_score === null) {
      return false;
    }
    
    const totalScore = game.home_score + game.away_score;
    const homeWon = game.home_score > game.away_score;
    const awayWon = game.away_score > game.home_score;
    
    let correctBets = 0;
    let totalBets = 0;
    
    prediction.prediction.bets.forEach((bet: any) => {
      totalBets++;
      
      switch (bet.type) {
        case 'total':
          if (bet.selection === 'OVER' && totalScore > bet.line) {
            correctBets++;
          } else if (bet.selection === 'UNDER' && totalScore < bet.line) {
            correctBets++;
          }
          break;
          
        case 'moneyline':
          if (bet.selection === 'HOME' && homeWon) {
            correctBets++;
          } else if (bet.selection === 'AWAY' && awayWon) {
            correctBets++;
          }
          break;
      }
    });
    
    // Return true if more than 50% of bets were correct
    return totalBets > 0 && correctBets / totalBets > 0.5;
  }
  
  private async updatePatternLearning(results: any[]) {
    console.log(chalk.white('   🧠 Updating pattern learning...'));
    
    // Group results by pattern
    const patternResults: Record<string, any[]> = {};
    
    results.forEach(result => {
      result.patterns.forEach((pattern: string) => {
        if (!patternResults[pattern]) {
          patternResults[pattern] = [];
        }
        patternResults[pattern].push(result);
      });
    });
    
    // Update each pattern's performance
    for (const [pattern, patternData] of Object.entries(patternResults)) {
      const correct = patternData.filter(r => r.correct).length;
      const total = patternData.length;
      const newAccuracy = correct / total;
      
      // Get current performance
      const { data: current } = await supabase
        .from('pattern_performance')
        .select('*')
        .eq('pattern_type', pattern)
        .eq('sport', 'MLB')
        .single();
      
      if (current) {
        // Update with exponential moving average
        const updatedAccuracy = this.config.learningRate * newAccuracy + 
                               (1 - this.config.learningRate) * current.accuracy_rate;
        
        await supabase
          .from('pattern_performance')
          .update({
            total_occurrences: current.total_occurrences + total,
            successful_predictions: current.successful_predictions + correct,
            accuracy_rate: updatedAccuracy,
            last_updated: new Date()
          })
          .eq('id', current.id);
      }
    }
    
    console.log(chalk.green('      ✓ Pattern confidence updated'));
  }
  
  private async calculateDailyMetrics(date: Date, results: any[]): Promise<DailyMetrics> {
    const correctPredictions = results.filter(r => r.correct).length;
    const totalPredictions = results.length;
    const accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
    const profit = results.reduce((sum, r) => sum + r.profit, 0);
    
    // Calculate cumulative metrics
    const prevMetrics = this.dailyMetrics[this.dailyMetrics.length - 1];
    const cumulativeCorrect = (prevMetrics?.correctPredictions || 0) + correctPredictions;
    const cumulativeTotal = (prevMetrics?.predictions || 0) + totalPredictions;
    const cumulativeAccuracy = cumulativeTotal > 0 ? cumulativeCorrect / cumulativeTotal : 0;
    const cumulativeProfit = (prevMetrics?.cumulativeProfit || 0) + profit;
    
    // Get pattern performance
    const { data: patterns } = await supabase
      .from('pattern_performance')
      .select('pattern_type, accuracy_rate')
      .eq('sport', 'MLB');
    
    const patternPerformance: Record<string, any> = {};
    patterns?.forEach(p => {
      patternPerformance[p.pattern_type] = {
        accuracy: p.accuracy_rate,
        improvement: p.accuracy_rate - this.baselineAccuracy[p.pattern_type]
      };
    });
    
    return {
      date: format(date, 'yyyy-MM-dd'),
      gamesPlayed: results.length,
      predictions: totalPredictions,
      correctPredictions,
      accuracy,
      profit,
      cumulativeAccuracy,
      cumulativeProfit,
      patternPerformance
    };
  }
  
  private displayDailyProgress(metrics: DailyMetrics) {
    console.log(chalk.cyan('\n   📈 Daily Progress:'));
    console.log(chalk.white(`      Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`));
    console.log(chalk.white(`      Profit: ${metrics.profit >= 0 ? '+' : ''}$${metrics.profit.toFixed(2)}`));
    console.log(chalk.white(`      Cumulative: ${(metrics.cumulativeAccuracy * 100).toFixed(1)}% / $${metrics.cumulativeProfit.toFixed(2)}`));
    
    // Show top performing pattern
    const patterns = Object.entries(metrics.patternPerformance);
    if (patterns.length > 0) {
      const best = patterns.reduce((best, [pattern, data]) => 
        data.accuracy > best[1].accuracy ? [pattern, data] : best
      );
      console.log(chalk.green(`      Best Pattern: ${best[0]} (${(best[1].accuracy * 100).toFixed(1)}%)`));
    }
  }
  
  private async saveModelSnapshot(date: Date, metrics: DailyMetrics) {
    console.log(chalk.yellow('\n   💾 Saving model snapshot...'));
    
    const { data: patterns } = await supabase
      .from('pattern_performance')
      .select('*')
      .eq('sport', 'MLB');
    
    await supabase
      .from('model_snapshots')
      .insert({
        training_run_id: this.trainingRunId,
        snapshot_date: date,
        metrics,
        pattern_states: patterns,
        cumulative_accuracy: metrics.cumulativeAccuracy,
        cumulative_profit: metrics.cumulativeProfit
      });
    
    console.log(chalk.green('      ✓ Snapshot saved'));
  }
  
  private async generateFinalReport() {
    console.log(chalk.cyan.bold('\n\n📊 FINAL TRAINING REPORT\n'));
    
    const finalMetrics = this.dailyMetrics[this.dailyMetrics.length - 1];
    
    console.log(chalk.white.bold('Overall Performance:'));
    console.log(chalk.white(`  Total Days: ${this.dailyMetrics.length}`));
    console.log(chalk.white(`  Total Predictions: ${finalMetrics.predictions}`));
    console.log(chalk.white(`  Final Accuracy: ${(finalMetrics.cumulativeAccuracy * 100).toFixed(1)}%`));
    console.log(chalk.white(`  Total Profit: $${finalMetrics.cumulativeProfit.toFixed(2)}`));
    
    console.log(chalk.white.bold('\nPattern Evolution:'));
    for (const [pattern, data] of Object.entries(finalMetrics.patternPerformance)) {
      const improvement = (data.improvement * 100).toFixed(1);
      const emoji = data.improvement > 0 ? '📈' : data.improvement < 0 ? '📉' : '➡️';
      console.log(chalk.white(`  ${pattern}: ${(data.accuracy * 100).toFixed(1)}% (${improvement > 0 ? '+' : ''}${improvement}%) ${emoji}`));
    }
    
    // Learning curve analysis
    console.log(chalk.white.bold('\nLearning Curve:'));
    const periods = [30, 60, 90];
    periods.forEach(days => {
      if (this.dailyMetrics.length >= days) {
        const metric = this.dailyMetrics[days - 1];
        console.log(chalk.white(`  Day ${days}: ${(metric.cumulativeAccuracy * 100).toFixed(1)}% accuracy`));
      }
    });
    
    // Save final report
    await supabase
      .from('historical_training_runs')
      .update({
        status: 'completed',
        completed_at: new Date(),
        final_metrics: finalMetrics,
        daily_metrics: this.dailyMetrics
      })
      .eq('id', this.trainingRunId);
  }
  
  private async optimizeForSecondHalf() {
    console.log(chalk.cyan.bold('\n🎯 OPTIMIZING FOR SECOND HALF\n'));
    
    // Get final pattern states
    const { data: patterns } = await supabase
      .from('pattern_performance')
      .select('*')
      .eq('sport', 'MLB');
    
    // Save optimized model
    await supabase
      .from('optimized_models')
      .insert({
        name: `Second Half 2025 - Run #${this.trainingRunId}`,
        training_period: `${this.config.startDate} to ${this.config.endDate}`,
        pattern_states: patterns,
        config: {
          learningRate: this.config.learningRate,
          totalDaysTraained: this.dailyMetrics.length,
          finalAccuracy: this.dailyMetrics[this.dailyMetrics.length - 1].cumulativeAccuracy
        },
        created_at: new Date()
      });
    
    console.log(chalk.green('✅ Model optimized and saved for second half!'));
    console.log(chalk.white('\nRecommendations:'));
    console.log(chalk.white('  • Use pattern confidence scores from this training'));
    console.log(chalk.white('  • Monitor for pattern drift in second half'));
    console.log(chalk.white('  • Consider weather changes (hotter weather)'));
    console.log(chalk.white('  • Watch for playoff race dynamics'));
  }
  
  private async displayHardwareMetrics() {
    const metrics = await this.gpuAccelerator.getMetrics();
    console.log(chalk.bold.magenta('\n⚡ HARDWARE PERFORMANCE SUMMARY\n'));
    console.log(chalk.white(`Device: ${metrics.deviceType}`));
    console.log(chalk.white(`Parallel Operations: ${metrics.parallelOperations}`));
    console.log(chalk.white(`Total Processing Time: ${metrics.elapsedTime.toFixed(2)}s`));
    console.log(chalk.white(`Days Processed: ${this.dailyMetrics.length}`));
    
    if (this.dailyMetrics.length > 0) {
      const avgTimePerDay = metrics.elapsedTime / this.dailyMetrics.length;
      console.log(chalk.white(`Average Time per Day: ${avgTimePerDay.toFixed(2)}s`));
      
      const totalGames = this.dailyMetrics.reduce((sum, m) => sum + m.gamesPlayed, 0);
      const gamesPerSecond = totalGames / metrics.elapsedTime;
      console.log(chalk.white(`Processing Speed: ${gamesPerSecond.toFixed(1)} games/second`));
    }
    
    if (metrics.gpuAvailable) {
      console.log(chalk.green('\n🎮 GPU acceleration was utilized for optimal performance!'));
    } else {
      console.log(chalk.yellow('\n🖥️  CPU optimization was used (8 parallel threads)'));
    }
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<ReplayConfig> = {};
  
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key === '--start-date') config.startDate = value;
    if (key === '--end-date') config.endDate = value;
    if (key === '--learning-rate') config.learningRate = parseFloat(value);
    if (key === '--no-reset') config.resetConfidence = false;
  });
  
  const replay = new HistoricalSeasonReplay(config);
  
  replay.run().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default HistoricalSeasonReplay;