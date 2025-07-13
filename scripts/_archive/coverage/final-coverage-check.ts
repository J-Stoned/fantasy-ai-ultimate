#!/usr/bin/env tsx
/**
 * Final Coverage Check
 * Uses multiple methods to get accurate count
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function finalCoverageCheck() {
  console.log(chalk.cyan.bold('\n📊 FINAL COVERAGE CHECK - MULTIPLE METHODS\n'))
  
  // Method 1: Sample and extrapolate
  console.log(chalk.yellow('Method 1: Sampling approach...'))
  
  const sampleSize = 100000
  const { data: sample } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(sampleSize)
  
  const uniqueInSample = new Set(sample?.map(s => s.game_id).filter(Boolean) || [])
  console.log(chalk.white(`Unique games in ${sampleSize.toLocaleString()} sample: ${chalk.green(uniqueInSample.size)}`))
  
  // Method 2: Check specific ranges
  console.log(chalk.yellow('\nMethod 2: Checking game ID ranges...'))
  
  const ranges = [
    { start: 1, end: 100 },
    { start: 3000000, end: 3001000 },
    { start: 3001000, end: 3002000 },
    { start: 3002000, end: 3003000 },
  ]
  
  let totalUnique = new Set<string>()
  
  for (const range of ranges) {
    const { data } = await supabase
      .from('player_stats')
      .select('game_id')
      .gte('game_id', range.start)
      .lte('game_id', range.end)
      .limit(10000)
    
    const uniqueInRange = new Set(data?.map(s => s.game_id).filter(Boolean) || [])
    uniqueInRange.forEach(id => totalUnique.add(id.toString()))
    
    console.log(chalk.gray(`  Range ${range.start}-${range.end}: ${uniqueInRange.size} unique games`))
  }
  
  // Method 3: Get total count
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
  
  // Calculate estimates
  const avgStatsPerGame = (totalStats || 0) / uniqueInSample.size
  const estimatedUniqueGames = Math.round((totalStats || 0) / avgStatsPerGame)
  
  console.log(chalk.cyan('\n📈 FINAL RESULTS:'))
  console.log(chalk.white(`Total games in database: ${chalk.yellow(totalGames?.toLocaleString() || '0')}`))
  console.log(chalk.white(`Total stat records: ${chalk.yellow(totalStats?.toLocaleString() || '0')}`))
  console.log(chalk.white(`Confirmed unique games (sample): ${chalk.green(uniqueInSample.size.toLocaleString())}`))
  console.log(chalk.white(`Estimated total unique games: ${chalk.green.bold(estimatedUniqueGames.toLocaleString())}`))
  console.log(chalk.white(`Average stats per game: ${chalk.yellow(avgStatsPerGame.toFixed(1))}`))
  
  const coverage = (estimatedUniqueGames / (totalGames || 1)) * 100
  console.log(chalk.white(`\nEstimated coverage: ${chalk.green.bold(coverage.toFixed(2) + '%')}`))
  
  // Progress to 50k
  const progress = (estimatedUniqueGames / 50000) * 100
  console.log(chalk.cyan('\n🎯 PROGRESS TO 50,000 GAMES:'))
  console.log(chalk.white(`Current: ${chalk.green(estimatedUniqueGames.toLocaleString())} / 50,000 games`))
  console.log(chalk.white(`Progress: ${chalk.green.bold(progress.toFixed(1) + '%')}`))
  
  if (estimatedUniqueGames >= 50000) {
    console.log(chalk.green.bold('\n✅ GOAL ACHIEVED! 50,000+ games have stats!'))
  } else {
    console.log(chalk.yellow(`\n📊 Need ~${(50000 - estimatedUniqueGames).toLocaleString()} more games`))
  }
}

finalCoverageCheck().catch(console.error)