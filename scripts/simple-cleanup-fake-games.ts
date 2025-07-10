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

async function deleteGamesInBatches() {
  console.log('🧹 Starting simple batch deletion...')
  
  let totalDeleted = 0
  let consecutiveErrors = 0
  const maxConsecutiveErrors = 5
  const batchSize = 10 // Very small batch size
  
  while (consecutiveErrors < maxConsecutiveErrors) {
    try {
      // First get the IDs to delete
      const { data: gamesToDelete, error: fetchError } = await supabase
        .from('games')
        .select('id')
        .is('external_id', null)
        .order('id', { ascending: true })
        .limit(batchSize)
      
      if (fetchError) {
        console.error(`❌ Error fetching games:`, fetchError.message)
        consecutiveErrors++
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      
      if (!gamesToDelete || gamesToDelete.length === 0) {
        console.log('✅ No more games to delete!')
        break
      }
      
      // Now delete these specific games
      const gameIds = gamesToDelete.map(g => g.id)
      const { data, error } = await supabase
        .from('games')
        .delete()
        .in('id', gameIds)
        .select('id')
      
      if (error) {
        console.error(`❌ Error in batch deletion:`, error.message)
        consecutiveErrors++
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 2000))
        continue
      }
      
      if (!data || data.length === 0) {
        console.log('✅ No more games to delete!')
        break
      }
      
      totalDeleted += data.length
      consecutiveErrors = 0 // Reset error counter on success
      
      console.log(`✅ Deleted ${data.length} games (Total: ${totalDeleted})`)
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500))
      
    } catch (error) {
      console.error('❌ Unexpected error:', error)
      consecutiveErrors++
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  if (consecutiveErrors >= maxConsecutiveErrors) {
    console.log(`⚠️ Stopped after ${maxConsecutiveErrors} consecutive errors`)
  }
  
  return totalDeleted
}

async function getCounts() {
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
  
  const { count: fakeGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  return {
    total: totalGames || 0,
    fake: fakeGames || 0
  }
}

async function main() {
  console.log('🚀 Starting simple fake games cleanup...')
  console.log('Database URL:', supabaseUrl)
  
  // Get initial counts
  console.log('\n📊 Getting initial counts...')
  const initialCounts = await getCounts()
  console.log(`- Total games: ${initialCounts.total}`)
  console.log(`- Fake games (NULL external_id): ${initialCounts.fake}`)
  
  if (initialCounts.fake === 0) {
    console.log('\n✅ No fake games to delete!')
    return
  }
  
  // Execute cleanup
  const startTime = Date.now()
  const totalDeleted = await deleteGamesInBatches()
  const elapsedTime = (Date.now() - startTime) / 1000
  
  // Get final counts
  console.log('\n📊 Getting final counts...')
  const finalCounts = await getCounts()
  
  console.log('\n✅ Cleanup Summary:')
  console.log(`- Games deleted: ${totalDeleted}`)
  console.log(`- Time taken: ${elapsedTime.toFixed(1)} seconds`)
  console.log(`- Deletion rate: ${(totalDeleted / elapsedTime).toFixed(1)} games/second`)
  console.log(`- Remaining total games: ${finalCounts.total}`)
  console.log(`- Remaining fake games: ${finalCounts.fake}`)
  
  if (finalCounts.fake > 0) {
    console.log(`\n⚠️ Note: ${finalCounts.fake} fake games still remain. You may need to run this script again.`)
  } else {
    console.log('\n🎉 All fake games have been deleted!')
  }
}

// Run the cleanup
main().catch(console.error)