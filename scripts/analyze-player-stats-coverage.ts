#!/usr/bin/env tsx
/**
 * Comprehensive analysis of player stats coverage
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function analyzePlayerStats() {
  console.log(chalk.cyan.bold('\n📊 PLAYER STATS COVERAGE ANALYSIS\n'))
  console.log(chalk.gray('='.repeat(80)))
  
  // 1. Total records in player_stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.white('1. Total records in player_stats table:'), chalk.green.bold(totalStats?.toLocaleString() || '0'))
  
  // 2. Count unique player_ids in player_stats
  const { data: uniquePlayers } = await supabase
    .from('player_stats')
    .select('player_id')
    
  const uniquePlayerIds = new Set(uniquePlayers?.map(p => p.player_id) || [])
  console.log(chalk.white('2. Unique players in player_stats:'), chalk.green.bold(uniquePlayerIds.size.toLocaleString()))
  
  // 3. Total players in players table
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.white('3. Total players in players table:'), chalk.yellow.bold(totalPlayers?.toLocaleString() || '0'))
  
  // Calculate coverage percentage
  const coverage = totalPlayers ? ((uniquePlayerIds.size / totalPlayers) * 100).toFixed(2) : '0'
  console.log(chalk.white('   Coverage:'), chalk.cyan.bold(`${coverage}%`))
  
  // 4. Breakdown by sport
  console.log(chalk.white('\n4. Breakdown by sport:'))
  
  // Get all players by sport
  const sports = ['nfl', 'nba', 'mlb', 'nhl', 'ncaa']
  
  for (const sport of sports) {
    // Total players for this sport
    const { count: sportPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
    
    // Players with stats for this sport
    const { data: sportPlayerStats } = await supabase
      .from('player_stats')
      .select('player_id, players!inner(sport)')
      .eq('players.sport', sport)
    
    const uniqueSportPlayers = new Set(sportPlayerStats?.map(p => p.player_id) || [])
    const sportCoverage = sportPlayers ? ((uniqueSportPlayers.size / sportPlayers) * 100).toFixed(2) : '0'
    
    console.log(chalk.gray(`   ${sport.toUpperCase()}:`))
    console.log(chalk.white(`     - Total players: ${sportPlayers?.toLocaleString() || '0'}`))
    console.log(chalk.white(`     - Players with stats: ${uniqueSportPlayers.size.toLocaleString()}`))
    console.log(chalk.white(`     - Coverage: ${sportCoverage}%`))
  }
  
  // 5. NCAA specific analysis
  console.log(chalk.yellow('\n5. NCAA Football Analysis:'))
  
  // Count NCAA teams
  const { count: ncaaTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'ncaa')
    
  console.log(chalk.white('   Total NCAA teams:'), chalk.bold(ncaaTeams || 0))
  
  // Count NCAA players
  const { count: ncaaPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'ncaa')
    
  console.log(chalk.white('   Total NCAA players:'), chalk.bold(ncaaPlayers || 0))
  
  // Players per team average
  if (ncaaTeams && ncaaPlayers) {
    const avgPerTeam = Math.round(ncaaPlayers / ncaaTeams)
    console.log(chalk.white('   Average players per team:'), chalk.bold(avgPerTeam))
  }
  
  // Get sample of NCAA teams with player counts
  const { data: ncaaTeamSample } = await supabase
    .from('teams')
    .select('name, id')
    .eq('sport', 'ncaa')
    .limit(10)
    
  if (ncaaTeamSample) {
    console.log(chalk.gray('\n   Sample NCAA teams with player counts:'))
    for (const team of ncaaTeamSample) {
      const { count: teamPlayerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id)
        
      console.log(chalk.gray(`     - ${team.name}: ${teamPlayerCount || 0} players`))
    }
  }
  
  // 6. Games with player stats
  console.log(chalk.white('\n6. Games with player stats:'))
  
  // Get unique game_ids from player_stats
  const { data: gameIds } = await supabase
    .from('player_stats')
    .select('game_id')
    
  const uniqueGameIds = new Set(gameIds?.map(g => g.game_id) || [])
  console.log(chalk.white('   Unique games with stats:'), chalk.green.bold(uniqueGameIds.size.toLocaleString()))
  
  // Total completed games
  const { count: completedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    
  console.log(chalk.white('   Total completed games:'), chalk.yellow.bold(completedGames?.toLocaleString() || '0'))
  
  const gameCoverage = completedGames ? ((uniqueGameIds.size / completedGames) * 100).toFixed(4) : '0'
  console.log(chalk.white('   Game coverage:'), chalk.red.bold(`${gameCoverage}%`))
  
  // 7. Stat types distribution
  console.log(chalk.white('\n7. Stat types in database:'))
  
  const { data: statTypes } = await supabase
    .from('player_stats')
    .select('stat_type')
    .limit(10000)
    
  const typeCount = new Map<string, number>()
  statTypes?.forEach(s => {
    typeCount.set(s.stat_type, (typeCount.get(s.stat_type) || 0) + 1)
  })
  
  const sortedTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
  sortedTypes.forEach(([type, count]) => {
    console.log(chalk.gray(`   - ${type}: ${count.toLocaleString()}`))
  })
  
  console.log(chalk.gray('\n' + '='.repeat(80)))
  
  // Summary
  console.log(chalk.cyan.bold('\n📌 KEY FINDINGS:'))
  console.log(chalk.white(`- Player coverage: ${coverage}% (${uniquePlayerIds.size.toLocaleString()} of ${totalPlayers?.toLocaleString() || '0'} players)`))
  console.log(chalk.white(`- Game coverage: ${gameCoverage}% (${uniqueGameIds.size.toLocaleString()} of ${completedGames?.toLocaleString() || '0'} games)`))
  console.log(chalk.white(`- Total stats records: ${totalStats?.toLocaleString() || '0'}`))
  console.log(chalk.yellow(`\n⚠️  NCAA has ${ncaaPlayers?.toLocaleString() || '0'} players with only ${ncaaTeams || 0} teams!`))
  console.log(chalk.gray('   This suggests historical rosters or all-time player data was collected.'))
}

analyzePlayerStats().catch(console.error)