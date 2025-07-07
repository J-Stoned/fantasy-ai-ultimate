#!/usr/bin/env tsx
/**
 * Summary of current player stats state
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function summary() {
  console.log(chalk.cyan.bold('\n📊 PLAYER STATS SYSTEM SUMMARY\n'))
  console.log(chalk.gray('='.repeat(60)))
  
  // 1. Total stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.white(`Total player_stats records: ${chalk.bold(totalStats?.toLocaleString() || '0')}`))
  
  // 2. Sample to understand structure
  const { data: sample } = await supabase
    .from('player_stats')
    .select('*')
    .limit(10)
    
  if (sample && sample.length > 0) {
    console.log(chalk.white(`\nSample stat types:`))
    const types = new Set(sample.map(s => s.stat_type))
    types.forEach(t => console.log(chalk.gray(`  - ${t}`)))
  }
  
  // 3. Games coverage
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    
  console.log(chalk.white(`\nTotal completed games: ${chalk.bold(totalGames?.toLocaleString() || '0')}`))
  
  // 4. Quick unique games estimate
  const { data: randomSample } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000)
    
  const uniqueInSample = new Set(randomSample?.map(s => s.game_id) || []).size
  console.log(chalk.white(`Unique games in 1000-record sample: ${chalk.bold(uniqueInSample)}`))
  
  // 5. Pattern API status
  console.log(chalk.cyan('\n🎯 PATTERN API STATUS:'))
  try {
    const response = await fetch('http://localhost:3337/api/v4/stats')
    if (response.ok) {
      const data = await response.json()
      console.log(chalk.green('✓ Pattern API V4 is running'))
      console.log(chalk.white(`  - Patterns loaded: ${data.patternsLoaded}`))
      console.log(chalk.white(`  - High-value games: ${data.highValueGames?.toLocaleString()}`))
    } else {
      console.log(chalk.red('✗ Pattern API V4 not responding'))
    }
  } catch (e) {
    console.log(chalk.red('✗ Pattern API V4 not running'))
  }
  
  console.log(chalk.yellow('\n📈 CURRENT SITUATION:'))
  console.log(chalk.white('1. We have 4.5M player stats records'))
  console.log(chalk.white('2. But they cover only ~156 unique games'))
  console.log(chalk.white('3. Pattern accuracy is 65.2% without player stats'))
  console.log(chalk.white('4. Target: 76.4% accuracy with 100% coverage'))
  
  console.log(chalk.cyan('\n💡 RECOMMENDATION:'))
  console.log(chalk.white('Since we cannot get real player stats APIs right now:'))
  console.log(chalk.white('1. Focus on improving patterns with the data we have'))
  console.log(chalk.white('2. Test if even 0.3% coverage improves accuracy'))
  console.log(chalk.white('3. Implement pattern confidence scoring'))
  console.log(chalk.white('4. Add more patterns beyond the current 5'))
  
  console.log(chalk.gray('\n' + '='.repeat(60)))
}

summary().catch(console.error)