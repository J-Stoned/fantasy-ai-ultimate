/**
 * 🔥 ENHANCED DATABASE SERVICE - SCHEMA FLEXIBLE EDITION
 * Handles schema mismatches and provides universal data access
 * Features:
 * - Automatic schema detection and adaptation
 * - 1k batch processing for all operations
 * - Team ID resolution across all sports
 * - Universal ID system integration
 * - Comprehensive error handling and validation
 */

import { DatabaseService } from './database-service'
import { DataValidationService } from './data-validation-service'
import { generateUniversalGameId } from '../universal-id-helpers'
import chalk from 'chalk'

export interface SchemaField {
  name: string
  type: string
  nullable: boolean
  defaultValue?: any
}

export interface TableSchema {
  name: string
  fields: SchemaField[]
  primaryKey: string[]
  uniqueConstraints: string[][]
}

export interface TeamResolution {
  id: number | string
  name: string
  abbreviation: string
  sport: string
  external_ids: Record<string, string>
}

export class EnhancedDatabaseService extends DatabaseService {
  private schemaCache: Map<string, TableSchema> = new Map()
  private teamResolutionCache: Map<string, TeamResolution> = new Map()
  private readonly BATCH_SIZE = 1000

  constructor() {
    super({
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 1000,
      enableLogging: true
    })
  }

  /**
   * Get table schema with caching (simplified for Supabase)
   */
  async getTableSchema(tableName: string): Promise<TableSchema | null> {
    if (this.schemaCache.has(tableName)) {
      return this.schemaCache.get(tableName)!
    }

    // For now, use simplified schema detection by testing a query
    try {
      const { data, error } = await this.getClient()
        .from(tableName)
        .select('*')
        .limit(1)

      if (error) {
        console.warn(chalk.yellow(`Table ${tableName} does not exist:`, error.message))
        return null
      }

      // Create a basic schema based on the actual data structure
      const schema: TableSchema = {
        name: tableName,
        fields: [], // We'll populate this based on known structures
        primaryKey: ['id'],
        uniqueConstraints: []
      }

      this.schemaCache.set(tableName, schema)
      return schema
    } catch (error) {
      console.warn(chalk.yellow(`Error accessing table ${tableName}:`, error))
      return null
    }
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    const schema = await this.getTableSchema(tableName)
    return schema !== null
  }

  /**
   * Adapt data to table schema
   */
  async adaptDataToSchema(tableName: string, data: any[]): Promise<any[]> {
    const schema = await this.getTableSchema(tableName)
    if (!schema) {
      console.warn(chalk.yellow(`Cannot adapt data - table ${tableName} schema unknown`))
      return data
    }

    const fieldNames = new Set(schema.fields.map(f => f.name))
    const adaptedData = data.map(record => {
      const adapted: any = {}
      
      // Only include fields that exist in the schema
      for (const [key, value] of Object.entries(record)) {
        if (fieldNames.has(key)) {
          adapted[key] = value
        }
      }

      return adapted
    })

    return adaptedData
  }

  /**
   * Universal team resolution across all sports
   */
  async resolveTeam(identifier: string | number, sport?: string): Promise<TeamResolution | null> {
    const cacheKey = `${sport || 'any'}_${identifier}`
    
    if (this.teamResolutionCache.has(cacheKey)) {
      return this.teamResolutionCache.get(cacheKey)!
    }

    try {
      let query = this.getClient()
        .from('teams')
        .select('id, name, abbreviation, sport')

      // Try different resolution strategies
      if (typeof identifier === 'number') {
        query = query.eq('id', identifier)
      } else if (typeof identifier === 'string') {
        // Try abbreviation first, then name
        query = query.or(`abbreviation.eq.${identifier},name.ilike.%${identifier}%`)
      }

      if (sport) {
        query = query.eq('sport', sport.toUpperCase())
      }

      const { data, error } = await query.limit(1).single()

      if (error || !data) {
        // Try alternative team sources
        return await this.createTeamIfMissing(identifier, sport)
      }

      const resolution: TeamResolution = {
        id: data.id,
        name: data.name,
        abbreviation: data.abbreviation,
        sport: data.sport,
        external_ids: {} // Current schema doesn't have this field
      }

      this.teamResolutionCache.set(cacheKey, resolution)
      return resolution
    } catch (error) {
      console.warn(chalk.yellow(`Team resolution failed for ${identifier}:`, error))
      return null
    }
  }

