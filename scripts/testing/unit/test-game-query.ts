#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testQuery() {
  // Test 1: Default query
  const { data: test1, count: count1 } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .eq('status', 'completed')
    .not('home_score', 'is', null)
  
  console.log('Test 1 - Default:', test1?.length, 'rows, Total count:', count1)
  
  // Test 2: With explicit limit
  const { data: test2, count: count2 } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .limit(10000)
  
  console.log('Test 2 - Limit 10000:', test2?.length, 'rows, Total count:', count2)
  
  // Test 3: Multiple range queries
  let allGames = []
  const batchSize = 1000
  
  for (let offset = 0; offset < 10000; offset += batchSize) {
    const { data } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .range(offset, offset + batchSize - 1)
    
    if (!data || data.length === 0) break
    allGames = allGames.concat(data)
    console.log(`Batch ${offset / batchSize + 1}: Got ${data.length} games, Total: ${allGames.length}`)
  }
  
  console.log(chalk.green(`\nTotal games collected: ${allGames.length}`))
}

testQuery().catch(console.error)