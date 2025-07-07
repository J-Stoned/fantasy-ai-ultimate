#!/usr/bin/env tsx
/**
 * Real Coverage Check
 * Properly counts unique games with player stats
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getRealCoverage() {
  console.log(chalk.cyan.bold('\n📊 REAL COVERAGE CHECK\n'))
  
  // Get total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
  
  console.log(chalk.white(`Total games in database: ${chalk.yellow(totalGames?.toLocaleString() || '0')}`))
  
  // Count unique games with stats by batching
  console.log(chalk.gray('\nCounting unique games with stats (this may take a moment)...'))
  
  const uniqueGames = new Set<string>()
  let offset = 0
  const batchSize = 50000
  let totalRecords = 0
  
  while (true) {
    const { data: batch, error } = await supabase
      .from('player_stats')
      .select('game_id')
      .range(offset, offset + batchSize - 1)
      .order('game_id')
    
    if (error || !batch || batch.length === 0) {
      break
    }
    
    batch.forEach(record => {
      if (record.game_id) {
        uniqueGames.add(record.game_id)
      }
    })
    
    totalRecords += batch.length
    
    if (batch.length < batchSize) {
      break
    }
    
    offset += batchSize
    console.log(chalk.gray(`  Processed ${totalRecords.toLocaleString()} records, found ${uniqueGames.size.toLocaleString()} unique games...`))
  }
  
  const coverage = (uniqueGames.size / (totalGames || 1)) * 100
  
  console.log(chalk.cyan('\n📈 RESULTS:'))
  console.log(chalk.white(`Total stat records processed: ${chalk.yellow(totalRecords.toLocaleString())}`))
  console.log(chalk.white(`Unique games with stats: ${chalk.green(uniqueGames.size.toLocaleString())}`))
  console.log(chalk.white(`Coverage: ${chalk.green.bold(coverage.toFixed(2) + '%')}`))
  
  // Progress towards goal
  const goal = 50000
  const progress = (uniqueGames.size / goal) * 100
  
  console.log(chalk.cyan('\n🎯 PROGRESS TOWARDS 50K GAMES:'))
  console.log(chalk.white(`Goal: ${chalk.yellow(goal.toLocaleString())} games with stats`))
  console.log(chalk.white(`Current: ${chalk.green(uniqueGames.size.toLocaleString())} games`))
  console.log(chalk.white(`Progress: ${chalk.green.bold(progress.toFixed(1) + '%')}`))
  
  if (uniqueGames.size >= goal) {
    console.log(chalk.green.bold('\n✅ GOAL ACHIEVED! 50,000+ games have stats!'))
  } else {
    const remaining = goal - uniqueGames.size
    console.log(chalk.yellow(`\n📊 Need ${remaining.toLocaleString()} more games to reach goal`))
    
    const avgStatsPerGame = totalRecords / uniqueGames.size
    console.log(chalk.gray(`Average stats per game: ${avgStatsPerGame.toFixed(1)}`))
  }
  
  return {
    totalGames,
    uniqueGamesWithStats: uniqueGames.size,
    coverage,
    totalRecords
  }
}

getRealCoverage().catch(console.error)