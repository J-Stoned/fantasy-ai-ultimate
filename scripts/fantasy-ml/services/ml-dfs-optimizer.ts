/**
 * 🚀 ML-Powered DFS Lineup Optimizer
 * Integrates ML predictions with advanced optimization algorithms
 */

import { Pool } from 'pg';
import { PredictionService, PlayerPrediction } from './prediction-service';
import { DFSPlayer, LineupConstraints, OptimizedLineup } from '../models/dfs-lineup-optimizer';
import { WeatherService } from './weather-service';

export interface MLOptimizationOptions {
  sport: string;
  game_date: Date;
  platform: 'draftkings' | 'fanduel' | 'yahoo';
  contest_type: 'gpp' | 'cash' | 'h2h';
  num_lineups: number;
  salary_cap: number;
  roster_positions: string[];
  strategy?: 'balanced' | 'contrarian' | 'ceiling' | 'stars_scrubs';
  constraints?: {
    min_salary?: number;
    max_exposure?: number;
    must_include?: string[];
    exclude?: string[];
    stack_rules?: StackRule[];
    min_teams?: number;
    max_from_team?: number;
  };
}

export interface StackRule {
  type: 'game' | 'team' | 'correlation';
  positions?: string[];
  min_players?: number;
  max_players?: number;
  weight?: number;
}

export interface EnhancedLineup extends OptimizedLineup {
  ml_confidence: number;
  stack_quality: number;
  injury_risk: number;
  weather_impact: number;
  vegas_correlation: number;
  unique_players: number;
  optimization_method: string;
}

export class MLDFSOptimizer {
  private pool: Pool;
  private predictionService: PredictionService;
  private weatherService: WeatherService | null = null;
  private correlationMatrix: Map<string, Map<string, number>> = new Map();

  constructor(pool: Pool, predictionService: PredictionService, weatherService?: WeatherService) {
    this.pool = pool;
    this.predictionService = predictionService;
    this.weatherService = weatherService || null;
  }

  /**
   * Generate ML-optimized lineups
   */
  async optimizeLineups(options: MLOptimizationOptions): Promise<EnhancedLineup[]> {
    console.log(`🧠 ML-Powered DFS Optimization for ${options.sport.toUpperCase()}`);
    console.log(`📅 Date: ${options.game_date.toDateString()}`);
    console.log(`🎯 Strategy: ${options.strategy || 'balanced'}`);
    
    // Step 1: Get ML predictions
    const predictions = await this.predictionService.generatePredictions({
      sport: options.sport,
      game_date: options.game_date,
      platform: options.platform,
      include_injured: false,
      min_salary: options.constraints?.min_salary
    });
    
    if (predictions.length === 0) {
      throw new Error('No eligible players found for optimization');
    }
    
    console.log(`📊 Generated predictions for ${predictions.length} players`);
    
    // Step 2: Build correlation matrix
    await this.buildCorrelationMatrix(predictions, options.sport);
    
    // Step 3: Convert predictions to DFS players
    const dfsPlayers = await this.convertToDFSPlayers(predictions);
    
    // Step 4: Apply strategy-specific adjustments
    const adjustedPlayers = this.applyStrategyAdjustments(dfsPlayers, options);
    
    // Step 5: Build lineup constraints
    const constraints = this.buildConstraints(options);
    
    // Step 6: Generate lineups using multiple algorithms
    const lineups = await this.generateLineupsWithMultipleAlgorithms(
      adjustedPlayers,
      constraints,
      options
    );
    
    // Step 7: Post-process and enhance lineups
    const enhancedLineups = await this.enhanceLineups(lineups, options);
    
    // Step 8: Apply final optimization
    const finalLineups = this.finalOptimization(enhancedLineups, options);
    
    console.log(`✅ Generated ${finalLineups.length} optimized lineups`);
    
    return finalLineups;
  }

