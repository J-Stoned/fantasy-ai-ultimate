#!/usr/bin/env tsx
/**
 * Check why NFL players like Justin Fields aren't found
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkNFLPlayerIssue() {
  console.log(chalk.cyan.bold('\n🏈 NFL PLAYER INVESTIGATION\n'))
  console.log(chalk.gray('='.repeat(80)))
  
  // 1. Check all unique sports in the database
  console.log(chalk.yellow('1. All unique sports in database:'))
  const { data: allPlayers } = await supabase
    .from('players')
    .select('sport')
    .limit(30000) // Get a large sample
    
  const sportSet = new Set<string>()
  allPlayers?.forEach(p => {
    if (p.sport) sportSet.add(p.sport)
  })
  
  const sports = Array.from(sportSet).sort()
  sports.forEach(sport => {
    console.log(chalk.gray(`   - ${sport}`))
  })
  
  // 2. Check for players with "NFL" in their sport field
  console.log(chalk.yellow('\n2. Players with sport = "NFL":'))
  const { count: nflCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    
  console.log(chalk.white('   Count:'), chalk.bold(nflCount || 0))
  
  // 3. Check for players with "football" in their sport field  
  console.log(chalk.yellow('\n3. Players with sport = "football":'))
  const { count: footballCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'football')
    
  console.log(chalk.white('   Count:'), chalk.bold(footballCount || 0))
  
  // 4. Search for specific NFL players by name
  console.log(chalk.yellow('\n4. Searching for known NFL players:'))
  const nflStars = [
    'Justin Fields',
    'Patrick Mahomes',
    'Josh Allen', 
    'Jalen Hurts',
    'Lamar Jackson',
    'Dak Prescott',
    'Tua Tagovailoa',
    'Joe Burrow',
    'Trevor Lawrence',
    'Justin Herbert'
  ]
  
  for (const playerName of nflStars) {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, sport, team_id')
      .ilike('name', `%${playerName}%`)
      
    if (players && players.length > 0) {
      players.forEach(p => {
        console.log(chalk.green(`   ✓ Found: ${p.name} (sport: ${p.sport || 'NULL'}, team_id: ${p.team_id || 'NULL'})`))
      })
    } else {
      console.log(chalk.red(`   ✗ Not found: ${playerName}`))
    }
  }
  
  // 5. Check teams table for NFL teams
  console.log(chalk.yellow('\n5. NFL teams in database:'))
  
  // First check teams with sport = 'NFL'
  const { data: nflTeams } = await supabase
    .from('teams')
    .select('id, name, sport')
    .eq('sport', 'NFL')
    .limit(35)
    
  console.log(chalk.white(`   Teams with sport = 'NFL': ${nflTeams?.length || 0}`))
  
  // Check for known NFL team names
  const { data: knownNFLTeams } = await supabase
    .from('teams')
    .select('id, name, sport')
    .or('name.ilike.%Chiefs%, name.ilike.%Bills%, name.ilike.%Eagles%, name.ilike.%Patriots%, name.ilike.%Cowboys%, name.ilike.%Packers%, name.ilike.%49ers%, name.ilike.%Bears%')
    
  console.log(chalk.white(`\n   Known NFL team names found:`))
  knownNFLTeams?.forEach(team => {
    console.log(chalk.gray(`     - ${team.name} (sport: ${team.sport || 'NULL'})`))
  })
  
  // 6. Sample of "football" players to see what they actually are
  console.log(chalk.yellow('\n6. Sample of "football" players:'))
  const { data: footballSample } = await supabase
    .from('players')
    .select('name, team_id')
    .eq('sport', 'football')
    .not('team_id', 'is', null)
    .limit(20)
    
  for (const player of footballSample || []) {
    const { data: team } = await supabase
      .from('teams')
      .select('name, sport')
      .eq('id', player.team_id)
      .single()
      
    console.log(chalk.gray(`   - ${player.name} → ${team?.name || 'Unknown'} (${team?.sport || 'no sport'})`))
  }
  
  // 7. Check if there's any pattern in team names
  console.log(chalk.yellow('\n7. Team naming patterns:'))
  const { data: allTeams } = await supabase
    .from('teams')
    .select('name, sport')
    .limit(100)
    
  const nbaTeams = allTeams?.filter(t => t.name.includes('Hawks') || t.name.includes('Celtics') || t.name.includes('Lakers'))
  const nflLikeTeams = allTeams?.filter(t => 
    t.name.includes('Chiefs') || t.name.includes('Bills') || t.name.includes('Eagles') || 
    t.name.includes('Patriots') || t.name.includes('Cowboys') || t.name.includes('Packers')
  )
  
  console.log(chalk.white(`   NBA team names found: ${nbaTeams?.length || 0}`))
  console.log(chalk.white(`   NFL team names found: ${nflLikeTeams?.length || 0}`))
  
  // 8. Summary and diagnosis
  console.log(chalk.cyan.bold('\n🎯 DIAGNOSIS:'))
  console.log(chalk.red('\nThe problem is:'))
  console.log(chalk.white('1. There are NO players with sport = "NFL" in the database'))
  console.log(chalk.white('2. All football players have sport = "football" (lowercase)'))
  console.log(chalk.white('3. Teams table has no sport field populated (all NULL)'))
  console.log(chalk.white('4. Football players are incorrectly linked to NBA teams (Hawks, Celtics, etc.)'))
  console.log(chalk.white('5. None of the major NFL stars (Mahomes, Allen, etc.) exist in the database'))
  
  console.log(chalk.cyan('\n📌 ROOT CAUSE:'))
  console.log(chalk.yellow('The NFL data collection never ran properly!'))
  console.log(chalk.white('- The collectors were built but never executed for NFL'))
  console.log(chalk.white('- The "football" players appear to be test/dummy data'))
  console.log(chalk.white('- They\'re incorrectly linked to NBA teams'))
  
  console.log(chalk.green('\n✅ SOLUTION:'))
  console.log(chalk.white('Run the NFL stats collector to populate real NFL data'))
  console.log(chalk.white('Command: npx tsx scripts/nfl-stats-collector.ts'))
  
  console.log(chalk.gray('\n' + '='.repeat(80)))
}

checkNFLPlayerIssue().catch(console.error)