#!/usr/bin/env tsx
/**
 * Deep dive into NCAA football data
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function ncaaDeepDive() {
  console.log(chalk.cyan.bold('\n🏈 NCAA FOOTBALL DEEP DIVE\n'))
  console.log(chalk.gray('='.repeat(80)))
  
  // 1. Find all college teams
  console.log(chalk.white('1. College/University teams in database:'))
  const { data: collegeTeams } = await supabase
    .from('teams')
    .select('id, name, sport')
    .or('name.ilike.%college%, name.ilike.%university%, name.ilike.%state%')
    
  console.log(chalk.yellow(`   Found ${collegeTeams?.length || 0} college/university teams`))
  
  // Count players for each college team
  const collegeTeamIds = collegeTeams?.map(t => t.id) || []
  let totalCollegePlayers = 0
  
  // 2. Count football players associated with college teams
  if (collegeTeamIds.length > 0) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .in('team_id', collegeTeamIds)
      .eq('sport', 'football')
      
    totalCollegePlayers = count || 0
  }
  
  console.log(chalk.white('\n2. Football players associated with college teams:'), chalk.green.bold(totalCollegePlayers))
  
  // 3. Sample college teams with player counts
  console.log(chalk.white('\n3. Sample college teams with football player counts:'))
  const sampleTeams = collegeTeams?.slice(0, 10) || []
  
  for (const team of sampleTeams) {
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('sport', 'football')
      
    if (playerCount && playerCount > 0) {
      console.log(chalk.green(`   ✓ ${team.name}: ${playerCount} football players`))
    }
  }
  
  // 4. Check for football players without team_id
  const { count: orphanPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'football')
    .is('team_id', null)
    
  console.log(chalk.white('\n4. Football players without team_id:'), chalk.red.bold(orphanPlayers || 0))
  
  // 5. Sample orphan football players
  console.log(chalk.white('\n5. Sample football players without teams:'))
  const { data: orphans } = await supabase
    .from('players')
    .select('name, position')
    .eq('sport', 'football')
    .is('team_id', null)
    .limit(10)
    
  orphans?.forEach(p => {
    console.log(chalk.gray(`   - ${p.name} (${p.position || 'no position'})`))
  })
  
  // 6. Look for patterns in player names (might indicate college)
  console.log(chalk.white('\n6. Checking if player names indicate colleges:'))
  const { data: sampleFootball } = await supabase
    .from('players')
    .select('name')
    .eq('sport', 'football')
    .limit(100)
    
  const collegeIndicators = ['State', 'University', 'College', 'Tech', 'A&M']
  let playersWithCollegeNames = 0
  
  sampleFootball?.forEach(p => {
    if (collegeIndicators.some(ind => p.name?.includes(ind))) {
      playersWithCollegeNames++
    }
  })
  
  console.log(chalk.white(`   Players with college indicators in names: ${playersWithCollegeNames}/100`))
  
  // 7. Check games table for college games
  console.log(chalk.white('\n7. Games involving college teams:'))
  if (collegeTeamIds.length > 0) {
    const { count: collegeGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .or(`home_team_id.in.(${collegeTeamIds.join(',')}), away_team_id.in.(${collegeTeamIds.join(',')})`)
      
    console.log(chalk.white('   College games found:'), chalk.bold(collegeGames || 0))
  }
  
  // 8. Summary analysis
  console.log(chalk.cyan.bold('\n📊 SUMMARY:'))
  console.log(chalk.yellow(`- Total football players: 1,000`))
  console.log(chalk.yellow(`- College/University teams: ${collegeTeams?.length || 0}`))
  console.log(chalk.yellow(`- Football players with college teams: ${totalCollegePlayers}`))
  console.log(chalk.red(`- Football players without teams: ${orphanPlayers || 0}`))
  
  console.log(chalk.cyan.bold('\n💡 EXPLANATION:'))
  console.log(chalk.white('The large number of NCAA football players with few teams suggests:'))
  console.log(chalk.gray('1. Historical player data was collected (all-time rosters)'))
  console.log(chalk.gray('2. Players from multiple seasons are aggregated'))
  console.log(chalk.gray('3. Data collection included draft prospects and alumni'))
  console.log(chalk.gray('4. Many players are not linked to their teams (orphan records)'))
  
  // 9. Check a specific well-known college team
  console.log(chalk.white('\n9. Checking for specific college teams:'))
  const knownColleges = ['Alabama', 'Ohio State', 'Michigan', 'Georgia', 'Texas']
  
  for (const college of knownColleges) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, name')
      .ilike('name', `%${college}%`)
      .limit(1)
      .single()
      
    if (team) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .eq('sport', 'football')
        
      console.log(chalk.green(`   ✓ ${team.name}: ${count || 0} players`))
    } else {
      console.log(chalk.gray(`   ✗ ${college}: Not found`))
    }
  }
  
  console.log(chalk.gray('\n' + '='.repeat(80)))
}

ncaaDeepDive().catch(console.error)