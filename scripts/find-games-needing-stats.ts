#!/usr/bin/env tsx
/**
 * FIND GAMES NEEDING STATS
 * Find specific games that need stats collection
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function findGamesNeedingStats() {
  console.log(chalk.bold.red('🔍 FINDING GAMES THAT NEED STATS\n'))
  
  const sports = ['NBA', 'NHL', 'MLB', 'NCAAB']
  
  for (const sport of sports) {
    console.log(chalk.bold.yellow(`\n${sport} Games:`))
    
    // Get recent games
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .gte('start_time', '2024-01-01')
      .lte('start_time', '2024-12-31')
      .order('start_time', { ascending: false })
      .limit(50)
      
    if (!games || games.length === 0) {
      console.log('  No games found')
      continue
    }
    
    let foundWithoutStats = 0
    const gamesWithoutStats = []
    
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1)
        
      if (!count || count === 0) {
        foundWithoutStats++
        gamesWithoutStats.push(game)
        
        if (foundWithoutStats >= 5) break
      }
    }
    
    if (gamesWithoutStats.length > 0) {
      console.log(chalk.green(`  Found ${foundWithoutStats} games without stats:`))
      gamesWithoutStats.forEach(g => {
        console.log(`    ${new Date(g.start_time).toLocaleDateString()} - ${g.external_id} (Score: ${g.home_score}-${g.away_score})`)
      })
    } else {
      console.log(chalk.cyan('  All checked games have stats!'))
    }
  }
  
  // Check overall totals
  console.log(chalk.bold.cyan('\n📊 OVERALL STATS:'))
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .gte('start_time', '2023-01-01')
    .lte('start_time', '2024-12-31')
    
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(`  Total completed games (2023-2024): ${totalGames}`)
  console.log(`  Total player stats: ${totalStats}`)
  console.log(`  Average stats per game: ${((totalStats || 0) / (totalGames || 1)).toFixed(1)}`)
}

findGamesNeedingStats().catch(console.error)