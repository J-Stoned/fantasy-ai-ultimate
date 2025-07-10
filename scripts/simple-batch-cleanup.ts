#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import chalk from 'chalk'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create Supabase client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deleteBatch(batchSize: number = 100): Promise<number> {
  try {
    // Get a small batch of fake game IDs
    const { data: fakegames, error: fetchError } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .limit(batchSize)
    
    if (fetchError || !fakegames || fakegames.length === 0) {
      return 0
    }
    
    const gameIds = fakegames.map(g => g.id)
    
    // Delete just the games - let cascade handle related data
    const { data: deleted, error: deleteError } = await supabase
      .from('games')
      .delete()
      .in('id', gameIds)
      .select('id')
    
    if (deleteError) {
      console.error(chalk.red(`❌ Delete error: ${deleteError.message}`))
      return 0
    }
    
    return deleted?.length || 0
    
  } catch (error) {
    console.error(chalk.red('❌ Batch error:', error))
    return 0
  }
}

async function main() {
  console.log(chalk.bold.cyan('🎯 SIMPLE BATCH CLEANUP'))
  console.log(chalk.gray('Using small batches to avoid timeouts\n'))
  
  // Get initial count
  const { count: initialCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(chalk.yellow(`📊 Fake games to delete: ${initialCount || 0}\n`))
  
  if (!initialCount || initialCount === 0) {
    console.log(chalk.green('✅ No fake games found!'))
    return
  }
  
  const batchSize = 100 // Small batches to avoid timeout
  let totalDeleted = 0
  let iteration = 0
  let consecutiveFailures = 0
  
  const startTime = Date.now()
  
  while (consecutiveFailures < 5) {
    iteration++
    
    const deleted = await deleteBatch(batchSize)
    
    if (deleted === 0) {
      consecutiveFailures++
      console.log(chalk.yellow(`⚠️  No games deleted in iteration ${iteration}`))
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 2000))
      continue
    }
    
    consecutiveFailures = 0
    totalDeleted += deleted
    
    // Progress update
    const remaining = (initialCount || 0) - totalDeleted
    const progress = ((totalDeleted / (initialCount || 1)) * 100).toFixed(1)
    
    console.log(chalk.green(`✅ Iteration ${iteration}: Deleted ${deleted} games`))
    console.log(chalk.cyan(`   Progress: ${totalDeleted}/${initialCount} (${progress}%) - ${remaining} remaining`))
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  const elapsedTime = (Date.now() - startTime) / 1000
  
  // Get final count
  const { count: finalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(chalk.bold.green('\n📊 FINAL RESULTS:'))
  console.log(chalk.green(`  Deleted: ${totalDeleted} games`))
  console.log(chalk.green(`  Remaining: ${finalCount || 0} fake games`))
  console.log(chalk.green(`  Time: ${elapsedTime.toFixed(1)} seconds`))
  console.log(chalk.green(`  Speed: ${(totalDeleted / elapsedTime).toFixed(1)} games/second`))
  
  if (finalCount === 0) {
    console.log(chalk.bold.magenta('\n🎉 ALL FAKE GAMES DELETED! 🎉'))
    
    // Clean up fake players too
    console.log(chalk.yellow('\n👤 Cleaning up fake players...'))
    const { data: deletedPlayers, error } = await supabase
      .from('players')
      .delete()
      .is('external_id', null)
      .select('id')
    
    if (!error && deletedPlayers) {
      console.log(chalk.green(`✅ Deleted ${deletedPlayers.length} fake players`))
    }
    
    console.log(chalk.bold.magenta('\n🏆 DATABASE IS CLEAN! 🏆'))
  } else {
    console.log(chalk.yellow(`\n⚠️  ${finalCount} fake games still remain. Run again to continue.`))
  }
}

// Run
main().catch(console.error)