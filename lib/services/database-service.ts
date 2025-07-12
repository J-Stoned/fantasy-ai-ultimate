/**
 * STANDARDIZED DATABASE SERVICE
 * Central service for all database interactions across the platform
 * Ensures consistent error handling, retries, and data validation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

export interface DatabaseConfig {
  maxRetries?: number
  retryDelay?: number
  batchSize?: number
  enableLogging?: boolean
}

export class DatabaseService {
  private static instance: DatabaseService
  private supabase: SupabaseClient
  private config: DatabaseConfig
  
  private constructor(config: DatabaseConfig = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 100,
      enableLogging: true,
      ...config
    }
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  
  static getInstance(config?: DatabaseConfig): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(config)
    }
    return DatabaseService.instance
  }
  
  /**
   * Execute a query with automatic retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        if (this.config.enableLogging) {
          console.error(chalk.red(`${operationName} failed (attempt ${attempt}/${this.config.maxRetries}):`), error)
        }
        
        if (attempt < this.config.maxRetries!) {
          await this.sleep(this.config.retryDelay! * attempt)
        }
      }
    }
    
    throw lastError
  }
  
  /**
   * Get games with consistent error handling
   */
  async getGames(filters: {
    sport?: string
    status?: string
    startDate?: string
    endDate?: string
    hasUniversalId?: boolean
    limit?: number
  }) {
    return this.executeWithRetry(async () => {
      let query = this.supabase
        .from('games')
        .select('*')
      
      if (filters.sport) query = query.eq('sport', filters.sport)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.startDate) query = query.gte('start_time', filters.startDate)
      if (filters.endDate) query = query.lte('start_time', filters.endDate)
      if (filters.hasUniversalId === true) query = query.not('universal_id', 'is', null)
      if (filters.hasUniversalId === false) query = query.is('universal_id', null)
      if (filters.limit) query = query.limit(filters.limit)
      
      const { data, error } = await query
      
      if (error) throw error
      return data || []
    }, 'getGames')
  }
  
  /**
   * Get player game logs with consistent filtering
   */
  async getPlayerGameLogs(filters: {
    gameId?: number
    playerId?: number
    teamId?: number
    minFantasyPoints?: number
    limit?: number
  }) {
    return this.executeWithRetry(async () => {
      let query = this.supabase
        .from('player_game_logs')
        .select('*')
      
      if (filters.gameId) query = query.eq('game_id', filters.gameId)
      if (filters.playerId) query = query.eq('player_id', filters.playerId)
      if (filters.teamId) query = query.eq('team_id', filters.teamId)
      if (filters.minFantasyPoints) query = query.gte('fantasy_points', filters.minFantasyPoints)
      if (filters.limit) query = query.limit(filters.limit)
      
      const { data, error } = await query
      
      if (error) throw error
      return data || []
    }, 'getPlayerGameLogs')
  }
  
  /**
   * Count records with consistent error handling
   */
  async countRecords(table: string, filters: Record<string, any> = {}) {
    return this.executeWithRetry(async () => {
      let query = this.supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) {
          query = query.eq(key, value)
        }
      }
      
      const { count, error } = await query
      
      if (error) throw error
      return count || 0
    }, `count${table}`)
  }
  
  /**
   * Upsert records with batch processing
   */
  async upsertBatch<T>(
    table: string,
    records: T[],
    options: {
      onConflict?: string
      batchSize?: number
    } = {}
  ) {
    const batchSize = options.batchSize || this.config.batchSize!
    const results = []
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      const result = await this.executeWithRetry(async () => {
        const { data, error } = await this.supabase
          .from(table)
          .upsert(batch as any, { onConflict: options.onConflict })
        
        if (error) throw error
        return data
      }, `upsert${table}Batch`)
      
      results.push(...(result || []))
      
      // Log progress
      if (this.config.enableLogging && records.length > batchSize) {
        const progress = Math.min(i + batchSize, records.length)
        console.log(chalk.cyan(`Processed ${progress}/${records.length} records`))
      }
    }
    
    return results
  }
  
  /**
   * Get teams with caching
   */
  private teamCache: Map<number, any> = new Map()
  
  async getTeam(teamId: number) {
    if (this.teamCache.has(teamId)) {
      return this.teamCache.get(teamId)
    }
    
    const team = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single()
      
      if (error) throw error
      return data
    }, 'getTeam')
    
    if (team) {
      this.teamCache.set(teamId, team)
    }
    
    return team
  }
  
  /**
   * Ensure players exist before inserting logs
   */
  async ensurePlayersExist(playerIds: number[]) {
    const uniqueIds = [...new Set(playerIds)]
    
    const existingPlayers = await this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('players')
        .select('id')
        .in('id', uniqueIds)
      
      if (error) throw error
      return data || []
    }, 'checkExistingPlayers')
    
    const existingIds = new Set(existingPlayers.map(p => p.id))
    const newPlayerIds = uniqueIds.filter(id => !existingIds.has(id))
    
    if (newPlayerIds.length > 0) {
      const newPlayers = newPlayerIds.map(id => ({
        id,
        name: `Player ${id}`,
        status: 'active'
      }))
      
      await this.upsertBatch('players', newPlayers)
    }
  }
  
  /**
   * Get external IDs for a game
   */
  async getExternalIds(gameId: number) {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('game_external_ids')
        .select('*')
        .eq('game_id', gameId)
      
      if (error) throw error
      return data || []
    }, 'getExternalIds')
  }
  
  /**
   * Add external ID mapping
   */
  async addExternalId(gameId: number, source: string, externalId: string) {
    return this.executeWithRetry(async () => {
      const { data, error } = await this.supabase
        .from('game_external_ids')
        .upsert({
          game_id: gameId,
          source,
          external_id: externalId
        }, { onConflict: 'game_id,source' })
      
      if (error) throw error
      return data
    }, 'addExternalId')
  }
  
  /**
   * Find game by external ID
   */
  async findGameByExternalId(source: string, externalId: string) {
    return this.executeWithRetry(async () => {
      const { data: mapping, error: mappingError } = await this.supabase
        .from('game_external_ids')
        .select('game_id')
        .eq('source', source)
        .eq('external_id', externalId)
        .single()
      
      if (mappingError || !mapping) return null
      
      const { data: game, error: gameError } = await this.supabase
        .from('games')
        .select('*')
        .eq('id', mapping.game_id)
        .single()
      
      if (gameError) throw gameError
      return game
    }, 'findGameByExternalId')
  }
  
  /**
   * Get raw Supabase client for complex queries
   */
  getClient() {
    return this.supabase
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance()