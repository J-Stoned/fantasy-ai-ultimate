#!/usr/bin/env tsx
/**
 * DEBUG NFL COLLECTION
 * Figure out why stats aren't being saved
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

async function debugNFLCollection() {
  console.log(chalk.bold.yellow('🔍 DEBUG NFL COLLECTION\n'))
  
  // Get a few NFL games without stats
  const { data: allNFLGames } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_team_id, away_team_id')
    .eq('sport', 'NFL')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(100)
    
  if (!allNFLGames || allNFLGames.length === 0) {
    console.log('No NFL games found')
    return
  }
  
  // Check which have stats
  const gameIds = allNFLGames.map(g => g.id)
  const { data: gamesWithStatsData } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', gameIds)
    
  const gamesWithStats = new Set(gamesWithStatsData?.map(s => s.game_id))
  const gamesWithoutStats = allNFLGames.filter(g => !gamesWithStats.has(g.id))
  
  console.log(`Found ${gamesWithoutStats.length} NFL games without stats`)
  
  if (gamesWithoutStats.length === 0) {
    console.log('All sampled games have stats!')
    return
  }
  
  // Test one game in detail
  const testGame = gamesWithoutStats[0]
  console.log(chalk.cyan(`\nTesting game: ${testGame.external_id}`))
  console.log(`Game ID: ${testGame.id}`)
  console.log(`Start time: ${testGame.start_time}`)
  
  try {
    const apiUrl = buildEspnApiUrl(testGame.external_id)
    console.log(`API URL: ${apiUrl}`)
    
    const response = await axios.get(apiUrl!, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    console.log(`Response status: ${response.status}`)
    
    if (response.status === 200 && response.data.boxscore?.players) {
      console.log(chalk.green('✅ API returned data!'))
      
      const players = response.data.boxscore.players
      console.log(`Found ${players.length} team data blocks`)
      
      // Try to extract stats
      let totalStats = 0
      
      players.forEach((teamData: any, i: number) => {
        console.log(`\nTeam ${i + 1}: ${teamData.team?.displayName || 'Unknown'}`)
        console.log(`  homeAway: ${teamData.homeAway}`)
        
        if (teamData.statistics) {
          console.log(`  Statistics groups: ${teamData.statistics.length}`)
          
          Object.values(teamData.statistics || {}).forEach((statGroup: any) => {
            if (statGroup.name && statGroup.athletes) {
              console.log(`    ${statGroup.name}: ${statGroup.athletes.length} athletes`)
              totalStats += statGroup.athletes.length
            }
          })
        }
      })
      
      console.log(chalk.yellow(`\nTotal potential stats: ${totalStats}`))
      
      // Try to save one stat
      if (players.length > 0 && players[0].statistics) {
        const firstTeam = players[0]
        const statGroups = Object.values(firstTeam.statistics || {})
        
        for (const statGroup of statGroups as any[]) {
          if (statGroup.name === 'passing' && statGroup.athletes?.length > 0) {
            const athlete = statGroup.athletes[0]
            console.log(chalk.cyan('\nTrying to save one stat:'))
            console.log(`  Athlete: ${athlete.athlete?.displayName || 'Unknown'}`)
            console.log(`  Athlete ID: ${athlete.athlete?.id}`)
            
            const testStat = {
              player_id: parseInt(athlete.athlete.id),
              game_id: testGame.id,
              team_id: testGame.home_team_id,
              opponent_id: testGame.away_team_id,
              is_home: firstTeam.homeAway === 'home',
              game_date: new Date(testGame.start_time).toISOString().split('T')[0],
              stats: {
                completions: 10,
                attempts: 20,
                passing_yards: 150,
                test: true
              }
            }
            
            // First create player
            const { error: playerError } = await supabase
              .from('players')
              .upsert({
                id: testStat.player_id,
                external_id: `espn_nfl_${testStat.player_id}`,
                name: athlete.athlete?.displayName || `NFL Player ${testStat.player_id}`,
                sport: 'NFL'
              }, { onConflict: 'id' })
              
            if (playerError) {
              console.log(chalk.red(`Player error: ${playerError.message}`))
            } else {
              console.log(chalk.green('✅ Player created/updated'))
            }
            
            // Try to save stat
            const { error: statError, data } = await supabase
              .from('player_game_logs')
              .upsert(testStat, { onConflict: 'player_id,game_id' })
              .select()
              
            if (statError) {
              console.log(chalk.red(`Stat error: ${statError.message}`))
            } else {
              console.log(chalk.green('✅ Stat saved successfully!'))
              console.log('Saved data:', data)
            }
            
            break
          }
        }
      }
    } else {
      console.log(chalk.red('❌ No boxscore data'))
    }
  } catch (error: any) {
    console.log(chalk.red(`Error: ${error.message}`))
  }
}

debugNFLCollection().catch(console.error)