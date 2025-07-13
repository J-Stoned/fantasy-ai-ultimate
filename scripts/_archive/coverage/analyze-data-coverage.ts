#!/usr/bin/env tsx
/**
 * COMPREHENSIVE DATA COVERAGE ANALYSIS
 * Identifies all gaps in our 16,435 games
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import * as fs from 'fs'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CoverageReport {
  totalGames: number
  completedGames: number
  gamesWithScores: number
  gamesWithPlayerLogs: number
  gamesWithFantasyPoints: number
  totalPlayerLogs: number
  logsWithFantasyPoints: number
  logsWithStats: number
  logsWithComputedMetrics: number
  coverageByYear: Record<number, any>
  coverageBySport: Record<string, any>
  topGapsToFill: any[]
}

async function analyzeCoverage() {
  console.log(chalk.cyan.bold('\n🔍 COMPREHENSIVE DATA COVERAGE ANALYSIS\n'))
  
  const report: CoverageReport = {
    totalGames: 0,
    completedGames: 0,
    gamesWithScores: 0,
    gamesWithPlayerLogs: 0,
    gamesWithFantasyPoints: 0,
    totalPlayerLogs: 0,
    logsWithFantasyPoints: 0,
    logsWithStats: 0,
    logsWithComputedMetrics: 0,
    coverageByYear: {},
    coverageBySport: {},
    topGapsToFill: []
  }
  
  try {
    // 1. Overall game counts
    console.log(chalk.yellow('📊 Analyzing Games...\n'))
    
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
    
    const { count: completedGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
    
    const { count: gamesWithScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
    
    report.totalGames = totalGames || 0
    report.completedGames = completedGames || 0
    report.gamesWithScores = gamesWithScores || 0
    
    console.log(chalk.white(`Total games: ${report.totalGames.toLocaleString()}`))
    console.log(chalk.white(`Completed games: ${report.completedGames.toLocaleString()}`))
    console.log(chalk.white(`Games with scores: ${report.gamesWithScores.toLocaleString()}`))
    
    // 2. Player log coverage
    console.log(chalk.yellow('\n📈 Analyzing Player Logs...\n'))
    
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
    
    const { count: logsWithFantasy } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('fantasy_points', 'is', null)
      .gt('fantasy_points', 0)
    
    const { count: logsWithStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats', 'is', null)
    
    const { count: logsWithMetrics } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('computed_metrics', 'is', null)
    
    report.totalPlayerLogs = totalLogs || 0
    report.logsWithFantasyPoints = logsWithFantasy || 0
    report.logsWithStats = logsWithStats || 0
    report.logsWithComputedMetrics = logsWithMetrics || 0
    
    console.log(chalk.white(`Total player logs: ${report.totalPlayerLogs.toLocaleString()}`))
    console.log(chalk.white(`Logs with fantasy points: ${report.logsWithFantasyPoints.toLocaleString()}`))
    console.log(chalk.white(`Logs with stats: ${report.logsWithStats.toLocaleString()}`))
    console.log(chalk.white(`Logs with computed metrics: ${report.logsWithComputedMetrics.toLocaleString()}`))
    
    // 3. Games with player data
    console.log(chalk.yellow('\n🎮 Analyzing Game Coverage...\n'))
    
    // Get unique games with player logs
    const { data: gamesWithLogs } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .limit(50000)
    
    const uniqueGamesWithLogs = new Set(gamesWithLogs?.map(l => l.game_id) || [])
    report.gamesWithPlayerLogs = uniqueGamesWithLogs.size
    
    // Get games with fantasy data
    const { data: gamesWithFantasy } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .gt('fantasy_points', 0)
      .limit(50000)
    
    const uniqueGamesWithFantasy = new Set(gamesWithFantasy?.map(l => l.game_id) || [])
    report.gamesWithFantasyPoints = uniqueGamesWithFantasy.size
    
    console.log(chalk.white(`Games with player logs: ${report.gamesWithPlayerLogs.toLocaleString()}`))
    console.log(chalk.white(`Games with fantasy data: ${report.gamesWithFantasyPoints.toLocaleString()}`))
    
    // 4. Coverage by year
    console.log(chalk.yellow('\n📅 Coverage by Year...\n'))
    
    const years = [2020, 2021, 2022, 2023, 2024, 2025]
    for (const year of years) {
      const { count: yearGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', `${year}-01-01`)
        .lt('start_time', `${year + 1}-01-01`)
        .eq('status', 'completed')
      
      // Sample check for coverage
      const { data: yearGamesSample } = await supabase
        .from('games')
        .select('id')
        .gte('start_time', `${year}-01-01`)
        .lt('start_time', `${year + 1}-01-01`)
        .eq('status', 'completed')
        .limit(100)
      
      let covered = 0
      for (const game of yearGamesSample || []) {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id)
          .gt('fantasy_points', 0)
        
        if (count && count > 0) covered++
      }
      
      const coverageRate = yearGamesSample?.length ? (covered / yearGamesSample.length) * 100 : 0
      
      report.coverageByYear[year] = {
        games: yearGames || 0,
        estimatedCoverage: `${coverageRate.toFixed(1)}%`
      }
      
      if (yearGames && yearGames > 0) {
        console.log(chalk.white(`${year}: ${yearGames.toLocaleString()} games, ~${coverageRate.toFixed(1)}% coverage`))
      }
    }
    
    // 5. Coverage by sport
    console.log(chalk.yellow('\n🏈 Coverage by Sport...\n'))
    
    const sports = ['football', 'basketball', 'baseball', 'hockey', 'NFL', 'NBA', 'MLB', 'NHL']
    for (const sport of sports) {
      const { count: sportGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport)
        .eq('status', 'completed')
      
      if (sportGames && sportGames > 0) {
        report.coverageBySport[sport] = {
          games: sportGames
        }
        console.log(chalk.white(`${sport}: ${sportGames.toLocaleString()} games`))
      }
    }
    
    // 6. Identify top gaps
    console.log(chalk.yellow('\n🎯 Identifying Top Gaps to Fill...\n'))
    
    // Find completed games without player logs
    const { data: gamesWithoutLogs } = await supabase
      .from('games')
      .select('id, sport, start_time, home_team_id, away_team_id')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100)
    
    const gaps = []
    for (const game of gamesWithoutLogs || []) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
      
      if (!count || count === 0) {
        gaps.push({
          game_id: game.id,
          sport: game.sport,
          date: new Date(game.start_time).toLocaleDateString()
        })
      }
    }
    
    report.topGapsToFill = gaps.slice(0, 20)
    
    console.log(chalk.white(`Found ${gaps.length} games (of 100 checked) without player logs`))
    
    // 7. Calculate opportunity
    console.log(chalk.cyan.bold('\n💎 DATA OPPORTUNITY ANALYSIS\n'))
    
    const gamesNeedingData = report.gamesWithScores - report.gamesWithFantasyPoints
    const potentialNewLogs = gamesNeedingData * 20 // Avg 20 players per game
    const logsNeedingFantasy = report.logsWithStats - report.logsWithFantasyPoints
    
    console.log(chalk.green(`🎯 Games needing player data: ${gamesNeedingData.toLocaleString()}`))
    console.log(chalk.green(`📊 Potential new player logs: ${potentialNewLogs.toLocaleString()}`))
    console.log(chalk.green(`💰 Existing logs needing fantasy points: ${logsNeedingFantasy.toLocaleString()}`))
    
    const totalOpportunity = potentialNewLogs + logsNeedingFantasy
    console.log(chalk.yellow.bold(`\n🚀 TOTAL DATA RECORDS TO CREATE/FIX: ${totalOpportunity.toLocaleString()}\n`))
    
    // Save report
    fs.writeFileSync('data-coverage-report.json', JSON.stringify(report, null, 2))
    console.log(chalk.green('✅ Full report saved to data-coverage-report.json'))
    
    // Action plan
    console.log(chalk.cyan.bold('\n📋 RECOMMENDED ACTION PLAN:\n'))
    console.log(chalk.white('1. Fix existing logs without fantasy points'))
    console.log(chalk.white('2. Backfill recent games (2024-2025) first'))
    console.log(chalk.white('3. Process high-value games (playoffs, championships)'))
    console.log(chalk.white('4. Fill remaining historical games'))
    console.log(chalk.white('5. Set up real-time collection for future'))
    
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  }
}

if (require.main === module) {
  analyzeCoverage().catch(console.error)
}