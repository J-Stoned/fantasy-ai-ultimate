#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkConstraints() {
  // Get a sample of fake games
  const { data: fakeGames } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, season, week')
    .is('external_id', null)
    .limit(5)
  
  console.log('Sample fake games:')
  console.log(fakeGames)
  
  if (fakeGames && fakeGames.length > 0) {
    // Check if these games have related data
    const gameId = fakeGames[0].id
    
    // Check player_stats
    const { count: statsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId.toString())
    
    console.log(`\nGame ${gameId} has ${statsCount} player_stats records`)
    
    // Check player_game_logs
    const { count: logsCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId.toString())
    
    console.log(`Game ${gameId} has ${logsCount} player_game_logs records`)
    
    // Try to delete just this one game with error details
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId)
    
    if (error) {
      console.log('\nError deleting game:')
      console.log(error)
    } else {
      console.log('\nSuccessfully deleted game!')
    }
  }
}

checkConstraints().catch(console.error)