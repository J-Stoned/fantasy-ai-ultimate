#!/usr/bin/env tsx
/**
 * Find where fantasy points data actually is
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function findFantasyData() {
  console.log(chalk.cyan.bold('\n🔍 FINDING FANTASY DATA\n'))
  
  try {
    // Check player_game_logs structure
    const { data: sampleLogs } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(5)
    
    console.log(chalk.yellow('Sample player_game_logs structure:'))
    if (sampleLogs && sampleLogs.length > 0) {
      console.log(chalk.dim('Columns: ' + Object.keys(sampleLogs[0]).join(', ')))
      
      // Check if stats column has fantasy data
      const log = sampleLogs[0]
      if (log.stats) {
        console.log(chalk.yellow('\nStats column contains:'))
        console.log(JSON.stringify(log.stats, null, 2).substring(0, 500))
      }
      
      if (log.raw_stats) {
        console.log(chalk.yellow('\nRaw stats column contains:'))
        console.log(JSON.stringify(log.raw_stats, null, 2).substring(0, 500))
      }
    }
    
    // Check for fantasy points in different places
    console.log(chalk.yellow('\n📊 Checking for fantasy points...\n'))
    
    // 1. Check if fantasy_points column has data
    const { count: logsWithFantasy } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('fantasy_points', 'is', null)
      .gt('fantasy_points', 0)
    
    console.log(chalk.white(`Logs with fantasy_points > 0: ${logsWithFantasy || 0}`))
    
    // 2. Check if stats->points exists
    const { data: logsWithStats } = await supabase
      .from('player_game_logs')
      .select('id, stats')
      .not('stats', 'is', null)
      .limit(100)
    
    const withPoints = logsWithStats?.filter(l => 
      l.stats && typeof l.stats === 'object' && 'points' in l.stats
    ) || []
    
    console.log(chalk.white(`Logs with stats->points: ${withPoints.length}/100 sampled`))
    
    // 3. Show a sample with actual data
    if (logsWithFantasy && logsWithFantasy > 0) {
      const { data: goodLogs } = await supabase
        .from('player_game_logs')
        .select(`
          player_id,
          game_id,
          fantasy_points,
          stats,
          players!inner(name)
        `)
        .gt('fantasy_points', 20)
        .limit(10)
      
      console.log(chalk.green('\n✅ Found logs with fantasy points!'))
      console.log(chalk.yellow('Sample high-scoring performances:'))
      goodLogs?.forEach(log => {
        console.log(chalk.white(
          `  ${log.players?.name}: ${log.fantasy_points} fantasy pts` +
          (log.stats?.points ? ` (${log.stats.points} real pts)` : '')
        ))
      })
    }
    
    // 4. Check for calculated fantasy points
    if (withPoints.length > 0) {
      console.log(chalk.yellow('\n💡 Can calculate fantasy points from stats:'))
      const sample = withPoints[0].stats as any
      console.log(chalk.white('Available stats:'))
      console.log(chalk.dim(
        `  Points: ${sample.points || 0}, ` +
        `Rebounds: ${sample.rebounds || 0}, ` +
        `Assists: ${sample.assists || 0}, ` +
        `Steals: ${sample.steals || 0}, ` +
        `Blocks: ${sample.blocks || 0}`
      ))
      
      // Calculate DFS points
      const dfsPoints = 
        (sample.points || 0) * 1 +
        (sample.rebounds || 0) * 1.2 +
        (sample.assists || 0) * 1.5 +
        (sample.steals || 0) * 3 +
        (sample.blocks || 0) * 3 -
        (sample.turnovers || 0) * 1
      
      console.log(chalk.green(`  Calculated DFS points: ${dfsPoints.toFixed(2)}`))
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  }
}

if (require.main === module) {
  findFantasyData().catch(console.error)
}