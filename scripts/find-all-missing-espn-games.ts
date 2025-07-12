#!/usr/bin/env tsx
/**
 * 🔍 FIND ALL MISSING ESPN GAMES - BACK TO THE ORIGINAL MISSION!
 * 
 * We got distracted fixing technical issues - let's get back to the goal:
 * Find EVERY game with ESPN external_id that we haven't collected yet
 */

import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'

async function findAllMissingESPNGames() {
  console.log(chalk.bold.red('🔍 FIND ALL MISSING ESPN GAMES - BACK TO ORIGINAL MISSION!'))
  console.log(chalk.yellow('Finding EVERY game with ESPN external_id that needs stats'))
  console.log(chalk.gray('=' + '='.repeat(70)))

  // Get current baseline
  const baseline = await enhancedDb.getPlayerStatsCoverage()
  console.log(chalk.blue(`📊 Current coverage: ${baseline.coveragePercentage.toFixed(2)}%`))
  console.log(chalk.blue(`📊 Current records: ${baseline.recordsInPlayerGameLogs.toLocaleString()}`))

  // Get ALL games with ESPN external_ids
  console.log(chalk.cyan('\n🔍 Finding ALL games with ESPN external_ids...'))
  
  let allESPNGames = []
  let offset = 0
  const batchSize = 1000

  while (true) {
    const { data: batch, error } = await enhancedDb.getClient()
      .from('games')
      .select('id, sport, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null) // Only completed games
      .range(offset, offset + batchSize - 1)
      .order('id', { ascending: true })

    if (error) {
      console.error(chalk.red('Error fetching games:', error.message))
      break
    }

    if (!batch || batch.length === 0) {
      break
    }

    allESPNGames.push(...batch)
    
    if (batch.length < batchSize) {
      break
    }

    offset += batchSize
    console.log(chalk.gray(`Fetched ${allESPNGames.length} ESPN games so far...`))
  }

  console.log(chalk.green(`✅ Found ${allESPNGames.length} total ESPN games with scores`))

  // Group by sport
  const bySport = allESPNGames.reduce((acc, game) => {
    const sport = game.sport || 'NULL'
    acc[sport] = (acc[sport] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(chalk.cyan('\n📊 ESPN games by sport:'))
  Object.entries(bySport).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count.toLocaleString()} games`))
  })

  // Now find which ones DON'T have ANY player_game_logs
  console.log(chalk.cyan('\n🔍 Checking which games have NO player stats...'))
  
  const gamesWithoutStats = []
  const gamesWithPartialStats = []
  const gamesWithCompleteStats = []

  for (let i = 0; i < allESPNGames.length; i++) {
    const game = allESPNGames[i]
    
    // Get player count for this game
    const { count } = await enhancedDb.getClient()
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)

    const playerCount = count || 0

    if (playerCount === 0) {
      gamesWithoutStats.push(game)
    } else if (playerCount < 20) { // Likely incomplete
      gamesWithPartialStats.push({ ...game, player_count: playerCount })
    } else {
      gamesWithCompleteStats.push({ ...game, player_count: playerCount })
    }

    // Progress update
    if (i % 100 === 0) {
      console.log(chalk.gray(`Checked ${i}/${allESPNGames.length} games...`))
    }
  }

  console.log(chalk.bold.yellow('\n📊 COMPREHENSIVE ESPN GAME ANALYSIS:'))
  console.log(chalk.green(`✅ Complete stats: ${gamesWithCompleteStats.length.toLocaleString()} games`))
  console.log(chalk.yellow(`⚠️ Partial stats: ${gamesWithPartialStats.length.toLocaleString()} games`))
  console.log(chalk.red(`❌ NO stats: ${gamesWithoutStats.length.toLocaleString()} games`))

  // Show breakdown by sport for missing games
  const missingBySport = gamesWithoutStats.reduce((acc, game) => {
    const sport = game.sport || 'NULL'
    acc[sport] = (acc[sport] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(chalk.red('\n❌ Games with NO stats by sport:'))
  Object.entries(missingBySport).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count.toLocaleString()} games`))
  })

  // Show breakdown by sport for partial games
  const partialBySport = gamesWithPartialStats.reduce((acc, game) => {
    const sport = game.sport || 'NULL'
    acc[sport] = (acc[sport] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(chalk.yellow('\n⚠️ Games with PARTIAL stats by sport:'))
  Object.entries(partialBySport).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count.toLocaleString()} games`))
  })

  // Calculate potential coverage increase
  const totalMissingAndPartial = gamesWithoutStats.length + gamesWithPartialStats.length
  const potentialCoverageIncrease = (totalMissingAndPartial / allESPNGames.length) * 100

  console.log(chalk.bold.cyan('\n🎯 OPPORTUNITY ANALYSIS:'))
  console.log(chalk.white(`  Total ESPN games: ${allESPNGames.length.toLocaleString()}`))
  console.log(chalk.white(`  Games needing work: ${totalMissingAndPartial.toLocaleString()}`))
  console.log(chalk.white(`  Potential coverage increase: ${potentialCoverageIncrease.toFixed(2)}%`))
  console.log(chalk.white(`  Current coverage: ${baseline.coveragePercentage.toFixed(2)}%`))
  console.log(chalk.white(`  Target coverage: ${(baseline.coveragePercentage + potentialCoverageIncrease).toFixed(2)}%`))

  // Show sample external_ids for manual testing
  console.log(chalk.cyan('\n📋 Sample external_ids to test:'))
  
  const sampleMissing = gamesWithoutStats.slice(0, 5)
  console.log(chalk.red('Missing games:'))
  sampleMissing.forEach(game => {
    console.log(chalk.gray(`  ${game.sport}: ${game.external_id} (game_id: ${game.id})`))
  })

  const samplePartial = gamesWithPartialStats.slice(0, 5)
  console.log(chalk.yellow('Partial games:'))
  samplePartial.forEach(game => {
    console.log(chalk.gray(`  ${game.sport}: ${game.external_id} (${game.player_count} players, game_id: ${game.id})`))
  })

  // Show strategy recommendation
  console.log(chalk.bold.green('\n🚀 RECOMMENDED STRATEGY:'))
  console.log(chalk.white('1. Focus on games with PARTIAL stats first (higher success rate)'))
  console.log(chalk.white('2. Target recent games (2024+) for valid ESPN data'))
  console.log(chalk.white('3. Process in batches with our proven smart collection approach'))
  console.log(chalk.white('4. Use our REAL verification system to track progress'))
  console.log(chalk.white(`5. Potential to increase coverage by ${potentialCoverageIncrease.toFixed(1)}%!`))

  return {
    total: allESPNGames.length,
    complete: gamesWithCompleteStats.length,
    partial: gamesWithPartialStats.length,
    missing: gamesWithoutStats.length,
    missingGames: gamesWithoutStats,
    partialGames: gamesWithPartialStats
  }
}

findAllMissingESPNGames().catch(console.error)