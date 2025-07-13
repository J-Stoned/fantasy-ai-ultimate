#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkTable() {
  // Try to get one record
  const { data, error } = await supabase
    .from('player_synergies')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error(chalk.red('Error accessing player_synergies:'), error)
    
    // Try to insert a test record
    console.log(chalk.yellow('\nTrying to insert test record...'))
    const { error: insertError } = await supabase
      .from('player_synergies')
      .insert({
        player1_id: 1,
        player2_id: 2,
        synergy_score: 25.5,
        games_together: 10,
        sample_size: 10,
        synergy_type: 'offensive',
        season: 2024
      })
    
    if (insertError) {
      console.error(chalk.red('Insert error:'), insertError)
    } else {
      console.log(chalk.green('Insert successful!'))
    }
  } else {
    console.log(chalk.green('Table accessible'))
    console.log('Sample data:', data)
  }
}

checkTable().catch(console.error)