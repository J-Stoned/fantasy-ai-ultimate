#!/usr/bin/env tsx
/**
 * DEEP DIVE PLAYER ANALYSIS
 * Actually analyze the data, not just talk about it!
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deepDiveAnalysis() {
  console.log(chalk.bold.red('🔍 DEEP DIVE: ACTUAL DATA ANALYSIS\n'))
  
  // Get a substantial sample of our player stats
  const { data: playerStats } = await supabase
    .from('player_game_logs')
    .select('player_id, game_id, team_id, opponent_id, is_home, stats, game_date')
    .not('stats', 'is', null)
    .limit(5000)
    
  console.log(chalk.cyan(`📊 Analyzing ${playerStats?.length || 0} player performances...\n`))
  
  if (!playerStats || playerStats.length === 0) {
    console.log(chalk.red('❌ No player stats found!'))
    return
  }
  
  // 1. ACTUAL HOME/AWAY ANALYSIS
  console.log(chalk.yellow('🏠 HOME VS AWAY PERFORMANCE BREAKDOWN:'))
  
  const homePerformances: number[] = []
  const awayPerformances: number[] = []
  const homeAssists: number[] = []
  const awayAssists: number[] = []
  const homeRebounds: number[] = []
  const awayRebounds: number[] = []
  
  playerStats.forEach(game => {
    const points = getStatValue(game.stats, ['points', 'rushing_touchdowns', 'passing_touchdowns'])
    const assists = getStatValue(game.stats, ['assists'])
    const rebounds = getStatValue(game.stats, ['rebounds', 'rushing_yards'])
    
    if (game.is_home === true) {
      if (points > 0) homePerformances.push(points)
      if (assists >= 0) homeAssists.push(assists)
      if (rebounds >= 0) homeRebounds.push(rebounds)
    } else if (game.is_home === false) {
      if (points > 0) awayPerformances.push(points)
      if (assists >= 0) awayAssists.push(assists)
      if (rebounds >= 0) awayRebounds.push(rebounds)
    }
  })
  
  const homeAvgPoints = homePerformances.reduce((a,b) => a+b, 0) / homePerformances.length
  const awayAvgPoints = awayPerformances.reduce((a,b) => a+b, 0) / awayPerformances.length
  const homeAvgAssists = homeAssists.reduce((a,b) => a+b, 0) / homeAssists.length
  const awayAvgAssists = awayAssists.reduce((a,b) => a+b, 0) / awayAssists.length
  
  console.log(`  📈 POINTS:`)
  console.log(`    Home: ${homeAvgPoints.toFixed(2)} avg (${homePerformances.length} games)`)
  console.log(`    Away: ${awayAvgPoints.toFixed(2)} avg (${awayPerformances.length} games)`)
  console.log(`    Difference: ${((homeAvgPoints - awayAvgPoints) / awayAvgPoints * 100).toFixed(1)}%`)
  
  console.log(`  🎯 ASSISTS:`)
  console.log(`    Home: ${homeAvgAssists.toFixed(2)} avg`)
  console.log(`    Away: ${awayAvgAssists.toFixed(2)} avg`)
  console.log(`    Difference: ${((homeAvgAssists - awayAvgAssists) / Math.max(awayAvgAssists, 0.1) * 100).toFixed(1)}%`)
  
  // 2. TOP PERFORMERS ANALYSIS
  console.log(chalk.yellow('\n⭐ TOP PERFORMERS ANALYSIS:'))
  
  const playerPerformances = new Map<number, {points: number[], assists: number[], games: number}>()
  
  playerStats.forEach(game => {
    const playerId = game.player_id
    const points = getStatValue(game.stats, ['points', 'rushing_touchdowns', 'passing_touchdowns'])
    const assists = getStatValue(game.stats, ['assists'])
    
    if (!playerPerformances.has(playerId)) {
      playerPerformances.set(playerId, {points: [], assists: [], games: 0})
    }
    
    const player = playerPerformances.get(playerId)!
    if (points > 0) player.points.push(points)
    if (assists >= 0) player.assists.push(assists)
    player.games++
  })
  
  // Find consistent high performers
  const topPerformers: Array<{id: number, avgPoints: number, avgAssists: number, games: number, consistency: number}> = []
  
  playerPerformances.forEach((stats, playerId) => {
    if (stats.games >= 3 && stats.points.length >= 3) {
      const avgPoints = stats.points.reduce((a,b) => a+b, 0) / stats.points.length
      const avgAssists = stats.assists.reduce((a,b) => a+b, 0) / Math.max(stats.assists.length, 1)
      
      // Calculate consistency (lower standard deviation = more consistent)
      const pointsVariance = calculateVariance(stats.points)
      const consistency = 1 / (1 + pointsVariance) // Higher is more consistent
      
      if (avgPoints > 5) { // Filter for meaningful performers
        topPerformers.push({
          id: playerId,
          avgPoints,
          avgAssists,
          games: stats.games,
          consistency
        })
      }
    }
  })
  
  // Sort by average points
  topPerformers.sort((a, b) => b.avgPoints - a.avgPoints)
  
  console.log(`  📊 Found ${topPerformers.length} players with 3+ games`)
  console.log(`  🏆 Top 10 Scorers:`)
  
  topPerformers.slice(0, 10).forEach((player, i) => {
    console.log(`    ${i+1}. Player ${player.id}: ${player.avgPoints.toFixed(1)} pts, ${player.avgAssists.toFixed(1)} ast (${player.games} games, consistency: ${(player.consistency * 100).toFixed(0)}%)`)
  })
  
  // 3. CONSISTENCY ANALYSIS
  console.log(chalk.yellow('\n📈 CONSISTENCY PATTERNS:'))
  
  const consistentPerformers = topPerformers
    .filter(p => p.games >= 5)
    .sort((a, b) => b.consistency - a.consistency)
    .slice(0, 5)
  
  console.log(`  🎯 Most Consistent Players (5+ games):`)
  consistentPerformers.forEach((player, i) => {
    console.log(`    ${i+1}. Player ${player.id}: ${player.avgPoints.toFixed(1)} pts (${(player.consistency * 100).toFixed(0)}% consistency)`)
  })
  
  // 4. GAME-TO-GAME TRENDS
  console.log(chalk.yellow('\n📅 RECENT FORM ANALYSIS:'))
  
  // Group by player and look at recent games
  const recentForm = new Map<number, number[]>()
  
  // Sort player stats by date to see trends
  const sortedStats = playerStats
    .filter(g => g.game_date)
    .sort((a, b) => new Date(b.game_date!).getTime() - new Date(a.game_date!).getTime())
  
  sortedStats.slice(0, 1000).forEach(game => {
    const playerId = game.player_id
    const points = getStatValue(game.stats, ['points', 'rushing_touchdowns', 'passing_touchdowns'])
    
    if (points > 0) {
      if (!recentForm.has(playerId)) {
        recentForm.set(playerId, [])
      }
      recentForm.get(playerId)!.push(points)
    }
  })
  
  const trendingPlayers: Array<{id: number, trend: number, recentAvg: number, games: number}> = []
  
  recentForm.forEach((games, playerId) => {
    if (games.length >= 3) {
      const recentGames = games.slice(0, 3) // Last 3 games
      const olderGames = games.slice(3, 6)  // Previous 3 games
      
      if (olderGames.length >= 2) {
        const recentAvg = recentGames.reduce((a,b) => a+b, 0) / recentGames.length
        const olderAvg = olderGames.reduce((a,b) => a+b, 0) / olderGames.length
        const trend = (recentAvg - olderAvg) / olderAvg * 100
        
        trendingPlayers.push({
          id: playerId,
          trend,
          recentAvg,
          games: games.length
        })
      }
    }
  })
  
  // Hot and cold players
  const hotPlayers = trendingPlayers.filter(p => p.trend > 20).sort((a, b) => b.trend - a.trend).slice(0, 5)
  const coldPlayers = trendingPlayers.filter(p => p.trend < -20).sort((a, b) => a.trend - b.trend).slice(0, 5)
  
  console.log(`  🔥 HOT PLAYERS (trending up 20%+):`)
  hotPlayers.forEach((player, i) => {
    console.log(`    ${i+1}. Player ${player.id}: +${player.trend.toFixed(1)}% (${player.recentAvg.toFixed(1)} recent avg)`)
  })
  
  console.log(`  🧊 COLD PLAYERS (trending down 20%+):`)
  coldPlayers.forEach((player, i) => {
    console.log(`    ${i+1}. Player ${player.id}: ${player.trend.toFixed(1)}% (${player.recentAvg.toFixed(1)} recent avg)`)
  })
  
  // 5. SUMMARY INSIGHTS
  console.log(chalk.bold.yellow('\n🎯 ACTIONABLE INSIGHTS:'))
  
  console.log(`📊 Dataset: ${playerStats.length} performances analyzed`)
  console.log(`🏠 Home Advantage: ${((homeAvgPoints - awayAvgPoints) / awayAvgPoints * 100).toFixed(1)}% scoring boost`)
  console.log(`⭐ Elite Tier: ${topPerformers.filter(p => p.avgPoints > 20).length} players averaging 20+ points`)
  console.log(`📈 Consistent: ${consistentPerformers.length} players with 80%+ consistency`)
  console.log(`🔥 Hot Streaks: ${hotPlayers.length} players trending up 20%+`)
  console.log(`🧊 Cold Streaks: ${coldPlayers.length} players trending down 20%+`)
  
  if (homeAvgPoints > awayAvgPoints) {
    console.log(chalk.green('\n✅ HOME BETTING EDGE: Target home players in prop bets'))
  }
  
  if (topPerformers.length > 0) {
    console.log(chalk.green(`✅ ELITE TARGETS: Player ${topPerformers[0].id} averaging ${topPerformers[0].avgPoints.toFixed(1)} points`))
  }
  
  if (hotPlayers.length > 0) {
    console.log(chalk.green(`✅ HOT STREAK: Player ${hotPlayers[0].id} trending +${hotPlayers[0].trend.toFixed(1)}%`))
  }
}

function getStatValue(stats: any, keys: string[]): number {
  for (const key of keys) {
    if (stats[key] !== undefined && stats[key] !== null) {
      const value = parseInt(stats[key]) || parseFloat(stats[key]) || 0
      if (!isNaN(value)) return value
    }
  }
  return 0
}

function calculateVariance(numbers: number[]): number {
  const avg = numbers.reduce((a,b) => a+b, 0) / numbers.length
  const variance = numbers.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / numbers.length
  return Math.sqrt(variance) // Standard deviation
}

// Run the deep dive
deepDiveAnalysis().catch(console.error)