  /**
   * Build correlation matrix for stacking
   */
  private async buildCorrelationMatrix(
    predictions: PlayerPrediction[],
    sport: string
  ): Promise<void> {
    // Get historical correlation data
    const correlations = await this.pool.query(`
      SELECT 
        p1.id as player1_id,
        p2.id as player2_id,
        CORR(fp1.actual_points, fp2.actual_points) as correlation,
        COUNT(*) as games_together
      FROM fantasy_points fp1
      JOIN fantasy_points fp2 ON fp1.game_id = fp2.game_id
      JOIN players p1 ON fp1.player_id = p1.id
      JOIN players p2 ON fp2.player_id = p2.id
      WHERE p1.id != p2.id
        AND p1.id = ANY($1)
        AND p2.id = ANY($1)
        AND fp1.game_date > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY p1.id, p2.id
      HAVING COUNT(*) >= 5
        AND CORR(fp1.actual_points, fp2.actual_points) > 0.3
    `, [predictions.map(p => p.player_id)]);
    
    // Build matrix
    correlations.rows.forEach(row => {
      if (!this.correlationMatrix.has(row.player1_id)) {
        this.correlationMatrix.set(row.player1_id, new Map());
      }
      this.correlationMatrix.get(row.player1_id)!.set(
        row.player2_id,
        row.correlation
      );
    });
    
    // Add sport-specific correlations
    this.addSportSpecificCorrelations(predictions, sport);
  }

  /**
   * Add sport-specific correlation rules
   */
  private addSportSpecificCorrelations(
    predictions: PlayerPrediction[],
    sport: string
  ): void {
    predictions.forEach(p1 => {
      predictions.forEach(p2 => {
        if (p1.player_id === p2.player_id) return;
        
        let correlation = 0;
        
        if (sport === 'nfl') {
          // QB-WR correlation
          if (p1.position === 'QB' && p2.position === 'WR' && p1.team === p2.team) {
            correlation = 0.6;
          }
          // QB-opposing WR (shootout)
          else if (p1.position === 'QB' && p2.position === 'WR' && p1.opponent === p2.team) {
            correlation = 0.3;
          }
          // RB-DST negative correlation
          else if (p1.position === 'RB' && p2.position === 'DST' && p1.opponent === p2.team) {
            correlation = -0.4;
          }
        } else if (sport === 'mlb') {
          // Pitcher-hitter negative correlation
          if (p1.position === 'P' && p1.opponent === p2.team) {
            correlation = -0.5;
          }
          // Same team hitters
          else if (p1.team === p2.team && !['P', 'RP'].includes(p1.position) && !['P', 'RP'].includes(p2.position)) {
            correlation = 0.3;
          }
        } else if (sport === 'nba') {
          // Same team correlation (pace)
          if (p1.team === p2.team) {
            correlation = 0.2;
          }
        }
        
        if (correlation !== 0) {
          if (!this.correlationMatrix.has(p1.player_id)) {
            this.correlationMatrix.set(p1.player_id, new Map());
          }
          this.correlationMatrix.get(p1.player_id)!.set(p2.player_id, correlation);
        }
      });
    });
  }

  /**
   * Convert ML predictions to DFS players
   */
  private async convertToDFSPlayers(predictions: PlayerPrediction[]): Promise<DFSPlayer[]> {
    return predictions.map(pred => {
      const correlationPartners: string[] = [];
      
      // Get correlation partners
      if (this.correlationMatrix.has(pred.player_id)) {
        const partners = this.correlationMatrix.get(pred.player_id)!;
        partners.forEach((corr, partnerId) => {
          if (corr > 0.3) {
            correlationPartners.push(partnerId);
          }
        });
      }
      
      return {
        id: pred.player_id,
        name: pred.name,
        position: pred.position,
        team: pred.team,
        opponent: pred.opponent,
        salary: pred.salary,
        projected_points: pred.projected_points,
        projected_ownership: pred.ownership_projection * 100,
        floor: pred.floor,
        ceiling: pred.ceiling,
        boom_probability: pred.boom_probability / 100,
        correlation_partners: correlationPartners
      };
    });
  }

