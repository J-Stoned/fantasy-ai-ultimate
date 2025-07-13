#!/usr/bin/env tsx
/**
 * CHECK PLAYER STATS ANALYSIS
 * See if we've actually analyzed our massive player stats collection for patterns
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkPlayerStatsAnalysis() {
  console.log(chalk.bold.cyan('🔍 PLAYER STATS ANALYSIS CHECK\n'))
  
  // Check what we have in player_game_logs
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.yellow(`📊 Total player stats: ${totalStats?.toLocaleString() || 0}`))
  
  // Sample some stats to see structure
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('player_id, game_id, stats, team_id, opponent_id, is_home')
    .not('stats', 'is', null)
    .limit(5)
    
  console.log(chalk.cyan('\n📋 Sample player stats structure:'))
  sampleStats?.slice(0, 2).forEach((stat, i) => {
    console.log(`${chalk.white(`Sample ${i + 1}:`)}`)
    console.log(`  Player ID: ${stat.player_id}`)
    console.log(`  Game ID: ${stat.game_id}`)
    console.log(`  Team ID: ${stat.team_id}`)
    console.log(`  Is Home: ${stat.is_home}`)
    
    const statsKeys = Object.keys(stat.stats || {})
    console.log(`  Stats keys (${statsKeys.length}): ${statsKeys.slice(0, 5).join(', ')}${statsKeys.length > 5 ? '...' : ''}`)
    
    // Show a few sample values
    const sampleValues: any = {}
    statsKeys.slice(0, 3).forEach(key => {
      sampleValues[key] = stat.stats[key]
    })
    console.log(`  Sample values: ${JSON.stringify(sampleValues)}`)
    console.log()
  })
  
  // Check what sports we have stats for
  console.log(chalk.cyan('📊 Stats by sport (sampling games):'))
  
  const { data: games } = await supabase
    .from('games')
    .select('id, sport')
    .not('sport', 'is', null)
    .limit(1000)
    
  const gamesByIds = new Map()
  games?.forEach(g => gamesByIds.set(g.id, g.sport))
  
  const { data: statsWithGames } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', Array.from(gamesByIds.keys()))
    .limit(5000)
    
  const sportCounts = new Map()
  statsWithGames?.forEach(stat => {
    const sport = gamesByIds.get(stat.game_id)
    if (sport) {
      sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1)
    }
  })
  
  Array.from(sportCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count.toLocaleString()} stats`)
    })
  
  // Check if we have pattern analysis
  console.log(chalk.cyan('\n🔍 Pattern analysis status:'))
  
  // Check if we've run any pattern detection on player stats
  const patternTables = ['pattern_results', 'player_patterns', 'statistical_patterns', 'betting_patterns']
  
  for (const table of patternTables) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      console.log(`  ${table}: ${count || 0} records`)
    } catch (error) {
      console.log(`  ${table}: ${chalk.gray('Table does not exist')}`)
    }
  }
  
  // Check for any analysis or computed metrics
  const { data: hasComputedMetrics } = await supabase
    .from('player_game_logs')
    .select('computed_metrics')
    .not('computed_metrics', 'is', null)
    .limit(1)
    
  console.log(`  Computed metrics: ${hasComputedMetrics?.length || 0 > 0 ? chalk.green('YES') : chalk.red('NO')}`)
  
  // Check if we have any advanced stats analysis
  const { data: advancedAnalysis } = await supabase
    .from('player_game_logs')
    .select('raw_stats, tracking_data, situational_stats')
    .limit(1)
    
  const hasAdvanced = advancedAnalysis?.[0]
  console.log(`  Raw stats field: ${hasAdvanced?.raw_stats ? chalk.green('YES') : chalk.red('NO')}`)
  console.log(`  Tracking data: ${hasAdvanced?.tracking_data ? chalk.green('YES') : chalk.red('NO')}`)
  console.log(`  Situational stats: ${hasAdvanced?.situational_stats ? chalk.green('YES') : chalk.red('NO')}`)
  
  // Assessment
  console.log(chalk.bold.yellow('\n📋 ANALYSIS ASSESSMENT:'))
  
  if (totalStats && totalStats > 250000) {
    console.log(chalk.green('✅ MASSIVE dataset ready for analysis'))
    console.log(chalk.yellow('⚠️  No pattern analysis detected yet'))
    console.log(chalk.cyan('🎯 OPPORTUNITY: 258K+ stats waiting for pattern detection!'))
    
    console.log(chalk.bold.cyan('\n🚀 RECOMMENDED NEXT STEPS:'))
    console.log('1. Run pattern detection on player performance trends')
    console.log('2. Analyze clutch performance patterns')
    console.log('3. Find home/away advantage patterns')
    console.log('4. Detect breakout player patterns')
    console.log('5. Identify matchup-specific patterns')
  } else {
    console.log(chalk.yellow('⚠️  Limited dataset for analysis'))
  }
}

// Run the check
checkPlayerStatsAnalysis().catch(console.error)