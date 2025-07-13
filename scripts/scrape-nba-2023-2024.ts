#!/usr/bin/env tsx
/**
 * SCRAPE NBA 2023-2024 SEASON STATS
 * Focused on NBA games with proper sport values
 */

import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import * as dotenv from 'dotenv'
import * as os from 'os'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 4)

console.log(chalk.bold.red(`🏀 SCRAPING NBA 2023-2024 SEASON STATS!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

async function scrapeNba20232024() {
  // NBA season runs October 2023 to June 2024
  const startDate = new Date('2023-10-01')
  const endDate = new Date('2024-06-30')
  
  console.log(chalk.cyan(`Fetching NBA games from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`))
  
  // Get games with existing stats
  const gamesWithStats = new Set<number>()
  let offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .range(offset, offset + 999)
    
    if (!data || data.length === 0) break
    
    data.forEach(row => gamesWithStats.add(row.game_id))
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.cyan(`Games with stats: ${gamesWithStats.size.toLocaleString()}`))
  
  // Get NBA games specifically
  const gamesToProcess = []
  offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
      .or('sport.eq.NBA,sport.eq.nba')  // Handle both cases
      .like('external_id', 'espn_nba_%')  // NBA games only
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .range(offset, offset + 999)
      .order('start_time', { ascending: true })
    
    if (!data || data.length === 0) break
    
    const needingStats = data.filter(g => !gamesWithStats.has(g.id))
    gamesToProcess.push(...needingStats)
    
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.bold.red(`\n🎯 NBA GAMES NEEDING STATS: ${gamesToProcess.length}\n`))
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('✅ All NBA games have stats!'))
    return
  }
  
  // Show sample games
  console.log(chalk.cyan('Sample games:'))
  gamesToProcess.slice(0, 10).forEach(g => {
    const date = new Date(g.start_time)
    console.log(`  ${g.external_id} - ${date.toLocaleDateString()} - Score: ${g.home_score}-${g.away_score}`)
  })
  
  // Process games
  let processed = 0
  let successCount = 0
  let totalStats = 0
  let apiErrors = 0
  const startTime = Date.now()
  
  console.log(chalk.yellow('\n🚀 Starting NBA stats scrape...\n'))
  
  const promises = gamesToProcess.map(game => 
    limit(async () => {
      try {
        // Extract ESPN ID
        const espnId = game.external_id.split('_')[2]
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
        
        const response = await axios.get(url, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        })
        
        if (response.status === 404) {
          apiErrors++
        } else if (response.status === 200 && response.data.boxscore) {
          const stats = extractNbaStats(response.data.boxscore, game)
          
          if (stats.length > 0) {
            await saveStats(stats)
            successCount++
            totalStats += stats.length
            
            if (successCount === 1 || successCount % 20 === 0) {
              console.log(chalk.green(`✅ ${successCount} games with stats, ${totalStats.toLocaleString()} player stats`))
            }
          }
        }
        
      } catch (error: any) {
        apiErrors++
        if (apiErrors === 1) {
          console.error(chalk.red(`First error: ${error.message}`))
        }
      }
      
      processed++
      
      if (processed % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = processed / elapsed
        const remaining = (gamesToProcess.length - processed) / rate
        console.log(chalk.cyan(
          `Progress: ${processed}/${gamesToProcess.length} - ` +
          `${successCount} games - ${totalStats} stats - ` +
          `${rate.toFixed(1)} games/sec - ` +
          `ETA: ${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s`
        ))
      }
    })
  )
  
  await Promise.all(promises)
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green('\n✅ NBA SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${processed}`))
  console.log(chalk.white(`  Games with stats: ${successCount}`))
  console.log(chalk.white(`  Player stats saved: ${totalStats.toLocaleString()}`))
  console.log(chalk.white(`  API errors: ${apiErrors}`))
  console.log(chalk.white(`  Success rate: ${(successCount / processed * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  
  // Check new total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 TOTAL PLAYER STATS: ${count?.toLocaleString() || 0}!`))
}

function extractNbaStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    boxscore.teams?.forEach((team: any) => {
      const teamId = parseInt(team.team.id)
      const isHome = team.homeAway === 'home'
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      team.statistics?.forEach((stat: any) => {
        if (stat.type === 'players' && stat.athletes) {
          stat.athletes.forEach((athlete: any) => {
            // Must have played (minutes > 0)
            if (athlete.stats && athlete.stats.length >= 20 && parseInt(athlete.stats[0]) > 0) {
              const playerStat = {
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: {
                  minutes: parseInt(athlete.stats[0]) || 0,
                  field_goals_made: parseInt(athlete.stats[1]) || 0,
                  field_goals_attempted: parseInt(athlete.stats[2]) || 0,
                  field_goal_percentage: parseFloat(athlete.stats[3]) || 0,
                  three_pointers_made: parseInt(athlete.stats[4]) || 0,
                  three_pointers_attempted: parseInt(athlete.stats[5]) || 0,
                  three_point_percentage: parseFloat(athlete.stats[6]) || 0,
                  free_throws_made: parseInt(athlete.stats[7]) || 0,
                  free_throws_attempted: parseInt(athlete.stats[8]) || 0,
                  free_throw_percentage: parseFloat(athlete.stats[9]) || 0,
                  offensive_rebounds: parseInt(athlete.stats[10]) || 0,
                  defensive_rebounds: parseInt(athlete.stats[11]) || 0,
                  rebounds: parseInt(athlete.stats[12]) || 0,
                  assists: parseInt(athlete.stats[13]) || 0,
                  steals: parseInt(athlete.stats[14]) || 0,
                  blocks: parseInt(athlete.stats[15]) || 0,
                  turnovers: parseInt(athlete.stats[16]) || 0,
                  personal_fouls: parseInt(athlete.stats[17]) || 0,
                  plus_minus: parseInt(athlete.stats[18]) || 0,
                  points: parseInt(athlete.stats[19]) || 0
                }
              }
              
              // Validate the stats make sense
              if (playerStat.stats.points >= 0 && playerStat.stats.minutes > 0) {
                stats.push(playerStat)
              }
            }
          })
        }
      })
    })
  } catch (error) {
    console.error(chalk.red(`Error extracting stats for game ${game.external_id}`))
  }
  
  return stats
}

async function saveStats(stats: any[]) {
  if (stats.length === 0) return
  
  // Create players first
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `NBA Player ${id}`,
    sport: 'NBA'
  }))
  
  await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  
  // Save stats in batches
  for (let i = 0; i < stats.length; i += 50) {
    const batch = stats.slice(i, i + 50)
    const { error } = await supabase
      .from('player_game_logs')
      .upsert(batch, { onConflict: 'player_id,game_id' })
      
    if (error) {
      console.error(chalk.red(`Error saving batch: ${error.message}`))
    }
  }
}

// RUN IT!
scrapeNba20232024().catch(console.error)