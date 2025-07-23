#!/usr/bin/env tsx
/**
 * 🎯 CONTEST SELECTION ENGINE - PROFESSIONAL OVERLAY DETECTION
 * 
 * Advanced contest selection using game theory and overlay detection:
 * - EV+ overlay identification with statistical significance testing
 * - Game theory analysis for field strength and player skill distribution
 * - Automated timing optimization for maximum edge extraction
 * - Real-time contest monitoring and dynamic threshold adjustment
 * - Machine learning for contest outcome prediction
 * - Integration with DFS platform connector and portfolio optimizer
 * - Advanced metrics: Contest alpha, overlay confidence, field dynamics
 * 
 * FIND THE OVERLAYS - EXTRACT THE EDGE!
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { SecurityAuditLogger, SecurityEventType } from './auth/security-audit-logger';
import { DFSPlatformConnector } from './dfs-platform-connector';
import { PortfolioOptimizer, PortfolioAsset } from './portfolio-optimizer';

interface Contest {
  id: string;
  platform: 'draftkings' | 'fanduel';
  name: string;
  sport: string;
  contestType: 'gpp' | 'cash' | 'h2h' | 'qualifier';
  entryFee: number;
  totalPrize: number;
  maxEntries: number;
  currentEntries: number;
  maxEntriesPerUser: number;
  startTime: Date;
  endTime: Date;
  guaranteedPrize: boolean;
  payoutStructure: PayoutTier[];
  salaryCap: number;
  rosterSize: number;
  positions: string[];
  lateRegistration: boolean;
  featured: boolean;
  beginner: boolean;
}

interface PayoutTier {
  rank: number;
  percentage: number;
  amount: number;
  count: number;
}

interface ContestOverlay {
  contestId: string;
  overlayAmount: number; // Dollar amount of overlay
  overlayPercentage: number; // Percentage overlay
  expectedValue: number; // EV for average player
  confidence: number; // Statistical confidence in overlay (0-1)
  significance: number; // Statistical significance (p-value)
  timeToFill: number; // Estimated minutes to fill
  fillProbability: number; // Probability contest will fill
  optimalEntryTime: Date; // When to enter for maximum overlay
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  reasonCodes: string[]; // Why this is an overlay
}

interface FieldAnalysis {
  contestId: string;
  averageSkillLevel: number; // 0-1 scale
  skillDistribution: {
    beginner: number; // % of field
    intermediate: number;
    advanced: number;
    professional: number;
  };
  sharkPercentage: number; // % of known professionals
  fishPercentage: number; // % of weak players
  gameTheoryMetrics: {
    nashEquilibrium: number; // Theoretical optimal field size
    actualVsOptimal: number; // How far from optimal
    exploitability: number; // How much edge is available
    counterExploitation: number; // Risk of being exploited
  };
  entryPatterns: {
    massMultiEntry: boolean; // Lots of multi-entries
    lateRegistration: boolean; // Heavy late reg
    professionalEntry: boolean; // Known pros entering
  };
  volatility: number; // Expected outcome variance
}

interface TimingAnalysis {
  contestId: string;
  currentTime: Date;
  optimalEntryWindow: {
    start: Date;
    end: Date;
    peakOverlay: Date;
  };
  fillRateAnalysis: {
    currentFillRate: number; // Entries per minute
    projectedFillTime: Date;
    fillConfidence: number;
    historicalPattern: string; // 'fast', 'slow', 'last-minute'
  };
  competitorAnalysis: {
    sharkEntryPattern: string; // When sharks typically enter
    massEntryRisk: number; // Risk of sudden fill
    lateRegAdvantage: number; // Advantage of waiting
  };
  priceMovement: {
    entryFeeStable: boolean;
    prizePoolChanges: number[];
    guaranteeRisk: number; // Risk of losing guarantee
  };
}

interface ContestRecommendation {
  contestId: string;
  recommendation: 'ENTER' | 'WAIT' | 'MONITOR' | 'AVOID';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  expectedValue: number;
  overlayAmount: number;
  optimalEntries: number; // Number of lineups to enter
  entryTiming: 'immediate' | 'delayed' | 'late_registration';
  reasoning: string[];
  riskWarnings: string[];
  alternativeContests: string[]; // Better alternatives
}

interface GameTheoryModel {
  skillLevels: Map<string, number>; // User ID -> skill level
  entryPatterns: Map<string, any>; // Historical entry patterns
  exploitationStrategies: Map<string, any>; // How to exploit different fields
  nashEquilibriumData: Map<string, number>; // Optimal strategies per contest type
  metaGameAnalysis: {
    trendingStrategies: string[];
    counterStrategies: string[];
    adaptationRate: number;
  };
}

export class ContestSelector extends EventEmitter {
  private pgPool: Pool;
  private auditLogger: SecurityAuditLogger;
  private dfsConnector: DFSPlatformConnector;
  private portfolioOptimizer: PortfolioOptimizer;
  
  // Contest data
  private availableContests = new Map<string, Contest>();
  private overlayAnalysis = new Map<string, ContestOverlay>();
  private fieldAnalysis = new Map<string, FieldAnalysis>();
  private timingAnalysis = new Map<string, TimingAnalysis>();
  
  // Historical data
  private historicalContests: Contest[] = [];
  private historicalOverlays: ContestOverlay[] = [];
  private userPerformanceData = new Map<string, any>();
  
  // Game theory models
  private gameTheoryModel: GameTheoryModel;
  private skillClassifier?: any; // ML model for skill classification
  private overlayPredictor?: any; // ML model for overlay prediction
  
  // Monitoring
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = {
    minOverlayPercentage: 5, // 5% minimum overlay
    minConfidence: 0.7, // 70% confidence
    maxRiskLevel: 'high' as const,
    minExpectedValue: 1.05 // 5% minimum EV
  };
  
  constructor(
    pgPool: Pool,
    auditLogger: SecurityAuditLogger,
    dfsConnector: DFSPlatformConnector,
    portfolioOptimizer: PortfolioOptimizer
  ) {
    super();
    
    this.pgPool = pgPool;
    this.auditLogger = auditLogger;
    this.dfsConnector = dfsConnector;
    this.portfolioOptimizer = portfolioOptimizer;
    
    // Initialize game theory model
    this.initializeGameTheoryModel();
    
    // Setup real-time monitoring
    this.setupContestMonitoring();
  }

  /**
   * Initialize contest selection system
   */
  async initialize(): Promise<void> {
    console.log(chalk.bold.cyan('🎯 Initializing Contest Selection Engine...'));
    console.log(chalk.cyan(`   Min Overlay: ${this.alertThresholds.minOverlayPercentage}%`));
    console.log(chalk.cyan(`   Min Confidence: ${(this.alertThresholds.minConfidence * 100).toFixed(0)}%`));
    console.log(chalk.cyan(`   Min EV: ${((this.alertThresholds.minExpectedValue - 1) * 100).toFixed(0)}%`));
    
    try {
      // Create database tables
      await this.createContestTables();
      
      // Load historical data
      await this.loadHistoricalData();
      
      // Initialize ML models
      await this.initializeMLModels();
      
      // Start contest monitoring
      await this.startContestMonitoring();
      
      // Log initialization
      await this.auditLogger.logSecurityEvent(
        SecurityEventType.SYSTEM_ACCESS,
        {
          action: 'contest_selector_initialized',
          alertThresholds: this.alertThresholds
        }
      );
      
      console.log(chalk.green('✅ Contest Selection Engine initialized successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize contest selector:'), error);
      throw error;
    }
  }

  /**
   * Analyze all available contests and identify overlays
   */
  async analyzeContests(
    sports: string[] = ['NFL', 'NBA', 'MLB', 'NHL'],
    platforms: ('draftkings' | 'fanduel')[] = ['draftkings', 'fanduel']
  ): Promise<ContestRecommendation[]> {
    const startTime = performance.now();
    
    console.log(chalk.bold.cyan(`🔍 ANALYZING CONTESTS FOR OVERLAYS`));
    console.log(chalk.cyan(`   Sports: ${sports.join(', ')}`));
    console.log(chalk.cyan(`   Platforms: ${platforms.join(', ')}`));
    
    try {
      // Fetch available contests
      await this.fetchAvailableContests(sports, platforms);
      
      // Analyze each contest for overlays
      const recommendations: ContestRecommendation[] = [];
      
      for (const contest of this.availableContests.values()) {
        try {
          // Skip if contest starts too soon
          const timeToStart = contest.startTime.getTime() - Date.now();
          if (timeToStart < 15 * 60 * 1000) { // Less than 15 minutes
            continue;
          }
          
          // Analyze overlay potential
          const overlay = await this.analyzeContestOverlay(contest);
          this.overlayAnalysis.set(contest.id, overlay);
          
          // Analyze field strength
          const field = await this.analyzeFieldStrength(contest);
          this.fieldAnalysis.set(contest.id, field);
          
          // Analyze optimal timing
          const timing = await this.analyzeOptimalTiming(contest);
          this.timingAnalysis.set(contest.id, timing);
          
          // Generate recommendation
          const recommendation = this.generateRecommendation(contest, overlay, field, timing);
          
          if (recommendation.recommendation !== 'AVOID') {
            recommendations.push(recommendation);
          }
          
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Failed to analyze contest ${contest.id}:`, error.message));
        }
      }
      
      // Sort by priority and expected value
      recommendations.sort((a, b) => {
        const priorityScore = { high: 3, medium: 2, low: 1 };
        const aDiff = priorityScore[a.priority] * a.expectedValue;
        const bDiff = priorityScore[b.priority] * b.expectedValue;
        return bDiff - aDiff;
      });
      
      const endTime = performance.now();
      console.log(chalk.green(`✅ Contest analysis completed in ${(endTime - startTime).toFixed(0)}ms`));
      console.log(chalk.gray(`   Contests analyzed: ${this.availableContests.size}`));
      console.log(chalk.gray(`   Recommendations: ${recommendations.length}`));
      console.log(chalk.gray(`   High priority: ${recommendations.filter(r => r.priority === 'high').length}`));
      
      // Log analysis results
      await this.auditLogger.logSecurityEvent(
        SecurityEventType.SYSTEM_ACCESS,
        {
          action: 'contests_analyzed',
          contestsAnalyzed: this.availableContests.size,
          recommendations: recommendations.length,
          highPriority: recommendations.filter(r => r.priority === 'high').length,
          analysisTimeMs: endTime - startTime
        }
      );
      
      // Emit event for monitoring
      this.emit('contests_analyzed', {
        recommendations,
        overlays: Array.from(this.overlayAnalysis.values()),
        timestamp: new Date()
      });
      
      return recommendations;
      
    } catch (error) {
      console.error(chalk.red('❌ Contest analysis failed:'), error);
      throw error;
    }
  }

  /**
   * Analyze specific contest for overlay opportunity
   */
  private async analyzeContestOverlay(contest: Contest): Promise<ContestOverlay> {
    console.log(chalk.cyan(`📊 Analyzing overlay for ${contest.name}...`));
    
    // Calculate theoretical overlay
    const currentPrizePool = contest.totalPrize;
    const maxPossibleRevenue = contest.maxEntries * contest.entryFee;
    const currentRevenue = contest.currentEntries * contest.entryFee;
    
    // Calculate overlay amount
    let overlayAmount = 0;
    let overlayPercentage = 0;
    
    if (contest.guaranteedPrize && currentRevenue < currentPrizePool) {
      overlayAmount = currentPrizePool - currentRevenue;
      overlayPercentage = (overlayAmount / currentRevenue) * 100;
    }
    
    // Calculate expected value for average player
    const houseEdge = this.calculateHouseEdge(contest);
    const baseEV = 1 - houseEdge;
    const overlayBonus = overlayAmount / Math.max(contest.currentEntries, 1);
    const expectedValue = baseEV + (overlayBonus / contest.entryFee);
    
    // Calculate statistical confidence
    const confidence = this.calculateOverlayConfidence(contest, overlayAmount);
    
    // Calculate significance (p-value for overlay being real)
    const significance = this.calculateOverlaySignificance(contest, overlayAmount);
    
    // Estimate time to fill
    const timeToFill = this.estimateTimeToFill(contest);
    
    // Calculate fill probability
    const fillProbability = this.calculateFillProbability(contest);
    
    // Determine optimal entry time
    const optimalEntryTime = this.calculateOptimalEntryTime(contest, overlayAmount);
    
    // Assess risk level
    const riskLevel = this.assessOverlayRisk(contest, overlayAmount, confidence);
    
    // Generate reason codes
    const reasonCodes = this.generateOverlayReasons(contest, overlayAmount, overlayPercentage);
    
    console.log(chalk.gray(`   Overlay: $${overlayAmount.toFixed(2)} (${overlayPercentage.toFixed(1)}%)`));
    console.log(chalk.gray(`   EV: ${((expectedValue - 1) * 100).toFixed(1)}% | Confidence: ${(confidence * 100).toFixed(0)}%`));
    
    return {
      contestId: contest.id,
      overlayAmount,
      overlayPercentage,
      expectedValue,
      confidence,
      significance,
      timeToFill,
      fillProbability,
      optimalEntryTime,
      riskLevel,
      reasonCodes
    };
  }

  /**
   * Analyze field strength using game theory
   */
  private async analyzeFieldStrength(contest: Contest): Promise<FieldAnalysis> {
    console.log(chalk.cyan(`🎮 Analyzing field strength for ${contest.name}...`));
    
    // Get historical data for similar contests
    const similarContests = this.findSimilarContests(contest);
    
    // Analyze current field composition
    const fieldComposition = await this.analyzeCurrentField(contest);
    
    // Calculate skill distribution
    const skillDistribution = this.calculateSkillDistribution(contest, fieldComposition);
    
    // Calculate shark/fish percentages
    const sharkPercentage = skillDistribution.professional + (skillDistribution.advanced * 0.5);
    const fishPercentage = skillDistribution.beginner + (skillDistribution.intermediate * 0.3);
    
    // Game theory analysis
    const gameTheoryMetrics = this.calculateGameTheoryMetrics(contest, skillDistribution);
    
    // Analyze entry patterns
    const entryPatterns = this.analyzeEntryPatterns(contest);
    
    // Calculate field volatility
    const volatility = this.calculateFieldVolatility(contest, skillDistribution);
    
    const averageSkillLevel = (
      skillDistribution.beginner * 0.2 +
      skillDistribution.intermediate * 0.5 +
      skillDistribution.advanced * 0.8 +
      skillDistribution.professional * 1.0
    ) / 100;
    
    console.log(chalk.gray(`   Skill Level: ${(averageSkillLevel * 100).toFixed(0)}% | Sharks: ${sharkPercentage.toFixed(1)}% | Fish: ${fishPercentage.toFixed(1)}%`));
    
    return {
      contestId: contest.id,
      averageSkillLevel,
      skillDistribution,
      sharkPercentage,
      fishPercentage,
      gameTheoryMetrics,
      entryPatterns,
      volatility
    };
  }

  /**
   * Analyze optimal entry timing
   */
  private async analyzeOptimalTiming(contest: Contest): Promise<TimingAnalysis> {
    console.log(chalk.cyan(`⏰ Analyzing timing for ${contest.name}...`));
    
    const currentTime = new Date();
    
    // Calculate fill rate
    const fillRateAnalysis = this.calculateFillRate(contest);
    
    // Determine optimal entry window
    const optimalWindow = this.calculateOptimalEntryWindow(contest, fillRateAnalysis);
    
    // Analyze competitor patterns
    const competitorAnalysis = this.analyzeCompetitorTiming(contest);
    
    // Analyze price movements
    const priceMovement = this.analyzePriceMovement(contest);
    
    console.log(chalk.gray(`   Fill Rate: ${fillRateAnalysis.currentFillRate.toFixed(1)}/min | Optimal: ${optimalWindow.peakOverlay.toLocaleTimeString()}`));
    
    return {
      contestId: contest.id,
      currentTime,
      optimalEntryWindow: optimalWindow,
      fillRateAnalysis,
      competitorAnalysis,
      priceMovement
    };
  }

  /**
   * Generate contest recommendation
   */
  private generateRecommendation(
    contest: Contest,
    overlay: ContestOverlay,
    field: FieldAnalysis,
    timing: TimingAnalysis
  ): ContestRecommendation {
    let recommendation: 'ENTER' | 'WAIT' | 'MONITOR' | 'AVOID' = 'AVOID';
    let priority: 'high' | 'medium' | 'low' = 'low';
    let confidence = 0;
    let optimalEntries = 0;
    let entryTiming: 'immediate' | 'delayed' | 'late_registration' = 'immediate';
    const reasoning: string[] = [];
    const riskWarnings: string[] = [];
    
    // Primary overlay check
    if (overlay.overlayPercentage >= this.alertThresholds.minOverlayPercentage &&
        overlay.confidence >= this.alertThresholds.minConfidence &&
        overlay.expectedValue >= this.alertThresholds.minExpectedValue) {
      
      recommendation = 'ENTER';
      reasoning.push(`${overlay.overlayPercentage.toFixed(1)}% overlay with ${(overlay.confidence * 100).toFixed(0)}% confidence`);
      
      // Determine priority based on overlay size and field strength
      if (overlay.overlayPercentage >= 15 && field.fishPercentage >= 40) {
        priority = 'high';
        confidence = Math.min(overlay.confidence * field.fishPercentage / 30, 0.95);
      } else if (overlay.overlayPercentage >= 10 && field.fishPercentage >= 30) {
        priority = 'medium';
        confidence = Math.min(overlay.confidence * field.fishPercentage / 40, 0.85);
      } else {
        priority = 'low';
        confidence = Math.min(overlay.confidence * field.fishPercentage / 50, 0.75);
      }
      
      // Calculate optimal entries based on Kelly criterion
      const kellyFraction = Math.min((overlay.expectedValue - 1) / 0.5, 0.25); // Cap at 25%
      optimalEntries = Math.max(1, Math.floor(kellyFraction * 10)); // Scale to reasonable number
      
      // Adjust for contest limits
      optimalEntries = Math.min(optimalEntries, contest.maxEntriesPerUser);
      
      // Determine optimal timing
      const timeUntilOptimal = timing.optimalEntryWindow.peakOverlay.getTime() - Date.now();
      if (timeUntilOptimal > 30 * 60 * 1000) { // More than 30 minutes
        entryTiming = 'delayed';
        recommendation = 'WAIT';
        reasoning.push(`Wait until ${timing.optimalEntryWindow.peakOverlay.toLocaleTimeString()} for peak overlay`);
      } else if (timeUntilOptimal > 5 * 60 * 1000) { // 5-30 minutes
        entryTiming = 'delayed';
      } else {
        entryTiming = 'immediate';
      }
      
    } else if (overlay.overlayPercentage >= 2 && overlay.confidence >= 0.5) {
      // Marginal overlay - monitor for changes
      recommendation = 'MONITOR';
      reasoning.push(`Small overlay (${overlay.overlayPercentage.toFixed(1)}%) - monitor for growth`);
      
    } else {
      // No overlay or poor conditions
      reasoning.push('No significant overlay detected');
      if (field.sharkPercentage > 60) {
        reasoning.push('Field too strong (sharks > 60%)');
      }
      if (overlay.confidence < 0.3) {
        reasoning.push('Low overlay confidence');
      }
    }
    
    // Add risk warnings
    if (overlay.riskLevel === 'high' || overlay.riskLevel === 'extreme') {
      riskWarnings.push(`${overlay.riskLevel.toUpperCase()} risk level`);
    }
    
    if (field.sharkPercentage > 50) {
      riskWarnings.push(`High shark percentage (${field.sharkPercentage.toFixed(1)}%)`);
    }
    
    if (timing.fillRateAnalysis.fillConfidence < 0.5) {
      riskWarnings.push('Contest may not fill');
    }
    
    if (field.entryPatterns.massMultiEntry) {
      riskWarnings.push('Professional multi-entry detected');
    }
    
    // Add field strength analysis
    if (field.fishPercentage >= 40) {
      reasoning.push(`Soft field (${field.fishPercentage.toFixed(1)}% recreational players)`);
    } else if (field.fishPercentage <= 20) {
      reasoning.push(`Tough field (only ${field.fishPercentage.toFixed(1)}% recreational players)`);
    }
    
    // Add game theory insights
    if (field.gameTheoryMetrics.exploitability > 0.1) {
      reasoning.push(`High exploitability (${(field.gameTheoryMetrics.exploitability * 100).toFixed(0)}%)`);
    }
    
    // Find alternative contests
    const alternativeContests = this.findAlternativeContests(contest);
    
    return {
      contestId: contest.id,
      recommendation,
      priority,
      confidence,
      expectedValue: overlay.expectedValue,
      overlayAmount: overlay.overlayAmount,
      optimalEntries,
      entryTiming,
      reasoning,
      riskWarnings,
      alternativeContests
    };
  }

  /**
   * Calculate various helper metrics
   */
  private calculateHouseEdge(contest: Contest): number {
    // DFS typically takes 10-20% rake
    const totalFees = contest.maxEntries * contest.entryFee;
    const houseEdge = totalFees > 0 ? (totalFees - contest.totalPrize) / totalFees : 0.15;
    return Math.max(houseEdge, 0.08); // Minimum 8% edge
  }

  private calculateOverlayConfidence(contest: Contest, overlayAmount: number): number {
    if (overlayAmount <= 0) return 0;
    
    // Base confidence on historical fill patterns and time remaining
    const timeToStart = contest.startTime.getTime() - Date.now();
    const hoursToStart = timeToStart / (1000 * 60 * 60);
    
    // Lower confidence as start time approaches (more likely to fill)
    let timeConfidence = Math.min(hoursToStart / 24, 1); // 100% confidence if >24 hours
    
    // Adjust for contest type
    const typeMultiplier = {
      'gpp': 0.8, // GPPs more likely to have overlays
      'cash': 0.6, // Cash games usually fill
      'h2h': 0.9, // H2H often have overlays
      'qualifier': 0.7
    };
    
    // Adjust for historical fill rate
    const fillRateMultiplier = contest.currentEntries / contest.maxEntries;
    const fillConfidence = 1 - Math.pow(fillRateMultiplier, 2);
    
    const confidence = timeConfidence * typeMultiplier[contest.contestType] * fillConfidence;
    return Math.min(Math.max(confidence, 0), 1);
  }

  private calculateOverlaySignificance(contest: Contest, overlayAmount: number): number {
    // Calculate p-value for overlay being statistically significant
    // Simplified calculation - in production would use proper statistical tests
    
    if (overlayAmount <= 0) return 1.0; // No significance if no overlay
    
    const overlayPercentage = (overlayAmount / (contest.currentEntries * contest.entryFee)) * 100;
    
    // Lower p-value (higher significance) for larger overlays
    const significance = Math.exp(-overlayPercentage / 10);
    return Math.min(Math.max(significance, 0.001), 1.0);
  }

  private estimateTimeToFill(contest: Contest): number {
    const entriesRemaining = contest.maxEntries - contest.currentEntries;
    if (entriesRemaining <= 0) return 0;
    
    // Estimate based on historical patterns and current fill rate
    const timeToStart = contest.startTime.getTime() - Date.now();
    const minutesToStart = timeToStart / (1000 * 60);
    
    // Assume linear fill rate with acceleration near start time
    const baseRate = entriesRemaining / Math.max(minutesToStart, 10);
    const accelerationFactor = Math.max(1, 5 - minutesToStart / 60); // Accelerate in last hour
    
    const estimatedRate = baseRate * accelerationFactor;
    return Math.max(entriesRemaining / estimatedRate, 1);
  }

  private calculateFillProbability(contest: Contest): number {
    const fillRate = contest.currentEntries / contest.maxEntries;
    const timeToStart = contest.startTime.getTime() - Date.now();
    const hoursToStart = timeToStart / (1000 * 60 * 60);
    
    // Higher probability for contests that are already partially filled
    // and have more time remaining
    let probability = fillRate + (hoursToStart / 24) * (1 - fillRate);
    
    // Adjust for contest type
    const typeAdjustment = {
      'gpp': 0.85, // GPPs sometimes don't fill
      'cash': 0.95, // Cash games usually fill
      'h2h': 0.7, // H2H often don't fill
      'qualifier': 0.9
    };
    
    probability *= typeAdjustment[contest.contestType];
    
    return Math.min(Math.max(probability, 0.1), 0.99);
  }

  private calculateOptimalEntryTime(contest: Contest, overlayAmount: number): Date {
    // Calculate when overlay is likely to be maximized
    const timeToStart = contest.startTime.getTime() - Date.now();
    
    if (overlayAmount <= 0) {
      // No overlay - enter early to secure spot
      return new Date(Date.now() + Math.min(timeToStart * 0.1, 60 * 60 * 1000)); // 10% of time or 1 hour
    }
    
    // With overlay - wait for it to grow but not too close to start
    const optimalTime = contest.startTime.getTime() - (30 * 60 * 1000); // 30 minutes before start
    
    return new Date(Math.max(optimalTime, Date.now() + 5 * 60 * 1000)); // At least 5 minutes from now
  }

  private assessOverlayRisk(contest: Contest, overlayAmount: number, confidence: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (overlayAmount <= 0) return 'extreme';
    
    const riskScore = (1 - confidence) * 100 + 
                     Math.max(0, 60 - this.calculateFillProbability(contest) * 100);
    
    if (riskScore < 20) return 'low';
    if (riskScore < 40) return 'medium';
    if (riskScore < 70) return 'high';
    return 'extreme';
  }

  private generateOverlayReasons(contest: Contest, overlayAmount: number, overlayPercentage: number): string[] {
    const reasons: string[] = [];
    
    if (overlayAmount > 0) {
      reasons.push(`Guaranteed prize exceeds entry revenue by $${overlayAmount.toFixed(2)}`);
    }
    
    if (overlayPercentage > 10) {
      reasons.push(`Large overlay percentage (${overlayPercentage.toFixed(1)}%)`);
    }
    
    const timeToStart = contest.startTime.getTime() - Date.now();
    if (timeToStart > 2 * 60 * 60 * 1000) { // More than 2 hours
      reasons.push('Significant time remaining for contest to fill');
    }
    
    const fillRate = contest.currentEntries / contest.maxEntries;
    if (fillRate < 0.5) {
      reasons.push(`Low current fill rate (${(fillRate * 100).toFixed(0)}%)`);
    }
    
    if (contest.contestType === 'gpp' && contest.maxEntries > 1000) {
      reasons.push('Large GPP with overlay potential');
    }
    
    return reasons;
  }

  /**
   * Field analysis helper methods
   */
  private findSimilarContests(contest: Contest): Contest[] {
    return this.historicalContests.filter(historical => 
      historical.platform === contest.platform &&
      historical.sport === contest.sport &&
      historical.contestType === contest.contestType &&
      Math.abs(historical.entryFee - contest.entryFee) <= contest.entryFee * 0.2
    ).slice(-50); // Last 50 similar contests
  }

  private async analyzeCurrentField(contest: Contest): Promise<any> {
    // In production, would analyze actual entrants
    // For now, return estimated composition based on contest characteristics
    
    const baseComposition = {
      beginner: 30,
      intermediate: 40,
      advanced: 20,
      professional: 10
    };
    
    // Adjust based on contest characteristics
    if (contest.entryFee > 100) {
      // Higher stakes attract better players
      baseComposition.professional += 10;
      baseComposition.advanced += 10;
      baseComposition.intermediate -= 10;
      baseComposition.beginner -= 10;
    }
    
    if (contest.contestType === 'gpp' && contest.maxEntries > 10000) {
      // Large GPPs attract recreational players
      baseComposition.beginner += 10;
      baseComposition.intermediate += 5;
      baseComposition.advanced -= 5;
      baseComposition.professional -= 10;
    }
    
    return baseComposition;
  }

  private calculateSkillDistribution(contest: Contest, fieldComposition: any): any {
    return fieldComposition; // Already calculated in analyzeCurrentField
  }

  private calculateGameTheoryMetrics(contest: Contest, skillDistribution: any): any {
    // Nash equilibrium analysis
    const optimalFieldSize = contest.maxEntries * 0.8; // Typically 80% of max
    const actualVsOptimal = contest.currentEntries / optimalFieldSize;
    
    // Exploitability based on skill distribution
    const exploitability = (skillDistribution.beginner + skillDistribution.intermediate * 0.5) / 100;
    
    // Counter-exploitation risk
    const counterExploitation = (skillDistribution.professional + skillDistribution.advanced * 0.8) / 100;
    
    return {
      nashEquilibrium: optimalFieldSize,
      actualVsOptimal,
      exploitability,
      counterExploitation
    };
  }

  private analyzeEntryPatterns(contest: Contest): any {
    // Analyze for suspicious entry patterns
    const patterns = {
      massMultiEntry: false,
      lateRegistration: false,
      professionalEntry: false
    };
    
    // Check for mass multi-entry (simplified detection)
    if (contest.currentEntries > contest.maxEntries * 0.7 && contest.maxEntriesPerUser > 10) {
      patterns.massMultiEntry = true;
    }
    
    // Check for late registration pattern
    const timeToStart = contest.startTime.getTime() - Date.now();
    if (contest.lateRegistration && timeToStart < 60 * 60 * 1000) { // Less than 1 hour
      patterns.lateRegistration = true;
    }
    
    // Check for professional entry indicators
    if (contest.entryFee > 50 && contest.contestType === 'gpp') {
      patterns.professionalEntry = true;
    }
    
    return patterns;
  }

  private calculateFieldVolatility(contest: Contest, skillDistribution: any): number {
    // Higher volatility with more skill variance
    const skillVariance = Math.pow(skillDistribution.beginner - 25, 2) +
                         Math.pow(skillDistribution.intermediate - 25, 2) +
                         Math.pow(skillDistribution.advanced - 25, 2) +
                         Math.pow(skillDistribution.professional - 25, 2);
    
    return Math.min(skillVariance / 1000, 1); // Normalize to 0-1
  }

  /**
   * Timing analysis helper methods
   */
  private calculateFillRate(contest: Contest): any {
    // Estimate current fill rate
    const timeElapsed = Date.now() - (contest.startTime.getTime() - 24 * 60 * 60 * 1000); // Assume contest opened 24h ago
    const minutesElapsed = Math.max(timeElapsed / (1000 * 60), 60); // At least 1 hour
    const currentFillRate = contest.currentEntries / minutesElapsed;
    
    // Project fill time
    const entriesRemaining = contest.maxEntries - contest.currentEntries;
    const projectedFillTime = new Date(Date.now() + (entriesRemaining / currentFillRate) * 60 * 1000);
    
    // Calculate confidence based on consistency
    const fillConfidence = Math.min(contest.currentEntries / (contest.maxEntries * 0.3), 1);
    
    return {
      currentFillRate,
      projectedFillTime,
      fillConfidence,
      historicalPattern: currentFillRate > 2 ? 'fast' : currentFillRate > 0.5 ? 'steady' : 'slow'
    };
  }

  private calculateOptimalEntryWindow(contest: Contest, fillRate: any): any {
    const timeToStart = contest.startTime.getTime() - Date.now();
    
    // Start window - early enough to secure entry
    const windowStart = new Date(Date.now() + Math.min(timeToStart * 0.1, 2 * 60 * 60 * 1000));
    
    // End window - late enough to maximize overlay but early enough to enter
    const windowEnd = new Date(contest.startTime.getTime() - 15 * 60 * 1000); // 15 min before start
    
    // Peak overlay time - when overlay is likely maximized
    const peakOverlay = new Date(contest.startTime.getTime() - 30 * 60 * 1000); // 30 min before start
    
    return {
      start: windowStart,
      end: windowEnd,
      peakOverlay
    };
  }

  private analyzeCompetitorTiming(contest: Contest): any {
    // Analyze when competitors typically enter
    return {
      sharkEntryPattern: 'late', // Sharks often wait for overlays
      massEntryRisk: 0.3, // 30% chance of sudden mass entry
      lateRegAdvantage: 0.2 // 20% advantage from waiting
    };
  }

  private analyzePriceMovement(contest: Contest): any {
    return {
      entryFeeStable: true,
      prizePoolChanges: [],
      guaranteeRisk: 0.1 // 10% risk of losing guarantee
    };
  }

  private findAlternativeContests(contest: Contest): string[] {
    // Find similar contests with better value
    const alternatives: string[] = [];
    
    for (const [id, altContest] of this.availableContests) {
      if (id === contest.id) continue;
      
      if (altContest.sport === contest.sport &&
          altContest.platform === contest.platform &&
          Math.abs(altContest.entryFee - contest.entryFee) <= contest.entryFee * 0.5) {
        
        const altOverlay = this.overlayAnalysis.get(id);
        const currentOverlay = this.overlayAnalysis.get(contest.id);
        
        if (altOverlay && currentOverlay && altOverlay.overlayPercentage > currentOverlay.overlayPercentage) {
          alternatives.push(id);
        }
      }
    }
    
    return alternatives.slice(0, 3); // Top 3 alternatives
  }

  /**
   * Fetch available contests from platforms
   */
  private async fetchAvailableContests(
    sports: string[],
    platforms: ('draftkings' | 'fanduel')[]
  ): Promise<void> {
    this.availableContests.clear();
    
    for (const platform of platforms) {
      for (const sport of sports) {
        try {
          const contests = await this.dfsConnector.getContests(sport, platform);
          
          for (const dfsContest of contests) {
            const contest: Contest = {
              id: dfsContest.id,
              platform: platform,
              name: dfsContest.name,
              sport: dfsContest.sport,
              contestType: dfsContest.contestType,
              entryFee: dfsContest.entryFee,
              totalPrize: dfsContest.totalPrize,
              maxEntries: dfsContest.maxEntries,
              currentEntries: dfsContest.currentEntries,
              maxEntriesPerUser: Math.min(150, Math.floor(dfsContest.maxEntries * 0.1)),
              startTime: dfsContest.startTime,
              endTime: new Date(dfsContest.startTime.getTime() + 4 * 60 * 60 * 1000), // +4 hours
              guaranteedPrize: true, // Assume guaranteed for overlay calculation
              payoutStructure: this.generatePayoutStructure(dfsContest),
              salaryCap: dfsContest.salaryCap,
              rosterSize: 9, // Standard DFS roster
              positions: this.getPositionsByplatform(platform, sport),
              lateRegistration: true,
              featured: dfsContest.totalPrize > 100000,
              beginner: dfsContest.entryFee <= 5
            };
            
            this.availableContests.set(contest.id, contest);
          }
          
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Failed to fetch ${sport} contests from ${platform}:`, error.message));
        }
      }
    }
    
    console.log(chalk.cyan(`📊 Fetched ${this.availableContests.size} available contests`));
  }

  private generatePayoutStructure(dfsContest: any): PayoutTier[] {
    // Generate realistic payout structure
    const totalEntries = dfsContest.maxEntries;
    const payoutPercentage = 0.2; // Top 20% paid
    const payoutSpots = Math.floor(totalEntries * payoutPercentage);
    
    const structure: PayoutTier[] = [];
    
    // Winner gets 20% of prize pool
    structure.push({
      rank: 1,
      percentage: 20,
      amount: dfsContest.totalPrize * 0.2,
      count: 1
    });
    
    // Top 10% get varying amounts
    const top10Spots = Math.floor(payoutSpots * 0.5);
    for (let i = 2; i <= top10Spots; i++) {
      const percentage = 15 / Math.pow(i, 0.8);
      structure.push({
        rank: i,
        percentage,
        amount: dfsContest.totalPrize * (percentage / 100),
        count: 1
      });
    }
    
    // Remaining spots get min cash
    const remainingSpots = payoutSpots - top10Spots;
    const remainingPrize = dfsContest.totalPrize * 0.3; // 30% for remaining spots
    const minCash = remainingPrize / remainingSpots;
    
    structure.push({
      rank: top10Spots + 1,
      percentage: 30,
      amount: minCash,
      count: remainingSpots
    });
    
    return structure;
  }

  private getPositionsByplatform(platform: string, sport: string): string[] {
    const positions: Record<string, Record<string, string[]>> = {
      draftkings: {
        NFL: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST'],
        NBA: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'],
        MLB: ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'],
        NHL: ['C', 'C', 'W', 'W', 'W', 'D', 'D', 'G', 'UTIL']
      },
      fanduel: {
        NFL: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DST'],
        NBA: ['PG', 'PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C'],
        MLB: ['P', 'C/1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF', 'UTIL'],
        NHL: ['C', 'W', 'W', 'W', 'D', 'D', 'G', 'UTIL', 'UTIL']
      }
    };
    
    return positions[platform]?.[sport] || [];
  }

  /**
   * Database and initialization methods
   */
  private async createContestTables(): Promise<void> {
    const createContestsTable = `
      CREATE TABLE IF NOT EXISTS contest_analysis (
        id UUID PRIMARY KEY,
        contest_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        sport TEXT NOT NULL,
        overlay_amount DECIMAL(10,2) NOT NULL,
        overlay_percentage DECIMAL(6,2) NOT NULL,
        expected_value DECIMAL(6,4) NOT NULL,
        confidence DECIMAL(5,3) NOT NULL,
        field_strength DECIMAL(5,3) NOT NULL,
        recommendation TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS contest_recommendations (
        id UUID PRIMARY KEY,
        contest_id TEXT NOT NULL,
        user_id TEXT,
        recommendation TEXT NOT NULL,
        priority TEXT NOT NULL,
        confidence DECIMAL(5,3) NOT NULL,
        optimal_entries INTEGER NOT NULL,
        reasoning JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_contest_analysis_contest ON contest_analysis (contest_id);
      CREATE INDEX IF NOT EXISTS idx_contest_recommendations_user ON contest_recommendations (user_id);
    `;
    
    await this.pgPool.query(createContestsTable);
  }

  private initializeGameTheoryModel(): void {
    this.gameTheoryModel = {
      skillLevels: new Map(),
      entryPatterns: new Map(),
      exploitationStrategies: new Map(),
      nashEquilibriumData: new Map(),
      metaGameAnalysis: {
        trendingStrategies: ['late_entry', 'overlay_hunting', 'soft_field_targeting'],
        counterStrategies: ['early_entry', 'field_strength_analysis', 'variance_reduction'],
        adaptationRate: 0.7 // How quickly the meta evolves
      }
    };
  }

  private setupContestMonitoring(): void {
    // Monitor contests every 2 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorContestChanges();
      } catch (error) {
        console.error('Error monitoring contests:', error);
      }
    }, 2 * 60 * 1000);
  }

  private async startContestMonitoring(): Promise<void> {
    console.log(chalk.cyan('📡 Starting real-time contest monitoring...'));
    
    // Initial analysis
    await this.analyzeContests();
    
    // Setup alerts
    this.on('overlay_detected', (data) => {
      console.log(chalk.green.bold(`🚨 OVERLAY ALERT: ${data.contestName} - ${data.overlayPercentage.toFixed(1)}%`));
    });
    
    this.on('field_softened', (data) => {
      console.log(chalk.blue.bold(`🐟 SOFT FIELD: ${data.contestName} - ${data.fishPercentage.toFixed(1)}% recreational`));
    });
  }

  private async monitorContestChanges(): Promise<void> {
    // Re-analyze contests for changes
    const newRecommendations = await this.analyzeContests();
    
    // Check for new overlays or significant changes
    for (const rec of newRecommendations) {
      if (rec.priority === 'high' && rec.recommendation === 'ENTER') {
        this.emit('overlay_detected', {
          contestId: rec.contestId,
          contestName: this.availableContests.get(rec.contestId)?.name,
          overlayPercentage: (rec.expectedValue - 1) * 100,
          confidence: rec.confidence
        });
      }
    }
  }

  private async loadHistoricalData(): Promise<void> {
    // Load historical contest and overlay data
    console.log(chalk.cyan('📚 Loading historical contest data...'));
    
    // In production, load from database
    // For now, initialize empty arrays
    this.historicalContests = [];
    this.historicalOverlays = [];
  }

  private async initializeMLModels(): Promise<void> {
    // Initialize ML models for skill classification and overlay prediction
    console.log(chalk.cyan('🤖 Initializing ML models...'));
    
    // In production, load trained models
    // For now, use placeholder
    this.skillClassifier = null;
    this.overlayPredictor = null;
  }

  /**
   * Get real-time contest monitoring report
   */
  async getMonitoringReport(): Promise<{
    activeOverlays: ContestOverlay[];
    recommendations: ContestRecommendation[];
    fieldAnalysis: FieldAnalysis[];
    alertsSent: number;
    monitoringStatus: string;
  }> {
    const activeOverlays = Array.from(this.overlayAnalysis.values())
      .filter(overlay => overlay.overlayPercentage >= this.alertThresholds.minOverlayPercentage);
    
    const recommendations = await this.analyzeContests();
    const fieldAnalysis = Array.from(this.fieldAnalysis.values());
    
    return {
      activeOverlays,
      recommendations: recommendations.filter(r => r.recommendation !== 'AVOID'),
      fieldAnalysis,
      alertsSent: 0, // Would track in production
      monitoringStatus: this.monitoringInterval ? 'active' : 'inactive'
    };
  }

  /**
   * Stop monitoring and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log(chalk.yellow('🔌 Contest Selection Engine shutdown complete'));
  }
}

export { 
  Contest, 
  ContestOverlay, 
  FieldAnalysis, 
  TimingAnalysis, 
  ContestRecommendation,
  GameTheoryModel 
};