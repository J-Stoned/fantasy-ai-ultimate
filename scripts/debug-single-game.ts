#!/usr/bin/env tsx
/**
 * DEBUG SINGLE GAME
 * Test collecting stats for a single game to see what's happening
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import axios from 'axios'
import * as dotenv from 'dotenv'
import { buildEspnApiUrl } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debugSingleGame() {
  console.log(chalk.bold.red('🔍 DEBUG SINGLE GAME COLLECTION\n'))
  
  // Find a game that should have stats but doesn't
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_team_id, away_team_id, home_score, away_score')
    .eq('sport', 'NBA')
    .not('home_score', 'is', null)
    .gte('start_time', '2024-10-01')
    .lte('start_time', '2024-12-31')
    .order('start_time', { ascending: false })
    .limit(1)
    .single()
    
  if (!game) {
    console.log('No game found')
    return
  }
  
  console.log(chalk.yellow('Game details:'))
  console.log(`  ID: ${game.id}`)
  console.log(`  External ID: ${game.external_id}`)
  console.log(`  Sport: ${game.sport}`)
  console.log(`  Date: ${new Date(game.start_time).toLocaleDateString()}`)
  console.log(`  Score: ${game.home_score}-${game.away_score}\n`)
  
  // Check existing stats
  const { data: existingStats, count } = await supabase
    .from('player_game_logs')
    .select('player_id, stats', { count: 'exact' })
    .eq('game_id', game.id)
    .limit(3)
    
  console.log(chalk.cyan(`Existing stats: ${count || 0}`))
  if (existingStats && existingStats.length > 0) {
    console.log('Sample stats:')
    existingStats.forEach(stat => {
      const keys = Object.keys(stat.stats || {})
      console.log(`  Player ${stat.player_id}: ${keys.slice(0, 5).join(', ')}`)
    })
  }
  
  if (count && count > 15) {
    console.log(chalk.green('\n✅ This game already has stats!'))
    return
  }
  
  // Try to fetch from API
  console.log(chalk.yellow('\n📡 Fetching from ESPN API...'))
  
  const apiUrl = buildEspnApiUrl(game.external_id)
  if (!apiUrl) {
    console.log(chalk.red('Could not build API URL'))
    return
  }
  
  console.log(`URL: ${apiUrl}`)
  
  try {
    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    console.log(`Response status: ${response.status}`)
    
    if (response.status === 200) {
      const hasBoxscore = !!response.data.boxscore
      const hasPlayers = !!response.data.boxscore?.players
      const playerCount = response.data.boxscore?.players?.length || 0
      
      console.log(`Has boxscore: ${hasBoxscore}`)
      console.log(`Has players: ${hasPlayers}`)
      console.log(`Player teams: ${playerCount}`)
      
      if (hasPlayers && playerCount > 0) {
        const firstTeam = response.data.boxscore.players[0]
        console.log(`\nFirst team: ${firstTeam.team?.displayName || 'Unknown'}`)
        console.log(`Has statistics: ${!!firstTeam.statistics}`)
        
        if (firstTeam.statistics && firstTeam.statistics.length > 0) {
          const statGroup = firstTeam.statistics[0]
          console.log(`Stat group has athletes: ${!!statGroup.athletes}`)
          console.log(`Number of athletes: ${statGroup.athletes?.length || 0}`)
          
          if (statGroup.athletes && statGroup.athletes.length > 0) {
            const firstAthlete = statGroup.athletes[0]
            console.log(`\nFirst athlete: ${firstAthlete.athlete?.displayName || 'Unknown'}`)
            console.log(`Stats array length: ${firstAthlete.stats?.length || 0}`)
            
            if (firstAthlete.stats && firstAthlete.stats.length > 0) {
              console.log(`First 5 stats: ${firstAthlete.stats.slice(0, 5).join(', ')}`)
            }
            
            // Try to extract and save one player's stats
            if (firstAthlete.stats && firstAthlete.stats.length >= 14) {
              console.log(chalk.yellow('\n🚀 Attempting to save stats...'))
              
              const minutesStr = firstAthlete.stats[0]
              if (minutesStr !== 'DNP') {
                const playerStat = {
                  player_id: parseInt(firstAthlete.athlete.id),
                  game_id: game.id,
                  team_id: game.home_team_id,
                  opponent_id: game.away_team_id,
                  is_home: true,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  stats: {
                    minutes_played: parseInt(minutesStr) || 0,
                    points: parseInt(firstAthlete.stats[13]) || 0,
                    rebounds: parseInt(firstAthlete.stats[6]) || 0,
                    assists: parseInt(firstAthlete.stats[7]) || 0,
                    fantasy_points: 0
                  }
                }
                
                // Create player first
                await supabase
                  .from('players')
                  .upsert({
                    id: playerStat.player_id,
                    external_id: `espn_nba_${playerStat.player_id}`,
                    name: firstAthlete.athlete.displayName || `NBA Player ${playerStat.player_id}`,
                    sport: 'NBA'
                  }, { onConflict: 'id', ignoreDuplicates: true })
                
                // Try to save stat
                const { data, error } = await supabase
                  .from('player_game_logs')
                  .upsert(playerStat, { 
                    onConflict: 'player_id,game_id',
                    ignoreDuplicates: true
                  })
                  .select()
                  
                if (error) {
                  console.log(chalk.red(`Error: ${error.message}`))
                } else if (data && data.length > 0) {
                  console.log(chalk.green('✅ Successfully saved stat!'))
                  console.log(`Player: ${data[0].player_id}`)
                  console.log(`Points: ${data[0].stats.points}`)
                } else {
                  console.log(chalk.yellow('No data returned (possibly already exists)'))
                }
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.log(chalk.red(`API Error: ${error.message}`))
  }
}

debugSingleGame().catch(console.error)