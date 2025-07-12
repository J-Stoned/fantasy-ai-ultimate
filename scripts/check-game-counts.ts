#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkGames() {
  console.log(chalk.cyan.bold('\n📊 Checking Game Counts in Database\n'))
  
  // Total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
  
  // Completed games with scores
  const { count: completedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
  
  // Games with player logs
  const { data: gamesWithLogs } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .gt('fantasy_points', 0)
  
  const uniqueGamesWithLogs = new Set(gamesWithLogs?.map(g => g.game_id) || [])
  
  // Total player logs
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  // Player synergies
  const { count: synergyCount } = await supabase
    .from('player_synergies')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.green('Database Statistics:'))
  console.log(chalk.white(`• Total games: ${totalGames?.toLocaleString()}`))
  console.log(chalk.white(`• Completed games with scores: ${completedGames?.toLocaleString()}`))
  console.log(chalk.white(`• Games with player logs: ${uniqueGamesWithLogs.size.toLocaleString()}`))
  console.log(chalk.white(`• Total player logs: ${totalLogs?.toLocaleString()}`))
  console.log(chalk.white(`• Player synergies: ${synergyCount?.toLocaleString()}`))
  
  if (completedGames && uniqueGamesWithLogs.size) {
    const coverage = (uniqueGamesWithLogs.size / completedGames * 100).toFixed(1)
    console.log(chalk.yellow(`\nData coverage: ${coverage}% of completed games have player logs`))
  }
}

checkGames().catch(console.error)