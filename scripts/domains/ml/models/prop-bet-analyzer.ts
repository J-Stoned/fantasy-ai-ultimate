#!/usr/bin/env tsx
/**
 * 🎯 Player Prop Bet Analyzer
 * Find soft prop lines using historical hit rates and situational analysis
 */

import chalk from 'chalk';
import { fantasyDataLoader, PlayerStats } from '../data-pipeline/fantasy-data-loader';

export interface PropBet {
  player_id: string;
  player_name: string;
  prop_type: 'points' | 'rebounds' | 'assists' | 'threes' | 'pra' | 'strikeouts' | 'bases' | 'yards' | 'touchdowns';
  line: number;
  over_odds: number;
  under_odds: number;
  sportsbook: string;
  game_date: string;
}

export interface PropAnalysis {
  prop: PropBet;
  hit_rate_overall: number;
  hit_rate_recent: number;
  hit_rate_vs_opponent: number;
  hit_rate_location: number; // home/away
  average_actual: number;
  median_actual: number;
  std_deviation: number;
  edge_percentage: number;
  recommended_bet: 'over' | 'under' | 'pass';
  confidence: number;
  key_factors: string[];
}

export class PropBetAnalyzer {
  private readonly MINIMUM_GAMES = 10;
  private readonly RECENT_GAMES = 5;
  private readonly EDGE_THRESHOLD = 5; // 5% edge minimum
  
  /**
   * Analyze a single prop bet
   */
  async analyzeProp(
    prop: PropBet,
    playerStats: PlayerStats[],
    lookbackGames: number = 20
  ): Promise<PropAnalysis> {
    console.log(chalk.cyan(`Analyzing ${prop.player_name} ${prop.prop_type} ${prop.line}...`));
    
    // Filter relevant games
    const relevantStats = playerStats
      .filter(s => s.player_id === prop.player_id)
      .sort((a, b) => b.game_date.getTime() - a.game_date.getTime())
      .slice(0, lookbackGames);
    
    if (relevantStats.length < this.MINIMUM_GAMES) {
      return this.createPassAnalysis(prop, 'Insufficient data');
    }
    
    // Extract prop values from stats
    const propValues = this.extractPropValues(relevantStats, prop.prop_type);
    
    // Calculate hit rates
    const hitRateOverall = this.calculateHitRate(propValues, prop.line);
    const hitRateRecent = this.calculateHitRate(propValues.slice(0, this.RECENT_GAMES), prop.line);
    
    // Opponent-specific analysis
    const vsOpponentGames = relevantStats.filter(s => s.opponent_id === this.getOpponentId(prop));
    const vsOpponentValues = this.extractPropValues(vsOpponentGames, prop.prop_type);
    const hitRateVsOpponent = vsOpponentGames.length >= 2 
      ? this.calculateHitRate(vsOpponentValues, prop.line)
      : hitRateOverall;
    
    // Location analysis
    const homeGames = relevantStats.filter(s => s.is_home);
    const homeValues = this.extractPropValues(homeGames, prop.prop_type);
    const awayGames = relevantStats.filter(s => !s.is_home);
    const awayValues = this.extractPropValues(awayGames, prop.prop_type);
    
    const isHome = this.isHomeGame(prop);
    const hitRateLocation = isHome
      ? this.calculateHitRate(homeValues, prop.line)
      : this.calculateHitRate(awayValues, prop.line);
    
    // Statistical analysis
    const average = this.average(propValues);
    const median = this.median(propValues);
    const stdDev = this.standardDeviation(propValues);
    
    // Calculate edge
    const impliedProbOver = this.oddsToImpliedProbability(prop.over_odds);
    const impliedProbUnder = this.oddsToImpliedProbability(prop.under_odds);
    
    // Weight different factors
    const weightedHitRate = (
      hitRateOverall * 0.3 +
      hitRateRecent * 0.3 +
      hitRateVsOpponent * 0.2 +
      hitRateLocation * 0.2
    );
    
    // Determine recommendation
    let recommended: 'over' | 'under' | 'pass' = 'pass';
    let edge = 0;
    
    if (weightedHitRate > impliedProbOver + this.EDGE_THRESHOLD / 100) {
      recommended = 'over';
      edge = (weightedHitRate - impliedProbOver) * 100;
    } else if ((1 - weightedHitRate) > impliedProbUnder + this.EDGE_THRESHOLD / 100) {
      recommended = 'under';
      edge = ((1 - weightedHitRate) - impliedProbUnder) * 100;
    }
    
    // Key factors
    const keyFactors = this.identifyKeyFactors({
      average,
      median,
      line: prop.line,
      hitRateRecent,
      hitRateOverall,
      stdDev,
      isHome
    });
    
    return {
      prop,
      hit_rate_overall: hitRateOverall,
      hit_rate_recent: hitRateRecent,
      hit_rate_vs_opponent: hitRateVsOpponent,
      hit_rate_location: hitRateLocation,
      average_actual: average,
      median_actual: median,
      std_deviation: stdDev,
      edge_percentage: edge,
      recommended_bet: recommended,
      confidence: this.calculateConfidence(edge, stdDev, relevantStats.length),
      key_factors: keyFactors
    };
  }
  
