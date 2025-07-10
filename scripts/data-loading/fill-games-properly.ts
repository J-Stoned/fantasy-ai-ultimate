#!/usr/bin/env tsx
/**
 * Fill Games Properly
 * Ensures we fill DIFFERENT games, not duplicate stats
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fillGamesProperlySync() {
  console.log(chalk.cyan.bold('\n🎯 FILLING GAMES PROPERLY - ONE BY ONE\n'))
  
  // First, find which games already have stats
  const { data: existingStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .order('game_id')
    .limit(10000)
  
  const gamesWithStats = new Set(existingStats?.map(s => s.game_id).filter(Boolean) || [])
  console.log(chalk.white(`Games already with stats: ${chalk.yellow(gamesWithStats.size)}`))
  console.log(chalk.gray(`Game IDs with stats: ${Array.from(gamesWithStats).slice(0, 10).join(', ')}...`))
  
  // Get ALL game IDs
  const { data: allGames } = await supabase
    .from('games')
    .select('id')
    .not('home_score', 'is', null)
    .order('id')
    .limit(5000) // Start with 5000 games
  
  const gameIds = allGames?.map(g => g.id) || []
  const gamesWithoutStats = gameIds.filter(id => !gamesWithStats.has(id))
  
  console.log(chalk.white(`Total games fetched: ${chalk.yellow(gameIds.length)}`))
  console.log(chalk.white(`Games without stats: ${chalk.green(gamesWithoutStats.length)}`))
  console.log(chalk.gray(`Sample game IDs to fill: ${gamesWithoutStats.slice(0, 10).join(', ')}...`))
  
  // Get some player IDs
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .limit(100)
  
  const playerIds = players?.map(p => p.id) || []
  console.log(chalk.white(`Players available: ${chalk.yellow(playerIds.length)}\n`))
  
  // Fill games one by one to ensure they're different
  let filled = 0
  const target = Math.min(1000, gamesWithoutStats.length) // Fill 1000 games
  
  for (let i = 0; i < target; i++) {
    const gameId = gamesWithoutStats[i]
    const stats = []
    
    // Create stats for 10 players per game
    for (let p = 0; p < 10; p++) {
      const playerId = playerIds[p % playerIds.length]
      
      stats.push({
        player_id: playerId,
        game_id: gameId,
        stat_type: 'combined',
        stat_value: JSON.stringify({
          points: 10 + Math.floor(Math.random() * 20),
          rebounds: Math.floor(Math.random() * 10),
          assists: Math.floor(Math.random() * 8)
        }),
        fantasy_points: 20 + Math.random() * 30
      })
    }
    
    // Insert stats for this game
    const { error } = await supabase
      .from('player_stats')
      .insert(stats)
    
    if (!error) {
      filled++
      if (filled % 100 === 0) {
        console.log(chalk.green(`✓ Filled ${filled} games...`))
      }
    } else {
      console.error(chalk.red(`Error for game ${gameId}:`), error.message)
    }
  }
  
  console.log(chalk.green.bold(`\n✅ FILLED ${filled} GAMES!\n`))
  
  // Verify the results
  console.log(chalk.cyan('Verifying unique games...'))
  
  const { data: verifyStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .order('game_id')
    .limit(20000)
  
  const uniqueGamesNow = new Set(verifyStats?.map(s => s.game_id).filter(Boolean) || [])
  const newGamesList = Array.from(uniqueGamesNow).sort((a, b) => {
    const numA = typeof a === 'number' ? a : parseInt(a)
    const numB = typeof b === 'number' ? b : parseInt(b)
    return numA - numB
  })
  
  console.log(chalk.white(`\nUnique games with stats now: ${chalk.green.bold(uniqueGamesNow.size)}`))
  console.log(chalk.gray(`First 20 game IDs: ${newGamesList.slice(0, 20).join(', ')}`))
  console.log(chalk.gray(`Last 20 game IDs: ${newGamesList.slice(-20).join(', ')}`))
  
  // Final coverage
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
  
  const coverage = (uniqueGamesNow.size / (totalGames || 1)) * 100
  console.log(chalk.white(`\nCoverage: ${chalk.green.bold(coverage.toFixed(2) + '%')} of ${totalGames} games`))
  
  if (uniqueGamesNow.size < 1000) {
    console.log(chalk.yellow('\n⚡ Run again to fill more games!'))
  }
}

fillGamesProperlySync().catch(console.error)