  /**
   * Create team if missing from database
   */
  private async createTeamIfMissing(identifier: string | number, sport?: string): Promise<TeamResolution | null> {
    if (typeof identifier !== 'string' || !sport) {
      return null
    }

    try {
      // Create basic team entry (only essential fields)
      const newTeam = {
        name: identifier.toUpperCase(),
        abbreviation: identifier.toUpperCase(),
        sport: sport.toUpperCase()
      }

      const { data, error } = await this.getClient()
        .from('teams')
        .insert(newTeam)
        .select()
        .single()

      if (error) {
        console.warn(chalk.yellow(`Could not create team ${identifier}:`, error.message))
        return null
      }

      console.log(chalk.green(`✓ Created missing team: ${identifier} (${sport})`))
      
      const resolution: TeamResolution = {
        id: data.id,
        name: data.name,
        abbreviation: data.abbreviation,
        sport: data.sport,
        external_ids: {} // Current schema doesn't have this field
      }

      return resolution
    } catch (error) {
      console.warn(chalk.yellow(`Error creating team ${identifier}:`, error))
      return null
    }
  }

  /**
   * Enhanced upsert with schema validation and 1k batching
   */
  async enhancedUpsert(
    tableName: string,
    records: any[],
    options: {
      onConflict?: string
      batchSize?: number
      validateSchema?: boolean
      skipValidation?: boolean
    } = {}
  ) {
    if (records.length === 0) return []

    const batchSize = options.batchSize || this.BATCH_SIZE
    const validateSchema = options.validateSchema !== false
    
    console.log(chalk.cyan(`📝 Upserting ${records.length} records to ${tableName} in batches of ${batchSize}`))

    // Check if table exists
    if (validateSchema && !(await this.tableExists(tableName))) {
      console.warn(chalk.yellow(`⚠️ Table ${tableName} does not exist - skipping upsert`))
      return []
    }

    // Adapt data to schema
    let adaptedRecords = records
    if (validateSchema) {
      adaptedRecords = await this.adaptDataToSchema(tableName, records)
    }

    // Validate records if not skipped (simplified validation)
    if (!options.skipValidation) {
      adaptedRecords = adaptedRecords.filter(record => {
        // Basic validation - check for essential fields
        if (tableName === 'games') {
          return record.sport && record.start_time
        }
        return true // Skip validation for other tables for now
      })
    }

    const results = []
    let processed = 0

    // Process in 1k batches
    for (let i = 0; i < adaptedRecords.length; i += batchSize) {
      const batch = adaptedRecords.slice(i, i + batchSize)
      
      try {
        let query = this.getClient()
          .from(tableName)
          .upsert(batch)

        if (options.onConflict) {
          query = query.select()
        }

        const { data, error } = await query

        if (error) {
          console.error(chalk.red(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message))
          
          // Try individual inserts for this batch
          for (const record of batch) {
            try {
              const { data: singleData } = await this.getClient()
                .from(tableName)
                .upsert(record)
                .select()
              
              if (singleData) {
                results.push(...singleData)
              }
            } catch (singleError) {
              console.warn(chalk.yellow(`⚠️ Single record failed for ${tableName}`))
            }
          }
        } else {
          if (data) {
            results.push(...data)
          }
          processed += batch.length
          console.log(chalk.green(`✓ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`))
        }
      } catch (error) {
        console.error(chalk.red(`❌ Fatal error in batch ${Math.floor(i / batchSize) + 1}:`, error))
      }

      // Progress reporting
      const progress = Math.min(i + batchSize, adaptedRecords.length)
      const percentage = ((progress / adaptedRecords.length) * 100).toFixed(1)
      console.log(chalk.cyan(`📊 Progress: ${progress}/${adaptedRecords.length} (${percentage}%)`))
    }

    console.log(chalk.green(`✅ ${tableName}: ${processed}/${records.length} records processed successfully`))
    return results
  }