  /**
   * Apply strategy-specific adjustments
   */
  private applyStrategyAdjustments(
    players: DFSPlayer[],
    options: MLOptimizationOptions
  ): DFSPlayer[] {
    const strategy = options.strategy || 'balanced';
    
    return players.map(player => {
      let adjustedPlayer = { ...player };
      
      switch (strategy) {
        case 'contrarian':
          // Boost low ownership, high ceiling players
          if (player.projected_ownership < 15 && player.ceiling > player.projected_points * 1.5) {
            adjustedPlayer.projected_points *= 1.2;
          }
          break;
          
        case 'ceiling':
          // Use ceiling projections
          adjustedPlayer.projected_points = player.ceiling * 0.8;
          break;
          
        case 'stars_scrubs':
          // Boost expensive and cheap players, penalize mid-range
          if (player.salary > 8000 || player.salary < 4500) {
            adjustedPlayer.projected_points *= 1.1;
          } else {
            adjustedPlayer.projected_points *= 0.9;
          }
          break;
      }
      
      // Contest type adjustments
      if (options.contest_type === 'cash') {
        // Prefer floor in cash games
        adjustedPlayer.projected_points = player.floor * 0.7 + player.projected_points * 0.3;
      }
      
      return adjustedPlayer;
    });
  }

  /**
   * Build lineup constraints
   */
  private buildConstraints(options: MLOptimizationOptions): LineupConstraints {
    const positions = new Map<string, number>();
    
    // Parse roster positions (e.g., ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST'])
    options.roster_positions.forEach(pos => {
      positions.set(pos, (positions.get(pos) || 0) + 1);
    });
    
    return {
      salary_cap: options.salary_cap,
      positions,
      min_teams: options.constraints?.min_teams,
      max_from_team: options.constraints?.max_from_team,
      must_include: options.constraints?.must_include,
      exclude: options.constraints?.exclude
    };
  }

  /**
   * Generate lineups using multiple algorithms
   */
  private async generateLineupsWithMultipleAlgorithms(
    players: DFSPlayer[],
    constraints: LineupConstraints,
    options: MLOptimizationOptions
  ): Promise<OptimizedLineup[]> {
    const allLineups: OptimizedLineup[] = [];
    const numLineups = options.num_lineups;
    
    // Algorithm 1: Genetic Algorithm (40% of lineups)
    const geneticLineups = await this.geneticAlgorithm(
      players,
      constraints,
      Math.floor(numLineups * 0.4),
      options
    );
    allLineups.push(...geneticLineups);
    
    // Algorithm 2: Simulated Annealing (30% of lineups)
    const annealingLineups = await this.simulatedAnnealing(
      players,
      constraints,
      Math.floor(numLineups * 0.3),
      options
    );
    allLineups.push(...annealingLineups);
    
    // Algorithm 3: Greedy with Randomization (30% of lineups)
    const greedyLineups = await this.greedyWithRandomization(
      players,
      constraints,
      Math.ceil(numLineups * 0.3),
      options
    );
    allLineups.push(...greedyLineups);
    
    // Remove duplicates
    return this.removeDuplicateLineups(allLineups);
  }

  /**
   * Genetic algorithm implementation
   */
  private async geneticAlgorithm(
    players: DFSPlayer[],
    constraints: LineupConstraints,
    numLineups: number,
    options: MLOptimizationOptions
  ): Promise<OptimizedLineup[]> {
    // Simplified genetic algorithm
    const population: OptimizedLineup[] = [];
    const populationSize = numLineups * 5;
    
    // Initialize population
    for (let i = 0; i < populationSize; i++) {
      const lineup = this.generateRandomValidLineup(players, constraints);
      if (lineup) population.push(lineup);
    }
    
    // Evolution
    for (let generation = 0; generation < 50; generation++) {
      // Sort by fitness
      population.sort((a, b) => this.calculateFitness(b, options) - this.calculateFitness(a, options));
      
      // Keep top performers
      const elite = population.slice(0, Math.floor(populationSize * 0.2));
      
      // Crossover and mutation
      const newPopulation = [...elite];
      while (newPopulation.length < populationSize) {
        const parent1 = elite[Math.floor(Math.random() * elite.length)];
        const parent2 = elite[Math.floor(Math.random() * elite.length)];
        const child = this.crossover(parent1, parent2, players, constraints);
        if (child) {
          this.mutate(child, players, constraints, 0.1);
          newPopulation.push(child);
        }
      }
      
      population.splice(0, population.length, ...newPopulation);
    }
    
    // Return top lineups
    return population.slice(0, numLineups);
  }

