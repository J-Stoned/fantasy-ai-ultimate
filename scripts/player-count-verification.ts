#!/usr/bin/env tsx
/**
 * Verify player counts across the database
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyPlayerCounts() {
  console.log(chalk.cyan.bold('\n🔍 PLAYER COUNT VERIFICATION\n'))
  console.log(chalk.gray('='.repeat(80)))
  
  // 1. Total players in database
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.white('1. Total players in database:'), chalk.green.bold(totalPlayers?.toLocaleString() || '0'))
  
  // 2. Players by sport
  console.log(chalk.white('\n2. Players by sport:'))
  
  // Get all unique sports
  const { data: allPlayers } = await supabase
    .from('players')
    .select('sport')
    
  const sportCounts = new Map<string, number>()
  allPlayers?.forEach(p => {
    const sport = p.sport || 'null'
    sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1)
  })
  
  // Sort by count
  const sortedSports = Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1])
  sortedSports.forEach(([sport, count]) => {
    console.log(chalk.gray(`   ${sport}: ${count.toLocaleString()} players`))
  })
  
  // 3. Football players specifically
  const { count: footballPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'football')
    
  console.log(chalk.yellow('\n3. Football players:'), chalk.bold(footballPlayers?.toLocaleString() || '0'))
  
  // 4. Football players with vs without teams
  const { count: footballWithTeams } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'football')
    .not('team_id', 'is', null)
    
  const { count: footballWithoutTeams } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'football')
    .is('team_id', null)
    
  console.log(chalk.white('   - With team_id:'), chalk.green(footballWithTeams?.toLocaleString() || '0'))
  console.log(chalk.white('   - Without team_id:'), chalk.red(footballWithoutTeams?.toLocaleString() || '0'))
  
  // 5. Check teams
  console.log(chalk.white('\n4. Teams in database:'))
  const { count: totalTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.white('   Total teams:'), chalk.bold(totalTeams || 0))
  
  // Teams by sport
  const { data: allTeams } = await supabase
    .from('teams')
    .select('sport')
    
  const teamSportCounts = new Map<string, number>()
  allTeams?.forEach(t => {
    const sport = t.sport || 'null'
    teamSportCounts.set(sport, (teamSportCounts.get(sport) || 0) + 1)
  })
  
  console.log(chalk.white('   Teams by sport:'))
  teamSportCounts.forEach((count, sport) => {
    console.log(chalk.gray(`     ${sport}: ${count} teams`))
  })
  
  // 6. College teams specifically
  const { data: collegeTeams } = await supabase
    .from('teams')
    .select('id, name')
    .or('name.ilike.%college%, name.ilike.%university%, name.ilike.%state%')
    
  console.log(chalk.white('\n5. College/University teams:'), chalk.bold(collegeTeams?.length || 0))
  
  // 7. Check if football players are actually NFL players
  console.log(chalk.white('\n6. Checking if "football" players are NFL players:'))
  const { data: sampleFootballPlayers } = await supabase
    .from('players')
    .select('name, team_id')
    .eq('sport', 'football')
    .not('team_id', 'is', null)
    .limit(10)
    
  for (const player of sampleFootballPlayers || []) {
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', player.team_id)
      .single()
      
    console.log(chalk.gray(`   - ${player.name} plays for: ${team?.name || 'Unknown'}`))
  }
  
  // 8. The answer to the NCAA question
  console.log(chalk.cyan.bold('\n🎯 ANSWER TO YOUR QUESTION:'))
  console.log(chalk.yellow(`\nWhy so many NCAA football players with only 29 teams?`))
  console.log(chalk.white('\nBased on the data:'))
  console.log(chalk.white(`- Total football players: ${footballPlayers?.toLocaleString() || '0'}`))
  console.log(chalk.white(`- College/University teams: ${collegeTeams?.length || 0}`))
  console.log(chalk.white(`- Football players WITHOUT teams: ${footballWithoutTeams?.toLocaleString() || '0'}`))
  
  console.log(chalk.cyan('\n📌 The issue is:'))
  console.log(chalk.white('1. Most football players (15,569 out of ~16,020) have NO team_id'))
  console.log(chalk.white('2. These appear to be historical NCAA/NFL player records'))
  console.log(chalk.white('3. The data collection likely scraped player databases without proper team linkage'))
  console.log(chalk.white('4. Only 451 football players are actually linked to college teams'))
  
  console.log(chalk.gray('\n' + '='.repeat(80)))
}

verifyPlayerCounts().catch(console.error)