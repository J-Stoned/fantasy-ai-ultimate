#!/usr/bin/env tsx
/**
 * 🧠 CONTINUOUS PATTERN LEARNING SERVICE
 * 
 * Tracks pattern performance and updates confidence scores daily
 * Learns from mistakes and improves predictions over time
 */

import { createClient } from '@supabase/supabase-js';
import { CronJob } from 'cron';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PatternResult {
  patternType: string;
  gameId: number;
  prediction: string;
  actualResult: string;
  correct: boolean;
  confidence: number;
  profitLoss: number;
}

interface LearningMetrics {
  patternType: string;
  periodStart: Date;
  periodEnd: Date;
  totalPredictions: number;
  correctPredictions: number;
  accuracyRate: number;
  previousAccuracy: number;
  improvement: number;
  totalWagered: number;
  totalProfit: number;
  roi: number;
  confidenceAdjustment: number;
}

export class ContinuousPatternLearning {
  private isRunning = false;
  private learningJob?: CronJob;
  
  constructor() {
    console.log(chalk.cyan.bold('🧠 Continuous Pattern Learning Service Initialized'));
  }
  
  async start() {
    console.log(chalk.green('Starting continuous learning service...'));
    this.isRunning = true;
    
    // Run learning cycle every day at 3 AM
    this.learningJob = new CronJob(
      '0 3 * * *',
      async () => {
        await this.runLearningCycle();
      },
      null,
      true,
      'America/New_York'
    );
    
    // Also run immediately on start
    await this.runLearningCycle();
    
    // Monitor real-time results
    this.startRealTimeMonitoring();
  }
  
