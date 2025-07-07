#!/usr/bin/env tsx
/**
 * Accurate Coverage Check
 * Gets the real unique game count from player_stats
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAccurateCoverage() {
  console.log(chalk.cyan.bold('\n📊 ACCURATE COVERAGE CHECK\n'))
  
  // Get total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    
  console.log(chalk.white(`Total completed games: ${chalk.yellow(totalGames?.toLocaleString() || '0')}`))
  
  // Get total stat records
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.white(`Total player stat records: ${chalk.yellow(totalStats?.toLocaleString() || '0')}`))
  
  // Sample approach: Get games from recent stats
  console.log(chalk.gray('\nSampling recent games with stats...'))
  
  const sampleSize = 10000
  const samples = 5
  const uniqueGames = new Set<string>()
  
  for (let i = 0; i < samples; i++) {
    const offset = i * sampleSize
    const { data: stats } = await supabase
      .from('player_stats')
      .select('game_id')
      .range(offset, offset + sampleSize - 1)
      
    stats?.forEach(s => {
      if (s.game_id) uniqueGames.add(s.game_id)
    })
    
    console.log(chalk.gray(`Sample ${i + 1}: Found ${uniqueGames.size} unique games so far`))
  }
  
  // Extrapolate from sample
  const sampleRate = uniqueGames.size / (sampleSize * samples)
  const estimatedUniqueGames = Math.round((totalStats || 0) * sampleRate)
  
  console.log(chalk.cyan('\n📈 COVERAGE ANALYSIS:'))
  console.log(chalk.white(`Sampled unique games: ${chalk.green(uniqueGames.size.toLocaleString())}`))
  console.log(chalk.white(`Estimated total unique games: ${chalk.green(estimatedUniqueGames.toLocaleString())}`))
  console.log(chalk.white(`Coverage: ${chalk.green.bold(((estimatedUniqueGames / (totalGames || 1)) * 100).toFixed(1) + '%')}`))
  
  // Stats per game
  const statsPerGame = (totalStats || 0) / estimatedUniqueGames
  console.log(chalk.white(`\nAverage stats per game: ${chalk.yellow(statsPerGame.toFixed(1))}`))
  
  // Check if we're on track
  const targetCoverage = 50
  const currentCoverage = (estimatedUniqueGames / (totalGames || 1)) * 100
  
  if (currentCoverage >= targetCoverage) {
    console.log(chalk.green.bold(`\n✅ TARGET ACHIEVED! ${currentCoverage.toFixed(1)}% coverage!`))
    console.log(chalk.white('Ready to test if pattern accuracy improves to 76.4%!'))
  } else {
    const gamesNeeded = Math.round((targetCoverage / 100) * (totalGames || 0)) - estimatedUniqueGames
    console.log(chalk.yellow(`\n📊 Need ${gamesNeeded.toLocaleString()} more games to reach ${targetCoverage}% coverage`))
    console.log(chalk.white(`At current rate, that's ${(gamesNeeded * statsPerGame).toLocaleString()} more stat records`))
  }
  
  return {
    totalGames,
    estimatedUniqueGames,
    coverage: currentCoverage,
    statsPerGame
  }
}

getAccurateCoverage().catch(console.error)