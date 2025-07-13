#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkNFLCoverageDetailed() {
  console.log(chalk.bold.yellow('🏈 NFL Coverage Detailed Check\n'))
  
  // Check recent additions
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('created_at, game_id')
    .order('created_at', { ascending: false })
    .limit(100)
    
  if (recentStats && recentStats.length > 0) {
    const latestTime = new Date(recentStats[0].created_at)
    const now = new Date()
    const minutesAgo = Math.round((now.getTime() - latestTime.getTime()) / 60000)
    
    console.log(`Latest stats added: ${minutesAgo} minutes ago`)
    
    if (minutesAgo < 10) {
      // Check what sport these games are
      const gameIds = [...new Set(recentStats.map(s => s.game_id))]
      const { data: games } = await supabase
        .from('games')
        .select('sport, external_id')
        .in('id', gameIds.slice(0, 10))
        
      console.log('Recent stats added for:')
      games?.forEach(g => console.log(`  - ${g.sport}: ${g.external_id}`))
    }
  }
  
  // Check NFL (uppercase) coverage
  console.log(chalk.bold.cyan('\n📊 NFL (uppercase) Coverage:'))
  
  const { count: nflTotal } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .not('home_score', 'is', null)
    
  console.log(`Total NFL completed games: ${nflTotal}`)
  
  // Get all NFL games to check coverage
  const allNFLGames: any[] = []
  let offset = 0
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NFL')
      .not('home_score', 'is', null)
      .range(offset, offset + 999)
      
    if (!batch || batch.length === 0) break
    allNFLGames.push(...batch)
    offset += 1000
  }
  
  console.log(`Checking ${allNFLGames.length} NFL games for stats...`)
  
  // Check which have stats
  const gamesWithStats = new Set<number>()
  const gameIds = allNFLGames.map(g => g.id)
  
  for (let i = 0; i < gameIds.length; i += 500) {
    const batch = gameIds.slice(i, i + 500)
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch)
      
    data?.forEach(row => gamesWithStats.add(row.game_id))
  }
  
  const coverage = (gamesWithStats.size / allNFLGames.length * 100).toFixed(1)
  const remaining = allNFLGames.length - gamesWithStats.size
  
  console.log(chalk.bold.green(`\n✅ NFL Coverage: ${gamesWithStats.size}/${allNFLGames.length} games (${coverage}%)`))
  console.log(chalk.bold.yellow(`🎯 Games remaining: ${remaining}`))
  
  // Also check lowercase nfl
  console.log(chalk.bold.cyan('\n📊 nfl (lowercase) Coverage:'))
  
  const { count: nflLowerTotal } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'nfl')
    .not('home_score', 'is', null)
    
  console.log(`Total nfl completed games: ${nflLowerTotal}`)
  
  // Quick check of lowercase coverage
  const { data: nflLowerGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'nfl')
    .not('home_score', 'is', null)
    
  if (nflLowerGames && nflLowerGames.length > 0) {
    const lowerGameIds = nflLowerGames.map(g => g.id)
    const { data: lowerStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', lowerGameIds)
      
    const lowerGamesWithStats = new Set(lowerStats?.map(s => s.game_id))
    console.log(`nfl games with stats: ${lowerGamesWithStats.size}/${nflLowerGames.length}`)
  }
  
  console.log(chalk.bold.yellow('\n💡 Note: Database has both "NFL" and "nfl" games!'))
}

checkNFLCoverageDetailed().catch(console.error)