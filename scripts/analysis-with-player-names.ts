#!/usr/bin/env tsx
/**
 * ANALYSIS WITH ACTUAL PLAYER NAMES
 * No more "Player 754" - let's see who these performers actually are!
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function analysisWithNames() {
  console.log(chalk.bold.red('🏀 PLAYER ANALYSIS WITH ACTUAL NAMES\n'))
  
  // Get player stats WITH player names
  const { data: playerStats } = await supabase
    .from('player_game_logs')
    .select(`
      player_id,
      stats,
      is_home,
      team_id,
      game_date,
      players!inner(name, sport)
    `)
    .not('stats', 'is', null)
    .limit(5000)
    
  console.log(chalk.cyan(`📊 Analyzing ${playerStats?.length || 0} performances with player names...\n`))
  
  if (!playerStats || playerStats.length === 0) {
    console.log(chalk.red('❌ No player stats with names found!'))
    return
  }
  
  // Filter for meaningful performances (has fantasy points or actual stats)
  const meaningfulStats = playerStats.filter(game => {
    const fantasyPoints = parseFloat(game.stats.fantasy_points) || 0
    const points = parseInt(game.stats.points) || 0
    const rushingYards = parseInt(game.stats.rushing_yards) || 0
    const passingYards = parseInt(game.stats.passing_yards) || 0
    
    return fantasyPoints > 0 || points > 0 || rushingYards > 0 || passingYards > 0
  })
  
  console.log(chalk.yellow(`🔍 Found ${meaningfulStats.length} meaningful performances\n`))
  
  // 1. TOP FANTASY PERFORMERS BY NAME
  console.log(chalk.yellow('💰 TOP FANTASY PERFORMERS:'))
  
  const playerFantasyStats = new Map<string, {
    name: string,
    sport: string,
    totalFantasy: number,
    games: number,
    avgFantasy: number,
    performances: number[]
  }>()
  
  meaningfulStats.forEach(game => {
    const playerName = game.players?.name || 'Unknown Player'
    const sport = game.players?.sport || 'Unknown'
    const fantasyPoints = parseFloat(game.stats.fantasy_points) || 0
    
    if (fantasyPoints > 0) {
      if (!playerFantasyStats.has(playerName)) {
        playerFantasyStats.set(playerName, {
          name: playerName,
          sport: sport,
          totalFantasy: 0,
          games: 0,
          avgFantasy: 0,
          performances: []
        })
      }
      
      const playerData = playerFantasyStats.get(playerName)!
      playerData.totalFantasy += fantasyPoints
      playerData.games++
      playerData.avgFantasy = playerData.totalFantasy / playerData.games
      playerData.performances.push(fantasyPoints)
    }
  })
  
  const topFantasyPlayers = Array.from(playerFantasyStats.values())
    .filter(p => p.games >= 2) // At least 2 games
    .sort((a, b) => b.avgFantasy - a.avgFantasy)
    .slice(0, 10)
  
  topFantasyPlayers.forEach((player, i) => {
    const consistency = calculateConsistency(player.performances)
    console.log(`  ${i+1}. ${chalk.bold(player.name)} (${player.sport}): ${player.avgFantasy.toFixed(1)} avg fantasy pts (${player.games} games, ${consistency}% consistent)`)
  })
  
  // 2. HOME VS AWAY BY ACTUAL PLAYERS
  console.log(chalk.yellow('\n🏠 HOME VS AWAY PERFORMANCE:'))
  
  const homeAwayStats = new Map<string, {
    name: string,
    homeGames: number[],
    awayGames: number[],
    homeAvg: number,
    awayAvg: number
  }>()
  
  meaningfulStats.forEach(game => {
    const playerName = game.players?.name || 'Unknown Player'
    const fantasyPoints = parseFloat(game.stats.fantasy_points) || 0
    
    if (fantasyPoints > 0 && game.is_home !== null) {
      if (!homeAwayStats.has(playerName)) {
        homeAwayStats.set(playerName, {
          name: playerName,
          homeGames: [],
          awayGames: [],
          homeAvg: 0,
          awayAvg: 0
        })
      }
      
      const playerData = homeAwayStats.get(playerName)!
      if (game.is_home) {
        playerData.homeGames.push(fantasyPoints)
      } else {
        playerData.awayGames.push(fantasyPoints)
      }
    }
  })
  
  // Calculate averages and find players with significant home/away differences
  const homeAwayDifferences: Array<{
    name: string,
    homeAvg: number,
    awayAvg: number,
    difference: number,
    totalGames: number
  }> = []
  
  homeAwayStats.forEach((data, name) => {
    if (data.homeGames.length >= 1 && data.awayGames.length >= 1) {
      data.homeAvg = data.homeGames.reduce((a,b) => a+b, 0) / data.homeGames.length
      data.awayAvg = data.awayGames.reduce((a,b) => a+b, 0) / data.awayGames.length
      
      const difference = ((data.homeAvg - data.awayAvg) / data.awayAvg) * 100
      
      homeAwayDifferences.push({
        name,
        homeAvg: data.homeAvg,
        awayAvg: data.awayAvg,
        difference,
        totalGames: data.homeGames.length + data.awayGames.length
      })
    }
  })
  
  const significantHomeAdvantage = homeAwayDifferences
    .filter(p => p.totalGames >= 3)
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 5)
  
  console.log(`  🏆 BIGGEST HOME FIELD ADVANTAGES:`)
  significantHomeAdvantage.forEach((player, i) => {
    console.log(`    ${i+1}. ${chalk.bold(player.name)}: ${player.homeAvg.toFixed(1)} home vs ${player.awayAvg.toFixed(1)} away (${player.difference.toFixed(1)}% boost)`)
  })
  
  // 3. RECENT HOT STREAKS BY NAME
  console.log(chalk.yellow('\n🔥 RECENT HOT PERFORMERS:'))
  
  // Sort by date to find recent trends
  const recentGames = meaningfulStats
    .filter(g => g.game_date && parseFloat(g.stats.fantasy_points) > 0)
    .sort((a, b) => new Date(b.game_date!).getTime() - new Date(a.game_date!).getTime())
    .slice(0, 1000) // Recent 1000 games
  
  const recentPlayerStats = new Map<string, number[]>()
  
  recentGames.forEach(game => {
    const playerName = game.players?.name || 'Unknown Player'
    const fantasyPoints = parseFloat(game.stats.fantasy_points) || 0
    
    if (!recentPlayerStats.has(playerName)) {
      recentPlayerStats.set(playerName, [])
    }
    recentPlayerStats.get(playerName)!.push(fantasyPoints)
  })
  
  const hotStreaks: Array<{name: string, recentAvg: number, games: number}> = []
  
  recentPlayerStats.forEach((games, name) => {
    if (games.length >= 2) {
      const recentAvg = games.slice(0, 3).reduce((a,b) => a+b, 0) / Math.min(games.length, 3)
      if (recentAvg >= 20) { // High performers
        hotStreaks.push({name, recentAvg, games: games.length})
      }
    }
  })
  
  hotStreaks.sort((a, b) => b.recentAvg - a.recentAvg).slice(0, 5).forEach((player, i) => {
    console.log(`    ${i+1}. ${chalk.bold(player.name)}: ${player.recentAvg.toFixed(1)} recent avg (${player.games} total games)`)
  })
  
  // 4. SPORT-SPECIFIC ANALYSIS
  console.log(chalk.yellow('\n⚽ SPORT BREAKDOWN:'))
  
  const sportStats = new Map<string, {players: Set<string>, games: number, avgFantasy: number}>()
  
  meaningfulStats.forEach(game => {
    const sport = game.players?.sport || 'Unknown'
    const playerName = game.players?.name || 'Unknown Player'
    const fantasyPoints = parseFloat(game.stats.fantasy_points) || 0
    
    if (!sportStats.has(sport)) {
      sportStats.set(sport, {players: new Set(), games: 0, avgFantasy: 0})
    }
    
    const sportData = sportStats.get(sport)!
    sportData.players.add(playerName)
    sportData.games++
    sportData.avgFantasy = (sportData.avgFantasy * (sportData.games - 1) + fantasyPoints) / sportData.games
  })
  
  Array.from(sportStats.entries()).forEach(([sport, data]) => {
    console.log(`  ${sport}: ${data.players.size} players, ${data.games} games, ${data.avgFantasy.toFixed(1)} avg fantasy pts`)
  })
  
  // 5. ACTIONABLE INSIGHTS
  console.log(chalk.bold.yellow('\n🎯 ACTIONABLE BETTING INSIGHTS:'))
  
  if (topFantasyPlayers.length > 0) {
    const topPlayer = topFantasyPlayers[0]
    console.log(chalk.green(`✅ ELITE TARGET: ${topPlayer.name} averaging ${topPlayer.avgFantasy.toFixed(1)} fantasy points`))
  }
  
  if (significantHomeAdvantage.length > 0) {
    const homePlayer = significantHomeAdvantage[0]
    console.log(chalk.green(`✅ HOME EDGE: ${homePlayer.name} performs ${homePlayer.difference.toFixed(1)}% better at home`))
  }
  
  if (hotStreaks.length > 0) {
    const hotPlayer = hotStreaks[0]
    console.log(chalk.green(`✅ HOT STREAK: ${hotPlayer.name} averaging ${hotPlayer.recentAvg.toFixed(1)} in recent games`))
  }
  
  console.log(chalk.bold.cyan('\n📋 BETTING RECOMMENDATIONS:'))
  console.log('1. Target home players in prop bets (significant home advantage found)')
  console.log('2. Focus on consistent high performers for DFS')
  console.log('3. Ride hot streaks while they last')
  console.log('4. Fade away games for home-dependent players')
}

function calculateConsistency(performances: number[]): number {
  if (performances.length < 2) return 0
  
  const avg = performances.reduce((a,b) => a+b, 0) / performances.length
  const variance = performances.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / performances.length
  const stdDev = Math.sqrt(variance)
  
  // Consistency = 100 - (coefficient of variation * 100)
  const coefficientOfVariation = stdDev / avg
  return Math.max(0, 100 - (coefficientOfVariation * 100))
}

// Run the analysis
analysisWithNames().catch(console.error)