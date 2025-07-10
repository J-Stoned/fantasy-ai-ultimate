#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function forceDelete() {
  console.log('🔥 FORCE DELETING FINAL FAKE GAMES...\n')
  
  // Get ALL remaining fake game IDs
  const { data: fakeGames, error: fetchError } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
  
  if (fetchError) {
    console.error('Error fetching games:', fetchError)
    return
  }
  
  if (!fakeGames || fakeGames.length === 0) {
    console.log('✅ No fake games found! Database is clean!')
    return
  }
  
  console.log(`Found ${fakeGames.length} stubborn fake games`)
  
  const gameIds = fakeGames.map(g => g.id)
  const gameIdsAsStrings = gameIds.map(id => id.toString())
  
  // Force delete ALL related data
  console.log('Deleting related data...')
  
  // Delete from all possible related tables
  const tables = [
    'player_stats',
    'player_game_logs',
    'ml_predictions',
    'news_articles',
    'game_events',
    'game_predictions'
  ]
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('game_id', gameIdsAsStrings)
      
      if (!error) {
        console.log(`✓ Cleaned ${table}`)
      }
    } catch (e) {
      // Table might not exist or have game_id column
    }
  }
  
  // Now try to delete games one by one
  console.log('\nDeleting games one by one...')
  let deleted = 0
  let failed = 0
  
  for (const gameId of gameIds) {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId)
    
    if (error) {
      console.error(`Failed to delete game ${gameId}:`, error.message)
      failed++
    } else {
      deleted++
      if (deleted % 50 === 0) {
        console.log(`Progress: ${deleted}/${gameIds.length}`)
      }
    }
  }
  
  console.log(`\n✅ Deleted: ${deleted} games`)
  console.log(`❌ Failed: ${failed} games`)
  
  // Final check
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(`\n📊 Fake games remaining: ${count}`)
  
  if (count === 0) {
    console.log('🎉 ALL FAKE GAMES DELETED!')
    
    // Clean up fake players
    const { data: deletedPlayers } = await supabase
      .from('players')
      .delete()
      .is('external_id', null)
      .select()
    
    if (deletedPlayers) {
      console.log(`\n✅ Also deleted ${deletedPlayers.length} fake players`)
    }
    
    // Final summary
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
    
    console.log('\n🏆 FINAL DATABASE STATE:')
    console.log(`   Games: ${totalGames} (all real)`)
    console.log(`   Players: ${totalPlayers} (all real)`)
    console.log('\n✨ DATABASE IS CLEAN AND READY FOR PATTERN DETECTION!')
  }
}

forceDelete().catch(console.error)