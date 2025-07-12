#!/usr/bin/env tsx
/**
 * Check valid ESPN games to focus collection efforts
 */

import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'

async function checkValidESPNGames() {
  console.log(chalk.cyan('📊 Analyzing valid ESPN games...'))

  // Get games with ESPN external_ids and scores
  const { data: games, error } = await enhancedDb.getClient()
    .from('games')
    .select('sport, external_id, id')
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null)
    .limit(2000)

  if (error) {
    console.error('Error:', error.message)
    return
  }

  // Group by sport
  const bySport: Record<string, number> = {}
  const sampleIds: Record<string, string[]> = {}

  games?.forEach(game => {
    bySport[game.sport] = (bySport[game.sport] || 0) + 1
    if (!sampleIds[game.sport]) sampleIds[game.sport] = []
    if (sampleIds[game.sport].length < 3) {
      sampleIds[game.sport].push(game.external_id)
    }
  })

  console.log(chalk.green('\n📈 Valid ESPN games by sport:'))
  Object.entries(bySport).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count} games`))
    console.log(chalk.gray(`    Sample IDs: ${sampleIds[sport].join(', ')}`))
  })

  // Check which games already have stats
  const { data: statsGames } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('game_id')
    .limit(1000)

  const gameIdsWithStats = new Set(statsGames?.map(s => s.game_id) || [])
  
  const gamesWithoutStats = games?.filter(game => !gameIdsWithStats.has(game.id)) || []
  
  console.log(chalk.yellow(`\n🎯 ESPN games needing stats: ${gamesWithoutStats.length}`))
  
  const bySportNeeded: Record<string, number> = {}
  gamesWithoutStats.forEach(game => {
    bySportNeeded[game.sport] = (bySportNeeded[game.sport] || 0) + 1
  })
  
  console.log(chalk.cyan('\n📊 Breakdown of games needing stats:'))
  Object.entries(bySportNeeded).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count} games`))
  })
}

checkValidESPNGames().catch(console.error)