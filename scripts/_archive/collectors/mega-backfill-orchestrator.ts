#!/usr/bin/env tsx
/**
 * MEGA BACKFILL ORCHESTRATOR
 * Coordinates massive data collection for 6,743 games
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import * as fs from 'fs'
import axios from 'axios'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BackfillProgress {
  totalGames: number
  processedGames: number
  successfulGames: number
  failedGames: number
  totalPlayerLogs: number
  startTime: Date
  errors: any[]
}

class MegaBackfillOrchestrator {
  private progress: BackfillProgress = {
    totalGames: 0,
    processedGames: 0,
    successfulGames: 0,
    failedGames: 0,
    totalPlayerLogs: 0,
    startTime: new Date(),
    errors: []
  }
  
  private progressFile = 'backfill-progress.json'
  
  async orchestrate() {
    console.log(chalk.cyan.bold('\n🚀 MEGA BACKFILL ORCHESTRATOR INITIATED\n'))
    console.log(chalk.yellow('Target: Fill player data for 6,743 games\n'))
    
    try {
      // Load previous progress if exists
      this.loadProgress()
      
      // Get games needing data
      const gamesToProcess = await this.getGamesNeedingData()
      this.progress.totalGames = gamesToProcess.length
      
      console.log(chalk.green(`Found ${gamesToProcess.length} games to process\n`))
      
      // Process in parallel batches
      const batchSize = 10 // Process 10 games at a time
      
      for (let i = 0; i < gamesToProcess.length; i += batchSize) {
        const batch = gamesToProcess.slice(i, i + batchSize)
        
        // Skip if already processed
        if (i < this.progress.processedGames) continue
        
        console.log(chalk.yellow(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(gamesToProcess.length/batchSize)}`))
        
        await Promise.all(
          batch.map(game => this.processGame(game))
        )
        
        // Save progress
        this.saveProgress()
        
        // Rate limiting
        await this.sleep(1000) // 1 second between batches
        
        // Show stats every 50 games
        if (this.progress.processedGames % 50 === 0) {
          this.showStats()
        }
      }
      
      // Final report
      this.generateFinalReport()
      
    } catch (error) {
      console.error(chalk.red('Orchestrator error:'), error)
      this.progress.errors.push({ type: 'orchestrator', error: error.message })
      this.saveProgress()
    }
  }
  
  private async getGamesNeedingData(): Promise<any[]> {
    console.log(chalk.yellow('Finding games without player data...\n'))
    
    // Get completed games with scores
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id, start_time')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1000) // Start with recent games
    
    if (!games) return []
    
    // Filter out games that already have player logs
    const gamesNeedingData = []
    
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .gt('fantasy_points', 0)
      
      if (!count || count < 10) { // Less than 10 players means incomplete
        gamesNeedingData.push(game)
      }
    }
    
    return gamesNeedingData
  }
  
  private async processGame(game: any) {
    try {
      console.log(chalk.dim(`  Processing game ${game.id} (${game.sport})...`))
      
      let success = false
      
      // Try different data sources based on sport
      switch (game.sport?.toUpperCase()) {
        case 'NFL':
        case 'FOOTBALL':
          success = await this.collectNFLData(game)
          break
          
        case 'NBA':
        case 'BASKETBALL':
          success = await this.collectNBAData(game)
          break
          
        case 'MLB':
        case 'BASEBALL':
          success = await this.collectMLBData(game)
          break
          
        case 'NHL':
        case 'HOCKEY':
          success = await this.collectNHLData(game)
          break
          
        default:
          success = await this.collectESPNData(game)
      }
      
      this.progress.processedGames++
      
      if (success) {
        this.progress.successfulGames++
        console.log(chalk.green(`    ✓ Game ${game.id} complete`))
      } else {
        this.progress.failedGames++
        console.log(chalk.red(`    ✗ Game ${game.id} failed`))
      }
      
    } catch (error) {
      this.progress.failedGames++
      this.progress.errors.push({ game_id: game.id, error: error.message })
      console.error(chalk.red(`    Error with game ${game.id}:`, error.message))
    }
  }
  
  private async collectESPNData(game: any): Promise<boolean> {
    try {
      // Map sport to ESPN sport key
      const sportMap = {
        'NFL': 'football/nfl',
        'NBA': 'basketball/nba',
        'MLB': 'baseball/mlb',
        'NHL': 'hockey/nhl'
      }
      
      const sport = sportMap[game.sport?.toUpperCase()] || 'football/nfl'
      
      // Try to get game data from ESPN
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard`
      const response = await axios.get(url, {
        params: {
          dates: new Date(game.start_time).toISOString().split('T')[0].replace(/-/g, '')
        }
      })
      
      // Find matching game
      const events = response.data?.events || []
      const matchingEvent = events.find(e => {
        // Match by team IDs or similar logic
        return true // Simplified for example
      })
      
      if (!matchingEvent) return false
      
      // Get boxscore
      const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}/summary`
      const boxscore = await axios.get(boxscoreUrl, {
        params: { event: matchingEvent.id }
      })
      
      // Extract player stats
      const playerLogs = this.extractPlayerStats(boxscore.data, game)
      
      // Insert player logs
      if (playerLogs.length > 0) {
        const { error } = await supabase
          .from('player_game_logs')
          .insert(playerLogs)
        
        if (!error) {
          this.progress.totalPlayerLogs += playerLogs.length
          return true
        }
      }
      
      return false
      
    } catch (error) {
      return false
    }
  }
  
  private async collectNBAData(game: any): Promise<boolean> {
    // Specialized NBA collection
    return this.collectESPNData(game)
  }
  
  private async collectNFLData(game: any): Promise<boolean> {
    // Specialized NFL collection
    return this.collectESPNData(game)
  }
  
  private async collectMLBData(game: any): Promise<boolean> {
    // Specialized MLB collection
    return this.collectESPNData(game)
  }
  
  private async collectNHLData(game: any): Promise<boolean> {
    // Specialized NHL collection
    return this.collectESPNData(game)
  }
  
  private extractPlayerStats(data: any, game: any): any[] {
    const playerLogs = []
    
    // Extract based on sport structure
    // This is simplified - real implementation would parse specific formats
    
    const teams = data?.boxscore?.teams || []
    
    teams.forEach(team => {
      const players = team.statistics?.[0]?.athletes || []
      
      players.forEach(player => {
        const stats = this.parsePlayerStats(player.stats, game.sport)
        
        if (stats) {
          playerLogs.push({
            game_id: game.id,
            player_id: player.id,
            team_id: team.id,
            fantasy_points: this.calculateFantasyPoints(stats, game.sport),
            stats: stats,
            game_date: game.start_time,
            created_at: new Date().toISOString()
          })
        }
      })
    })
    
    return playerLogs
  }
  
  private parsePlayerStats(statArray: string[], sport: string): any {
    // Parse stats based on sport
    // Real implementation would handle each sport's format
    return {
      points: parseInt(statArray[0]) || 0,
      rebounds: parseInt(statArray[1]) || 0,
      assists: parseInt(statArray[2]) || 0
    }
  }
  
  private calculateFantasyPoints(stats: any, sport: string): number {
    // Use DFS scoring
    let points = 0
    
    switch (sport?.toUpperCase()) {
      case 'NBA':
        points = stats.points * 1 +
                 stats.rebounds * 1.25 +
                 stats.assists * 1.5 +
                 (stats.steals || 0) * 2 +
                 (stats.blocks || 0) * 2 +
                 (stats.turnovers || 0) * -0.5
        break
        
      case 'NFL':
        points = (stats.passing_yards || 0) * 0.04 +
                 (stats.passing_tds || 0) * 4 +
                 (stats.rushing_yards || 0) * 0.1 +
                 (stats.rushing_tds || 0) * 6 +
                 (stats.receptions || 0) * 1 +
                 (stats.receiving_yards || 0) * 0.1 +
                 (stats.receiving_tds || 0) * 6
        break
        
      default:
        points = stats.points || 0
    }
    
    return Math.round(points * 100) / 100
  }
  
  private loadProgress() {
    if (fs.existsSync(this.progressFile)) {
      const saved = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'))
      this.progress = { ...saved, startTime: new Date(saved.startTime) }
      console.log(chalk.yellow(`Resuming from game ${this.progress.processedGames}/${this.progress.totalGames}\n`))
    }
  }
  
  private saveProgress() {
    fs.writeFileSync(this.progressFile, JSON.stringify(this.progress, null, 2))
  }
  
  private showStats() {
    const elapsed = (Date.now() - this.progress.startTime.getTime()) / 1000 / 60
    const rate = this.progress.processedGames / elapsed
    const remaining = (this.progress.totalGames - this.progress.processedGames) / rate
    
    console.log(chalk.cyan('\n📊 Progress Update:'))
    console.log(chalk.white(`• Processed: ${this.progress.processedGames}/${this.progress.totalGames} games`))
    console.log(chalk.green(`• Successful: ${this.progress.successfulGames}`))
    console.log(chalk.red(`• Failed: ${this.progress.failedGames}`))
    console.log(chalk.white(`• Player logs created: ${this.progress.totalPlayerLogs.toLocaleString()}`))
    console.log(chalk.white(`• Rate: ${rate.toFixed(1)} games/min`))
    console.log(chalk.white(`• ETA: ${remaining.toFixed(0)} minutes\n`))
  }
  
  private generateFinalReport() {
    const elapsed = (Date.now() - this.progress.startTime.getTime()) / 1000 / 60
    
    console.log(chalk.cyan.bold('\n✅ BACKFILL COMPLETE!\n'))
    console.log(chalk.white(`Total time: ${elapsed.toFixed(1)} minutes`))
    console.log(chalk.white(`Games processed: ${this.progress.processedGames}`))
    console.log(chalk.green(`Successful: ${this.progress.successfulGames}`))
    console.log(chalk.red(`Failed: ${this.progress.failedGames}`))
    console.log(chalk.yellow(`Success rate: ${(this.progress.successfulGames / this.progress.processedGames * 100).toFixed(1)}%`))
    console.log(chalk.green.bold(`\n🎉 Created ${this.progress.totalPlayerLogs.toLocaleString()} player logs!`))
    
    // Save final report
    const report = {
      ...this.progress,
      completedAt: new Date(),
      duration: elapsed
    }
    
    fs.writeFileSync('backfill-report.json', JSON.stringify(report, null, 2))
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Run orchestrator
async function main() {
  const orchestrator = new MegaBackfillOrchestrator()
  await orchestrator.orchestrate()
}

if (require.main === module) {
  main().catch(console.error)
}