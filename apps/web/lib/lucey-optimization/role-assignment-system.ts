/**
 * 🎯 ROLE ASSIGNMENT SYSTEM - Dr. Lucey Style
 * Solves the "permutation problem" by tracking roles, not players
 * Handles 10! (3.6M) possible arrangements per game
 */

import * as tf from '@tensorflow/tfjs';
import munkres = require('munkres-js');

/**
 * Role definitions with performance expectations
 * Lucey: "Positions are fluid, roles are permanent"
 */
export interface RoleDefinition {
  id: string;
  expectedStats: {
    points: number;
    assists: number;
    rebounds?: number;
    yards?: number;
    touchdowns?: number;
    [key: string]: number | undefined;
  };
  spatialZone: [number, number, number, number]; // x1, y1, x2, y2
  importance: number; // 0-1 weight for optimization
}

/**
 * Player performance in role-agnostic format
 */
export interface PlayerPerformance {
  playerId: string;
  stats: Record<string, number>;
  position: [number, number]; // Current field/court position
  efficiency: number;
  momentum: number;
}

/**
 * Role Assignment Optimizer
 * Uses Hungarian algorithm with learned embeddings
 */
export class RoleAssignmentOptimizer {
  private roleEmbeddings: Map<string, tf.Tensor1D> = new Map();
  private transitionCosts: Map<string, number> = new Map();
  private historyBuffer: Array<Map<string, string>> = [];
  
  constructor(
    private sport: string,
    private roles: RoleDefinition[]
  ) {
    this.initializeRoleEmbeddings();
  }
  
  /**
   * Initialize role embeddings based on expected performance
   * Lucey: "Roles are defined by function, not title"
   */
  private initializeRoleEmbeddings(): void {
    this.roles.forEach(role => {
      // Create embedding from expected stats
      const embedding = tf.tensor1d([
        role.expectedStats.points || 0,
        role.expectedStats.assists || 0,
        role.expectedStats.rebounds || 0,
        role.expectedStats.yards || 0,
        role.expectedStats.touchdowns || 0,
        role.spatialZone[0], // x1
        role.spatialZone[1], // y1
        role.spatialZone[2], // x2
        role.spatialZone[3], // y2
        role.importance
      ]);
      
      this.roleEmbeddings.set(role.id, embedding);
    });
  }
  
  /**
   * Assign players to roles optimally
   * Solves in O(n³) instead of O(n!) 
   */
  async assignRoles(
    players: PlayerPerformance[],
    previousAssignment?: Map<string, string>
  ): Promise<Map<string, string>> {
    const startTime = performance.now();
    
    // Build cost matrix
    const costMatrix = await this.buildCostMatrix(players, previousAssignment);
    
    // Solve assignment problem
    const assignments = this.solveAssignment(costMatrix, players);
    
    // Update history for temporal consistency
    this.updateHistory(assignments);
    
    const elapsed = performance.now() - startTime;
    console.log(`Role assignment completed in ${elapsed.toFixed(2)}ms`);
    
    return assignments;
  }
  
  /**
   * Build cost matrix for Hungarian algorithm
   * Lower cost = better fit for role
   */
  private async buildCostMatrix(
    players: PlayerPerformance[],
    previousAssignment?: Map<string, string>
  ): Promise<number[][]> {
    const n = Math.max(players.length, this.roles.length);
    const costMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(1e6));
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerEmbedding = this.createPlayerEmbedding(player);
      
      for (let j = 0; j < this.roles.length; j++) {
        const role = this.roles[j];
        const roleEmbedding = this.roleEmbeddings.get(role.id)!;
        
        // Base cost: distance between embeddings
        let cost = this.embeddingDistance(playerEmbedding, roleEmbedding);
        
        // Spatial cost: distance from expected zone
        const spatialCost = this.calculateSpatialCost(player.position, role.spatialZone);
        cost += spatialCost * 0.3;
        
        // Performance cost: how well stats match expectations
        const performanceCost = this.calculatePerformanceCost(player.stats, role.expectedStats);
        cost += performanceCost * 0.5;
        
        // Temporal consistency cost (Lucey's insight)
        if (previousAssignment?.get(player.playerId) === role.id) {
          cost *= 0.7; // 30% bonus for maintaining assignment
        }
        
        // Importance weighting
        cost *= (2 - role.importance); // Higher importance = lower cost multiplier
        
        costMatrix[i][j] = cost;
      }
      
