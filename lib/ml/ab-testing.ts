/**
 * 🧪 A/B TESTING FRAMEWORK FOR ML MODELS
 * Compare model performance and optimize predictions
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  modelA: string;
  modelB: string;
  trafficSplit: number; // Percentage to model A (0-100)
  metrics: string[];
  minSampleSize: number;
  maxDuration: number; // Days
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'paused';
}

export interface ABTestResult {
  testId: string;
  modelA: ModelPerformance;
  modelB: ModelPerformance;
  winner?: 'A' | 'B' | 'tie';
  confidence: number;
  pValue: number;
  recommendations: string[];
}

export interface ModelPerformance {
  modelName: string;
  predictions: number;
  correct: number;
  accuracy: number;
  averageConfidence: number;
  highConfidenceAccuracy: number; // Accuracy for predictions > 70% confidence
  profitability: number; // If betting $100 on each prediction
  metrics: Record<string, number>;
}

export class ABTestingFramework {
  private activeTests = new Map<string, ABTestConfig>();
  
  constructor() {
    this.loadActiveTests();
  }

  /**
   * Create a new A/B test
   */
  async createTest(config: Omit<ABTestConfig, 'testId' | 'startDate'>): Promise<string> {
    const testId = `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const test: ABTestConfig = {
      ...config,
      testId,
      startDate: new Date(),
      status: 'active'
    };

    // Store in database
    await supabase.from('ab_tests').insert({
      test_id: test.testId,
      name: test.name,
      description: test.description,
      model_a: test.modelA,
      model_b: test.modelB,
      traffic_split: test.trafficSplit,
      metrics: test.metrics,
      min_sample_size: test.minSampleSize,
      max_duration: test.maxDuration,
      start_date: test.startDate,
      status: test.status
    });

    this.activeTests.set(testId, test);
    
    console.log(chalk.green(`✅ A/B test created: ${test.name}`));
    console.log(chalk.cyan(`   Model A: ${test.modelA} (${test.trafficSplit}%)`));
    console.log(chalk.cyan(`   Model B: ${test.modelB} (${100 - test.trafficSplit}%)`));
    
    return testId;
  }

  /**
   * Route prediction to appropriate model based on test
   */
  async routePrediction(gameId: string, testId?: string): Promise<{ model: string; testId?: string }> {
    // If specific test requested
    if (testId) {
      const test = this.activeTests.get(testId);
      if (test && test.status === 'active') {
        const useModelA = Math.random() * 100 < test.trafficSplit;
        return {
          model: useModelA ? test.modelA : test.modelB,
          testId: test.testId
        };
      }
    }

    // Check all active tests
    for (const [id, test] of this.activeTests) {
      if (test.status === 'active') {
        const useModelA = Math.random() * 100 < test.trafficSplit;
        return {
          model: useModelA ? test.modelA : test.modelB,
          testId: test.testId
        };
      }
    }

    // Default model if no tests active
    return { model: 'ultimate-ensemble' };
  }

  /**
   * Record prediction result for test
   */
  async recordResult(
    testId: string,
    gameId: string,
    model: string,
    prediction: any,
    actual?: any
  ) {
    const isCorrect = actual ? prediction.winner === actual.winner : null;
    
    await supabase.from('ab_test_results').insert({
      test_id: testId,
      game_id: gameId,
      model_used: model,
      prediction: prediction,
      actual_outcome: actual,
      is_correct: isCorrect,
      confidence: prediction.confidence,
      timestamp: new Date()
    });

    // Check if test should be completed
    await this.checkTestCompletion(testId);
  }

  /**
   * Analyze test results
   */
  async analyzeTest(testId: string): Promise<ABTestResult> {
    const test = this.activeTests.get(testId);
    if (!test) throw new Error('Test not found');

    // Get all results
    const { data: results } = await supabase
      .from('ab_test_results')
      .select('*')
      .eq('test_id', testId)
      .not('is_correct', 'is', null);

    if (!results || results.length === 0) {
      return {
        testId,
        modelA: this.getEmptyPerformance(test.modelA),
        modelB: this.getEmptyPerformance(test.modelB),
        confidence: 0,
        pValue: 1,
        recommendations: ['Insufficient data for analysis']
      };
    }

    // Separate results by model
    const modelAResults = results.filter(r => r.model_used === test.modelA);
    const modelBResults = results.filter(r => r.model_used === test.modelB);

    // Calculate performance
    const perfA = this.calculatePerformance(modelAResults, test.modelA);
    const perfB = this.calculatePerformance(modelBResults, test.modelB);

    // Statistical significance
    const { pValue, confidence } = this.calculateSignificance(perfA, perfB);

    // Determine winner
    let winner: 'A' | 'B' | 'tie' | undefined;
    if (pValue < 0.05) {
      if (perfA.accuracy > perfB.accuracy) winner = 'A';
      else if (perfB.accuracy > perfA.accuracy) winner = 'B';
      else winner = 'tie';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(perfA, perfB, test);

    return {
      testId,
      modelA: perfA,
      modelB: perfB,
      winner,
      confidence,
      pValue,
      recommendations
    };
  }

  /**
   * Calculate model performance metrics
   */
  private calculatePerformance(results: any[], modelName: string): ModelPerformance {
    if (results.length === 0) {
      return this.getEmptyPerformance(modelName);
    }

    const correct = results.filter(r => r.is_correct).length;
    const accuracy = correct / results.length;
    
    const confidences = results.map(r => r.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    
    // High confidence accuracy
    const highConfResults = results.filter(r => r.confidence > 0.7);
    const highConfCorrect = highConfResults.filter(r => r.is_correct).length;
    const highConfAccuracy = highConfResults.length > 0 
      ? highConfCorrect / highConfResults.length 
      : 0;

    // Profitability (simple betting simulation)
    let profit = 0;
    results.forEach(r => {
      if (r.is_correct) {
        // Assume even odds for simplicity
        profit += 100;
      } else {
        profit -= 100;
      }
    });

    return {
      modelName,
      predictions: results.length,
      correct,
      accuracy,
      averageConfidence: avgConfidence,
      highConfidenceAccuracy: highConfAccuracy,
      profitability: profit,
      metrics: {
        totalGames: results.length,
        winRate: accuracy,
        avgConfidence: avgConfidence,
        profit: profit
      }
    };
  }

  /**
   * Calculate statistical significance
   */
  private calculateSignificance(perfA: ModelPerformance, perfB: ModelPerformance) {
    // Simple binomial test for accuracy difference
    const nA = perfA.predictions;
    const nB = perfB.predictions;
    const pA = perfA.accuracy;
    const pB = perfB.accuracy;

    if (nA < 30 || nB < 30) {
      return { pValue: 1, confidence: 0 };
    }

    // Pooled proportion
    const pPool = (pA * nA + pB * nB) / (nA + nB);
    const se = Math.sqrt(pPool * (1 - pPool) * (1/nA + 1/nB));
    
    // Z-score
    const z = Math.abs(pA - pB) / se;
    
    // Approximate p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(z));
    const confidence = (1 - pValue) * 100;

    return { pValue, confidence };
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  /**
   * Generate test recommendations
   */
  private generateRecommendations(
    perfA: ModelPerformance,
    perfB: ModelPerformance,
    test: ABTestConfig
  ): string[] {
    const recommendations: string[] = [];

    // Sample size
    const totalSamples = perfA.predictions + perfB.predictions;
    if (totalSamples < test.minSampleSize) {
      recommendations.push(
        `Continue test - need ${test.minSampleSize - totalSamples} more predictions`
      );
    }

    // Clear winner
    const accuracyDiff = Math.abs(perfA.accuracy - perfB.accuracy);
    if (accuracyDiff > 0.05) {
      const winner = perfA.accuracy > perfB.accuracy ? test.modelA : test.modelB;
      recommendations.push(`Strong evidence favoring ${winner}`);
    }

    // High confidence performance
    if (perfA.highConfidenceAccuracy > 0.8 || perfB.highConfidenceAccuracy > 0.8) {
      recommendations.push('High confidence predictions showing strong performance');
    }

    // Profitability
    if (perfA.profitability > 0 || perfB.profitability > 0) {
      const profitable = perfA.profitability > perfB.profitability ? test.modelA : test.modelB;
      recommendations.push(`${profitable} showing positive returns`);
    }

    // Model-specific insights
    if (perfA.averageConfidence - perfB.averageConfidence > 0.1) {
      recommendations.push(`${test.modelA} shows higher confidence in predictions`);
    }

    return recommendations;
  }

  /**
   * Check if test should be completed
   */
  private async checkTestCompletion(testId: string) {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'active') return;

    const daysSinceStart = (Date.now() - test.startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Check duration
    if (daysSinceStart >= test.maxDuration) {
      await this.completeTest(testId, 'Max duration reached');
      return;
    }

    // Check sample size
    const { count } = await supabase
      .from('ab_test_results')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testId);

    if (count && count >= test.minSampleSize * 2) {
      // Analyze results
      const result = await this.analyzeTest(testId);
      
      // Complete if clear winner
      if (result.winner && result.confidence > 95) {
        await this.completeTest(testId, `Clear winner: Model ${result.winner}`);
      }
    }
  }

  /**
   * Complete a test
   */
  async completeTest(testId: string, reason: string) {
    const test = this.activeTests.get(testId);
    if (!test) return;

    test.status = 'completed';
    test.endDate = new Date();

    await supabase
      .from('ab_tests')
      .update({
        status: 'completed',
        end_date: test.endDate,
        completion_reason: reason
      })
      .eq('test_id', testId);

    console.log(chalk.green(`✅ A/B test completed: ${test.name}`));
    console.log(chalk.gray(`   Reason: ${reason}`));

    // Generate final report
    const result = await this.analyzeTest(testId);
    await this.generateReport(test, result);
  }

  /**
   * Generate test report
   */
  private async generateReport(test: ABTestConfig, result: ABTestResult) {
    console.log(chalk.bold.cyan('\n📊 A/B TEST REPORT'));
    console.log(chalk.yellow('═'.repeat(50)));
    console.log(chalk.bold(`Test: ${test.name}`));
    console.log(`Duration: ${Math.ceil((test.endDate!.getTime() - test.startDate.getTime()) / (1000 * 60 * 60 * 24))} days`);
    console.log(`Total Predictions: ${result.modelA.predictions + result.modelB.predictions}`);
    
    console.log(chalk.bold('\nModel A:'), test.modelA);
    console.log(`  Accuracy: ${(result.modelA.accuracy * 100).toFixed(1)}%`);
    console.log(`  High Conf Accuracy: ${(result.modelA.highConfidenceAccuracy * 100).toFixed(1)}%`);
    console.log(`  Profit: $${result.modelA.profitability}`);
    
    console.log(chalk.bold('\nModel B:'), test.modelB);
    console.log(`  Accuracy: ${(result.modelB.accuracy * 100).toFixed(1)}%`);
    console.log(`  High Conf Accuracy: ${(result.modelB.highConfidenceAccuracy * 100).toFixed(1)}%`);
    console.log(`  Profit: $${result.modelB.profitability}`);
    
    if (result.winner) {
      console.log(chalk.bold.green(`\n🏆 Winner: Model ${result.winner} (${result.confidence.toFixed(1)}% confidence)`));
    } else {
      console.log(chalk.yellow('\n⚖️  No significant difference found'));
    }
    
    console.log(chalk.bold('\n💡 Recommendations:'));
    result.recommendations.forEach(rec => console.log(`  • ${rec}`));
    console.log(chalk.yellow('═'.repeat(50)));
  }

  /**
   * Load active tests from database
   */
  private async loadActiveTests() {
    const { data: tests } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('status', 'active');

    if (tests) {
      tests.forEach(test => {
        this.activeTests.set(test.test_id, {
          testId: test.test_id,
          name: test.name,
          description: test.description,
          modelA: test.model_a,
          modelB: test.model_b,
          trafficSplit: test.traffic_split,
          metrics: test.metrics,
          minSampleSize: test.min_sample_size,
          maxDuration: test.max_duration,
          startDate: new Date(test.start_date),
          status: test.status
        });
      });
    }

    console.log(chalk.green(`✅ Loaded ${this.activeTests.size} active A/B tests`));
  }

  /**
   * Get empty performance object
   */
  private getEmptyPerformance(modelName: string): ModelPerformance {
    return {
      modelName,
      predictions: 0,
      correct: 0,
      accuracy: 0,
      averageConfidence: 0,
      highConfidenceAccuracy: 0,
      profitability: 0,
      metrics: {}
    };
  }
}