#!/usr/bin/env tsx
/**
 * STANDARDIZE REMAINING ESPN IDs - After duplicate cleanup
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'
import { standardizeEspnId, isValidEspnId, SPORT_MAPPINGS } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function standardizeRemaining() {
  console.log(chalk.bold.red('🔧 STANDARDIZING REMAINING ESPN IDs\n'))
  
  let updated = 0
  let failed = 0
  
  // Get games that need standardization
  let offset = 0
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, sport')
      .not('external_id', 'is', null)
      .not('external_id', 'like', '%_dup%') // Skip marked duplicates
      .or('external_id.like.%espn%,external_id.like.%nba_%,external_id.like.%nfl_%,external_id.like.%mlb_%,external_id.like.%nhl_%,external_id.like.%college%')
      .range(offset, offset + 999)
      .order('id')
    
    if (!games || games.length === 0) break
    
    for (const game of games) {
      // Skip if already standardized
      if (isValidEspnId(game.external_id)) {
        continue
      }
      
      // Try to standardize
      let standardized = standardizeEspnId(game.external_id, game.sport)
      
      // If failed and we have sport, try harder
      if (!standardized && game.sport) {
        const numericId = game.external_id.match(/(\d+)/)
        if (numericId) {
          const sportCode = SPORT_MAPPINGS[game.sport] || SPORT_MAPPINGS[game.sport.toLowerCase()]
          if (sportCode) {
            standardized = `espn_${sportCode}_${numericId[1]}`
          }
        }
      }
      
      if (standardized) {
        // Check if this ID already exists
        const { count } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('external_id', standardized)
          .neq('id', game.id)
          
        if (count === 0) {
          // Safe to update
          const { error } = await supabase
            .from('games')
            .update({ external_id: standardized })
            .eq('id', game.id)
            
          if (!error) {
            updated++
            
            if (updated % 100 === 0) {
              console.log(chalk.green(`✅ Updated ${updated} games`))
            }
          } else {
            failed++
            if (failed <= 5) {
              console.log(chalk.red(`❌ Failed to update game ${game.id}: ${error.message}`))
            }
          }
        } else {
          // ID already exists - add suffix
          const suffixedId = `${game.external_id}_alt`
          const { error } = await supabase
            .from('games')
            .update({ external_id: suffixedId })
            .eq('id', game.id)
            
          if (!error) {
            updated++
          } else {
            failed++
          }
        }
      } else {
        failed++
      }
    }
    
    offset += 1000
    
    if (offset % 5000 === 0) {
      console.log(chalk.gray(`Processed ${offset} games...`))
    }
  }
  
  // Same for teams and players (simplified)
  console.log(chalk.cyan('\nStandardizing teams...'))
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, sport')
    .not('external_id', 'is', null)
    .like('external_id', '%espn%')
    .limit(1000)
  
  let teamsUpdated = 0
  for (const team of teams || []) {
    if (!isValidEspnId(team.external_id)) {
      const standardized = standardizeEspnId(team.external_id, team.sport)
      if (standardized) {
        const { error } = await supabase
          .from('teams')
          .update({ external_id: standardized })
          .eq('id', team.id)
          
        if (!error) teamsUpdated++
      }
    }
  }
  
  console.log(chalk.cyan('\nStandardizing players...'))
  
  const { data: players } = await supabase
    .from('players')
    .select('id, external_id, sport')
    .not('external_id', 'is', null)
    .like('external_id', '%espn%')
    .limit(5000)
  
  let playersUpdated = 0
  for (const player of players || []) {
    if (!isValidEspnId(player.external_id)) {
      let standardized = standardizeEspnId(player.external_id, player.sport)
      
      // Special handling for players with espn_ID format
      if (!standardized && player.sport && player.external_id.match(/^espn_(\d+)$/)) {
        const numericId = player.external_id.match(/^espn_(\d+)$/)?.[1]
        if (numericId) {
          const sportCode = SPORT_MAPPINGS[player.sport] || SPORT_MAPPINGS[player.sport.toLowerCase()]
          if (sportCode) {
            standardized = `espn_${sportCode}_${numericId}`
          }
        }
      }
      
      if (standardized) {
        const { error } = await supabase
          .from('players')
          .update({ external_id: standardized })
          .eq('id', player.id)
          
        if (!error) playersUpdated++
      }
    }
  }
  
  // Final report
  console.log(chalk.bold.yellow('\n📊 STANDARDIZATION COMPLETE!\n'))
  console.log(`  Games updated: ${updated}`)
  console.log(`  Games failed: ${failed}`)
  console.log(`  Teams updated: ${teamsUpdated}`)
  console.log(`  Players updated: ${playersUpdated}`)
  
  // Verify standardization
  const { count: standardizedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%_%')
    
  const { count: totalEspnGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', '%espn%')
    
  console.log(chalk.bold.green(`\n✅ ${standardizedGames || 0} games now have standardized ESPN IDs`))
  console.log(chalk.cyan(`📊 ${((standardizedGames || 0) / (totalEspnGames || 1) * 100).toFixed(1)}% of ESPN games are standardized`))
  
  console.log(chalk.bold.cyan('\n🎯 ESPN ID standardization is complete!'))
  console.log(chalk.yellow('All new scrapers should use the standardized format: espn_{sport}_{numeric_id}'))
}

// Run it
standardizeRemaining().catch(console.error)