#!/usr/bin/env tsx
/**
 * CHECK FOR DUPLICATE GAMES DUE TO SPORT VARIATIONS
 * Find games that might be duplicated with different sport values
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSportDuplicates() {
  console.log(chalk.bold.red('🔍 CHECKING FOR SPORT-RELATED DUPLICATES\n'))
  
  // Get games with lowercase sports
  const { data: lowercaseGames } = await supabase
    .from('games')
    .select('id, external_id, sport, home_team_id, away_team_id, start_time')
    .in('sport', ['nfl', 'nba', 'nhl', 'mlb', 'ncaaf', 'ncaab'])
    .order('external_id')
    
  if (!lowercaseGames || lowercaseGames.length === 0) {
    console.log(chalk.green('✅ No lowercase sport games found!'))
    return
  }
  
  console.log(chalk.yellow(`Found ${lowercaseGames.length} games with lowercase sports\n`))
  
  // Check each for duplicates
  const duplicates: any[] = []
  
  for (const game of lowercaseGames) {
    // Look for uppercase version with same external_id
    const { data: upperMatch } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time')
      .eq('external_id', game.external_id)
      .eq('sport', game.sport.toUpperCase())
      .single()
      
    if (upperMatch) {
      duplicates.push({
        lowercase: game,
        uppercase: upperMatch
      })
    }
    
    // Also check by teams and date (in case external_id differs)
    const gameDate = new Date(game.start_time).toISOString().split('T')[0]
    const { data: teamMatch } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time')
      .eq('home_team_id', game.home_team_id)
      .eq('away_team_id', game.away_team_id)
      .eq('sport', game.sport.toUpperCase())
      .gte('start_time', `${gameDate}T00:00:00`)
      .lte('start_time', `${gameDate}T23:59:59`)
      
    if (teamMatch && teamMatch.length > 0) {
      const isDupe = teamMatch.some(tm => 
        !duplicates.some(d => d.lowercase.id === game.id && d.uppercase.id === tm.id)
      )
      
      if (isDupe) {
        duplicates.push({
          lowercase: game,
          uppercase: teamMatch[0],
          matchType: 'team-date'
        })
      }
    }
  }
  
  if (duplicates.length > 0) {
    console.log(chalk.bold.red(`❌ FOUND ${duplicates.length} DUPLICATE GAMES!\n`))
    
    duplicates.forEach((dup, i) => {
      console.log(chalk.yellow(`Duplicate ${i + 1}:`))
      console.log(`  Lowercase: ${dup.lowercase.sport} - ${dup.lowercase.external_id} (ID: ${dup.lowercase.id})`)
      console.log(`  Uppercase: ${dup.uppercase.sport} - ${dup.uppercase.external_id} (ID: ${dup.uppercase.id})`)
      if (dup.matchType) console.log(`  Match type: ${dup.matchType}`)
      console.log()
    })
    
    // Check which ones have stats
    console.log(chalk.bold.yellow('📊 Checking which duplicates have stats...\n'))
    
    let keepLowercase = 0
    let keepUppercase = 0
    let bothHaveStats = 0
    
    for (const dup of duplicates) {
      const { count: lowerStats } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', dup.lowercase.id)
        
      const { count: upperStats } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', dup.uppercase.id)
        
      if (lowerStats && upperStats && lowerStats > 0 && upperStats > 0) {
        bothHaveStats++
        console.log(chalk.red(`⚠️  Both have stats! Lower: ${lowerStats}, Upper: ${upperStats}`))
      } else if (lowerStats && lowerStats > 0) {
        keepLowercase++
      } else if (upperStats && upperStats > 0) {
        keepUppercase++
      }
    }
    
    console.log(chalk.bold.cyan('\n📊 DUPLICATE SUMMARY:'))
    console.log(`  Games where lowercase has stats: ${keepLowercase}`)
    console.log(`  Games where uppercase has stats: ${keepUppercase}`)
    console.log(`  Games where BOTH have stats: ${bothHaveStats}`)
    
    console.log(chalk.bold.yellow('\n🔧 RECOMMENDED ACTIONS:'))
    console.log('1. Merge stats from lowercase games to uppercase games')
    console.log('2. Update all lowercase sports to uppercase')
    console.log('3. Delete duplicate games after merging')
  } else {
    console.log(chalk.green('✅ No duplicate games found!'))
  }
  
  // Also check for inconsistent external_ids
  console.log(chalk.bold.cyan('\n🔍 Checking for external_id patterns...\n'))
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('external_id, sport')
    .in('sport', ['nfl', 'NFL'])
    .limit(20)
    
  if (sampleGames) {
    const patterns = new Map<string, number>()
    sampleGames.forEach(g => {
      const pattern = g.external_id.match(/^(espn_)?([a-zA-Z]+)_/) ? 
        g.external_id.substring(0, g.external_id.lastIndexOf('_')) : 'other'
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1)
    })
    
    console.log('External ID patterns found:')
    patterns.forEach((count, pattern) => {
      console.log(`  "${pattern}_...": ${count} games`)
    })
  }
}

checkSportDuplicates().catch(console.error)