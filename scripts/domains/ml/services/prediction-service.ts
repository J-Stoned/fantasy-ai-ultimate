/**
 * 🎯 Fantasy Points Prediction Service
 * Generates ML-powered predictions for DFS optimization
 */

import { Pool } from 'pg';
import { ModelLoaderService } from './model-loader';
import { InjuryService } from './injury-service';
import { cacheService } from './cache-service';
import { OwnershipEngineV2 } from './ownership-engine-v2';
import { VegasService } from './vegas-service';
import { WeatherService } from './weather-service';

export interface PlayerPrediction {
  player_id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projected_points: number;
  floor: number;
  ceiling: number;
  ownership_projection: number;
  leverage_score: number;
  chalk_score: number;
  contrarian_score: number;
  boom_probability: number;
  bust_probability: number;
  value_rating: number;
  confidence_score: number;
  injury_status?: string;
  injury_risk?: number;
  narrative_factors?: string[];
  stack_partners?: string[];
}

export interface PredictionOptions {
  sport: string;
  game_date: Date;
  platform: 'draftkings' | 'fanduel' | 'yahoo';
  include_injured?: boolean;
  min_salary?: number;
  positions?: string[];
}

export class PredictionService {
  private pool: Pool;
  private modelLoader: ModelLoaderService;
  private injuryService: InjuryService | null = null;
  private ownershipEngine: OwnershipEngineV2 | null = null;

  constructor(
    pool: Pool, 
    modelLoader: ModelLoaderService, 
    injuryService?: InjuryService,
    vegasService?: VegasService,
    weatherService?: WeatherService
  ) {
    this.pool = pool;
    this.modelLoader = modelLoader;
    this.injuryService = injuryService || null;
    
    // Initialize ownership engine if services are provided
    if (vegasService && weatherService) {
      this.ownershipEngine = new OwnershipEngineV2(
        pool,
        vegasService,
        injuryService || ({} as InjuryService),
        weatherService
      );
    }
  }

  /**
   * Generate predictions for all eligible players
   */
  async generatePredictions(options: PredictionOptions): Promise<PlayerPrediction[]> {
    // Try to get from cache first
    const cacheKey = {
      sport: options.sport,
      game_date: options.game_date.toISOString().split('T')[0],
      platform: options.platform,
      include_injured: options.include_injured || false,
      min_salary: options.min_salary || 0,
      positions: options.positions?.join(',') || 'all'
    };
    
    return await cacheService.getOrSet(
      'predictions',
      cacheKey,
      async () => {
        console.log(`🔮 Generating ${options.sport.toUpperCase()} predictions for ${options.game_date}`);
        
        // Get player data with features
        const players = await this.getPlayersWithFeatures(options);
        
        if (players.length === 0) {
          console.warn('⚠️ No eligible players found');
          return [];
        }
        
        // Extract features for ML model
        const features = this.extractFeatures(players, options.sport);
        
        // Get ML predictions
        const mlPredictions = await this.modelLoader.predict(options.sport, features);
        
        // Combine with player data and calculate additional metrics
        const predictions = players.map((player, index) => {
          const baseProjection = mlPredictions[index];
          
          return this.createPlayerPrediction(
            player,
            baseProjection,
            options.platform
          );
        });
        
        // Add ownership projections if engine is available
        if (this.ownershipEngine) {
          const contestType = options.platform === 'draftkings' ? 'GPP' : 'CASH';
          const ownershipData = await this.ownershipEngine.projectSlateOwnership(
            options.sport,
            'main',
            options.game_date,
            contestType
          );
          
          // Map ownership data to predictions
          const ownershipMap = new Map(
            ownershipData.map(o => [o.playerId, o])
          );
          
          predictions.forEach(pred => {
            const ownership = ownershipMap.get(pred.player_id);
            if (ownership) {
              pred.ownership_projection = ownership.projectedOwnership;
              pred.leverage_score = ownership.leverageScore;
              pred.chalk_score = ownership.chalkScore;
              pred.contrarian_score = ownership.contrarianScore;
              pred.narrative_factors = ownership.narrativeFactors;
              pred.stack_partners = ownership.stackPartners;
            }
          });
        }
        
        // Sort by projected points descending
        predictions.sort((a, b) => b.projected_points - a.projected_points);
        
        console.log(`✅ Generated predictions for ${predictions.length} players with ownership data`);
        
        return predictions;
      }
    );
  }

