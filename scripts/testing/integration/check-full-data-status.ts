#!/usr/bin/env tsx
/**
 * CHECK FULL DATA STATUS
 * See what data we actually have and what we're missing
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkFullDataStatus() {
  console.log(chalk.bold.red('🔍 FULL DATA STATUS CHECK\n'))
  
  // 1. TOTAL RECORD COUNTS
  console.log(chalk.yellow('📊 TOTAL RECORD COUNTS:'))
  
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    
  console.log(`  Player Stats: ${totalStats?.toLocaleString() || 0}`)
  console.log(`  Games: ${totalGames?.toLocaleString() || 0}`)
  console.log(`  Players: ${totalPlayers?.toLocaleString() || 0}`)
  
  // 2. GAMES BY SPORT
  console.log(chalk.yellow('\n🏟️ GAMES BY SPORT:'))
  
  const sportCounts = new Map<string, number>()
  let offset = 0
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('sport')
      .not('sport', 'is', null)
      .range(offset, offset + 999)
      
    if (!games || games.length === 0) break
    
    games.forEach(g => {
      sportCounts.set(g.sport, (sportCounts.get(g.sport) || 0) + 1)
    })
    
    offset += 1000
  }
  
  Array.from(sportCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count.toLocaleString()} games`)
    })
  
  // 3. STATS COVERAGE BY SPORT
  console.log(chalk.yellow('\n📈 STATS COVERAGE ANALYSIS:'))
  
  for (const [sport, totalGameCount] of sportCounts.entries()) {
    // Get games for this sport
    const { data: sportGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .limit(1000)
      
    if (sportGames && sportGames.length > 0) {
      const gameIds = sportGames.map(g => g.id)
      
      // Check how many have stats
      const { data: gamesWithStats } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', gameIds)
        
      const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id)).size
      const coverage = (uniqueGamesWithStats / sportGames.length * 100).toFixed(1)
      
      console.log(`  ${sport}: ${uniqueGamesWithStats}/${sportGames.length} games (${coverage}% coverage)`)
    }
  }
  
  // 4. RECENT GAMES STATUS
  console.log(chalk.yellow('\n📅 RECENT GAMES STATUS:'))
  
  const { data: recentGames } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_score, away_score')
    .not('sport', 'is', null)
    .not('home_score', 'is', null)
    .gte('start_time', '2024-01-01')
    .order('start_time', { ascending: false })
    .limit(20)
    
  console.log(`Recent completed games:`)
  recentGames?.slice(0, 5).forEach(game => {
    console.log(`  ${game.sport}: ${game.external_id} on ${new Date(game.start_time).toLocaleDateString()}`)
  })
  
  // Check which recent games have stats
  if (recentGames && recentGames.length > 0) {
    const recentGameIds = recentGames.map(g => g.id)
    const { data: recentStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', recentGameIds)
      
    const recentGamesWithStats = new Set(recentStats?.map(s => s.game_id))
    const recentCoverage = (recentGamesWithStats.size / recentGames.length * 100).toFixed(1)
    
    console.log(`\nRecent games with stats: ${recentGamesWithStats.size}/${recentGames.length} (${recentCoverage}% coverage)`)
  }
  
  // 5. IDENTIFY MISSING DATA OPPORTUNITIES
  console.log(chalk.yellow('\n🎯 MISSING DATA OPPORTUNITIES:'))
  
  // Find games without stats that are completed
  const { data: completedGamesNoStats } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time')
    .not('sport', 'is', null)
    .not('home_score', 'is', null)
    .gte('start_time', '2023-01-01')
    .lte('start_time', '2024-12-31')
    .limit(1000)
    
  if (completedGamesNoStats) {
    const gameIds = completedGamesNoStats.map(g => g.id)
    const { data: existingStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', gameIds)
      
    const gamesWithStatsSet = new Set(existingStats?.map(s => s.game_id))
    const missingGames = completedGamesNoStats.filter(g => !gamesWithStatsSet.has(g.id))
    
    console.log(`Found ${missingGames.length} completed games without stats`)
    
    const missingSportCounts = new Map<string, number>()
    missingGames.forEach(g => {
      missingSportCounts.set(g.sport, (missingSportCounts.get(g.sport) || 0) + 1)
    })
    
    console.log('Missing stats by sport:')
    Array.from(missingSportCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count} games need stats`)
      })
  }
  
  // 6. ESPN ID STANDARDIZATION STATUS
  console.log(chalk.yellow('\n🔧 ESPN ID STATUS:'))
  
  const { data: espnGames } = await supabase
    .from('games')
    .select('external_id, sport')
    .like('external_id', 'espn_%')
    .limit(1000)
    
  let standardFormat = 0
  let legacyFormat = 0
  
  espnGames?.forEach(g => {
    if (g.external_id.match(/^espn_[a-z]+_\d+$/)) {
      standardFormat++
    } else {
      legacyFormat++
    }
  })
  
  console.log(`ESPN games sampled: ${espnGames?.length || 0}`)
  console.log(`Standard format: ${standardFormat}`)
  console.log(`Legacy format: ${legacyFormat}`)
  
  // 7. RECOMMENDATIONS
  console.log(chalk.bold.yellow('\n🚀 RECOMMENDATIONS TO GET MORE DATA:'))
  
  console.log('1. RUN MEGA COLLECTOR on missing games')
  console.log('2. Update ESPN scrapers to handle more sports')
  console.log('3. Increase batch sizes for faster collection')
  console.log('4. Focus on high-value sports (NBA, NFL) first')
  console.log('5. Run scrapers on recent games for fresh data')
  
  if (totalStats && totalStats < 300000) {
    console.log(chalk.green('\n✅ OPPORTUNITY: Can easily collect 50K+ more stats'))
  }
  
  if (missingGames && missingGames.length > 500) {
    console.log(chalk.green(`✅ TARGET: ${missingGames.length} completed games ready for scraping`))
  }
}

// Run the check
checkFullDataStatus().catch(console.error)