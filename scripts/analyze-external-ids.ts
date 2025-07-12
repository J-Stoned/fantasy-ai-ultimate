#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function analyzeExternalIdFormats() {
  console.log(chalk.cyan.bold('\n📊 EXTERNAL ID FORMAT ANALYSIS\n'))
  
  // Get sample external IDs by sport
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB']
  
  for (const sport of sports) {
    const { data: games } = await supabase
      .from('games')
      .select('external_id')
      .eq('sport', sport)
      .not('external_id', 'is', null)
      .limit(20)
      
    if (!games || games.length === 0) continue
    
    console.log(chalk.yellow(`\n${sport} External ID Formats:`))
    
    const formats = new Map<string, number>()
    games.forEach(g => {
      const id = g.external_id
      let format = 'unknown'
      
      if (id.startsWith('espn_')) {
        if (id.includes('mlb')) format = 'espn_mlb_XXXXXXX'
        else if (id.includes('nfl')) format = 'espn_nfl_XXXXXXX'
        else if (id.includes('nba')) format = 'espn_nba_XXXXXXX'
        else if (id.includes('nhl')) format = 'espn_nhl_XXXXXXX'
        else format = 'espn_XXXXXXX'
      } else if (id.startsWith('mlb_')) {
        format = 'mlb_XXXXXX'
      } else if (/^\d+$/.test(id)) {
        format = 'numeric_only'
      } else {
        format = 'other: ' + id.substring(0, 20)
      }
      
      formats.set(format, (formats.get(format) || 0) + 1)
    })
    
    formats.forEach((count, format) => {
      console.log(`  ${format}: ${count} games`)
    })
  }
  
  // Count total external IDs by pattern
  console.log(chalk.cyan('\n📈 OVERALL DISTRIBUTION:'))
  
  // Count espn_ prefix
  const { count: espnCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null)
    .like('external_id', 'espn_%')
    
  console.log(`espn_ prefix: ${espnCount || 0} games`)
  
  // Count mlb_ prefix
  const { count: mlbCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null)
    .like('external_id', 'mlb_%')
    
  console.log(`mlb_ prefix: ${mlbCount || 0} games`)
  
  // Count numeric only (harder to query directly)
  const { data: allGames } = await supabase
    .from('games')
    .select('external_id')
    .not('external_id', 'is', null)
    .limit(1000)
    
  let numericCount = 0
  let otherCount = 0
  
  allGames?.forEach(g => {
    if (/^\d+$/.test(g.external_id)) {
      numericCount++
    } else if (!g.external_id.startsWith('espn_') && !g.external_id.startsWith('mlb_')) {
      otherCount++
    }
  })
  
  console.log(`Numeric only: ${numericCount} games (sample of 1000)`)
  console.log(`Other formats: ${otherCount} games (sample of 1000)`)
  
  // Get total with external IDs
  const { count: total } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null)
    
  console.log(chalk.green(`\nTotal games with external IDs: ${total}`))
  
  // Show recommendation
  console.log(chalk.cyan.bold('\n💡 RECOMMENDATION:'))
  console.log('Standardize all external IDs to format: espn_{sport}_{id}')
  console.log('This will:')
  console.log('1. Make ID format consistent across all sports')
  console.log('2. Clearly identify the data source (ESPN)')
  console.log('3. Include sport context in the ID')
  console.log('4. Simplify API calls and data collection')
}

analyzeExternalIdFormats().catch(console.error)