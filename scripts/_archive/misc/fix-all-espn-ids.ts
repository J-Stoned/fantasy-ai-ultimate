#!/usr/bin/env tsx
/**
 * 🔧 FIX ALL ESPN IDS TO PROPER FORMAT!
 * 
 * Converts:
 * - Raw IDs like "401559900" → "espn_nba_401559900"
 * - Fixes sport field for NULL games
 * - Ensures ALL games have proper espn_{sport}_{id} format
 */

import chalk from 'chalk'
import { enhancedDb } from '../lib/services/enhanced-database-service'

interface GameToFix {
  id: number
  sport: string | null
  external_id: string
}

async function fixAllESPNIds() {
  console.log(chalk.bold.red('🔧 FIXING ALL ESPN IDS TO PROPER FORMAT!'))
  console.log(chalk.yellow('Converting raw IDs and fixing NULL sports'))
  console.log(chalk.gray('=' + '='.repeat(70)))

  // STEP 1: Get all games with raw ESPN IDs (401...)
  console.log(chalk.cyan('\n📊 STEP 1: Finding games with raw ESPN IDs...'))
  
  const rawGames: GameToFix[] = []
  let offset = 0
  const batchSize = 1000

  while (true) {
    const { data: batch, error } = await enhancedDb.getClient()
      .from('games')
      .select('id, sport, external_id')
      .like('external_id', '401%')
      .not('external_id', 'like', 'espn_%') // Exclude already fixed ones
      .range(offset, offset + batchSize - 1)
      .order('id')

    if (error || !batch || batch.length === 0) break
    
    rawGames.push(...batch)
    if (batch.length < batchSize) break
    
    offset += batchSize
    console.log(chalk.gray(`Found ${rawGames.length} raw ESPN IDs so far...`))
  }

  console.log(chalk.green(`✅ Found ${rawGames.length} games with raw ESPN IDs to fix`))

  // STEP 2: Get games with proper IDs but NULL sport
  console.log(chalk.cyan('\n📊 STEP 2: Finding games with NULL sport...'))
  
  const nullSportGames: GameToFix[] = []
  offset = 0

  while (true) {
    const { data: batch, error } = await enhancedDb.getClient()
      .from('games')
      .select('id, sport, external_id')
      .is('sport', null)
      .like('external_id', 'espn_%')
      .range(offset, offset + batchSize - 1)
      .order('id')

    if (error || !batch || batch.length === 0) break
    
    nullSportGames.push(...batch)
    if (batch.length < batchSize) break
    
    offset += batchSize
    console.log(chalk.gray(`Found ${nullSportGames.length} NULL sport games so far...`))
  }

  console.log(chalk.green(`✅ Found ${nullSportGames.length} games with NULL sport to fix`))

  // STEP 3: Determine sport based on external_id patterns or game metadata
  console.log(chalk.cyan('\n📊 STEP 3: Fixing ESPN IDs...'))

  // Fix raw ESPN IDs
  const rawUpdates = []
  for (const game of rawGames) {
    let sport = game.sport?.toLowerCase() || ''
    
    // Normalize sport names
    if (sport === 'nba' || sport === 'basketball') sport = 'nba'
    else if (sport === 'nfl' || sport === 'football') sport = 'nfl'
    else if (sport === 'mlb' || sport === 'baseball') sport = 'mlb'
    else if (sport === 'nhl' || sport === 'hockey') sport = 'nhl'
    else if (sport === 'ncaa_football') sport = 'ncaaf'
    else if (sport === 'ncaa_basketball') sport = 'ncaab'
    else {
      // Try to infer from ESPN ID range (this is approximate)
      const espnId = parseInt(game.external_id)
      if (espnId >= 401700000 && espnId < 401800000) sport = 'nba'
      else if (espnId >= 401400000 && espnId < 401500000) sport = 'mlb'
      else if (espnId >= 401500000 && espnId < 401600000) sport = 'nfl'
      else if (espnId >= 401600000 && espnId < 401700000) sport = 'nhl'
      else sport = 'unknown'
    }

    rawUpdates.push({
      id: game.id,
      external_id: `espn_${sport}_${game.external_id}`,
      sport: sport.toUpperCase()
    })
  }

  // Fix NULL sport games
  const nullSportUpdates = []
  for (const game of nullSportGames) {
    // Extract sport from existing espn_ format
    const match = game.external_id.match(/espn_([^_]+)_(.+)/)
    if (match) {
      const sport = match[1].toUpperCase()
      nullSportUpdates.push({
        id: game.id,
        sport: sport
      })
    }
  }

  // STEP 4: Apply updates in batches
  console.log(chalk.cyan('\n📊 STEP 4: Applying updates...'))

  // Update raw ESPN IDs
  if (rawUpdates.length > 0) {
    console.log(chalk.yellow(`\n🔧 Updating ${rawUpdates.length} raw ESPN IDs...`))
    
    const updateBatchSize = 100
    for (let i = 0; i < rawUpdates.length; i += updateBatchSize) {
      const batch = rawUpdates.slice(i, i + updateBatchSize)
      
      for (const update of batch) {
        const { error } = await enhancedDb.getClient()
          .from('games')
          .update({ 
            external_id: update.external_id,
            sport: update.sport
          })
          .eq('id', update.id)

        if (error) {
          console.error(chalk.red(`❌ Failed to update game ${update.id}:`, error.message))
        }
      }
      
      console.log(chalk.gray(`Updated ${Math.min(i + updateBatchSize, rawUpdates.length)}/${rawUpdates.length} raw IDs...`))
    }
    
    console.log(chalk.green(`✅ Fixed ${rawUpdates.length} raw ESPN IDs`))
  }

  // Update NULL sport games
  if (nullSportUpdates.length > 0) {
    console.log(chalk.yellow(`\n🔧 Updating ${nullSportUpdates.length} NULL sport games...`))
    
    const updateBatchSize = 100
    for (let i = 0; i < nullSportUpdates.length; i += updateBatchSize) {
      const batch = nullSportUpdates.slice(i, i + updateBatchSize)
      
      for (const update of batch) {
        const { error } = await enhancedDb.getClient()
          .from('games')
          .update({ sport: update.sport })
          .eq('id', update.id)

        if (error) {
          console.error(chalk.red(`❌ Failed to update game ${update.id}:`, error.message))
        }
      }
      
      console.log(chalk.gray(`Updated ${Math.min(i + updateBatchSize, nullSportUpdates.length)}/${nullSportUpdates.length} NULL sports...`))
    }
    
    console.log(chalk.green(`✅ Fixed ${nullSportUpdates.length} NULL sport games`))
  }

  // STEP 5: Verify results
  console.log(chalk.cyan('\n📊 STEP 5: Verifying results...'))

  const { count: properCount } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%')

  const { count: rawCount } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', '401%')
    .not('external_id', 'like', 'espn_%')

  const { count: nullCount } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('sport', null)
    .not('external_id', 'is', null)

  console.log(chalk.bold.yellow('\n🎯 FINAL RESULTS:'))
  console.log(chalk.green(`✅ Games with proper espn_ format: ${properCount}`))
  console.log(chalk.red(`❌ Games with raw ESPN IDs: ${rawCount}`))
  console.log(chalk.red(`❌ Games with NULL sport: ${nullCount}`))
  
  const totalFixed = rawUpdates.length + nullSportUpdates.length
  console.log(chalk.bold.green(`\n🚀 TOTAL FIXED: ${totalFixed} games!`))

  // Show breakdown by sport
  console.log(chalk.cyan('\n📊 ESPN games by sport after fix:'))
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB']
  
  for (const sport of sports) {
    const { count } = await enhancedDb.getClient()
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .like('external_id', 'espn_%')

    if (count && count > 0) {
      console.log(chalk.white(`  ${sport}: ${count} games`))
    }
  }

  console.log(chalk.bold.cyan(`\n💎 Ready to collect stats for ${properCount} ESPN games!`))
}

fixAllESPNIds().catch(console.error)