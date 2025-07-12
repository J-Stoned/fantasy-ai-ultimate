#!/usr/bin/env tsx
/**
 * SMART SEASON COLLECTOR
 * Focuses on current season NFL and NBA games for maximum success
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import axios from 'axios'
import pLimit from 'p-limit'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports'
const limit = pLimit(3)

interface CollectionStats {
  totalGames: number
  processedGames: number
  successfulGames: number
  failedGames: number
  playerLogsCreated: number
  startTime: Date
}

class SmartSeasonCollector {
  private stats: CollectionStats = {
    totalGames: 0,
    processedGames: 0,
    successfulGames: 0,
    failedGames: 0,
    playerLogsCreated: 0,
    startTime: new Date()
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n🏈 SMART SEASON COLLECTOR - FOCUSING ON CURRENT SEASON\n'))
    
    try {
      // Get NFL games from 2024 season
      const nflGames = await this.getSeasonGames('NFL', '2024-09-01', '2025-02-28')
      console.log(chalk.green(`Found ${nflGames.length} NFL games from current season`))
      
      // Get NBA games from 2024-25 season
      const nbaGames = await this.getSeasonGames('NBA', '2024-10-01', '2025-06-30')
      console.log(chalk.green(`Found ${nbaGames.length} NBA games from current season`))
      
      // Get MLB games from 2025 season (April - October)
      const mlbGames = await this.getSeasonGames('MLB', '2025-03-01', '2025-11-30')
      console.log(chalk.green(`Found ${mlbGames.length} MLB games from current season`))
      
      // Get NCAA Football games (August - January)
      const ncaaFBGames = await this.getSeasonGames('NCAAF', '2024-08-01', '2025-01-31')
      console.log(chalk.green(`Found ${ncaaFBGames.length} NCAA Football games from current season`))
      
      // Get NCAA Basketball games (November - March)
      const ncaaBBGames = await this.getSeasonGames('NCAAB', '2024-11-01', '2025-04-30')
      console.log(chalk.green(`Found ${ncaaBBGames.length} NCAA Basketball games from current season`))
      
      const allGames = [...nflGames, ...nbaGames, ...mlbGames, ...ncaaFBGames, ...ncaaBBGames]
      this.stats.totalGames = allGames.length
      
      console.log(chalk.yellow(`\nTotal games to process: ${allGames.length}\n`))
      
      // Process in batches
      const batchSize = 10
      for (let i = 0; i < allGames.length; i += batchSize) {
        const batch = allGames.slice(i, i + batchSize)
        console.log(chalk.cyan(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allGames.length/batchSize)}`))
        
        await Promise.all(
          batch.map(game => limit(() => this.processGame(game)))
        )
        
        this.showProgress()
        
        // Rate limit between batches
        await this.sleep(1000)
      }
      
      this.showFinalReport()
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
    }
  }
  
  private async getSeasonGames(sport: string, startDate: string, endDate: string): Promise<any[]> {
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, external_id, home_team_id, away_team_id, start_time')
      .eq('status', 'completed')
      .eq('sport', sport)
      .not('external_id', 'is', null)
      .like('external_id', 'espn_%')
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: false })
      .limit(200)
    
    if (!games) return []
    
    // Filter games needing data
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
      
      // Extract ESPN ID - handle different formats
      let espnId = game.external_id
      if (!espnId) {
        throw new Error('No ESPN ID')
      }
      
      // Clean up the ID based on format
      if (espnId.startsWith('espn_')) {
        espnId = espnId.replace('espn_', '')
      } else if (espnId.startsWith('mlb_')) {
        espnId = espnId.replace('mlb_', '')
      }
      
      const sportMap = {
        NFL: 'football/nfl',
        NBA: 'basketball/nba',
        MLB: 'baseball/mlb',
        NCAAF: 'football/college-football',
        NCAAB: 'basketball/mens-college-basketball'
      }
      
      const sport = sportMap[game.sport]
      const url = `${ESPN_API}/${sport}/summary?event=${espnId}`
      const response = await axios.get(url, { timeout: 10000 })
      
      // Extract player stats based on sport
      let playerLogs = []
      
      if (game.sport === 'NFL' || game.sport === 'NCAAF') {
        playerLogs = await this.extractNFLStats(response.data, game)
      } else if (game.sport === 'NBA' || game.sport === 'NCAAB') {
        playerLogs = await this.extractNBAStats(response.data, game)
      } else if (game.sport === 'MLB') {
        playerLogs = await this.extractMLBStats(response.data, game)
      }
      
      // Save player logs
      if (playerLogs.length > 0) {
        const playerIds = [...new Set(playerLogs.map(log => log.player_id))]
        await this.ensurePlayersExist(playerIds)
        
        const { error } = await supabase
          .from('player_game_logs')
          .upsert(playerLogs, { onConflict: 'player_id,game_id' })
        
        if (!error) {
          this.stats.successfulGames++
          this.stats.playerLogsCreated += playerLogs.length
          console.log(chalk.green(`    ✓ Saved ${playerLogs.length} player logs`))
        } else {
          throw error
        }
      }
      
      this.stats.processedGames++
      
    } catch (error: any) {
      this.stats.failedGames++
      console.error(chalk.red(`    ✗ Error: ${error.message}`))
    }
  }
  
  private async extractNFLStats(data: any, game: any): Promise<any[]> {
    const logs = []
    const boxscore = data.boxscore
    
    if (!boxscore?.players) return logs
    
    for (const team of boxscore.players) {
      const teamId = team.team.id
      
      const categories = ['passing', 'rushing', 'receiving']
      
      for (const category of categories) {
        const stats = team.statistics?.find(s => s.name.toLowerCase() === category)
        if (!stats?.athletes) continue
        
        for (const athlete of stats.athletes) {
          const playerId = parseInt(athlete.athlete.id)
          
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
          
          // Parse stats
          if (category === 'passing' && athlete.stats.length >= 9) {
            log.stats.passing_yards = parseInt(athlete.stats[2]) || 0
            log.stats.passing_tds = parseInt(athlete.stats[5]) || 0
            log.stats.interceptions = parseInt(athlete.stats[6]) || 0
          } else if (category === 'rushing' && athlete.stats.length >= 5) {
            log.stats.rushing_yards = parseInt(athlete.stats[1]) || 0
            log.stats.rushing_tds = parseInt(athlete.stats[3]) || 0
          } else if (category === 'receiving' && athlete.stats.length >= 5) {
            log.stats.receptions = parseInt(athlete.stats[0]) || 0
            log.stats.receiving_yards = parseInt(athlete.stats[1]) || 0
            log.stats.receiving_tds = parseInt(athlete.stats[3]) || 0
          }
        }
      }
    }
    
    // Calculate fantasy points
    logs.forEach(log => {
      let points = 0
      points += (log.stats.passing_yards || 0) * 0.04
      points += (log.stats.passing_tds || 0) * 4
      points += (log.stats.interceptions || 0) * -1
      points += (log.stats.rushing_yards || 0) * 0.1
      points += (log.stats.rushing_tds || 0) * 6
      points += (log.stats.receptions || 0) * 1
      points += (log.stats.receiving_yards || 0) * 0.1
      points += (log.stats.receiving_tds || 0) * 6
      
      log.fantasy_points = Math.round(points * 100) / 100
    })
    
    return logs
  }
  
  private async extractNBAStats(data: any, game: any): Promise<any[]> {
    const logs = []
    const boxscore = data.boxscore
    
    if (!boxscore?.players) return logs
    
    for (const team of boxscore.players) {
      const teamId = team.team.id
      const stats = team.statistics?.[0]
      
      if (!stats?.athletes) continue
      
      for (const athlete of stats.athletes) {
        if (!athlete.stats || athlete.stats.length < 15) continue
        
        const log = {
          game_id: game.id,
          player_id: parseInt(athlete.athlete.id),
          team_id: teamId,
          stats: {
            minutes: parseInt(athlete.stats[0]) || 0,
            points: parseInt(athlete.stats[15]) || 0,
            rebounds: parseInt(athlete.stats[10]) || 0,
            assists: parseInt(athlete.stats[11]) || 0,
            steals: parseInt(athlete.stats[12]) || 0,
            blocks: parseInt(athlete.stats[13]) || 0,
            turnovers: parseInt(athlete.stats[14]) || 0
          },
          fantasy_points: 0,
          game_date: game.start_time
        }
        
        // Calculate fantasy points
        log.fantasy_points = log.stats.points + 
          (log.stats.rebounds * 1.25) + 
          (log.stats.assists * 1.5) + 
          (log.stats.steals * 2) + 
          (log.stats.blocks * 2) + 
          (log.stats.turnovers * -0.5)
        
        log.fantasy_points = Math.round(log.fantasy_points * 100) / 100
        
        logs.push(log)
      }
    }
    
    return logs
  }
  
  private async extractMLBStats(data: any, game: any): Promise<any[]> {
    const logs = []
    const boxscore = data.boxscore
    
    if (!boxscore?.players) return logs
    
    for (const team of boxscore.players) {
      const teamId = team.team.id
      
      // Process batting stats
      const batting = team.statistics?.find(s => s.name.toLowerCase() === 'batting')
      if (batting?.athletes) {
        for (const athlete of batting.athletes) {
          if (!athlete.stats || athlete.stats.length < 8) continue
          
          const log = {
            game_id: game.id,
            player_id: parseInt(athlete.athlete.id),
            team_id: teamId,
            stats: {
              at_bats: parseInt(athlete.stats[0]) || 0,
              runs: parseInt(athlete.stats[1]) || 0,
              hits: parseInt(athlete.stats[2]) || 0,
              rbi: parseInt(athlete.stats[3]) || 0,
              walks: parseInt(athlete.stats[4]) || 0,
              strikeouts: parseInt(athlete.stats[5]) || 0,
              batting_avg: parseFloat(athlete.stats[6]) || 0
            },
            fantasy_points: 0,
            game_date: game.start_time
          }
          
          // Calculate fantasy points (DraftKings scoring)
          log.fantasy_points = (log.stats.runs * 2) + 
            (log.stats.rbi * 2) + 
            (log.stats.hits * 1) + 
            (log.stats.walks * 1) + 
            (log.stats.strikeouts * -0.5)
          
          log.fantasy_points = Math.round(log.fantasy_points * 100) / 100
          
          logs.push(log)
        }
      }
      
      // Process pitching stats
      const pitching = team.statistics?.find(s => s.name.toLowerCase() === 'pitching')
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
              pitches: parseInt(athlete.stats[8]) || 0
            },
            fantasy_points: 0,
            game_date: game.start_time
          }
          
          // Calculate fantasy points (DraftKings scoring)
          log.fantasy_points = (log.stats.innings_pitched * 2.25) + 
            (log.stats.strikeouts * 2) + 
            (log.stats.earned_runs * -2) + 
            (log.stats.walks_allowed * -1) + 
            (log.stats.hits_allowed * -0.6)
          
          // Win bonus would be added if we had that data
          
          log.fantasy_points = Math.round(log.fantasy_points * 100) / 100
          
          logs.push(log)
        }
      }
    }
    
    return logs
  }
  
  private async ensurePlayersExist(playerIds: number[]) {
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('id')
      .in('id', playerIds)
    
    const existingIds = new Set(existingPlayers?.map(p => p.id) || [])
    const newPlayerIds = playerIds.filter(id => !existingIds.has(id))
    
    if (newPlayerIds.length > 0) {
      const newPlayers = newPlayerIds.map(id => ({
        id,
        name: `Player ${id}`,
        status: 'active'
      }))
      
      await supabase.from('players').insert(newPlayers)
    }
  }
  
  private showProgress() {
    const elapsed = (Date.now() - this.stats.startTime.getTime()) / 1000 / 60
    const rate = this.stats.processedGames / elapsed
    
    console.log(chalk.cyan('\n📊 Progress:'))
    console.log(chalk.white(`• Processed: ${this.stats.processedGames}/${this.stats.totalGames}`))
    console.log(chalk.green(`• Successful: ${this.stats.successfulGames}`))
    console.log(chalk.red(`• Failed: ${this.stats.failedGames}`))
    console.log(chalk.white(`• Player logs: ${this.stats.playerLogsCreated.toLocaleString()}`))
    console.log(chalk.white(`• Rate: ${rate.toFixed(1)} games/min`))
  }
  
  private showFinalReport() {
    console.log(chalk.cyan.bold('\n✅ COLLECTION COMPLETE!\n'))
    console.log(chalk.green(`Successfully processed ${this.stats.successfulGames} games`))
    console.log(chalk.green(`Created ${this.stats.playerLogsCreated.toLocaleString()} player logs`))
    console.log(chalk.yellow(`Success rate: ${(this.stats.successfulGames / this.stats.processedGames * 100).toFixed(1)}%`))
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Run collector
async function main() {
  const collector = new SmartSeasonCollector()
  await collector.run()
}

if (require.main === module) {
  main().catch(console.error)
}