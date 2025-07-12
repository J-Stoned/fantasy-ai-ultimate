#!/usr/bin/env tsx
/**
 * 🔧 SMART ESPN ID FIXER - HANDLES DUPLICATES!
 * 
 * Fixes ESPN IDs while handling duplicates intelligently
 */

import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'

async function fixESPNIdsSmart() {
  console.log(chalk.bold.red('🔧 SMART ESPN ID FIXER!'))
  console.log(chalk.yellow('Handling duplicates and fixing formats'))
  console.log(chalk.gray('=' + '='.repeat(70)))

  // Quick check current state
  const { count: rawCount } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', '401%')
    .not('external_id', 'like', 'espn_%')

  const { count: properCount } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%')

  const { count: nullSportCount } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('sport', null)
    .not('external_id', 'is', null)

  console.log(chalk.cyan('\n📊 CURRENT STATE:'))
  console.log(chalk.white(`  Raw ESPN IDs (401...): ${rawCount}`))
  console.log(chalk.white(`  Proper ESPN IDs (espn_): ${properCount}`))
  console.log(chalk.white(`  NULL sport games: ${nullSportCount}`))

  // Get a sample of games to check patterns
  console.log(chalk.cyan('\n🔍 Checking for duplicate patterns...'))

  const { data: sampleRaw } = await enhancedDb.getClient()
    .from('games')
    .select('id, sport, external_id, home_team_id, away_team_id, start_time')
    .like('external_id', '401%')
    .not('external_id', 'like', 'espn_%')
    .limit(100)

  // Check if these IDs already exist in proper format
  const duplicates = []
  const toUpdate = []

  for (const game of sampleRaw || []) {
    let sport = game.sport?.toLowerCase() || ''
    
    // Normalize sport
    if (sport === 'nba' || sport === 'basketball') sport = 'nba'
    else if (sport === 'nfl' || sport === 'football') sport = 'nfl'
    else if (sport === 'mlb' || sport === 'baseball') sport = 'mlb'
    else if (sport === 'nhl' || sport === 'hockey') sport = 'nhl'
    else sport = 'unknown'

    const newExternalId = `espn_${sport}_${game.external_id}`

    // Check if this ID already exists
    const { data: existing } = await enhancedDb.getClient()
      .from('games')
      .select('id')
      .eq('external_id', newExternalId)
      .single()

    if (existing) {
      duplicates.push({
        rawGameId: game.id,
        existingGameId: existing.id,
        externalId: newExternalId
      })
    } else {
      toUpdate.push({
        id: game.id,
        external_id: newExternalId,
        sport: sport.toUpperCase()
      })
    }
  }

  console.log(chalk.yellow(`\n📊 Sample Analysis (100 games):`))
  console.log(chalk.red(`  Duplicates found: ${duplicates.length}`))
  console.log(chalk.green(`  Can be updated: ${toUpdate.length}`))

  if (duplicates.length > 0) {
    console.log(chalk.red('\n⚠️ Duplicate games detected!'))
    console.log(chalk.yellow('These games have the same ESPN ID:'))
    duplicates.slice(0, 5).forEach(d => {
      console.log(chalk.gray(`  Game ${d.rawGameId} and ${d.existingGameId} both have ${d.externalId}`))
    })
  }

  // Strategy for handling duplicates
  console.log(chalk.cyan('\n🎯 STRATEGY:'))
  console.log(chalk.white('1. Keep games with proper espn_ format'))
  console.log(chalk.white('2. Delete duplicate games with raw IDs'))
  console.log(chalk.white('3. Update remaining games to proper format'))

  // Get count of potential deletions
  const { data: allRawGames } = await enhancedDb.getClient()
    .from('games')
    .select('id, external_id, sport')
    .like('external_id', '401%')
    .not('external_id', 'like', 'espn_%')
    .limit(1000)

  let deleteCount = 0
  let updateCount = 0

  for (const game of allRawGames || []) {
    let sport = game.sport?.toLowerCase() || 'unknown'
    if (sport === 'nba' || sport === 'basketball') sport = 'nba'
    else if (sport === 'nfl' || sport === 'football') sport = 'nfl'
    else if (sport === 'mlb' || sport === 'baseball') sport = 'mlb'
    else if (sport === 'nhl' || sport === 'hockey') sport = 'nhl'

    const properExternalId = `espn_${sport}_${game.external_id}`

    const { count } = await enhancedDb.getClient()
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('external_id', properExternalId)

    if (count && count > 0) {
      deleteCount++
    } else {
      updateCount++
    }
  }

  console.log(chalk.yellow('\n📊 PROJECTED IMPACT:'))
  console.log(chalk.red(`  Games to delete (duplicates): ~${deleteCount}`))
  console.log(chalk.green(`  Games to update: ~${updateCount}`))

  // Ask for confirmation
  console.log(chalk.bold.yellow('\n⚠️ This will:'))
  console.log(chalk.white(`1. Delete ~${deleteCount} duplicate games`))
  console.log(chalk.white(`2. Update ~${updateCount} games to proper format`))
  console.log(chalk.white(`3. Fix NULL sport fields`))

  console.log(chalk.cyan('\n💡 RECOMMENDATION:'))
  console.log(chalk.white('1. First run a backup of the games table'))
  console.log(chalk.white('2. Then run the full fix with duplicate handling'))
  console.log(chalk.white('3. Verify results before collecting stats'))

  // Show final ESPN game potential
  const finalCount = properCount + updateCount
  console.log(chalk.bold.green(`\n🎯 FINAL POTENTIAL: ${finalCount} games with proper ESPN IDs!`))
}

fixESPNIdsSmart().catch(console.error)