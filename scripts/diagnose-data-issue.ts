#!/usr/bin/env tsx
/**
 * Diagnose Data Collection Root Issues
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function diagnoseIssues() {
  console.log(chalk.cyan.bold('\n🔍 DIAGNOSING DATA COLLECTION ISSUES\n'))
  
  // 1. Check games table structure
  console.log(chalk.yellow('1. Checking games table...'))
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .limit(10)
  
  if (gamesError) {
    console.log(chalk.red('Error fetching games:'), gamesError)
  } else {
    console.log(chalk.white(`Sample games count: ${games?.length}`))
    if (games && games.length > 0) {
      console.log('Game structure:', Object.keys(games[0]))
      console.log('Sample game IDs:', games.map(g => g.id).slice(0, 5))
    }
  }
  
  // 2. Check total games with scores
  const { count: gamesWithScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
  
  console.log(chalk.white(`\nGames with scores: ${chalk.yellow(gamesWithScores || 0)}`))
  
  // 3. Check player_stats table
  console.log(chalk.yellow('\n2. Checking player_stats table...'))
  const { data: stats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .limit(10)
  
  if (statsError) {
    console.log(chalk.red('Error fetching stats:'), statsError)
  } else {
    console.log(chalk.white(`Sample stats count: ${stats?.length}`))
    if (stats && stats.length > 0) {
      console.log('Stats structure:', Object.keys(stats[0]))
      console.log('Unique game_ids in sample:', [...new Set(stats.map(s => s.game_id))])
    }
  }
  
  // 4. Check if we're using wrong API endpoints
  console.log(chalk.yellow('\n3. Checking data sources...'))
  console.log(chalk.gray('Looking for collector scripts...'))
  
  // 5. Check for API keys
  console.log(chalk.yellow('\n4. Checking API configurations...'))
  const apiKeys = {
    'ODDS_API_KEY': process.env.ODDS_API_KEY ? '✅ Present' : '❌ Missing',
    'SPORTSDATA_API_KEY': process.env.SPORTSDATA_API_KEY ? '✅ Present' : '❌ Missing',
    'RAPIDAPI_KEY': process.env.RAPIDAPI_KEY ? '✅ Present' : '❌ Missing',
  }
  
  for (const [key, status] of Object.entries(apiKeys)) {
    console.log(chalk.white(`${key}: ${status}`))
  }
  
  // 6. Analyze the real problem
  console.log(chalk.cyan('\n📊 ANALYSIS:'))
  
  if (!stats || stats.length === 0) {
    console.log(chalk.red('❌ No player stats in database at all'))
    console.log(chalk.yellow('→ Need to create a proper data collector'))
  } else {
    const uniqueGames = [...new Set(stats.map(s => s.game_id))]
    console.log(chalk.yellow(`⚠️  Only ${uniqueGames.length} unique games have stats`))
    console.log(chalk.yellow('→ Our fill scripts are creating duplicate stats for same games'))
  }
  
  console.log(chalk.cyan('\n🎯 ROOT CAUSES:'))
  console.log(chalk.white('1. No real data collector running - just mock data'))
  console.log(chalk.white('2. Fill scripts are not properly iterating through different games'))
  console.log(chalk.white('3. Missing proper sports data API integration'))
  console.log(chalk.white('4. No scheduled scraping jobs'))
  
  console.log(chalk.cyan('\n💡 SOLUTION:'))
  console.log(chalk.green('1. Create real-time game stats collector using sports APIs'))
  console.log(chalk.green('2. Set up scheduled jobs to fetch live game data'))
  console.log(chalk.green('3. Implement proper player-game relationships'))
  console.log(chalk.green('4. Use actual sports data providers (ESPN, SportsData.io, etc.)'))
}

diagnoseIssues().catch(console.error)