  /**
   * Get players with all necessary features
   */
  private async getPlayersWithFeatures(options: PredictionOptions): Promise<any[]> {
    const { sport, game_date, platform, include_injured, min_salary, positions } = options;
    
    // Build dynamic WHERE clause
    const conditions = [
      'g.game_date = $1',
      'ps.platform = $2',
      'ps.salary > 0'
    ];
    
    const params: any[] = [game_date, platform];
    let paramIndex = 3;
    
    if (!include_injured) {
      conditions.push('pi.injury_status IS NULL OR pi.injury_status = \'GTD\'');
    }
    
    if (min_salary) {
      conditions.push(`ps.salary >= $${paramIndex}`);
      params.push(min_salary);
      paramIndex++;
    }
    
    if (positions && positions.length > 0) {
      conditions.push(`p.position = ANY($${paramIndex})`);
      params.push(positions);
      paramIndex++;
    }
    
    const query = `
      WITH player_stats AS (
        SELECT 
          p.id,
          p.name,
          p.position,
          t.abbreviation as team,
          opp.abbreviation as opponent,
          ps.salary,
          ps.ownership_projection,
          pi.injury_status,
          -- Recent performance
          AVG(fp.actual_points) FILTER (WHERE fp.game_date > CURRENT_DATE - INTERVAL '14 days') as recent_avg,
          AVG(fp.actual_points) FILTER (WHERE fp.game_date > CURRENT_DATE - INTERVAL '30 days') as month_avg,
          AVG(fp.actual_points) as season_avg,
          STDDEV(fp.actual_points) as points_stddev,
          -- Advanced stats
          COUNT(fp.actual_points) as games_played,
          MAX(fp.actual_points) as season_high,
          MIN(fp.actual_points) as season_low,
          -- Matchup data
          AVG(fp.actual_points) FILTER (WHERE fp.opponent_id = opp.id) as avg_vs_opponent,
          -- Pace and usage
          AVG(gs.pace) as team_pace,
          AVG(gs_opp.pace) as opponent_pace,
          AVG(ps2.usage_rate) as usage_rate,
          -- Defense ratings
          AVG(td.defensive_rating) as opponent_def_rating,
          AVG(td.points_allowed_per_game) as opponent_ppg_allowed
        FROM players p
        JOIN teams t ON p.team_id = t.id
        JOIN games g ON g.home_team_id = t.id OR g.away_team_id = t.id
        JOIN teams opp ON (g.home_team_id = opp.id AND g.away_team_id = t.id) 
                       OR (g.away_team_id = opp.id AND g.home_team_id = t.id)
        LEFT JOIN player_salaries ps ON p.id = ps.player_id AND ps.game_date = g.game_date
        LEFT JOIN player_injuries pi ON p.id = pi.player_id
        LEFT JOIN fantasy_points fp ON p.id = fp.player_id
        LEFT JOIN game_stats gs ON g.id = gs.game_id AND gs.team_id = t.id
        LEFT JOIN game_stats gs_opp ON g.id = gs_opp.game_id AND gs_opp.team_id = opp.id
        LEFT JOIN player_stats ps2 ON p.id = ps2.player_id
        LEFT JOIN team_defense td ON opp.id = td.team_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY p.id, p.name, p.position, t.abbreviation, opp.abbreviation, 
                 ps.salary, ps.ownership_projection, pi.injury_status
      )
      SELECT * FROM player_stats
      WHERE games_played > 0
      ORDER BY salary DESC`;
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Extract features for ML model
   */
  private extractFeatures(players: any[], sport: string): number[][] {
    return players.map(player => {
      const features = [
        player.games_played || 0,
        player.recent_avg || 0,
        player.month_avg || 0,
        player.season_avg || 0,
        player.points_stddev || 0,
        player.season_high || 0,
        player.avg_vs_opponent || player.season_avg || 0,
        player.team_pace || 100,
        player.opponent_pace || 100,
        player.usage_rate || 0.2,
        player.opponent_def_rating || 100,
        player.opponent_ppg_allowed || 100,
        player.salary / 1000, // Normalize salary
        player.ownership_projection || 0.1
      ];
      
      // Add sport-specific features
      if (sport === 'nba') {
        features.push(
          player.minutes_per_game || 0,
          player.back_to_back ? 1 : 0
        );
      } else if (sport === 'mlb') {
        features.push(
          player.batting_order || 9,
          player.park_factor || 1.0
        );
      }
      
      return features;
    });
  }

  /**
   * Create player prediction object
   */
  private createPlayerPrediction(
    player: any,
    baseProjection: number,
    platform: string
  ): PlayerPrediction {
    // Get injury status
    const injuryStatus = this.injuryService?.getPlayerInjuryStatus(player.id);
    const injuryImpact = injuryStatus ? injuryStatus.impact_score : 0;
    
    // Adjust projection based on injury
    const injuryAdjustedProjection = baseProjection * (1 - injuryImpact * 0.5);
    
    // Calculate floor and ceiling with injury consideration
    const stddev = player.points_stddev || baseProjection * 0.3;
    const injuryVolatility = injuryImpact * stddev * 0.5; // More volatility if injured
    const adjustedStddev = stddev + injuryVolatility;
    
    const floor = Math.max(0, injuryAdjustedProjection - adjustedStddev * 1.5);
    const ceiling = injuryAdjustedProjection + adjustedStddev * 2 * (1 - injuryImpact * 0.3);
    
    // Calculate probabilities
    const boomThreshold = baseProjection * 1.5;
    const bustThreshold = baseProjection * 0.6;
    
    const boomProbability = this.calculateProbability(
      injuryAdjustedProjection,
      adjustedStddev,
      boomThreshold,
      'above'
    ) * (1 - injuryImpact * 0.5); // Lower boom chance if injured
    
    const bustProbability = this.calculateProbability(
      injuryAdjustedProjection,
      adjustedStddev,
      bustThreshold,
      'below'
    ) + (injuryImpact * 0.3); // Higher bust chance if injured
    
    // Calculate value rating (points per $1000 salary)
    const valueRating = (injuryAdjustedProjection / (player.salary / 1000));
    
    // Calculate confidence based on games played, consistency, and injury
    const consistency = adjustedStddev > 0 ? injuryAdjustedProjection / adjustedStddev : 1;
    const confidenceScore = Math.min(1, 
      (player.games_played / 20) * 0.5 + 
      (consistency / 5) * 0.3 +
      (player.recent_avg ? 0.2 : 0) -
      (injuryImpact * 0.3) // Lower confidence if injured
    );
    
    // Adjust ownership if injured
    const adjustedOwnership = player.ownership_projection * (1 - injuryImpact * 0.4);
    
    return {
      player_id: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      opponent: player.opponent,
      salary: player.salary,
      projected_points: Math.round(injuryAdjustedProjection * 10) / 10,
      floor: Math.round(floor * 10) / 10,
      ceiling: Math.round(ceiling * 10) / 10,
      ownership_projection: adjustedOwnership || 0.1,
      leverage_score: 0, // Will be filled by ownership engine
      chalk_score: 0, // Will be filled by ownership engine
      contrarian_score: 0, // Will be filled by ownership engine
      boom_probability: Math.round(boomProbability * 1000) / 10,
      bust_probability: Math.round(bustProbability * 1000) / 10,
      value_rating: Math.round(valueRating * 10) / 10,
      confidence_score: Math.round(confidenceScore * 100) / 100,
      injury_status: injuryStatus?.status,
      injury_risk: injuryImpact,
      narrative_factors: [],
      stack_partners: []
    };
  }

  /**
   * Calculate probability using normal distribution
   */
  private calculateProbability(
    mean: number,
    stddev: number,
    threshold: number,
    direction: 'above' | 'below'
  ): number {
    if (stddev === 0) return direction === 'above' ? 0 : 1;
    
    const z = (threshold - mean) / stddev;
    const probability = this.normalCDF(z);
    
    return direction === 'above' ? 1 - probability : probability;
  }

  /**
   * Normal cumulative distribution function
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);
    
    const t = 1 / (1 + p * z);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    
    return 0.5 * (1 + sign * y);
  }

  /**
   * Get top value plays
   */
  async getTopValuePlays(
    options: PredictionOptions,
    limit: number = 10
  ): Promise<PlayerPrediction[]> {
    const predictions = await this.generatePredictions(options);
    
    // Sort by value rating
    predictions.sort((a, b) => b.value_rating - a.value_rating);
    
    return predictions.slice(0, limit);
  }

  /**
   * Get contrarian plays (low ownership, high upside)
   */
  async getContrarianPlays(
    options: PredictionOptions,
    maxOwnership: number = 0.15,
    limit: number = 10
  ): Promise<PlayerPrediction[]> {
    const predictions = await this.generatePredictions(options);
    
    // Filter by ownership and sort by ceiling
    const contrarian = predictions
      .filter(p => p.ownership_projection <= maxOwnership)
      .sort((a, b) => b.ceiling - a.ceiling);
    
    return contrarian.slice(0, limit);
  }

  /**
   * Get leverage plays (high value, low ownership)
   */
  async getLeveragePlays(
    options: PredictionOptions,
    minLeverage: number = 1.5,
    limit: number = 10
  ): Promise<PlayerPrediction[]> {
    const predictions = await this.generatePredictions(options);
    
    // Filter by leverage score and sort
    const leverage = predictions
      .filter(p => p.leverage_score >= minLeverage)
      .sort((a, b) => b.leverage_score - a.leverage_score);
    
    return leverage.slice(0, limit);
  }

  /**
   * Get chalk plays (high ownership)
   */
  async getChalkPlays(
    options: PredictionOptions,
    minOwnership: number = 0.20,
    limit: number = 10
  ): Promise<PlayerPrediction[]> {
    const predictions = await this.generatePredictions(options);
    
    // Filter by ownership and sort
    const chalk = predictions
      .filter(p => p.ownership_projection >= minOwnership)
      .sort((a, b) => b.ownership_projection - a.ownership_projection);
    
    return chalk.slice(0, limit);
  }

  /**
   * Get optimal stacks based on correlation and ownership
   */
  async getOptimalStacks(
    options: PredictionOptions,
    limit: number = 5
  ): Promise<Array<{ primary: PlayerPrediction; stack: PlayerPrediction[] }>> {
    const predictions = await this.generatePredictions(options);
    
    // Group players by team
    const byTeam = new Map<string, PlayerPrediction[]>();
    predictions.forEach(p => {
      if (!byTeam.has(p.team)) {
        byTeam.set(p.team, []);
      }
      byTeam.get(p.team)!.push(p);
    });
    
    const stacks: Array<{ primary: PlayerPrediction; stack: PlayerPrediction[] }> = [];
    
    // Find QB stacks for NFL
    if (options.sport.toLowerCase() === 'nfl') {
      byTeam.forEach(teamPlayers => {
        const qb = teamPlayers.find(p => p.position === 'QB');
        if (!qb || !qb.stack_partners) return;
        
        const partners = predictions.filter(p => 
          qb.stack_partners!.includes(p.player_id)
        );
        
        if (partners.length > 0) {
          stacks.push({
            primary: qb,
            stack: partners
          });
        }
      });
      
      // Sort by combined leverage
      stacks.sort((a, b) => {
        const aLeverage = a.primary.leverage_score + 
          a.stack.reduce((sum, p) => sum + p.leverage_score, 0);
        const bLeverage = b.primary.leverage_score + 
          b.stack.reduce((sum, p) => sum + p.leverage_score, 0);
        return bLeverage - aLeverage;
      });
    }
    
    return stacks.slice(0, limit);
  }
}