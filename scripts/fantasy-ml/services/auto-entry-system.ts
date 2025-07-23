#!/usr/bin/env tsx
/**
 * 🤖 AUTO-ENTRY SYSTEM FOR DFS
 * 
 * Automatically enters optimized lineups into contests
 * Features:
 * - Smart contest selection
 * - Bankroll management
 * - Late swap automation
 * - News reaction system
 * - Sharp money tracking
 */

import chalk from 'chalk';
import { EventEmitter } from 'events';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { join } from 'path';
import { dfsConnector, DFSPlatformConnector } from './dfs-platform-connector';
import { ownershipScraper, OwnershipScraper } from './ownership-scraper';
import { MLDFSOptimizer } from './ml-dfs-optimizer';
import { PredictionService } from './prediction-service';
import { CacheService } from './cache-service';

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env.local') });

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL_LOCAL ? false : { rejectUnauthorized: false }
});

interface AutoEntryConfig {
  platforms: ('draftkings' | 'fanduel')[];
  sports: string[];
  bankroll: number;
  maxExposure: number; // Max % of bankroll per contest
  contestTypes: ('gpp' | 'cash' | 'h2h')[];
  strategies: {
    gpp: 'balanced' | 'contrarian' | 'ceiling';
    cash: 'floor' | 'balanced';
  };
  autoSwap: boolean;
  newsReaction: boolean;
}

interface EntryResult {
  contestId: string;
  platform: string;
  lineups: number;
  totalCost: number;
  success: boolean;
  error?: string;
}

export class AutoEntrySystem extends EventEmitter {
  private config: AutoEntryConfig;
  private optimizer: MLDFSOptimizer;
  private predictionService: PredictionService;
  private cacheService: CacheService;
  private isRunning = false;
  private entryHistory: EntryResult[] = [];
  
  constructor(config: AutoEntryConfig) {
    super();
    this.config = config;
    this.predictionService = new PredictionService(pgPool);
    this.cacheService = new CacheService();
    this.optimizer = new MLDFSOptimizer(pgPool, this.predictionService);
  }

  /**
   * Start auto-entry system
   */
  async start() {
    console.log(chalk.bold.cyan('🤖 AUTO-ENTRY SYSTEM STARTING...'));
    console.log(chalk.yellow(`💰 Bankroll: $${this.config.bankroll.toLocaleString()}`));
    console.log(chalk.yellow(`📊 Max Exposure: ${this.config.maxExposure}%`));
    
    this.isRunning = true;
    
    // Initialize services
    await this.cacheService.initialize();
    await dfsConnector.initialize();
    await ownershipScraper.initialize();
    
    // Start monitoring loop
    while (this.isRunning) {
      try {
        await this.runEntryLoop();
        
        // Wait 5 minutes before next check
        await new Promise(resolve => setTimeout(resolve, 300000));
      } catch (error) {
        console.error(chalk.red('❌ Entry loop error:'), error);
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
      }
    }
  }

