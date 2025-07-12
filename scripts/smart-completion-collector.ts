#!/usr/bin/env tsx
/**
 * 🎯 SMART COMPLETION COLLECTOR - TARGET VALID GAMES ONLY!
 * 
 * Strategy: Find games with SOME stats but incomplete coverage
 * Focus on recent games with valid ESPN data
 * Complete partial collections rather than start from zero
 */

import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import { enhancedDb } from '../lib/services/enhanced-database-service'
import { PlayerGameLog } from '../lib/services/unlimited-data-service'

const limit = pLimit(5) // Very conservative for testing

class SmartCompletionCollector {
  
  async findAndCompletePartialGames() {
    console.log(chalk.bold.red('🎯 SMART COMPLETION COLLECTOR - TARGET VALID GAMES!'))
    console.log(chalk.yellow('Finding games with partial stats and valid ESPN data'))
    console.log(chalk.gray('=' + '='.repeat(70)))

    // Get baseline
    const baseline = await enhancedDb.getPlayerStatsCoverage()
    console.log(chalk.blue(`📊 BASELINE: ${baseline.coveragePercentage.toFixed(2)}% coverage`))

    // Find games with SOME stats but likely incomplete
    const partialGames = await this.findPartialGames()

    if (partialGames.length === 0) {
      console.log(chalk.green('✅ No partial games found to complete!'))
      return
    }

    console.log(chalk.cyan(`\n🎯 Found ${partialGames.length} games with partial stats to complete`))

    // Test a few games first
    const testGames = partialGames.slice(0, 5)
    console.log(chalk.yellow(`\n🧪 Testing collection on ${testGames.length} games first...`))

    let totalInserted = 0
    let totalUpdated = 0

    for (const game of testGames) {
      console.log(chalk.cyan(`\n🎮 Testing game ${game.id} (${game.sport}) - currently has ${game.player_count} players`))
      
      try {
        const result = await this.completeGameStats(game)
        if (result) {
          totalInserted += result.actuallyInserted
          totalUpdated += result.actuallyUpdated
          console.log(chalk.green(`✅ Game ${game.id}: +${result.actuallyInserted} inserted, +${result.actuallyUpdated} updated`))
        }
      } catch (error: any) {
        console.error(chalk.red(`❌ Game ${game.id} failed: ${error.message}`))
      }
    }

    // Check results
    const final = await enhancedDb.getPlayerStatsCoverage()
    const increase = final.recordsInPlayerGameLogs - baseline.recordsInPlayerGameLogs
    const coverageIncrease = final.coveragePercentage - baseline.coveragePercentage

    console.log(chalk.bold.yellow('\n📊 SMART COMPLETION RESULTS:'))
    console.log(chalk.green(`  Records added: ${increase.toLocaleString()}`))
    console.log(chalk.green(`  Coverage increase: +${coverageIncrease.toFixed(3)}%`))
    console.log(chalk.green(`  Reported inserts: ${totalInserted}`))
    console.log(chalk.green(`  Reported updates: ${totalUpdated}`))

    if (increase > 0) {
      console.log(chalk.bold.green('\n🚀 SUCCESS! Real coverage increase achieved!'))
      console.log(chalk.green('Strategy works - can scale to all partial games'))
    } else {
      console.log(chalk.bold.red('\n💥 Still no real increase - need different approach'))
    }
  }

  /**
   * Find games that have some stats but are likely incomplete
   */
  private async findPartialGames(): Promise<any[]> {
    console.log(chalk.cyan('🔍 Finding games with partial stats...'))

    // Get games that have some player_game_logs but likely incomplete
    const { data: gamesWithCounts, error } = await enhancedDb.getClient()
      .from('games')
      .select(`
        id, 
        sport, 
        external_id, 
        home_team_id, 
        away_team_id, 
        start_time,
        player_counts:player_game_logs(count)
      `)
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)
      .in('sport', ['NBA', 'NFL', 'MLB'])
      .gte('start_time', '2024-01-01') // Recent games more likely to have valid ESPN data
      .order('start_time', { ascending: false })
      .limit(100)

    if (error) {
      console.error(chalk.red('Error finding partial games:', error.message))
      return []
    }

    // Filter to games with some but incomplete stats
    const partialGames = []
    
    for (const game of gamesWithCounts || []) {
      // Get actual player count for this game
      const { count } = await enhancedDb.getClient()
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)

