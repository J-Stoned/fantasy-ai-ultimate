#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deleteWithWeather() {
  console.log('🌦️ DELETING FINAL GAMES WITH WEATHER DATA...\n')
  
  // Get remaining fake games
  const { data: fakeGames } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
  
  if (!fakeGames || fakeGames.length === 0) {
    console.log('✅ No fake games found!')
    return
  }
  
  console.log(`Found ${fakeGames.length} fake games with weather data constraints`)
  
  const gameIds = fakeGames.map(g => g.id)
  const gameIdsAsStrings = gameIds.map(id => id.toString())
  
  // First delete weather data
  console.log('Deleting weather data...')
  const { error: weatherError } = await supabase
    .from('weather_data')
    .delete()
    .in('game_id', gameIdsAsStrings)
  
  if (!weatherError) {
    console.log('✓ Weather data deleted')
  } else {
    console.error('Weather error:', weatherError)
  }
  
  // Now delete games in small batches
  console.log('\nDeleting games...')
  let deleted = 0
  const batchSize = 50
  
  for (let i = 0; i < gameIds.length; i += batchSize) {
    const batch = gameIds.slice(i, i + batchSize)
    
    const { data: deletedGames, error } = await supabase
      .from('games')
      .delete()
      .in('id', batch)
      .select()
    
    if (!error && deletedGames) {
      deleted += deletedGames.length
      console.log(`Progress: ${deleted}/${gameIds.length}`)
    }
  }
  
  // Final check
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(`\n📊 Fake games remaining: ${count}`)
  
  if (count === 0) {
    console.log('🎉 ALL FAKE GAMES DELETED!')
    
    // Clean up fake players
    console.log('\nCleaning up fake players...')
    const { data: deletedPlayers } = await supabase
      .from('players')
      .delete()
      .is('external_id', null)
      .select()
    
    if (deletedPlayers) {
      console.log(`✅ Deleted ${deletedPlayers.length} fake players`)
    }
    
    // Final summary
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
    
    console.log('\n🏆 FINAL DATABASE STATE:')
    console.log(`   Games: ${totalGames} (all real)`)
    console.log(`   Players: ${totalPlayers} (all real)`)
    console.log(`   Player Stats: ${totalStats}`)
    console.log('\n✨ DATABASE IS CLEAN AND READY FOR PATTERN DETECTION!')
  }
}

deleteWithWeather().catch(console.error)