  /**
   * Run one iteration of the entry loop
   */
  private async runEntryLoop() {
    console.log(chalk.cyan(`\n⏰ Running entry check at ${new Date().toLocaleTimeString()}...`));
    
    // Get available contests
    const contests = await this.findOptimalContests();
    
    if (contests.length === 0) {
      console.log(chalk.gray('No suitable contests found'));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${contests.length} suitable contests`));
    
    // Process each contest
    for (const contest of contests) {
      await this.processContest(contest);
    }
    
    // Check for late swap opportunities
    if (this.config.autoSwap) {
      await this.checkLateSwaps();
    }
  }

  /**
   * Find optimal contests based on criteria
   */
  private async findOptimalContests(): Promise<any[]> {
    const allContests: any[] = [];
    
    // Get contests from each platform
    for (const platform of this.config.platforms) {
      for (const sport of this.config.sports) {
        const contests = await dfsConnector.getContests(sport, platform);
        allContests.push(...contests);
      }
    }
    
    // Filter based on criteria
    const maxEntryAmount = this.config.bankroll * (this.config.maxExposure / 100);
    
    return allContests.filter(contest => {
      // Check contest type
      if (!this.config.contestTypes.includes(contest.contestType)) {
        return false;
      }
      
      // Check if we can afford it
      if (contest.entryFee > maxEntryAmount) {
        return false;
      }
      
      // Check start time (must be at least 30 minutes away)
      const minutesUntilStart = (contest.startTime.getTime() - Date.now()) / 60000;
      if (minutesUntilStart < 30) {
        return false;
      }
      
      // Check overlay potential (unfilled contests)
      const fillRate = contest.currentEntries / contest.maxEntries;
      if (contest.contestType === 'gpp' && fillRate > 0.95) {
        return false; // Skip nearly full GPPs
      }
      
      return true;
    });
  }

  /**
   * Process a single contest
   */
  private async processContest(contest: any) {
    console.log(chalk.cyan(`\n🎯 Processing: ${contest.name}`));
    console.log(chalk.gray(`  Platform: ${contest.platform}`));
    console.log(chalk.gray(`  Entry Fee: $${contest.entryFee}`));
    console.log(chalk.gray(`  Prize Pool: $${contest.totalPrize.toLocaleString()}`));
    
    try {
      // Get player pool
      const players = await dfsConnector.getPlayerPool(contest.id, contest.platform);
      
      // Get current ownership
      const ownershipMap = await ownershipScraper.getLatestOwnership(contest.id);
      
      // Update players with ownership
      players.forEach(player => {
        player.actualOwnership = ownershipMap.get(player.id) || player.projectedOwnership;
      });
      
      // Determine number of lineups
      const numLineups = this.calculateOptimalLineups(contest);
      
      // Generate optimized lineups
      const lineups = await this.optimizer.optimizeLineups({
        sport: contest.sport,
        game_date: contest.startTime,
        platform: contest.platform,
        contest_type: contest.contestType,
        num_lineups: numLineups,
        salary_cap: contest.salaryCap,
        roster_positions: this.getRosterPositions(contest.sport, contest.platform),
        strategy: this.config.strategies[contest.contestType] || 'balanced',
        constraints: {
          max_exposure: 0.3, // 30% max exposure per player
          min_teams: 3,
          max_from_team: contest.sport === 'NFL' ? 4 : 3
        }
      });
      
      console.log(chalk.green(`  ✅ Generated ${lineups.length} optimized lineups`));
      
      // Show top lineup
      if (lineups.length > 0) {
        const topLineup = lineups[0];
        console.log(chalk.yellow('  🏆 Top Lineup:'));
        topLineup.players.forEach(p => {
          console.log(chalk.gray(`    ${p.position} ${p.name}: $${p.salary} (${p.projected_ownership?.toFixed(1)}% owned)`));
        });
        console.log(chalk.green(`    Projected: ${topLineup.projected_points.toFixed(1)} pts`));
        console.log(chalk.green(`    Leverage: ${topLineup.leverage_score.toFixed(2)}x`));
      }
      
      // Enter the contest
      const success = await dfsConnector.enterContest(
        contest.id,
        lineups.map(l => ({
          contestId: contest.id,
          players: l.players,
          totalSalary: l.total_salary,
          projectedPoints: l.projected_points
        })),
        contest.platform
      );
      
      // Record result
      const result: EntryResult = {
        contestId: contest.id,
        platform: contest.platform,
        lineups: lineups.length,
        totalCost: contest.entryFee * lineups.length,
        success
      };
      
      this.entryHistory.push(result);
      
      if (success) {
        console.log(chalk.bold.green(`  💰 ENTERED ${lineups.length} lineups! Total: $${result.totalCost}`));
        
        // Update bankroll
        this.config.bankroll -= result.totalCost;
        console.log(chalk.yellow(`  💵 Remaining bankroll: $${this.config.bankroll.toLocaleString()}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`  ❌ Error processing contest:`), error);
    }
  }

  /**
   * Calculate optimal number of lineups
   */
  private calculateOptimalLineups(contest: any): number {
    const maxSpend = this.config.bankroll * (this.config.maxExposure / 100);
    const maxLineups = Math.floor(maxSpend / contest.entryFee);
    
    // Contest type specific logic
    if (contest.contestType === 'cash') {
      return 1; // Single lineup for cash games
    }
    
    if (contest.contestType === 'gpp') {
      // More lineups for larger fields
      const fieldSize = contest.maxEntries;
      if (fieldSize > 100000) return Math.min(150, maxLineups);
      if (fieldSize > 50000) return Math.min(100, maxLineups);
      if (fieldSize > 10000) return Math.min(50, maxLineups);
      return Math.min(20, maxLineups);
    }
    
    return Math.min(3, maxLineups); // Default
  }

  /**
   * Check for late swap opportunities
   */
  private async checkLateSwaps() {
    console.log(chalk.cyan('\n🔄 Checking late swap opportunities...'));
    
    // Get active lineups
    const activeLineups = await this.getActiveLineups();
    
    for (const lineup of activeLineups) {
      // Check for injured players
      const injuredPlayers = lineup.players.filter(p => p.injuryStatus === 'OUT');
      
      if (injuredPlayers.length > 0) {
        console.log(chalk.red(`  ⚠️  Found ${injuredPlayers.length} injured players in lineup ${lineup.id}`));
        
        for (const injured of injuredPlayers) {
          // Find replacement
          const replacement = await this.findReplacement(injured, lineup);
          
          if (replacement) {
            const success = await dfsConnector.lateSwap(
              lineup.contestId,
              lineup.id!,
              injured.id,
              replacement.id,
              lineup.platform as any
            );
            
            if (success) {
              console.log(chalk.green(`    ✅ Swapped ${injured.name} → ${replacement.name}`));
            }
          }
        }
      }
    }
  }

  /**
   * Get active lineups (mock implementation)
   */
  private async getActiveLineups(): Promise<any[]> {
    // In production, fetch from database or API
    return [];
  }

  /**
   * Find replacement player
   */
  private async findReplacement(injured: any, lineup: any): Promise<any | null> {
    // In production, use optimizer to find best replacement
    return null;
  }

  /**
   * Get roster positions by sport and platform
   */
  private getRosterPositions(sport: string, platform: string): string[] {
    const positions: Record<string, Record<string, string[]>> = {
      NFL: {
        draftkings: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST'],
        fanduel: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DEF']
      },
      NBA: {
        draftkings: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'],
        fanduel: ['PG', 'PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C']
      },
      MLB: {
        draftkings: ['P', 'P', 'C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'],
        fanduel: ['P', 'C/1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF', 'UTIL']
      }
    };
    
    return positions[sport]?.[platform] || [];
  }

  /**
   * Stop auto-entry system
   */
  async stop() {
    console.log(chalk.yellow('\n🛑 Stopping auto-entry system...'));
    this.isRunning = false;
    
    // Show summary
    console.log(chalk.cyan('\n📊 Entry Summary:'));
    console.log(chalk.gray(`  Total contests entered: ${this.entryHistory.length}`));
    
    const totalSpent = this.entryHistory.reduce((sum, r) => sum + r.totalCost, 0);
    console.log(chalk.gray(`  Total spent: $${totalSpent.toLocaleString()}`));
    
    const totalLineups = this.entryHistory.reduce((sum, r) => sum + r.lineups, 0);
    console.log(chalk.gray(`  Total lineups: ${totalLineups}`));
    
    await pgPool.end();
  }
}

// Run if called directly
if (require.main === module) {
  async function demo() {
    console.log(chalk.bold.magenta('🤖 AUTO-ENTRY SYSTEM DEMO\n'));
    
    const config: AutoEntryConfig = {
      platforms: ['draftkings', 'fanduel'],
      sports: ['NFL', 'NBA'],
      bankroll: 1000,
      maxExposure: 10, // 10% max per contest
      contestTypes: ['gpp', 'cash'],
      strategies: {
        gpp: 'contrarian',
        cash: 'floor'
      },
      autoSwap: true,
      newsReaction: true
    };
    
    const autoEntry = new AutoEntrySystem(config);
    
    // Run for demo (will stop after first loop)
    setTimeout(() => autoEntry.stop(), 15000);
    
    await autoEntry.start();
  }
  
  demo().catch(console.error);
}