      playerEmbedding.dispose();
    }
    
    return costMatrix;
  }
  
  /**
   * Create embedding for player based on current performance
   */
  private createPlayerEmbedding(player: PlayerPerformance): tf.Tensor1D {
    return tf.tensor1d([
      player.stats.points || 0,
      player.stats.assists || 0,
      player.stats.rebounds || 0,
      player.stats.yards || 0,
      player.stats.touchdowns || 0,
      player.position[0],
      player.position[1],
      0, // Placeholder for zone x2
      0, // Placeholder for zone y2
      player.efficiency
    ]);
  }
  
  /**
   * Calculate embedding distance using cosine similarity
   */
  private embeddingDistance(a: tf.Tensor1D, b: tf.Tensor1D): number {
    const dotProduct = tf.sum(tf.mul(a, b));
    const normA = tf.norm(a);
    const normB = tf.norm(b);
    const cosineSimilarity = tf.div(dotProduct, tf.mul(normA, normB));
    
    // Convert to distance (0 = identical, 2 = opposite)
    const distance = tf.sub(1, cosineSimilarity).arraySync() as number;
    
    dotProduct.dispose();
    normA.dispose();
    normB.dispose();
    cosineSimilarity.dispose();
    
    return distance;
  }
  
  /**
   * Calculate spatial cost based on field/court position
   */
  private calculateSpatialCost(
    playerPos: [number, number],
    roleZone: [number, number, number, number]
  ): number {
    const [x, y] = playerPos;
    const [x1, y1, x2, y2] = roleZone;
    
    // Check if player is within role zone
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
      return 0; // No cost if in correct zone
    }
    
    // Calculate distance to nearest zone edge
    const dx = Math.max(0, Math.max(x1 - x, x - x2));
    const dy = Math.max(0, Math.max(y1 - y, y - y2));
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Calculate performance cost based on stat differences
   */
  private calculatePerformanceCost(
    playerStats: Record<string, number>,
    expectedStats: Record<string, number | undefined>
  ): number {
    let totalDiff = 0;
    let statCount = 0;
    
    for (const [stat, expected] of Object.entries(expectedStats)) {
      if (expected !== undefined) {
        const actual = playerStats[stat] || 0;
        const diff = Math.abs(actual - expected) / Math.max(expected, 1);
        totalDiff += diff;
        statCount++;
      }
    }
    
    return statCount > 0 ? totalDiff / statCount : 0;
  }
  
  /**
   * Solve assignment using Hungarian algorithm
   * O(n³) complexity - much better than O(n!)
   */
  private solveAssignment(
    costMatrix: number[][],
    players: PlayerPerformance[]
  ): Map<string, string> {
    // Use munkres (Hungarian algorithm) to solve
    const assignments = munkres(costMatrix);
    
    const result = new Map<string, string>();
    
    assignments.forEach(([playerIdx, roleIdx]) => {
      if (playerIdx < players.length && roleIdx < this.roles.length) {
        const playerId = players[playerIdx].playerId;
        const roleId = this.roles[roleIdx].id;
        result.set(playerId, roleId);
      }
    });
    
    return result;
  }
  
  /**
   * Update history buffer for temporal consistency
   * Lucey: "Smooth transitions prevent role thrashing"
   */
  private updateHistory(assignments: Map<string, string>): void {
    this.historyBuffer.push(new Map(assignments));
    
    // Keep last 10 frames for consistency
    if (this.historyBuffer.length > 10) {
      this.historyBuffer.shift();
    }
    
    // Update transition costs based on stability
    this.updateTransitionCosts();
  }
  
  /**
   * Calculate transition costs to prevent role thrashing
   */
  private updateTransitionCosts(): void {
    this.transitionCosts.clear();
    
    if (this.historyBuffer.length < 2) return;
    
    // Count transitions for each player
    const transitionCounts = new Map<string, number>();
    
    for (let i = 1; i < this.historyBuffer.length; i++) {
      const prev = this.historyBuffer[i - 1];
      const curr = this.historyBuffer[i];
      
      for (const [playerId, currRole] of curr) {
        const prevRole = prev.get(playerId);
        if (prevRole && prevRole !== currRole) {
          const key = `${playerId}-${prevRole}-${currRole}`;
          transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
        }
      }
    }
    
    // Convert counts to costs
    for (const [key, count] of transitionCounts) {
      // Higher transition count = higher cost
      this.transitionCosts.set(key, count * 0.1);
    }
  }
  
  /**
   * Get role statistics for analysis
   */
  getRoleStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    this.roles.forEach(role => {
      stats[role.id] = {
        assignmentCount: 0,
        averageEfficiency: 0,
        transitionRate: 0
      };
    });
    
    // Calculate from history
    this.historyBuffer.forEach(assignments => {
      for (const roleId of assignments.values()) {
        if (stats[roleId]) {
          stats[roleId].assignmentCount++;
        }
      }
    });
    
    return stats;
  }
}

