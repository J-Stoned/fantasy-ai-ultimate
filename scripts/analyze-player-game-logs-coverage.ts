#!/usr/bin/env tsx
/**
 * 📊 COMPREHENSIVE PLAYER_GAME_LOGS COVERAGE ANALYSIS
 * 
 * Analyzes coverage in our standardized schema format
 * Shows real stats for each sport and identifies opportunities
 */

import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'

interface SportCoverage {
  sport: string
  totalGames: number
  gamesWithStats: number
  gamesWithPartialStats: number
  gamesWithZeroStats: number
  coveragePercentage: number
  totalPlayerRecords: number
  avgPlayersPerGame: number
  espnGamesAvailable: number
}

async function analyzePlayerGameLogsCoverage() {
  console.log(chalk.bold.red('📊 PLAYER_GAME_LOGS COVERAGE ANALYSIS'))
  console.log(chalk.yellow('Analyzing our standardized schema coverage by sport'))
  console.log(chalk.gray('=' + '='.repeat(70)))

  // Get baseline
  const baseline = await enhancedDb.getPlayerStatsCoverage()
  console.log(chalk.blue(`\n📈 OVERALL COVERAGE:`))
  console.log(chalk.white(`  Total games: ${baseline.totalGames.toLocaleString()}`))
  console.log(chalk.white(`  Games with stats: ${baseline.gamesWithStats.toLocaleString()}`))
  console.log(chalk.white(`  Coverage: ${baseline.coveragePercentage.toFixed(2)}%`))
  console.log(chalk.white(`  Total player_game_logs: ${baseline.recordsInPlayerGameLogs.toLocaleString()}`))

  // Analyze by sport
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'nba', 'nfl', 'mlb', 'nhl']
  const coverageData: SportCoverage[] = []

  console.log(chalk.cyan('\n🏆 ANALYZING BY SPORT...\n'))

  for (const sport of sports) {
    // Get total games for this sport
    const { count: totalGames } = await enhancedDb.getClient()
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('home_score', 'is', null)

    if (!totalGames || totalGames === 0) continue

    // Get games with ESPN external_ids
    const { count: espnGames } = await enhancedDb.getClient()
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)

    // Get all games for this sport
    const { data: allGames } = await enhancedDb.getClient()
      .from('games')
      .select('id')
      .eq('sport', sport)
      .not('home_score', 'is', null)

    const gameIds = allGames?.map(g => g.id) || []

    // Count player_game_logs for each game
    let gamesWithStats = 0
    let gamesWithPartialStats = 0
    let gamesWithZeroStats = 0
    let totalPlayerRecords = 0

    // Process in batches to avoid timeout
    const batchSize = 100
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize)
      
      for (const gameId of batch) {
        const { count } = await enhancedDb.getClient()
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', gameId)

        const playerCount = count || 0
        totalPlayerRecords += playerCount

        if (playerCount === 0) {
          gamesWithZeroStats++
        } else if (sport.toUpperCase() === 'NBA' && playerCount < 20) {
          gamesWithPartialStats++
        } else if (sport.toUpperCase() === 'NFL' && playerCount < 30) {
          gamesWithPartialStats++
        } else if (sport.toUpperCase() === 'MLB' && playerCount < 18) {
          gamesWithPartialStats++
        } else if (sport.toUpperCase() === 'NHL' && playerCount < 20) {
          gamesWithPartialStats++
        } else {
          gamesWithStats++
        }
      }
    }

    const coveragePercentage = ((gamesWithStats + gamesWithPartialStats) / totalGames) * 100
    const avgPlayersPerGame = totalGames > 0 ? totalPlayerRecords / totalGames : 0

    coverageData.push({
      sport: sport.toUpperCase(),
      totalGames,
      gamesWithStats,
      gamesWithPartialStats,
      gamesWithZeroStats,
      coveragePercentage,
      totalPlayerRecords,
      avgPlayersPerGame,
      espnGamesAvailable: espnGames || 0
    })

    // Display progress
    console.log(chalk.yellow(`${sport.toUpperCase()}:`))
    console.log(chalk.white(`  Total games: ${totalGames}`))
    console.log(chalk.white(`  ESPN games available: ${espnGames || 0}`))
    console.log(chalk.green(`  Complete stats: ${gamesWithStats}`))
    console.log(chalk.yellow(`  Partial stats: ${gamesWithPartialStats}`))
    console.log(chalk.red(`  Zero stats: ${gamesWithZeroStats}`))
    console.log(chalk.white(`  Coverage: ${coveragePercentage.toFixed(1)}%`))
    console.log(chalk.white(`  Player records: ${totalPlayerRecords}`))
    console.log(chalk.white(`  Avg players/game: ${avgPlayersPerGame.toFixed(1)}\n`))
  }

  // Summary and recommendations
  console.log(chalk.bold.cyan('\n📈 COVERAGE SUMMARY:\n'))
  
  const validSports = coverageData.filter(s => s.totalGames > 0)
  validSports.sort((a, b) => b.coveragePercentage - a.coveragePercentage)

  validSports.forEach((sport, index) => {
    const color = sport.coveragePercentage > 50 ? chalk.green :
                 sport.coveragePercentage > 10 ? chalk.yellow :
                 chalk.red

    console.log(color(`${index + 1}. ${sport.sport}: ${sport.coveragePercentage.toFixed(1)}% coverage`))
    console.log(chalk.white(`   ${sport.gamesWithStats + sport.gamesWithPartialStats}/${sport.totalGames} games have stats`))
    console.log(chalk.white(`   ${sport.totalPlayerRecords.toLocaleString()} player records`))
    
    if (sport.gamesWithPartialStats > 0) {
      console.log(chalk.yellow(`   ⚠️ ${sport.gamesWithPartialStats} games need completion`))
    }
    if (sport.gamesWithZeroStats > 0 && sport.espnGamesAvailable > 0) {
      console.log(chalk.red(`   ❌ ${Math.min(sport.gamesWithZeroStats, sport.espnGamesAvailable)} games can be collected from ESPN`))
    }
    console.log()
  })

  // Opportunities
  console.log(chalk.bold.green('\n🎯 COLLECTION OPPORTUNITIES:\n'))

  let totalOpportunities = 0
  validSports.forEach(sport => {
    const collectibleGames = Math.min(sport.gamesWithZeroStats, sport.espnGamesAvailable) + sport.gamesWithPartialStats
    if (collectibleGames > 0) {
      console.log(chalk.white(`${sport.sport}: ${collectibleGames} games available for collection`))
      totalOpportunities += collectibleGames
    }
  })

  console.log(chalk.bold.cyan(`\n💎 TOTAL OPPORTUNITY: ${totalOpportunities} games can be collected!`))

  // Recommendations
  console.log(chalk.bold.yellow('\n🚀 RECOMMENDATIONS:\n'))
  
  const nbaData = validSports.find(s => s.sport === 'NBA')
  if (nbaData && nbaData.gamesWithPartialStats > 0) {
    console.log(chalk.green('1. Complete NBA partial games first (proven to work)'))
    console.log(chalk.white(`   ${nbaData.gamesWithPartialStats} games need completion`))
  }

  const sportsWithZeroStats = validSports
    .filter(s => s.gamesWithZeroStats > 0 && s.espnGamesAvailable > 0)
    .sort((a, b) => b.espnGamesAvailable - a.espnGamesAvailable)

  if (sportsWithZeroStats.length > 0) {
    console.log(chalk.yellow(`\n2. Collect ${sportsWithZeroStats[0].sport} next:`))
    console.log(chalk.white(`   ${sportsWithZeroStats[0].espnGamesAvailable} games available on ESPN`))
  }

  // Next steps
  console.log(chalk.bold.blue('\n📋 NEXT STEPS:'))
  console.log(chalk.white('1. Run complete-nba-partial-games.ts to finish NBA'))
  console.log(chalk.white('2. Create NFL collector using same pattern'))
  console.log(chalk.white('3. Scale to all sports with universal collector'))
  console.log(chalk.white('4. Target 100% coverage for games with ESPN IDs'))
}

analyzePlayerGameLogsCoverage().catch(console.error)