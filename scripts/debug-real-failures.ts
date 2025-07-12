#!/usr/bin/env tsx
/**
 * 🔍 DEBUG REAL FAILURES - NO MORE BULLSHIT
 * 
 * Find out WHY our inserts are failing silently
 * This will expose the REAL errors we're hiding
 */

import axios from 'axios'
import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'

async function debugRealFailures() {
  console.log(chalk.bold.red('🔍 DEBUGGING REAL DATABASE FAILURES!'))
  console.log(chalk.yellow('No more hiding errors - let\'s see what\'s ACTUALLY happening'))
  console.log(chalk.gray('=' + '='.repeat(60)))

  // Get ONE NBA game to test with
  const { data: testGame, error: gameError } = await enhancedDb.getClient()
    .from('games')
    .select('id, sport, external_id, home_team_id, away_team_id, start_time')
    .eq('sport', 'NBA')
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null)
    .limit(1)
    .single()

  if (gameError || !testGame) {
    console.error(chalk.red('❌ Cannot get test game:', gameError?.message))
    return
  }

  console.log(chalk.cyan(`🎯 Testing with NBA game: ${testGame.id} (${testGame.external_id})`))

  // Check if this game already has stats
  const { data: existingStats } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('id')
    .eq('game_id', testGame.id)
    .limit(1)

  if (existingStats && existingStats.length > 0) {
    console.log(chalk.yellow('⚠️ This game already has stats - that might be the issue!'))
  }

  try {
    // Get ESPN data
    const espnId = testGame.external_id.replace('espn_', '').replace(/^(nba|mlb|nfl)_/, '')
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
    
    console.log(chalk.blue(`📡 Fetching: ${url}`))
    
    const response = await axios.get(url, { timeout: 10000 })
    const boxscore = response.data.boxscore

    if (!boxscore?.players || boxscore.players.length === 0) {
      console.error(chalk.red('❌ No boxscore players data'))
      return
    }

    console.log(chalk.green(`✅ Got boxscore with ${boxscore.players.length} teams`))

    // Process ONE player to see what fails
    const team = boxscore.players[0]
    const teamId = parseInt(team.team.id)
    const athletes = team.statistics?.[0]?.athletes || []

    if (athletes.length === 0) {
      console.error(chalk.red('❌ No athletes data'))
      return
    }

    const athlete = athletes[0]
    if (!athlete.stats || athlete.stats.length < 14) {
      console.error(chalk.red('❌ No athlete stats'))
      return
    }

    const playerId = parseInt(athlete.athlete.id)
    
    console.log(chalk.cyan(`🏀 Testing player: ${athlete.athlete.displayName} (ID: ${playerId})`))
    console.log(chalk.gray(`Team ID: ${teamId}, Game ID: ${testGame.id}`))

    // Parse stats
    const stats = {
      minutes_played: parseInt(athlete.stats[0]) || 0,
      field_goals_made: parseInt(athlete.stats[1]?.split('-')[0]) || 0,
      field_goals_attempted: parseInt(athlete.stats[1]?.split('-')[1]) || 0,
      points: parseInt(athlete.stats[13]) || 0,
      rebounds: parseInt(athlete.stats[6]) || 0,
      assists: parseInt(athlete.stats[7]) || 0,
      steals: parseInt(athlete.stats[8]) || 0,
      blocks: parseInt(athlete.stats[9]) || 0,
      turnovers: parseInt(athlete.stats[10]) || 0
    }

    const fantasyPoints = (
      stats.points * 1 +
      stats.rebounds * 1.25 +
      stats.assists * 1.5 +
      stats.steals * 2 +
      stats.blocks * 2 -
      stats.turnovers * 0.5
    )

    console.log(chalk.blue('📊 Parsed stats:'), stats)
    console.log(chalk.blue('🎯 Fantasy points:'), fantasyPoints)

    // STEP 1: Check if player exists
    console.log(chalk.yellow('\n🔍 STEP 1: Checking if player exists...'))
    const { data: existingPlayer, error: playerCheckError } = await enhancedDb.getClient()
      .from('players')
      .select('id, name')
      .eq('id', playerId)
      .single()

    if (playerCheckError) {
      console.log(chalk.red(`❌ Player ${playerId} does not exist in players table!`))
      console.log(chalk.gray('Error:', playerCheckError.message))
      
      // Try to create player
      console.log(chalk.yellow('🔧 Attempting to create player...'))
      const { data: newPlayer, error: createPlayerError } = await enhancedDb.getClient()
        .from('players')
        .insert({
          id: playerId,
          name: athlete.athlete.displayName,
          team_id: teamId,
          sport: 'basketball'
        })
        .select()
        .single()

      if (createPlayerError) {
        console.error(chalk.red('❌ FAILED to create player:'), createPlayerError.message)
        console.error(chalk.red('Details:'), createPlayerError)
        return
      } else {
        console.log(chalk.green('✅ Player created successfully'))
      }
    } else {
      console.log(chalk.green(`✅ Player exists: ${existingPlayer.name}`))
    }

    // STEP 2: Check if game exists
    console.log(chalk.yellow('\n🔍 STEP 2: Checking if game exists...'))
    const { data: gameCheck, error: gameCheckError } = await enhancedDb.getClient()
      .from('games')
      .select('id, sport')
      .eq('id', testGame.id)
      .single()

    if (gameCheckError) {
      console.error(chalk.red(`❌ Game ${testGame.id} does not exist!`), gameCheckError.message)
      return
    } else {
      console.log(chalk.green(`✅ Game exists: ${gameCheck.id} (${gameCheck.sport})`))
    }

    // STEP 3: Check if team exists
    console.log(chalk.yellow('\n🔍 STEP 3: Checking if team exists...'))
    const { data: teamCheck, error: teamCheckError } = await enhancedDb.getClient()
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .single()

    if (teamCheckError) {
      console.log(chalk.red(`❌ Team ${teamId} does not exist in teams table!`))
      console.log(chalk.gray('Error:', teamCheckError.message))
      return
    } else {
      console.log(chalk.green(`✅ Team exists: ${teamCheck.name}`))
    }

    // STEP 4: Try the actual insert with FULL error visibility
    console.log(chalk.yellow('\n🔍 STEP 4: Attempting player_game_logs insert...'))
    
    const playerGameLog = {
      player_id: playerId,
      game_id: testGame.id,
      team_id: teamId,
      game_date: testGame.start_time.split('T')[0],
      is_home: teamId === testGame.home_team_id,
      minutes_played: stats.minutes_played,
      stats: stats,
      fantasy_points: fantasyPoints
    }

    console.log(chalk.blue('📝 Record to insert:'), JSON.stringify(playerGameLog, null, 2))

    // Try direct insert first
    const { data: insertResult, error: insertError } = await enhancedDb.getClient()
      .from('player_game_logs')
      .insert(playerGameLog)
      .select()

    if (insertError) {
      console.error(chalk.red('\n❌ DIRECT INSERT FAILED!'))
      console.error(chalk.red('Error code:'), insertError.code)
      console.error(chalk.red('Error message:'), insertError.message)
      console.error(chalk.red('Error details:'), insertError.details)
      console.error(chalk.red('Error hint:'), insertError.hint)
      console.error(chalk.red('Full error:'), insertError)

      // Try upsert
      console.log(chalk.yellow('\n🔧 Trying UPSERT instead...'))
      const { data: upsertResult, error: upsertError } = await enhancedDb.getClient()
        .from('player_game_logs')
        .upsert(playerGameLog, { onConflict: 'player_id,game_id' })
        .select()

      if (upsertError) {
        console.error(chalk.red('\n❌ UPSERT ALSO FAILED!'))
        console.error(chalk.red('Error code:'), upsertError.code)
        console.error(chalk.red('Error message:'), upsertError.message)
        console.error(chalk.red('Error details:'), upsertError.details)
        console.error(chalk.red('Error hint:'), upsertError.hint)
        console.error(chalk.red('Full error:'), upsertError)
      } else {
        console.log(chalk.green('✅ UPSERT SUCCEEDED!'))
        console.log(chalk.green('Result:'), upsertResult)
      }
    } else {
      console.log(chalk.green('✅ DIRECT INSERT SUCCEEDED!'))
      console.log(chalk.green('Result:'), insertResult)
    }

    // Final verification
    console.log(chalk.yellow('\n🔍 FINAL VERIFICATION: Checking if record exists...'))
    const { data: finalCheck, error: finalError } = await enhancedDb.getClient()
      .from('player_game_logs')
      .select('id, player_id, game_id, fantasy_points')
      .eq('player_id', playerId)
      .eq('game_id', testGame.id)

    if (finalError) {
      console.error(chalk.red('❌ Cannot verify insert:'), finalError.message)
    } else if (!finalCheck || finalCheck.length === 0) {
      console.error(chalk.red('❌ RECORD NOT FOUND AFTER INSERT!'))
    } else {
      console.log(chalk.green('✅ RECORD SUCCESSFULLY INSERTED!'))
      console.log(chalk.green('Found records:'), finalCheck.length)
      console.log(chalk.green('Record:'), finalCheck[0])
    }

  } catch (error: any) {
    console.error(chalk.red('💥 UNEXPECTED ERROR:'), error.message)
    console.error(chalk.red('Stack:'), error.stack)
  }
}

debugRealFailures().catch(console.error)