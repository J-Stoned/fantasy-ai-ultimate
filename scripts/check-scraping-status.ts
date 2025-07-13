#!/usr/bin/env tsx
/**
 * CHECK SCRAPING STATUS - See what games still need stats
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkStatus() {
  console.log(chalk.bold.yellow('📊 STATS SCRAPING STATUS CHECK\n'))
  
  // Get total stats
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`Total player stats: ${totalStats?.toLocaleString() || 0}\n`))
  
  // Get games with stats
  const gamesWithStats = new Set<number>()
  let offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .range(offset, offset + 999)
    
    if (!data || data.length === 0) break
    
    data.forEach(row => gamesWithStats.add(row.game_id))
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.cyan(`Games with stats: ${gamesWithStats.size.toLocaleString()}\n`))
  
  // Check each sport
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF']
  const cutoffDate = new Date('2024-12-31T23:59:59.999Z')
  const startDate = new Date('2023-01-01T00:00:00.000Z')
  
  console.log(chalk.yellow('Games by sport (2023-2024):'))
  console.log(chalk.gray('Sport | Total | With Stats | Need Stats | Coverage'))
  console.log(chalk.gray('------|-------|------------|------------|----------'))
  
  for (const sport of sports) {
    // Get all completed games for this sport
    const allGames = []
    offset = 0
    
    while (true) {
      const { data } = await supabase
        .from('games')
        .select('id')
        .or(`sport.eq.${sport},sport.eq.${sport.toLowerCase()}`)
        .like('external_id', `espn_${sport.toLowerCase()}_%`)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', cutoffDate.toISOString())
        .not('home_score', 'is', null)
        .range(offset, offset + 999)
      
      if (!data || data.length === 0) break
      
      allGames.push(...data)
      offset += 1000
      if (data.length < 1000) break
    }
    
    const withStats = allGames.filter(g => gamesWithStats.has(g.id)).length
    const needStats = allGames.length - withStats
    const coverage = allGames.length > 0 ? ((withStats / allGames.length) * 100).toFixed(1) : '0.0'
    
    const color = coverage === '100.0' ? chalk.green : 
                  parseFloat(coverage) > 50 ? chalk.yellow : 
                  chalk.red
    
    console.log(
      `${sport.padEnd(5)} | ${allGames.length.toString().padStart(5)} | ${withStats.toString().padStart(10)} | ${needStats.toString().padStart(10)} | ${color(coverage + '%')}`
    )
  }
  
  // Check stats by sport from player_game_logs
  console.log(chalk.yellow('\n\nStats breakdown by team sport:'))
  
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('team_id, team:teams!player_game_logs_team_id_fkey(sport)')
    .limit(10000)
    
  const sportCounts: Record<string, number> = {}
  
  sampleStats?.forEach(stat => {
    if (stat.team?.sport) {
      sportCounts[stat.team.sport] = (sportCounts[stat.team.sport] || 0) + 1
    }
  })
  
  // Extrapolate from sample
  const sampleSize = sampleStats?.length || 0
  const multiplier = totalStats && sampleSize > 0 ? totalStats / sampleSize : 1
  
  Object.entries(sportCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      const estimated = Math.round(count * multiplier)
      console.log(`  ${sport}: ~${estimated.toLocaleString()} stats`)
    })
    
  // Recent activity
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1000)
    
  if (recentStats && recentStats.length > 0) {
    const newest = new Date(recentStats[0].created_at)
    const oldest = new Date(recentStats[recentStats.length - 1].created_at)
    const timeSpan = (newest.getTime() - oldest.getTime()) / 1000
    const rate = timeSpan > 0 ? (1000 / timeSpan).toFixed(1) : '0'
    
    console.log(chalk.cyan(`\nRecent scraping rate: ${rate} stats/second`))
    console.log(chalk.cyan(`Last stat added: ${newest.toLocaleString()}`))
  }
}

checkStatus().catch(console.error)