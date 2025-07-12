/**
 * Pitch Control Model Implementation
 * Based on Dr. Aris Thorne's spatial control methodology
 * 
 * This model quantifies control of space on the field/court at any moment,
 * which becomes the foundation for valuing off-ball actions.
 */

import { createClient } from '@/lib/supabase/server';

export interface PlayerPosition {
  player_id: string;
  team_id: string;
  x_position: number;
  y_position: number;
  x_velocity: number;
  y_velocity: number;
  timestamp: number;
}

export interface PitchControlGrid {
  width: number;
  height: number;
  resolution: number;
  control_surface: number[][];
  timestamp: number;
}

export interface TeamControlMetrics {
  total_control: number;
  offensive_third_control: number;
  defensive_third_control: number;
  central_control: number;
  high_value_areas: Array<{ x: number; y: number; control: number }>;
}

export class PitchControlModel {
  // Field dimensions (configurable by sport)
  private fieldDimensions = {
    soccer: { length: 105, width: 68 }, // meters
    basketball: { length: 28.65, width: 15.24 }, // meters
    football: { length: 109.7, width: 48.8 }, // meters
    hockey: { length: 60.96, width: 25.9 }, // meters
  };

  private currentSport: keyof typeof this.fieldDimensions = 'basketball';
  private gridResolution = 1; // meters per grid cell

  constructor(sport: keyof typeof this.fieldDimensions = 'basketball') {
    this.currentSport = sport;
  }

  /**
   * Calculate a single player's influence surface
   * Influence is modeled as a bivariate normal distribution
   */
  private calculatePlayerInfluence(
    player: PlayerPosition,
    grid: { x: number; y: number }[][],
    ballPosition: { x: number; y: number },
    timeToIntercept: number = 0.7
  ): number[][] {
    const { length, width } = this.fieldDimensions[this.currentSport];
    const influence = Array(Math.ceil(width / this.gridResolution))
      .fill(0)
      .map(() => Array(Math.ceil(length / this.gridResolution)).fill(0));

    // Predict future position based on velocity
    const predictedX = player.x_position + player.x_velocity * timeToIntercept;
    const predictedY = player.y_position + player.y_velocity * timeToIntercept;

    // Calculate speed and control radius
    const speed = Math.sqrt(player.x_velocity ** 2 + player.y_velocity ** 2);
    const controlRadius = 3 + speed * 0.5; // Players control more space when moving faster

    // Weight influence by inverse distance to ball
    const distToBall = Math.sqrt(
      (player.x_position - ballPosition.x) ** 2 +
      (player.y_position - ballPosition.y) ** 2
    );
    const influenceWeight = Math.exp(-0.1 * distToBall);

    // Calculate influence at each grid point
    for (let i = 0; i < influence.length; i++) {
      for (let j = 0; j < influence[i].length; j++) {
        const gridX = j * this.gridResolution;
        const gridY = i * this.gridResolution;
        
        const distToPlayer = Math.sqrt(
          (gridX - predictedX) ** 2 + (gridY - predictedY) ** 2
        );

        // Gaussian influence based on distance
        influence[i][j] = 
          influenceWeight * Math.exp(-(distToPlayer ** 2) / (2 * controlRadius ** 2));
      }
    }

    return influence;
  }

