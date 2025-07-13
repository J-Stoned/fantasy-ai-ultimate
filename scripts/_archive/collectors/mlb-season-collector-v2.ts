#!/usr/bin/env tsx
/**
 * MLB SEASON COLLECTOR V2
 * Refactored to use standardized database service and base collector
 */

import { BaseCollector } from '../lib/collectors/base-collector'
import axios from 'axios'
import chalk from 'chalk'

const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb'

class MLBSeasonCollectorV2 extends BaseCollector {
  constructor() {
    super({
      name: 'MLB SEASON COLLECTOR V2 - 2025 SEASON',
      concurrencyLimit: 3,
      batchSize: 5,
      retryAttempts: 3,
      enableDetailedLogging: true
    })
  }
  
  async getGamesToProcess(): Promise<any[]> {
    // Get MLB games from current season
    const mlbGames = await this.db.getGames({
      sport: 'MLB',
      status: 'completed',
      startDate: '2025-03-01',
      endDate: '2025-10-31',
      limit: 100
    })
    
    // Filter games with IDs
    const gamesWithIds = mlbGames.filter(game => 
      game.external_id || game.universal_id
    )
    
    // Filter games needing data
    const gamesNeedingData = []
    for (const game of gamesWithIds) {
      const count = await this.db.countRecords('player_game_logs', {
        game_id: game.id
      })
      
      if (count < 10) {
        gamesNeedingData.push(game)
      }
    }
    
    return gamesNeedingData
  }
  
  async processGame(game: any): Promise<void> {
    console.log(chalk.dim(`  Processing MLB game ${game.id} (${game.universal_id || 'no universal ID'})...`))
    
    // Get ESPN ID
    let espnId: string | null = null
    
    if (game.external_id) {
      espnId = this.extractEspnId(game.external_id)
    }
    
    if (!espnId) {
      // Try to get from external IDs table
      const externalIds = await this.db.getExternalIds(game.id)
      const espnMapping = externalIds.find(e => e.source === 'espn')
      if (espnMapping) {
        espnId = espnMapping.external_id
      }
    }
    
    if (!espnId) {
      throw new Error('No ESPN ID found')
    }
    
    // Store clean ESPN ID in mapping table
    if (game.universal_id) {
      await this.db.addExternalId(game.id, 'espn', espnId).catch(() => {
        // Ignore duplicate key errors
      })
    }
    
    // Fetch game data
    const url = `${ESPN_API}/summary?event=${espnId}`
    console.log(chalk.dim(`    Fetching: ${url}`))
    
    const response = await axios.get(url, { timeout: 10000 })
    
    // Extract player stats
    const playerLogs = await this.extractMLBStats(response.data, game)
    
    // Save player logs
    if (playerLogs.length > 0) {
      // Deduplicate logs - keep the one with highest fantasy points
      const uniqueLogs = new Map<string, any>()
      
      for (const log of playerLogs) {
        const key = `${log.player_id}_${log.game_id}`
        const existing = uniqueLogs.get(key)
        
        if (!existing || log.fantasy_points > existing.fantasy_points) {
          uniqueLogs.set(key, log)
        }
      }
      
      const deduplicatedLogs = Array.from(uniqueLogs.values())
      const playerIds = [...new Set(deduplicatedLogs.map(log => log.player_id))]
      
      await this.db.ensurePlayersExist(playerIds)
      
      await this.db.upsertBatch('player_game_logs', deduplicatedLogs, {
        onConflict: 'player_id,game_id'
      })
      
      this.stats.successfulGames++
      this.stats.playerLogsCreated += deduplicatedLogs.length
      console.log(chalk.green(`    ✓ Saved ${deduplicatedLogs.length} player logs (${playerLogs.length} before dedup)`))
    } else {
      console.log(chalk.yellow(`    No player data found`))
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
}

// Run collector
async function main() {
  const collector = new MLBSeasonCollectorV2()
  await collector.run()
}

if (require.main === module) {
  main().catch(console.error)
}