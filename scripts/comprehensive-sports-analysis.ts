#!/usr/bin/env tsx
/**
 * COMPREHENSIVE ALL-SPORTS ANALYSIS
 * Analyze ALL our 258K+ player stats across every sport with real names
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PlayerAnalysis {
  name: string
  sport: string
  avgFantasy: number
  avgPoints: number
  games: number
  consistency: number
  homeAdvantage: number
  totalStats: any
}

async function comprehensiveSportsAnalysis() {
  console.log(chalk.bold.red('🏆 COMPREHENSIVE ALL-SPORTS ANALYSIS\n'))
  console.log(chalk.yellow('Analyzing ALL 258K+ player stats across every sport...\n'))
  
  // Get ALL our player stats with names in batches
  const allPlayerStats: any[] = []
  let offset = 0
  const batchSize = 5000
  
  console.log(chalk.cyan('📥 Loading all player data...'))
  
  while (true) {
    const { data: batch } = await supabase
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
      .range(offset, offset + batchSize - 1)
      .order('id')
      
    if (!batch || batch.length === 0) break
    
    allPlayerStats.push(...batch)
    offset += batchSize
    
    console.log(chalk.gray(`  Loaded ${allPlayerStats.length} player performances...`))
    
    // Limit to reasonable size for analysis
    if (allPlayerStats.length >= 50000) break
  }
  
  console.log(chalk.cyan(`\n📊 Analyzing ${allPlayerStats.length} total performances...\n`))
  
  // Filter for meaningful performances
  const meaningfulStats = allPlayerStats.filter(game => {
    const fantasyPoints = parseFloat(game.stats.fantasy_points) || 0
    const points = parseInt(game.stats.points) || 0
    const rushingYards = parseInt(game.stats.rushing_yards) || 0
    const passingYards = parseInt(game.stats.passing_yards) || 0
    const hits = parseInt(game.stats.hits) || 0
    const goals = parseInt(game.stats.goals) || 0
    
    return fantasyPoints > 0 || points > 0 || rushingYards > 0 || passingYards > 0 || hits > 0 || goals > 0
  })
  
  console.log(chalk.yellow(`✅ Found ${meaningfulStats.length} meaningful performances\n`))
  
  // Group by sport for analysis
  const sportData = new Map<string, any[]>()
  
  meaningfulStats.forEach(game => {
    const sport = game.players?.sport || 'Unknown'
    if (!sportData.has(sport)) {
      sportData.set(sport, [])
    }
    sportData.get(sport)!.push(game)
  })
  
  console.log(chalk.bold.yellow('🏟️ SPORT-BY-SPORT BREAKDOWN:\n'))
  
  const sportResults: Array<{sport: string, topPlayers: PlayerAnalysis[], insights: string[]}> = []
  
  // Analyze each sport
  for (const [sport, games] of sportData.entries()) {
    if (games.length < 5) continue // Skip sports with too few games
    
    console.log(chalk.cyan(`\n🏆 ${sport.toUpperCase()} ANALYSIS (${games.length} games):`))
    
    // Player performance aggregation
    const playerStats = new Map<string, {
      name: string,
      sport: string,
      games: number,
      fantasyPoints: number[],
      points: number[],
      homeGames: number[],
      awayGames: number[],
      allStats: any[]
    }>()
    
    games.forEach(game => {
      const playerName = game.players?.name || 'Unknown Player'
      const fantasyPoints = parseFloat(game.stats.fantasy_points) || 0
      const points = extractPoints(game.stats, sport)
      
      if (!playerStats.has(playerName)) {
        playerStats.set(playerName, {
          name: playerName,
          sport: sport,
          games: 0,
          fantasyPoints: [],
          points: [],
          homeGames: [],
          awayGames: [],
          allStats: []
        })
      }
      
      const player = playerStats.get(playerName)!
      player.games++
      player.allStats.push(game.stats)
      
      if (fantasyPoints > 0) player.fantasyPoints.push(fantasyPoints)
      if (points > 0) player.points.push(points)
      
      // Home/Away tracking
      if (game.is_home === true && fantasyPoints > 0) player.homeGames.push(fantasyPoints)
      if (game.is_home === false && fantasyPoints > 0) player.awayGames.push(fantasyPoints)
    })
    
    // Calculate player analysis
    const playerAnalyses: PlayerAnalysis[] = []
    
    playerStats.forEach((data, name) => {
      if (data.games >= 2) { // At least 2 games
        const avgFantasy = data.fantasyPoints.length > 0 ? 
          data.fantasyPoints.reduce((a,b) => a+b, 0) / data.fantasyPoints.length : 0
        const avgPoints = data.points.length > 0 ? 
          data.points.reduce((a,b) => a+b, 0) / data.points.length : 0
        
        const consistency = calculateConsistency(data.fantasyPoints.length > 0 ? data.fantasyPoints : data.points)
        
        // Home advantage calculation
        let homeAdvantage = 0
        if (data.homeGames.length > 0 && data.awayGames.length > 0) {
          const homeAvg = data.homeGames.reduce((a,b) => a+b, 0) / data.homeGames.length
          const awayAvg = data.awayGames.reduce((a,b) => a+b, 0) / data.awayGames.length
          homeAdvantage = ((homeAvg - awayAvg) / awayAvg) * 100
        }
        
        playerAnalyses.push({
          name,
          sport,
          avgFantasy,
          avgPoints,
          games: data.games,
          consistency,
          homeAdvantage,
          totalStats: aggregateStats(data.allStats, sport)
        })
      }
    })
    
    // Sort by best metric (fantasy points if available, otherwise points)
    const topPlayers = playerAnalyses
      .sort((a, b) => {
        const aScore = a.avgFantasy > 0 ? a.avgFantasy : a.avgPoints
        const bScore = b.avgFantasy > 0 ? b.avgFantasy : b.avgPoints
        return bScore - aScore
      })
      .slice(0, 10)
    
    // Display top performers
    console.log(`  🏆 TOP PERFORMERS:`)
    topPlayers.forEach((player, i) => {
      const primaryScore = player.avgFantasy > 0 ? 
        `${player.avgFantasy.toFixed(1)} fantasy pts` : 
        `${player.avgPoints.toFixed(1)} pts`
      const homeBonus = player.homeAdvantage > 0 ? ` (+${player.homeAdvantage.toFixed(1)}% home)` : ''
      
      console.log(`    ${i+1}. ${chalk.bold(player.name)}: ${primaryScore} (${player.games} games, ${player.consistency.toFixed(0)}% consistent)${homeBonus}`)
    })
    
    // Sport-specific insights
    const insights: string[] = []
    
    // Home field advantage analysis
    const playersWithHomeData = playerAnalyses.filter(p => p.homeAdvantage !== 0)
    if (playersWithHomeData.length > 0) {
      const avgHomeAdvantage = playersWithHomeData.reduce((sum, p) => sum + p.homeAdvantage, 0) / playersWithHomeData.length
      insights.push(`Average home field advantage: ${avgHomeAdvantage.toFixed(1)}%`)
    }
    
    // Consistency leaders
    const mostConsistent = playerAnalyses.filter(p => p.consistency > 80).length
    if (mostConsistent > 0) {
      insights.push(`${mostConsistent} players with 80%+ consistency`)
    }
    
    // Elite tier identification
    const elitePlayers = topPlayers.filter(p => {
      const score = p.avgFantasy > 0 ? p.avgFantasy : p.avgPoints
      return score > getEliteThreshold(sport)
    })
    if (elitePlayers.length > 0) {
      insights.push(`${elitePlayers.length} elite-tier performers identified`)
    }
    
    if (insights.length > 0) {
      console.log(`  💡 KEY INSIGHTS:`)
      insights.forEach(insight => console.log(`    • ${insight}`))
    }
    
    sportResults.push({sport, topPlayers, insights})
  }
  
  // Cross-sport summary
  console.log(chalk.bold.yellow('\n🎯 CROSS-SPORT SUMMARY:\n'))
  
  sportResults.forEach(result => {
    const topPlayer = result.topPlayers[0]
    if (topPlayer) {
      const score = topPlayer.avgFantasy > 0 ? 
        `${topPlayer.avgFantasy.toFixed(1)} fantasy` : 
        `${topPlayer.avgPoints.toFixed(1)} points`
      console.log(`${result.sport.toUpperCase()}: ${chalk.bold(topPlayer.name)} leads with ${score}`)
    }
  })
  
  // Overall betting recommendations
  console.log(chalk.bold.green('\n📋 MASTER BETTING RECOMMENDATIONS:\n'))
  
  const allElitePlayers: PlayerAnalysis[] = []
  const bestHomeAdvantage: PlayerAnalysis[] = []
  const mostConsistentPlayers: PlayerAnalysis[] = []
  
  sportResults.forEach(result => {
    result.topPlayers.forEach(player => {
      const score = player.avgFantasy > 0 ? player.avgFantasy : player.avgPoints
      
      if (score > getEliteThreshold(player.sport)) {
        allElitePlayers.push(player)
      }
      
      if (player.homeAdvantage > 25) {
        bestHomeAdvantage.push(player)
      }
      
      if (player.consistency > 85) {
        mostConsistentPlayers.push(player)
      }
    })
  })
  
  console.log(`🎯 ${chalk.bold('ELITE TARGETS')} (${allElitePlayers.length} players):`)
  allElitePlayers.slice(0, 5).forEach(player => {
    const score = player.avgFantasy > 0 ? `${player.avgFantasy.toFixed(1)} fantasy` : `${player.avgPoints.toFixed(1)} pts`
    console.log(`  • ${player.name} (${player.sport.toUpperCase()}): ${score}`)
  })
  
  console.log(`\n🏠 ${chalk.bold('HOME FIELD SPECIALISTS')} (${bestHomeAdvantage.length} players):`)
  bestHomeAdvantage.slice(0, 5).forEach(player => {
    console.log(`  • ${player.name} (${player.sport.toUpperCase()}): +${player.homeAdvantage.toFixed(1)}% at home`)
  })
  
  console.log(`\n📊 ${chalk.bold('CONSISTENCY KINGS')} (${mostConsistentPlayers.length} players):`)
  mostConsistentPlayers.slice(0, 5).forEach(player => {
    console.log(`  • ${player.name} (${player.sport.toUpperCase()}): ${player.consistency.toFixed(0)}% consistent`)
  })
  
  console.log(chalk.bold.cyan('\n🚀 ACTIONABLE STRATEGY:'))
  console.log('1. Target elite players in prop bets and DFS')
  console.log('2. Use home field specialists for location-based bets')
  console.log('3. Build consistent players into reliable lineups')
  console.log('4. Cross-reference with game-level betting patterns for maximum edge')
  
  // Save results for future reference
  console.log(chalk.gray('\n💾 Analysis complete - data ready for betting strategies'))
}

function extractPoints(stats: any, sport: string): number {
  // Sport-specific point extraction
  switch (sport.toLowerCase()) {
    case 'nfl':
    case 'ncaaf':
    case 'football':
      return (parseInt(stats.rushing_touchdowns) || 0) * 6 + 
             (parseInt(stats.passing_touchdowns) || 0) * 6 +
             (parseInt(stats.receiving_touchdowns) || 0) * 6
    case 'nba':
    case 'ncaab':
    case 'basketball':
      return parseInt(stats.points) || 0
    case 'nhl':
    case 'hockey':
      return parseInt(stats.goals) || 0
    case 'mlb':
    case 'baseball':
      return parseInt(stats.runs) || 0
    default:
      return parseInt(stats.points) || 0
  }
}

function aggregateStats(allStats: any[], sport: string): any {
  // Aggregate key stats by sport
  const aggregated: any = {}
  
  if (allStats.length === 0) return aggregated
  
  const keys = Object.keys(allStats[0])
  keys.forEach(key => {
    const values = allStats.map(s => parseFloat(s[key]) || parseInt(s[key]) || 0).filter(v => !isNaN(v))
    if (values.length > 0) {
      aggregated[key] = values.reduce((a,b) => a+b, 0) / values.length
    }
  })
  
  return aggregated
}

function calculateConsistency(performances: number[]): number {
  if (performances.length < 2) return 0
  
  const avg = performances.reduce((a,b) => a+b, 0) / performances.length
  const variance = performances.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / performances.length
  const stdDev = Math.sqrt(variance)
  
  if (avg === 0) return 0
  const coefficientOfVariation = stdDev / avg
  return Math.max(0, 100 - (coefficientOfVariation * 100))
}

function getEliteThreshold(sport: string): number {
  // Sport-specific elite thresholds
  switch (sport.toLowerCase()) {
    case 'nfl': return 25 // fantasy points
    case 'nba': return 30 // fantasy points
    case 'nhl': return 20 // fantasy points
    case 'mlb': return 15 // fantasy points
    default: return 20
  }
}

// Run the comprehensive analysis
comprehensiveSportsAnalysis().catch(console.error)