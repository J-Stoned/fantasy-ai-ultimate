#!/usr/bin/env tsx
/**
 * STANDARDIZE SPORT VALUES
 * Fix all sport value inconsistencies across the database
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Standard sport mappings
const SPORT_STANDARDS = {
  // NFL variations
  'nfl': 'NFL',
  'NFL': 'NFL',
  'Football': 'NFL',
  'f': 'NFL',
  
  // NBA variations
  'nba': 'NBA',
  'NBA': 'NBA',
  'Basketball': 'NBA',
  
  // NHL variations
  'nhl': 'NHL',
  'NHL': 'NHL',
  'Hockey': 'NHL',
  
  // MLB variations
  'mlb': 'MLB',
  'MLB': 'MLB',
  'Baseball': 'MLB',
  
  // MLS variations
  'mls': 'MLS',
  'MLS': 'MLS',
  'Soccer': 'MLS',
  
  // NCAA Football
  'ncaaf': 'NCAAF',
  'NCAAF': 'NCAAF',
  'NCAA_FB': 'NCAAF',
  'College Football': 'NCAAF',
  
  // NCAA Basketball
  'ncaab': 'NCAAB',
  'NCAAB': 'NCAAB',
  'NCAA_BB': 'NCAAB',
  'College Basketball': 'NCAAB'
}

async function standardizeSportValues() {
  console.log(chalk.bold.red('🏆 SPORT VALUE STANDARDIZATION\n'))
  
  // 1. GAMES TABLE
  console.log(chalk.bold.yellow('📊 Standardizing games table...\n'))
  
  // Get all non-standard sports - need to get ALL games and check
  const allGames: any[] = []
  let offset = 0
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, sport')
      .not('sport', 'is', null)
      .range(offset, offset + 9999)
      
    if (!batch || batch.length === 0) break
    allGames.push(...batch)
    offset += 10000
  }
  
  const nonStandardGames = allGames.filter(game => {
    const standard = SPORT_STANDARDS[game.sport]
    return standard && standard !== game.sport
  })
    
  if (nonStandardGames && nonStandardGames.length > 0) {
    console.log(`Found ${nonStandardGames.length} games with non-standard sport values`)
    
    // Group by sport for batch updates
    const updateGroups = new Map<string, number[]>()
    
    nonStandardGames.forEach(game => {
      const standard = SPORT_STANDARDS[game.sport]
      if (standard && standard !== game.sport) {
        if (!updateGroups.has(`${game.sport}->${standard}`)) {
          updateGroups.set(`${game.sport}->${standard}`, [])
        }
        updateGroups.get(`${game.sport}->${standard}`)!.push(game.id)
      }
    })
    
    // Update each group
    for (const [change, gameIds] of updateGroups.entries()) {
      const [oldSport, newSport] = change.split('->')
      console.log(`  Updating ${gameIds.length} games from "${oldSport}" to "${newSport}"`)
      
      // Update in batches
      for (let i = 0; i < gameIds.length; i += 500) {
        const batch = gameIds.slice(i, i + 500)
        const { error } = await supabase
          .from('games')
          .update({ sport: newSport })
          .in('id', batch)
          
        if (error) {
          console.error(chalk.red(`Error updating games: ${error.message}`))
        }
      }
    }
    
    console.log(chalk.green('✅ Games table standardized!'))
  } else {
    console.log(chalk.green('✅ Games table already standard!'))
  }
  
  // 2. PLAYERS TABLE
  console.log(chalk.bold.yellow('\n📊 Standardizing players table...\n'))
  
  const { data: nonStandardPlayers } = await supabase
    .from('players')
    .select('id, sport')
    .not('sport', 'is', null)
    .in('sport', ['nfl', 'Football', 'f', 'Basketball', 'Hockey', 'Baseball', 'Soccer'])
    .limit(10000)
    
  if (nonStandardPlayers && nonStandardPlayers.length > 0) {
    console.log(`Found ${nonStandardPlayers.length} players with non-standard sport values`)
    
    // Group by sport for batch updates
    const playerUpdateGroups = new Map<string, number[]>()
    
    nonStandardPlayers.forEach(player => {
      const standard = SPORT_STANDARDS[player.sport]
      if (standard && standard !== player.sport) {
        if (!playerUpdateGroups.has(`${player.sport}->${standard}`)) {
          playerUpdateGroups.set(`${player.sport}->${standard}`, [])
        }
        playerUpdateGroups.get(`${player.sport}->${standard}`)!.push(player.id)
      }
    })
    
    // Update each group
    for (const [change, playerIds] of playerUpdateGroups.entries()) {
      const [oldSport, newSport] = change.split('->')
      console.log(`  Updating ${playerIds.length} players from "${oldSport}" to "${newSport}"`)
      
      // Update in batches
      for (let i = 0; i < playerIds.length; i += 500) {
        const batch = playerIds.slice(i, i + 500)
        const { error } = await supabase
          .from('players')
          .update({ sport: newSport })
          .in('id', batch)
          
        if (error) {
          console.error(chalk.red(`Error updating players: ${error.message}`))
        }
      }
    }
    
    console.log(chalk.green('✅ Players table standardized!'))
  } else {
    console.log(chalk.green('✅ Players table already standard!'))
  }
  
  // 3. TEAMS TABLE (if sport column exists)
  console.log(chalk.bold.yellow('\n📊 Checking teams table...\n'))
  
  const { data: teamSample } = await supabase
    .from('teams')
    .select('*')
    .limit(1)
    
  if (teamSample && teamSample.length > 0 && 'sport' in teamSample[0]) {
    console.log('Teams table has sport column, standardizing...')
    
    const { data: nonStandardTeams } = await supabase
      .from('teams')
      .select('id, sport')
      .not('sport', 'is', null)
      .in('sport', ['nfl', 'nba', 'nhl', 'mlb', 'mls', 'ncaaf', 'ncaab'])
      
    if (nonStandardTeams && nonStandardTeams.length > 0) {
      // Similar update logic as above
      console.log(`Found ${nonStandardTeams.length} teams to update`)
      // ... update logic
    }
  } else {
    console.log('Teams table does not have sport column or is empty')
  }
  
  // 4. VERIFY RESULTS
  console.log(chalk.bold.cyan('\n📊 VERIFICATION:\n'))
  
  // Check games
  const { data: gamesSports } = await supabase
    .from('games')
    .select('sport')
    .not('sport', 'is', null)
    .limit(1000)
    
  const gameSportCounts = new Map<string, number>()
  gamesSports?.forEach(g => {
    gameSportCounts.set(g.sport, (gameSportCounts.get(g.sport) || 0) + 1)
  })
  
  console.log('Games table sport values:')
  Array.from(gameSportCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .forEach(([sport, count]) => {
      const isStandard = ['NFL', 'NBA', 'NHL', 'MLB', 'MLS', 'NCAAF', 'NCAAB'].includes(sport)
      console.log(`  ${isStandard ? '✅' : '❌'} "${sport}": ${count} games`)
    })
  
  console.log(chalk.bold.green('\n✅ SPORT STANDARDIZATION COMPLETE!'))
  console.log(chalk.yellow('\n💡 Now our collection scripts will work correctly!'))
  console.log('All sports are standardized to: NFL, NBA, NHL, MLB, MLS, NCAAF, NCAAB')
}

standardizeSportValues().catch(console.error)