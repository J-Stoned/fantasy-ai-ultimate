/**
 * Movement Pattern Analyzer
 * Identifies and quantifies player movement tendencies and patterns
 * for use in fantasy projections and matchup analysis
 */

import { createClient } from '@supabase/supabase-js';
import { basketballPitchControl, soccerPitchControl, footballPitchControl } from './pitch-control';

export interface MovementPattern {
  pattern_id: string;
  pattern_type: 'cut' | 'screen' | 'post_up' | 'pick_roll' | 'transition' | 'press' | 'drop_back';
  frequency: number;
  success_rate: number;
  avg_space_created: number;
  preferred_zones: Array<{ x: number; y: number; frequency: number }>;
}

export interface PlayerMovementProfile {
  player_id: string;
  total_distance: number;
  avg_speed: number;
  max_speed: number;
  acceleration_bursts: number;
  movement_patterns: MovementPattern[];
  heat_map: number[][];
  preferred_zones: ZonePreference[];
  off_ball_value: number;
}

export interface ZonePreference {
  zone_id: string;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  time_spent: number;
  actions_per_minute: number;
  success_rate: number;
}

export interface RoutePattern {
  route_type: string;
  avg_separation: number;
  success_rate: number;
  preferred_direction: 'left' | 'right' | 'center';
  avg_depth: number;
  vs_coverage: {
    man: { success_rate: number; avg_separation: number };
    zone: { success_rate: number; avg_separation: number };
  };
}

export class MovementPatternAnalyzer {
  private readonly GRID_SIZE = 50; // For heat map generation
  
  /**
   * Analyze a player's movement patterns from tracking data
   */
  async analyzePlayerMovement(
    playerId: string,
    gameIds: string[],
    sport: 'basketball' | 'soccer' | 'football' = 'basketball'
  ): Promise<PlayerMovementProfile> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch tracking data for the player across games
    const { data: trackingData, error } = await supabase
      .from('player_tracking_data')
      .select('*')
      .eq('player_id', playerId)
      .in('game_id', gameIds)
      .order('timestamp', { ascending: true });

    if (error || !trackingData || trackingData.length === 0) {
      throw new Error(`No tracking data found for player ${playerId}`);
    }

    // Calculate basic movement metrics
    let totalDistance = 0;
    let maxSpeed = 0;
    let accelerationBursts = 0;
    const speeds: number[] = [];

    for (let i = 1; i < trackingData.length; i++) {
      const prev = trackingData[i - 1];
      const curr = trackingData[i];
      
      // Calculate distance traveled
      const distance = Math.sqrt(
        Math.pow(curr.x_position - prev.x_position, 2) +
        Math.pow(curr.y_position - prev.y_position, 2)
      );
      
      totalDistance += distance;
      
      // Track speeds
      if (curr.speed) {
        speeds.push(curr.speed);
        maxSpeed = Math.max(maxSpeed, curr.speed);
        
        // Count acceleration bursts (speed increase > 2 m/s in 1 second)
        if (prev.speed && curr.speed - prev.speed > 2) {
          accelerationBursts++;
        }
      }
    }

    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

    // Generate heat map
    const heatMap = this.generateHeatMap(trackingData);

    // Identify movement patterns
    const patterns = await this.identifyMovementPatterns(trackingData, sport);

    // Calculate zone preferences
    const zonePreferences = this.calculateZonePreferences(trackingData);

    // Calculate off-ball value using pitch control
    const offBallValue = await this.calculateOffBallValue(playerId, gameIds, sport);

