#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deleteNow() {
  console.log('DELETING FAKE GAMES NOW...\n')
  
  let totalDeleted = 0
  const batchSize = 50 // Very small batches
  
  while (true) {
    // Get fake game IDs
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .limit(batchSize)
    
    if (!games || games.length === 0) break
    
    const ids = games.map(g => g.id)
    
    // Delete related data first
    await supabase.from('player_stats').delete().in('game_id', ids.map(id => id.toString()))
    await supabase.from('player_game_logs').delete().in('game_id', ids.map(id => id.toString()))
    await supabase.from('ml_predictions').delete().in('game_id', ids.map(id => id.toString()))
    
    // Delete games
    const { data: deleted } = await supabase
      .from('games')
      .delete()
      .in('id', ids)
      .select()
    
    if (deleted) {
      totalDeleted += deleted.length
      console.log(`Deleted ${totalDeleted} games so far...`)
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 100))
  }
  
  console.log(`\nTOTAL DELETED: ${totalDeleted} games`)
  
  // Check remaining
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null)
  
  console.log(`REMAINING: ${count} fake games`)
}

deleteNow().catch(console.error)