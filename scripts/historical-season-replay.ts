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

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  
  constructor(config: Partial<ReplayConfig> = {}) {
    this.config = {
      startDate: config.startDate || '2025-03-27', // Opening Day 2025
      endDate: config.endDate || '2025-07-13', // All-Star Break 2025
      learningRate: config.learningRate || 0.2,
      resetConfidence: config.resetConfidence !== false,
      saveSnapshots: config.saveSnapshots !== false
    };
    
    this.learner = new ContinuousPatternLearning();
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n🕰️  HISTORICAL SEASON REPLAY TRAINING\n'));
    console.log(chalk.white(`Training Period: ${this.config.startDate} to ${this.config.endDate}`));
    
    const totalDays = differenceInDays(
      new Date(this.config.endDate),
      new Date(this.config.startDate)
    );
    console.log(chalk.white(`Total Days: ${totalDays}`));
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
      
      while (isBefore(currentDate, endDate)) {
        dayCount++;
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        console.log(chalk.yellow.bold(`\n📅 Day ${dayCount}: ${dateStr}\n`));
        
        // Step 1: Make predictions for today's games
        const predictions = await this.makeDailyPredictions(currentDate);
        
        // Step 2: Simulate "next day" - analyze results
        const results = await this.analyzeDayResults(currentDate, predictions);
        
        // Step 3: Update pattern confidence based on results
        await this.updatePatternLearning(results);
        
        // Step 4: Calculate and store daily metrics
        const metrics = await this.calculateDailyMetrics(currentDate, results);
        this.dailyMetrics.push(metrics);
        
        // Step 5: Display progress
        this.displayDailyProgress(metrics);
        
        // Step 6: Save snapshot if milestone
        if (dayCount % 30 === 0 && this.config.saveSnapshots) {
          await this.saveModelSnapshot(currentDate, metrics);
        }
        
        // Move to next day
        currentDate = addDays(currentDate, 1);
      }
      
      // Final analysis and optimization
      await this.generateFinalReport();
      await this.optimizeForSecondHalf();
      
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
    const patterns: string[] = [];
    
    // Altitude advantage
    if (game.venue?.toLowerCase().includes('coors')) {
      patterns.push('altitude_advantage');
    }
    
    // Back-to-back check
    const yesterday = addDays(new Date(game.start_time), -1);
    const { data: yesterdayGames } = await supabase
      .from('games')
      .select('id')
      .or(`home_team_id.eq.${game.home_team_id},away_team_id.eq.${game.home_team_id}`)
      .gte('start_time', yesterday.toISOString())
      .lt('start_time', game.start_time);
    
    if (yesterdayGames && yesterdayGames.length > 0) {
      patterns.push('back_to_back_fade');
    }
    
    // Add other pattern detection logic...
    
    return patterns;
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
    // Simplified prediction logic
    const predictions: any = {};
    
    if (patterns.includes('altitude_advantage')) {
      predictions.total = 'OVER';
    }
    
    if (patterns.includes('back_to_back_fade')) {
      predictions.moneyline = 'OPPONENT';
    }
    
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
  
  private async analyzeDayResults(date: Date, predictions: any[]) {
    console.log(chalk.white('   📊 Analyzing results...'));
    
    const results = [];
    
    for (const pred of predictions) {
      // Get actual game result
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('id', pred.gameId)
        .single();
      
      if (game && game.status === 'completed') {
        const correct = this.evaluatePrediction(pred, game);
        
        results.push({
          ...pred,
          actual: game,
          correct,
          profit: correct ? 91 : -100 // Assuming -110 odds
        });
      }
    }
    
    const correctCount = results.filter(r => r.correct).length;
    console.log(chalk.green(`      ✓ ${correctCount}/${results.length} correct predictions`));
    
    return results;
  }
  
  private evaluatePrediction(prediction: any, game: any): boolean {
    // Evaluate if prediction was correct
    if (prediction.prediction.total === 'OVER') {
      const total = (game.home_score || 0) + (game.away_score || 0);
      return total > 10.5; // Default total line
    }
    
    if (prediction.prediction.moneyline === 'OPPONENT') {
      // Assuming back-to-back fade on home team
      return game.away_score > game.home_score;
    }
    
    return false;
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