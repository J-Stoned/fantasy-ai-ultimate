/**
 * Pattern Detection API Service
 * Connects to the 65.2% accuracy pattern detection backend
 */

import { API_CONFIG, ENDPOINTS, Pattern, Opportunity } from './api-config'

export interface PatternStats {
  totalPatterns: number
  totalGamesAnalyzed: number
  patternOccurrences: number
  highValueOpportunities: number
  profitPotential: number
  averageAccuracy: number
  bestPattern: {
    name: string
    accuracy: number
    roi: number
  }
}

export interface GameAnalysis {
  gameId: string
  patterns: Array<{
    patternName: string
    triggered: boolean
    confidence: number
    expectedValue: number
    details: Record<string, any>
  }>
  recommendation: string
  totalConfidence: number
}

export interface PerformanceMetrics {
  pattern: string
  accuracy: number
  roi: number
  totalBets: number
  wins: number
  losses: number
  profit: number
  lastUpdated: Date
}

class PatternAPI {
  private baseUrl: string
  private headers: Record<string, string>

  constructor() {
    this.baseUrl = API_CONFIG.PATTERN_API_V4
    this.headers = {
      'Content-Type': 'application/json',
    }
    
    if (API_CONFIG.PATTERN_API_KEY) {
      this.headers['X-API-Key'] = API_CONFIG.PATTERN_API_KEY
    }
  }

  /**
   * Get system statistics
   */
  async getStats(): Promise<PatternStats> {
    try {
      const response = await fetch(`${this.baseUrl}${ENDPOINTS.PATTERN.STATS}`, {
        headers: this.headers,
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching pattern stats:', error)
      throw error
    }
  }

  /**
   * Get all available patterns
   */
  async getPatterns(): Promise<Pattern[]> {
    try {
      const response = await fetch(`${this.baseUrl}${ENDPOINTS.PATTERN.PATTERNS}`, {
        headers: this.headers,
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch patterns: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching patterns:', error)
      throw error
    }
  }

  /**
   * Analyze a specific game
   */
  async analyzeGame(gameId: string): Promise<GameAnalysis> {
    try {
      const response = await fetch(`${this.baseUrl}${ENDPOINTS.PATTERN.ANALYZE}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ gameId }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to analyze game: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error analyzing game:', error)
      throw error
    }
  }

  /**
   * Get current betting opportunities
   */
  async getOpportunities(sport?: string, minConfidence?: number): Promise<Opportunity[]> {
    try {
      const params = new URLSearchParams()
      if (sport) params.append('sport', sport)
      if (minConfidence) params.append('minConfidence', minConfidence.toString())
      
      const response = await fetch(
        `${this.baseUrl}${ENDPOINTS.PATTERN.OPPORTUNITIES}?${params}`,
        { headers: this.headers }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching opportunities:', error)
      throw error
    }
  }

  /**
   * Get historical performance metrics
   */
  async getPerformance(patternName?: string): Promise<PerformanceMetrics[]> {
    try {
      const params = patternName ? `?pattern=${encodeURIComponent(patternName)}` : ''
      const response = await fetch(
        `${this.baseUrl}${ENDPOINTS.PATTERN.PERFORMANCE}${params}`,
        { headers: this.headers }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch performance: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error fetching performance:', error)
      throw error
    }
  }

  /**
   * Subscribe to pattern alerts via Server-Sent Events
   */
  subscribeToAlerts(callback: (alert: Opportunity) => void): EventSource {
    const eventSource = new EventSource(`${this.baseUrl}/api/alerts/stream`)
    
    eventSource.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data)
        callback(alert)
      } catch (error) {
        console.error('Error parsing alert:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error)
    }
    
    return eventSource
  }
}

// Export singleton instance
export const patternAPI = new PatternAPI()

// Export types
export type { Pattern, Opportunity } from './api-config'