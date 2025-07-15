#!/usr/bin/env tsx
/**
 * 📅 TIME-BASED PATTERN ANALYSIS
 * 
 * Analyzes how patterns perform across different time periods
 * (months, days of week, weather conditions, etc.)
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { format, getMonth, getDay } from 'date-fns';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TimeBasedMetrics {
  pattern: string;
  timeBreakdown: {
    monthly: Record<string, PatternMetrics>;
    dayOfWeek: Record<string, PatternMetrics>;
    temperature: Record<string, PatternMetrics>;
    timeOfDay: Record<string, PatternMetrics>;
  };
  insights: string[];
  recommendations: string[];
}

interface PatternMetrics {
  occurrences: number;
  correct: number;
  accuracy: number;
  profit: number;
  roi: number;
}

export class TimeBasedPatternAnalysis {
  private season: string;
  private patterns: string[] = [
    'altitude_advantage',
    'back_to_back_fade',
    'embarrassment_revenge',
    'division_rivalry',
    'home_underdog'
  ];
  
  constructor(season: string = '2025') {
    this.season = season;
  }
  
  async analyze() {
    console.log(chalk.cyan.bold('\n📅 TIME-BASED PATTERN ANALYSIS\n'));
    console.log(chalk.white(`Analyzing patterns for ${this.season} season`));
    console.log(chalk.gray('─'.repeat(70)));
    
    try {
      // Get all completed games with patterns
      const games = await this.getSeasonGames();
      console.log(chalk.white(`\nFound ${games.length} completed games with patterns\n`));
      
      // Analyze each pattern
      const results: TimeBasedMetrics[] = [];
      
      for (const pattern of this.patterns) {
        console.log(chalk.yellow.bold(`\nAnalyzing: ${pattern}`));
        const metrics = await this.analyzePattern(pattern, games);
        results.push(metrics);
        
        this.displayPatternAnalysis(metrics);
      }
      
      // Generate temporal insights
      await this.generateTemporalInsights(results);
      
      // Save analysis to database
      await this.saveAnalysis(results);
      
    } catch (error) {
      console.error(chalk.red('\n❌ Analysis failed:'), error);
      throw error;
    }
  }
  
  private async getSeasonGames() {
    const startDate = `${this.season}-03-01`;
    const endDate = `${this.season}-11-01`;
    
    const { data: games } = await supabase
      .from('games')
      .select(`
        *,
        fantasy_betting_insights(*)
      `)
      .eq('sport', 'MLB')
      .eq('status', 'completed')
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .not('metadata->pattern_types', 'is', null)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    return games || [];
  }
  
  private async analyzePattern(pattern: string, games: any[]): Promise<TimeBasedMetrics> {
    // Filter games with this pattern
    const patternGames = games.filter(g => 
      g.metadata?.pattern_types?.includes(pattern)
    );
    
    console.log(chalk.gray(`   Found ${patternGames.length} games with ${pattern}`));
    
    const timeBreakdown = {
      monthly: this.analyzeByMonth(pattern, patternGames),
      dayOfWeek: this.analyzeByDayOfWeek(pattern, patternGames),
      temperature: await this.analyzeByTemperature(pattern, patternGames),
      timeOfDay: this.analyzeByTimeOfDay(pattern, patternGames)
    };
    
    const insights = this.generatePatternInsights(pattern, timeBreakdown);
    const recommendations = this.generateRecommendations(pattern, timeBreakdown);
    
    return {
      pattern,
      timeBreakdown,
      insights,
      recommendations
    };
  }
  
  private analyzeByMonth(pattern: string, games: any[]): Record<string, PatternMetrics> {
    const months = ['April', 'May', 'June', 'July', 'August', 'September', 'October'];
    const monthlyMetrics: Record<string, PatternMetrics> = {};
    
    months.forEach((month, index) => {
      const monthGames = games.filter(g => 
        getMonth(new Date(g.start_time)) === index + 3 // March is 2, April is 3
      );
      
      if (monthGames.length > 0) {
        monthlyMetrics[month] = this.calculateMetrics(pattern, monthGames);
      }
    });
    
    return monthlyMetrics;
  }
  
  private analyzeByDayOfWeek(pattern: string, games: any[]): Record<string, PatternMetrics> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayMetrics: Record<string, PatternMetrics> = {};
    
    days.forEach((day, index) => {
      const dayGames = games.filter(g => 
        getDay(new Date(g.start_time)) === index
      );
      
      if (dayGames.length > 0) {
        dayMetrics[day] = this.calculateMetrics(pattern, dayGames);
      }
    });
    
    return dayMetrics;
  }
  
  private async analyzeByTemperature(pattern: string, games: any[]): Promise<Record<string, PatternMetrics>> {
    const tempRanges = {
      'Cold (<60°F)': [0, 60],
      'Mild (60-75°F)': [60, 75],
      'Warm (75-85°F)': [75, 85],
      'Hot (>85°F)': [85, 120]
    };
    
    const tempMetrics: Record<string, PatternMetrics> = {};
    
    for (const [range, [min, max]] of Object.entries(tempRanges)) {
      const tempGames = games.filter(g => {
        const temp = g.metadata?.weather?.temperature;
        return temp >= min && temp < max;
      });
      
      if (tempGames.length > 0) {
        tempMetrics[range] = this.calculateMetrics(pattern, tempGames);
      }
    }
    
    return tempMetrics;
  }
  
  private analyzeByTimeOfDay(pattern: string, games: any[]): Record<string, PatternMetrics> {
    const timeSlots = {
      'Day Game (before 5pm)': [0, 17],
      'Night Game (after 5pm)': [17, 24]
    };
    
    const timeMetrics: Record<string, PatternMetrics> = {};
    
    for (const [slot, [minHour, maxHour]] of Object.entries(timeSlots)) {
      const slotGames = games.filter(g => {
        const hour = new Date(g.start_time).getHours();
        return hour >= minHour && hour < maxHour;
      });
      
      if (slotGames.length > 0) {
        timeMetrics[slot] = this.calculateMetrics(pattern, slotGames);
      }
    }
    
    return timeMetrics;
  }
  
  private calculateMetrics(pattern: string, games: any[]): PatternMetrics {
    let correct = 0;
    let totalProfit = 0;
    
    games.forEach(game => {
      const wasCorrect = this.evaluatePattern(pattern, game);
      if (wasCorrect) correct++;
      
      // Calculate profit (simplified)
      totalProfit += wasCorrect ? 91 : -100; // Assuming -110 odds
    });
    
    const occurrences = games.length;
    const accuracy = occurrences > 0 ? correct / occurrences : 0;
    const roi = occurrences > 0 ? (totalProfit / (occurrences * 100)) * 100 : 0;
    
    return {
      occurrences,
      correct,
      accuracy,
      profit: totalProfit,
      roi
    };
  }
  
  private evaluatePattern(pattern: string, game: any): boolean {
    switch (pattern) {
      case 'altitude_advantage':
        // Altitude games tend to go over
        const total = (game.home_score || 0) + (game.away_score || 0);
        return total > (game.metadata?.total_line || 10.5);
        
      case 'back_to_back_fade':
        // Fade team playing back-to-back
        if (game.metadata?.is_home_back_to_back) {
          return game.away_score > game.home_score;
        }
        return game.home_score > game.away_score;
        
      case 'embarrassment_revenge':
        // Team bounces back after embarrassing loss
        const revengeTeam = game.metadata?.revenge_team;
        if (revengeTeam === 'home') {
          return game.home_score > game.away_score;
        }
        return game.away_score > game.home_score;
        
      case 'division_rivalry':
        // Unders in division games
        const rivalryTotal = (game.home_score || 0) + (game.away_score || 0);
        return rivalryTotal < (game.metadata?.total_line || 9.5);
        
      case 'home_underdog':
        // Home dogs cover
        return game.home_score > game.away_score;
        
      default:
        return false;
    }
  }
  
  private generatePatternInsights(pattern: string, breakdown: any): string[] {
    const insights: string[] = [];
    
    // Monthly trends
    const monthlyData = Object.entries(breakdown.monthly);
    if (monthlyData.length > 0) {
      const bestMonth = monthlyData.reduce((best, [month, metrics]: [string, any]) => 
        metrics.accuracy > best[1].accuracy ? [month, metrics] : best
      );
      
      const worstMonth = monthlyData.reduce((worst, [month, metrics]: [string, any]) => 
        metrics.accuracy < worst[1].accuracy ? [month, metrics] : worst
      );
      
      insights.push(`Best in ${bestMonth[0]} (${(bestMonth[1].accuracy * 100).toFixed(1)}% accuracy)`);
      insights.push(`Weakest in ${worstMonth[0]} (${(worstMonth[1].accuracy * 100).toFixed(1)}% accuracy)`);
    }
    
    // Day of week trends
    const dayData = Object.entries(breakdown.dayOfWeek);
    if (dayData.length > 0) {
      const weekendGames = dayData.filter(([day]) => ['Saturday', 'Sunday'].includes(day));
      const weekdayGames = dayData.filter(([day]) => !['Saturday', 'Sunday'].includes(day));
      
      const weekendAvg = this.calculateAverage(weekendGames.map(([_, m]: [string, any]) => m.accuracy));
      const weekdayAvg = this.calculateAverage(weekdayGames.map(([_, m]: [string, any]) => m.accuracy));
      
      if (Math.abs(weekendAvg - weekdayAvg) > 0.05) {
        insights.push(`${weekendAvg > weekdayAvg ? 'Better' : 'Worse'} on weekends (${((weekendAvg - weekdayAvg) * 100).toFixed(1)}% difference)`);
      }
    }
    
    // Temperature trends
    const tempData = Object.entries(breakdown.temperature);
    if (tempData.length > 0) {
      const bestTemp = tempData.reduce((best, [temp, metrics]: [string, any]) => 
        metrics.accuracy > best[1].accuracy ? [temp, metrics] : best
      );
      
      if (bestTemp[1].accuracy > 0.65) {
        insights.push(`Excellent in ${bestTemp[0]} (${(bestTemp[1].accuracy * 100).toFixed(1)}% accuracy)`);
      }
    }
    
    return insights;
  }
  
  private generateRecommendations(pattern: string, breakdown: any): string[] {
    const recommendations: string[] = [];
    
    // Check for seasonal adjustments needed
    const monthlyAccuracies = Object.values(breakdown.monthly).map((m: any) => m.accuracy);
    const monthlyVariance = this.calculateVariance(monthlyAccuracies);
    
    if (monthlyVariance > 0.01) {
      recommendations.push('High monthly variance - consider seasonal multipliers');
    }
    
    // Check ROI by time period
    Object.entries(breakdown.monthly).forEach(([month, metrics]: [string, any]) => {
      if (metrics.roi > 20 && metrics.occurrences > 10) {
        recommendations.push(`Increase stake in ${month} (${metrics.roi.toFixed(1)}% ROI)`);
      } else if (metrics.roi < -10 && metrics.occurrences > 10) {
        recommendations.push(`Reduce exposure in ${month} (${metrics.roi.toFixed(1)}% ROI)`);
      }
    });
    
    // Temperature-based recommendations
    if (pattern === 'altitude_advantage') {
      const hotWeather = breakdown.temperature['Hot (>85°F)'];
      if (hotWeather && hotWeather.accuracy > 0.7) {
        recommendations.push('Increase confidence in hot weather at altitude');
      }
    }
    
    return recommendations;
  }
  
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.calculateAverage(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return this.calculateAverage(squaredDiffs);
  }
  
  private displayPatternAnalysis(metrics: TimeBasedMetrics) {
    console.log(chalk.white(`\n   📊 ${metrics.pattern.toUpperCase()}`));
    
    // Monthly breakdown
    console.log(chalk.gray('\n   Monthly Performance:'));
    Object.entries(metrics.timeBreakdown.monthly).forEach(([month, data]) => {
      const accuracyStr = `${(data.accuracy * 100).toFixed(1)}%`.padEnd(6);
      const roiStr = `${data.roi >= 0 ? '+' : ''}${data.roi.toFixed(1)}%`.padEnd(7);
      console.log(chalk.white(`     ${month.padEnd(10)} Acc: ${accuracyStr} ROI: ${roiStr} (${data.occurrences} games)`));
    });
    
    // Day of week
    console.log(chalk.gray('\n   Day of Week:'));
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weekends = ['Saturday', 'Sunday'];
    
    const weekdayData = weekdays
      .map(day => metrics.timeBreakdown.dayOfWeek[day])
      .filter(Boolean);
    const weekendData = weekends
      .map(day => metrics.timeBreakdown.dayOfWeek[day])
      .filter(Boolean);
    
    if (weekdayData.length > 0) {
      const weekdayAvg = this.calculateAverage(weekdayData.map(d => d.accuracy));
      console.log(chalk.white(`     Weekdays: ${(weekdayAvg * 100).toFixed(1)}%`));
    }
    
    if (weekendData.length > 0) {
      const weekendAvg = this.calculateAverage(weekendData.map(d => d.accuracy));
      console.log(chalk.white(`     Weekends: ${(weekendAvg * 100).toFixed(1)}%`));
    }
    
    // Insights
    if (metrics.insights.length > 0) {
      console.log(chalk.yellow('\n   💡 Insights:'));
      metrics.insights.forEach(insight => {
        console.log(chalk.white(`     • ${insight}`));
      });
    }
    
    // Recommendations
    if (metrics.recommendations.length > 0) {
      console.log(chalk.green('\n   📋 Recommendations:'));
      metrics.recommendations.forEach(rec => {
        console.log(chalk.white(`     • ${rec}`));
      });
    }
  }
  
  private async generateTemporalInsights(results: TimeBasedMetrics[]) {
    console.log(chalk.cyan.bold('\n\n🔍 TEMPORAL INSIGHTS\n'));
    
    // Overall seasonal trends
    console.log(chalk.white.bold('Seasonal Trends:'));
    
    const monthlyPerformance: Record<string, number[]> = {};
    results.forEach(result => {
      Object.entries(result.timeBreakdown.monthly).forEach(([month, metrics]) => {
        if (!monthlyPerformance[month]) monthlyPerformance[month] = [];
        monthlyPerformance[month].push(metrics.accuracy);
      });
    });
    
    Object.entries(monthlyPerformance).forEach(([month, accuracies]) => {
      const avgAccuracy = this.calculateAverage(accuracies);
      console.log(chalk.white(`  ${month}: ${(avgAccuracy * 100).toFixed(1)}% average accuracy`));
    });
    
    // Pattern interactions
    console.log(chalk.white.bold('\nPattern Correlations:'));
    
    // Find patterns that work well together
    const highAccuracyPatterns = results
      .filter(r => {
        const overallAcc = Object.values(r.timeBreakdown.monthly)
          .reduce((sum, m) => sum + m.accuracy * m.occurrences, 0) /
          Object.values(r.timeBreakdown.monthly)
          .reduce((sum, m) => sum + m.occurrences, 0);
        return overallAcc > 0.65;
      })
      .map(r => r.pattern);
    
    if (highAccuracyPatterns.length > 1) {
      console.log(chalk.green(`  High performers: ${highAccuracyPatterns.join(', ')}`));
    }
    
    // Weather impact
    console.log(chalk.white.bold('\nWeather Impact:'));
    results.forEach(result => {
      const tempData = Object.entries(result.timeBreakdown.temperature);
      if (tempData.length > 0) {
        const [bestTemp] = tempData.reduce((best, current) => 
          current[1].accuracy > best[1].accuracy ? current : best
        );
        console.log(chalk.white(`  ${result.pattern}: Best in ${bestTemp}`));
      }
    });
  }
  
  private async saveAnalysis(results: TimeBasedMetrics[]) {
    console.log(chalk.yellow('\n💾 Saving temporal analysis...'));
    
    // Save to temporal pattern performance table
    for (const result of results) {
      // Save monthly breakdowns
      for (const [month, metrics] of Object.entries(result.timeBreakdown.monthly)) {
        await supabase
          .from('temporal_pattern_performance')
          .upsert({
            pattern_type: result.pattern,
            sport: 'MLB',
            time_period: month.toLowerCase(),
            total_occurrences: metrics.occurrences,
            successful_predictions: metrics.correct,
            accuracy_rate: metrics.accuracy,
            roi_percentage: metrics.roi,
            seasonal_multiplier: metrics.accuracy > 0.65 ? 1.1 : metrics.accuracy < 0.5 ? 0.9 : 1.0
          });
      }
      
      // Save day of week breakdowns
      for (const [day, metrics] of Object.entries(result.timeBreakdown.dayOfWeek)) {
        const isWeekend = ['Saturday', 'Sunday'].includes(day);
        await supabase
          .from('temporal_pattern_performance')
          .upsert({
            pattern_type: result.pattern,
            sport: 'MLB',
            time_period: isWeekend ? 'weekend' : 'weekday',
            total_occurrences: metrics.occurrences,
            successful_predictions: metrics.correct,
            accuracy_rate: metrics.accuracy,
            roi_percentage: metrics.roi,
            day_of_week_multiplier: metrics.accuracy > 0.65 ? 1.05 : 1.0
          });
      }
    }
    
    console.log(chalk.green('   ✓ Analysis saved to database'));
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let season = '2025';
  
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key === '--season') season = value;
  });
  
  const analyzer = new TimeBasedPatternAnalysis(season);
  
  analyzer.analyze().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default TimeBasedPatternAnalysis;