  /**
   * Calculate pitch control for all players at a specific moment
   */
  calculatePitchControl(
    players: PlayerPosition[],
    ballPosition: { x: number; y: number },
    timestamp: number
  ): PitchControlGrid {
    const { length, width } = this.fieldDimensions[this.currentSport];
    const gridWidth = Math.ceil(width / this.gridResolution);
    const gridLength = Math.ceil(length / this.gridResolution);

    // Create coordinate grid
    const grid = Array(gridWidth)
      .fill(0)
      .map((_, i) =>
        Array(gridLength)
          .fill(0)
          .map((_, j) => ({
            x: j * this.gridResolution,
            y: i * this.gridResolution,
          }))
      );

    // Separate players by team
    const teams = new Map<string, PlayerPosition[]>();
    players.forEach(player => {
      if (!teams.has(player.team_id)) {
        teams.set(player.team_id, []);
      }
      teams.get(player.team_id)!.push(player);
    });

    // Calculate influence for each team
    const teamInfluences = new Map<string, number[][]>();
    teams.forEach((teamPlayers, teamId) => {
      const teamInfluence = Array(gridWidth)
        .fill(0)
        .map(() => Array(gridLength).fill(0));

      teamPlayers.forEach(player => {
        const playerInfluence = this.calculatePlayerInfluence(
          player,
          grid,
          ballPosition
        );

        // Add to team total
        for (let i = 0; i < gridWidth; i++) {
          for (let j = 0; j < gridLength; j++) {
            teamInfluence[i][j] += playerInfluence[i][j];
          }
        }
      });

      teamInfluences.set(teamId, teamInfluence);
    });

    // Calculate control surface (probability team A controls each point)
    const controlSurface = Array(gridWidth)
      .fill(0)
      .map(() => Array(gridLength).fill(0));

    const teamIds = Array.from(teams.keys());
    if (teamIds.length >= 2) {
      const team1Influence = teamInfluences.get(teamIds[0])!;
      const team2Influence = teamInfluences.get(teamIds[1])!;

      for (let i = 0; i < gridWidth; i++) {
        for (let j = 0; j < gridLength; j++) {
          const total = team1Influence[i][j] + team2Influence[i][j] + 1e-10;
          controlSurface[i][j] = team1Influence[i][j] / total;
        }
      }
    }

    return {
      width: gridWidth,
      height: gridLength,
      resolution: this.gridResolution,
      control_surface: controlSurface,
      timestamp,
    };
  }

