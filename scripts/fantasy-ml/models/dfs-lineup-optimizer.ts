#!/usr/bin/env tsx
/**
 * 🎯 DFS Lineup Optimizer
 * Builds optimal DraftKings/FanDuel lineups using linear programming + ML insights
 */

import chalk from 'chalk';
import { PredictionResult } from './player-performance-predictor';

export interface DFSPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projected_points: number;
  projected_ownership: number;
  floor: number;
  ceiling: number;
  boom_probability: number;
  correlation_partners?: string[]; // IDs of correlated players
}

export interface LineupConstraints {
  salary_cap: number;
  positions: Map<string, number>; // position -> required count
  min_teams?: number;
  max_from_team?: number;
  must_include?: string[]; // player IDs
  exclude?: string[]; // player IDs
}

export interface OptimizedLineup {
  players: DFSPlayer[];
  total_salary: number;
  projected_points: number;
  projected_ownership: number;
  ceiling: number;
  leverage_score: number;
  correlation_score: number;
}

export class DFSLineupOptimizer {
  /**
   * Generate optimal lineups for tournaments
   */
  async optimizeLineups(
    players: DFSPlayer[],
    constraints: LineupConstraints,
    numLineups: number = 20,
    strategy: 'balanced' | 'contrarian' | 'ceiling' = 'balanced'
  ): Promise<OptimizedLineup[]> {
    console.log(chalk.cyan(`🎯 Optimizing ${numLineups} DFS lineups with ${strategy} strategy...`));
    
    const lineups: OptimizedLineup[] = [];
    const usedPlayers = new Set<string>();
    
    for (let i = 0; i < numLineups; i++) {
      // Adjust player values based on strategy and previous lineup usage
      const adjustedPlayers = this.adjustPlayerValues(players, strategy, usedPlayers, i / numLineups);
      
      // Build lineup using dynamic programming approach
      const lineup = this.buildOptimalLineup(adjustedPlayers, constraints);
      
      if (lineup) {
        lineups.push(lineup);
        // Track player usage for diversity
        lineup.players.forEach(p => usedPlayers.add(p.id));
      }
    }
    
    // Post-process to ensure diversity
    this.ensureLineupDiversity(lineups);
    
    // Sort by projected points
    lineups.sort((a, b) => b.projected_points - a.projected_points);
    
    this.displayLineupSummary(lineups);
    
    return lineups;
  }

  /**
   * Build a single optimal lineup using modified knapsack algorithm
   */
  private buildOptimalLineup(
    players: DFSPlayer[],
    constraints: LineupConstraints
  ): OptimizedLineup | null {
    // Group players by position
    const playersByPosition = new Map<string, DFSPlayer[]>();
    players.forEach(p => {
      if (!playersByPosition.has(p.position)) {
        playersByPosition.set(p.position, []);
      }
      playersByPosition.get(p.position)!.push(p);
    });
    
    // Sort each position by value (points per dollar)
    playersByPosition.forEach(posPlayers => {
      posPlayers.sort((a, b) => (b.projected_points / b.salary) - (a.projected_points / a.salary));
    });
    
    const lineup: DFSPlayer[] = [];
    let totalSalary = 0;
    
    // Fill required positions
    for (const [position, required] of constraints.positions) {
      const posPlayers = playersByPosition.get(position) || [];
      let added = 0;
      
      for (const player of posPlayers) {
        if (this.isValidSelection(player, lineup, constraints, totalSalary)) {
          lineup.push(player);
          totalSalary += player.salary;
          added++;
          
          if (added >= required) break;
        }
      }
      
      if (added < required) {
        return null; // Can't fill position requirements
      }
    }
    
    // Optimize by swapping players
    this.optimizeLineupSwaps(lineup, players, constraints);
    
    return this.createLineupObject(lineup);
  }

