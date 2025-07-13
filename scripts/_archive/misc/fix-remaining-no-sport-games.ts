#!/usr/bin/env tsx
/**
 * FIX REMAINING NO_SPORT GAMES
 * Target the 36 remaining games with espn_12345 format and standardize them
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'
import { generateEspnId } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fixNoSportGames() {
  console.log(chalk.bold.red('🔧 FIXING NO_SPORT ESPN GAMES\n'))
  
  // Get all NO_SPORT games (espn_12345 format, not espn_sport_12345)
  const allGames: any[] = []
  let offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport')
      .like('external_id', 'espn_%')
      .range(offset, offset + 999)
      .order('id')
      
    if (!data || data.length === 0) break
    allGames.push(...data)
    offset += 1000
  }
  
  // Filter for NO_SPORT pattern (espn_numbers, not espn_sport_numbers)
  const noSportGames = allGames.filter(g => 
    g.external_id.match(/^espn_\d+$/) &&
    !g.external_id.includes('_dup') &&
    !g.external_id.includes('_alt')
  )
    
  console.log(chalk.cyan(`Found ${noSportGames?.length || 0} NO_SPORT games to fix\n`))
  
  if (!noSportGames || noSportGames.length === 0) {
    console.log(chalk.green('✅ No NO_SPORT games found - all good!'))
    return
  }
  
  // Show samples first
  console.log(chalk.yellow('Sample NO_SPORT games:'))
  noSportGames.slice(0, 10).forEach(game => {
    console.log(`  Game ${game.id}: ${game.external_id} (sport: ${game.sport || 'null'})`)
  })
  
  let fixed = 0
  let failed = 0
  let skipped = 0
  
  for (const game of noSportGames) {
    // Extract numeric ID
    const numericMatch = game.external_id.match(/^espn_(\d+)$/)
    if (!numericMatch) {
      skipped++
      continue
    }
    
    const numericId = numericMatch[1]
    
    // Try to determine sport from game.sport field
    if (game.sport) {
      try {
        const standardized = generateEspnId(game.sport, numericId)
        
        if (standardized) {
          // Check if this standardized ID already exists
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
              fixed++
              console.log(chalk.green(`✅ Fixed game ${game.id}: ${game.external_id} → ${standardized}`))
            } else {
              failed++
              console.log(chalk.red(`❌ Failed to update game ${game.id}: ${error.message}`))
            }
          } else {
            // ID conflict - add suffix
            const suffixed = `${game.external_id}_alt`
            const { error } = await supabase
              .from('games')
              .update({ external_id: suffixed })
              .eq('id', game.id)
              
            if (!error) {
              fixed++
              console.log(chalk.yellow(`⚠️  Added suffix to game ${game.id}: ${game.external_id} → ${suffixed}`))
            } else {
              failed++
            }
          }
        } else {
          failed++
          console.log(chalk.red(`❌ Could not generate standard ID for game ${game.id} (sport: ${game.sport})`))
        }
      } catch (error: any) {
        failed++
        console.log(chalk.red(`❌ Error processing game ${game.id}: ${error.message}`))
      }
    } else {
      // No sport field - try to infer from teams or patterns
      // For now, mark as unknown sport
      const unknownId = `${game.external_id}_unknown_sport`
      const { error } = await supabase
        .from('games')
        .update({ external_id: unknownId })
        .eq('id', game.id)
        
      if (!error) {
        skipped++
        console.log(chalk.yellow(`⚠️  Marked unknown sport: ${game.external_id} → ${unknownId}`))
      } else {
        failed++
      }
    }
    
    // Progress update
    if ((fixed + failed + skipped) % 10 === 0) {
      console.log(chalk.gray(`  Progress: ${fixed + failed + skipped}/${noSportGames.length}`))
    }
  }
  
  // Final report
  console.log(chalk.bold.yellow('\n📊 NO_SPORT GAMES FIX COMPLETE!'))
  console.log(`  Fixed: ${fixed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Skipped/Unknown: ${skipped}`)
  console.log(`  Total processed: ${fixed + failed + skipped}`)
  
  // Check new compatibility
  const { data: updatedGames } = await supabase
    .from('games')
    .select('external_id')
    .like('external_id', '%espn%')
    .limit(1000)
    
  const standardCount = updatedGames?.filter(g => 
    g.external_id.match(/^espn_[a-z]+_\d+$/)
  ).length || 0
  
  const dupCount = updatedGames?.filter(g => 
    g.external_id.includes('_dup')
  ).length || 0
  
  const totalEspn = updatedGames?.length || 1
  const newPercentage = ((standardCount / totalEspn) * 100).toFixed(1)
  
  console.log(chalk.bold.green(`\n✅ NEW GAMES COMPATIBILITY: ${newPercentage}%`))
  console.log(chalk.cyan(`Standard format: ${standardCount}/${totalEspn}`))
  console.log(chalk.gray(`Duplicates marked: ${dupCount}`))
  
  if (parseFloat(newPercentage) >= 95) {
    console.log(chalk.bold.green('\n🎯 TARGET ACHIEVED: 95%+ games compatibility!'))
  } else {
    console.log(chalk.yellow(`\n⏳ Getting close... need ${95 - parseFloat(newPercentage)}% more`))
  }
}

// Run it
fixNoSportGames().catch(console.error)