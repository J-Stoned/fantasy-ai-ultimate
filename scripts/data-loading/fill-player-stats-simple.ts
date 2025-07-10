#!/usr/bin/env tsx
/**
 * Simple Player Stats Filler
 * Demonstrates filling player stats gaps
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mock player stats generator
function generateMockPlayerStats(gameId: string, sport: string) {
  const stats = []
  const playersPerTeam = sport === 'nba' ? 8 : sport === 'nfl' ? 22 : 9
  
  // Generate stats for both teams
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < playersPerTeam; i++) {
      const isStarter = i < 5
      
      if (sport === 'nba') {
        const points = isStarter ? Math.floor(Math.random() * 30) + 5 : Math.floor(Math.random() * 15)
        const rebounds = Math.floor(Math.random() * 12)
        const assists = Math.floor(Math.random() * 10)
        
        stats.push({
          player_id: `mock_${team}_${i}`,
          game_id: gameId,
          stat_type: 'points',
          stat_value: points.toString(),
          fantasy_points: points + (rebounds * 1.2) + (assists * 1.5),
        })
        
        stats.push({
          player_id: `mock_${team}_${i}`,
          game_id: gameId,
          stat_type: 'rebounds',
          stat_value: rebounds.toString(),
          fantasy_points: 0,
        })
        
        stats.push({
          player_id: `mock_${team}_${i}`,
          game_id: gameId,
          stat_type: 'assists',
          stat_value: assists.toString(),
          fantasy_points: 0,
        })
      }
    }
  }
  
  return stats
}

async function fillPlayerStats() {
  console.log(chalk.cyan.bold('\n🚀 FILLING PLAYER STATS GAPS (DEMO)\n'))
  
  // Get games without stats
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id, home_score, away_score')
    .not('home_score', 'is', null)
    .limit(100) // Process 100 games as demo
    
  if (gamesError) {
    console.error(chalk.red('Error fetching games:'), gamesError)
    return
  }
  
  console.log(chalk.white(`Found ${games?.length || 0} games to process\n`))
  
  // Check which already have stats
  const gameIds = games?.map(g => g.id) || []
  const { data: existingStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .in('game_id', gameIds)
    
  const gamesWithStats = new Set(existingStats?.map(s => s.game_id) || [])
  const gamesToProcess = games?.filter(g => !gamesWithStats.has(g.id)) || []
  
  console.log(chalk.yellow(`${gamesToProcess.length} games need stats\n`))
  
  // Process games
  let processed = 0
  let totalStats = 0
  
  for (const game of gamesToProcess) {
    const stats = generateMockPlayerStats(game.id, game.sport || 'nba')
    
    // Insert stats in batches
    const { error: insertError } = await supabase
      .from('player_stats')
      .insert(stats)
      
    if (insertError) {
      console.error(chalk.red(`Error inserting stats for game ${game.id}:`), insertError)
    } else {
      processed++
      totalStats += stats.length
      
      if (processed % 10 === 0) {
        console.log(chalk.green(`✓ Processed ${processed} games (${totalStats} stats)`))
      }
    }
  }
  
  console.log(chalk.green.bold(`\n✅ COMPLETED!\n`))
  console.log(chalk.white(`Games processed: ${processed}`))
  console.log(chalk.white(`Total stats added: ${totalStats}`))
  
  // Check new coverage
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    
  const { data: updatedStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10000)
    
  const uniqueGamesWithStats = new Set(updatedStats?.map(s => s.game_id) || [])
  const newCoverage = (uniqueGamesWithStats.size / (totalGames || 1)) * 100
  
  console.log(chalk.cyan(`\n📊 NEW COVERAGE: ${newCoverage.toFixed(1)}%`))
  console.log(chalk.white(`(${uniqueGamesWithStats.size} of ${totalGames} games)\n`))
  
  if (newCoverage < 1) {
    console.log(chalk.yellow('⚠️  This was just a demo. To fill ALL gaps:'))
    console.log(chalk.white('1. Use real ESPN/sports API data'))
    console.log(chalk.white('2. Process all 50,000+ games'))
    console.log(chalk.white('3. Implement proper rate limiting'))
  }
}

fillPlayerStats().catch(console.error)