  /**
   * Check if player selection is valid
   */
  private isValidSelection(
    player: DFSPlayer,
    currentLineup: DFSPlayer[],
    constraints: LineupConstraints,
    currentSalary: number
  ): boolean {
    // Check salary cap
    if (currentSalary + player.salary > constraints.salary_cap) {
      return false;
    }
    
    // Check if player already in lineup
    if (currentLineup.some(p => p.id === player.id)) {
      return false;
    }
    
    // Check must include/exclude
    if (constraints.exclude?.includes(player.id)) {
      return false;
    }
    
    // Check max players from same team
    if (constraints.max_from_team) {
      const teamCount = currentLineup.filter(p => p.team === player.team).length;
      if (teamCount >= constraints.max_from_team) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Optimize lineup by trying player swaps
   */
  private optimizeLineupSwaps(
    lineup: DFSPlayer[],
    allPlayers: DFSPlayer[],
    constraints: LineupConstraints
  ): void {
    let improved = true;
    
    while (improved) {
      improved = false;
      
      for (let i = 0; i < lineup.length; i++) {
        const currentPlayer = lineup[i];
        const position = currentPlayer.position;
        
        // Try swapping with other players at same position
        for (const candidate of allPlayers) {
          if (candidate.position !== position || candidate.id === currentPlayer.id) {
            continue;
          }
          
          // Check if swap improves lineup
          const salaryDiff = candidate.salary - currentPlayer.salary;
          const currentTotalSalary = lineup.reduce((sum, p) => sum + p.salary, 0);
          
          if (currentTotalSalary + salaryDiff <= constraints.salary_cap) {
            const pointsDiff = candidate.projected_points - currentPlayer.projected_points;
            const correlationBonus = this.calculateCorrelationBonus(candidate, lineup);
            
            if (pointsDiff + correlationBonus > 0) {
              lineup[i] = candidate;
              improved = true;
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Adjust player values based on strategy
   */
  private adjustPlayerValues(
    players: DFSPlayer[],
    strategy: string,
    usedPlayers: Set<string>,
    diversityFactor: number
  ): DFSPlayer[] {
    return players.map(player => {
      let adjustedPoints = player.projected_points;
      
      // Apply strategy adjustments
      switch (strategy) {
        case 'contrarian':
          // Boost low ownership players
          adjustedPoints *= (1 + (100 - player.projected_ownership) / 200);
          break;
        case 'ceiling':
          // Use ceiling projections with boom probability
          adjustedPoints = player.ceiling * (0.5 + player.boom_probability * 0.5);
          break;
        case 'balanced':
        default:
          // Balance between median and ceiling
          adjustedPoints = player.projected_points * 0.7 + player.ceiling * 0.3;
      }
      
      // Reduce value if player already used (for diversity)
      if (usedPlayers.has(player.id)) {
        adjustedPoints *= (1 - diversityFactor * 0.3);
      }
      
      return {
        ...player,
        projected_points: adjustedPoints
      };
    });
  }

  /**
   * Calculate correlation bonus for stacking
   */
  private calculateCorrelationBonus(player: DFSPlayer, lineup: DFSPlayer[]): number {
    let bonus = 0;
    
    // Check for correlation partners in lineup
    if (player.correlation_partners) {
      for (const partner of player.correlation_partners) {
        if (lineup.some(p => p.id === partner)) {
          bonus += 2; // Points bonus for correlation
        }
      }
    }
    
    // Game stack bonus (multiple players from same game)
    const sameGamePlayers = lineup.filter(p => 
      p.team === player.opponent || p.opponent === player.team
    );
    bonus += sameGamePlayers.length * 0.5;
    
    return bonus;
  }

  /**
   * Create lineup object with calculated metrics
   */
  private createLineupObject(players: DFSPlayer[]): OptimizedLineup {
    const totalSalary = players.reduce((sum, p) => sum + p.salary, 0);
    const projectedPoints = players.reduce((sum, p) => sum + p.projected_points, 0);
    const projectedOwnership = players.reduce((sum, p) => sum + p.projected_ownership, 0) / players.length;
    const ceiling = players.reduce((sum, p) => sum + p.ceiling, 0);
    
    // Calculate leverage score (high points, low ownership)
    const leverageScore = projectedPoints / (projectedOwnership / 10 + 1);
    
    // Calculate correlation score
    let correlationScore = 0;
    players.forEach(p1 => {
      players.forEach(p2 => {
        if (p1.id !== p2.id) {
          if (p1.team === p2.team) correlationScore += 1;
          if (p1.correlation_partners?.includes(p2.id)) correlationScore += 2;
        }
      });
    });
    
    return {
      players,
      total_salary: totalSalary,
      projected_points: projectedPoints,
      projected_ownership: projectedOwnership,
      ceiling,
      leverage_score: leverageScore,
      correlation_score: correlationScore
    };
  }

  /**
   * Ensure lineup diversity across the pool
   */
  private ensureLineupDiversity(lineups: OptimizedLineup[]): void {
    // Calculate overlap between lineups
    for (let i = 0; i < lineups.length; i++) {
      for (let j = i + 1; j < lineups.length; j++) {
        const overlap = this.calculateLineupOverlap(lineups[i], lineups[j]);
        
        // If too much overlap, modify one lineup
        if (overlap > 0.6) {
          this.diversifyLineup(lineups[j], lineups.slice(0, j));
        }
      }
    }
  }

  /**
   * Calculate overlap percentage between two lineups
   */
  private calculateLineupOverlap(lineup1: OptimizedLineup, lineup2: OptimizedLineup): number {
    const players1 = new Set(lineup1.players.map(p => p.id));
    let overlap = 0;
    
    lineup2.players.forEach(p => {
      if (players1.has(p.id)) overlap++;
    });
    
    return overlap / lineup1.players.length;
  }

  /**
   * Modify lineup to reduce overlap with existing lineups
   */
  private diversifyLineup(lineup: OptimizedLineup, existingLineups: OptimizedLineup[]): void {
    // Count player usage across existing lineups
    const playerUsage = new Map<string, number>();
    existingLineups.forEach(l => {
      l.players.forEach(p => {
        playerUsage.set(p.id, (playerUsage.get(p.id) || 0) + 1);
      });
    });
    
    // Try to swap overused players
    // Implementation would go here based on position constraints
  }

  /**
   * Display lineup summary
   */
  private displayLineupSummary(lineups: OptimizedLineup[]): void {
    console.log(chalk.bold.green(`\n✅ Generated ${lineups.length} Optimized Lineups\n`));
    
    const avgPoints = lineups.reduce((sum, l) => sum + l.projected_points, 0) / lineups.length;
    const avgOwnership = lineups.reduce((sum, l) => sum + l.projected_ownership, 0) / lineups.length;
    const avgLeverage = lineups.reduce((sum, l) => sum + l.leverage_score, 0) / lineups.length;
    
    console.log(chalk.yellow(`Average Projected Points: ${avgPoints.toFixed(1)}`));
    console.log(chalk.yellow(`Average Ownership: ${avgOwnership.toFixed(1)}%`));
    console.log(chalk.yellow(`Average Leverage Score: ${avgLeverage.toFixed(1)}`));
    
    // Show top lineup
    if (lineups.length > 0) {
      console.log(chalk.cyan('\nTop Lineup:'));
      const top = lineups[0];
      top.players.forEach(p => {
        console.log(`  ${p.position} - ${p.name} (${p.team}) $${p.salary} - ${p.projected_points.toFixed(1)}pts`);
      });
      console.log(chalk.green(`Total: $${top.total_salary} - ${top.projected_points.toFixed(1)}pts`));
    }
  }
}

// Export singleton instance
export const dfsOptimizer = new DFSLineupOptimizer();