  /**
   * Find best props from a list
   */
  async findBestProps(
    props: PropBet[],
    playerStatsMap: Map<string, PlayerStats[]>,
    maxProps: number = 10
  ): Promise<PropAnalysis[]> {
    console.log(chalk.cyan(`\nAnalyzing ${props.length} props to find best ${maxProps}...\n`));
    
    const analyses: PropAnalysis[] = [];
    
    for (const prop of props) {
      const playerStats = playerStatsMap.get(prop.player_id) || [];
      const analysis = await this.analyzeProp(prop, playerStats);
      
      if (analysis.recommended_bet !== 'pass') {
        analyses.push(analysis);
      }
    }
    
    // Sort by edge percentage
    analyses.sort((a, b) => b.edge_percentage - a.edge_percentage);
    
    // Display results
    this.displayTopProps(analyses.slice(0, maxProps));
    
    return analyses.slice(0, maxProps);
  }
  
  /**
   * Extract prop values from stats
   */
  private extractPropValues(stats: PlayerStats[], propType: string): number[] {
    return stats.map(s => {
      const stat = s.stats || {};
      
      switch (propType) {
        case 'points':
          return stat.points || 0;
        case 'rebounds':
          return stat.rebounds || 0;
        case 'assists':
          return stat.assists || 0;
        case 'threes':
          return stat.three_pointers_made || stat.threes_made || 0;
        case 'pra': // Points + Rebounds + Assists
          return (stat.points || 0) + (stat.rebounds || 0) + (stat.assists || 0);
        case 'strikeouts':
          return stat.strikeouts || 0;
        case 'bases':
          return (stat.singles || 0) + (stat.doubles || 0) * 2 + 
                 (stat.triples || 0) * 3 + (stat.home_runs || 0) * 4;
        case 'yards':
          return (stat.passing_yards || 0) + (stat.rushing_yards || 0) + (stat.receiving_yards || 0);
        case 'touchdowns':
          return (stat.passing_touchdowns || 0) + (stat.rushing_touchdowns || 0) + 
                 (stat.receiving_touchdowns || 0);
        default:
          return 0;
      }
    });
  }
  
  /**
   * Calculate hit rate for over
   */
  private calculateHitRate(values: number[], line: number): number {
    if (values.length === 0) return 0.5;
    
    const hits = values.filter(v => v > line).length;
    return hits / values.length;
  }
  
  /**
   * Convert American odds to implied probability
   */
  private oddsToImpliedProbability(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    } else {
      return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
  }
  
