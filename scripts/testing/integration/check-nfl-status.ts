#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkNFLStatus() {
  console.log(chalk.bold.yellow('🏈 Checking NFL Data Status...\n'))
  
  // Current stats count
  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(`Total player stats: ${statsCount?.toLocaleString()}`)
  
  // Check all sport values for NFL
  const { data: allSports } = await supabase
    .from('games')
    .select('sport')
    .not('sport', 'is', null)
    .ilike('sport', '%nfl%')
    .limit(100)
    
  const sportVariants = new Set(allSports?.map(g => g.sport))
  console.log('\nNFL sport variants found:')
  sportVariants.forEach(sport => console.log(` - "${sport}"`))
  
  // Count games by each variant
  console.log('\nGames by variant:')
  for (const variant of Array.from(sportVariants)) {
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', variant)
      
    const { count: completedGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', variant)
      .not('home_score', 'is', null)
      
    console.log(`  ${variant}: ${totalGames} total, ${completedGames} completed`)
    
    // Check how many have stats
    if (completedGames && completedGames > 0) {
      const { data: sampleGames } = await supabase
        .from('games')
        .select('id')
        .eq('sport', variant)
        .not('home_score', 'is', null)
        .limit(1000)
        
      if (sampleGames) {
        const gameIds = sampleGames.map(g => g.id)
        const { data: gamesWithStats } = await supabase
          .from('player_game_logs')
          .select('game_id')
          .in('game_id', gameIds)
          
        const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id))
        console.log(`    Games with stats: ${uniqueGamesWithStats.size}/${sampleGames.length}`)
      }
    }
  }
  
  // Also check standard NFL (uppercase)
  if (!sportVariants.has('NFL')) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NFL')
      
    console.log(`\n  NFL (uppercase): ${count || 0} games`)
  }
}

checkNFLStatus().catch(console.error)