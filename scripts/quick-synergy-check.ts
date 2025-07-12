#!/usr/bin/env tsx
/**
 * Quick Synergy Check - Debug why we're getting 0s
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function quickCheck() {
  console.log(chalk.cyan.bold('\n🔍 QUICK SYNERGY CHECK\n'))
  
  try {
    // Check a single game in detail
    const { data: sampleGame } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .limit(1)
      .single()
    
    if (!sampleGame) {
      console.log(chalk.red('No completed games found!'))
      return
    }
    
    console.log(chalk.yellow(`Checking game ${sampleGame.id}...`))
    console.log(chalk.dim(`${sampleGame.home_team_id} (${sampleGame.home_score}) vs ${sampleGame.away_team_id} (${sampleGame.away_score})\n`))
    
    // Get all player logs for this game
    const { data: logs, error } = await supabase
      .from('player_game_logs')
      .select(`
        player_id,
        team_id,
        fantasy_points,
        minutes_played,
        stats,
        players!inner(name)
      `)
      .eq('game_id', sampleGame.id)
    
    if (error) {
      console.error(chalk.red('Error fetching logs:'), error)
      return
    }
    
    console.log(chalk.white(`Found ${logs?.length || 0} player logs for this game\n`))
    
    // Check minutes_played values
    const withMinutes = logs?.filter(l => l.minutes_played !== null && l.minutes_played > 0) || []
    const withPoints = logs?.filter(l => l.fantasy_points !== null && l.fantasy_points > 0) || []
    const withBoth = logs?.filter(l => 
      l.minutes_played !== null && l.minutes_played > 0 &&
      l.fantasy_points !== null && l.fantasy_points > 0
    ) || []
    
    console.log(chalk.white('Data availability:'))
    console.log(chalk.green(`  • Logs with minutes_played: ${withMinutes.length}`))
    console.log(chalk.green(`  • Logs with fantasy_points: ${withPoints.length}`))
    console.log(chalk.green(`  • Logs with both: ${withBoth.length}`))
    
    // Show sample of data
    console.log(chalk.yellow('\nSample player logs:'))
    logs?.slice(0, 5).forEach(log => {
      console.log(chalk.white(
        `  ${log.players?.name || `Player ${log.player_id}`}: ` +
        `${log.fantasy_points || 0} pts, ${log.minutes_played || 'NULL'} min`
      ))
    })
    
    // Check if minutes_played is being used
    if (withMinutes.length === 0) {
      console.log(chalk.red('\n⚠️  NO MINUTES DATA AVAILABLE!'))
      console.log(chalk.yellow('This is why synergy extraction is finding 0 pairs.'))
      console.log(chalk.yellow('We need to remove the minutes_played filter.\n'))
    }
    
    // Count potential synergies without minutes filter
    const validLogs = logs?.filter(l => l.fantasy_points !== null && l.fantasy_points > 0) || []
    const teams = new Map<number, any[]>()
    validLogs.forEach(log => {
      if (!teams.has(log.team_id)) teams.set(log.team_id, [])
      teams.get(log.team_id)!.push(log)
    })
    
    let potentialPairs = 0
    teams.forEach(players => {
      potentialPairs += (players.length * (players.length - 1)) / 2
    })
    
    console.log(chalk.green(`\nPotential synergies in this game: ${potentialPairs}`))
    console.log(chalk.dim('(Without minutes_played filter)\n'))
    
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  }
}

if (require.main === module) {
  quickCheck().catch(console.error)
}