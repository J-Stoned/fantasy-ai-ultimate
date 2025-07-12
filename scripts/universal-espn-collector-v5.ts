#!/usr/bin/env tsx
/**
 * 🚀 UNIVERSAL ESPN COLLECTOR V5 - ALL SPORTS!
 * 
 * Collects stats for ALL 6,892 ESPN games across NBA, NHL, MLB, NFL
 * Uses standardized player_game_logs schema with JSONB stats
 * Handles foreign key constraints properly
 */

import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import { enhancedDb } from '../lib/services/enhanced-database-service'
import { PlayerGameLog } from '../lib/services/unlimited-data-service'

const limit = pLimit(20) // Parallel requests

interface CollectionStats {
  startTime: number
  totalGames: number
  gamesProcessed: number
  successful: number
  failed: number
  playersInserted: number
  recordsInserted: number
  recordsUpdated: number
  errors: any[]
  sportBreakdown: Record<string, { processed: number, successful: number }>
}

class UniversalESPNCollector {
  private stats: CollectionStats = {
    startTime: Date.now(),
    totalGames: 0,
    gamesProcessed: 0,
    successful: 0,
    failed: 0,
    playersInserted: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    errors: [],
    sportBreakdown: {
      NBA: { processed: 0, successful: 0 },
      NFL: { processed: 0, successful: 0 },
      MLB: { processed: 0, successful: 0 },
      NHL: { processed: 0, successful: 0 }
    }
  }

  async collectAllESPNGames() {
    console.log(chalk.bold.red('🚀 UNIVERSAL ESPN COLLECTOR V5!'))
    console.log(chalk.yellow('Collecting stats for ALL sports with standardized schema'))
    console.log(chalk.gray('=' + '='.repeat(70)))

    // Get baseline
    const baseline = await enhancedDb.getPlayerStatsCoverage()
    console.log(chalk.blue(`📊 BASELINE: ${baseline.coveragePercentage.toFixed(2)}% coverage`))
    console.log(chalk.blue(`📊 BASELINE: ${baseline.recordsInPlayerGameLogs.toLocaleString()} records`))

    // Get all games needing stats
    const gamesToProcess = await this.findGamesNeedingStats()
    this.stats.totalGames = gamesToProcess.length

    if (gamesToProcess.length === 0) {
      console.log(chalk.green('✅ All ESPN games already have stats!'))
      return
    }

    console.log(chalk.cyan(`\n🎯 Found ${gamesToProcess.length} games needing stats:`))
    Object.entries(this.groupBySport(gamesToProcess)).forEach(([sport, games]) => {
      console.log(chalk.white(`  ${sport}: ${games.length} games`))
    })

    // Process by sport for better organization
    const bySport = this.groupBySport(gamesToProcess)
    
    for (const [sport, games] of Object.entries(bySport)) {
      console.log(chalk.bold.cyan(`\n🏆 Processing ${sport} games...`))
      await this.processSportGames(sport, games)
    }

    // Final results
    await this.displayFinalResults(baseline)
  }

  private async findGamesNeedingStats(): Promise<any[]> {
    console.log(chalk.cyan('🔍 Finding games needing stats...'))

    // Get all ESPN games
    const allGames = []
    let offset = 0
    const batchSize = 1000

    while (true) {
      const { data: batch } = await enhancedDb.getClient()
        .from('games')
        .select('id, sport, external_id, home_team_id, away_team_id, start_time')
        .like('external_id', 'espn_%')
        .not('home_score', 'is', null)
        .in('sport', ['NBA', 'NFL', 'MLB', 'NHL'])
        .range(offset, offset + batchSize - 1)
        .order('start_time', { ascending: false })

      if (!batch || batch.length === 0) break
      allGames.push(...batch)
      if (batch.length < batchSize) break
      offset += batchSize
    }

    console.log(chalk.green(`✅ Found ${allGames.length} total ESPN games`))

    // Find games with zero or incomplete stats
    const gamesNeedingStats = []
    const checkBatchSize = 100

    for (let i = 0; i < allGames.length; i += checkBatchSize) {
      const batch = allGames.slice(i, i + checkBatchSize)
      
      for (const game of batch) {
        const { count } = await enhancedDb.getClient()
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id)

        const playerCount = count || 0
        const expectedPlayers = this.getExpectedPlayerCount(game.sport)

        // Include if no stats or incomplete
        if (playerCount < expectedPlayers * 0.8) {
          gamesNeedingStats.push({
            ...game,
            current_player_count: playerCount
          })
        }
      }

      if (i % 1000 === 0) {
        console.log(chalk.gray(`Checked ${i}/${allGames.length} games...`))
      }
    }

