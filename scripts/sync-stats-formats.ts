#!/usr/bin/env tsx
/**
 * 🔄 STATS FORMAT SYNC UTILITY
 * 
 * Ensures consistency between:
 * - player_stats table (normalized format for ML)
 * - player_game_logs.stats (JSON format for queries)
 * 
 * Can sync in either direction or verify consistency
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface SyncOptions {
  direction: 'json-to-normalized' | 'normalized-to-json' | 'verify'
  batchSize: number
  dryRun: boolean
}

// Convert JSON stats to normalized format
function jsonToNormalized(gameLog: any): any[] {
  const stats = gameLog.stats
  if (!stats || typeof stats !== 'object') return []
  
  const normalized: any[] = []
  const playerId = gameLog.player_id
  const gameId = gameLog.game_id
  
  // Map of stat types to their fantasy point values
  const statMappings = {
    points: { multiplier: 1 },
    rebounds: { multiplier: 1.2 },
    assists: { multiplier: 1.5 },
    steals: { multiplier: 3 },
    blocks: { multiplier: 3 },
    turnovers: { multiplier: -1 },
    field_goals_made: { multiplier: 0 },
    field_goals_attempted: { multiplier: 0 },
    three_pointers_made: { multiplier: 0 },
    three_pointers_attempted: { multiplier: 0 },
    free_throws_made: { multiplier: 0 },
    free_throws_attempted: { multiplier: 0 },
    minutes: { multiplier: 0 },
    minutes_played: { multiplier: 0 },
    fouls: { multiplier: 0 },
    personal_fouls: { multiplier: 0 },
    plus_minus: { multiplier: 0 }
  }
  
  // Process each stat
  for (const [key, value] of Object.entries(stats)) {
    if (value === null || value === undefined || value === 0) continue
    
    // Handle ESPN format stats (e.g., "2-4")
    if (key === 'fieldGoals' && typeof value === 'string' && value.includes('-')) {
      normalized.push({
        player_id: playerId,
        game_id: gameId,
        stat_type: 'fieldGoals',
        stat_value: value,
        fantasy_points: 0
      })
    } else if (key === 'threePointers' && typeof value === 'string' && value.includes('-')) {
      normalized.push({
        player_id: playerId,
        game_id: gameId,
        stat_type: 'threePointers',
        stat_value: value,
        fantasy_points: 0
      })
    } else if (key === 'freeThrows' && typeof value === 'string' && value.includes('-')) {
      normalized.push({
        player_id: playerId,
        game_id: gameId,
        stat_type: 'freeThrows',
        stat_value: value,
        fantasy_points: 0
      })
    } else if (key === 'plusMinus') {
      normalized.push({
        player_id: playerId,
        game_id: gameId,
        stat_type: 'plusMinus',
        stat_value: value.toString(),
        fantasy_points: 0
      })
    } else if (statMappings[key as keyof typeof statMappings]) {
      // Standard stats
      const mapping = statMappings[key as keyof typeof statMappings]
      normalized.push({
        player_id: playerId,
        game_id: gameId,
        stat_type: key,
        stat_value: value.toString(),
        fantasy_points: Number(value) * mapping.multiplier
      })
    }
  }
  
  return normalized
}

// Convert normalized stats to JSON format
function normalizedToJson(playerStats: any[]): any {
  const stats: any = {}
  let totalFantasyPoints = 0
  
  for (const stat of playerStats) {
    const type = stat.stat_type
    const value = stat.stat_value
    
    // Handle ESPN format stats
    if (['fieldGoals', 'threePointers', 'freeThrows'].includes(type)) {
      stats[type] = value
      
      // Also parse into separate made/attempted
      if (value.includes('-')) {
        const [made, attempted] = value.split('-').map(Number)
        if (type === 'fieldGoals') {
          stats.field_goals_made = made || 0
          stats.field_goals_attempted = attempted || 0
        } else if (type === 'threePointers') {
          stats.three_pointers_made = made || 0
          stats.three_pointers_attempted = attempted || 0
        } else if (type === 'freeThrows') {
          stats.free_throws_made = made || 0
          stats.free_throws_attempted = attempted || 0
        }
      }
    } else if (type === 'plusMinus') {
      stats.plusMinus = value
      stats.plus_minus = parseFloat(value.replace('+', '')) || 0
    } else {
      // Standard numeric stats
      const numValue = parseFloat(value) || 0
      stats[type] = numValue
      
      // Handle common aliases
      if (type === 'minutes' || type === 'minutes_played') {
        stats.minutes = numValue
        stats.minutes_played = numValue
      }
      if (type === 'fouls' || type === 'personal_fouls') {
        stats.fouls = numValue
        stats.personal_fouls = numValue
      }
    }
    
    totalFantasyPoints += stat.fantasy_points || 0
  }
  
  stats.fantasy_points = totalFantasyPoints
  
  return stats
}

async function syncJsonToNormalized(options: SyncOptions) {
  console.log(chalk.cyan('\n📥 Syncing JSON → Normalized format...\n'))
  
  let offset = 0
  let totalProcessed = 0
  let totalCreated = 0
  
  while (true) {
    // Get game logs with stats
    const { data: gameLogs, error } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id, stats')
      .not('stats', 'is', null)
      .range(offset, offset + options.batchSize - 1)
    
    if (error || !gameLogs || gameLogs.length === 0) break
    
    const normalizedBatch: any[] = []
    
    for (const log of gameLogs) {
      const normalized = jsonToNormalized(log)
      normalizedBatch.push(...normalized)
    }
    
    if (!options.dryRun && normalizedBatch.length > 0) {
      // Insert in smaller batches
      for (let i = 0; i < normalizedBatch.length; i += 100) {
        const batch = normalizedBatch.slice(i, i + 100)
        const { error: insertError } = await supabase
          .from('player_stats')
          .upsert(batch, { onConflict: 'player_id,game_id,stat_type' })
        
        if (insertError) {
          console.error(chalk.red('Insert error:'), insertError)
        } else {
          totalCreated += batch.length
        }
      }
    }
    
    totalProcessed += gameLogs.length
    console.log(chalk.gray(`Processed ${totalProcessed} game logs, created ${totalCreated} normalized stats...`))
    
    offset += options.batchSize
    await new Promise(resolve => setTimeout(resolve, 300)) // Rate limit
  }
  
  console.log(chalk.green(`\n✅ Sync complete! Processed ${totalProcessed} game logs, created ${totalCreated} normalized stats`))
}

async function syncNormalizedToJson(options: SyncOptions) {
  console.log(chalk.cyan('\n📤 Syncing Normalized → JSON format...\n'))
  
  // Get unique player-game combinations
  const { data: playerGames, error } = await supabase
    .from('player_stats')
    .select('player_id, game_id')
    .limit(10000)
  
  if (error || !playerGames) {
    console.error(chalk.red('Failed to get player-game combinations'))
    return
  }
  
  // Deduplicate
  const uniqueCombos = new Map<string, { player_id: number; game_id: number }>()
  playerGames.forEach(pg => {
    const key = `${pg.player_id}-${pg.game_id}`
    if (!uniqueCombos.has(key)) {
      uniqueCombos.set(key, pg)
    }
  })
  
  console.log(chalk.yellow(`Found ${uniqueCombos.size} unique player-game combinations`))
  
  let processed = 0
  let updated = 0
  const combinations = Array.from(uniqueCombos.values())
  
  // Process in batches
  for (let i = 0; i < combinations.length; i += options.batchSize) {
    const batch = combinations.slice(i, i + options.batchSize)
    const updates: any[] = []
    
    for (const combo of batch) {
      // Get all stats for this player-game
      const { data: stats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', combo.player_id)
        .eq('game_id', combo.game_id)
      
      if (stats && stats.length > 0) {
        const jsonStats = normalizedToJson(stats)
        updates.push({
          player_id: combo.player_id,
          game_id: combo.game_id,
          stats: jsonStats,
          fantasy_points: jsonStats.fantasy_points,
          minutes_played: jsonStats.minutes || jsonStats.minutes_played || 0
        })
      }
    }
    
    if (!options.dryRun && updates.length > 0) {
      const { error: updateError } = await supabase
        .from('player_game_logs')
        .upsert(updates, { onConflict: 'player_id,game_id' })
      
      if (updateError) {
        console.error(chalk.red('Update error:'), updateError)
      } else {
        updated += updates.length
      }
    }
    
    processed += batch.length
    console.log(chalk.gray(`Processed ${processed}/${uniqueCombos.size} combinations, updated ${updated} game logs...`))
    
    await new Promise(resolve => setTimeout(resolve, 300)) // Rate limit
  }
  
  console.log(chalk.green(`\n✅ Sync complete! Processed ${processed} combinations, updated ${updated} game logs`))
}

async function verifyConsistency(options: SyncOptions) {
  console.log(chalk.cyan('\n🔍 Verifying format consistency...\n'))
  
  let checked = 0
  let consistent = 0
  let inconsistent = 0
  let missingJson = 0
  let missingNormalized = 0
  
  // Sample some player-game combinations
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('player_id, game_id, stats')
    .not('stats', 'is', null)
    .limit(options.batchSize)
  
  if (!sample) return
  
  for (const log of sample) {
    // Get normalized stats
    const { data: normalized } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', log.player_id)
      .eq('game_id', log.game_id)
    
    checked++
    
    if (!normalized || normalized.length === 0) {
      missingNormalized++
      console.log(chalk.yellow(`Missing normalized: Player ${log.player_id}, Game ${log.game_id}`))
    } else {
      // Convert and compare
      const convertedJson = normalizedToJson(normalized)
      const existingJson = log.stats
      
      // Basic consistency check
      const jsonPoints = existingJson.points || 0
      const convertedPoints = convertedJson.points || 0
      
      if (Math.abs(jsonPoints - convertedPoints) < 0.1) {
        consistent++
      } else {
        inconsistent++
        console.log(chalk.red(`Inconsistent: Player ${log.player_id}, Game ${log.game_id}`))
        console.log(chalk.gray(`  JSON points: ${jsonPoints}, Converted: ${convertedPoints}`))
      }
    }
  }
  
  console.log(chalk.white('\n📊 Verification Results:'))
  console.log(chalk.gray(`├─ Checked: ${checked}`))
  console.log(chalk.green(`├─ Consistent: ${consistent}`))
  console.log(chalk.red(`├─ Inconsistent: ${inconsistent}`))
  console.log(chalk.yellow(`├─ Missing normalized: ${missingNormalized}`))
  console.log(chalk.yellow(`└─ Missing JSON: ${missingJson}`))
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'verify'
  const isDryRun = args.includes('--dry-run')
  
  const options: SyncOptions = {
    direction: command as any,
    batchSize: 100,
    dryRun: isDryRun
  }
  
  console.log(chalk.bold.cyan('\n🔄 STATS FORMAT SYNC UTILITY'))
  console.log(chalk.cyan('============================'))
  if (isDryRun) console.log(chalk.yellow('🔸 DRY RUN MODE - No changes will be made'))
  
  switch (command) {
    case 'json-to-normalized':
      await syncJsonToNormalized(options)
      break
    case 'normalized-to-json':
      await syncNormalizedToJson(options)
      break
    case 'verify':
    default:
      await verifyConsistency(options)
      break
  }
  
  console.log(chalk.gray('\nUsage:'))
  console.log(chalk.gray('  npx tsx sync-stats-formats.ts json-to-normalized [--dry-run]'))
  console.log(chalk.gray('  npx tsx sync-stats-formats.ts normalized-to-json [--dry-run]'))
  console.log(chalk.gray('  npx tsx sync-stats-formats.ts verify'))
}

main().catch(console.error)