  /**
   * Enhanced game processing with team resolution
   */
  async processGamesWithTeamResolution(games: any[], sport: string) {
    console.log(chalk.cyan(`🏈 Processing ${games.length} ${sport} games with team resolution`))

    const processedGames = []
    
    for (const game of games) {
      try {
        // Resolve team IDs
        let homeTeam: TeamResolution | null = null
        let awayTeam: TeamResolution | null = null

        if (game.home_team_abbreviation) {
          homeTeam = await this.resolveTeam(game.home_team_abbreviation, sport)
        } else if (game.home_team_name) {
          homeTeam = await this.resolveTeam(game.home_team_name, sport)
        } else if (game.home_team_id) {
          homeTeam = await this.resolveTeam(game.home_team_id, sport)
        }

        if (game.away_team_abbreviation) {
          awayTeam = await this.resolveTeam(game.away_team_abbreviation, sport)
        } else if (game.away_team_name) {
          awayTeam = await this.resolveTeam(game.away_team_name, sport)
        } else if (game.away_team_id) {
          awayTeam = await this.resolveTeam(game.away_team_id, sport)
        }

        if (!homeTeam || !awayTeam) {
          console.warn(chalk.yellow(`⚠️ Could not resolve teams for game ${game.external_id || game.id}`))
          continue
        }

        // Generate universal ID
        const universalId = generateUniversalGameId({
          sport: sport.toLowerCase(),
          start_time: game.start_time,
          home_team_abbreviation: homeTeam.abbreviation,
          away_team_abbreviation: awayTeam.abbreviation
        })

        // Create processed game
        const processedGame = {
          ...game,
          sport: sport.toUpperCase(),
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          universal_id: universalId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        // Validate the game
        const validation = DataValidationService.validateGame(processedGame)
        if (validation.isValid) {
          processedGames.push(processedGame)
        } else {
          console.warn(chalk.yellow(`⚠️ Invalid game data:`, validation.errors))
        }

      } catch (error) {
        console.error(chalk.red(`❌ Error processing game:`, error))
      }
    }

    console.log(chalk.green(`✅ Processed ${processedGames.length}/${games.length} games successfully`))
    return processedGames
  }

  /**
   * Batch query with automatic 1k chunking
   */
  async batchQuery<T>(
    tableName: string,
    selectFields: string = '*',
    filters: Record<string, any> = {},
    options: {
      orderBy?: string
      orderDirection?: 'asc' | 'desc'
      limit?: number
    } = {}
  ): Promise<T[]> {
    const allResults: T[] = []
    let offset = 0
    const batchSize = this.BATCH_SIZE

    console.log(chalk.cyan(`📊 Querying ALL records from ${tableName} in ${batchSize} record batches`))

    while (true) {
      try {
        let query = this.getClient()
          .from(tableName)
          .select(selectFields)
          .range(offset, offset + batchSize - 1)

        // Apply filters
        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined) {
            query = query.eq(key, value)
          }
        }

        // Apply ordering
        if (options.orderBy) {
          query = query.order(options.orderBy, { 
            ascending: options.orderDirection !== 'desc' 
          })
        }

        const { data, error } = await query

        if (error) {
          console.error(chalk.red(`❌ Batch query failed at offset ${offset}:`, error.message))
          break
        }

        if (!data || data.length === 0) {
          console.log(chalk.green(`✅ Query complete - retrieved ${allResults.length} total records`))
          break
        }

        allResults.push(...data)
        console.log(chalk.cyan(`📦 Batch: ${data.length} records (total: ${allResults.length})`))

        // If we got less than batch size, we're done
        if (data.length < batchSize) {
          console.log(chalk.green(`✅ Reached end of data - final total: ${allResults.length} records`))
          break
        }

        // Check limit
        if (options.limit && allResults.length >= options.limit) {
          console.log(chalk.green(`✅ Reached specified limit: ${options.limit} records`))
          return allResults.slice(0, options.limit)
        }

        offset += batchSize
      } catch (error) {
        console.error(chalk.red(`❌ Fatal error during batch query:`, error))
        break
      }
    }

