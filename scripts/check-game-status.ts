#!/usr/bin/env tsx
/**
 * Check current game database status
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import chalk from 'chalk'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkRecentGames() {
  // Check total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    
  // Check games from 2023-present
  const { count: recentGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', '2023-01-01')
    .lte('start_time', '2025-07-12')
    
  // Check games with ESPN IDs
  const { count: espnGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%')
    
  // Check by sport
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'MLS', 'NCAAB', 'NCAAF']
  const sportCounts: Record<string, number> = {}
  
  for (const sport of sports) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .gte('start_time', '2023-01-01')
      
    sportCounts[sport] = count || 0
  }
  
  // Check most recent games
  const { data: recent } = await supabase
    .from('games')
    .select('sport, external_id, start_time, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
    
  console.log(chalk.bold.yellow('📊 GAME DATABASE STATUS:'))
  console.log(chalk.gray('=' + '='.repeat(60)))
  console.log(chalk.cyan('Total games in database: ' + totalGames?.toLocaleString()))
  console.log(chalk.cyan('Games 2023-present: ' + recentGames?.toLocaleString()))
  console.log(chalk.cyan('Games with ESPN IDs: ' + espnGames?.toLocaleString()))
  
  console.log(chalk.yellow('\nGames by Sport (2023-present):'))
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count.toLocaleString()}`))
  })
  
  console.log(chalk.yellow('\nMost Recently Added Games:'))
  recent?.forEach(game => {
    console.log(chalk.gray(`  ${game.sport} - ${game.external_id} - ${new Date(game.start_time).toLocaleDateString()} (added ${new Date(game.created_at).toLocaleString()})`))
  })
}

checkRecentGames().catch(console.error)