  async runLearningCycle() {
    console.log(chalk.yellow.bold('\n🔄 RUNNING DAILY LEARNING CYCLE\n'));
    const startTime = Date.now();
    
    try {
      // Step 1: Analyze yesterday's predictions
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const results = await this.analyzePatternResults(yesterday);
      
      // Step 2: Calculate learning metrics
      const metrics = await this.calculateLearningMetrics(results);
      
      // Step 3: Update pattern confidence scores
      await this.updatePatternConfidence(metrics);
      
      // Step 4: Generate learning report
      await this.generateLearningReport(metrics);
      
      // Step 5: Adjust future predictions
      await this.adjustPredictionModels(metrics);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(chalk.green(`\n✅ Learning cycle completed in ${duration}s\n`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Learning cycle failed:'), error);
    }
  }
  
  private async analyzePatternResults(date: Date): Promise<PatternResult[]> {
    console.log(chalk.white('📊 Analyzing pattern results...'));
    
    // Get completed games with patterns from yesterday
    const { data: games } = await supabase
      .from('games')
      .select(`
        *,
        fantasy_betting_insights(*)
      `)
      .eq('status', 'completed')
      .gte('start_time', date.toISOString().split('T')[0])
      .lt('start_time', new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .not('metadata->pattern_types', 'is', null);
    
    if (!games || games.length === 0) {
      console.log(chalk.gray('   No completed games with patterns found'));
      return [];
    }
    
    const results: PatternResult[] = [];
    
    for (const game of games) {
      const patterns = game.metadata?.pattern_types || [];
      const insights = game.fantasy_betting_insights || [];
      
      for (const pattern of patterns) {
        const result = await this.evaluatePatternResult(pattern, game, insights);
        if (result) {
          results.push(result);
        }
      }
    }
    
    console.log(chalk.green(`   ✓ Analyzed ${results.length} pattern predictions`));
    return results;
  }
  
  private async evaluatePatternResult(
    pattern: string,
    game: any,
    insights: any[]
  ): Promise<PatternResult | null> {
    // Pattern-specific evaluation logic
    let prediction = '';
    let actualResult = '';
    let correct = false;
    let profitLoss = 0;
    
    switch (pattern) {
      case 'altitude_advantage':
        // Altitude games tend to go over the total
        const totalLine = game.metadata?.betting_lines?.total || 10.5;
        const actualTotal = (game.home_score || 0) + (game.away_score || 0);
        prediction = 'OVER';
        actualResult = actualTotal > totalLine ? 'OVER' : 'UNDER';
        correct = prediction === actualResult;
        profitLoss = correct ? 91 : -100; // Assuming -110 odds
        break;
        
      case 'back_to_back_fade':
        // Fade the team playing back-to-back
        const isHomeBB = game.metadata?.is_home_back_to_back;
        if (isHomeBB) {
          prediction = 'AWAY_WIN';
          actualResult = game.away_score > game.home_score ? 'AWAY_WIN' : 'HOME_WIN';
        } else {
          prediction = 'HOME_WIN';
          actualResult = game.home_score > game.away_score ? 'HOME_WIN' : 'AWAY_WIN';
        }
        correct = prediction === actualResult;
        profitLoss = correct ? 130 : -100; // Approximate ML odds
        break;
        
      case 'embarrassment_revenge':
        // Team that was embarrassed last game tends to bounce back
        prediction = 'REVENGE_TEAM_WIN';
        const revengeTeam = game.metadata?.revenge_team;
        if (revengeTeam === 'home') {
          actualResult = game.home_score > game.away_score ? 'REVENGE_TEAM_WIN' : 'REVENGE_TEAM_LOSS';
        } else {
          actualResult = game.away_score > game.home_score ? 'REVENGE_TEAM_WIN' : 'REVENGE_TEAM_LOSS';
        }
        correct = prediction === actualResult;
        profitLoss = correct ? 120 : -100;
        break;
    }
    
    if (!prediction) return null;
    
    return {
      patternType: pattern,
      gameId: game.id,
      prediction,
      actualResult,
      correct,
      confidence: game.metadata?.pattern_confidence || 0.5,
      profitLoss
    };
  }
  
  private async calculateLearningMetrics(
    results: PatternResult[]
  ): Promise<LearningMetrics[]> {
    console.log(chalk.white('🧮 Calculating learning metrics...'));
    
    // Group results by pattern type
    const patternGroups = results.reduce((acc, result) => {
      if (!acc[result.patternType]) {
        acc[result.patternType] = [];
      }
      acc[result.patternType].push(result);
      return acc;
    }, {} as Record<string, PatternResult[]>);
    
    const metrics: LearningMetrics[] = [];
    
    for (const [patternType, patternResults] of Object.entries(patternGroups)) {
      // Get historical performance
      const { data: historical } = await supabase
        .from('pattern_performance')
        .select('*')
        .eq('pattern_type', patternType)
        .eq('sport', 'MLB')
        .single();
      
      const totalPredictions = patternResults.length;
      const correctPredictions = patternResults.filter(r => r.correct).length;
      const accuracyRate = correctPredictions / totalPredictions;
      const previousAccuracy = historical?.accuracy_rate || 0.5;
      
      const totalWagered = totalPredictions * 100; // $100 per bet
      const totalProfit = patternResults.reduce((sum, r) => sum + r.profitLoss, 0);
      const roi = (totalProfit / totalWagered) * 100;
      
      // Calculate confidence adjustment
      const improvement = accuracyRate - previousAccuracy;
      const confidenceAdjustment = improvement * 0.1; // 10% of improvement
      
      metrics.push({
        patternType,
        periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        totalPredictions,
        correctPredictions,
        accuracyRate,
        previousAccuracy,
        improvement,
        totalWagered,
        totalProfit,
        roi,
        confidenceAdjustment
      });
    }
    
    console.log(chalk.green(`   ✓ Calculated metrics for ${metrics.length} patterns`));
    return metrics;
  }
  
  private async updatePatternConfidence(metrics: LearningMetrics[]) {
    console.log(chalk.white('📈 Updating pattern confidence scores...'));
    
    for (const metric of metrics) {
      // Update pattern performance table
      const { data: existing } = await supabase
        .from('pattern_performance')
        .select('*')
        .eq('pattern_type', metric.patternType)
        .eq('sport', 'MLB')
        .single();
      
      if (existing) {
        // Update with exponential moving average
        const alpha = 0.2; // Learning rate
        const newAccuracy = alpha * metric.accuracyRate + (1 - alpha) * existing.accuracy_rate;
        const newROI = alpha * metric.roi + (1 - alpha) * (existing.roi_percentage || 0);
        
        await supabase
          .from('pattern_performance')
          .update({
            total_occurrences: existing.total_occurrences + metric.totalPredictions,
            successful_predictions: existing.successful_predictions + metric.correctPredictions,
            accuracy_rate: newAccuracy,
            total_wagered: existing.total_wagered + metric.totalWagered,
            total_profit_loss: existing.total_profit_loss + metric.totalProfit,
            roi_percentage: newROI,
            last_occurrence: new Date(),
            last_updated: new Date()
          })
          .eq('id', existing.id);
          
        console.log(chalk.green(`   ✓ ${metric.patternType}: ${(existing.accuracy_rate * 100).toFixed(1)}% → ${(newAccuracy * 100).toFixed(1)}%`));
      } else {
        // Insert new pattern performance
        await supabase
          .from('pattern_performance')
          .insert({
            pattern_type: metric.patternType,
            sport: 'MLB',
            total_occurrences: metric.totalPredictions,
            successful_predictions: metric.correctPredictions,
            accuracy_rate: metric.accuracyRate,
            total_wagered: metric.totalWagered,
            total_profit_loss: metric.totalProfit,
            roi_percentage: metric.roi,
            last_occurrence: new Date()
          });
          
        console.log(chalk.yellow(`   ✓ New pattern tracked: ${metric.patternType}`));
      }
    }
  }
  
  private async generateLearningReport(metrics: LearningMetrics[]) {
    console.log(chalk.cyan.bold('\n📊 DAILY LEARNING REPORT\n'));
    
    if (metrics.length === 0) {
      console.log(chalk.gray('No patterns to report on today'));
      return;
    }
    
    // Overall performance
    const totalPredictions = metrics.reduce((sum, m) => sum + m.totalPredictions, 0);
    const totalCorrect = metrics.reduce((sum, m) => sum + m.correctPredictions, 0);
    const overallAccuracy = (totalCorrect / totalPredictions * 100).toFixed(1);
    const totalProfit = metrics.reduce((sum, m) => sum + m.totalProfit, 0);
    
    console.log(chalk.white.bold('Overall Performance:'));
    console.log(chalk.white(`  Predictions: ${totalPredictions}`));
    console.log(chalk.white(`  Accuracy: ${overallAccuracy}%`));
    console.log(chalk.white(`  Profit/Loss: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`));
    
    // Pattern breakdown
    console.log(chalk.white.bold('\nPattern Performance:'));
    metrics.forEach(m => {
      const emoji = m.improvement > 0 ? '📈' : m.improvement < 0 ? '📉' : '➡️';
      const accuracyChange = m.improvement > 0 ? '+' : '';
      
      console.log(chalk.white(`\n  ${m.patternType}:`));
      console.log(chalk.gray(`    Predictions: ${m.totalPredictions}`));
      console.log(chalk.gray(`    Accuracy: ${(m.accuracyRate * 100).toFixed(1)}% (${accuracyChange}${(m.improvement * 100).toFixed(1)}%) ${emoji}`));
      console.log(chalk.gray(`    ROI: ${m.roi.toFixed(1)}%`));
      console.log(chalk.gray(`    Profit: ${m.totalProfit >= 0 ? '+' : ''}$${m.totalProfit.toFixed(2)}`));
    });
    
    // Learning insights
    console.log(chalk.yellow.bold('\n💡 Learning Insights:'));
    
    const bestPattern = metrics.reduce((best, m) => 
      m.accuracyRate > best.accuracyRate ? m : best
    );
    const mostImproved = metrics.reduce((best, m) => 
      m.improvement > best.improvement ? m : best
    );
    
    console.log(chalk.white(`  Best Performer: ${bestPattern.patternType} (${(bestPattern.accuracyRate * 100).toFixed(1)}% accuracy)`));
    if (mostImproved.improvement > 0) {
      console.log(chalk.white(`  Most Improved: ${mostImproved.patternType} (+${(mostImproved.improvement * 100).toFixed(1)}%)`));
    }
    
    // Recommendations
    console.log(chalk.cyan.bold('\n🎯 Recommendations:'));
    metrics.forEach(m => {
      if (m.accuracyRate > 0.65) {
        console.log(chalk.green(`  ✅ Increase confidence for ${m.patternType} (performing well)`));
      } else if (m.accuracyRate < 0.45) {
        console.log(chalk.yellow(`  ⚠️  Review ${m.patternType} logic (underperforming)`));
      }
    });
    
    // Save report to database
    await supabase
      .from('learning_reports')
      .insert({
        report_date: new Date(),
        total_predictions: totalPredictions,
        overall_accuracy: parseFloat(overallAccuracy),
        total_profit: totalProfit,
        pattern_metrics: metrics,
        insights: {
          bestPattern: bestPattern.patternType,
          mostImproved: mostImproved.improvement > 0 ? mostImproved.patternType : null
        }
      });
  }
  
  private async adjustPredictionModels(metrics: LearningMetrics[]) {
    console.log(chalk.white('\n🔧 Adjusting prediction models...'));
    
    for (const metric of metrics) {
      // Update the pattern confidence multipliers used in predictions
      const multiplierAdjustment = 1 + (metric.confidenceAdjustment / 2);
      
      console.log(chalk.gray(`   ${metric.patternType}: Multiplier adjustment ${multiplierAdjustment.toFixed(3)}x`));
      
      // Store adjusted multipliers for use in predictions
      await supabase
        .from('pattern_multipliers')
        .upsert({
          pattern_type: metric.patternType,
          sport: 'MLB',
          base_multiplier: 1.0,
          adjusted_multiplier: multiplierAdjustment,
          last_adjusted: new Date(),
          performance_based: true
        });
    }
    
    console.log(chalk.green('   ✓ Prediction models adjusted based on learning'));
  }
  
  private startRealTimeMonitoring() {
    console.log(chalk.cyan('\n👁️  Starting real-time pattern monitoring...\n'));
    
    // Monitor games as they complete
    setInterval(async () => {
      const { data: recentGames } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .not('metadata->pattern_types', 'is', null);
      
      if (recentGames && recentGames.length > 0) {
        console.log(chalk.yellow(`\n🔄 ${recentGames.length} games just completed with patterns`));
        
        for (const game of recentGames) {
          const patterns = game.metadata?.pattern_types || [];
          console.log(chalk.gray(`   ${game.metadata?.event_name}: ${patterns.join(', ')}`));
        }
        
        // Quick evaluation
        const results = [];
        for (const game of recentGames) {
          const patterns = game.metadata?.pattern_types || [];
          for (const pattern of patterns) {
            const result = await this.evaluatePatternResult(pattern, game, []);
            if (result) results.push(result);
          }
        }
        
        const correct = results.filter(r => r.correct).length;
        const accuracy = (correct / results.length * 100).toFixed(1);
        console.log(chalk.white(`   Real-time accuracy: ${accuracy}% (${correct}/${results.length})\n`));
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
  
  async getPatternPerformance(): Promise<any> {
    const { data: performance } = await supabase
      .from('pattern_performance')
      .select('*')
      .order('accuracy_rate', { ascending: false });
    
    return performance;
  }
  
  async stop() {
    console.log(chalk.yellow('\nStopping continuous learning service...'));
    this.isRunning = false;
    this.learningJob?.stop();
  }
}

// Run if called directly
if (require.main === module) {
  const learner = new ContinuousPatternLearning();
  
  learner.start().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\nReceived SIGINT, shutting down gracefully...'));
    await learner.stop();
    process.exit(0);
  });
}

export default ContinuousPatternLearning;