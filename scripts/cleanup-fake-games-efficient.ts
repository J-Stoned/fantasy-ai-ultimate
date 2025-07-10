#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

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

async function getInitialCounts() {
  console.log('🔍 Getting initial counts...')
  
  // Count games with NULL external_id
  const { count: fakeGamesCount, error: gamesError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  if (gamesError) {
    console.error('Error counting fake games:', gamesError)
    return null
  }
  
  // Count total games
  const { count: totalGamesCount, error: totalError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
  
  if (totalError) {
    console.error('Error counting total games:', totalError)
    return null
  }
  
  return {
    fakeGames: fakeGamesCount || 0,
    totalGames: totalGamesCount || 0
  }
}

async function deleteGamesDirectly() {
  console.log('🧹 Starting direct deletion of fake games...')
  
  let totalDeleted = 0
  const batchSize = 100 // Much smaller batch size to avoid timeouts
  
  try {
    while (true) {
      // Delete a small batch of games directly
      console.log(`Deleting batch of ${batchSize} games...`)
      
      // First get IDs of games to delete
      const { data: gamesToDelete, error: fetchError } = await supabase
        .from('games')
        .select('id')
        .is('external_id', null)
        .limit(batchSize)
      
      if (fetchError) {
        console.error('Error fetching games to delete:', fetchError)
        break
      }
      
      if (!gamesToDelete || gamesToDelete.length === 0) {
        console.log('✅ No more fake games to delete!')
        break
      }
      
      const gameIds = gamesToDelete.map(g => g.id)
      
      // Delete from player_stats first
      const { error: statsError } = await supabase
        .from('player_stats')
        .delete()
        .in('game_id', gameIds)
      
      if (statsError && statsError.code !== 'PGRST116') { // Ignore "no rows" error
        console.error('Error deleting player_stats:', statsError)
      }
      
      // Delete from player_game_logs
      const { error: logsError } = await supabase
        .from('player_game_logs')
        .delete()
        .in('game_id', gameIds)
      
      if (logsError && logsError.code !== 'PGRST116') { // Ignore "no rows" error
        console.error('Error deleting player_game_logs:', logsError)
      }
      
      // Delete the games themselves
      const { count, error: deleteError } = await supabase
        .from('games')
        .delete()
        .in('id', gameIds)
        .select('*', { count: 'exact', head: true })
      
      if (deleteError) {
        console.error('Error deleting games:', deleteError)
        break
      }
      
      totalDeleted += count || 0
      console.log(`✅ Deleted ${count} games (Total: ${totalDeleted})`)
      
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
  } catch (error) {
    console.error('Unexpected error during cleanup:', error)
  }
  
  return totalDeleted
}

async function getFinalCounts() {
  console.log('\n📊 Getting final counts...')
  
  const { count: remainingGames, error } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
  
  if (error) {
    console.error('Error counting remaining games:', error)
    return null
  }
  
  const { count: remainingFakeGames, error: fakeError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  if (fakeError) {
    console.error('Error counting remaining fake games:', fakeError)
  }
  
  return { 
    remainingGames: remainingGames || 0,
    remainingFakeGames: remainingFakeGames || 0
  }
}

async function main() {
  console.log('🚀 Starting fake games cleanup process...')
  console.log('Database URL:', supabaseUrl)
  console.log('⚡ Using efficient batch deletion strategy')
  
  // Get initial counts
  const initialCounts = await getInitialCounts()
  if (initialCounts) {
    console.log('\n📊 Initial Database State:')
    console.log(`- Total games: ${initialCounts.totalGames}`)
    console.log(`- Fake games (NULL external_id): ${initialCounts.fakeGames}`)
  }
  
  if (!initialCounts || initialCounts.fakeGames === 0) {
    console.log('\n✅ No fake games found to delete!')
    return
  }
  
  // Execute cleanup
  const startTime = Date.now()
  const totalDeleted = await deleteGamesDirectly()
  const elapsedTime = (Date.now() - startTime) / 1000
  
  console.log('\n✅ Cleanup Results:')
  console.log(`- Deleted games: ${totalDeleted}`)
  console.log(`- Time taken: ${elapsedTime.toFixed(1)} seconds`)
  console.log(`- Deletion rate: ${(totalDeleted / elapsedTime).toFixed(0)} games/second`)
  
  // Get final counts
  const finalCounts = await getFinalCounts()
  if (finalCounts) {
    console.log('\n📊 Final Database State:')
    console.log(`- Remaining games: ${finalCounts.remainingGames}`)
    console.log(`- Remaining fake games: ${finalCounts.remainingFakeGames}`)
  }
  
  console.log('\n🎉 Cleanup process completed!')
}

// Run the cleanup
main().catch(console.error)