    return gamesNeedingStats
  }

  private getExpectedPlayerCount(sport: string): number {
    switch (sport) {
      case 'NBA': return 25
      case 'NFL': return 50
      case 'MLB': return 25
      case 'NHL': return 40
      default: return 30
    }
  }

  private groupBySport(games: any[]): Record<string, any[]> {
    return games.reduce((acc, game) => {
      const sport = game.sport || 'UNKNOWN'
      if (!acc[sport]) acc[sport] = []
      acc[sport].push(game)
      return acc
    }, {} as Record<string, any[]>)
  }

  private async processSportGames(sport: string, games: any[]) {
    const promises = games.map(game => 
      limit(async () => {
        this.stats.gamesProcessed++
        this.stats.sportBreakdown[sport].processed++

        try {
          const result = await this.processGame(game)
          if (result.success) {
            this.stats.successful++
            this.stats.sportBreakdown[sport].successful++
            this.stats.recordsInserted += result.inserted
            this.stats.recordsUpdated += result.updated
            console.log(chalk.green(`✅ ${sport} game ${game.id}: +${result.inserted} inserted, ${result.updated} updated`))
          } else {
            this.stats.failed++
            console.log(chalk.yellow(`⚠️ ${sport} game ${game.id}: ${result.error}`))
          }
        } catch (error: any) {
          this.stats.failed++
          this.stats.errors.push({ game: game.id, sport, error: error.message })
          console.error(chalk.red(`❌ ${sport} game ${game.id}: ${error.message}`))
        }

        // Progress update
        if (this.stats.gamesProcessed % 100 === 0) {
          const elapsed = (Date.now() - this.stats.startTime) / 1000
          const rate = this.stats.gamesProcessed / elapsed
          const remaining = (this.stats.totalGames - this.stats.gamesProcessed) / rate
          console.log(chalk.cyan(`\n📊 Progress: ${this.stats.gamesProcessed}/${this.stats.totalGames} (${((this.stats.gamesProcessed/this.stats.totalGames)*100).toFixed(1)}%)`))
          console.log(chalk.cyan(`⏱️ Rate: ${rate.toFixed(1)} games/sec, ETA: ${Math.ceil(remaining/60)} minutes`))
        }
      })
    )

    await Promise.all(promises)
  }

  private async processGame(game: any): Promise<{ success: boolean, inserted: number, updated: number, error?: string }> {
    try {
      // Extract ESPN ID
      const espnId = game.external_id.replace(/^espn_[^_]+_/, '')
      const sport = game.sport.toLowerCase()
      
      // Build ESPN URL
      let url = ''
      switch (sport) {
        case 'nba':
          url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
          break
        case 'nfl':
          url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`
          break
        case 'mlb':
          url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`
          break
        case 'nhl':
          url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${espnId}`
          break
        default:
          return { success: false, inserted: 0, updated: 0, error: 'Unknown sport' }
      }

      // Fetch data from ESPN
      const response = await axios.get(url, { timeout: 15000 })
      const boxscore = response.data.boxscore

      if (!boxscore?.players) {
        return { success: false, inserted: 0, updated: 0, error: 'No boxscore data' }
      }

      // Collect all players and stats
      const allPlayers: any[] = []
      const playerGameLogs: PlayerGameLog[] = []

      for (const team of boxscore.players) {
        const teamId = parseInt(team.team.id)
        
        // Process based on sport
        if (sport === 'nba') {
          await this.processNBATeam(team, teamId, game, allPlayers, playerGameLogs)
        } else if (sport === 'nfl') {
          await this.processNFLTeam(team, teamId, game, allPlayers, playerGameLogs)
        } else if (sport === 'mlb') {
          await this.processMLBTeam(team, teamId, game, allPlayers, playerGameLogs)
        } else if (sport === 'nhl') {
          await this.processNHLTeam(team, teamId, game, allPlayers, playerGameLogs)
        }
      }

      // Create missing teams first
      await this.ensureTeamsExist(Array.from(new Set(allPlayers.map(p => p.team_id))))

      // Create all players
      if (allPlayers.length > 0) {
        const uniquePlayers = Array.from(
          new Map(allPlayers.map(p => [p.id, p])).values()
        )
        
        await enhancedDb.getClient()
          .from('players')
          .upsert(uniquePlayers, { onConflict: 'id' })
      }

      // Insert player game logs
      if (playerGameLogs.length > 0) {
        const result = await enhancedDb.enhancedPlayerStatsUpsert(playerGameLogs, {
          validateSchema: true,
          batchSize: 50
        })

        return {
          success: true,
          inserted: result.actuallyInserted,
          updated: result.actuallyUpdated
        }
      }

      return { success: false, inserted: 0, updated: 0, error: 'No player data found' }

    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: false, inserted: 0, updated: 0, error: 'ESPN 404' }
      }
      throw error
    }
  }

  private async ensureTeamsExist(teamIds: number[]) {
    for (const teamId of teamIds) {
      const { data: existing } = await enhancedDb.getClient()
        .from('teams')
        .select('id')
        .eq('id', teamId)
        .single()

      if (!existing) {
        await enhancedDb.getClient()
          .from('teams')
          .upsert({
            id: teamId,
            name: `Team ${teamId}`,
            abbreviation: `T${teamId}`,
            sport: 'MULTI'
          }, { onConflict: 'id' })
      }
    }
  }

  private async processNBATeam(team: any, teamId: number, game: any, allPlayers: any[], playerGameLogs: PlayerGameLog[]) {
    const athletes = team.statistics?.[0]?.athletes || []
    
    for (const athlete of athletes) {
      if (!athlete.stats || athlete.stats.length < 14) continue

      const playerId = parseInt(athlete.athlete.id)
      
      allPlayers.push({
        id: playerId,
        name: athlete.athlete.displayName,
        team_id: teamId,
        sport: 'basketball'
      })

      const stats = this.parseNBAStats(athlete.stats)
      const fantasyPoints = this.calculateNBAFantasyPoints(stats)

      playerGameLogs.push({
        player_id: playerId,
        game_id: game.id,
        team_id: teamId,
        game_date: game.start_time.split('T')[0],
        is_home: teamId === game.home_team_id,
        minutes_played: stats.minutes_played,
        stats: stats,
        fantasy_points: fantasyPoints
      })
    }
  }

  private async processNFLTeam(team: any, teamId: number, game: any, allPlayers: any[], playerGameLogs: PlayerGameLog[]) {
    const statCategories = ['passing', 'rushing', 'receiving', 'fumbles', 'defensive', 'kickReturns', 'puntReturns', 'kicking', 'punting']
    
    for (const category of statCategories) {
      const categoryStats = team.statistics?.find((s: any) => s.name === category)
      if (!categoryStats) continue

      for (const athlete of categoryStats.athletes || []) {
        const playerId = parseInt(athlete.athlete.id)
        
        // Add player if not already added
        if (!allPlayers.find(p => p.id === playerId)) {
          allPlayers.push({
            id: playerId,
            name: athlete.athlete.displayName,
            team_id: teamId,
            sport: 'football'
          })
        }

        const stats = this.parseNFLStats(athlete.stats, category)
        const fantasyPoints = this.calculateNFLFantasyPoints(stats)

        // Find existing log or create new
        let existingLog = playerGameLogs.find(log => log.player_id === playerId && log.game_id === game.id)
        if (existingLog) {
          // Merge stats
          existingLog.stats = { ...existingLog.stats, ...stats }
          existingLog.fantasy_points += fantasyPoints
        } else {
          playerGameLogs.push({
            player_id: playerId,
            game_id: game.id,
            team_id: teamId,
            game_date: game.start_time.split('T')[0],
            is_home: teamId === game.home_team_id,
            stats: stats,
            fantasy_points: fantasyPoints
          })
        }
      }
    }
  }

  private async processMLBTeam(team: any, teamId: number, game: any, allPlayers: any[], playerGameLogs: PlayerGameLog[]) {
    // Process batters
    const batting = team.statistics?.find((s: any) => s.name === 'batting')
    if (batting) {
      for (const athlete of batting.athletes || []) {
        const playerId = parseInt(athlete.athlete.id)
        
        allPlayers.push({
          id: playerId,
          name: athlete.athlete.displayName,
          team_id: teamId,
          sport: 'baseball'
        })

        const stats = this.parseMLBBattingStats(athlete.stats)
        const fantasyPoints = this.calculateMLBFantasyPoints(stats)

        playerGameLogs.push({
          player_id: playerId,
          game_id: game.id,
          team_id: teamId,
          game_date: game.start_time.split('T')[0],
          is_home: teamId === game.home_team_id,
          stats: stats,
          fantasy_points: fantasyPoints
        })
      }
    }

    // Process pitchers
    const pitching = team.statistics?.find((s: any) => s.name === 'pitching')
    if (pitching) {
      for (const athlete of pitching.athletes || []) {
        const playerId = parseInt(athlete.athlete.id)
        
        allPlayers.push({
          id: playerId,
          name: athlete.athlete.displayName,
          team_id: teamId,
          sport: 'baseball'
        })

        const stats = this.parseMLBPitchingStats(athlete.stats)
        const fantasyPoints = this.calculateMLBPitchingFantasyPoints(stats)

        playerGameLogs.push({
          player_id: playerId,
          game_id: game.id,
          team_id: teamId,
          game_date: game.start_time.split('T')[0],
          is_home: teamId === game.home_team_id,
          stats: stats,
          fantasy_points: fantasyPoints
        })
      }
    }
  }

  private async processNHLTeam(team: any, teamId: number, game: any, allPlayers: any[], playerGameLogs: PlayerGameLog[]) {
    // Process skaters
    const skaters = team.statistics?.find((s: any) => s.name === 'skaters')
    if (skaters) {
      for (const athlete of skaters.athletes || []) {
        const playerId = parseInt(athlete.athlete.id)
        
        allPlayers.push({
          id: playerId,
          name: athlete.athlete.displayName,
          team_id: teamId,
          sport: 'hockey'
        })

        const stats = this.parseNHLSkaterStats(athlete.stats)
        const fantasyPoints = this.calculateNHLFantasyPoints(stats)

        playerGameLogs.push({
          player_id: playerId,
          game_id: game.id,
          team_id: teamId,
          game_date: game.start_time.split('T')[0],
          is_home: teamId === game.home_team_id,
          stats: stats,
          fantasy_points: fantasyPoints
        })
      }
    }

    // Process goalies
    const goalies = team.statistics?.find((s: any) => s.name === 'goalies')
    if (goalies) {
      for (const athlete of goalies.athletes || []) {
        const playerId = parseInt(athlete.athlete.id)
        
        allPlayers.push({
          id: playerId,
          name: athlete.athlete.displayName,
          team_id: teamId,
          sport: 'hockey'
        })

        const stats = this.parseNHLGoalieStats(athlete.stats)
        const fantasyPoints = this.calculateNHLGoalieFantasyPoints(stats)

        playerGameLogs.push({
          player_id: playerId,
          game_id: game.id,
          team_id: teamId,
          game_date: game.start_time.split('T')[0],
          is_home: teamId === game.home_team_id,
          stats: stats,
          fantasy_points: fantasyPoints
        })
      }
    }
  }

  // Sport-specific parsing methods
  private parseNBAStats(statsArray: any[]): Record<string, any> {
    return {
      minutes_played: parseInt(statsArray[0]) || 0,
      field_goals_made: parseInt(statsArray[1]?.split('-')[0]) || 0,
      field_goals_attempted: parseInt(statsArray[1]?.split('-')[1]) || 0,
      three_pointers_made: parseInt(statsArray[2]?.split('-')[0]) || 0,
      three_pointers_attempted: parseInt(statsArray[2]?.split('-')[1]) || 0,
      free_throws_made: parseInt(statsArray[3]?.split('-')[0]) || 0,
      free_throws_attempted: parseInt(statsArray[3]?.split('-')[1]) || 0,
      offensive_rebounds: parseInt(statsArray[4]) || 0,
      defensive_rebounds: parseInt(statsArray[5]) || 0,
      rebounds: parseInt(statsArray[6]) || 0,
      assists: parseInt(statsArray[7]) || 0,
      steals: parseInt(statsArray[8]) || 0,
      blocks: parseInt(statsArray[9]) || 0,
      turnovers: parseInt(statsArray[10]) || 0,
      personal_fouls: parseInt(statsArray[11]) || 0,
      plus_minus: parseInt(statsArray[12]) || 0,
      points: parseInt(statsArray[13]) || 0
    }
  }

  private parseNFLStats(statsArray: any[], category: string): Record<string, any> {
    const stats: Record<string, any> = {}
    
    switch (category) {
      case 'passing':
        const compAtt = statsArray[0]?.split('/') || ['0', '0']
        stats.passing_completions = parseInt(compAtt[0]) || 0
        stats.passing_attempts = parseInt(compAtt[1]) || 0
        stats.passing_yards = parseInt(statsArray[1]) || 0
        stats.passing_touchdowns = parseInt(statsArray[3]) || 0
        stats.interceptions = parseInt(statsArray[4]) || 0
        break
      case 'rushing':
        stats.rushing_attempts = parseInt(statsArray[0]) || 0
        stats.rushing_yards = parseInt(statsArray[1]) || 0
        stats.rushing_touchdowns = parseInt(statsArray[3]) || 0
        break
      case 'receiving':
        stats.receptions = parseInt(statsArray[0]) || 0
        stats.receiving_yards = parseInt(statsArray[1]) || 0
        stats.receiving_touchdowns = parseInt(statsArray[3]) || 0
        break
    }
    
    return stats
  }

  private parseMLBBattingStats(statsArray: any[]): Record<string, any> {
    return {
      at_bats: parseInt(statsArray[0]) || 0,
      runs: parseInt(statsArray[1]) || 0,
      hits: parseInt(statsArray[2]) || 0,
      rbis: parseInt(statsArray[3]) || 0,
      walks: parseInt(statsArray[4]) || 0,
      strikeouts: parseInt(statsArray[5]) || 0,
      batting_average: parseFloat(statsArray[7]) || 0
    }
  }

  private parseMLBPitchingStats(statsArray: any[]): Record<string, any> {
    return {
      innings_pitched: parseFloat(statsArray[0]) || 0,
      hits_allowed: parseInt(statsArray[1]) || 0,
      runs_allowed: parseInt(statsArray[2]) || 0,
      earned_runs: parseInt(statsArray[3]) || 0,
      walks_allowed: parseInt(statsArray[4]) || 0,
      strikeouts_pitched: parseInt(statsArray[5]) || 0,
      home_runs_allowed: parseInt(statsArray[6]) || 0,
      era: parseFloat(statsArray[7]) || 0
    }
  }

  private parseNHLSkaterStats(statsArray: any[]): Record<string, any> {
    return {
      goals: parseInt(statsArray[0]) || 0,
      assists: parseInt(statsArray[1]) || 0,
      points: parseInt(statsArray[2]) || 0,
      plus_minus: parseInt(statsArray[3]) || 0,
      shots: parseInt(statsArray[5]) || 0,
      blocked_shots: parseInt(statsArray[9]) || 0,
      penalties_in_minutes: parseInt(statsArray[11]) || 0
    }
  }

  private parseNHLGoalieStats(statsArray: any[]): Record<string, any> {
    return {
      saves: parseInt(statsArray[1]) || 0,
      shots_against: parseInt(statsArray[2]) || 0,
      goals_against: parseInt(statsArray[3]) || 0,
      save_percentage: parseFloat(statsArray[4]) || 0,
      goals_against_average: parseFloat(statsArray[5]) || 0
    }
  }

  // Fantasy points calculations
  private calculateNBAFantasyPoints(stats: Record<string, any>): number {
    return (
      stats.points * 1 +
      stats.rebounds * 1.25 +
      stats.assists * 1.5 +
      stats.steals * 2 +
      stats.blocks * 2 -
      stats.turnovers * 0.5
    )
  }

  private calculateNFLFantasyPoints(stats: Record<string, any>): number {
    return (
      (stats.passing_yards || 0) * 0.04 +
      (stats.passing_touchdowns || 0) * 4 +
      (stats.interceptions || 0) * -1 +
      (stats.rushing_yards || 0) * 0.1 +
      (stats.rushing_touchdowns || 0) * 6 +
      (stats.receiving_yards || 0) * 0.1 +
      (stats.receiving_touchdowns || 0) * 6 +
      (stats.receptions || 0) * 0.5
    )
  }

  private calculateMLBFantasyPoints(stats: Record<string, any>): number {
    return (
      (stats.runs || 0) * 2 +
      (stats.rbis || 0) * 2 +
      (stats.hits || 0) * 3 +
      (stats.walks || 0) * 2 +
      (stats.strikeouts || 0) * -1
    )
  }

  private calculateMLBPitchingFantasyPoints(stats: Record<string, any>): number {
    return (
      (stats.innings_pitched || 0) * 2.25 +
      (stats.strikeouts_pitched || 0) * 2 +
      (stats.wins || 0) * 5 +
      (stats.saves || 0) * 5 +
      (stats.earned_runs || 0) * -2
    )
  }

  private calculateNHLFantasyPoints(stats: Record<string, any>): number {
    return (
      (stats.goals || 0) * 3 +
      (stats.assists || 0) * 2 +
      (stats.shots || 0) * 0.5 +
      (stats.blocked_shots || 0) * 0.5 +
      (stats.plus_minus || 0) * 1
    )
  }

  private calculateNHLGoalieFantasyPoints(stats: Record<string, any>): number {
    return (
      (stats.saves || 0) * 0.2 +
      (stats.goals_against || 0) * -1 +
      (stats.wins || 0) * 5
    )
  }

  private async displayFinalResults(baseline: any) {
    const final = await enhancedDb.getPlayerStatsCoverage()
    const elapsed = (Date.now() - this.stats.startTime) / 1000

    console.log(chalk.bold.yellow('\n\n🏆 UNIVERSAL COLLECTION COMPLETE!'))
    console.log(chalk.gray('=' + '='.repeat(70)))
    
    console.log(chalk.cyan('\n📊 OVERALL RESULTS:'))
    console.log(chalk.white(`  Games processed: ${this.stats.gamesProcessed}/${this.stats.totalGames}`))
    console.log(chalk.green(`  Successful: ${this.stats.successful}`))
    console.log(chalk.red(`  Failed: ${this.stats.failed}`))
    console.log(chalk.white(`  Success rate: ${((this.stats.successful/this.stats.gamesProcessed)*100).toFixed(1)}%`))
    console.log(chalk.white(`  Time elapsed: ${Math.floor(elapsed/60)}m ${Math.floor(elapsed%60)}s`))
    console.log(chalk.white(`  Rate: ${(this.stats.gamesProcessed/elapsed).toFixed(1)} games/sec`))

    console.log(chalk.cyan('\n📈 DATABASE IMPACT:'))
    console.log(chalk.white(`  Records before: ${baseline.recordsInPlayerGameLogs.toLocaleString()}`))
    console.log(chalk.white(`  Records after: ${final.recordsInPlayerGameLogs.toLocaleString()}`))
    console.log(chalk.green(`  Records added: +${(final.recordsInPlayerGameLogs - baseline.recordsInPlayerGameLogs).toLocaleString()}`))
    console.log(chalk.white(`  Coverage before: ${baseline.coveragePercentage.toFixed(2)}%`))
    console.log(chalk.white(`  Coverage after: ${final.coveragePercentage.toFixed(2)}%`))
    console.log(chalk.green(`  Coverage increase: +${(final.coveragePercentage - baseline.coveragePercentage).toFixed(2)}%`))

    console.log(chalk.cyan('\n🏆 SPORT BREAKDOWN:'))
    Object.entries(this.stats.sportBreakdown).forEach(([sport, stats]) => {
      if (stats.processed > 0) {
        const successRate = ((stats.successful/stats.processed)*100).toFixed(1)
        console.log(chalk.white(`  ${sport}: ${stats.successful}/${stats.processed} (${successRate}%)`))
      }
    })

    if (this.stats.errors.length > 0) {
      console.log(chalk.red(`\n⚠️ Errors encountered: ${this.stats.errors.length}`))
      this.stats.errors.slice(0, 5).forEach(err => {
        console.log(chalk.gray(`  Game ${err.game}: ${err.error}`))
      })
    }

    console.log(chalk.bold.green('\n🚀 COLLECTION COMPLETE!'))
    console.log(chalk.green(`Added ${this.stats.recordsInserted} new records to player_game_logs!`))
  }
}

// Run the universal collector
const collector = new UniversalESPNCollector()
collector.collectAllESPNGames().catch(console.error)