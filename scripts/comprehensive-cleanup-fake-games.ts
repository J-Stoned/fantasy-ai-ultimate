#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import chalk from 'chalk'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deleteRelatedData(gameIds: string[], batchSize: number = 1000) {
  console.log(chalk.yellow(`🧹 Cleaning up related data for ${gameIds.length} games...`))
  
  let totalDeleted = { player_stats: 0, player_game_logs: 0, ml_predictions: 0 }
  
  // Process in chunks
  for (let i = 0; i < gameIds.length; i += batchSize) {
    const chunk = gameIds.slice(i, i + batchSize)
    
    // Delete player_stats
    const { data: statsDeleted, error: statsError } = await supabase
      .from('player_stats')
      .delete()
      .in('game_id', chunk)
      .select('id')
    
    if (!statsError && statsDeleted) {
      totalDeleted.player_stats += statsDeleted.length
    }
    
    // Delete player_game_logs
    const { data: logsDeleted, error: logsError } = await supabase
      .from('player_game_logs')
      .delete()
      .in('game_id', chunk)
      .select('id')
    
    if (!logsError && logsDeleted) {
      totalDeleted.player_game_logs += logsDeleted.length
    }
    
    // Delete ml_predictions
    const { data: mlDeleted, error: mlError } = await supabase
      .from('ml_predictions')
      .delete()
      .in('game_id', chunk)
      .select('id')
    
    if (!mlError && mlDeleted) {
      totalDeleted.ml_predictions += mlDeleted.length
    }
    
    if ((i + batchSize) % 5000 < batchSize) {
      console.log(chalk.gray(`  Progress: ${Math.min(i + batchSize, gameIds.length)}/${gameIds.length} games processed`))
    }
  }
  
  console.log(chalk.green(`✅ Deleted related data:`))
  console.log(chalk.green(`  - player_stats: ${totalDeleted.player_stats}`))
  console.log(chalk.green(`  - player_game_logs: ${totalDeleted.player_game_logs}`))
  console.log(chalk.green(`  - ml_predictions: ${totalDeleted.ml_predictions}`))
  
  return totalDeleted
}

async function deleteGamesInBatches() {
  console.log(chalk.cyan('🎯 Starting comprehensive fake game cleanup...'))
  
  let totalDeleted = 0
  const batchSize = 1500 // As requested
  let iteration = 0
  
  while (true) {
    iteration++
    console.log(chalk.blue(`\n🔄 Iteration ${iteration}...`))
    
    try {
      // Get batch of fake games
      const { data: fakegames, error: fetchError } = await supabase
        .from('games')
        .select('id')
        .is('external_id', null)
        .order('id', { ascending: true })
        .limit(batchSize)
      
      if (fetchError || !fakegames || fakegames.length === 0) {
        break
      }
      
      const gameIds = fakegames.map(g => g.id)
      console.log(chalk.yellow(`📦 Found ${gameIds.length} fake games to process`))
      
      // First, delete all related data
      await deleteRelatedData(gameIds)
      
      // Now delete the games themselves
      console.log(chalk.yellow(`🗑️  Deleting ${gameIds.length} games...`))
      const { data: deletedGames, error: deleteError } = await supabase
        .from('games')
        .delete()
        .in('id', gameIds)
        .select('id')
      
      if (deleteError) {
        console.error(chalk.red(`❌ Error deleting games:`, deleteError.message))
        continue
      }
      
      const deletedCount = deletedGames?.length || 0
      totalDeleted += deletedCount
      
      console.log(chalk.green(`✅ Deleted ${deletedCount} games in this batch`))
      console.log(chalk.cyan(`📊 Total deleted so far: ${totalDeleted}`))
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(chalk.red('❌ Unexpected error:', error))
      break
    }
  }
  
  return totalDeleted
}

async function cleanupFakePlayers() {
  console.log(chalk.yellow('\n👤 Cleaning up fake players...'))
  
  // Delete players without external_id
  const { data: deletedPlayers, error } = await supabase
    .from('players')
    .delete()
    .is('external_id', null)
    .select('id')
  
  if (!error && deletedPlayers) {
    console.log(chalk.green(`✅ Deleted ${deletedPlayers.length} fake players`))
  }
}

async function main() {
  console.log(chalk.bold.magenta('🚀 COMPREHENSIVE FAKE DATA CLEANUP 🚀'))
  console.log(chalk.gray('=' .repeat(50)))
  
  // Get initial counts
  const { count: initialFakeGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  const { count: initialFakePlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(chalk.yellow('\n📊 Initial Status:'))
  console.log(chalk.yellow(`  - Fake games: ${initialFakeGames || 0}`))
  console.log(chalk.yellow(`  - Fake players: ${initialFakePlayers || 0}`))
  
  if (!initialFakeGames || initialFakeGames === 0) {
    console.log(chalk.green('\n✅ No fake games to delete!'))
  } else {
    const startTime = Date.now()
    
    // Delete games and their related data
    const deletedGames = await deleteGamesInBatches()
    
    const elapsedTime = (Date.now() - startTime) / 1000
    console.log(chalk.cyan(`\n⏱️  Game cleanup completed in ${elapsedTime.toFixed(1)} seconds`))
    console.log(chalk.cyan(`📈 Speed: ${(deletedGames / elapsedTime).toFixed(0)} games/second`))
  }
  
  // Clean up fake players
  await cleanupFakePlayers()
  
  // Get final counts
  const { count: finalFakeGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  const { count: finalFakePlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
  
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.green('\n🎉 CLEANUP COMPLETE! 🎉'))
  console.log(chalk.green('=' .repeat(50)))
  console.log(chalk.green('📊 Final Status:'))
  console.log(chalk.green(`  - Total games: ${totalGames}`))
  console.log(chalk.green(`  - Fake games remaining: ${finalFakeGames || 0}`))
  console.log(chalk.green(`  - Total players: ${totalPlayers}`))
  console.log(chalk.green(`  - Fake players remaining: ${finalFakePlayers || 0}`))
  
  if ((!finalFakeGames || finalFakeGames === 0) && (!finalFakePlayers || finalFakePlayers === 0)) {
    console.log(chalk.bold.magenta('\n🏆 DATABASE IS CLEAN! Ready for pattern detection! 🏆'))
  }
}

// Run the cleanup
main().catch(console.error)