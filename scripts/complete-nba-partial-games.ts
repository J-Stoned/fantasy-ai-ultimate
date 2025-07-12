#!/usr/bin/env tsx
/**
 * 🏀 COMPLETE NBA PARTIAL GAMES - PROPER FOREIGN KEY HANDLING
 * 
 * Complete the 3 NBA games with partial stats using proper approach:
 * 1. Collect ALL players from ESPN first
 * 2. Batch create ALL players to avoid foreign key issues  
 * 3. Then upsert all player_game_logs records
 * 4. Verify real results
 */

import axios from 'axios'
import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'
import { PlayerGameLog } from '../lib/services/unlimited-data-service'

const PARTIAL_NBA_GAMES = [
  { id: 3184191, external_id: 'espn_nba_401716981', current_players: 8 },
  { id: 3184174, external_id: 'espn_nba_401717054', current_players: 19 },
  { id: 3184165, external_id: 'espn_nba_401716948', current_players: 13 }
]

interface CollectedPlayer {
  id: number
  name: string
  team_id: number
  sport: string
}

interface CollectedPlayerGameLog {
  player_id: number
  game_id: number
  team_id: number
  game_date: string
  is_home: boolean
  minutes_played: number
  stats: Record<string, any>
  fantasy_points: number
}

class NBAPartialGameCompleter {
  private allPlayers: CollectedPlayer[] = []
  private allPlayerGameLogs: CollectedPlayerGameLog[] = []

  async completePartialGames() {
    console.log(chalk.bold.red('🏀 COMPLETE NBA PARTIAL GAMES - PROPER APPROACH!'))
    console.log(chalk.yellow('Handling foreign keys properly by collecting ALL players first'))
    console.log(chalk.gray('=' + '='.repeat(70)))

    // Get baseline
    const baseline = await enhancedDb.getPlayerStatsCoverage()
    console.log(chalk.blue(`📊 BASELINE: ${baseline.coveragePercentage.toFixed(2)}% coverage, ${baseline.recordsInPlayerGameLogs} records`))

    // PHASE 1: Collect ALL data from ESPN first
    console.log(chalk.cyan('\n🔄 PHASE 1: Collecting ALL data from ESPN...'))
    await this.collectAllDataFromESPN()

    if (this.allPlayers.length === 0 || this.allPlayerGameLogs.length === 0) {
      console.error(chalk.red('❌ No data collected from ESPN!'))
      return
    }

    console.log(chalk.green(`✅ Collected ${this.allPlayers.length} players and ${this.allPlayerGameLogs.length} player game logs`))

    // PHASE 2: Create ALL players first
    console.log(chalk.cyan('\n🔄 PHASE 2: Creating ALL players to avoid foreign key issues...'))
    await this.createAllPlayers()

    // PHASE 3: Upsert ALL player game logs
    console.log(chalk.cyan('\n🔄 PHASE 3: Upserting ALL player game logs...'))
    await this.upsertAllPlayerGameLogs()

    // PHASE 4: Verify results
    console.log(chalk.cyan('\n🔄 PHASE 4: Verifying results...'))
    await this.verifyResults(baseline)
  }

