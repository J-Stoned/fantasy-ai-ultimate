/**
 * GPU-POWERED DFS LINEUP OPTIMIZER
 * The most powerful lineup optimizer ever built for daily fantasy
 * Uses your GPU to process MILLIONS of combinations in seconds
 * 
 * By Marcus "The Fixer" Rodriguez
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { ProductionGPUOptimizer } from '../gpu/ProductionGPUOptimizer';

export interface DFSPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projectedPoints: number;
  ownership: number;
  ceiling: number;
  floor: number;
  correlation: Map<string, number>;
}

export interface DFSContest {
  site: 'draftkings' | 'fanduel' | 'yahoo';
  type: 'gpp' | 'cash' | '50-50' | 'h2h';
  entryFee: number;
  totalPrize: number;
  entries: number;
  salaryCap: number;
  rosterRequirements: {
    [position: string]: number;
  };
}

export interface OptimizationSettings {
  minSalaryUsed: number;
  maxSalaryUsed: number;
  minProjectedPoints: number;
  uniqueLineups: number;
  correlationWeight: number;
  ownershipWeight: number;
  ceilingWeight: number;
  lockedPlayers: string[];
  excludedPlayers: string[];
  teamStacks: {
    team: string;
    minPlayers: number;
    maxPlayers: number;
  }[];
  globalExposure: Map<string, number>;
}

export interface DFSLineup {
  players: DFSPlayer[];
  totalSalary: number;
  totalProjected: number;
  totalOwnership: number;
  score: number;
}

export class GPULineupOptimizer {
  private gpuOptimizer: ProductionGPUOptimizer;
  private tensorflowReady = false;
  private playerCache: Map<string, DFSPlayer> = new Map();
  
  constructor() {
    // Use REAL GPU acceleration with RTX 4060 CUDA cores
    this.gpuOptimizer = new ProductionGPUOptimizer();
    this.initializeTensorFlow();
  }
  
  /**
   * Initialize TensorFlow with GPU backend (CUDA for Node.js)
   */
  private async initializeTensorFlow() {
    try {
      // Initialize real GPU backend
      await this.gpuOptimizer.initialize();
      await tf.ready();
      
      // Warm up the GPU
      const warmup = tf.zeros([100, 100]);
      warmup.square().dispose();
      warmup.dispose();
      
      this.tensorflowReady = true;
      console.log('🚀 GPU acceleration ready! Using:', tf.getBackend());
    } catch (error) {
      console.warn('WebGPU not available, falling back to WebGL');
      await tf.setBackend('webgl');
      this.tensorflowReady = true;
    }
  }
  
  /**
   * Generate optimized lineups using GPU acceleration
   */
  async generateLineups(
    players: DFSPlayer[],
    contest: DFSContest,
    settings: OptimizationSettings
  ): Promise<DFSLineup[]> {
    // Wait for TensorFlow
    while (!this.tensorflowReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Cache players for quick lookup
    players.forEach(p => this.playerCache.set(p.id, p));
    
    // Generate player combinations on GPU
    const combinations = await this.generateCombinationsGPU(
      players,
      contest,
      settings
    );
    
    // Score and rank lineups
    const scoredLineups = await this.scoreLineupsGPU(
      combinations,
      contest,
      settings
    );
    
    // Apply correlation and stacking rules
    const optimizedLineups = await this.applyAdvancedRules(
      scoredLineups,
      settings
    );
    
    // Ensure uniqueness
    const uniqueLineups = this.ensureUniqueness(
      optimizedLineups,
      settings.uniqueLineups
    );
    
    return uniqueLineups;
  }
  
  /**
   * Generate all valid player combinations using GPU
   */
  private async generateCombinationsGPU(
    players: DFSPlayer[],
    contest: DFSContest,
    settings: OptimizationSettings
  ): Promise<string[][]> {
    // Use the Production GPU Optimizer for REAL CUDA acceleration
    const formattedPlayers = players.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      team: p.team,
      salary: p.salary,
      projectedPoints: p.projectedPoints,
      ownership: p.ownership,
      ceiling: p.ceiling,
      floor: p.floor
    }));

    // Generate lineups using RTX 4060 CUDA cores
    const optimizedLineups = await this.gpuOptimizer.optimizeLineups({
      players: formattedPlayers,
      salaryCap: contest.salaryCap,
      rosterPositions: Object.entries(contest.rosterRequirements).flatMap(
        ([pos, count]) => Array(count).fill(pos)
      ),
      constraints: {
        minSalary: settings.minSalaryUsed,
        maxExposure: settings.globalExposure.size > 0 ? 
          Math.max(...settings.globalExposure.values()) : 1.0,
        lockPlayers: settings.lockedPlayers,
        excludePlayers: settings.excludedPlayers
      },
      numLineups: settings.uniqueLineups * 2 // Generate extra for filtering
    });
    
    // Convert back to player ID arrays
    return optimizedLineups.map(lineup => 
      lineup.players.map(p => p.id)
    );
  }
  
  /**
   * Score lineups using GPU-accelerated matrix operations
   */
  private async scoreLineupsGPU(
    lineups: string[][],
    contest: DFSContest,
    settings: OptimizationSettings
  ): Promise<ScoredLineup[]> {
    // Convert lineups to tensors
    const lineupMatrix = lineups.map(lineup =>
      lineup.map(playerId => {
        const player = this.playerCache.get(playerId)!;
        return [
          player.projectedPoints,
          player.ownership,
          player.ceiling,
          player.floor,
          player.salary
        ];
      })
    );
    
    // Create tensors
    const lineupTensor = tf.tensor3d(lineupMatrix);
    
    // Calculate scores using GPU
    const scores = tf.tidy(() => {
      // Base score from projections
      const projections = lineupTensor.slice([0, 0, 0], [-1, -1, 1]).sum([1, 2]);
      
      // Ceiling scores for GPPs
      const ceilings = lineupTensor.slice([0, 0, 2], [-1, -1, 1]).sum([1, 2]);
      
      // Ownership scores (lower is better for GPPs)
      const ownerships = lineupTensor.slice([0, 0, 1], [-1, -1, 1]).mean([1, 2]);
      
      // Combine scores based on contest type
      if (contest.type === 'gpp') {
        return projections
          .mul(1 - settings.ownershipWeight)
          .add(ceilings.mul(settings.ceilingWeight))
          .sub(ownerships.mul(settings.ownershipWeight));
      } else {
        // Cash games - focus on floor
        const floors = lineupTensor.slice([0, 0, 3], [-1, -1, 1]).sum([1, 2]);
        return projections.mul(0.7).add(floors.mul(0.3));
      }
    });
    
    // Get scores from GPU
    const scoresArray = await scores.array();
    
    // Clean up tensors
    lineupTensor.dispose();
    scores.dispose();
    
    // Create scored lineup objects
    return lineups.map((lineup, idx) => ({
      playerIds: lineup,
      score: scoresArray[idx] as number,
      projectedPoints: this.calculateProjectedPoints(lineup),
      totalSalary: this.calculateTotalSalary(lineup),
      ownership: this.calculateAverageOwnership(lineup)
    }));
  }
  
  /**
   * Apply advanced correlation and stacking rules
   */
  private async applyAdvancedRules(
    lineups: ScoredLineup[],
    settings: OptimizationSettings
  ): Promise<ScoredLineup[]> {
    return lineups.map(lineup => {
      let bonusScore = 0;
      
      // Apply team stack bonuses
      const teamCounts = this.getTeamCounts(lineup.playerIds);
      settings.teamStacks.forEach(stack => {
        const count = teamCounts.get(stack.team) || 0;
        if (count >= stack.minPlayers && count <= stack.maxPlayers) {
          bonusScore += 10 * count; // Bonus for stacking
        }
      });
      
      // Apply correlation bonuses
      bonusScore += this.calculateCorrelationScore(lineup.playerIds);
      
      // Apply bring-back bonuses (opposing team player)
      bonusScore += this.calculateBringBackBonus(lineup.playerIds);
      
      return {
        ...lineup,
        score: lineup.score + bonusScore
      };
    });
  }
  
  /**
   * Ensure lineup uniqueness
   */
  private ensureUniqueness(
    lineups: ScoredLineup[],
    targetCount: number
  ): DFSLineup[] {
    // Sort by score
    lineups.sort((a, b) => b.score - a.score);
    
    const unique: DFSLineup[] = [];
    const seen = new Set<string>();
    
    for (const lineup of lineups) {
      // Create lineup signature
      const signature = [...lineup.playerIds].sort().join('-');
      
      if (!seen.has(signature)) {
        seen.add(signature);
        
        // Convert to full lineup object
        unique.push({
          players: lineup.playerIds.map(id => this.playerCache.get(id)!),
          totalSalary: lineup.totalSalary,
          projectedPoints: lineup.projectedPoints,
          ownership: lineup.ownership,
          score: lineup.score,
          stackInfo: this.getStackInfo(lineup.playerIds),
          id: this.generateLineupId()
        });
        
        if (unique.length >= targetCount) break;
      }
    }
    
    return unique;
  }
  
  /**
   * Group players by position
   */
  private groupByPosition(players: DFSPlayer[]): Record<string, DFSPlayer[]> {
    const groups: Record<string, DFSPlayer[]> = {};
    
    players.forEach(player => {
      if (!groups[player.position]) {
        groups[player.position] = [];
      }
      groups[player.position].push(player);
    });
    
    return groups;
  }
  
  /**
   * Calculate correlation score for lineup
   */
  private calculateCorrelationScore(playerIds: string[]): number {
    let score = 0;
    
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const p1 = this.playerCache.get(playerIds[i])!;
        const p2 = this.playerCache.get(playerIds[j])!;
        
        const correlation = p1.correlation.get(p2.id) || 0;
        score += correlation * 10;
      }
    }
    
    return score;
  }
  
  /**
   * Calculate bring-back bonus
   */
  private calculateBringBackBonus(playerIds: string[]): number {
    const teams = playerIds.map(id => this.playerCache.get(id)!.team);
    const opponents = playerIds.map(id => this.playerCache.get(id)!.opponent);
    
    let bonus = 0;
    teams.forEach(team => {
      if (opponents.includes(team)) {
        bonus += 5; // Bonus for game stack
      }
    });
    
    return bonus;
  }
  
  /**
   * Get team counts in lineup
   */
  private getTeamCounts(playerIds: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    
    playerIds.forEach(id => {
      const team = this.playerCache.get(id)!.team;
      counts.set(team, (counts.get(team) || 0) + 1);
    });
    
    return counts;
  }
  
  /**
   * Get stack information
   */
  private getStackInfo(playerIds: string[]): StackInfo {
    const teamCounts = this.getTeamCounts(playerIds);
    const maxStack = Math.max(...teamCounts.values());
    const stackTeam = [...teamCounts.entries()].find(([_, count]) => count === maxStack)?.[0] || '';
    
    return {
      primaryStack: stackTeam,
      stackSize: maxStack,
      hasBringBack: this.hasBringBack(playerIds, stackTeam)
    };
  }
  
  /**
   * Check if lineup has bring-back player
   */
  private hasBringBack(playerIds: string[], stackTeam: string): boolean {
    const stackOpponent = playerIds
      .map(id => this.playerCache.get(id)!)
      .find(p => p.team === stackTeam)?.opponent;
    
    return playerIds.some(id => {
      const player = this.playerCache.get(id)!;
      return player.team === stackOpponent;
    });
  }
  
  // Utility methods
  private getPlayerIndex(playerId: string): number {
    return parseInt(playerId.split('-')[1]);
  }
  
  private calculateProjectedPoints(playerIds: string[]): number {
    return playerIds.reduce((sum, id) => 
      sum + this.playerCache.get(id)!.projectedPoints, 0
    );
  }
  
  private calculateTotalSalary(playerIds: string[]): number {
    return playerIds.reduce((sum, id) => 
      sum + this.playerCache.get(id)!.salary, 0
    );
  }
  
  private calculateAverageOwnership(playerIds: string[]): number {
    const total = playerIds.reduce((sum, id) => 
      sum + this.playerCache.get(id)!.ownership, 0
    );
    return total / playerIds.length;
  }
  
  private generateLineupId(): string {
    return `lineup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Types
interface ScoredLineup {
  playerIds: string[];
  score: number;
  projectedPoints: number;
  totalSalary: number;
  ownership: number;
}

export interface DFSLineup {
  id: string;
  players: DFSPlayer[];
  totalSalary: number;
  projectedPoints: number;
  ownership: number;
  score: number;
  stackInfo: StackInfo;
}

interface StackInfo {
  primaryStack: string;
  stackSize: number;
  hasBringBack: boolean;
}