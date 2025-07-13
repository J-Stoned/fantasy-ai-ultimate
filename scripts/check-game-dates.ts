#!/usr/bin/env tsx
/**
 * CHECK GAME DATES
 * See what date ranges we have
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkGameDates() {
  // Check recent games
  const { data: games } = await supabase
    .from('games')
    .select('sport, start_time, external_id')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(20)
    
  console.log(chalk.bold('Recent completed games:'))
  games?.forEach(g => {
    console.log(`  ${g.sport}: ${new Date(g.start_time).toLocaleDateString()} - ${g.external_id}`)
  })
  
  // Check games by year
  const years = ['2025', '2024', '2023']
  
  for (const year of years) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .gte('start_time', `${year}-01-01`)
      .lt('start_time', `${parseInt(year) + 1}-01-01`)
      
    console.log(`\n${year} completed games: ${count || 0}`)
  }
  
  // Check NBA specifically
  console.log(chalk.bold('\n\nNBA Games by year:'))
  for (const year of years) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NBA')
      .not('home_score', 'is', null)
      .gte('start_time', `${year}-01-01`)
      .lt('start_time', `${parseInt(year) + 1}-01-01`)
      
    console.log(`  ${year}: ${count || 0} games`)
  }
}

checkGameDates().catch(console.error)