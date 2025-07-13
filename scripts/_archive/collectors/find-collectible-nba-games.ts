#!/usr/bin/env tsx
/**
 * 🏀 FIND COLLECTIBLE NBA GAMES - BACK TO ORIGINAL MISSION!
 * 
 * Focus on NBA games that we can actually collect from ESPN
 * Skip the timeout issues and focus on what works
 */

import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'

async function findCollectibleNBAGames() {
  console.log(chalk.bold.red('🏀 FIND COLLECTIBLE NBA GAMES - FOCUSED APPROACH!'))
  console.log(chalk.yellow('Finding NBA games with ESPN external_ids that we can collect'))
  console.log(chalk.gray('=' + '='.repeat(70)))

  // Get current baseline
  const baseline = await enhancedDb.getPlayerStatsCoverage()
  console.log(chalk.blue(`📊 Current coverage: ${baseline.coveragePercentage.toFixed(2)}%`))
  console.log(chalk.blue(`📊 Current records: ${baseline.recordsInPlayerGameLogs.toLocaleString()}`))

  // Get ALL NBA games with ESPN external_ids (using smaller batches)
  console.log(chalk.cyan('\n🔍 Finding ALL NBA games with ESPN external_ids...'))
  
  let allNBAGames = []
  let offset = 0
  const batchSize = 500 // Smaller batch for faster processing

  while (true) {
    const { data: batch, error } = await enhancedDb.getClient()
      .from('games')
      .select('id, sport, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .like('external_id', 'espn_%')
      .eq('sport', 'NBA') // Only NBA games
      .not('home_score', 'is', null) // Only completed games
      .gte('start_time', '2024-01-01') // Recent games more likely to work
      .range(offset, offset + batchSize - 1)
      .order('start_time', { ascending: false }) // Most recent first

    if (error) {
      console.error(chalk.red('Error fetching NBA games:', error.message))
      break
    }

    if (!batch || batch.length === 0) {
      break
    }

    allNBAGames.push(...batch)
    
    if (batch.length < batchSize) {
      break
    }

    offset += batchSize
    console.log(chalk.gray(`Fetched ${allNBAGames.length} NBA games so far...`))
  }

  console.log(chalk.green(`✅ Found ${allNBAGames.length} NBA games with ESPN IDs`))

  if (allNBAGames.length === 0) {
    console.log(chalk.red('❌ No NBA games found with ESPN external_ids'))
    return
  }

  // Now check which ones have player stats (faster approach)
  console.log(chalk.cyan('\n🔍 Checking NBA games for player stats coverage...'))
  
  const gamesWithStats = []
  const gamesWithoutStats = []
  const gamesWithPartialStats = []

  // Process in smaller batches to avoid timeout
  const checkBatchSize = 50
  for (let i = 0; i < allNBAGames.length; i += checkBatchSize) {
    const batch = allNBAGames.slice(i, i + checkBatchSize)
    
    console.log(chalk.gray(`Checking batch ${Math.floor(i / checkBatchSize) + 1}/${Math.ceil(allNBAGames.length / checkBatchSize)}...`))
    
    for (const game of batch) {
      // Get player count for this game
      const { count } = await enhancedDb.getClient()
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)

      const playerCount = count || 0

      if (playerCount === 0) {
        gamesWithoutStats.push(game)
      } else if (playerCount < 20) { // NBA games should have ~25-30 players
        gamesWithPartialStats.push({ ...game, player_count: playerCount })
      } else {
        gamesWithStats.push({ ...game, player_count: playerCount })
      }
    }
  }

  console.log(chalk.bold.yellow('\n📊 NBA GAME ANALYSIS:'))
  console.log(chalk.green(`✅ Complete stats: ${gamesWithStats.length} games`))
  console.log(chalk.yellow(`⚠️ Partial stats: ${gamesWithPartialStats.length} games`))
  console.log(chalk.red(`❌ NO stats: ${gamesWithoutStats.length} games`))

  // Show examples
  console.log(chalk.cyan('\n📋 Sample NBA games to process:'))
  
  if (gamesWithPartialStats.length > 0) {
    console.log(chalk.yellow('🎯 PARTIAL STATS (highest success rate):'))
    gamesWithPartialStats.slice(0, 5).forEach(game => {
      console.log(chalk.gray(`  ${game.external_id} (${game.player_count} players, game_id: ${game.id})`))
    })
  }

  if (gamesWithoutStats.length > 0) {
    console.log(chalk.red('\n❌ NO STATS (worth trying):'))
    gamesWithoutStats.slice(0, 5).forEach(game => {
      console.log(chalk.gray(`  ${game.external_id} (game_id: ${game.id})`))
    })
  }

  const totalTargets = gamesWithPartialStats.length + gamesWithoutStats.length
  const potentialCoverageIncrease = (totalTargets / allNBAGames.length) * 100

  console.log(chalk.bold.cyan('\n🎯 NBA OPPORTUNITY ANALYSIS:'))
  console.log(chalk.white(`  Total NBA games: ${allNBAGames.length}`))
  console.log(chalk.white(`  Games needing work: ${totalTargets}`))
  console.log(chalk.white(`  Potential coverage increase: ${potentialCoverageIncrease.toFixed(2)}%`))
  console.log(chalk.white(`  Current coverage: ${baseline.coveragePercentage.toFixed(2)}%`))

  console.log(chalk.bold.green('\n🚀 RECOMMENDED STRATEGY FOR NBA:'))
  console.log(chalk.white('1. Start with PARTIAL stats games (higher success rate)'))
  console.log(chalk.white('2. Use our proven smart collection with proper UPSERT'))
  console.log(chalk.white('3. Process in small batches with verification'))
  console.log(chalk.white('4. Then tackle games with NO stats'))
  console.log(chalk.white(`5. Focus on 2024+ games for valid ESPN data`))

  return {
    total: allNBAGames.length,
    complete: gamesWithStats.length,
    partial: gamesWithPartialStats.length,
    missing: gamesWithoutStats.length,
    partialGames: gamesWithPartialStats,
    missingGames: gamesWithoutStats
  }
}

findCollectibleNBAGames().catch(console.error)