    return {
      player_id: playerId,
      total_distance: totalDistance,
      avg_speed: avgSpeed,
      max_speed: maxSpeed,
      acceleration_bursts: accelerationBursts,
      movement_patterns: patterns,
      heat_map: heatMap,
      preferred_zones: zonePreferences,
      off_ball_value: offBallValue,
    };
  }

  /**
   * Generate a heat map of player positions
   */
  private generateHeatMap(trackingData: any[]): number[][] {
    const heatMap = Array(this.GRID_SIZE)
      .fill(0)
      .map(() => Array(this.GRID_SIZE).fill(0));

    // Determine field bounds
    const xMin = Math.min(...trackingData.map(d => d.x_position));
    const xMax = Math.max(...trackingData.map(d => d.x_position));
    const yMin = Math.min(...trackingData.map(d => d.y_position));
    const yMax = Math.max(...trackingData.map(d => d.y_position));

    // Count positions in each grid cell
    trackingData.forEach(data => {
      const xIndex = Math.floor(
        ((data.x_position - xMin) / (xMax - xMin)) * (this.GRID_SIZE - 1)
      );
      const yIndex = Math.floor(
        ((data.y_position - yMin) / (yMax - yMin)) * (this.GRID_SIZE - 1)
      );

      if (xIndex >= 0 && xIndex < this.GRID_SIZE && yIndex >= 0 && yIndex < this.GRID_SIZE) {
        heatMap[yIndex][xIndex]++;
      }
    });

    // Normalize heat map
    const maxCount = Math.max(...heatMap.flat());
    if (maxCount > 0) {
      for (let i = 0; i < this.GRID_SIZE; i++) {
        for (let j = 0; j < this.GRID_SIZE; j++) {
          heatMap[i][j] /= maxCount;
        }
      }
    }

    return heatMap;
  }

  /**
   * Identify specific movement patterns (cuts, screens, etc.)
   */
  private async identifyMovementPatterns(
    trackingData: any[],
    sport: string
  ): Promise<MovementPattern[]> {
    const patterns: MovementPattern[] = [];

    if (sport === 'basketball') {
      // Identify cuts (sharp direction changes with acceleration)
      const cuts = this.identifyCuts(trackingData);
      if (cuts.frequency > 0) patterns.push(cuts);

      // Identify screens (stationary positions near other players)
      const screens = this.identifyScreens(trackingData);
      if (screens.frequency > 0) patterns.push(screens);

      // Identify pick-and-roll patterns
      const pickRoll = this.identifyPickAndRoll(trackingData);
      if (pickRoll.frequency > 0) patterns.push(pickRoll);
    } else if (sport === 'football') {
      // Analyze route patterns from football_routes table
      const routes = await this.analyzeFootballRoutes(trackingData[0].player_id);
      patterns.push(...routes);
    }

    return patterns;
  }

  /**
   * Identify cutting movements (basketball)
   */
  private identifyCuts(trackingData: any[]): MovementPattern {
    let cutCount = 0;
    let successfulCuts = 0;
    const cutZones: Array<{ x: number; y: number }> = [];

    for (let i = 2; i < trackingData.length; i++) {
      const prev2 = trackingData[i - 2];
      const prev1 = trackingData[i - 1];
      const curr = trackingData[i];

      // Calculate direction changes
      const dir1 = Math.atan2(
        prev1.y_position - prev2.y_position,
        prev1.x_position - prev2.x_position
      );
      const dir2 = Math.atan2(
        curr.y_position - prev1.y_position,
        curr.x_position - prev1.x_position
      );

      const dirChange = Math.abs(dir2 - dir1);

      // Identify sharp cuts (> 45 degrees with acceleration)
      if (dirChange > Math.PI / 4 && curr.speed > prev1.speed * 1.5) {
        cutCount++;
        cutZones.push({ x: curr.x_position, y: curr.y_position });

        // Assume successful if player receives ball within 2 seconds
        // (In real implementation, would check ball possession data)
        if (Math.random() > 0.4) successfulCuts++;
      }
    }

    // Group cut zones
    const preferredZones = this.clusterZones(cutZones);

    return {
      pattern_id: 'cut',
      pattern_type: 'cut',
      frequency: cutCount,
      success_rate: cutCount > 0 ? successfulCuts / cutCount : 0,
      avg_space_created: 2.5, // Placeholder - would calculate from pitch control
      preferred_zones: preferredZones,
    };
  }

  /**
   * Identify screen setting patterns (basketball)
   */
  private identifyScreens(trackingData: any[]): MovementPattern {
    let screenCount = 0;
    let successfulScreens = 0;
    const screenZones: Array<{ x: number; y: number }> = [];

    for (let i = 10; i < trackingData.length; i++) {
      const recent = trackingData.slice(i - 10, i);
      const avgSpeed = recent.reduce((sum, d) => sum + (d.speed || 0), 0) / recent.length;

      // Identify stationary positions (potential screens)
      if (avgSpeed < 0.5 && trackingData[i].speed < 0.5) {
        screenCount++;
        screenZones.push({ 
          x: trackingData[i].x_position, 
          y: trackingData[i].y_position 
        });

        // Placeholder success rate
        if (Math.random() > 0.3) successfulScreens++;
      }
    }

    const preferredZones = this.clusterZones(screenZones);

    return {
      pattern_id: 'screen',
      pattern_type: 'screen',
      frequency: screenCount,
      success_rate: screenCount > 0 ? successfulScreens / screenCount : 0,
      avg_space_created: 3.2, // Screens typically create more space
      preferred_zones: preferredZones,
    };
  }

  /**
   * Identify pick-and-roll patterns
   */
  private identifyPickAndRoll(trackingData: any[]): MovementPattern {
    // Simplified implementation - would need multi-player tracking
    const pnrCount = Math.floor(trackingData.length / 500); // Rough estimate
    
    return {
      pattern_id: 'pick_roll',
      pattern_type: 'pick_roll',
      frequency: pnrCount,
      success_rate: 0.65, // League average placeholder
      avg_space_created: 4.1,
      preferred_zones: [
        { x: 50, y: 25, frequency: 0.6 }, // Top of key
        { x: 40, y: 20, frequency: 0.2 }, // Wing
        { x: 40, y: 30, frequency: 0.2 }, // Wing
      ],
    };
  }

  /**
   * Analyze football route patterns
   */
  private async analyzeFootballRoutes(playerId: string): Promise<MovementPattern[]> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: routes, error } = await supabase
      .from('football_routes')
      .select('*')
      .eq('player_id', playerId);

    if (error || !routes) return [];

    // Group by route type
    const routeGroups = new Map<string, any[]>();
    routes.forEach(route => {
      if (!routeGroups.has(route.route_type)) {
        routeGroups.set(route.route_type, []);
      }
      routeGroups.get(route.route_type)!.push(route);
    });

    const patterns: MovementPattern[] = [];

    routeGroups.forEach((routeData, routeType) => {
      const avgSeparation = routeData.reduce((sum, r) => sum + (r.separation_at_catch || 0), 0) / routeData.length;
      const successRate = routeData.filter(r => r.reception).length / routeData.length;

      patterns.push({
        pattern_id: `route_${routeType}`,
        pattern_type: 'transition',
        frequency: routeData.length,
        success_rate: successRate,
        avg_space_created: avgSeparation,
        preferred_zones: this.getRouteZones(routeType, routeData),
      });
    });

    return patterns;
  }

  /**
   * Calculate zone preferences from tracking data
   */
  private calculateZonePreferences(trackingData: any[]): ZonePreference[] {
    // Divide field into zones (e.g., 3x3 grid)
    const zones: Map<string, ZonePreference> = new Map();
    
    // Simple 3x3 grid
    const zoneWidth = 30;
    const zoneHeight = 20;

    trackingData.forEach(data => {
      const zoneX = Math.floor(data.x_position / zoneWidth);
      const zoneY = Math.floor(data.y_position / zoneHeight);
      const zoneId = `${zoneX}_${zoneY}`;

      if (!zones.has(zoneId)) {
        zones.set(zoneId, {
          zone_id: zoneId,
          x_min: zoneX * zoneWidth,
          x_max: (zoneX + 1) * zoneWidth,
          y_min: zoneY * zoneHeight,
          y_max: (zoneY + 1) * zoneHeight,
          time_spent: 0,
          actions_per_minute: 0,
          success_rate: 0.5, // Placeholder
        });
      }

      const zone = zones.get(zoneId)!;
      zone.time_spent++;
    });

    // Convert to array and calculate percentages
    const totalTime = trackingData.length;
    return Array.from(zones.values())
      .map(zone => ({
        ...zone,
        time_spent: zone.time_spent / totalTime,
        actions_per_minute: (zone.time_spent / totalTime) * 60, // Rough estimate
      }))
      .sort((a, b) => b.time_spent - a.time_spent)
      .slice(0, 5); // Top 5 zones
  }

  /**
   * Calculate off-ball value using pitch control changes
   */
  private async calculateOffBallValue(
    playerId: string,
    gameIds: string[],
    sport: string
  ): Promise<number> {
    let totalValue = 0;

    // Get appropriate pitch control model
    const pitchControl = sport === 'basketball' ? basketballPitchControl :
                        sport === 'soccer' ? soccerPitchControl :
                        footballPitchControl;

    for (const gameId of gameIds) {
      // This would calculate space creation value for each game
      // Using the pitch control model's space creation calculation
      const value = await pitchControl.calculateSpaceCreationValue(
        playerId,
        gameId,
        0, // Start time
        3600 // End time (1 hour)
      );
      
      totalValue += value;
    }

    return totalValue / gameIds.length; // Average per game
  }

  /**
   * Cluster position data into zones
   */
  private clusterZones(
    positions: Array<{ x: number; y: number }>
  ): Array<{ x: number; y: number; frequency: number }> {
    if (positions.length === 0) return [];

    // Simple k-means clustering (k=3)
    const k = Math.min(3, positions.length);
    const clusters: Array<{ x: number; y: number; count: number }> = [];

    // Initialize cluster centers
    for (let i = 0; i < k; i++) {
      const idx = Math.floor((positions.length / k) * i);
      clusters.push({
        x: positions[idx].x,
        y: positions[idx].y,
        count: 0,
      });
    }

    // Assign points to clusters (simplified)
    positions.forEach(pos => {
      let minDist = Infinity;
      let nearestCluster = 0;

      clusters.forEach((cluster, idx) => {
        const dist = Math.sqrt(
          Math.pow(pos.x - cluster.x, 2) + Math.pow(pos.y - cluster.y, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = idx;
        }
      });

      clusters[nearestCluster].count++;
    });

    return clusters
      .filter(c => c.count > 0)
      .map(c => ({
        x: c.x,
        y: c.y,
        frequency: c.count / positions.length,
      }));
  }

  /**
   * Get typical zones for football routes
   */
  private getRouteZones(
    routeType: string,
    routeData: any[]
  ): Array<{ x: number; y: number; frequency: number }> {
    // Simplified zone mapping based on route type
    const routeZones: Record<string, Array<{ x: number; y: number; frequency: number }>> = {
      'slant': [{ x: 15, y: 25, frequency: 0.8 }],
      'go': [{ x: 40, y: 10, frequency: 0.7 }, { x: 40, y: 40, frequency: 0.3 }],
      'out': [{ x: 20, y: 5, frequency: 0.9 }],
      'in': [{ x: 20, y: 25, frequency: 0.9 }],
      'post': [{ x: 30, y: 25, frequency: 0.8 }],
      'corner': [{ x: 30, y: 10, frequency: 0.8 }],
    };

    return routeZones[routeType] || [{ x: 20, y: 25, frequency: 1.0 }];
  }

  /**
   * Compare two players' movement patterns for compatibility
   */
  async comparePlayerCompatibility(
    player1Id: string,
    player2Id: string,
    gameIds: string[]
  ): Promise<{
    compatibility_score: number;
    complementary_patterns: string[];
    overlapping_zones: number;
  }> {
    const player1Profile = await this.analyzePlayerMovement(player1Id, gameIds);
    const player2Profile = await this.analyzePlayerMovement(player2Id, gameIds);

    // Check for complementary patterns
    const complementaryPatterns: string[] = [];
    
    // Good combinations
    if (player1Profile.movement_patterns.some(p => p.pattern_type === 'screen') &&
        player2Profile.movement_patterns.some(p => p.pattern_type === 'cut')) {
      complementaryPatterns.push('screen_and_cut');
    }

    if (player1Profile.movement_patterns.some(p => p.pattern_type === 'post_up') &&
        player2Profile.movement_patterns.some(p => p.pattern_type === 'cut')) {
      complementaryPatterns.push('post_and_cut');
    }

    // Calculate zone overlap (lower is better for spacing)
    let zoneOverlap = 0;
    player1Profile.preferred_zones.forEach(zone1 => {
      player2Profile.preferred_zones.forEach(zone2 => {
        if (Math.abs(zone1.x_min - zone2.x_min) < 10 &&
            Math.abs(zone1.y_min - zone2.y_min) < 10) {
          zoneOverlap += zone1.time_spent * zone2.time_spent;
        }
      });
    });

    // Calculate compatibility score
    const patternBonus = complementaryPatterns.length * 0.2;
    const spacingScore = 1 - Math.min(zoneOverlap, 1);
    const compatibilityScore = (spacingScore + patternBonus) / 1.2;

    return {
      compatibility_score: Math.min(compatibilityScore, 1),
      complementary_patterns: complementaryPatterns,
      overlapping_zones: zoneOverlap,
    };
  }
}

// Export singleton instance
export const movementAnalyzer = new MovementPatternAnalyzer();