/**
 * Sport-specific role configurations
 * Following Lucey's sport-specific optimizations
 */
export class SportRoleConfigurations {
  static NFL_ROLES: RoleDefinition[] = [
    // Offense
    { id: 'QB', expectedStats: { yards: 250, touchdowns: 2, points: 20 }, spatialZone: [40, 25, 60, 30], importance: 1.0 },
    { id: 'RB', expectedStats: { yards: 80, touchdowns: 0.8, points: 12 }, spatialZone: [45, 20, 55, 25], importance: 0.8 },
    { id: 'WR1', expectedStats: { yards: 90, touchdowns: 0.7, points: 15 }, spatialZone: [10, 0, 30, 10], importance: 0.9 },
    { id: 'WR2', expectedStats: { yards: 60, touchdowns: 0.4, points: 10 }, spatialZone: [70, 0, 90, 10], importance: 0.7 },
    { id: 'TE', expectedStats: { yards: 40, touchdowns: 0.3, points: 8 }, spatialZone: [35, 15, 45, 20], importance: 0.6 },
    // ... more roles
  ];
  
  static NBA_ROLES: RoleDefinition[] = [
    { id: 'PG', expectedStats: { points: 18, assists: 8, rebounds: 4 }, spatialZone: [40, 70, 60, 94], importance: 0.9 },
    { id: 'SG', expectedStats: { points: 22, assists: 3, rebounds: 4 }, spatialZone: [20, 50, 40, 70], importance: 0.8 },
    { id: 'SF', expectedStats: { points: 20, assists: 4, rebounds: 6 }, spatialZone: [60, 50, 80, 70], importance: 0.8 },
    { id: 'PF', expectedStats: { points: 18, assists: 2, rebounds: 8 }, spatialZone: [30, 0, 50, 20], importance: 0.7 },
    { id: 'C', expectedStats: { points: 16, assists: 2, rebounds: 10 }, spatialZone: [40, 0, 60, 15], importance: 0.8 },
  ];
  
  static getConfiguration(sport: string): RoleDefinition[] {
    switch (sport.toLowerCase()) {
      case 'nfl': return this.NFL_ROLES;
      case 'nba': return this.NBA_ROLES;
      // Add other sports...
      default: return this.NFL_ROLES;
    }
  }
}

/**
 * Batch role assignment for multiple games
 * Lucey: "Batch everything for GPU efficiency"
 */
export class BatchRoleAssigner {
  private optimizer: RoleAssignmentOptimizer;
  
  constructor(sport: string) {
    const roles = SportRoleConfigurations.getConfiguration(sport);
    this.optimizer = new RoleAssignmentOptimizer(sport, roles);
  }
  
  /**
   * Process multiple games in parallel
   */
  async assignBatch(
    gameStates: Array<{ gameId: string; players: PlayerPerformance[] }>
  ): Promise<Map<string, Map<string, string>>> {
    const results = new Map<string, Map<string, string>>();
    
    // Process in parallel batches
    const batchSize = 10;
    for (let i = 0; i < gameStates.length; i += batchSize) {
      const batch = gameStates.slice(i, i + batchSize);
      
      const promises = batch.map(async (gameState) => {
        const assignments = await this.optimizer.assignRoles(gameState.players);
        return { gameId: gameState.gameId, assignments };
      });
      
      const batchResults = await Promise.all(promises);
      
      batchResults.forEach(({ gameId, assignments }) => {
        results.set(gameId, assignments);
      });
    }
    
    return results;
  }
}