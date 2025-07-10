#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deleteFinal() {
  console.log('Deleting final fake games...\n')
  
  // Get all remaining fake game IDs
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
  
  if (!games || games.length === 0) {
    console.log('No fake games found!')
    return
  }
  
  console.log(`Found ${games.length} fake games to delete`)
  
  // Delete in small chunks
  const chunkSize = 20
  for (let i = 0; i < games.length; i += chunkSize) {
    const chunk = games.slice(i, i + chunkSize)
    const ids = chunk.map(g => g.id)
    
    // Delete games
    await supabase.from('games').delete().in('id', ids)
    
    console.log(`Deleted ${Math.min(i + chunkSize, games.length)}/${games.length}`)
  }
  
  // Final check
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(`\nFake games remaining: ${count}`)
  
  if (count === 0) {
    console.log('🎉 ALL FAKE GAMES DELETED!')
    
    // Clean up fake players
    const { data: deleted } = await supabase
      .from('players')
      .delete()
      .is('external_id', null)
      .select()
    
    if (deleted) {
      console.log(`Deleted ${deleted.length} fake players`)
    }
  }
}

deleteFinal().catch(console.error)