      // Consider incomplete if:
      // NBA: < 20 players (should have ~25-30)
      // NFL: < 15 players (should have ~25-40) 
      // MLB: < 15 players (should have ~18-25)
      let isIncomplete = false
      if (game.sport === 'NBA' && (count || 0) < 20 && (count || 0) > 0) {
        isIncomplete = true
      } else if (game.sport === 'NFL' && (count || 0) < 15 && (count || 0) > 0) {
        isIncomplete = true
      } else if (game.sport === 'MLB' && (count || 0) < 15 && (count || 0) > 0) {
        isIncomplete = true
      }

      if (isIncomplete) {
        partialGames.push({
          ...game,
          player_count: count || 0
        })
      }
    }

    console.log(chalk.green(`✅ Found ${partialGames.length} games with partial stats`))
    
    // Show breakdown
    const bySport = partialGames.reduce((acc, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(chalk.cyan('📊 Partial games by sport:'))
    Object.entries(bySport).forEach(([sport, count]) => {
      console.log(chalk.white(`  ${sport}: ${count} games`))
    })

    return partialGames
  }

  /**
   * Complete stats for a specific game
   */
  private async completeGameStats(game: any): Promise<any> {
    const espnId = this.extractEspnId(game.external_id)
    let url = ''
    
    if (game.sport === 'NBA') {
      url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
    } else if (game.sport === 'NFL') {
      url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`
    } else if (game.sport === 'MLB') {
      url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`
    } else {
      console.warn(chalk.yellow(`⚠️ Unknown sport: ${game.sport}`))
      return null
    }

    console.log(chalk.gray(`📡 Fetching: ${url}`))

    const response = await axios.get(url, { timeout: 15000 })
    const boxscore = response.data.boxscore

    if (!boxscore?.players) {
      console.warn(chalk.yellow(`⚠️ No boxscore data for ${game.sport} game ${game.id}`))
      return null
    }

    const playerStats: PlayerGameLog[] = []

    // FIRST: Create all players to avoid foreign key violations
    const allPlayers = []
    
    for (const team of boxscore.players) {
      const teamId = parseInt(team.team.id)
      
      if (game.sport === 'NBA') {
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
        }
      }
      // Add NFL and MLB processing as needed
    }

    // Batch create all players FIRST
    if (allPlayers.length > 0) {
      console.log(chalk.gray(`👥 Creating ${allPlayers.length} players first to avoid foreign key issues...`))
      
      try {
        await enhancedDb.getClient()
          .from('players')
          .upsert(allPlayers, { onConflict: 'id' })
          
        console.log(chalk.green(`✅ Players created successfully`))
      } catch (playerError: any) {
        console.error(chalk.red(`❌ Failed to create players: ${playerError.message}`))
        return null
      }
    }

    // THEN: Process player game logs
    for (const team of boxscore.players) {
      const teamId = parseInt(team.team.id)
      
      if (game.sport === 'NBA') {
        const athletes = team.statistics?.[0]?.athletes || []
        
        for (const athlete of athletes) {
          if (!athlete.stats || athlete.stats.length < 14) continue

          const playerId = parseInt(athlete.athlete.id)
          const stats = this.parseNBAStats(athlete.stats)
          const fantasyPoints = this.calculateNBAFantasyPoints(stats)

          const playerGameLog: PlayerGameLog = {
            player_id: playerId,
            game_id: game.id,
            team_id: teamId,
            game_date: game.start_time.split('T')[0],
            is_home: teamId === game.home_team_id,
            minutes_played: stats.minutes_played,
            stats: stats,
            fantasy_points: fantasyPoints
          }

          playerStats.push(playerGameLog)
        }
      }
      // Add NFL and MLB processing as needed
    }

    if (playerStats.length > 0) {
      console.log(chalk.blue(`📝 Upserting ${playerStats.length} player stats for game ${game.id}...`))
      
      const result = await enhancedDb.enhancedPlayerStatsUpsert(playerStats, {
        validateSchema: true,
        batchSize: 50
      })

      return result
    }

    return null
  }

  // Parsing methods
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

  private extractEspnId(externalId: string): string {
    return externalId.replace('espn_', '').replace(/^(nba|mlb|nfl)_/, '')
  }
}

// Run the smart collector
const collector = new SmartCompletionCollector()
collector.findAndCompletePartialGames().catch(console.error)