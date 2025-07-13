#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkTopSynergies() {
  console.log(chalk.cyan.bold('\n🏆 Top Player Synergies with Names\n'))
  
  // Get top synergies
  const { data: synergies, error } = await supabase
    .from('player_synergies')
    .select('player1_id, player2_id, synergy_score, games_together')
    .order('synergy_score', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error(chalk.red('Error getting synergies:'), error)
    return
  }
  
  if (!synergies || synergies.length === 0) {
    console.log(chalk.yellow('No synergies found'))
    return
  }
  
  console.log(chalk.green('Top 10 Player Synergies:\n'))
  
  // Get player names for each synergy
  for (let i = 0; i < synergies.length; i++) {
    const s = synergies[i]
    
    // Get player 1 name
    const { data: player1 } = await supabase
      .from('players')
      .select('name, position')
      .eq('id', s.player1_id)
      .single()
    
    // Get player 2 name
    const { data: player2 } = await supabase
      .from('players')
      .select('name, position')
      .eq('id', s.player2_id)
      .single()
    
    const player1Name = player1?.name || `Player ${s.player1_id}`
    const player2Name = player2?.name || `Player ${s.player2_id}`
    const player1Pos = player1?.position || 'UNK'
    const player2Pos = player2?.position || 'UNK'
    
    console.log(chalk.white(
      `${String(i + 1).padStart(2)}. ${player1Name} (${player1Pos}) & ${player2Name} (${player2Pos})`
    ))
    console.log(chalk.dim(
      `    ${s.synergy_score.toFixed(1)} avg fantasy points across ${s.games_together} games\n`
    ))
  }
  
  // Check player data quality
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
  
  const { count: playersWithNames } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('name', 'is', null)
    .neq('name', '')
    .not('name', 'like', 'Player %')
  
  console.log(chalk.cyan('📊 Player Data Quality:'))
  console.log(chalk.white(`• Total players: ${totalPlayers?.toLocaleString()}`))
  console.log(chalk.white(`• Players with real names: ${playersWithNames?.toLocaleString()}`))
  if (totalPlayers && playersWithNames) {
    const percentage = (playersWithNames / totalPlayers * 100).toFixed(1)
    console.log(chalk.yellow(`• Coverage: ${percentage}% have real names`))
  }
}

checkTopSynergies().catch(console.error)