  /**
   * Identify key factors for the prop
   */
  private identifyKeyFactors(data: {
    average: number;
    median: number;
    line: number;
    hitRateRecent: number;
    hitRateOverall: number;
    stdDev: number;
    isHome: boolean;
  }): string[] {
    const factors: string[] = [];
    
    // Trend analysis
    if (data.hitRateRecent > data.hitRateOverall + 0.15) {
      factors.push('Hot streak - hitting more recently');
    } else if (data.hitRateRecent < data.hitRateOverall - 0.15) {
      factors.push('Cold streak - hitting less recently');
    }
    
    // Line vs averages
    if (data.line < data.average - data.stdDev) {
      factors.push('Line significantly below average');
    } else if (data.line > data.average + data.stdDev) {
      factors.push('Line significantly above average');
    }
    
    // Consistency
    if (data.stdDev < data.average * 0.2) {
      factors.push('Very consistent performer');
    } else if (data.stdDev > data.average * 0.4) {
      factors.push('High variance player');
    }
    
    // Median vs mean
    if (data.median > data.average * 1.1) {
      factors.push('Skewed by low outliers');
    } else if (data.median < data.average * 0.9) {
      factors.push('Skewed by high outliers');
    }
    
    return factors;
  }
  
  /**
   * Calculate confidence score
   */
  private calculateConfidence(edge: number, stdDev: number, sampleSize: number): number {
    // Higher edge = higher confidence
    const edgeFactor = Math.min(edge / 20, 1); // Cap at 20% edge
    
    // Lower variance = higher confidence  
    const consistencyFactor = 1 / (1 + stdDev / 10);
    
    // More data = higher confidence
    const sampleFactor = Math.min(sampleSize / 30, 1); // Cap at 30 games
    
    return (edgeFactor * 0.5 + consistencyFactor * 0.3 + sampleFactor * 0.2);
  }
  
  /**
   * Display top props
   */
  private displayTopProps(analyses: PropAnalysis[]): void {
    console.log(chalk.bold.green('\n🎯 TOP PROP BETS:\n'));
    
    analyses.forEach((analysis, i) => {
      const { prop, recommended_bet, edge_percentage, confidence, key_factors } = analysis;
      
      console.log(chalk.yellow(`${i + 1}. ${prop.player_name} ${recommended_bet.toUpperCase()} ${prop.line} ${prop.prop_type}`));
      console.log(chalk.cyan(`   Edge: ${edge_percentage.toFixed(1)}% | Confidence: ${(confidence * 100).toFixed(0)}%`));
      console.log(chalk.gray(`   Hit Rates - Overall: ${(analysis.hit_rate_overall * 100).toFixed(0)}% | Recent: ${(analysis.hit_rate_recent * 100).toFixed(0)}%`));
      console.log(chalk.gray(`   Average: ${analysis.average_actual.toFixed(1)} | Line: ${prop.line}`));
      
      if (key_factors.length > 0) {
        console.log(chalk.gray(`   Key Factors: ${key_factors.join(', ')}`));
      }
      console.log();
    });
  }
  
  // Helper methods
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
  
  private median(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  private standardDeviation(numbers: number[]): number {
    const avg = this.average(numbers);
    const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
    return Math.sqrt(this.average(squareDiffs));
  }
  
  private createPassAnalysis(prop: PropBet, reason: string): PropAnalysis {
    return {
      prop,
      hit_rate_overall: 0.5,
      hit_rate_recent: 0.5,
      hit_rate_vs_opponent: 0.5,
      hit_rate_location: 0.5,
      average_actual: 0,
      median_actual: 0,
      std_deviation: 0,
      edge_percentage: 0,
      recommended_bet: 'pass',
      confidence: 0,
      key_factors: [reason]
    };
  }
  
  private getOpponentId(prop: PropBet): string {
    // In production, this would look up the opponent from the game
    return 'opponent_id';
  }
  
  private isHomeGame(prop: PropBet): boolean {
    // In production, this would check if it's a home game
    return Math.random() > 0.5;
  }
}

// Export singleton instance
export const propAnalyzer = new PropBetAnalyzer();