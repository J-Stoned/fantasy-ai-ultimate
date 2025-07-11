/**
 * Fantasy Sports API Service
 * Connects to GPU-powered lineup optimization and fantasy insights
 */

import { API_CONFIG, ENDPOINTS, LineupConfig, PlayerProjection, SportType } from './api-config'

export interface Lineup {
  players: Array<{
    playerId: string
    playerName: string
    position: string
    team: string
    projection: number
    salary?: number
    patternBoost?: number
    // Spatial analytics enhancements
    xgContribution?: number
    spaceCreationValue?: number
    movementEfficiency?: number
    spatialSynergies?: Array<{
      withPlayer: string
      synergyScore: number
      patternType: string
    }>
  }>
  totalProjection: number
  totalSalary?: number
  patternAdvantages: string[]
  // Spatial metrics
  teamSpacingScore?: number
  offensiveSynergy?: number
  defensiveCoverage?: number
  confidence: number
}

export interface TradeProposal {
  give: string[]
  receive: string[]
  leagueId: string
  scoringSystem: string
}

export interface TradeAnalysis {
  recommendation: 'accept' | 'reject' | 'counter'
  marketValueDiff: number
  projectionDiff: number
  scheduleAnalysis: {
    give: number
    receive: number
  }
  patternImpact: {
    give: Array<{ player: string; patterns: string[] }>
    receive: Array<{ player: string; patterns: string[] }>
  }
  counterOffer?: {
    give: string[]
    receive: string[]
    reasoning: string
  }
  confidence: number
  reasoning: string
}

export interface WaiverTarget {
  playerId: string
  playerName: string
  team: string
  position: string
  availabilityPercentage: number
  projectedPoints: number
  patternOpportunities: string[]
  priority: number
  reasoning: string
}

export interface FantasyInsight {
  type: 'lineup' | 'trade' | 'waiver' | 'pattern'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  actionable: boolean
  data: any
}

// Spatial Analytics Interfaces
export interface SpatialProjection {
  playerId: string
  playerName: string
  traditionalProjection: number
  spatialComponents: {
    expectedGoalsBonus: number
    spaceCreationBonus: number
    movementEfficiencyBonus: number
    defensiveImpactBonus: number
    synergyBonus: number
  }
  spatialProjection: number
  projectionRange: [number, number]
  keyAdvantages: string[]
  recommendedStacks: Array<{
    partnerId: string
    partnerName: string
    stackBonus: number
    reason: string
  }>
}

export interface PitchControlData {
  timestamp: number
  grid: number[][]
  teamControl: {
    home: number
    away: number
  }
  highValueAreas: Array<{
    x: number
    y: number
    control: number
  }>
}

export interface MovementPattern {
  playerId: string
  patternType: string
  frequency: number
  successRate: number
  avgSpaceCreated: number
  preferredZones: Array<{
    x: number
    y: number
    frequency: number
  }>
}

class FantasyAPI {
  private baseUrl: string
  private headers: Record<string, string>

  constructor() {
    // Use internal API routes instead of external service
    this.baseUrl = ''
    this.headers = {
      'Content-Type': 'application/json',
    }
  }

  /**
   * Optimize lineup using GPU-powered optimizer
   */
  async optimizeLineup(config: LineupConfig): Promise<Lineup> {
    try {
      const response = await fetch(`${this.baseUrl}${ENDPOINTS.FANTASY.OPTIMIZE_LINEUP}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(config),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to optimize lineup: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error optimizing lineup:', error)
      throw error
    }
  }

  /**
   * Analyze trade proposal with pattern insights
   */
  async analyzeTrade(proposal: TradeProposal): Promise<TradeAnalysis> {
    try {
      const response = await fetch(`${this.baseUrl}${ENDPOINTS.FANTASY.ANALYZE_TRADE}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(proposal),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to analyze trade: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error analyzing trade:', error)
      throw error
    }
  }

  /**
   * Get waiver wire targets based on patterns
   */
  async getWaiverTargets(
    leagueId: string,
    positions?: string[],
    limit: number = 10
  ): Promise<WaiverTarget[]> {
    try {
      const params = new URLSearchParams({
        leagueId,
        limit: limit.toString(),
      })
      
      if (positions?.length) {
        params.append('positions', positions.join(','))
      }
      
      const response = await fetch(
        `${this.baseUrl}${ENDPOINTS.FANTASY.WAIVER_TARGETS}?${params}`,
        { headers: this.headers }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch waiver targets: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching waiver targets:', error)
      throw error
    }
  }

  /**
   * Get player projection with pattern effects
   */
  async getPlayerProjection(
    playerId: string,
    includePatterns: boolean = true
  ): Promise<PlayerProjection> {
    try {
      const params = new URLSearchParams({
        includePatterns: includePatterns.toString(),
      })
      
      const response = await fetch(
        `${this.baseUrl}${ENDPOINTS.FANTASY.PLAYER_PROJECTION}/${playerId}?${params}`,
        { headers: this.headers }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch player projection: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching player projection:', error)
      throw error
    }
  }

  /**
   * Get unified insights (betting + fantasy + DFS)
   */
  async getInsights(sport: SportType, format: 'all' | 'fantasy' | 'dfs' = 'all'): Promise<FantasyInsight[]> {
    try {
      const response = await fetch(`${API_CONFIG.UNIFIED_PATTERN_API}${ENDPOINTS.UNIFIED.INSIGHTS}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ sport, format }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching insights:', error)
      throw error
    }
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(command: string, context?: any): Promise<any> {
    try {
      const response = await fetch(`${API_CONFIG.UNIFIED_PATTERN_API}${ENDPOINTS.UNIFIED.VOICE_COMMAND}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ command, context }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to process voice command: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error processing voice command:', error)
      throw error
    }
  }

  /**
   * Get spatial analytics projection for a player
   */
  async getSpatialProjection(playerId: string): Promise<SpatialProjection> {
    try {
      const response = await fetch(`${this.baseUrl}/api/spatial/player-projection/${playerId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get spatial projection: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error getting spatial projection:', error)
      throw error
    }
  }

  /**
   * Get pitch control data for a game
   */
  async getPitchControl(gameId: string, timestamp?: number): Promise<PitchControlData> {
    try {
      const params = timestamp ? `?timestamp=${timestamp}` : ''
      const response = await fetch(`${this.baseUrl}/api/spatial/pitch-control/${gameId}${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get pitch control: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error getting pitch control:', error)
      throw error
    }
  }

  /**
   * Get movement patterns for a player
   */
  async getMovementPatterns(playerId: string): Promise<MovementPattern[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/spatial/movement-patterns/${playerId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get movement patterns: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error getting movement patterns:', error)
      throw error
    }
  }

  /**
   * Optimize lineup with spatial analytics
   */
  async optimizeWithSpatial(config: LineupConfig & { 
    includeSpatial?: boolean 
    spatialWeight?: number 
  }): Promise<Lineup> {
    try {
      const response = await fetch(`${this.baseUrl}/api/spatial/lineup-optimizer`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          ...config,
          includeSpatial: config.includeSpatial ?? true,
          spatialWeight: config.spatialWeight ?? 0.3
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to optimize with spatial: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error optimizing with spatial:', error)
      throw error
    }
  }
}

// Export singleton instance
export const fantasyAPI = new FantasyAPI()

// Export types for use in components
export type {
  Lineup,
  TradeProposal,
  TradeAnalysis,
  WaiverTarget,
  FantasyInsight,
  PlayerProjection,
  LineupConfig,
  SportType
} from './api-config'