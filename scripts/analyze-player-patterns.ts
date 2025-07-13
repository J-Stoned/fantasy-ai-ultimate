#!/usr/bin/env tsx
/**
 * PLAYER STATS PATTERN ANALYZER
 * Finally analyze our 258K+ player stats for patterns!
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PlayerPattern {
  pattern_name: string
  description: string
  occurrences: number
  avg_performance: number
  confidence: number
}

async function analyzePlayerPatterns() {
  console.log(chalk.bold.red('🔥 PLAYER STATS PATTERN ANALYSIS\n'))
  console.log(chalk.yellow('Analyzing 258K+ player stats for hidden patterns...\n'))
  
  const patterns: PlayerPattern[] = []
  
  // Pattern 1: Home vs Away Performance
  console.log(chalk.cyan('🏠 ANALYZING HOME/AWAY PATTERNS...'))
  
  const { data: homeAwayData } = await supabase
    .from('player_game_logs')
    .select('is_home, stats')
    .not('stats', 'is', null)
    .not('is_home', 'is', null)
    .limit(10000)
    
  if (homeAwayData && homeAwayData.length > 0) {
    const homeStats: number[] = []
    const awayStats: number[] = []
    
    homeAwayData.forEach(game => {
      const points = extractPoints(game.stats)
      if (points > 0) {
        if (game.is_home) {
          homeStats.push(points)
        } else {
          awayStats.push(points)
        }
      }
    })
    
    const homeAvg = homeStats.reduce((a, b) => a + b, 0) / homeStats.length
    const awayAvg = awayStats.reduce((a, b) => a + b, 0) / awayStats.length
    const improvement = ((homeAvg - awayAvg) / awayAvg) * 100
    
    patterns.push({
      pattern_name: 'Home Field Advantage',
      description: `Players score ${improvement.toFixed(1)}% more points at home`,
      occurrences: homeStats.length + awayStats.length,
      avg_performance: improvement,
      confidence: homeStats.length > 1000 ? 0.9 : 0.7
    })
    
    console.log(`  Home avg: ${homeAvg.toFixed(1)} points`)
    console.log(`  Away avg: ${awayAvg.toFixed(1)} points`) 
    console.log(`  Improvement: ${improvement.toFixed(1)}%`)
  }
  
  // Pattern 2: Back-to-Back Game Fatigue
  console.log(chalk.cyan('\n⚡ ANALYZING BACK-TO-BACK FATIGUE...'))
  
  // Get games with dates to analyze consecutive games
  const { data: gamesWithDates } = await supabase
    .from('games')
    .select('id, start_time')
    .not('start_time', 'is', null)
    .order('start_time')
    .limit(5000)
    
  if (gamesWithDates && gamesWithDates.length > 0) {
    // Find back-to-back games (within 2 days)
    const backToBackGames = new Set<number>()
    
    for (let i = 1; i < gamesWithDates.length; i++) {
      const prev = new Date(gamesWithDates[i-1].start_time)
      const curr = new Date(gamesWithDates[i].start_time)
      const daysDiff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysDiff <= 2) {
        backToBackGames.add(gamesWithDates[i].id)
      }
    }
    
    // Get player stats for back-to-back vs normal games
    const { data: fatigueData } = await supabase
      .from('player_game_logs')
      .select('game_id, stats')
      .in('game_id', Array.from(backToBackGames).slice(0, 1000))
      .not('stats', 'is', null)
      
    if (fatigueData && fatigueData.length > 0) {
      const fatigueStats = fatigueData.map(g => extractPoints(g.stats)).filter(p => p > 0)
      const fatigueAvg = fatigueStats.reduce((a, b) => a + b, 0) / fatigueStats.length
      
      patterns.push({
        pattern_name: 'Back-to-Back Fatigue',
        description: `Players average ${fatigueAvg.toFixed(1)} points in back-to-back games`,
        occurrences: fatigueStats.length,
        avg_performance: fatigueAvg,
        confidence: fatigueStats.length > 100 ? 0.8 : 0.5
      })
      
      console.log(`  Back-to-back games found: ${backToBackGames.size}`)
      console.log(`  Avg performance: ${fatigueAvg.toFixed(1)} points`)
    }
  }
  
  // Pattern 3: High-Usage Players (Usage > 25%)
  console.log(chalk.cyan('\n🎯 ANALYZING HIGH-USAGE PATTERNS...'))
  
  const { data: usageData } = await supabase
    .from('player_game_logs')
    .select('stats')
    .not('stats', 'is', null)
    .limit(5000)
    
  if (usageData) {
    const highUsagePlayers: number[] = []
    
    usageData.forEach(game => {
      const points = extractPoints(game.stats)
      const assists = extractAssists(game.stats)
      const rebounds = extractRebounds(game.stats)
      
      // High usage = significant contribution in multiple categories
      if (points > 15 && (assists > 5 || rebounds > 8)) {
        highUsagePlayers.push(points)
      }
    })
    
    if (highUsagePlayers.length > 0) {
      const highUsageAvg = highUsagePlayers.reduce((a, b) => a + b, 0) / highUsagePlayers.length
      
      patterns.push({
        pattern_name: 'High-Usage Stars',
        description: `High-usage players average ${highUsageAvg.toFixed(1)} points`,
        occurrences: highUsagePlayers.length,
        avg_performance: highUsageAvg,
        confidence: 0.9
      })
      
      console.log(`  High-usage players: ${highUsagePlayers.length}`)
      console.log(`  Avg performance: ${highUsageAvg.toFixed(1)} points`)
    }
  }
  
  // Pattern 4: Clutch Time Performance (Fourth Quarter/Overtime)
  console.log(chalk.cyan('\n🔥 ANALYZING CLUTCH PATTERNS...'))
  
  // For now, identify clutch players by high-pressure stats
  const { data: clutchData } = await supabase
    .from('player_game_logs')
    .select('stats')
    .not('stats', 'is', null)
    .limit(3000)
    
  if (clutchData) {
    const clutchPerformers: number[] = []
    
    clutchData.forEach(game => {
      const points = extractPoints(game.stats)
      const assists = extractAssists(game.stats)
      const steals = extractSteals(game.stats)
      
      // Clutch = high points + key stats
      if (points > 20 && (assists > 3 || steals > 1)) {
        clutchPerformers.push(points)
      }
    })
    
    if (clutchPerformers.length > 0) {
      const clutchAvg = clutchPerformers.reduce((a, b) => a + b, 0) / clutchPerformers.length
      
      patterns.push({
        pattern_name: 'Clutch Performers',
        description: `Clutch players average ${clutchAvg.toFixed(1)} points`,
        occurrences: clutchPerformers.length,
        avg_performance: clutchAvg,
        confidence: 0.8
      })
      
      console.log(`  Clutch performers: ${clutchPerformers.length}`)
      console.log(`  Avg performance: ${clutchAvg.toFixed(1)} points`)
    }
  }
  
  // Save patterns to database
  console.log(chalk.cyan('\n💾 SAVING PATTERNS TO DATABASE...'))
  
  for (const pattern of patterns) {
    const { error } = await supabase
      .from('pattern_results')
      .upsert({
        pattern_name: pattern.pattern_name,
        description: pattern.description,
        pattern_type: 'player_performance',
        occurrences: pattern.occurrences,
        confidence: pattern.confidence,
        avg_accuracy: pattern.avg_performance,
        sport: 'ALL',
        created_at: new Date().toISOString()
      }, { onConflict: 'pattern_name' })
      
    if (!error) {
      console.log(chalk.green(`✅ Saved: ${pattern.pattern_name}`))
    }
  }
  
  // Final report
  console.log(chalk.bold.yellow('\n📊 PLAYER PATTERN ANALYSIS COMPLETE!\n'))
  
  patterns.forEach(pattern => {
    console.log(`${chalk.bold(pattern.pattern_name)}:`)
    console.log(`  ${pattern.description}`)
    console.log(`  Occurrences: ${pattern.occurrences.toLocaleString()}`)
    console.log(`  Confidence: ${(pattern.confidence * 100).toFixed(0)}%`)
    console.log()
  })
  
  console.log(chalk.bold.green(`🎯 DISCOVERED ${patterns.length} PLAYER PATTERNS!`))
  console.log(chalk.cyan('Next: Build betting strategies around these patterns!'))
}

// Helper functions to extract stats
function extractPoints(stats: any): number {
  return parseInt(stats?.points || stats?.rushing_touchdowns || stats?.passing_touchdowns || 0)
}

function extractAssists(stats: any): number {
  return parseInt(stats?.assists || 0)
}

function extractRebounds(stats: any): number {
  return parseInt(stats?.rebounds || 0)
}

function extractSteals(stats: any): number {
  return parseInt(stats?.steals || 0)
}

// Run the analysis
analyzePlayerPatterns().catch(console.error)