  /**
   * Simulated annealing implementation
   */
  private async simulatedAnnealing(
    players: DFSPlayer[],
    constraints: LineupConstraints,
    numLineups: number,
    options: MLOptimizationOptions
  ): Promise<OptimizedLineup[]> {
    const lineups: OptimizedLineup[] = [];
    
    for (let i = 0; i < numLineups; i++) {
      let current = this.generateRandomValidLineup(players, constraints);
      if (!current) continue;
      
      let temperature = 100;
      const coolingRate = 0.95;
      
      while (temperature > 0.1) {
        const neighbor = this.generateNeighbor(current, players, constraints);
        if (!neighbor) continue;
        
        const currentFitness = this.calculateFitness(current, options);
        const neighborFitness = this.calculateFitness(neighbor, options);
        const delta = neighborFitness - currentFitness;
        
        if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
          current = neighbor;
        }
        
        temperature *= coolingRate;
      }
      
      lineups.push(current);
    }
    
    return lineups;
  }

  /**
   * Greedy algorithm with randomization
   */
  private async greedyWithRandomization(
    players: DFSPlayer[],
    constraints: LineupConstraints,
    numLineups: number,
    options: MLOptimizationOptions
  ): Promise<OptimizedLineup[]> {
    const lineups: OptimizedLineup[] = [];
    
    for (let i = 0; i < numLineups; i++) {
      const lineup = this.buildGreedyLineup(players, constraints, Math.random() * 0.3);
      if (lineup) lineups.push(lineup);
    }
    
    return lineups;
  }

  /**
   * Generate random valid lineup
   */
  private generateRandomValidLineup(
    players: DFSPlayer[],
    constraints: LineupConstraints
  ): OptimizedLineup | null {
    const lineup: DFSPlayer[] = [];
    const usedIds = new Set<string>();
    let totalSalary = 0;
    
    // Group by position
    const byPosition = new Map<string, DFSPlayer[]>();
    players.forEach(p => {
      if (!byPosition.has(p.position)) byPosition.set(p.position, []);
      byPosition.get(p.position)!.push(p);
    });
    
    // Fill positions
    for (const [position, count] of constraints.positions) {
      const candidates = byPosition.get(position) || [];
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      
      let added = 0;
      for (const player of shuffled) {
        if (!usedIds.has(player.id) && totalSalary + player.salary <= constraints.salary_cap) {
          lineup.push(player);
          usedIds.add(player.id);
          totalSalary += player.salary;
          added++;
          if (added >= count) break;
        }
      }
      
      if (added < count) return null;
    }
    
    return this.createLineupObject(lineup);
  }

  /**
   * Calculate fitness score for genetic algorithm
   */
  private calculateFitness(lineup: OptimizedLineup, options: MLOptimizationOptions): number {
    let fitness = lineup.projected_points;
    
    // Stack bonus
    if (options.constraints?.stack_rules) {
      fitness += lineup.correlation_score * 2;
    }
    
    // Leverage bonus for GPPs
    if (options.contest_type === 'gpp') {
      fitness += lineup.leverage_score * 0.5;
    }
    
    // Salary efficiency
    const salaryUsed = lineup.total_salary / options.salary_cap;
    if (salaryUsed > 0.95) fitness *= 1.1;
    
    return fitness;
  }

  /**
   * Crossover operation for genetic algorithm
   */
  private crossover(
    parent1: OptimizedLineup,
    parent2: OptimizedLineup,
    players: DFSPlayer[],
    constraints: LineupConstraints
  ): OptimizedLineup | null {
    // Simple position-based crossover
    const childPlayers: DFSPlayer[] = [];
    const usedIds = new Set<string>();
    
    // Take random positions from each parent
    const positions = Array.from(constraints.positions.keys());
    positions.forEach(position => {
      const fromParent1 = Math.random() > 0.5;
      const parent = fromParent1 ? parent1 : parent2;
      
      const positionPlayers = parent.players.filter(p => p.position === position);
      positionPlayers.forEach(p => {
        if (!usedIds.has(p.id)) {
          childPlayers.push(p);
          usedIds.add(p.id);
        }
      });
    });
    
    // Validate and fix if needed
    if (childPlayers.length === parent1.players.length) {
      return this.createLineupObject(childPlayers);
    }
    
    return null;
  }

  /**
   * Mutation operation
   */
  private mutate(
    lineup: OptimizedLineup,
    players: DFSPlayer[],
    constraints: LineupConstraints,
    rate: number
  ): void {
    if (Math.random() > rate) return;
    
    // Swap random player
    const index = Math.floor(Math.random() * lineup.players.length);
    const oldPlayer = lineup.players[index];
    const candidates = players.filter(p => 
      p.position === oldPlayer.position && 
      p.id !== oldPlayer.id &&
      !lineup.players.some(lp => lp.id === p.id)
    );
    
    if (candidates.length > 0) {
      const newPlayer = candidates[Math.floor(Math.random() * candidates.length)];
      const newSalary = lineup.total_salary - oldPlayer.salary + newPlayer.salary;
      
      if (newSalary <= constraints.salary_cap) {
        lineup.players[index] = newPlayer;
        lineup.total_salary = newSalary;
        lineup.projected_points = lineup.players.reduce((sum, p) => sum + p.projected_points, 0);
      }
    }
  }

  /**
   * Generate neighbor for simulated annealing
   */
  private generateNeighbor(
    current: OptimizedLineup,
    players: DFSPlayer[],
    constraints: LineupConstraints
  ): OptimizedLineup | null {
    const newLineup = {
      ...current,
      players: [...current.players]
    };
    
    // Random swap
    const index = Math.floor(Math.random() * newLineup.players.length);
    const oldPlayer = newLineup.players[index];
    const candidates = players.filter(p => 
      p.position === oldPlayer.position && 
      p.id !== oldPlayer.id &&
      !newLineup.players.some(lp => lp.id === p.id)
    );
    
    if (candidates.length === 0) return null;
    
    const newPlayer = candidates[Math.floor(Math.random() * candidates.length)];
    const newSalary = newLineup.total_salary - oldPlayer.salary + newPlayer.salary;
    
    if (newSalary <= constraints.salary_cap) {
      newLineup.players[index] = newPlayer;
      return this.createLineupObject(newLineup.players);
    }
    
    return null;
  }

  /**
   * Build greedy lineup with randomization
   */
  private buildGreedyLineup(
    players: DFSPlayer[],
    constraints: LineupConstraints,
    randomFactor: number
  ): OptimizedLineup | null {
    const lineup: DFSPlayer[] = [];
    const usedIds = new Set<string>();
    let totalSalary = 0;
    
    // Sort by value with randomization
    const sortedPlayers = [...players].sort((a, b) => {
      const aValue = (a.projected_points / a.salary) * (1 + (Math.random() - 0.5) * randomFactor);
      const bValue = (b.projected_points / b.salary) * (1 + (Math.random() - 0.5) * randomFactor);
      return bValue - aValue;
    });
    
    // Fill positions greedily
    for (const [position, count] of constraints.positions) {
      const candidates = sortedPlayers.filter(p => 
        p.position === position && 
        !usedIds.has(p.id)
      );
      
      let added = 0;
      for (const player of candidates) {
        if (totalSalary + player.salary <= constraints.salary_cap) {
          lineup.push(player);
          usedIds.add(player.id);
          totalSalary += player.salary;
          added++;
          if (added >= count) break;
        }
      }
      
      if (added < count) return null;
    }
    
    return this.createLineupObject(lineup);
  }

  /**
   * Create lineup object
   */
  private createLineupObject(players: DFSPlayer[]): OptimizedLineup {
    const totalSalary = players.reduce((sum, p) => sum + p.salary, 0);
    const projectedPoints = players.reduce((sum, p) => sum + p.projected_points, 0);
    const projectedOwnership = players.reduce((sum, p) => sum + p.projected_ownership, 0) / players.length;
    const ceiling = players.reduce((sum, p) => sum + p.ceiling, 0);
    
    // Calculate leverage
    const leverageScore = projectedPoints / (projectedOwnership / 10 + 1);
    
    // Calculate correlation
    let correlationScore = 0;
    players.forEach(p1 => {
      if (this.correlationMatrix.has(p1.id)) {
        const partners = this.correlationMatrix.get(p1.id)!;
        players.forEach(p2 => {
          if (p1.id !== p2.id && partners.has(p2.id)) {
            correlationScore += partners.get(p2.id)!;
          }
        });
      }
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
   * Remove duplicate lineups
   */
  private removeDuplicateLineups(lineups: OptimizedLineup[]): OptimizedLineup[] {
    const unique: OptimizedLineup[] = [];
    const seen = new Set<string>();
    
    lineups.forEach(lineup => {
      const key = lineup.players.map(p => p.id).sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(lineup);
      }
    });
    
    return unique;
  }

  /**
   * Enhance lineups with additional data
   */
  private async enhanceLineups(
    lineups: OptimizedLineup[],
    options: MLOptimizationOptions
  ): Promise<EnhancedLineup[]> {
    // Get additional data for all players
    const allPlayerIds = Array.from(new Set(
      lineups.flatMap(l => l.players.map(p => p.player_id))
    ));
    
    // Get injury data
    const injuries = await this.getInjuryData(allPlayerIds);
    
    // Get weather data (for outdoor sports)
    const weather = await this.getWeatherData(allPlayerIds, options.game_date);
    
    // Get Vegas data
    const vegas = await this.getVegasData(allPlayerIds, options.game_date);
    
    return lineups.map(lineup => {
      // Calculate ML confidence
      const mlConfidence = lineup.players.reduce((sum, p) => {
        // For now, use a default confidence based on projection quality
        const confidence = p.projected_points > 0 ? 0.7 : 0.5;
        return sum + confidence;
      }, 0) / lineup.players.length;
      
      // Calculate stack quality
      const stackQuality = this.calculateStackQuality(lineup, options);
      
      // Calculate injury risk
      const injuryRisk = lineup.players.reduce((sum, p) => {
        const injury = injuries.get(p.id);
        return sum + (injury ? 0.2 : 0);
      }, 0) / lineup.players.length;
      
      // Calculate weather impact
      const weatherImpact = this.calculateWeatherImpact(lineup, weather, options.sport);
      
      // Calculate Vegas correlation
      const vegasCorrelation = this.calculateVegasCorrelation(lineup, vegas);
      
      // Count unique players across all lineups
      const uniquePlayers = lineups.reduce((count, l) => {
        const overlap = l.players.filter(p => lineup.players.some(lp => lp.id === p.id)).length;
        return count + (lineup.players.length - overlap);
      }, 0) / lineups.length;
      
      return {
        ...lineup,
        ml_confidence: mlConfidence,
        stack_quality: stackQuality,
        injury_risk: injuryRisk,
        weather_impact: weatherImpact,
        vegas_correlation: vegasCorrelation,
        unique_players: uniquePlayers,
        optimization_method: 'ml_enhanced'
      };
    });
  }

  /**
   * Get injury data
   */
  private async getInjuryData(playerIds: string[]): Promise<Map<string, string>> {
    const injuries = new Map<string, string>();
    
    const result = await this.pool.query(`
      SELECT player_id, injury_status
      FROM player_injuries
      WHERE player_id = ANY($1)
        AND injury_status IS NOT NULL
    `, [playerIds]);
    
    result.rows.forEach(row => {
      injuries.set(row.player_id, row.injury_status);
    });
    
    return injuries;
  }

  /**
   * Get weather data (mock for now)
   */
  private async getWeatherData(
    playerIds: string[],
    gameDate: Date
  ): Promise<Map<string, any>> {
    // In production, this would fetch real weather data
    return new Map();
  }

  /**
   * Get Vegas data (mock for now)
   */
  private async getVegasData(
    playerIds: string[],
    gameDate: Date
  ): Promise<Map<string, any>> {
    // In production, this would fetch real Vegas lines
    return new Map();
  }

  /**
   * Calculate stack quality
   */
  private calculateStackQuality(
    lineup: OptimizedLineup,
    options: MLOptimizationOptions
  ): number {
    let quality = 0;
    const sport = options.sport;
    
    if (sport === 'nfl') {
      // QB-WR stacks
      const qb = lineup.players.find(p => p.position === 'QB');
      if (qb) {
        const sameTeamWRs = lineup.players.filter(p => 
          p.position === 'WR' && p.team === qb.team
        ).length;
        quality += sameTeamWRs * 0.3;
        
        // Game stack
        const gameStackPlayers = lineup.players.filter(p => 
          p.team === qb.opponent || p.opponent === qb.team
        ).length;
        quality += Math.min(gameStackPlayers * 0.1, 0.3);
      }
    } else if (sport === 'mlb') {
      // Team stacks
      const teamCounts = new Map<string, number>();
      lineup.players.forEach(p => {
        if (!['P', 'RP'].includes(p.position)) {
          teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
        }
      });
      
      teamCounts.forEach(count => {
        if (count >= 3) quality += 0.2;
        if (count >= 4) quality += 0.2;
      });
    }
    
    return Math.min(quality, 1);
  }

  /**
   * Calculate weather impact
   */
  private calculateWeatherImpact(
    lineup: OptimizedLineup,
    weather: Map<string, any>,
    sport: string
  ): number {
    if (!['nfl', 'mlb'].includes(sport)) return 0;
    if (!this.weatherService) return 0;
    
    let totalImpact = 0;
    let impactCount = 0;
    
    // Check weather for each player's game
    const gameIds = new Set<string>();
    lineup.players.forEach(player => {
      // Approximate game ID from player data
      const gameId = `${sport}_game_${player.team}_${player.opponent}`;
      gameIds.add(gameId);
    });
    
    gameIds.forEach(gameId => {
      const weatherImpact = this.weatherService!.getWeatherImpact(gameId);
      if (weatherImpact) {
        // Weight impact by number of players in that game
        const playersInGame = lineup.players.filter(p => {
          const pGameId = `${sport}_game_${p.team}_${p.opponent}`;
          return pGameId === gameId;
        }).length;
        
        totalImpact += weatherImpact.overall_impact * playersInGame;
        impactCount += playersInGame;
      }
    });
    
    return impactCount > 0 ? totalImpact / impactCount : 0;
  }

  /**
   * Calculate Vegas correlation
   */
  private calculateVegasCorrelation(
    lineup: OptimizedLineup,
    vegas: Map<string, any>
  ): number {
    // In production, would correlate with game totals and spreads
    return 0.5;
  }

  /**
   * Final optimization pass
   */
  private finalOptimization(
    lineups: EnhancedLineup[],
    options: MLOptimizationOptions
  ): EnhancedLineup[] {
    // Sort by composite score
    lineups.sort((a, b) => {
      const scoreA = this.calculateCompositeScore(a, options);
      const scoreB = this.calculateCompositeScore(b, options);
      return scoreB - scoreA;
    });
    
    // Ensure diversity
    const finalLineups: EnhancedLineup[] = [];
    const usedPlayerCounts = new Map<string, number>();
    
    lineups.forEach(lineup => {
      // Check exposure limits
      let canAdd = true;
      lineup.players.forEach(p => {
        const count = usedPlayerCounts.get(p.id) || 0;
        const maxExposure = options.constraints?.max_exposure || 0.5;
        if (count / options.num_lineups >= maxExposure) {
          canAdd = false;
        }
      });
      
      if (canAdd && finalLineups.length < options.num_lineups) {
        finalLineups.push(lineup);
        lineup.players.forEach(p => {
          usedPlayerCounts.set(p.id, (usedPlayerCounts.get(p.id) || 0) + 1);
        });
      }
    });
    
    return finalLineups;
  }

  /**
   * Calculate composite score for final ranking
   */
  private calculateCompositeScore(
    lineup: EnhancedLineup,
    options: MLOptimizationOptions
  ): number {
    let score = lineup.projected_points;
    
    // ML confidence weight
    score *= (0.8 + lineup.ml_confidence * 0.2);
    
    // Stack quality bonus
    score += lineup.stack_quality * 10;
    
    // Injury risk penalty
    score *= (1 - lineup.injury_risk * 0.5);
    
    // Leverage bonus for GPPs
    if (options.contest_type === 'gpp') {
      score += lineup.leverage_score * 0.3;
    }
    
    // Unique players bonus
    score *= (0.9 + lineup.unique_players * 0.1);
    
    return score;
  }
}