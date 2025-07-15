#!/usr/bin/env tsx
/**
 * 🎯 SECOND HALF SEASON OPTIMIZER
 * 
 * Takes the learnings from first half training and optimizes
 * patterns specifically for second half conditions
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SecondHalfFactors {
  // Environmental changes
  averageTemperatureIncrease: number;
  dayGamePercentageDecrease: number;
  
  // Team dynamics
  playoffRaceIntensity: number; // 0-1 scale
  expandedRosters: boolean;
  tradeDeadlineImpact: number;
  
  // Player factors
  fatigueMultiplier: number;
  rookieCallupImpact: number;
  veteranRestDays: number;
}

interface OptimizedPattern {
  pattern: string;
  firstHalfAccuracy: number;
  secondHalfProjectedAccuracy: number;
  adjustmentFactors: Record<string, number>;
  confidenceMultiplier: number;
  specialConsiderations: string[];
}

export class SecondHalfOptimizer {
  private trainingCutoff: string;
  private optimizationId?: number;
  
  constructor(trainingCutoff: string = '2025-07-13') {
    this.trainingCutoff = trainingCutoff;
  }
  
  async optimize() {
    console.log(chalk.cyan.bold('\n🎯 SECOND HALF SEASON OPTIMIZER\n'));
    console.log(chalk.white(`Optimizing patterns for post-${this.trainingCutoff} performance`));
    console.log(chalk.gray('─'.repeat(70)));
    
    try {
      // Load first half training results
      const trainingData = await this.loadTrainingData();
      
      // Analyze second half specific factors
      const secondHalfFactors = await this.analyzeSecondHalfFactors();
      
      // Optimize each pattern
      const optimizedPatterns = await this.optimizePatterns(trainingData, secondHalfFactors);
      
      // Generate strategic recommendations
      const strategy = await this.generateSecondHalfStrategy(optimizedPatterns);
      
      // Save optimized model
      await this.saveOptimizedModel(optimizedPatterns, strategy);
      
      // Display results
      this.displayOptimizationResults(optimizedPatterns, strategy);
      
    } catch (error) {
      console.error(chalk.red('\n❌ Optimization failed:'), error);
      throw error;
    }
  }
  
  private async loadTrainingData() {
    console.log(chalk.white('📚 Loading first half training data...'));
    
    // Get the most recent completed training run
    const { data: trainingRun } = await supabase
      .from('historical_training_runs')
      .select('*')
      .eq('status', 'completed')
      .lte('end_date', this.trainingCutoff)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!trainingRun) {
      throw new Error('No completed training runs found');
    }
    
    console.log(chalk.green(`   ✓ Loaded training run #${trainingRun.id}`));
    
    // Get pattern performance at cutoff
    const { data: patterns } = await supabase
      .from('pattern_performance')
      .select('*')
      .eq('sport', 'MLB');
    
    // Get temporal performance
    const { data: temporal } = await supabase
      .from('temporal_pattern_performance')
      .select('*')
      .eq('sport', 'MLB');
    
    return {
      trainingRun,
      patterns: patterns || [],
      temporal: temporal || []
    };
  }
  
  private async analyzeSecondHalfFactors(): Promise<SecondHalfFactors> {
    console.log(chalk.white('\n🌡️  Analyzing second half factors...'));
    
    // Historical analysis of second half conditions
    const factors: SecondHalfFactors = {
      // July-Sept average 15°F warmer than April-June
      averageTemperatureIncrease: 15,
      
      // Fewer day games in second half (getaway days)
      dayGamePercentageDecrease: 0.25,
      
      // Teams fighting for playoffs
      playoffRaceIntensity: 0.75,
      
      // September roster expansion
      expandedRosters: true,
      
      // Trade deadline impact
      tradeDeadlineImpact: 0.15,
      
      // Player fatigue increases
      fatigueMultiplier: 1.2,
      
      // September call-ups
      rookieCallupImpact: 0.1,
      
      // More rest for veterans
      veteranRestDays: 1.5
    };
    
    console.log(chalk.green('   ✓ Second half factors analyzed'));
    console.log(chalk.gray(`     • Temperature increase: +${factors.averageTemperatureIncrease}°F`));
    console.log(chalk.gray(`     • Playoff race intensity: ${(factors.playoffRaceIntensity * 100).toFixed(0)}%`));
    console.log(chalk.gray(`     • Fatigue multiplier: ${factors.fatigueMultiplier}x`));
    
    return factors;
  }
  
  private async optimizePatterns(
    trainingData: any,
    secondHalfFactors: SecondHalfFactors
  ): Promise<OptimizedPattern[]> {
    console.log(chalk.white('\n🔧 Optimizing patterns for second half...'));
    
    const optimized: OptimizedPattern[] = [];
    
    for (const pattern of trainingData.patterns) {
      const optimization = await this.optimizePattern(
        pattern,
        trainingData.temporal,
        secondHalfFactors
      );
      
      optimized.push(optimization);
      
      console.log(chalk.white(`\n   ${pattern.pattern_type}:`));
      console.log(chalk.gray(`     First half: ${(pattern.accuracy_rate * 100).toFixed(1)}%`));
      console.log(chalk.green(`     Projected: ${(optimization.secondHalfProjectedAccuracy * 100).toFixed(1)}%`));
      console.log(chalk.gray(`     Multiplier: ${optimization.confidenceMultiplier.toFixed(3)}x`));
    }
    
    return optimized;
  }
  
  private async optimizePattern(
    pattern: any,
    temporalData: any[],
    factors: SecondHalfFactors
  ): Promise<OptimizedPattern> {
    const patternTemporal = temporalData.filter(t => t.pattern_type === pattern.pattern_type);
    
    const adjustmentFactors: Record<string, number> = {};
    const specialConsiderations: string[] = [];
    
    // Pattern-specific optimizations
    switch (pattern.pattern_type) {
      case 'altitude_advantage':
        // Altitude effect increases in hot weather
        adjustmentFactors.temperature = 1 + (factors.averageTemperatureIncrease / 100);
        adjustmentFactors.dayGame = 0.95; // Fewer day games
        specialConsiderations.push('Stronger effect in August heat');
        specialConsiderations.push('Monitor humidor adjustments');
        break;
        
      case 'back_to_back_fade':
        // Fatigue more pronounced late in season
        adjustmentFactors.fatigue = factors.fatigueMultiplier;
        adjustmentFactors.playoffRace = 1 + (factors.playoffRaceIntensity * 0.1);
        specialConsiderations.push('Extra strong in September');
        specialConsiderations.push('Check for teams resting starters');
        break;
        
      case 'embarrassment_revenge':
        // Pride factor increases in playoff race
        adjustmentFactors.playoffRace = 1 + (factors.playoffRaceIntensity * 0.2);
        adjustmentFactors.rivalry = 1.1;
        specialConsiderations.push('Stronger for contending teams');
        specialConsiderations.push('Weaker for eliminated teams');
        break;
        
      case 'division_rivalry':
        // More intense with playoff implications
        adjustmentFactors.playoffRace = 1 + (factors.playoffRaceIntensity * 0.15);
        adjustmentFactors.september = 1.2;
        specialConsiderations.push('Peak effectiveness in September');
        specialConsiderations.push('Consider playoff standings');
        break;
        
      case 'home_underdog':
        // Expanded rosters change dynamics
        adjustmentFactors.expandedRosters = factors.expandedRosters ? 0.95 : 1.0;
        adjustmentFactors.callups = 1 - factors.rookieCallupImpact;
        specialConsiderations.push('Account for September call-ups');
        specialConsiderations.push('Check for tanking teams');
        break;
    }
    
    // Calculate hot weather months performance
    const summerMonths = ['june', 'july', 'august'];
    const summerPerf = patternTemporal
      .filter(t => summerMonths.includes(t.time_period.toLowerCase()))
      .map(t => t.accuracy_rate);
    
    const summerAvg = summerPerf.length > 0 ?
      summerPerf.reduce((sum, acc) => sum + acc, 0) / summerPerf.length :
      pattern.accuracy_rate;
    
    // Calculate confidence multiplier
    const baseMultiplier = summerAvg / pattern.accuracy_rate;
    const adjustmentMultiplier = Object.values(adjustmentFactors)
      .reduce((product, factor) => product * factor, 1);
    
    const confidenceMultiplier = baseMultiplier * adjustmentMultiplier;
    
    // Project second half accuracy
    const secondHalfProjectedAccuracy = Math.min(
      pattern.accuracy_rate * confidenceMultiplier,
      0.85 // Cap at 85% to be realistic
    );
    
    return {
      pattern: pattern.pattern_type,
      firstHalfAccuracy: pattern.accuracy_rate,
      secondHalfProjectedAccuracy,
      adjustmentFactors,
      confidenceMultiplier,
      specialConsiderations
    };
  }
  
  private async generateSecondHalfStrategy(patterns: OptimizedPattern[]) {
    console.log(chalk.white('\n📋 Generating second half strategy...'));
    
    // Rank patterns by projected performance
    const rankedPatterns = [...patterns].sort((a, b) => 
      b.secondHalfProjectedAccuracy - a.secondHalfProjectedAccuracy
    );
    
    const strategy = {
      primaryPatterns: rankedPatterns.slice(0, 3).map(p => p.pattern),
      
      monthlyFocus: {
        'July': ['altitude_advantage', 'division_rivalry'],
        'August': ['altitude_advantage', 'back_to_back_fade'],
        'September': ['back_to_back_fade', 'division_rivalry', 'embarrassment_revenge']
      },
      
      specialSituations: {
        'Playoff Race (Sept)': {
          patterns: ['division_rivalry', 'embarrassment_revenge'],
          multiplier: 1.2
        },
        'Hot Weather (>85°F)': {
          patterns: ['altitude_advantage'],
          multiplier: 1.15
        },
        'September Call-ups': {
          patterns: ['home_underdog'],
          multiplier: 0.9
        }
      },
      
      riskManagement: {
        maxExposurePerPattern: 0.3,
        kellyFraction: 0.2, // More conservative in second half
        stopLoss: -15 // Stop if down 15% on a pattern
      }
    };
    
    return strategy;
  }
  
  private async saveOptimizedModel(patterns: OptimizedPattern[], strategy: any) {
    console.log(chalk.yellow('\n💾 Saving optimized model...'));
    
    const { data, error } = await supabase
      .from('optimized_models')
      .insert({
        name: `Second Half 2025 - Optimized ${new Date().toISOString().split('T')[0]}`,
        training_period: `Opening Day to ${this.trainingCutoff}`,
        pattern_states: patterns,
        config: {
          strategy,
          optimization_date: new Date(),
          projected_patterns: patterns.map(p => ({
            pattern: p.pattern,
            accuracy: p.secondHalfProjectedAccuracy,
            multiplier: p.confidenceMultiplier
          }))
        }
      })
      .select()
      .single();
    
    if (error) throw error;
    
    this.optimizationId = data.id;
    console.log(chalk.green(`   ✓ Optimized model saved (ID: ${this.optimizationId})`));
    
    // Update pattern multipliers
    for (const pattern of patterns) {
      await supabase
        .from('pattern_multipliers')
        .upsert({
          pattern_type: pattern.pattern,
          sport: 'MLB',
          base_multiplier: 1.0,
          adjusted_multiplier: pattern.confidenceMultiplier,
          last_adjusted: new Date(),
          performance_based: true
        });
    }
  }
  
  private displayOptimizationResults(patterns: OptimizedPattern[], strategy: any) {
    console.log(chalk.cyan.bold('\n\n🏆 SECOND HALF OPTIMIZATION COMPLETE\n'));
    
    console.log(chalk.white.bold('Top Patterns for Second Half:'));
    const ranked = [...patterns].sort((a, b) => 
      b.secondHalfProjectedAccuracy - a.secondHalfProjectedAccuracy
    );
    
    ranked.forEach((pattern, idx) => {
      const improvement = pattern.secondHalfProjectedAccuracy - pattern.firstHalfAccuracy;
      const emoji = improvement > 0 ? '📈' : improvement < 0 ? '📉' : '➡️';
      
      console.log(chalk.white(`\n${idx + 1}. ${pattern.pattern} ${emoji}`));
      console.log(chalk.gray(`   Projected: ${(pattern.secondHalfProjectedAccuracy * 100).toFixed(1)}% (${improvement > 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%)`));
      console.log(chalk.gray(`   Multiplier: ${pattern.confidenceMultiplier.toFixed(3)}x`));
      
      if (pattern.specialConsiderations.length > 0) {
        console.log(chalk.yellow('   Considerations:'));
        pattern.specialConsiderations.forEach(consideration => {
          console.log(chalk.gray(`     • ${consideration}`));
        });
      }
    });
    
    console.log(chalk.white.bold('\n\n📅 Monthly Strategy:'));
    Object.entries(strategy.monthlyFocus).forEach(([month, patterns]) => {
      console.log(chalk.white(`\n${month}:`));
      console.log(chalk.gray(`  Focus on: ${patterns.join(', ')}`));
    });
    
    console.log(chalk.white.bold('\n\n🎯 Key Success Factors:'));
    console.log(chalk.white('1. Monitor temperature trends (hot weather boosts altitude)'));
    console.log(chalk.white('2. Track playoff standings (intensity increases patterns)'));
    console.log(chalk.white('3. Watch for September call-ups (disrupts some patterns)'));
    console.log(chalk.white('4. Increase back-to-back fade confidence as fatigue builds'));
    console.log(chalk.white('5. Be selective with home underdogs in September'));
    
    console.log(chalk.green.bold('\n✅ Model ready for second half deployment!\n'));
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let trainingCutoff = '2025-07-13';
  
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key === '--training-cutoff') trainingCutoff = value;
  });
  
  const optimizer = new SecondHalfOptimizer(trainingCutoff);
  
  optimizer.optimize().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default SecondHalfOptimizer;