  /**
   * Calculate team-level control metrics
   */
  calculateTeamControlMetrics(
    pitchControl: PitchControlGrid,
    teamId: string
  ): TeamControlMetrics {
    const { control_surface, width, height } = pitchControl;
    const { length } = this.fieldDimensions[this.currentSport];
    
    let totalControl = 0;
    let offensiveThirdControl = 0;
    let defensiveThirdControl = 0;
    let centralControl = 0;
    const highValueAreas: Array<{ x: number; y: number; control: number }> = [];

    const thirdLength = length / 3;
    const centralWidth = width / 3;

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const control = control_surface[i][j];
        const x = j * this.gridResolution;
        const y = i * this.gridResolution;

        totalControl += control;

        // Check which third
        if (x > 2 * thirdLength) {
          offensiveThirdControl += control;
        } else if (x < thirdLength) {
          defensiveThirdControl += control;
        }

        // Check if central
        if (y > centralWidth && y < 2 * centralWidth) {
          centralControl += control;
        }

        // Track high control areas
        if (control > 0.7) {
          highValueAreas.push({ x, y, control });
        }
      }
    }

    // Normalize by grid size
    const gridSize = width * height;
    
    return {
      total_control: totalControl / gridSize,
      offensive_third_control: offensiveThirdControl / (gridSize / 3),
      defensive_third_control: defensiveThirdControl / (gridSize / 3),
      central_control: centralControl / (gridSize / 3),
      high_value_areas: highValueAreas.sort((a, b) => b.control - a.control).slice(0, 10),
    };
  }

  /**
   * Value off-ball movement by change in team control
   */
  async valueOffBallMovement(
    playersBefore: PlayerPosition[],
    playersAfter: PlayerPosition[],
    ballPosition: { x: number; y: number },
    playerId: string
  ): Promise<{
    value_created: number;
    space_opened: number;
    defensive_disruption: number;
  }> {
    // Calculate control before movement
    const controlBefore = this.calculatePitchControl(
      playersBefore,
      ballPosition,
      playersBefore[0].timestamp
    );

    // Calculate control after movement
    const controlAfter = this.calculatePitchControl(
      playersAfter,
      ballPosition,
      playersAfter[0].timestamp
    );

    // Find the player who moved
    const mover = playersAfter.find(p => p.player_id === playerId);
    if (!mover) {
      return { value_created: 0, space_opened: 0, defensive_disruption: 0 };
    }

    // Calculate metrics for mover's team
    const metricsBefore = this.calculateTeamControlMetrics(controlBefore, mover.team_id);
    const metricsAfter = this.calculateTeamControlMetrics(controlAfter, mover.team_id);

    // Value is the increase in control, especially in high-value areas
    const value_created = metricsAfter.total_control - metricsBefore.total_control;
    const space_opened = metricsAfter.offensive_third_control - metricsBefore.offensive_third_control;
    
    // Defensive disruption is how much opponent control decreased
    const defensive_disruption = metricsBefore.total_control - metricsAfter.total_control;

    return {
      value_created,
      space_opened,
      defensive_disruption: Math.max(0, defensive_disruption),
    };
  }

  /**
   * Get real-time pitch control from tracking data
   */
  async getRealTimePitchControl(gameId: string, timestamp: number) {
    const supabase = createClient();

    // Get player positions at specific timestamp
    const { data: trackingData, error } = await supabase
      .from('player_tracking_data')
      .select('*')
      .eq('game_id', gameId)
      .gte('timestamp', timestamp - 0.5)
      .lte('timestamp', timestamp + 0.5)
      .order('timestamp', { ascending: true });

    if (error || !trackingData || trackingData.length === 0) {
      console.error('Error fetching tracking data:', error);
      return null;
    }

    // Get ball position (assuming it's tracked as a special "player")
    const ballTracking = trackingData.find(t => t.player_id === 'ball');
    const ballPosition = ballTracking 
      ? { x: ballTracking.x_position, y: ballTracking.y_position }
      : { x: 50, y: 25 }; // Default to center if not found

    // Convert tracking data to PlayerPosition format
    const players: PlayerPosition[] = trackingData
      .filter(t => t.player_id !== 'ball')
      .map(t => ({
        player_id: t.player_id,
        team_id: t.team_id,
        x_position: t.x_position,
        y_position: t.y_position,
        x_velocity: t.speed * Math.cos(t.direction || 0),
        y_velocity: t.speed * Math.sin(t.direction || 0),
        timestamp: t.timestamp,
      }));

    return this.calculatePitchControl(players, ballPosition, timestamp);
  }

  /**
   * Calculate space creation value over a time period
   */
  async calculateSpaceCreationValue(
    playerId: string,
    gameId: string,
    startTime: number,
    endTime: number
  ): Promise<number> {
    const supabase = createClient();

    // Get all tracking data for the time period
    const { data: trackingData, error } = await supabase
      .from('player_tracking_data')
      .select('*')
      .eq('game_id', gameId)
      .gte('timestamp', startTime)
      .lte('timestamp', endTime)
      .order('timestamp', { ascending: true });

    if (error || !trackingData) {
      console.error('Error fetching tracking data:', error);
      return 0;
    }

    // Group by timestamp
    const timeGroups = new Map<number, typeof trackingData>();
    trackingData.forEach(data => {
      const key = Math.floor(data.timestamp);
      if (!timeGroups.has(key)) {
        timeGroups.set(key, []);
      }
      timeGroups.get(key)!.push(data);
    });

    let totalValue = 0;
    const timestamps = Array.from(timeGroups.keys()).sort((a, b) => a - b);

    // Calculate value created between consecutive timestamps
    for (let i = 1; i < timestamps.length; i++) {
      const before = timeGroups.get(timestamps[i - 1])!;
      const after = timeGroups.get(timestamps[i])!;

      const ballBefore = before.find(t => t.player_id === 'ball');
      const ballPosition = ballBefore
        ? { x: ballBefore.x_position, y: ballBefore.y_position }
        : { x: 50, y: 25 };

      const playersBefore = before
        .filter(t => t.player_id !== 'ball')
        .map(t => ({
          player_id: t.player_id,
          team_id: t.team_id,
          x_position: t.x_position,
          y_position: t.y_position,
          x_velocity: t.speed * Math.cos(t.direction || 0),
          y_velocity: t.speed * Math.sin(t.direction || 0),
          timestamp: t.timestamp,
        }));

      const playersAfter = after
        .filter(t => t.player_id !== 'ball')
        .map(t => ({
          player_id: t.player_id,
          team_id: t.team_id,
          x_position: t.x_position,
          y_position: t.y_position,
          x_velocity: t.speed * Math.cos(t.direction || 0),
          y_velocity: t.speed * Math.sin(t.direction || 0),
          timestamp: t.timestamp,
        }));

      const movement = await this.valueOffBallMovement(
        playersBefore,
        playersAfter,
        ballPosition,
        playerId
      );

      totalValue += movement.value_created + movement.space_opened * 0.5;
    }

    return totalValue;
  }
}

// Export singleton instances for different sports
export const basketballPitchControl = new PitchControlModel('basketball');
export const soccerPitchControl = new PitchControlModel('soccer');
export const footballPitchControl = new PitchControlModel('football');
export const hockeyPitchControl = new PitchControlModel('hockey');