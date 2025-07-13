#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSports() {
  console.log(chalk.cyan('\n🏈 Checking sport values in games table...\n'))
  
  // Count null sports
  const { count: nullCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('sport', null)
    
  console.log(chalk.yellow(`Games with NULL sport: ${nullCount || 0}`))
  
  // Get sport distribution
  const { data: games } = await supabase
    .from('games')
    .select('sport')
    .not('sport', 'is', null)
    .limit(1000)
    
  const sportCounts: Record<string, number> = {}
  games?.forEach(g => {
    sportCounts[g.sport] = (sportCounts[g.sport] || 0) + 1
  })
  
  console.log(chalk.cyan('\nSport distribution:'))
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count}`)
  })
  
  // Check games with ESPN IDs but null sport
  const { data: nullSportGames } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .is('sport', null)
    .not('external_id', 'is', null)
    .like('external_id', 'espn_%')
    .limit(10)
    
  if (nullSportGames?.length) {
    console.log(chalk.red('\nGames with ESPN ID but NULL sport:'))
    nullSportGames.forEach(g => {
      console.log(`  Game ${g.id}: ${g.external_id}`)
    })
  }
}

checkSports().catch(console.error)