#!/usr/bin/env tsx
/**
 * SMART STATS COLLECTOR
 * Properly handles constraint issues and maximizes collection
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
const limit = pLimit(cpuCount * 2) // Less aggressive to avoid conflicts

async function smartStatsCollector() {
  console.log(chalk.bold.red('🧠 SMART STATS COLLECTOR\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats\n`))
  
  // Get actual coverage by sport
  const sports = ['NFL', 'NBA', 'NHL', 'MLB', 'NCAAF', 'NCAAB']
  const targetSports: string[] = []
  
  console.log(chalk.yellow('📊 Checking real coverage:\n'))
  
  for (const sport of sports) {
    // Get total games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .gte('start_time', '2023-01-01')
      .lte('start_time', new Date().toISOString())
      
    // Get games with stats (sampling approach)
    const { data: sampleGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .limit(200)
      
    let gamesWithStats = 0
    for (const game of sampleGames || []) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1)
        
      if (count && count > 0) gamesWithStats++
    }
    
    const coverage = (gamesWithStats / (sampleGames?.length || 1)) * 100
    console.log(`  ${sport}: ${coverage.toFixed(1)}% coverage (${totalGames} total games)`)
    
    // Target sports with < 95% coverage
    if (coverage < 95 && totalGames && totalGames > 0) {
      targetSports.push(sport)
    }
  }
  
  if (targetSports.length === 0) {
    console.log(chalk.green('\n✅ All sports have excellent coverage!'))
    return
  }
  
  console.log(chalk.bold.yellow(`\n🎯 Targeting: ${targetSports.join(', ')}\n`))
  
  let totalNewStats = 0
  
  // Process each target sport
  for (const sport of targetSports) {
    console.log(chalk.bold.cyan(`\n⚡ Processing ${sport}:`))
    
    // Get games without stats more efficiently
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .gte('start_time', '2023-01-01')
      .lte('start_time', new Date().toISOString())
      .order('start_time', { ascending: false })
      .limit(sport === 'NCAAB' ? 1000 : 500) // More for NCAAB since it has most gaps
      
    if (!games || games.length === 0) continue
    
    // Quick check which games need stats
    const gamesNeedingStats = []
    
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1)
        
      if (!count || count === 0) {
        gamesNeedingStats.push(game)
      }
      
      // Limit to reasonable batch
      if (gamesNeedingStats.length >= 100) break
    }
    
    if (gamesNeedingStats.length === 0) {
      console.log(`  All sampled games have stats!`)
      continue
    }
    
    console.log(`  Found ${gamesNeedingStats.length} games needing stats`)
    
    let successful = 0
    let newStats = 0
    let skipped = 0
    const startTime = Date.now()
    
    const promises = gamesNeedingStats.map(game => 
      limit(async () => {
        try {
          if (!game.external_id?.includes('espn_')) return
          
          // Double-check right before processing
          const { count: recheck } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id)
            .limit(1)
            
          if (recheck && recheck > 0) {
            skipped++
            return
          }
          
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
            const stats = extractStatsBySport(response.data.boxscore, game, sport)
            
            if (stats.length > 0) {
              const saved = await saveStatsCarefully(stats, game, sport)
              if (saved > 0) {
                successful++
                newStats += saved
                
                if (successful % 10 === 0) {
                  const rate = (newStats / ((Date.now() - startTime) / 1000)).toFixed(1)
                  console.log(chalk.green(`    ✅ ${successful} games, ${newStats} stats (${rate}/sec)`))
                }
              }
            }
          }
        } catch (error: any) {
          // Silent fail for connection errors
        }
      })
    )
    
    await Promise.all(promises)
    
    const elapsed = (Date.now() - startTime) / 1000
    console.log(chalk.green(
      `  Complete: ${successful} games processed, ${newStats} new stats, ${skipped} skipped`
    ))
    
    totalNewStats += newStats
  }
  
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
  
  // Show path to 480K
  if (finalCount && finalCount < 480000) {
    const needed = 480000 - finalCount
    console.log(chalk.bold.yellow(`\n🎯 ${needed.toLocaleString()} stats needed to reach 480K goal!`))
  } else if (finalCount && finalCount >= 480000) {
    console.log(chalk.bold.cyan('\n🏆 480K GOAL ACHIEVED!'))
  }
}

function extractStatsBySport(boxscore: any, game: any, sport: string): any[] {
  const stats: any[] = []
  
  try {
    if (!boxscore.players) return stats
    
    boxscore.players.forEach((teamData: any) => {
      const isHome = teamData.homeAway === 'home'
      const teamId = isHome ? game.home_team_id : game.away_team_id
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      if (sport === 'NBA' || sport === 'NCAAB') {
        // Basketball - look for first statistics array
        if (teamData.statistics && teamData.statistics.length > 0) {
          const playerStats = teamData.statistics[0]
          if (playerStats.athletes) {
            playerStats.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length >= 14) {
                const minutesStr = athlete.stats[0]
                if (typeof minutesStr === 'string' && minutesStr !== 'DNP') {
                  const statObj = {
                    player_id: parseInt(athlete.athlete.id),
                    game_id: game.id,
                    team_id: teamId,
                    opponent_id: opponentId,
                    is_home: isHome,
                    game_date: new Date(game.start_time).toISOString().split('T')[0],
                    stats: {
                      minutes_played: parseInt(minutesStr) || 0,
                      points: parseInt(athlete.stats[13]) || 0,
                      rebounds: parseInt(athlete.stats[6]) || 0,
                      assists: parseInt(athlete.stats[7]) || 0,
                      steals: parseInt(athlete.stats[8]) || 0,
                      blocks: parseInt(athlete.stats[9]) || 0,
                      turnovers: parseInt(athlete.stats[10]) || 0,
                      field_goals_made: parseInt(athlete.stats[1]?.split('-')[0]) || 0,
                      field_goals_attempted: parseInt(athlete.stats[1]?.split('-')[1]) || 0,
                      fantasy_points: 0
                    }
                  }
                  // Calculate fantasy points
                  statObj.stats.fantasy_points = 
                    statObj.stats.points + 
                    (statObj.stats.rebounds * 1.25) + 
                    (statObj.stats.assists * 1.5) + 
                    (statObj.stats.steals * 2) + 
                    (statObj.stats.blocks * 2) - 
                    (statObj.stats.turnovers * 0.5)
                  
                  stats.push(statObj)
                }
              }
            })
          }
        }
      } else if (sport === 'NFL' || sport === 'NCAAF') {
        // Football - look for named stat groups
        Object.values(teamData.statistics || {}).forEach((statGroup: any) => {
          if (statGroup.athletes) {
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
              
              if (statGroup.name === 'passing' && athlete.stats.length >= 9) {
                playerStat.stats = {
                  completions: parseInt(athlete.stats[0]?.split('/')[0]) || 0,
                  attempts: parseInt(athlete.stats[0]?.split('/')[1]) || 0,
                  passing_yards: parseInt(athlete.stats[1]) || 0,
                  passing_touchdowns: parseInt(athlete.stats[3]) || 0,
                  interceptions: parseInt(athlete.stats[4]) || 0,
                  fantasy_points: (parseInt(athlete.stats[1]) || 0) * 0.04 + 
                                 (parseInt(athlete.stats[3]) || 0) * 6 - 
                                 (parseInt(athlete.stats[4]) || 0) * 2
                }
                stats.push(playerStat)
              } else if (statGroup.name === 'rushing' && athlete.stats.length >= 4) {
                playerStat.stats = {
                  carries: parseInt(athlete.stats[0]) || 0,
                  rushing_yards: parseInt(athlete.stats[1]) || 0,
                  rushing_touchdowns: parseInt(athlete.stats[3]) || 0,
                  yards_per_carry: parseFloat(athlete.stats[2]) || 0,
                  fantasy_points: (parseInt(athlete.stats[1]) || 0) * 0.1 + 
                                 (parseInt(athlete.stats[3]) || 0) * 6
                }
                stats.push(playerStat)
              } else if (statGroup.name === 'receiving' && athlete.stats.length >= 5) {
                playerStat.stats = {
                  receptions: parseInt(athlete.stats[0]) || 0,
                  targets: parseInt(athlete.stats[4]) || 0,
                  receiving_yards: parseInt(athlete.stats[1]) || 0,
                  receiving_touchdowns: parseInt(athlete.stats[3]) || 0,
                  fantasy_points: (parseInt(athlete.stats[0]) || 0) * 1 + 
                                 (parseInt(athlete.stats[1]) || 0) * 0.1 + 
                                 (parseInt(athlete.stats[3]) || 0) * 6
                }
                stats.push(playerStat)
              }
            })
          }
        })
      } else if (sport === 'NHL') {
        // NHL - array-based statistics
        if (teamData.statistics && Array.isArray(teamData.statistics)) {
          teamData.statistics.forEach((statGroup: any, index: number) => {
            if (statGroup.athletes) {
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
                
                if (index === 2 && athlete.stats.length >= 12) {
                  // Goalie stats
                  playerStat.stats = {
                    goals_against: parseInt(athlete.stats[0]) || 0,
                    saves: parseInt(athlete.stats[1]) || 0,
                    save_percentage: parseFloat(athlete.stats[6]) || 0,
                    is_goalie: true,
                    fantasy_points: (parseInt(athlete.stats[1]) || 0) * 0.2 - 
                                   (parseInt(athlete.stats[0]) || 0)
                  }
                  stats.push(playerStat)
                } else if (athlete.stats.length >= 21) {
                  // Skater stats
                  playerStat.stats = {
                    goals: parseInt(athlete.stats[0]) || 0,
                    assists: parseInt(athlete.stats[1]) || 0,
                    points: parseInt(athlete.stats[2]) || 0,
                    shots: parseInt(athlete.stats[8]) || 0,
                    blocks: parseInt(athlete.stats[17]) || 0,
                    fantasy_points: (parseInt(athlete.stats[0]) || 0) * 3 + 
                                   (parseInt(athlete.stats[1]) || 0) * 2 +
                                   (parseInt(athlete.stats[8]) || 0) * 0.4 +
                                   (parseInt(athlete.stats[17]) || 0) * 0.4
                  }
                  stats.push(playerStat)
                }
              })
            }
          })
        }
      } else if (sport === 'MLB') {
        // MLB - array-based statistics
        if (teamData.statistics && Array.isArray(teamData.statistics)) {
          teamData.statistics.forEach((statGroup: any, index: number) => {
            if (statGroup.athletes) {
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
                
                if (index === 0 && athlete.stats.length >= 12) {
                  // Batting stats
                  const abStr = athlete.stats[0]
                  const [hits, atBats] = abStr.split('-').map((s: string) => parseInt(s) || 0)
                  
                  playerStat.stats = {
                    at_bats: atBats,
                    hits: hits,
                    runs: parseInt(athlete.stats[2]) || 0,
                    rbi: parseInt(athlete.stats[3]) || 0,
                    walks: parseInt(athlete.stats[4]) || 0,
                    strikeouts: parseInt(athlete.stats[5]) || 0,
                    is_pitcher: false,
                    fantasy_points: hits + 
                                   (parseInt(athlete.stats[2]) || 0) +
                                   (parseInt(athlete.stats[3]) || 0) +
                                   (parseInt(athlete.stats[4]) || 0)
                  }
                  stats.push(playerStat)
                } else if (index === 1 && athlete.stats.length >= 10) {
                  // Pitching stats
                  playerStat.stats = {
                    innings_pitched: parseFloat(athlete.stats[0]) || 0,
                    strikeouts_pitched: parseInt(athlete.stats[5]) || 0,
                    earned_runs: parseInt(athlete.stats[3]) || 0,
                    is_pitcher: true,
                    fantasy_points: (parseFloat(athlete.stats[0]) || 0) * 3 +
                                   (parseInt(athlete.stats[5]) || 0) -
                                   (parseInt(athlete.stats[3]) || 0)
                  }
                  stats.push(playerStat)
                }
              })
            }
          })
        }
      }
    })
  } catch (error) {
    // Silent fail
  }
  
  return stats
}

async function saveStatsCarefully(stats: any[], game: any, sport: string): Promise<number> {
  if (stats.length === 0) return 0
  
  // Create players first
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${sport.toLowerCase()}_${id}`,
    name: `${sport} Player ${id}`,
    sport
  }))
  
  // Upsert players in batches
  for (let i = 0; i < players.length; i += 100) {
    const batch = players.slice(i, i + 100)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  // Remove duplicates within this batch
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat)
    }
  })
  
  const uniqueStatsArray = Array.from(uniqueStats.values())
  
  // Save stats with proper error handling
  let saved = 0
  for (let i = 0; i < uniqueStatsArray.length; i += 50) {
    const batch = uniqueStatsArray.slice(i, i + 50)
    try {
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { 
          onConflict: 'player_id,game_id',
          ignoreDuplicates: true // This is key!
        })
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

// Run it!
smartStatsCollector().catch(console.error)