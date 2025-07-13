#!/usr/bin/env tsx
/**
 * Check ALL game counts in database
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAllGames() {
  console.log(chalk.cyan.bold('\n🏈 COMPLETE GAME COUNT ANALYSIS\n'))
  
  try {
    // 1. Total games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
    
    console.log(chalk.white(`📊 TOTAL GAMES IN DATABASE: ${chalk.green.bold(totalGames?.toLocaleString() || '0')}\n`))
    
    // 2. By status
    console.log(chalk.yellow('By Status:'))
    
    const statuses = ['completed', 'scheduled', 'in_progress', 'postponed', 'cancelled']
    for (const status of statuses) {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)
      
      if (count && count > 0) {
        console.log(chalk.white(`  • ${status}: ${count.toLocaleString()}`))
      }
    }
    
    // Check for null status
    const { count: nullStatus } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('status', null)
    
    if (nullStatus && nullStatus > 0) {
      console.log(chalk.white(`  • No status: ${nullStatus.toLocaleString()}`))
    }
    
    // 3. By sport
    console.log(chalk.yellow('\nBy Sport:'))
    
    const sports = ['football', 'basketball', 'baseball', 'hockey', 'soccer']
    for (const sport of sports) {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport)
      
      if (count && count > 0) {
        console.log(chalk.white(`  • ${sport}: ${count.toLocaleString()}`))
      }
    }
    
    // 4. Completed games with scores
    const { count: withScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
    
    console.log(chalk.yellow(`\n✅ Completed games WITH scores: ${chalk.green.bold(withScores?.toLocaleString() || '0')}`))
    
    // 5. Games by year
    console.log(chalk.yellow('\nGames by Year:'))
    
    const years = [2020, 2021, 2022, 2023, 2024, 2025]
    for (const year of years) {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', `${year}-01-01`)
        .lt('start_time', `${year + 1}-01-01`)
      
      if (count && count > 0) {
        console.log(chalk.white(`  • ${year}: ${count.toLocaleString()} games`))
      }
    }
    
    // 6. Check for games with player data
    console.log(chalk.yellow('\n📊 Games with Player Data:'))
    
    // Sample check - count distinct games in player_game_logs
    const { data: gamesWithLogs } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .limit(50000)
    
    const uniqueGamesWithLogs = new Set(gamesWithLogs?.map(l => l.game_id) || [])
    console.log(chalk.white(`  • Games with player logs: ~${uniqueGamesWithLogs.size.toLocaleString()}+`))
    
    // Check games with fantasy points
    const { data: gamesWithFantasy } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .gt('fantasy_points', 0)
      .limit(50000)
    
    const uniqueGamesWithFantasy = new Set(gamesWithFantasy?.map(l => l.game_id) || [])
    console.log(chalk.white(`  • Games with fantasy data: ~${uniqueGamesWithFantasy.size.toLocaleString()}+`))
    
    // 7. Recent games
    const { data: recentGames } = await supabase
      .from('games')
      .select('id, sport, status, start_time, home_team_id, away_team_id')
      .order('start_time', { ascending: false })
      .limit(10)
    
    console.log(chalk.yellow('\n🕐 Most Recent Games:'))
    recentGames?.forEach((game, i) => {
      const date = new Date(game.start_time).toLocaleDateString()
      console.log(chalk.dim(`  ${i + 1}. ${game.sport} - ${date} - ${game.status}`))
    })
    
    // Summary
    console.log(chalk.cyan.bold('\n📈 SUMMARY:'))
    console.log(chalk.white(`• Database contains ${chalk.green.bold(totalGames?.toLocaleString() || '0')} total games`))
    console.log(chalk.white(`• ${chalk.green.bold(withScores?.toLocaleString() || '0')} games ready for analysis (completed with scores)`))
    console.log(chalk.white(`• Data spans multiple sports and years`))
    
    if (totalGames && totalGames > 10000) {
      console.log(chalk.yellow.bold(`\n💎 You have a MASSIVE dataset!`))
      console.log(chalk.white(`   This is enough data to find THOUSANDS of valuable synergies!`))
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  }
}

if (require.main === module) {
  checkAllGames().catch(console.error)
}