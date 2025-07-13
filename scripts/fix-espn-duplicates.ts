#!/usr/bin/env tsx
/**
 * FIX ESPN ID DUPLICATES - Handle duplicate ESPN IDs before standardization
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'
import { parseEspnId, standardizeEspnId } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fixDuplicates() {
  console.log(chalk.bold.red('🔧 FIXING ESPN ID DUPLICATES\n'))
  
  // First, find all potential duplicates
  console.log(chalk.cyan('Finding duplicate ESPN IDs...'))
  
  // Get all games with ESPN-like IDs
  const allGames: any[] = []
  let offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_score, away_score')
      .not('external_id', 'is', null)
      .or('external_id.like.%espn%,external_id.like.%nba_%,external_id.like.%nfl_%,external_id.like.%mlb_%,external_id.like.%nhl_%,external_id.like.%college%')
      .range(offset, offset + 999)
      .order('id')
    
    if (!data || data.length === 0) break
    
    allGames.push(...data)
    offset += 1000
    
    if (offset % 5000 === 0) {
      console.log(chalk.gray(`  Loaded ${offset} games...`))
    }
  }
  
  console.log(chalk.cyan(`\nTotal games with ESPN-like IDs: ${allGames.length}`))
  
  // Group by standardized ID to find conflicts
  const standardizedGroups = new Map<string, typeof allGames>()
  const cannotStandardize: typeof allGames = []
  
  for (const game of allGames) {
    const standardized = standardizeEspnId(game.external_id, game.sport)
    
    if (standardized) {
      if (!standardizedGroups.has(standardized)) {
        standardizedGroups.set(standardized, [])
      }
      standardizedGroups.get(standardized)!.push(game)
    } else {
      cannotStandardize.push(game)
    }
  }
  
  // Find conflicts (multiple games mapping to same standardized ID)
  const conflicts: Array<{ standardized: string, games: typeof allGames }> = []
  
  standardizedGroups.forEach((games, standardized) => {
    if (games.length > 1) {
      conflicts.push({ standardized, games })
    }
  })
  
  console.log(chalk.yellow(`\nFound ${conflicts.length} ID conflicts`))
  console.log(chalk.yellow(`Cannot standardize ${cannotStandardize.length} IDs\n`))
  
  // Show sample conflicts
  if (conflicts.length > 0) {
    console.log(chalk.cyan('Sample conflicts:'))
    conflicts.slice(0, 5).forEach(conflict => {
      console.log(chalk.yellow(`\n${conflict.standardized}:`))
      conflict.games.forEach(g => {
        console.log(`  Game ${g.id}: ${g.external_id} (${g.sport}) - ${new Date(g.start_time).toLocaleDateString()}`)
      })
    })
  }
  
  // Resolve conflicts
  console.log(chalk.cyan('\n🔨 Resolving conflicts...'))
  
  let resolved = 0
  let deleted = 0
  
  for (const conflict of conflicts) {
    // Sort games by completeness and recency
    const sortedGames = conflict.games.sort((a, b) => {
      // Prefer games with scores
      const aHasScore = a.home_score !== null && a.away_score !== null
      const bHasScore = b.home_score !== null && b.away_score !== null
      
      if (aHasScore && !bHasScore) return -1
      if (!aHasScore && bHasScore) return 1
      
      // Then by date (newer first)
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    })
    
    // Keep the first (best) game
    const keepGame = sortedGames[0]
    const duplicates = sortedGames.slice(1)
    
    // Check if duplicates have any unique data
    const duplicatesWithStats: number[] = []
    
    for (const dup of duplicates) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', dup.id)
        
      if (count && count > 0) {
        duplicatesWithStats.push(dup.id)
      }
    }
    
    if (duplicatesWithStats.length > 0) {
      // Don't delete games with stats - mark them instead
      console.log(chalk.yellow(`  Conflict ${conflict.standardized}: Keeping game ${keepGame.id}, marking ${duplicatesWithStats.length} games with stats`))
      
      // Add suffix to external_id for games with stats
      for (let i = 0; i < duplicatesWithStats.length; i++) {
        const dupId = duplicatesWithStats[i]
        const dup = duplicates.find(d => d.id === dupId)!
        const newExtId = `${dup.external_id}_dup${i + 1}`
        
        await supabase
          .from('games')
          .update({ external_id: newExtId })
          .eq('id', dupId)
      }
      
      // Delete games without stats
      const toDelete = duplicates.filter(d => !duplicatesWithStats.includes(d.id))
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('games')
          .delete()
          .in('id', toDelete.map(d => d.id))
          
        if (!error) {
          deleted += toDelete.length
        }
      }
    } else {
      // Safe to delete all duplicates
      const { error } = await supabase
        .from('games')
        .delete()
        .in('id', duplicates.map(d => d.id))
        
      if (!error) {
        deleted += duplicates.length
      }
    }
    
    resolved++
    
    if (resolved % 100 === 0) {
      console.log(chalk.green(`  Resolved ${resolved} conflicts, deleted ${deleted} games`))
    }
  }
  
  // Handle games that cannot be standardized
  console.log(chalk.cyan('\n🔧 Handling non-standardizable IDs...'))
  
  let fixed = 0
  for (const game of cannotStandardize) {
    // Try to guess sport from external_id pattern
    let sport = game.sport
    
    if (!sport || sport === 'null') {
      if (game.external_id.includes('college-football')) {
        sport = 'ncaaf'
      } else if (game.external_id.includes('nba')) {
        sport = 'nba'
      } else if (game.external_id.includes('nfl')) {
        sport = 'nfl'
      } else if (game.external_id.includes('mlb')) {
        sport = 'mlb'
      } else if (game.external_id.includes('nhl')) {
        sport = 'nhl'
      }
      
      if (sport && sport !== game.sport) {
        // Update sport field
        await supabase
          .from('games')
          .update({ sport: sport.toUpperCase() })
          .eq('id', game.id)
          
        fixed++
      }
    }
  }
  
  console.log(chalk.green(`  Fixed sport for ${fixed} games`))
  
  // Final report
  console.log(chalk.bold.yellow('\n📊 DUPLICATE RESOLUTION COMPLETE!\n'))
  console.log(`  Conflicts resolved: ${resolved}`)
  console.log(`  Duplicate games deleted: ${deleted}`)
  console.log(`  Games with fixed sport: ${fixed}`)
  console.log(`  Remaining non-standardizable: ${cannotStandardize.length - fixed}`)
  
  console.log(chalk.bold.green('\n✅ Database is now ready for ESPN ID standardization!'))
}

// Run it
fixDuplicates().catch(console.error)