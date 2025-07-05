/**
 * 🎯 ENHANCED PLAYER-LEVEL FEATURES
 * Phase 2: Extract advanced player features for ML models
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface EnhancedPlayerFeatures {
  // Star Player Features (8 features)
  topPlayerFantasyAvg: number;      // Best player's fantasy avg
  starPlayerAvailability: number;   // % of top 5 players healthy
  startingLineupStrength: number;   // Combined rating of likely starters
  benchDepth: number;              // Quality of bench players
  
  // Positional Features (6 features)
  quarterbackRating: number;       // QB performance/availability
  offensiveLineStrength: number;   // OL injury impact
  defensiveRating: number;         // Defensive unit strength
  specialTeamsImpact: number;      // ST players available
  
  // Recent Form Features (4 features)
  playerMomentum: number;          // Recent fantasy point trends
  injuryRecoveryFactor: number;    // Players returning from injury
  fatigueFactor: number;           // Rest days impact
  chemistryRating: number;         // Starting lineup consistency
  
  // Advanced Metrics (4 features)
  totalFantasyPotential: number;   // Max possible team fantasy output
  injuryRiskScore: number;         // Likelihood of new injuries
  experienceRating: number;        // Veteran vs rookie mix
  clutchPlayerAvailability: number; // Key performers in pressure situations
}

export class EnhancedPlayerExtractor {
  
  /**
   * Extract comprehensive player features for a team
   */
  async extractPlayerFeatures(teamId: number, gameDate: Date): Promise<EnhancedPlayerFeatures> {
    console.log(chalk.gray(`Extracting player features for team ${teamId}`));
    
    // Get all active players for the team
    const { data: teamPlayers } = await supabase
      .from('players')
      .select('id, position, status, name')
      .eq('team_id', teamId)
      .eq('status', 'active');
    
    if (!teamPlayers || teamPlayers.length === 0) {
      return this.getDefaultPlayerFeatures();
    }
    
    const playerIds = teamPlayers.map(p => p.id);
    
    // Get recent player stats (last 30 days)
    const thirtyDaysAgo = new Date(gameDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { data: recentStats } = await supabase
      .from('player_stats')
      .select('player_id, fantasy_points, game_id, created_at')
      .in('player_id', playerIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });
    
    // Get current injuries
    const { data: injuries } = await supabase
      .from('player_injuries')
      .select('player_id, status, injury_type, return_date')
      .in('player_id', playerIds)
      .in('status', ['injured', 'doubtful', 'questionable']);
    
    // Process features
    const starPlayerFeatures = this.calculateStarPlayerFeatures(teamPlayers, recentStats || [], injuries || []);
    const positionalFeatures = this.calculatePositionalFeatures(teamPlayers, recentStats || [], injuries || []);
    const formFeatures = this.calculateFormFeatures(recentStats || [], gameDate);
    const advancedFeatures = this.calculateAdvancedFeatures(teamPlayers, recentStats || [], injuries || []);
    
    return {
      ...starPlayerFeatures,
      ...positionalFeatures,
      ...formFeatures,
      ...advancedFeatures
    };
  }
  
  /**
   * Calculate star player features
   */
  private calculateStarPlayerFeatures(
    players: any[], 
    stats: any[], 
    injuries: any[]
  ) {
    // Group stats by player
    const playerStats = stats.reduce((acc, stat) => {
      if (!acc[stat.player_id]) acc[stat.player_id] = [];
      acc[stat.player_id].push(stat.fantasy_points);
      return acc;
    }, {} as Record<number, number[]>);
    
    // Calculate fantasy averages for each player
    const playerAverages = Object.entries(playerStats).map(([playerId, points]) => ({
      playerId: parseInt(playerId),
      avgFantasy: points.reduce((a, b) => a + b, 0) / points.length,
      gamesPlayed: points.length
    })).filter(p => p.gamesPlayed >= 3) // Minimum 3 games
      .sort((a, b) => b.avgFantasy - a.avgFantasy);
    
    const topPlayers = playerAverages.slice(0, 5);
    const injuredPlayerIds = injuries.map(i => i.player_id);
    
    return {
      topPlayerFantasyAvg: topPlayers.length > 0 ? topPlayers[0].avgFantasy / 50 : 0.5, // Normalize
      starPlayerAvailability: topPlayers.filter(p => !injuredPlayerIds.includes(p.playerId)).length / 5,
      startingLineupStrength: topPlayers.slice(0, 11).reduce((sum, p) => sum + p.avgFantasy, 0) / (11 * 25), // Assume 11 starters
      benchDepth: playerAverages.slice(11, 25).reduce((sum, p) => sum + p.avgFantasy, 0) / (14 * 15) // Bench players
    };
  }
  
  /**
   * Calculate positional features
   */
  private calculatePositionalFeatures(
    players: any[], 
    stats: any[], 
    injuries: any[]
  ) {
    const positionGroups = {
      qb: ['QB', 'quarterback'],
      ol: ['OL', 'OT', 'OG', 'C', 'offensive_line'],
      def: ['DEF', 'LB', 'CB', 'S', 'DL', 'defense'],
      st: ['K', 'P', 'LS', 'special_teams']
    };
    
    const injuredPlayerIds = injuries.map(i => i.player_id);
    
    const getPositionRating = (positions: string[]) => {
      const positionPlayers = players.filter(p => 
        p.position && positions.some(pos => 
          p.position.includes(pos) || p.position.some((pp: string) => pp.toLowerCase().includes(pos.toLowerCase()))
        )
      );
      
      const healthyPlayers = positionPlayers.filter(p => !injuredPlayerIds.includes(p.id));
      return positionPlayers.length > 0 ? healthyPlayers.length / positionPlayers.length : 0.8;
    };
    
    return {
      quarterbackRating: getPositionRating(positionGroups.qb),
      offensiveLineStrength: getPositionRating(positionGroups.ol),
      defensiveRating: getPositionRating(positionGroups.def),
      specialTeamsImpact: getPositionRating(positionGroups.st)
    };
  }
  
  /**
   * Calculate recent form features
   */
  private calculateFormFeatures(stats: any[], gameDate: Date) {
    if (stats.length === 0) {
      return {
        playerMomentum: 0.5,
        injuryRecoveryFactor: 0.5,
        fatigueFactor: 0.8,
        chemistryRating: 0.7
      };
    }
    
    // Sort stats by date
    const sortedStats = stats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Calculate momentum (recent games vs older games)
    const recentGames = sortedStats.slice(0, Math.floor(sortedStats.length / 3));
    const olderGames = sortedStats.slice(Math.floor(sortedStats.length / 3));
    
    const recentAvg = recentGames.reduce((sum, stat) => sum + stat.fantasy_points, 0) / recentGames.length;
    const olderAvg = olderGames.length > 0 ? 
      olderGames.reduce((sum, stat) => sum + stat.fantasy_points, 0) / olderGames.length : recentAvg;
    
    const momentum = olderAvg > 0 ? Math.min(2, recentAvg / olderAvg) / 2 : 0.5;
    
    // Calculate rest factor (days since last game)
    const lastGameDate = new Date(sortedStats[0]?.created_at || gameDate);
    const daysSinceLastGame = (gameDate.getTime() - lastGameDate.getTime()) / (24 * 60 * 60 * 1000);
    const fatigueFactor = Math.min(1, Math.max(0.3, (daysSinceLastGame - 2) / 5)); // Optimal rest is 3-7 days
    
    return {
      playerMomentum: momentum,
      injuryRecoveryFactor: 0.5, // Would need injury return tracking
      fatigueFactor: fatigueFactor,
      chemistryRating: 0.7 // Would need lineup consistency tracking
    };
  }
  
  /**
   * Calculate advanced metrics
   */
  private calculateAdvancedFeatures(
    players: any[], 
    stats: any[], 
    injuries: any[]
  ) {
    const totalPlayers = players.length;
    const injuredCount = injuries.length;
    
    // Calculate total fantasy potential
    const totalFantasyPotential = stats.length > 0 ? 
      stats.reduce((sum, stat) => sum + stat.fantasy_points, 0) / stats.length / 30 : 0.5;
    
    // Injury risk based on current injury rate
    const injuryRiskScore = Math.min(1, injuredCount / Math.max(1, totalPlayers * 0.1)); // 10% baseline injury rate
    
    return {
      totalFantasyPotential: Math.min(1, totalFantasyPotential),
      injuryRiskScore: injuryRiskScore,
      experienceRating: 0.6, // Would need age/experience data
      clutchPlayerAvailability: 0.7 // Would need clutch performance tracking
    };
  }
  
  /**
   * Get default features when no data is available
   */
  private getDefaultPlayerFeatures(): EnhancedPlayerFeatures {
    return {
      // Star Player Features
      topPlayerFantasyAvg: 0.5,
      starPlayerAvailability: 0.8,
      startingLineupStrength: 0.5,
      benchDepth: 0.5,
      
      // Positional Features
      quarterbackRating: 0.8,
      offensiveLineStrength: 0.7,
      defensiveRating: 0.7,
      specialTeamsImpact: 0.8,
      
      // Recent Form Features
      playerMomentum: 0.5,
      injuryRecoveryFactor: 0.5,
      fatigueFactor: 0.8,
      chemistryRating: 0.7,
      
      // Advanced Metrics
      totalFantasyPotential: 0.5,
      injuryRiskScore: 0.3,
      experienceRating: 0.6,
      clutchPlayerAvailability: 0.7
    };
  }
}