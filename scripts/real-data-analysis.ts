#!/usr/bin/env tsx
/**
 * REAL DATA ANALYSIS
 * Analyze our actual data structure and find meaningful patterns
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function realDataAnalysis() {
  console.log(chalk.bold.red('📊 REAL DATA ANALYSIS - NO MORE FLUFF!\n'))
  
  // Get a large sample to work with
  const { data: allStats } = await supabase
    .from('player_game_logs')
    .select('player_id, stats, is_home, team_id, opponent_id, game_date')
    .not('stats', 'is', null)
    .limit(50000)
    
  console.log(chalk.cyan(`🔍 Analyzing ${allStats?.length || 0} player performances...\n`))
  
  if (!allStats) return
  
  // 1. DATA QUALITY CHECK
  console.log(chalk.yellow('🔍 DATA QUALITY ANALYSIS:'))
  
  let validStats = 0
  let zeroStats = 0
  let hasFantasyPoints = 0
  let hasBasketballStats = 0
  let hasFootballStats = 0
  let hasHomeAwayInfo = 0
  
  const statTypes = new Set<string>()
  
  allStats.forEach(game => {
    const stats = game.stats
    const keys = Object.keys(stats)
    
    keys.forEach(key => statTypes.add(key))
    
    // Check for meaningful data
    const points = parseInt(stats.points) || 0
    const fantasyPoints = parseFloat(stats.fantasy_points) || 0
    
    if (points > 0 || fantasyPoints > 0) validStats++
    if (points === 0 && fantasyPoints === 0) zeroStats++
    if (fantasyPoints > 0) hasFantasyPoints++
    if (stats.points !== undefined || stats.rebounds !== undefined) hasBasketballStats++
    if (stats.rushing_yards !== undefined || stats.passing_yards !== undefined) hasFootballStats++
    if (game.is_home !== null) hasHomeAwayInfo++
  })
  
  console.log(`  📈 Total games: ${allStats.length}`)
  console.log(`  ✅ Valid performances: ${validStats} (${(validStats/allStats.length*100).toFixed(1)}%)`)
  console.log(`  ❌ Zero stat games: ${zeroStats} (${(zeroStats/allStats.length*100).toFixed(1)}%)`)
  console.log(`  🏀 Basketball stats: ${hasBasketballStats}`)
  console.log(`  🏈 Football stats: ${hasFootballStats}`)
  console.log(`  🎯 Fantasy points: ${hasFantasyPoints}`)
  console.log(`  🏠 Home/Away info: ${hasHomeAwayInfo}`)
  console.log(`  📊 Unique stat types: ${statTypes.size}`)
  
  // 2. FANTASY POINTS ANALYSIS (Most reliable metric)
  console.log(chalk.yellow('\n💰 FANTASY POINTS ANALYSIS:'))
  
  const fantasyPerformances = allStats
    .filter(g => parseFloat(g.stats.fantasy_points) > 0)
    .map(g => ({
      player_id: g.player_id,
      fantasy_points: parseFloat(g.stats.fantasy_points),
      is_home: g.is_home,
      stats: g.stats
    }))
    
  console.log(`  📊 Games with fantasy points: ${fantasyPerformances.length}`)
  
  if (fantasyPerformances.length > 0) {
    // Home vs Away fantasy performance
    const homeFantasy = fantasyPerformances.filter(p => p.is_home === true)
    const awayFantasy = fantasyPerformances.filter(p => p.is_home === false)
    
    if (homeFantasy.length > 0 && awayFantasy.length > 0) {
      const homeAvg = homeFantasy.reduce((sum, p) => sum + p.fantasy_points, 0) / homeFantasy.length
      const awayAvg = awayFantasy.reduce((sum, p) => sum + p.fantasy_points, 0) / awayFantasy.length
      
      console.log(`  🏠 Home average: ${homeAvg.toFixed(2)} fantasy points (${homeFantasy.length} games)`)
      console.log(`  ✈️  Away average: ${awayAvg.toFixed(2)} fantasy points (${awayFantasy.length} games)`)
      console.log(`  📈 Home advantage: ${((homeAvg - awayAvg) / awayAvg * 100).toFixed(1)}%`)
    }
    
    // Top fantasy performers
    const playerFantasyTotals = new Map<number, {total: number, games: number, avg: number}>()
    
    fantasyPerformances.forEach(p => {
      if (!playerFantasyTotals.has(p.player_id)) {
        playerFantasyTotals.set(p.player_id, {total: 0, games: 0, avg: 0})
      }
      const player = playerFantasyTotals.get(p.player_id)!
      player.total += p.fantasy_points
      player.games++
      player.avg = player.total / player.games
    })
    
    const topFantasyPlayers = Array.from(playerFantasyTotals.entries())
      .filter(([_, stats]) => stats.games >= 3) // At least 3 games
      .sort(([_, a], [__, b]) => b.avg - a.avg)
      .slice(0, 10)
      
    console.log(`\n  🏆 TOP FANTASY PERFORMERS (3+ games):`)
    topFantasyPlayers.forEach(([playerId, stats], i) => {
      console.log(`    ${i+1}. Player ${playerId}: ${stats.avg.toFixed(1)} avg (${stats.games} games)`)
    })
  }
  
  // 3. BASKETBALL SPECIFIC ANALYSIS
  const basketballGames = allStats.filter(g => 
    g.stats.points !== undefined && 
    (parseInt(g.stats.points) > 0 || parseInt(g.stats.rebounds) > 0 || parseInt(g.stats.assists) > 0)
  )
  
  if (basketballGames.length > 0) {
    console.log(chalk.yellow(`\n🏀 BASKETBALL ANALYSIS (${basketballGames.length} games):`))
    
    const playerStats = new Map<number, {points: number[], rebounds: number[], assists: number[], games: number}>()
    
    basketballGames.forEach(g => {
      const playerId = g.player_id
      const points = parseInt(g.stats.points) || 0
      const rebounds = parseInt(g.stats.rebounds) || 0
      const assists = parseInt(g.stats.assists) || 0
      
      if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {points: [], rebounds: [], assists: [], games: 0})
      }
      
      const player = playerStats.get(playerId)!
      player.points.push(points)
      player.rebounds.push(rebounds)
      player.assists.push(assists)
      player.games++
    })
    
    const topScorers = Array.from(playerStats.entries())
      .filter(([_, stats]) => stats.games >= 2)
      .map(([id, stats]) => ({
        id,
        avgPoints: stats.points.reduce((a,b) => a+b, 0) / stats.points.length,
        avgRebounds: stats.rebounds.reduce((a,b) => a+b, 0) / stats.rebounds.length,
        avgAssists: stats.assists.reduce((a,b) => a+b, 0) / stats.assists.length,
        games: stats.games
      }))
      .sort((a, b) => b.avgPoints - a.avgPoints)
      .slice(0, 5)
      
    console.log(`  🏆 TOP BASKETBALL SCORERS:`)
    topScorers.forEach((player, i) => {
      console.log(`    ${i+1}. Player ${player.id}: ${player.avgPoints.toFixed(1)} pts, ${player.avgRebounds.toFixed(1)} reb, ${player.avgAssists.toFixed(1)} ast (${player.games} games)`)
    })
  }
  
  // 4. STAT DISTRIBUTION ANALYSIS
  console.log(chalk.yellow('\n📊 STAT DISTRIBUTION:'))
  
  const commonStats = ['points', 'fantasy_points', 'rebounds', 'assists', 'rushing_yards', 'passing_yards']
  
  commonStats.forEach(statName => {
    const values = allStats
      .map(g => parseFloat(g.stats[statName]) || parseInt(g.stats[statName]) || 0)
      .filter(v => v > 0)
      
    if (values.length > 0) {
      const avg = values.reduce((a,b) => a+b, 0) / values.length
      const max = Math.max(...values)
      const min = Math.min(...values)
      
      console.log(`  ${statName}: ${values.length} non-zero values, avg: ${avg.toFixed(1)}, range: ${min}-${max}`)
    }
  })
  
  // 5. ACTIONABLE INSIGHTS
  console.log(chalk.bold.yellow('\n🎯 ACTIONABLE FINDINGS:'))
  
  if (validStats > allStats.length * 0.1) {
    console.log(chalk.green(`✅ USABLE DATASET: ${validStats} meaningful performances`))
  }
  
  if (fantasyPerformances.length > 100) {
    const avgFantasy = fantasyPerformances.reduce((sum, p) => sum + p.fantasy_points, 0) / fantasyPerformances.length
    console.log(chalk.green(`✅ FANTASY EDGE: ${fantasyPerformances.length} games, ${avgFantasy.toFixed(1)} avg points`))
  }
  
  if (topFantasyPlayers.length > 0) {
    const [topPlayerId, topStats] = topFantasyPlayers[0]
    console.log(chalk.green(`✅ ELITE TARGET: Player ${topPlayerId} averaging ${topStats.avg.toFixed(1)} fantasy points`))
  }
  
  if (basketballGames.length > 50) {
    console.log(chalk.green(`✅ BASKETBALL DATA: ${basketballGames.length} games ready for prop analysis`))
  }
  
  console.log(chalk.bold.cyan('\n🚀 NEXT STEPS:'))
  console.log('1. Build fantasy point prediction models')
  console.log('2. Create player prop bet recommendations') 
  console.log('3. Identify value plays in DFS')
  console.log('4. Track hot/cold streaks')
}

// Run the real analysis
realDataAnalysis().catch(console.error)