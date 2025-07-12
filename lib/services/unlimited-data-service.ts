/**
 * 🚀 UNLIMITED DATA SERVICE - SCHEMA-ALIGNED EDITION
 * 
 * Handles ALL data operations with automatic pagination to bypass Supabase limits
 * STRICTLY adheres to our standardized player_game_logs schema
 * 
 * Features:
 * - Automatic pagination with .range() for all queries
 * - Schema validation for player_game_logs
 * - Async iterators for memory-efficient processing
 * - Progress tracking and resumable operations
 * - Sport-specific JSONB stats handling
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import chalk from 'chalk'

export interface PlayerGameLog {
  id?: number
  player_id: number
  game_id: number
  team_id: number
  game_date: string | Date
  opponent_id?: number
  is_home?: boolean
  minutes_played?: number
  stats: Record<string, any>  // JSONB field for sport-specific stats
  fantasy_points: number
  created_at?: string
  updated_at?: string
}

export interface StatsFilter {
  player_id?: number
  game_id?: number
  team_id?: number
  start_date?: string
  end_date?: string
  min_fantasy_points?: number
  sport?: string  // Filter by sport (via game join)
}

export interface QueryOptions {
  filter?: StatsFilter
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
  includePlayerInfo?: boolean
  includeGameInfo?: boolean
}

export interface UpsertResult {
  successful: number
  failed: number
  errors: any[]
}

export class UnlimitedDataService {
  private client: SupabaseClient
  private readonly BATCH_SIZE = 1000
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000

  constructor(client?: SupabaseClient) {
    this.client = client || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  /**
   * Fetch all player stats with automatic pagination
   * Returns an async iterator for memory-efficient processing
   */
  async *fetchAllPlayerStats(options: QueryOptions = {}): AsyncIterableIterator<PlayerGameLog[]> {
    let offset = 0
    let hasMore = true
    let totalFetched = 0

    console.log(chalk.cyan('📊 Starting unlimited player stats fetch...'))

    while (hasMore) {
      try {
        let query = this.client
          .from('player_game_logs')
          .select(this.buildSelectQuery(options))
          .range(offset, offset + this.BATCH_SIZE - 1)

        // Apply filters
        query = this.applyFilters(query, options.filter)

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
          console.error(chalk.red(`❌ Error fetching batch at offset ${offset}:`, error.message))
          throw error
        }

        if (!data || data.length === 0) {
          hasMore = false
          console.log(chalk.green(`✅ Fetch complete! Total records: ${totalFetched}`))
          break
        }

        totalFetched += data.length
        console.log(chalk.gray(`📦 Batch fetched: ${data.length} records (total: ${totalFetched})`))

        yield data

        // If we got less than batch size, we're done
        if (data.length < this.BATCH_SIZE) {
          hasMore = false
          console.log(chalk.green(`✅ Reached end of data. Total fetched: ${totalFetched}`))
        }

        offset += this.BATCH_SIZE
      } catch (error) {
        console.error(chalk.red(`❌ Fatal error during fetch:`, error))
        throw error
      }
    }
  }

  /**
   * Upsert player stats with automatic batching and retry logic
   */
  async upsertPlayerStats(stats: PlayerGameLog[]): Promise<UpsertResult> {
    const result: UpsertResult = {
      successful: 0,
      failed: 0,
      errors: []
    }

    if (stats.length === 0) {
      return result
    }

    console.log(chalk.cyan(`📝 Upserting ${stats.length} player stats records...`))

    // Validate all records first
    const validatedStats = this.validatePlayerStats(stats)
    
    if (validatedStats.invalid.length > 0) {
      console.warn(chalk.yellow(`⚠️ ${validatedStats.invalid.length} invalid records will be skipped`))
      result.failed += validatedStats.invalid.length
      result.errors.push(...validatedStats.invalid.map(s => ({ 
        record: s, 
        error: 'Schema validation failed' 
      })))
    }

    // Process valid records in batches
    for (let i = 0; i < validatedStats.valid.length; i += this.BATCH_SIZE) {
      const batch = validatedStats.valid.slice(i, i + this.BATCH_SIZE)
      
      for (let retry = 0; retry < this.MAX_RETRIES; retry++) {
        try {
          const { data, error } = await this.client
            .from('player_game_logs')
            .upsert(batch, { 
              onConflict: 'player_id,game_id',
              ignoreDuplicates: false 
            })
            .select()

          if (error) {
            throw error
          }

          result.successful += batch.length
          console.log(chalk.green(`✅ Batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${batch.length} records`))
          break

        } catch (error: any) {
          if (retry === this.MAX_RETRIES - 1) {
            console.error(chalk.red(`❌ Batch failed after ${this.MAX_RETRIES} retries:`, error.message))
            result.failed += batch.length
            result.errors.push({ batch: i / this.BATCH_SIZE + 1, error: error.message })
          } else {
            console.warn(chalk.yellow(`⚠️ Retry ${retry + 1}/${this.MAX_RETRIES} for batch...`))
            await this.delay(this.RETRY_DELAY * (retry + 1))
          }
        }
      }

      // Progress update
      const progress = Math.min(i + this.BATCH_SIZE, validatedStats.valid.length)
      const percentage = ((progress / validatedStats.valid.length) * 100).toFixed(1)
      console.log(chalk.cyan(`📊 Progress: ${progress}/${validatedStats.valid.length} (${percentage}%)`))
    }

    console.log(chalk.bold.green(`\n✅ Upsert complete!`))
    console.log(chalk.white(`  Successful: ${result.successful}`))
    console.log(chalk.white(`  Failed: ${result.failed}`))

    return result
  }

  /**
   * Stream upsert for very large datasets
   */
  async streamingUpsert(
    dataStream: AsyncIterableIterator<PlayerGameLog[]>
  ): Promise<UpsertResult> {
    const result: UpsertResult = {
      successful: 0,
      failed: 0,
      errors: []
    }

    console.log(chalk.cyan('🌊 Starting streaming upsert...'))

    for await (const batch of dataStream) {
      const batchResult = await this.upsertPlayerStats(batch)
      result.successful += batchResult.successful
      result.failed += batchResult.failed
      result.errors.push(...batchResult.errors)
    }

    return result
  }

  /**
   * Get stats coverage information
   */
  async getStatsCoverage(): Promise<{
    totalGames: number
    gamesWithStats: number
    coveragePercentage: number
    statsBySport: Record<string, number>
  }> {
    console.log(chalk.cyan('📊 Calculating stats coverage...'))

    // Get total games with scores
    const { count: totalGames } = await this.client
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)

    // Get games with stats
    const { data: gamesWithStats } = await this.client
      .from('player_game_logs')
      .select('game_id', { count: 'exact' })
      .limit(1)

    const { count: uniqueGamesWithStats } = await this.client
      .rpc('count_distinct_game_ids')

    // Get stats by sport
    const { data: sportStats } = await this.client
      .from('games')
      .select('sport, id')
      .in('id', gamesWithStats?.map(g => g.game_id) || [])

    const statsBySport = sportStats?.reduce((acc, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const coveragePercentage = totalGames ? (uniqueGamesWithStats / totalGames) * 100 : 0

    return {
      totalGames: totalGames || 0,
      gamesWithStats: uniqueGamesWithStats || 0,
      coveragePercentage,
      statsBySport
    }
  }

  /**
   * Validate player stats against schema
   */
  private validatePlayerStats(stats: PlayerGameLog[]): {
    valid: PlayerGameLog[]
    invalid: PlayerGameLog[]
  } {
    const valid: PlayerGameLog[] = []
    const invalid: PlayerGameLog[] = []

    for (const stat of stats) {
      if (this.isValidPlayerGameLog(stat)) {
        // Ensure dates are properly formatted
        if (stat.game_date instanceof Date) {
          stat.game_date = stat.game_date.toISOString().split('T')[0]
        }
        valid.push(stat)
      } else {
        invalid.push(stat)
      }
    }

    return { valid, invalid }
  }

  /**
   * Check if a record matches our schema
   */
  private isValidPlayerGameLog(stat: any): stat is PlayerGameLog {
    return (
      typeof stat.player_id === 'number' &&
      typeof stat.game_id === 'number' &&
      typeof stat.team_id === 'number' &&
      stat.game_date &&
      typeof stat.stats === 'object' &&
      typeof stat.fantasy_points === 'number'
    )
  }

  /**
   * Build select query with joins
   */
  private buildSelectQuery(options: QueryOptions): string {
    let select = '*'

    if (options.includePlayerInfo) {
      select += ', player:players!player_id(id, name, position)'
    }

    if (options.includeGameInfo) {
      select += ', game:games!game_id(id, start_time, home_team_id, away_team_id, sport)'
    }

    return select
  }

  /**
   * Apply filters to query
   */
  private applyFilters(query: any, filter?: StatsFilter): any {
    if (!filter) return query

    if (filter.player_id) {
      query = query.eq('player_id', filter.player_id)
    }

    if (filter.game_id) {
      query = query.eq('game_id', filter.game_id)
    }

    if (filter.team_id) {
      query = query.eq('team_id', filter.team_id)
    }

    if (filter.start_date) {
      query = query.gte('game_date', filter.start_date)
    }

    if (filter.end_date) {
      query = query.lte('game_date', filter.end_date)
    }

    if (filter.min_fantasy_points) {
      query = query.gte('fantasy_points', filter.min_fantasy_points)
    }

    return query
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get player stats with compression (Lucey-inspired)
   */
  async getCompressedStats(
    playerId: number,
    options: { 
      fields?: string[]
      lastNGames?: number 
    } = {}
  ): Promise<any[]> {
    const stats = []
    
    for await (const batch of this.fetchAllPlayerStats({ 
      filter: { player_id: playerId },
      orderBy: 'game_date',
      orderDirection: 'desc'
    })) {
      for (const stat of batch) {
        // Apply Lucey compression - only essential fields
        const compressed = options.fields ? 
          this.extractFields(stat, options.fields) :
          this.compressToEssentials(stat)
        
        stats.push(compressed)
        
        if (options.lastNGames && stats.length >= options.lastNGames) {
          return stats.slice(0, options.lastNGames)
        }
      }
    }
    
    return stats
  }

  /**
   * Extract only specified fields
   */
  private extractFields(stat: PlayerGameLog, fields: string[]): any {
    const result: any = {}
    
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields like stats.points
        const [parent, child] = field.split('.')
        if (parent === 'stats' && stat.stats[child] !== undefined) {
          result[field] = stat.stats[child]
        }
      } else if (stat[field as keyof PlayerGameLog] !== undefined) {
        result[field] = stat[field as keyof PlayerGameLog]
      }
    }
    
    return result
  }

  /**
   * Compress to essential fields only (Lucey's 70% principle)
   */
  private compressToEssentials(stat: PlayerGameLog): any {
    return {
      game_date: stat.game_date,
      fantasy_points: stat.fantasy_points,
      minutes_played: stat.minutes_played,
      // Top 3 stats based on fantasy impact
      key_stats: this.extractKeyStats(stat.stats)
    }
  }

  /**
   * Extract key stats based on sport
   */
  private extractKeyStats(stats: Record<string, any>): any {
    // NBA: Points, Rebounds, Assists
    if (stats.points !== undefined) {
      return {
        pts: stats.points,
        reb: stats.rebounds,
        ast: stats.assists
      }
    }
    
    // NFL: Passing yards, TDs, Rushing yards
    if (stats.passing_yards !== undefined) {
      return {
        pass_yds: stats.passing_yards,
        pass_tds: stats.passing_touchdowns,
        rush_yds: stats.rushing_yards
      }
    }
    
    // MLB: Hits, Runs, RBIs
    if (stats.hits !== undefined) {
      return {
        hits: stats.hits,
        runs: stats.runs,
        rbis: stats.rbis
      }
    }
    
    return {}
  }
}

// Export singleton instance
export const unlimitedDataService = new UnlimitedDataService()