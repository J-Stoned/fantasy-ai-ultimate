#!/usr/bin/env tsx
/**
 * COLLECT NHL AND MLB STATS
 * Now that we understand the API structure!
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import axios from 'axios'
import pLimit from 'p-limit'
import * as dotenv from 'dotenv'
import * as os from 'os'
import { buildEspnApiUrl } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 3)

async function collectNHLMLBStats() {
  console.log(chalk.bold.red('🏒⚾ NHL AND MLB STATS COLLECTION\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats\n`))
  
  let totalNewStats = 0
  
  // Process NHL
  console.log(chalk.bold.yellow('🏒 NHL COLLECTION:\n'))
  const nhlStats = await processSport('NHL', 500)
  totalNewStats += nhlStats
  
  // Process MLB
  console.log(chalk.bold.yellow('\n⚾ MLB COLLECTION:\n'))
  const mlbStats = await processSport('MLB', 500)
  totalNewStats += mlbStats
  
  // Final count
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.bold.red('\n📊 FINAL RESULTS:'))
  console.log(`  🚀 Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  🏆 Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  📈 NET GAIN: ${((finalCount || 0) - (startingCount || 0)).toLocaleString()} NEW STATS`)
  
  if (totalNewStats > 0) {
    console.log(chalk.bold.green(`\n🎉 SUCCESS: Collected ${totalNewStats} new stats!`))
  }
}

async function processSport(sport: string, maxGames: number): Promise<number> {
  // Get games without stats
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_team_id, away_team_id')
    .eq('sport', sport)
    .not('home_score', 'is', null)
    .gte('start_time', '2023-01-01')
    .lte('start_time', new Date().toISOString())
    .order('start_time', { ascending: false })
    .limit(maxGames)
    
  if (!games || games.length === 0) {
    console.log(`  No ${sport} games found`)
    return 0
  }
  
  console.log(`  Found ${games.length} ${sport} games`)
  
  let successful = 0
  let newStats = 0
  let errors = 0
  const startTime = Date.now()
  
  const promises = games.map(game => 
    limit(async () => {
      try {
        if (!game.external_id) return
        
        const apiUrl = buildEspnApiUrl(game.external_id)
        if (!apiUrl) return
        
        const response = await axios.get(apiUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        
        if (response.status === 200 && response.data.boxscore?.players) {
          const stats = sport === 'NHL' ? 
            extractNHLStats(response.data.boxscore, game) :
            extractMLBStats(response.data.boxscore, game)
          
          if (stats.length > 0) {
            const saved = await saveStats(stats, sport)
            if (saved > 0) {
              successful++
              newStats += saved
              
              if (successful % 10 === 0) {
                const rate = (newStats / ((Date.now() - startTime) / 1000)).toFixed(1)
                console.log(chalk.green(`    ⚡ ${successful} games, ${newStats} stats (${rate}/sec)`))
              }
            }
          }
        }
      } catch (error: any) {
        if (!error.message?.includes('ECONNRESET')) {
          errors++
        }
      }
    })
  )
  
  await Promise.all(promises)
  
  const elapsed = (Date.now() - startTime) / 1000
  const rate = (newStats / elapsed).toFixed(1)
  
  console.log(chalk.green(
    `  🎉 ${sport} complete: ${successful}/${games.length} games, ` +
    `${newStats} stats in ${elapsed.toFixed(1)}s (${rate} stats/sec)`
  ))
  
  if (errors > 0) {
    console.log(chalk.yellow(`  ⚠️  ${errors} errors`))
  }
  
  return newStats
}

function extractNHLStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        if (teamData.statistics && Array.isArray(teamData.statistics)) {
          // NHL has 3 stat groups: forwards (0), defensemen (1), goalies (2)
          teamData.statistics.forEach((statGroup: any, index: number) => {
            if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
              statGroup.athletes.forEach((athlete: any) => {
                if (!athlete.stats || athlete.stats.length === 0) return
                
                const playerStat: any = {
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  stats: {}
                }
                
                if (index === 2) {
                  // Goalie stats (12 values)
                  if (athlete.stats.length >= 12) {
                    playerStat.stats = {
                      goals_against: parseInt(athlete.stats[0]) || 0,
                      saves: parseInt(athlete.stats[1]) || 0,
                      save_percentage: parseFloat(athlete.stats[6]) || 0,
                      time_on_ice: athlete.stats[11] || '0:00',
                      is_goalie: true,
                      fantasy_points: (parseInt(athlete.stats[1]) || 0) * 0.2 + 
                                     (parseInt(athlete.stats[0]) || 0) * -1
                    }
                    stats.push(playerStat)
                  }
                } else {
                  // Skater stats (21 values)
                  if (athlete.stats.length >= 21) {
                    playerStat.stats = {
                      goals: parseInt(athlete.stats[0]) || 0,
                      assists: parseInt(athlete.stats[1]) || 0,
                      points: parseInt(athlete.stats[2]) || 0,
                      plus_minus: parseInt(athlete.stats[3]?.toString().replace('+', '')) || 0,
                      time_on_ice: athlete.stats[4] || '0:00',
                      power_play_goals: parseInt(athlete.stats[5]) || 0,
                      shots: parseInt(athlete.stats[8]) || 0,
                      hits: parseInt(athlete.stats[16]) || 0,
                      blocks: parseInt(athlete.stats[17]) || 0,
                      fantasy_points: (parseInt(athlete.stats[0]) || 0) * 3 + 
                                     (parseInt(athlete.stats[1]) || 0) * 2 +
                                     (parseInt(athlete.stats[8]) || 0) * 0.4 +
                                     (parseInt(athlete.stats[17]) || 0) * 0.4
                    }
                    stats.push(playerStat)
                  }
                }
              })
            }
          })
        }
      })
    }
  } catch (error) {
    // Silent fail
  }
  
  return stats
}

function extractMLBStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        if (teamData.statistics && Array.isArray(teamData.statistics)) {
          // MLB has 2 stat groups: batters (0), pitchers (1)
          teamData.statistics.forEach((statGroup: any, index: number) => {
            if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
              statGroup.athletes.forEach((athlete: any) => {
                if (!athlete.stats || athlete.stats.length === 0) return
                
                const playerStat: any = {
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  stats: {}
                }
                
                if (index === 0) {
                  // Batting stats (12 values)
                  if (athlete.stats.length >= 12) {
                    const abStr = athlete.stats[0] // Format: "2-5"
                    const [hits, atBats] = abStr.split('-').map((s: string) => parseInt(s) || 0)
                    
                    playerStat.stats = {
                      at_bats: atBats,
                      hits: hits,
                      runs: parseInt(athlete.stats[2]) || 0,
                      rbi: parseInt(athlete.stats[3]) || 0,
                      walks: parseInt(athlete.stats[4]) || 0,
                      strikeouts: parseInt(athlete.stats[5]) || 0,
                      batting_average: atBats > 0 ? (hits / atBats) : 0,
                      is_pitcher: false,
                      fantasy_points: (hits * 1) + 
                                     (parseInt(athlete.stats[2]) || 0) * 1 +
                                     (parseInt(athlete.stats[3]) || 0) * 1 +
                                     (parseInt(athlete.stats[4]) || 0) * 1
                    }
                    stats.push(playerStat)
                  }
                } else {
                  // Pitching stats (10 values)
                  if (athlete.stats.length >= 10) {
                    playerStat.stats = {
                      innings_pitched: parseFloat(athlete.stats[0]) || 0,
                      hits_allowed: parseInt(athlete.stats[1]) || 0,
                      runs_allowed: parseInt(athlete.stats[2]) || 0,
                      earned_runs: parseInt(athlete.stats[3]) || 0,
                      walks_allowed: parseInt(athlete.stats[4]) || 0,
                      strikeouts_pitched: parseInt(athlete.stats[5]) || 0,
                      is_pitcher: true,
                      fantasy_points: (parseFloat(athlete.stats[0]) || 0) * 3 +
                                     (parseInt(athlete.stats[5]) || 0) * 1 -
                                     (parseInt(athlete.stats[3]) || 0) * 1
                    }
                    stats.push(playerStat)
                  }
                }
              })
            }
          })
        }
      })
    }
  } catch (error) {
    // Silent fail
  }
  
  return stats
}

async function saveStats(stats: any[], sport: string): Promise<number> {
  if (stats.length === 0) return 0
  
  // Create players first
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${sport.toLowerCase()}_${id}`,
    name: `${sport} Player ${id}`,
    sport
  }))
  
  await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  
  // Remove duplicates
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat)
    }
  })
  
  const uniqueStatsArray = Array.from(uniqueStats.values())
  
  // Save in batches
  let saved = 0
  for (let i = 0; i < uniqueStatsArray.length; i += 50) {
    const batch = uniqueStatsArray.slice(i, i + 50)
    try {
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
        .select()
        
      if (!error && data) {
        saved += data.length
      }
    } catch (error) {
      // Continue on errors
    }
  }
  
  return saved
}

// RUN IT!
collectNHLMLBStats().catch(console.error)