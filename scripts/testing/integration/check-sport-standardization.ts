#!/usr/bin/env tsx
/**
 * CHECK SPORT STANDARDIZATION
 * Find all sport value variations in the database
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSportStandardization() {
  console.log(chalk.bold.red('🔍 SPORT STANDARDIZATION CHECK\n'))
  
  // Get all unique sport values
  console.log(chalk.yellow('📊 Fetching all sport values from games table...\n'))
  
  const sportCounts = new Map<string, number>()
  let offset = 0
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('sport')
      .not('sport', 'is', null)
      .range(offset, offset + 9999)
      
    if (!games || games.length === 0) break
    
    games.forEach(g => {
      sportCounts.set(g.sport, (sportCounts.get(g.sport) || 0) + 1)
    })
    
    offset += 10000
  }
  
  // Group by sport type (case-insensitive)
  const sportGroups = new Map<string, Map<string, number>>()
  
  sportCounts.forEach((count, sport) => {
    const normalized = sport.toUpperCase()
    if (!sportGroups.has(normalized)) {
      sportGroups.set(normalized, new Map())
    }
    sportGroups.get(normalized)!.set(sport, count)
  })
  
  // Display findings
  console.log(chalk.bold.yellow('🏆 SPORT VALUE VARIATIONS FOUND:\n'))
  
  let totalInconsistencies = 0
  
  sportGroups.forEach((variants, sportType) => {
    if (variants.size > 1) {
      console.log(chalk.bold.red(`❌ ${sportType} has ${variants.size} variations:`))
      variants.forEach((count, variant) => {
        console.log(`   "${variant}": ${count.toLocaleString()} games`)
      })
      totalInconsistencies += variants.size - 1
    } else {
      const [variant, count] = Array.from(variants.entries())[0]
      console.log(chalk.green(`✅ ${sportType}: "${variant}" (${count.toLocaleString()} games) - Consistent`))
    }
  })
  
  // Check players table too
  console.log(chalk.bold.yellow('\n📊 Checking players table sport values...\n'))
  
  const { data: playerSports } = await supabase
    .from('players')
    .select('sport')
    .not('sport', 'is', null)
    .limit(10000)
    
  const playerSportCounts = new Map<string, number>()
  playerSports?.forEach(p => {
    playerSportCounts.set(p.sport, (playerSportCounts.get(p.sport) || 0) + 1)
  })
  
  console.log('Player sport values found:')
  Array.from(playerSportCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .forEach(([sport, count]) => {
      console.log(`  "${sport}": ${count} players`)
    })
  
  // Recommendations
  console.log(chalk.bold.cyan('\n🎯 STANDARDIZATION RECOMMENDATIONS:\n'))
  
  if (totalInconsistencies > 0) {
    console.log(chalk.bold.red(`⚠️  Found ${totalInconsistencies} sport value inconsistencies!`))
    console.log('\nSuggested standard format:')
    console.log('  - NFL (not nfl)')
    console.log('  - NBA (not nba)')
    console.log('  - NHL (not nhl)')
    console.log('  - MLB (not mlb)')
    console.log('  - MLS (not mls)')
    console.log('  - NCAAF (not ncaaf or NCAA_FB)')
    console.log('  - NCAAB (not ncaab or NCAA_BB)')
    
    console.log(chalk.bold.yellow('\n📝 We need a standardization script to:'))
    console.log('1. Update all sport values to uppercase standard')
    console.log('2. Merge NCAA variants (NCAA_BB → NCAAB, NCAA_FB → NCAAF)')
    console.log('3. Update all related tables (games, teams, players)')
    console.log('4. Add database constraints to enforce standards')
  } else {
    console.log(chalk.green('✅ All sports are consistently named!'))
  }
  
  // Check how this affects our collection scripts
  console.log(chalk.bold.yellow('\n⚠️  IMPACT ON COLLECTION SCRIPTS:'))
  console.log('Our scripts are looking for uppercase values (NFL, NBA, etc.)')
  console.log('But some games have lowercase values (nfl, nba, etc.)')
  console.log('This is why coverage calculations are showing 0%!')
}

checkSportStandardization().catch(console.error)