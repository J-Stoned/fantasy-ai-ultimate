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
  
  // Get top synergies with player names
  const { data: synergies, error } = await supabase
    .from('player_synergies')
    .select(`
      player1_id,
      player2_id,
      synergy_score,
      games_together,
      player1:players!player1_id(name, position),
      player2:players!player2_id(name, position)
    `)
    .order('synergy_score', { ascending: false })
    .limit(20)
  
  if (error) {
    console.error(chalk.red('Error:'), error)
    return
  }
  
  if (!synergies || synergies.length === 0) {
    console.log(chalk.yellow('No synergies found'))
    return
  }
  
  console.log(chalk.green('Top 20 Player Synergies:\n'))
  
  synergies.forEach((s: any, i) => {
    const player1Name = s.player1?.name || `Player ${s.player1_id}`
    const player2Name = s.player2?.name || `Player ${s.player2_id}`
    const player1Pos = s.player1?.position || 'UNK'
    const player2Pos = s.player2?.position || 'UNK'
    
    console.log(chalk.white(
      `${String(i + 1).padStart(2)}. ${player1Name} (${player1Pos}) & ${player2Name} (${player2Pos})`
    ))
    console.log(chalk.dim(
      `    ${s.synergy_score.toFixed(1)} avg fantasy points across ${s.games_together} games\n`
    ))
  })
  
  // Check how many players have names vs just IDs
  const { data: playerStats } = await supabase
    .from('players')
    .select('id, name')
    .not('name', 'is', null)
    .neq('name', '')
    .limit(5)
  
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
  
  const { count: playersWithNames } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('name', 'is', null)
    .neq('name', '')
    .neq('name', 'Player 0')
    .not('name', 'like', 'Player %')
  
  console.log(chalk.cyan('\n📊 Player Data Quality:'))
  console.log(chalk.white(`• Total players: ${totalPlayers?.toLocaleString()}`))
  console.log(chalk.white(`• Players with real names: ${playersWithNames?.toLocaleString()}`))
  if (totalPlayers && playersWithNames) {
    const percentage = (playersWithNames / totalPlayers * 100).toFixed(1)
    console.log(chalk.yellow(`• Coverage: ${percentage}% have real names`))
  }
  
  console.log(chalk.dim('\nSample players with names:'))
  playerStats?.forEach(p => {
    console.log(chalk.dim(`  • ${p.name} (ID: ${p.id})`))
  })
}

checkTopSynergies().catch(console.error)