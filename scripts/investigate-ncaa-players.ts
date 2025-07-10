#!/usr/bin/env tsx
/**
 * Investigate NCAA player and team counts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function investigateNCAA() {
  console.log(chalk.cyan.bold('\n🏈 NCAA FOOTBALL INVESTIGATION\n'))
  console.log(chalk.gray('='.repeat(80)))
  
  // 1. Check all sports in players table
  console.log(chalk.white('1. Sports distribution in players table:'))
  const { data: sportCounts } = await supabase
    .from('players')
    .select('sport')
    
  const sportMap = new Map<string, number>()
  sportCounts?.forEach(p => {
    const sport = p.sport || 'null'
    sportMap.set(sport, (sportMap.get(sport) || 0) + 1)
  })
  
  sportMap.forEach((count, sport) => {
    console.log(chalk.gray(`   ${sport}: ${count.toLocaleString()} players`))
  })
  
  // 2. Check teams table for NCAA entries
  console.log(chalk.white('\n2. Teams by sport:'))
  const { data: teamCounts } = await supabase
    .from('teams')
    .select('sport')
    
  const teamMap = new Map<string, number>()
  teamCounts?.forEach(t => {
    const sport = t.sport || 'null'
    teamMap.set(sport, (teamMap.get(sport) || 0) + 1)
  })
  
  teamMap.forEach((count, sport) => {
    console.log(chalk.gray(`   ${sport}: ${count} teams`))
  })
  
  // 3. Look for NCAA-specific values
  console.log(chalk.white('\n3. Searching for NCAA-related entries:'))
  
  // Check for 'ncaa' in sport field
  const { count: ncaaPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('sport', '%ncaa%')
    
  console.log(chalk.white('   Players with "ncaa" in sport:'), ncaaPlayers || 0)
  
  // Check for 'college' in sport field
  const { count: collegePlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('sport', '%college%')
    
  console.log(chalk.white('   Players with "college" in sport:'), collegePlayers || 0)
  
  // Check for 'ncaaf' (NCAA Football)
  const { count: ncaafPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('sport', '%ncaaf%')
    
  console.log(chalk.white('   Players with "ncaaf" in sport:'), ncaafPlayers || 0)
  
  // 4. Sample some players to see what sports exist
  console.log(chalk.white('\n4. Sample of players with their sports:'))
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('name, sport, team_id')
    .limit(20)
    
  samplePlayers?.forEach(p => {
    console.log(chalk.gray(`   - ${p.name}: sport="${p.sport}", team_id="${p.team_id}"`))
  })
  
  // 5. Check for teams with many players
  console.log(chalk.white('\n5. Teams with most players:'))
  const { data: allPlayers } = await supabase
    .from('players')
    .select('team_id')
    .not('team_id', 'is', null)
    
  const teamPlayerCount = new Map<string, number>()
  allPlayers?.forEach(p => {
    if (p.team_id) {
      teamPlayerCount.set(p.team_id, (teamPlayerCount.get(p.team_id) || 0) + 1)
    }
  })
  
  // Sort by count and get top 10
  const topTeams = Array.from(teamPlayerCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    
  for (const [teamId, count] of topTeams) {
    const { data: team } = await supabase
      .from('teams')
      .select('name, sport')
      .eq('id', teamId)
      .single()
      
    if (team) {
      console.log(chalk.gray(`   - ${team.name} (${team.sport}): ${count} players`))
    }
  }
  
  // 6. Check if there are specific NCAA team names
  console.log(chalk.white('\n6. Teams with "college" or "university" in name:'))
  const { data: collegeTeams } = await supabase
    .from('teams')
    .select('name, sport, id')
    .or('name.ilike.%college%, name.ilike.%university%, name.ilike.%state%')
    .limit(20)
    
  for (const team of collegeTeams || []) {
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      
    console.log(chalk.gray(`   - ${team.name} (${team.sport}): ${playerCount} players`))
  }
  
  // 7. Total unique sports
  console.log(chalk.white('\n7. All unique sport values in database:'))
  const uniqueSports = new Set<string>()
  sportCounts?.forEach(p => {
    if (p.sport) uniqueSports.add(p.sport)
  })
  
  console.log(chalk.gray(`   Found ${uniqueSports.size} unique sports:`))
  uniqueSports.forEach(s => console.log(chalk.gray(`   - "${s}"`)))
  
  console.log(chalk.gray('\n' + '='.repeat(80)))
}

investigateNCAA().catch(console.error)