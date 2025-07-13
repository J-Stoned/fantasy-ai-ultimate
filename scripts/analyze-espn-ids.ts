#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import chalk from 'chalk'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function analyzeEspnIds() {
  console.log(chalk.bold.yellow('🔍 ANALYZING ESPN ID PATTERNS\n'))
  
  // Get sample of ESPN IDs
  const { data: games } = await supabase
    .from('games')
    .select('external_id, sport')
    .or('external_id.like.%espn%,external_id.like.%college-football%,external_id.like.%nba_%,external_id.like.%nfl_%,external_id.like.%mlb_%,external_id.like.%nhl_%')
    .limit(500)
    
  if (!games) return
  
  // Analyze patterns
  const patterns = new Map<string, { count: number, sports: Set<string>, examples: string[] }>()
  
  games.forEach(game => {
    // Extract the pattern
    let pattern = 'unknown'
    
    if (game.external_id.startsWith('espn_')) {
      // Standard format: espn_sport_id
      const parts = game.external_id.split('_')
      if (parts.length >= 3) {
        pattern = `espn_{sport}_ID`
      }
    } else if (game.external_id.includes('_')) {
      // Non-standard format: sport_id
      const parts = game.external_id.split('_')
      if (parts.length >= 2) {
        pattern = `${parts[0]}_ID`
      }
    } else {
      pattern = 'no_underscore'
    }
    
    if (!patterns.has(pattern)) {
      patterns.set(pattern, { count: 0, sports: new Set(), examples: [] })
    }
    
    const patternData = patterns.get(pattern)!
    patternData.count++
    patternData.sports.add(game.sport || 'null')
    if (patternData.examples.length < 5) {
      patternData.examples.push(game.external_id)
    }
  })
  
  // Display patterns
  console.log(chalk.cyan('ESPN ID Patterns Found:\n'))
  
  patterns.forEach((data, pattern) => {
    console.log(chalk.yellow(`Pattern: ${pattern}`))
    console.log(`  Count: ${data.count}`)
    console.log(`  Sports: ${Array.from(data.sports).join(', ')}`)
    console.log(`  Examples:`)
    data.examples.forEach(ex => console.log(`    - ${ex}`))
    console.log()
  })
  
  // Check for duplicates or conflicts
  console.log(chalk.cyan('Checking for ID conflicts...\n'))
  
  const idMap = new Map<string, string[]>()
  games.forEach(game => {
    // Extract just the numeric ID
    const match = game.external_id.match(/(\d+)$/)
    if (match) {
      const numericId = match[1]
      if (!idMap.has(numericId)) {
        idMap.set(numericId, [])
      }
      idMap.get(numericId)!.push(game.external_id)
    }
  })
  
  let conflicts = 0
  idMap.forEach((ids, numericId) => {
    if (ids.length > 1) {
      conflicts++
      if (conflicts <= 5) {
        console.log(chalk.red(`Conflict for ID ${numericId}:`))
        ids.forEach(id => console.log(`  - ${id}`))
      }
    }
  })
  
  if (conflicts > 5) {
    console.log(chalk.red(`\n... and ${conflicts - 5} more conflicts`))
  } else if (conflicts === 0) {
    console.log(chalk.green('No ID conflicts found!'))
  }
  
  // Recommendations
  console.log(chalk.bold.cyan('\n📋 STANDARDIZATION RECOMMENDATIONS:\n'))
  console.log('1. Use format: espn_{sport}_{numeric_id}')
  console.log('2. Sport codes should be lowercase: nba, nfl, mlb, nhl, ncaab, ncaaf')
  console.log('3. Store original ESPN ID separately if needed')
  console.log('4. Create a mapping table for sport variations')
}

analyzeEspnIds().catch(console.error)