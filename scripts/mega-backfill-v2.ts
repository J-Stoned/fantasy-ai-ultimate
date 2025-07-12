#!/usr/bin/env tsx
/**
 * MEGA BACKFILL V2
 * Uses proven ESPN collection logic from existing scripts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import * as fs from 'fs'
import axios from 'axios'
import pLimit from 'p-limit'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports'

// Rate limiting
const limit = pLimit(3) // 3 concurrent requests

interface BackfillProgress {
  lastProcessedGameId: number
  totalGames: number
  processedGames: number
  successfulGames: number
  failedGames: number
  totalPlayerLogs: number
  startTime: Date
  errors: any[]
}

class MegaBackfillV2 {
  private progress: BackfillProgress
  private progressFile = 'backfill-progress-v2.json'
  
  constructor() {
    this.progress = this.loadProgress()
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n🚀 MEGA BACKFILL V2 - USING PROVEN ESPN COLLECTORS\n'))
    
    try {
      // Get games needing data
      const games = await this.getGamesNeedingData()
      this.progress.totalGames = games.length
      
      console.log(chalk.green(`Found ${games.length} games needing player data\n`))
      
      // Process in batches
      const batchSize = 10
      
      for (let i = 0; i < games.length; i += batchSize) {
        if (this.progress.lastProcessedGameId && games[i].id <= this.progress.lastProcessedGameId) {
          continue // Skip already processed
        }
        
        const batch = games.slice(i, i + batchSize)
        console.log(chalk.yellow(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(games.length/batchSize)}`))
        
        // Process batch with rate limiting
        await Promise.all(
          batch.map(game => limit(() => this.processGame(game)))
        )
        
        this.progress.lastProcessedGameId = batch[batch.length - 1].id
        this.saveProgress()
        
        // Show stats
        if (this.progress.processedGames % 50 === 0) {
          this.showStats()
        }
        
        // Rate limit between batches
        await this.sleep(1000)
      }
      
      this.showFinalReport()
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
      this.saveProgress()
    }
  }
  
  private async getGamesNeedingData(): Promise<any[]> {
    console.log(chalk.yellow('Finding games without player data...\n'))
    
    // Get recent completed games with ESPN IDs
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, external_id, home_team_id, away_team_id, start_time')
      .eq('status', 'completed')
      .not('external_id', 'is', null)
      .like('external_id', 'espn_%')
      .order('start_time', { ascending: false })
      .limit(500) // Start with 500 recent games
    
    if (!games) return []
    
    // Filter games without sufficient player logs
    const gamesNeedingData = []
    
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .gt('fantasy_points', 0)
      
      if (!count || count < 10) {
        gamesNeedingData.push(game)
      }
    }
    
    return gamesNeedingData
  }
  
  private async processGame(game: any) {
    try {
      console.log(chalk.dim(`  Processing ${game.sport} game ${game.id}...`))
      
      // Extract ESPN ID
      const espnId = game.external_id?.replace('espn_', '')
      if (!espnId) {
        throw new Error('No ESPN ID found')
      }
      
      // Get sport endpoint
      const sportMap: Record<string, string> = {
        nfl: 'football/nfl',
        NFL: 'football/nfl',
        nba: 'basketball/nba',
        NBA: 'basketball/nba',
        mlb: 'baseball/mlb',
        MLB: 'baseball/mlb',
        nhl: 'hockey/nhl',
        NHL: 'hockey/nhl'
      }
      
      const sport = sportMap[game.sport] || sportMap[game.sport.toUpperCase()]
      if (!sport) {
        throw new Error(`Unknown sport: ${game.sport}`)
      }
      
      // Fetch boxscore from ESPN
      const url = `${ESPN_API}/${sport}/summary?event=${espnId}`
      const response = await axios.get(url)
      
      // Extract player stats based on sport
      let playerLogs = []
      
      if (game.sport.toUpperCase() === 'NFL') {
        playerLogs = await this.extractNFLStats(response.data, game)
      } else if (game.sport.toUpperCase() === 'NBA') {
        playerLogs = await this.extractNBAStats(response.data, game)
      } else {
        // Generic extraction
        playerLogs = await this.extractGenericStats(response.data, game)
      }
      
      // Save player logs
      if (playerLogs.length > 0) {
        // Ensure players exist first
        const playerIds = [...new Set(playerLogs.map(log => log.player_id))]
        await this.ensurePlayersExist(playerIds)
        
        // Insert logs
        const { error } = await supabase
          .from('player_game_logs')
          .upsert(playerLogs, { onConflict: 'player_id,game_id' })
        
        if (!error) {
          this.progress.successfulGames++
          this.progress.totalPlayerLogs += playerLogs.length
          console.log(chalk.green(`    ✓ Saved ${playerLogs.length} player logs`))
        } else {
          throw error
        }
      }
      
      this.progress.processedGames++
      
    } catch (error) {
      this.progress.failedGames++
      this.progress.errors.push({ game_id: game.id, error: error.message })
      console.error(chalk.red(`    ✗ Error: ${error.message}`))
    }
  }
  
  private async extractNFLStats(data: any, game: any): Promise<any[]> {
    const logs = []
    const boxscore = data.boxscore
    
    if (!boxscore?.players) return logs
    
    // Process each team
    for (const team of boxscore.players) {
      const teamId = team.team.id
      
      // Process each stat category
      const categories = ['passing', 'rushing', 'receiving', 'defensive', 'kicking']
      
      for (const category of categories) {
        const stats = team.statistics?.find(s => s.name.toLowerCase() === category)
        if (!stats?.athletes) continue
        
        for (const athlete of stats.athletes) {
          const playerId = parseInt(athlete.athlete.id)
          
          // Parse stats based on category
          const playerStats: any = {
            player_id: playerId,
            name: athlete.athlete.displayName
          }
          
          if (category === 'passing' && athlete.stats.length >= 9) {
            playerStats.completions = parseInt(athlete.stats[0]) || 0
            playerStats.attempts = parseInt(athlete.stats[1]) || 0
            playerStats.passing_yards = parseInt(athlete.stats[2]) || 0
            playerStats.passing_tds = parseInt(athlete.stats[5]) || 0
            playerStats.interceptions = parseInt(athlete.stats[6]) || 0
          } else if (category === 'rushing' && athlete.stats.length >= 5) {
            playerStats.carries = parseInt(athlete.stats[0]) || 0
            playerStats.rushing_yards = parseInt(athlete.stats[1]) || 0
            playerStats.rushing_tds = parseInt(athlete.stats[3]) || 0
          } else if (category === 'receiving' && athlete.stats.length >= 5) {
            playerStats.receptions = parseInt(athlete.stats[0]) || 0
            playerStats.receiving_yards = parseInt(athlete.stats[1]) || 0
            playerStats.receiving_tds = parseInt(athlete.stats[3]) || 0
            playerStats.targets = parseInt(athlete.stats[4]) || 0
          }
          
          // Find or create log entry
          let log = logs.find(l => l.player_id === playerId)
          if (!log) {
            log = {
              game_id: game.id,
              player_id: playerId,
              team_id: teamId,
              stats: {},
              fantasy_points: 0,
              game_date: game.start_time
            }
            logs.push(log)
          }
          
          // Merge stats
          Object.assign(log.stats, playerStats)
        }
      }
    }
    
    // Calculate fantasy points
    logs.forEach(log => {
      log.fantasy_points = this.calculateNFLFantasyPoints(log.stats)
    })
    
    return logs
  }
  
  private async extractNBAStats(data: any, game: any): Promise<any[]> {
    const logs = []
    const boxscore = data.boxscore
    
    if (!boxscore?.players) return logs
    
    // Process each team
    for (const team of boxscore.players) {
      const teamId = team.team.id
      const stats = team.statistics?.[0] // NBA has one stat category
      
      if (!stats?.athletes) continue
      
      for (const athlete of stats.athletes) {
        if (!athlete.stats || athlete.stats.length < 15) continue
        
        const log = {
          game_id: game.id,
          player_id: parseInt(athlete.athlete.id),
          team_id: teamId,
          stats: {
            minutes: parseInt(athlete.stats[0]) || 0,
            field_goals_made: parseInt(athlete.stats[1]) || 0,
            field_goals_attempted: parseInt(athlete.stats[2]) || 0,
            three_pointers_made: parseInt(athlete.stats[4]) || 0,
            three_pointers_attempted: parseInt(athlete.stats[5]) || 0,
            free_throws_made: parseInt(athlete.stats[7]) || 0,
            free_throws_attempted: parseInt(athlete.stats[8]) || 0,
            rebounds: parseInt(athlete.stats[10]) || 0,
            assists: parseInt(athlete.stats[11]) || 0,
            steals: parseInt(athlete.stats[12]) || 0,
            blocks: parseInt(athlete.stats[13]) || 0,
            turnovers: parseInt(athlete.stats[14]) || 0,
            points: parseInt(athlete.stats[15]) || 0
          },
          fantasy_points: 0,
          game_date: game.start_time
        }
        
        // Calculate fantasy points
        log.fantasy_points = this.calculateNBAFantasyPoints(log.stats)
        
        logs.push(log)
      }
    }
    
    return logs
  }
  
  private async extractGenericStats(data: any, game: any): Promise<any[]> {
    // Simplified generic extraction
    const logs = []
    const boxscore = data.boxscore
    
    if (!boxscore?.players) return logs
    
    for (const team of boxscore.players) {
      const athletes = team.statistics?.[0]?.athletes || []
      
      for (const athlete of athletes) {
        if (!athlete.stats || athlete.stats.length === 0) continue
        
        logs.push({
          game_id: game.id,
          player_id: parseInt(athlete.athlete.id),
          team_id: team.team.id,
          stats: { raw: athlete.stats },
          fantasy_points: 0,
          game_date: game.start_time
        })
      }
    }
    
    return logs
  }
  
  private calculateNFLFantasyPoints(stats: any): number {
    let points = 0
    
    // DraftKings scoring
    points += (stats.passing_yards || 0) * 0.04
    points += (stats.passing_tds || 0) * 4
    points += (stats.interceptions || 0) * -1
    points += (stats.rushing_yards || 0) * 0.1
    points += (stats.rushing_tds || 0) * 6
    points += (stats.receptions || 0) * 1 // PPR
    points += (stats.receiving_yards || 0) * 0.1
    points += (stats.receiving_tds || 0) * 6
    
    return Math.round(points * 100) / 100
  }
  
  private calculateNBAFantasyPoints(stats: any): number {
    let points = 0
    
    // DraftKings scoring
    points += (stats.points || 0) * 1
    points += (stats.rebounds || 0) * 1.25
    points += (stats.assists || 0) * 1.5
    points += (stats.steals || 0) * 2
    points += (stats.blocks || 0) * 2
    points += (stats.turnovers || 0) * -0.5
    points += (stats.three_pointers_made || 0) * 0.5
    
    // Double-double/triple-double bonus
    const doubleCount = [
      stats.points >= 10,
      stats.rebounds >= 10,
      stats.assists >= 10,
      stats.steals >= 10,
      stats.blocks >= 10
    ].filter(Boolean).length
    
    if (doubleCount >= 3) points += 3
    else if (doubleCount >= 2) points += 1.5
    
    return Math.round(points * 100) / 100
  }
  
  private async ensurePlayersExist(playerIds: number[]) {
    // Check which players exist
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id')
      .in('id', playerIds)
    
    const existingIds = new Set(existingPlayers?.map(p => p.id) || [])
    const newPlayerIds = playerIds.filter(id => !existingIds.has(id))
    
    if (newPlayerIds.length > 0) {
      // Create placeholder players
      const newPlayers = newPlayerIds.map(id => ({
        id,
        name: `Player ${id}`,
        status: 'active'
      }))
      
      await supabase.from('players').insert(newPlayers)
    }
  }
  
  private loadProgress(): BackfillProgress {
    const defaultProgress = {
      lastProcessedGameId: 0,
      totalGames: 0,
      processedGames: 0,
      successfulGames: 0,
      failedGames: 0,
      totalPlayerLogs: 0,
      startTime: new Date(),
      errors: []
    }
    
    if (fs.existsSync(this.progressFile)) {
      const saved = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'))
      return { ...saved, startTime: new Date(saved.startTime) }
    }
    
    return defaultProgress
  }
  
  private saveProgress() {
    fs.writeFileSync(this.progressFile, JSON.stringify(this.progress, null, 2))
  }
  
  private showStats() {
    const elapsed = (Date.now() - this.progress.startTime.getTime()) / 1000 / 60
    const rate = this.progress.processedGames / elapsed
    
    console.log(chalk.cyan('\n📊 Progress Update:'))
    console.log(chalk.white(`• Processed: ${this.progress.processedGames}/${this.progress.totalGames}`))
    console.log(chalk.green(`• Successful: ${this.progress.successfulGames}`))
    console.log(chalk.red(`• Failed: ${this.progress.failedGames}`))
    console.log(chalk.white(`• Player logs: ${this.progress.totalPlayerLogs.toLocaleString()}`))
    console.log(chalk.white(`• Rate: ${rate.toFixed(1)} games/min\n`))
  }
  
  private showFinalReport() {
    console.log(chalk.cyan.bold('\n✅ BACKFILL COMPLETE!\n'))
    console.log(chalk.green(`Successfully processed ${this.progress.successfulGames} games`))
    console.log(chalk.green(`Created ${this.progress.totalPlayerLogs.toLocaleString()} player logs`))
    
    if (this.progress.errors.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${this.progress.errors.length} errors occurred`))
      fs.writeFileSync('backfill-errors.json', JSON.stringify(this.progress.errors, null, 2))
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Run backfill
async function main() {
  const backfill = new MegaBackfillV2()
  await backfill.run()
}

if (require.main === module) {
  main().catch(console.error)
}