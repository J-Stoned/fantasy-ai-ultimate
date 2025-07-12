#!/usr/bin/env tsx
/**
 * Check Available Data for Synergy Analysis
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkData() {
  console.log(chalk.cyan.bold('\n🔍 CHECKING AVAILABLE SYNERGY DATA\n'))
  
  try {
    // Check games
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
    
    console.log(chalk.white(`✓ Completed games: ${gameCount || 0}`))
    
    // Check player game logs
    const { count: logCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('fantasy_points', 'is', null)
    
    console.log(chalk.white(`✓ Player game logs with fantasy points: ${logCount || 0}`))
    
    // Check if player_synergies table exists
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'player_synergies')
    
    const synergyTableExists = tables && tables.length > 0
    console.log(chalk.white(`✓ Player synergies table exists: ${synergyTableExists ? 'YES' : 'NO'}`))
    
    if (synergyTableExists) {
      const { count: synergyCount } = await supabase
        .from('player_synergies')
        .select('*', { count: 'exact', head: true })
      
      console.log(chalk.white(`✓ Existing synergies in database: ${synergyCount || 0}`))
    }
    
    // Sample some player data
    console.log(chalk.yellow('\n📊 SAMPLE PLAYER PERFORMANCE DATA:\n'))
    
    const { data: topPerformances } = await supabase
      .from('player_game_logs')
      .select(`
        player_id,
        fantasy_points,
        game_id,
        team_id,
        players!inner(name)
      `)
      .not('fantasy_points', 'is', null)
      .gte('fantasy_points', 30)
      .order('fantasy_points', { ascending: false })
      .limit(10)
    
    if (topPerformances && topPerformances.length > 0) {
      console.log(chalk.green('Top 10 Individual Performances:'))
      topPerformances.forEach((perf, i) => {
        console.log(chalk.white(
          `${i + 1}. ${perf.players?.name || `Player ${perf.player_id}`}: ` +
          `${perf.fantasy_points} pts (Game ${perf.game_id})`
        ))
      })
    }
    
    // Check for frequently playing together
    console.log(chalk.yellow('\n🤝 CHECKING FOR PLAYER PAIRS:\n'))
    
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id')
      .eq('status', 'completed')
      .limit(50)
    
    if (sampleGames && sampleGames.length > 0) {
      const pairCounts = new Map<string, number>()
      
      for (const game of sampleGames) {
        const { data: logs } = await supabase
          .from('player_game_logs')
          .select('player_id, team_id')
          .eq('game_id', game.id)
          .not('fantasy_points', 'is', null)
        
        if (logs && logs.length >= 2) {
          // Group by team
          const teams = new Map<number, number[]>()
          logs.forEach(log => {
            if (!teams.has(log.team_id)) teams.set(log.team_id, [])
            teams.get(log.team_id)!.push(log.player_id)
          })
          
          // Count pairs
          teams.forEach(players => {
            for (let i = 0; i < players.length - 1; i++) {
              for (let j = i + 1; j < players.length; j++) {
                const pair = [players[i], players[j]].sort().join('-')
                pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1)
              }
            }
          })
        }
      }
      
      // Show top pairs
      const topPairs = Array.from(pairCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
      
      console.log(chalk.green(`Found ${pairCounts.size} unique player pairs`))
      console.log(chalk.white('\nMost frequent teammates (from 50 game sample):'))
      topPairs.forEach(([pair, count], i) => {
        const [p1, p2] = pair.split('-')
        console.log(chalk.white(`${i + 1}. Players ${p1} & ${p2}: ${count} games together`))
      })
    }
    
    console.log(chalk.cyan.bold('\n💡 NEXT STEPS:\n'))
    
    if (!synergyTableExists) {
      console.log(chalk.yellow('1. Create player_synergies table:'))
      console.log(chalk.white('   Run migration: supabase/migrations/20250112_spatial_analytics_tables.sql'))
    }
    
    console.log(chalk.yellow('\n2. Extract synergies from existing data:'))
    console.log(chalk.white('   npx tsx scripts/extract-spatial-from-existing-db.ts'))
    
    console.log(chalk.yellow('\n3. View synergies in app:'))
    console.log(chalk.white('   http://localhost:3000/spatial-analytics'))
    
  } catch (error) {
    console.error(chalk.red('Error checking data:'), error)
  }
}

if (require.main === module) {
  checkData().catch(console.error)
}