  private async collectAllDataFromESPN() {
    for (const gameInfo of PARTIAL_NBA_GAMES) {
      console.log(chalk.cyan(`\n🎮 Collecting from game ${gameInfo.id} (${gameInfo.external_id})...`))
      
      try {
        // Get game details
        const { data: game } = await enhancedDb.getClient()
          .from('games')
          .select('id, sport, external_id, home_team_id, away_team_id, start_time')
          .eq('id', gameInfo.id)
          .single()

        if (!game) {
          console.error(chalk.red(`❌ Game ${gameInfo.id} not found`))
          continue
        }

        // Get ESPN data
        const espnId = game.external_id.replace('espn_nba_', '')
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
        
        console.log(chalk.gray(`📡 Fetching: ${url}`))
        
        const response = await axios.get(url, { timeout: 15000 })
        const boxscore = response.data.boxscore

        if (!boxscore?.players) {
          console.warn(chalk.yellow(`⚠️ No boxscore data for ${game.external_id}`))
          continue
        }

        // Process all teams and players
        for (const team of boxscore.players) {
          const teamId = parseInt(team.team.id)
          const athletes = team.statistics?.[0]?.athletes || []
          
          console.log(chalk.gray(`  Team ${teamId}: ${athletes.length} athletes`))

          for (const athlete of athletes) {
            if (!athlete.stats || athlete.stats.length < 14) continue

            const playerId = parseInt(athlete.athlete.id)
            
            // Collect player info
            this.allPlayers.push({
              id: playerId,
              name: athlete.athlete.displayName,
              team_id: teamId,
              sport: 'basketball'
            })

            // Parse and collect stats
            const stats = this.parseNBAStats(athlete.stats)
            const fantasyPoints = this.calculateNBAFantasyPoints(stats)

            this.allPlayerGameLogs.push({
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

        console.log(chalk.green(`✅ Game ${gameInfo.id}: Collected data successfully`))

      } catch (error: any) {
        console.error(chalk.red(`❌ Game ${gameInfo.id} failed: ${error.message}`))
      }
    }
  }

  private async createAllPlayers() {
    if (this.allPlayers.length === 0) return

    // Deduplicate players by ID
    const uniquePlayers = Array.from(
      new Map(this.allPlayers.map(p => [p.id, p])).values()
    )

    console.log(chalk.blue(`👥 Creating ${uniquePlayers.length} unique players...`))

    // FIRST: Create any missing teams
    const uniqueTeamIds = Array.from(new Set(uniquePlayers.map(p => p.team_id)))
    console.log(chalk.yellow(`🏈 Checking ${uniqueTeamIds.length} unique team IDs...`))

    for (const teamId of uniqueTeamIds) {
      const { data: existingTeam } = await enhancedDb.getClient()
        .from('teams')
        .select('id')
        .eq('id', teamId)
        .single()

      if (!existingTeam) {
        console.log(chalk.yellow(`🔧 Creating missing team ${teamId}...`))
        
        // Create placeholder team
        const { error: teamError } = await enhancedDb.getClient()
          .from('teams')
          .upsert({
            id: teamId,
            name: `Team ${teamId}`, // Placeholder name
            abbreviation: `T${teamId}`,
            sport: 'NBA' // Since we're processing NBA games
          }, { onConflict: 'id' })

        if (teamError) {
          console.error(chalk.red(`❌ Failed to create team ${teamId}:`, teamError.message))
        } else {
          console.log(chalk.green(`✅ Created team ${teamId}`))
        }
      }
    }

    try {
      // Use batch upsert for all players
      const { data, error } = await enhancedDb.getClient()
        .from('players')
        .upsert(uniquePlayers, { onConflict: 'id' })
        .select()

      if (error) {
        console.error(chalk.red('❌ Failed to create players:'), error.message)
        console.error(chalk.red('Error details:'), error)
        throw error
      }

      console.log(chalk.green(`✅ Successfully upserted ${data?.length || 0} players`))
    } catch (error: any) {
      console.error(chalk.red('💥 Fatal error creating players:'), error.message)
      throw error
    }
  }

  private async upsertAllPlayerGameLogs() {
    if (this.allPlayerGameLogs.length === 0) return

    console.log(chalk.blue(`📝 Upserting ${this.allPlayerGameLogs.length} player game logs...`))

    try {
      const result = await enhancedDb.enhancedPlayerStatsUpsert(this.allPlayerGameLogs, {
        validateSchema: true,
        batchSize: 50
      })

      console.log(chalk.green('✅ Enhanced upsert results:'))
      console.log(chalk.green(`  Successful: ${result.successful}`))
      console.log(chalk.green(`  Failed: ${result.failed}`))
      console.log(chalk.green(`  Actually inserted: ${result.actuallyInserted}`))
      console.log(chalk.green(`  Actually updated: ${result.actuallyUpdated}`))

      if (result.errors.length > 0) {
        console.error(chalk.red(`❌ Errors: ${result.errors.length}`))
        result.errors.slice(0, 3).forEach(error => {
          console.error(chalk.red('  Error:'), error)
        })
      }

      return result
    } catch (error: any) {
      console.error(chalk.red('💥 Fatal error upserting player game logs:'), error.message)
      throw error
    }
  }

  private async verifyResults(baseline: any) {
    const final = await enhancedDb.getPlayerStatsCoverage()
    const recordsIncrease = final.recordsInPlayerGameLogs - baseline.recordsInPlayerGameLogs
    const coverageIncrease = final.coveragePercentage - baseline.coveragePercentage

    console.log(chalk.bold.yellow('\n🔥 NBA PARTIAL GAME COMPLETION RESULTS!'))
    console.log(chalk.gray('=' + '='.repeat(60)))
    
    console.log(chalk.cyan('\n📊 COVERAGE CHANGES:'))
    console.log(chalk.white(`  Before: ${baseline.coveragePercentage.toFixed(2)}%`))
    console.log(chalk.white(`  After:  ${final.coveragePercentage.toFixed(2)}%`))
    console.log(chalk.white(`  Increase: ${coverageIncrease > 0 ? '+' : ''}${coverageIncrease.toFixed(3)}%`))

    console.log(chalk.cyan('\n📈 RECORD CHANGES:'))
    console.log(chalk.white(`  Before: ${baseline.recordsInPlayerGameLogs.toLocaleString()}`))
    console.log(chalk.white(`  After:  ${final.recordsInPlayerGameLogs.toLocaleString()}`))
    console.log(chalk.white(`  Increase: ${recordsIncrease > 0 ? '+' : ''}${recordsIncrease.toLocaleString()}`))

    if (recordsIncrease > 0) {
      console.log(chalk.bold.green('\n🚀 SUCCESS! Real coverage increase achieved!'))
      console.log(chalk.green(`Added ${recordsIncrease} real records to the database`))
      console.log(chalk.green('Strategy works - ready to scale to more games!'))
    } else {
      console.log(chalk.bold.red('\n💥 NO REAL INCREASE - investigation needed'))
    }

    // Check individual games
    console.log(chalk.cyan('\n🔍 Individual game verification:'))
    for (const gameInfo of PARTIAL_NBA_GAMES) {
      const { count } = await enhancedDb.getClient()
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameInfo.id)

      console.log(chalk.white(`  Game ${gameInfo.id}: ${count} players (was ${gameInfo.current_players})`))
    }
  }

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
}

// Run the NBA partial game completer
const completer = new NBAPartialGameCompleter()
completer.completePartialGames().catch(console.error)