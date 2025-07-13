#!/usr/bin/env tsx
/**
 * DEBUG CONSTRAINT ISSUES
 * Figure out why we're getting duplicate key violations
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debugConstraintIssues() {
  console.log(chalk.bold.red('🔍 DEBUG CONSTRAINT ISSUES\n'))
  
  // Test with a specific game that had constraint errors
  const testGames = [
    { id: 'espn_nba_401704717', sport: 'NBA' },
    { id: 'espn_ncaaf_401644743', sport: 'NCAAF' }
  ]
  
  for (const test of testGames) {
    console.log(chalk.bold.yellow(`\nTesting ${test.sport} game: ${test.id}`))
    
    // Get the game
    const { data: game } = await supabase
      .from('games')
      .select('id, external_id, sport')
      .eq('external_id', test.id)
      .single()
      
    if (!game) {
      console.log(chalk.red('  Game not found!'))
      continue
    }
    
    console.log(`  Database game ID: ${game.id}`)
    
    // Check for existing stats using game_id
    const { data: stats, count } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id', { count: 'exact' })
      .eq('game_id', game.id)
      .limit(5)
      
    console.log(`  Existing stats count: ${count || 0}`)
    
    if (stats && stats.length > 0) {
      console.log('  Sample stats:')
      stats.forEach(stat => {
        console.log(`    Player ${stat.player_id} -> Game ${stat.game_id}`)
      })
    }
    
    // Now check why collect-only-missing thinks it doesn't have stats
    // The issue might be in how we're building the Set
    
    // Check if there are any player_game_logs without proper game_id
    const { count: orphanCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .is('game_id', null)
      
    if (orphanCount && orphanCount > 0) {
      console.log(chalk.red(`\n  WARNING: ${orphanCount} stats with NULL game_id!`))
    }
  }
  
  // Check overall data integrity
  console.log(chalk.bold.cyan('\n📊 DATA INTEGRITY CHECK:\n'))
  
  // Games vs Stats mapping
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    
  const { data: uniqueGameIds } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(100000) // Get a large sample
    
  const uniqueGames = new Set(uniqueGameIds?.map(row => row.game_id))
  
  console.log(`  Total completed games: ${totalGames}`)
  console.log(`  Unique games with stats: ${uniqueGames.size}`)
  console.log(`  Coverage: ${((uniqueGames.size / (totalGames || 1)) * 100).toFixed(1)}%`)
  
  // Check for mismatched external_ids
  console.log(chalk.bold.yellow('\n🔍 CHECKING FOR MISMATCHES:\n'))
  
  // Sample some player_game_logs to see their structure
  const { data: sampleLogs } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(5)
    
  console.log('Sample player_game_logs:')
  sampleLogs?.forEach(log => {
    console.log(`  Player ${log.player_id}, Game ${log.game_id}, Date: ${log.game_date}`)
    console.log(`    Stats keys: ${Object.keys(log.stats || {}).slice(0, 5).join(', ')}`)
  })
}

debugConstraintIssues().catch(console.error)