/**
 * BASE COLLECTOR CLASS
 * Standard foundation for all data collection scripts
 * Ensures consistent database usage, error handling, and progress tracking
 */

import { db, DatabaseService } from '../services/database-service'
import { generateUniversalGameId } from '../universal-id-helpers'
import chalk from 'chalk'
import pLimit from 'p-limit'

export interface CollectorStats {
  totalGames: number
  processedGames: number
  successfulGames: number
  failedGames: number
  playerLogsCreated: number
  startTime: Date
  errors: Array<{ gameId: number; error: string }>
}

export interface CollectorConfig {
  name: string
  concurrencyLimit?: number
  batchSize?: number
  retryAttempts?: number
  enableDetailedLogging?: boolean
}

export abstract class BaseCollector {
  protected db: DatabaseService
  protected stats: CollectorStats
  protected config: CollectorConfig
  protected limit: pLimit.Limit
  
  constructor(config: CollectorConfig) {
    this.config = {
      concurrencyLimit: 3,
      batchSize: 10,
      retryAttempts: 3,
      enableDetailedLogging: true,
      ...config
    }
    
    this.db = db
    this.limit = pLimit(this.config.concurrencyLimit!)
    
    this.stats = {
      totalGames: 0,
      processedGames: 0,
      successfulGames: 0,
      failedGames: 0,
      playerLogsCreated: 0,
      startTime: new Date(),
      errors: []
    }
  }
  
  /**
   * Main entry point for collectors
   */
  async run() {
    console.log(chalk.cyan.bold(`\n🚀 ${this.config.name}\n`))
    
    try {
      // Get games to process
      const games = await this.getGamesToProcess()
      this.stats.totalGames = games.length
      
      if (games.length === 0) {
        console.log(chalk.yellow('No games found to process'))
        return
      }
      
      console.log(chalk.green(`Found ${games.length} games to process\n`))
      
      // Process in batches
      await this.processBatches(games)
      
      // Show final report
      this.showFinalReport()
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
      throw error
    }
  }
  
  /**
   * Process games in batches with proper rate limiting
   */
  protected async processBatches(games: any[]) {
    const batchSize = this.config.batchSize!
    
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(games.length / batchSize)
      
      console.log(chalk.cyan(`\nProcessing batch ${batchNum}/${totalBatches}`))
      
      // Process batch with concurrency limit
      await Promise.all(
        batch.map(game => 
          this.limit(() => this.processGameWithRetry(game))
        )
      )
      
      // Show progress
      this.showProgress()
      
      // Rate limit between batches
      if (batchNum < totalBatches) {
        await this.sleep(1000)
      }
    }
  }
  
  /**
   * Process game with retry logic
   */
  private async processGameWithRetry(game: any) {
    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        await this.processGame(game)
        return
      } catch (error: any) {
        if (attempt === this.config.retryAttempts) {
          this.stats.failedGames++
          this.stats.errors.push({
            gameId: game.id,
            error: error.message || 'Unknown error'
          })
          
          if (this.config.enableDetailedLogging) {
            console.error(chalk.red(`    ✗ Failed after ${attempt} attempts: ${error.message}`))
          }
        } else {
          if (this.config.enableDetailedLogging) {
            console.log(chalk.yellow(`    Retry ${attempt}/${this.config.retryAttempts} for game ${game.id}`))
          }
          await this.sleep(1000 * attempt)
        }
      }
    }
    
    this.stats.processedGames++
  }
  
  /**
   * Show progress during collection
   */
  protected showProgress() {
    const elapsed = (Date.now() - this.stats.startTime.getTime()) / 1000 / 60
    const rate = this.stats.processedGames / elapsed
    const percentage = (this.stats.processedGames / this.stats.totalGames * 100).toFixed(1)
    
    console.log(chalk.cyan('\n📊 Progress:'))
    console.log(chalk.white(`• Progress: ${this.stats.processedGames}/${this.stats.totalGames} (${percentage}%)`))
    console.log(chalk.green(`• Successful: ${this.stats.successfulGames}`))
    console.log(chalk.red(`• Failed: ${this.stats.failedGames}`))
    console.log(chalk.white(`• Player logs: ${this.stats.playerLogsCreated.toLocaleString()}`))
    
    if (rate > 0) {
      console.log(chalk.white(`• Rate: ${rate.toFixed(1)} games/min`))
      const remaining = (this.stats.totalGames - this.stats.processedGames) / rate
      console.log(chalk.white(`• ETA: ${remaining.toFixed(1)} minutes`))
    }
  }
  
  /**
   * Show final collection report
   */
  protected showFinalReport() {
    const elapsed = (Date.now() - this.stats.startTime.getTime()) / 1000 / 60
    const successRate = this.stats.processedGames > 0 
      ? (this.stats.successfulGames / this.stats.processedGames * 100).toFixed(1)
      : '0'
    
    console.log(chalk.cyan.bold(`\n✅ ${this.config.name} COMPLETE!\n`))
    console.log(chalk.green(`Successfully processed ${this.stats.successfulGames} games`))
    console.log(chalk.green(`Created ${this.stats.playerLogsCreated.toLocaleString()} player logs`))
    console.log(chalk.yellow(`Success rate: ${successRate}%`))
    console.log(chalk.white(`Total time: ${elapsed.toFixed(1)} minutes`))
    
    if (this.stats.errors.length > 0 && this.config.enableDetailedLogging) {
      console.log(chalk.red(`\nErrors (${this.stats.errors.length}):`))
      this.stats.errors.slice(0, 5).forEach(err => {
        console.log(chalk.red(`  • Game ${err.gameId}: ${err.error}`))
      })
      if (this.stats.errors.length > 5) {
        console.log(chalk.red(`  ... and ${this.stats.errors.length - 5} more`))
      }
    }
  }
  
  /**
   * Helper to extract ESPN ID from various formats
   */
  protected extractEspnId(externalId: string): string | null {
    if (!externalId) return null
    
    // Remove prefixes
    let cleanId = externalId
    if (cleanId.startsWith('espn_')) {
      cleanId = cleanId.replace('espn_', '')
    }
    if (cleanId.includes('_')) {
      cleanId = cleanId.split('_').pop() || cleanId
    }
    
    // Extract numeric ID
    const numericMatch = cleanId.match(/(\d+)/)
    return numericMatch ? numericMatch[1] : null
  }
  
  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Abstract methods that collectors must implement
   */
  abstract getGamesToProcess(): Promise<any[]>
  abstract processGame(game: any): Promise<void>
}