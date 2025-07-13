#!/usr/bin/env tsx
/**
 * MLB SEASON COLLECTOR
 * Focused collector for current MLB season
 */

import { db } from '../lib/services/database-service'
import { generateUniversalGameId, addExternalId } from '../lib/universal-id-helpers'
import chalk from 'chalk'
import axios from 'axios'
import pLimit from 'p-limit'

const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb'
const limit = pLimit(3)

class MLBSeasonCollector {
  private stats = {
    totalGames: 0,
    processedGames: 0,
    successfulGames: 0,
    failedGames: 0,
    playerLogsCreated: 0,
    startTime: new Date()
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n⚾ MLB SEASON COLLECTOR - 2025 SEASON\n'))
    
    try {
      // Get MLB games from current season using standardized service
      const mlbGames = await db.getGames({
        sport: 'MLB',
        status: 'completed',
        startDate: '2025-03-01',
        endDate: '2025-10-31',
        limit: 100
      })
      
      // Filter games with external IDs
      const gamesWithIds = mlbGames.filter(game => game.external_id || game.universal_id)
      
      if (gamesWithIds.length === 0) {
        console.log(chalk.yellow('No MLB games with IDs found for 2025 season'))
        return
      }
      
      // Filter games needing data
      const gamesNeedingData = []
      for (const game of gamesWithIds) {
        const count = await db.countRecords('player_game_logs', {
          game_id: game.id
        })
        
        if (count < 10) {
          gamesNeedingData.push(game)
        }
      }
      
      this.stats.totalGames = gamesNeedingData.length
      console.log(chalk.green(`Found ${gamesNeedingData.length} MLB games needing data\n`))
      
      // Process in batches
      const batchSize = 5
      for (let i = 0; i < gamesNeedingData.length; i += batchSize) {
        const batch = gamesNeedingData.slice(i, i + batchSize)
        console.log(chalk.cyan(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(gamesNeedingData.length/batchSize)}`))
        
        await Promise.all(
          batch.map(game => limit(() => this.processGame(game)))
        )
        
        this.showProgress()
        await this.sleep(1000)
      }
      
      this.showFinalReport()
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
    }
  }
  
  private async processGame(game: any) {
    try {
      console.log(chalk.dim(`  Processing MLB game ${game.id} (${game.external_id})...`))
      
      // Extract ESPN ID - handle different formats
      let espnId = game.external_id
      
      if (!espnId) {
        // Try to get from external IDs table
        const externalIds = await db.getExternalIds(game.id)
        const espnMapping = externalIds.find(e => e.source === 'espn')
        if (espnMapping) {
          espnId = espnMapping.external_id
        } else {
          console.log(chalk.yellow(`    No ESPN ID for game ${game.id}`)))
          this.stats.failedGames++
          return
        }
      }
      
      // Clean up the ID - handle multiple format layers
      if (espnId.startsWith('espn_')) {
        espnId = espnId.replace('espn_', '')
      }
      if (espnId.startsWith('mlb_')) {
        espnId = espnId.replace('mlb_', '')
      }
      
      // Extract just the numeric ID
      const numericMatch = espnId.match(/(\d+)/)
      if (numericMatch) {
        espnId = numericMatch[1]
      } else {
        console.log(chalk.yellow(`    Skipping invalid ID format: ${espnId}`))
        this.stats.failedGames++
        return
      }
      
      // Store clean ESPN ID in mapping table if using universal ID
      if (game.universal_id) {
        await db.addExternalId(game.id, 'espn', espnId).catch(() => {
          // Ignore duplicate key errors
        })
      }
      
      const url = `${ESPN_API}/summary?event=${espnId}`
      console.log(chalk.dim(`    Fetching: ${url}`))
      
      const response = await axios.get(url, { timeout: 10000 })
      
      // Extract player stats
      const playerLogs = await this.extractMLBStats(response.data, game)
      
      // Save player logs
      if (playerLogs.length > 0) {
        const playerIds = [...new Set(playerLogs.map(log => log.player_id))]
        await db.ensurePlayersExist(playerIds)
        
        await db.upsertBatch('player_game_logs', playerLogs, {
          onConflict: 'player_id,game_id'
        })
        
        this.stats.successfulGames++
        this.stats.playerLogsCreated += playerLogs.length
        console.log(chalk.green(`    ✓ Saved ${playerLogs.length} player logs`))
      }
      
      this.stats.processedGames++
      
    } catch (error: any) {
      this.stats.failedGames++
      this.stats.processedGames++
      console.error(chalk.red(`    ✗ Error: ${error.response?.status || error.message}`))
    }
  }
  
  private async extractMLBStats(data: any, game: any): Promise<any[]> {
    const logs = []
    const boxscore = data.boxscore
    
    if (!boxscore?.players) {
      console.log(chalk.yellow('    No boxscore data found'))
      return logs
    }
    
    for (const team of boxscore.players) {
      const teamId = team.team.id
      
      // Process batting stats
      const batting = team.statistics?.find(s => s.type === 'batting')
      if (batting?.athletes) {
        for (const athlete of batting.athletes) {
          if (!athlete.stats || athlete.stats.length < 8) continue
          
          // Parse H-AB format (e.g., "1-4" means 1 hit in 4 at bats)
          const hitsAtBats = athlete.stats[0].split('-')
          const hits = parseInt(hitsAtBats[0]) || 0
          const atBats = parseInt(hitsAtBats[1]) || parseInt(athlete.stats[1]) || 0
          
          const log = {
            game_id: game.id,
            player_id: parseInt(athlete.athlete.id),
            team_id: teamId,
            stats: {
              at_bats: atBats,
              runs: parseInt(athlete.stats[2]) || 0,
              hits: hits,
              rbi: parseInt(athlete.stats[4]) || 0,
              home_runs: parseInt(athlete.stats[5]) || 0,
              walks: parseInt(athlete.stats[6]) || 0,
              strikeouts: parseInt(athlete.stats[7]) || 0,
              batting_avg: parseFloat(athlete.stats[9]) || 0
            },
            fantasy_points: 0,
            game_date: game.start_time
          }
          
          // Calculate fantasy points (DraftKings scoring)
          log.fantasy_points = 
            (log.stats.runs * 2) + 
            (log.stats.rbi * 2) + 
            (log.stats.hits * 3) + 
            (log.stats.walks * 2) + 
            (log.stats.strikeouts * -0.5) +
            (log.stats.home_runs * 10)
          
          log.fantasy_points = Math.round(log.fantasy_points * 100) / 100
          
          logs.push(log)
        }
      }
      
      // Process pitching stats
      const pitching = team.statistics?.find(s => s.type === 'pitching')
      if (pitching?.athletes) {
        for (const athlete of pitching.athletes) {
          if (!athlete.stats || athlete.stats.length < 10) continue
          
          const log = {
            game_id: game.id,
            player_id: parseInt(athlete.athlete.id),
            team_id: teamId,
            stats: {
              innings_pitched: parseFloat(athlete.stats[0]) || 0,
              hits_allowed: parseInt(athlete.stats[1]) || 0,
              runs_allowed: parseInt(athlete.stats[2]) || 0,
              earned_runs: parseInt(athlete.stats[3]) || 0,
              walks_allowed: parseInt(athlete.stats[4]) || 0,
              strikeouts: parseInt(athlete.stats[5]) || 0,
              home_runs_allowed: parseInt(athlete.stats[6]) || 0,
              pitches: parseInt(athlete.stats[8]) || 0
            },
            fantasy_points: 0,
            game_date: game.start_time
          }
          
          // Calculate fantasy points (DraftKings scoring)
          log.fantasy_points = 
            (log.stats.innings_pitched * 2.25) + 
            (log.stats.strikeouts * 2) + 
            (log.stats.earned_runs * -2) + 
            (log.stats.walks_allowed * -0.75) + 
            (log.stats.hits_allowed * -0.6) +
            (log.stats.home_runs_allowed * -2.8)
          
          // Bonus for quality start (6+ IP, 3 or less ER)
          if (log.stats.innings_pitched >= 6 && log.stats.earned_runs <= 3) {
            log.fantasy_points += 4
          }
          
          log.fantasy_points = Math.round(log.fantasy_points * 100) / 100
          
          logs.push(log)
        }
      }
    }
    
    return logs
  }
  
  
  private showProgress() {
    const elapsed = (Date.now() - this.stats.startTime.getTime()) / 1000 / 60
    const rate = this.stats.processedGames / elapsed
    
    console.log(chalk.cyan('\n📊 Progress:'))
    console.log(chalk.white(`• Processed: ${this.stats.processedGames}/${this.stats.totalGames}`))
    console.log(chalk.green(`• Successful: ${this.stats.successfulGames}`))
    console.log(chalk.red(`• Failed: ${this.stats.failedGames}`))
    console.log(chalk.white(`• Player logs: ${this.stats.playerLogsCreated.toLocaleString()}`))
    if (rate > 0) {
      console.log(chalk.white(`• Rate: ${rate.toFixed(1)} games/min`))
    }
  }
  
  private showFinalReport() {
    console.log(chalk.cyan.bold('\n✅ MLB COLLECTION COMPLETE!\n'))
    console.log(chalk.green(`Successfully processed ${this.stats.successfulGames} games`))
    console.log(chalk.green(`Created ${this.stats.playerLogsCreated.toLocaleString()} player logs`))
    if (this.stats.processedGames > 0) {
      console.log(chalk.yellow(`Success rate: ${(this.stats.successfulGames / this.stats.processedGames * 100).toFixed(1)}%`))
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Run collector
async function main() {
  const collector = new MLBSeasonCollector()
  await collector.run()
}

if (require.main === module) {
  main().catch(console.error)
}