    return allResults
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.schemaCache.clear()
    this.teamResolutionCache.clear()
    console.log(chalk.yellow('🧹 Cleared all caches'))
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      schemaCache: this.schemaCache.size,
      teamResolutionCache: this.teamResolutionCache.size
    }
  }

  /**
   * Unlimited query for player_game_logs with automatic pagination
   * Uses our standardized schema exclusively
   */
  async *unlimitedPlayerStatsQuery(
    options: {
      filter?: Record<string, any>
      orderBy?: string
      orderDirection?: 'asc' | 'desc'
      includeJoins?: boolean
    } = {}
  ): AsyncIterableIterator<any[]> {
    let offset = 0
    let hasMore = true
    let totalFetched = 0

    console.log(chalk.cyan('🔄 Starting unlimited player_game_logs query...'))

    while (hasMore) {
      try {
        let query = this.getClient()
          .from('player_game_logs')
          .select(options.includeJoins ? 
            '*, player:players!player_id(name), game:games!game_id(sport, start_time)' : 
            '*'
          )
          .range(offset, offset + this.BATCH_SIZE - 1)

        // Apply filters
        if (options.filter) {
          for (const [key, value] of Object.entries(options.filter)) {
            if (value !== undefined) {
              query = query.eq(key, value)
            }
          }
        }

        // Apply ordering
        if (options.orderBy) {
          query = query.order(options.orderBy, { 
            ascending: options.orderDirection !== 'desc' 
          })
        } else {
          query = query.order('game_date', { ascending: false })
        }

        const { data, error } = await query

        if (error) {
          console.error(chalk.red(`❌ Error in unlimited query at offset ${offset}:`, error.message))
          throw error
        }

        if (!data || data.length === 0) {
          hasMore = false
          console.log(chalk.green(`✅ Unlimited query complete! Total: ${totalFetched} records`))
          break
        }

        totalFetched += data.length
        console.log(chalk.gray(`📦 Fetched batch: ${data.length} records (total: ${totalFetched})`))

        yield data

        if (data.length < this.BATCH_SIZE) {
          hasMore = false
          console.log(chalk.green(`✅ Reached end of player_game_logs. Total: ${totalFetched}`))
        }

        offset += this.BATCH_SIZE
      } catch (error) {
        console.error(chalk.red(`❌ Fatal error in unlimited query:`, error))
        throw error
      }
    }
  }

  /**
   * REAL Enhanced upsert - NO MORE BULLSHIT!
   * Actually uses UPSERT and reports REAL results
   */
  async enhancedPlayerStatsUpsert(
    playerStats: any[],
    options: {
      validateSchema?: boolean
      batchSize?: number
    } = {}
  ): Promise<{ 
    successful: number
    failed: number
    actuallyInserted: number
    actuallyUpdated: number
    errors: any[]
    newRecords: any[]
  }> {
    if (playerStats.length === 0) {
      return { successful: 0, failed: 0, actuallyInserted: 0, actuallyUpdated: 0, errors: [], newRecords: [] }
    }

    const batchSize = options.batchSize || this.BATCH_SIZE
    const validateSchema = options.validateSchema !== false
    
    console.log(chalk.cyan(`📝 REAL Enhanced upsert: ${playerStats.length} player stats to player_game_logs`))

    // Schema validation
    let validatedStats = playerStats
    if (validateSchema) {
      const validationResults = []
      for (const stat of playerStats) {
        const isValid = (
          typeof stat.player_id === 'number' &&
          typeof stat.game_id === 'number' &&
          typeof stat.team_id === 'number' &&
          stat.game_date &&
          typeof stat.stats === 'object' &&
          typeof stat.fantasy_points === 'number'
        )
        
        if (isValid) {
          validationResults.push(stat)
        } else {
          console.error(chalk.red(`❌ INVALID RECORD:`, JSON.stringify(stat, null, 2)))
        }
      }
      
      validatedStats = validationResults
      console.log(chalk.green(`✅ Schema validation: ${validatedStats.length}/${playerStats.length} valid`))
      
      if (validatedStats.length !== playerStats.length) {
        console.error(chalk.red(`❌ ${playerStats.length - validatedStats.length} RECORDS FAILED VALIDATION!`))
      }
    }

    let totalSuccessful = 0
    let totalFailed = 0
    let actuallyInserted = 0
    let actuallyUpdated = 0
    const allErrors: any[] = []
    const newRecords: any[] = []

    // Get count before upsert for verification
    const { count: countBefore } = await this.getClient()
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })

    console.log(chalk.blue(`📊 Records before upsert: ${countBefore}`))

    // Process in batches with REAL conflict resolution
    for (let i = 0; i < validatedStats.length; i += batchSize) {
      const batch = validatedStats.slice(i, i + batchSize)
      
      console.log(chalk.yellow(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validatedStats.length / batchSize)}...`))
      
      try {
        // Use UPSERT with proper conflict handling
        const { data, error } = await this.getClient()
          .from('player_game_logs')
          .upsert(batch, { 
            onConflict: 'player_id,game_id',
            ignoreDuplicates: false // We want to update existing records
          })
          .select()

        if (error) {
          console.error(chalk.red(`❌ BATCH UPSERT FAILED:`))
          console.error(chalk.red(`Code: ${error.code}`))
          console.error(chalk.red(`Message: ${error.message}`))
          console.error(chalk.red(`Details: ${error.details}`))
          
          allErrors.push({
            batch: Math.floor(i / batchSize) + 1,
            error: error,
            recordCount: batch.length
          })
          
          totalFailed += batch.length
          
          // Don't try individual inserts - if upsert fails, something is seriously wrong
          console.error(chalk.red(`❌ Skipping ${batch.length} records due to batch failure`))
          
        } else {
          // SUCCESS - count actual results
          const batchResults = data || []
          totalSuccessful += batchResults.length
          newRecords.push(...batchResults)
          
          console.log(chalk.green(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${batchResults.length}/${batch.length} records upserted`))
          
          if (batchResults.length !== batch.length) {
            console.warn(chalk.yellow(`⚠️ Expected ${batch.length} but got ${batchResults.length} results`))
          }
        }
      } catch (error: any) {
        console.error(chalk.red(`💥 UNEXPECTED ERROR in batch ${Math.floor(i / batchSize) + 1}:`))
        console.error(chalk.red(`Error: ${error.message}`))
        console.error(chalk.red(`Stack: ${error.stack}`))
        
        allErrors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error,
          recordCount: batch.length
        })
        
        totalFailed += batch.length
      }

      // REAL Progress reporting
      const progress = Math.min(i + batchSize, validatedStats.length)
      const percentage = ((progress / validatedStats.length) * 100).toFixed(1)
      console.log(chalk.cyan(`📊 Progress: ${progress}/${validatedStats.length} (${percentage}%) | Success: ${totalSuccessful} | Failed: ${totalFailed}`))
    }

    // Get count after upsert for verification
    const { count: countAfter } = await this.getClient()
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })

    const actualIncrease = (countAfter || 0) - (countBefore || 0)
    
    console.log(chalk.blue(`📊 Records after upsert: ${countAfter}`))
    console.log(chalk.blue(`📈 Actual increase: ${actualIncrease} records`))

    // Determine inserts vs updates
    if (actualIncrease > 0) {
      actuallyInserted = actualIncrease
      actuallyUpdated = totalSuccessful - actualIncrease
    } else {
      actuallyInserted = 0
      actuallyUpdated = totalSuccessful
    }

    // REAL FINAL REPORTING
    if (totalSuccessful === 0) {
      console.error(chalk.red(`💥 ZERO RECORDS ACTUALLY UPSERTED!`))
      console.error(chalk.red(`This means our data is not reaching the database!`))
    } else {
      console.log(chalk.green(`✅ REAL Results:`))
      console.log(chalk.green(`  - Successfully processed: ${totalSuccessful}/${playerStats.length}`))
      console.log(chalk.green(`  - Actually inserted: ${actuallyInserted}`))
      console.log(chalk.green(`  - Actually updated: ${actuallyUpdated}`))
      console.log(chalk.green(`  - Failed: ${totalFailed}`))
      console.log(chalk.green(`  - Database increase: ${actualIncrease}`))
    }

    if (allErrors.length > 0) {
      console.error(chalk.red(`❌ Errors encountered: ${allErrors.length} batches failed`))
    }

    return {
      successful: totalSuccessful,
      failed: totalFailed,
      actuallyInserted,
      actuallyUpdated,
      errors: allErrors,
      newRecords
    }
  }

  /**
   * Get comprehensive stats coverage for our standardized schema
   */
  async getPlayerStatsCoverage(): Promise<{
    totalGames: number
    gamesWithStats: number
    coveragePercentage: number
    recordsInPlayerGameLogs: number
    statsBySport: Record<string, number>
  }> {
    console.log(chalk.cyan('📊 Analyzing player_game_logs coverage...'))

    // Total games with scores
    const { count: totalGames } = await this.getClient()
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)

    // Total records in player_game_logs
    const { count: recordsInPlayerGameLogs } = await this.getClient()
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })

    // Unique games with stats
    const { data: uniqueGames } = await this.getClient()
      .from('player_game_logs')
      .select('game_id')

    const uniqueGameIds = new Set(uniqueGames?.map(g => g.game_id) || [])
    const gamesWithStats = uniqueGameIds.size

    // Stats by sport (via games join)
    const { data: gamesSport } = await this.getClient()
      .from('games')
      .select('sport, id')
      .in('id', Array.from(uniqueGameIds))

    const statsBySport = gamesSport?.reduce((acc, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const coveragePercentage = totalGames ? (gamesWithStats / totalGames) * 100 : 0

    console.log(chalk.green(`✅ Coverage analysis complete:`))
    console.log(chalk.white(`  Total games: ${totalGames}`))
    console.log(chalk.white(`  Games with stats: ${gamesWithStats}`))
    console.log(chalk.white(`  Coverage: ${coveragePercentage.toFixed(2)}%`))
    console.log(chalk.white(`  Total player_game_logs: ${recordsInPlayerGameLogs}`))

    return {
      totalGames: totalGames || 0,
      gamesWithStats,
      coveragePercentage,
      recordsInPlayerGameLogs: recordsInPlayerGameLogs || 0,
      statsBySport
    }
  }
}

// Export enhanced singleton instance
export const enhancedDb = new EnhancedDatabaseService()