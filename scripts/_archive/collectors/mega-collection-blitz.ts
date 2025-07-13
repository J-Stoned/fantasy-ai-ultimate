#!/usr/bin/env tsx
/**
 * MEGA COLLECTION BLITZ
 * Go ALL OUT on collecting the maximum possible stats from ALL sports!
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
const limit = pLimit(cpuCount * 3) // AGGRESSIVE concurrency

async function megaCollectionBlitz() {
  console.log(chalk.bold.red('🔥 MEGA COLLECTION BLITZ - ALL OUT ATTACK!\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting with ${startingCount?.toLocaleString() || 0} player stats`))
  console.log(chalk.yellow('🎯 TARGET: Collect 50K+ MORE stats across ALL sports!\n'))
  
  // Get ALL sports and their data
  console.log(chalk.cyan('📊 ANALYZING ALL AVAILABLE DATA...'))
  
  const sportTargets = [
    { sport: 'NCAAB', priority: 'ULTRA_HIGH', expectedGames: 7000 },
    { sport: 'NBA', priority: 'HIGH', expectedGames: 6000 },
    { sport: 'NHL', priority: 'HIGH', expectedGames: 3500 },
    { sport: 'NFL', priority: 'HIGH', expectedGames: 2000 },
    { sport: 'MLB', priority: 'MEDIUM', expectedGames: 2500 },
    { sport: 'NCAAF', priority: 'MEDIUM', expectedGames: 1500 },
    { sport: 'NCAA_BB', priority: 'MEDIUM', expectedGames: 2500 }
  ]
  
  let totalNewStats = 0
  
  for (const target of sportTargets) {
    console.log(chalk.bold.yellow(`\n🏆 ${target.sport} BLITZ (${target.priority} PRIORITY):`))
    
    // Get games for this sport
    const { data: sportGames } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id, home_score, away_score')
      .eq('sport', target.sport)
      .not('home_score', 'is', null) // Only completed games
      .gte('start_time', '2022-01-01') // Recent games
      .lte('start_time', '2024-12-31')
      .limit(target.expectedGames)
      
    if (!sportGames || sportGames.length === 0) {
      console.log(chalk.gray(`  No ${target.sport} games found`))
      continue
    }
    
    console.log(chalk.cyan(`  Found ${sportGames.length} ${target.sport} games`))
    
    // Check which ones need stats
    const gameIds = sportGames.map(g => g.id)
    const gamesWithStats = new Set<number>()
    
    // Check in efficient batches
    for (let i = 0; i < gameIds.length; i += 2000) {
      const batch = gameIds.slice(i, i + 2000)
      const { data } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', batch)
        
      data?.forEach(row => gamesWithStats.add(row.game_id))
    }
    
    const missingGames = sportGames.filter(g => !gamesWithStats.has(g.id))
    console.log(chalk.yellow(`  🎯 ${missingGames.length} games need stats!`))
    
    if (missingGames.length === 0) {
      console.log(chalk.green(`  ✅ All ${target.sport} games already have stats!`))
      continue
    }
    
    // BLITZ COLLECTION
    let successful = 0
    let newStats = 0
    let errors = 0
    const startTime = Date.now()
    
    // Scale batch size by priority
    const batchSize = target.priority === 'ULTRA_HIGH' ? 1000 : 
                      target.priority === 'HIGH' ? 500 : 200
    
    const gamesToProcess = missingGames.slice(0, batchSize)
    console.log(chalk.cyan(`  🚀 Processing ${gamesToProcess.length} games with ${cpuCount}x${3} concurrent threads...`))
    
    const promises = gamesToProcess.map(game => 
      limit(async () => {
        try {
          if (!game.external_id?.includes('espn_')) {
            return // Skip non-ESPN games
          }
          
          const apiUrl = buildEspnApiUrl(game.external_id)
          if (!apiUrl) return
          
          const response = await axios.get(apiUrl, {
            timeout: 10000, // Longer timeout for college games
            validateStatus: (status) => status < 500,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          })
          
          if (response.status === 200 && response.data.boxscore?.players) {
            const stats = extractStatsForSport(response.data.boxscore, game, target.sport)
            
            if (stats.length > 0) {
              const statsWithDate = stats.map(stat => ({
                ...stat,
                game_date: new Date(game.start_time).toISOString().split('T')[0]
              }))
              
              await saveStats(statsWithDate, target.sport)
              successful++
              newStats += stats.length
              
              if (successful % 25 === 0) {
                console.log(chalk.green(`    ⚡ ${successful} games, ${newStats} stats`))
              }
            }
          } else if (response.status === 404) {
            errors++
          }
        } catch (error: any) {
          if (!error.message?.includes('ECONNRESET') && !error.message?.includes('timeout')) {
            errors++
          }
        }
      })
    )
    
    await Promise.all(promises)
    
    const elapsed = (Date.now() - startTime) / 1000
    const rate = (newStats / elapsed).toFixed(1)
    
    console.log(chalk.bold.green(
      `  🎉 ${target.sport} BLITZ COMPLETE: ${successful}/${gamesToProcess.length} games, ` +
      `${newStats} stats in ${elapsed.toFixed(1)}s (${rate} stats/sec)` +
      (errors > 0 ? ` [${errors} errors]` : '')
    ))
    
    totalNewStats += newStats
    
    // Real-time total update
    const { count: currentTotal } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      
    console.log(chalk.bold.cyan(`  📈 RUNNING TOTAL: ${currentTotal?.toLocaleString()} stats (+${totalNewStats})\n`))
  }
  
  // FINAL RESULTS
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  const netGain = (finalCount || 0) - (startingCount || 0)
  
  console.log(chalk.bold.red('🔥 MEGA BLITZ COMPLETE!\n'))
  console.log(chalk.bold.yellow('📊 FINAL RESULTS:'))
  console.log(`  🚀 Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  🎯 Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  📈 NET GAIN: ${netGain.toLocaleString()} NEW STATS`)
  console.log(`  ⚡ Collection Rate: ${totalNewStats} stats processed`)
  
  if (netGain >= 10000) {
    console.log(chalk.bold.green('\n🏆 LEGENDARY SUCCESS: 10K+ NEW STATS COLLECTED!'))
  } else if (netGain >= 5000) {
    console.log(chalk.bold.green('\n🎉 EPIC SUCCESS: 5K+ NEW STATS COLLECTED!'))
  } else if (netGain >= 1000) {
    console.log(chalk.bold.green('\n✅ SOLID SUCCESS: 1K+ NEW STATS COLLECTED!'))
  } else {
    console.log(chalk.yellow('\n⚠️  Limited success - check API connectivity'))
  }
  
  console.log(chalk.bold.cyan('\n🚀 NEXT LEVEL UNLOCKED: Ready for advanced pattern analysis!'))
}

// OPTIMIZED stat extraction for ALL sports
function extractStatsForSport(boxscore: any, game: any, sport: string): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        Object.values(teamData.statistics || {}).forEach((statGroup: any) => {
          if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
            statGroup.athletes.forEach((athlete: any) => {
              if (!athlete.stats || athlete.stats.length === 0) return
              
              const playerStats: any = {
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: {}
              }
              
              // BASKETBALL (NBA, NCAAB, NCAA_BB)
              if (sport.includes('NBA') || sport.includes('NCAAB') || sport.includes('NCAA_BB')) {
                if (athlete.stats.length >= 14) {
                  const minutesStr = athlete.stats[0]
                  if (typeof minutesStr === 'string' && minutesStr !== 'DNP' && minutesStr.match(/\d+/)) {
                    const minutes = parseInt(minutesStr)
                    if (minutes >= 0) { // Include 0 minutes players
                      const fgParts = typeof athlete.stats[1] === 'string' ? 
                        athlete.stats[1].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                      const threeParts = typeof athlete.stats[2] === 'string' ? 
                        athlete.stats[2].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                      const ftParts = typeof athlete.stats[3] === 'string' ? 
                        athlete.stats[3].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                      
                      playerStats.stats = {
                        minutes_played: minutes,
                        field_goals_made: fgParts[0] || 0,
                        field_goals_attempted: fgParts[1] || 0,
                        three_pointers_made: threeParts[0] || 0,
                        three_pointers_attempted: threeParts[1] || 0,
                        free_throws_made: ftParts[0] || 0,
                        free_throws_attempted: ftParts[1] || 0,
                        rebounds: parseInt(athlete.stats[6]) || 0,
                        assists: parseInt(athlete.stats[7]) || 0,
                        steals: parseInt(athlete.stats[8]) || 0,
                        blocks: parseInt(athlete.stats[9]) || 0,
                        turnovers: parseInt(athlete.stats[10]) || 0,
                        points: parseInt(athlete.stats[13]) || 0,
                        fantasy_points: calculateFantasyPoints(athlete.stats, 'basketball')
                      }
                    }
                  }
                }
              } 
              // FOOTBALL (NFL, NCAAF)
              else if (sport.includes('NFL') || sport.includes('NCAAF')) {
                if (statGroup.name === 'passing' && athlete.stats.length >= 5) {
                  const compAtt = athlete.stats[0].split('/')
                  playerStats.stats = {
                    completions: parseInt(compAtt[0]) || 0,
                    attempts: parseInt(compAtt[1]) || 0,
                    passing_yards: parseInt(athlete.stats[1]) || 0,
                    passing_touchdowns: parseInt(athlete.stats[3]) || 0,
                    interceptions: parseInt(athlete.stats[4]) || 0,
                    fantasy_points: calculateFantasyPoints(athlete.stats, 'passing')
                  }
                } else if (statGroup.name === 'rushing' && athlete.stats.length >= 4) {
                  playerStats.stats = {
                    carries: parseInt(athlete.stats[0]) || 0,
                    rushing_yards: parseInt(athlete.stats[1]) || 0,
                    rushing_touchdowns: parseInt(athlete.stats[3]) || 0,
                    fantasy_points: calculateFantasyPoints(athlete.stats, 'rushing')
                  }
                } else if (statGroup.name === 'receiving' && athlete.stats.length >= 4) {
                  playerStats.stats = {
                    receptions: parseInt(athlete.stats[0]) || 0,
                    receiving_yards: parseInt(athlete.stats[1]) || 0,
                    receiving_touchdowns: parseInt(athlete.stats[3]) || 0,
                    fantasy_points: calculateFantasyPoints(athlete.stats, 'receiving')
                  }
                }
              }
              // HOCKEY (NHL)
              else if (sport.includes('NHL')) {
                if (statGroup.name === 'skaters' && athlete.stats.length >= 8) {
                  playerStats.stats = {
                    goals: parseInt(athlete.stats[0]) || 0,
                    assists: parseInt(athlete.stats[1]) || 0,
                    points: parseInt(athlete.stats[2]) || 0,
                    shots: parseInt(athlete.stats[5]) || 0,
                    hits: parseInt(athlete.stats[6]) || 0,
                    blocks: parseInt(athlete.stats[7]) || 0,
                    fantasy_points: calculateFantasyPoints(athlete.stats, 'hockey')
                  }
                }
              }
              // BASEBALL (MLB)
              else if (sport.includes('MLB')) {
                if (statGroup.name === 'batting' && athlete.stats.length >= 6) {
                  playerStats.stats = {
                    at_bats: parseInt(athlete.stats[0]) || 0,
                    runs: parseInt(athlete.stats[1]) || 0,
                    hits: parseInt(athlete.stats[2]) || 0,
                    rbi: parseInt(athlete.stats[3]) || 0,
                    fantasy_points: calculateFantasyPoints(athlete.stats, 'batting')
                  }
                }
              }
              
              if (Object.keys(playerStats.stats).length > 0) {
                stats.push(playerStats)
              }
            })
          }
        })
      })
    }
  } catch (error) {
    // Silent fail but continue
  }
  
  return stats
}

// Calculate fantasy points for different stat types
function calculateFantasyPoints(stats: string[], statType: string): number {
  try {
    switch (statType) {
      case 'basketball':
        const points = parseInt(stats[13]) || 0
        const rebounds = parseInt(stats[6]) || 0
        const assists = parseInt(stats[7]) || 0
        const steals = parseInt(stats[8]) || 0
        const blocks = parseInt(stats[9]) || 0
        const turnovers = parseInt(stats[10]) || 0
        return points + (rebounds * 1.2) + (assists * 1.5) + (steals * 3) + (blocks * 3) - (turnovers * 1)
        
      case 'passing':
        const passingYards = parseInt(stats[1]) || 0
        const passingTDs = parseInt(stats[3]) || 0
        const ints = parseInt(stats[4]) || 0
        return (passingYards * 0.04) + (passingTDs * 4) - (ints * 2)
        
      case 'rushing':
        const rushingYards = parseInt(stats[1]) || 0
        const rushingTDs = parseInt(stats[3]) || 0
        return (rushingYards * 0.1) + (rushingTDs * 6)
        
      case 'receiving':
        const receptions = parseInt(stats[0]) || 0
        const receivingYards = parseInt(stats[1]) || 0
        const receivingTDs = parseInt(stats[3]) || 0
        return (receptions * 1) + (receivingYards * 0.1) + (receivingTDs * 6)
        
      case 'hockey':
        const hockeyGoals = parseInt(stats[0]) || 0
        const hockeyAssists = parseInt(stats[1]) || 0
        return (hockeyGoals * 3) + (hockeyAssists * 2)
        
      case 'batting':
        const hits = parseInt(stats[2]) || 0
        const runs = parseInt(stats[1]) || 0
        const rbi = parseInt(stats[3]) || 0
        return (hits * 1) + (runs * 1) + (rbi * 1)
        
      default:
        return 0
    }
  } catch {
    return 0
  }
}

// OPTIMIZED save function
async function saveStats(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  // Create players efficiently
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${sport.toLowerCase()}_${id}`,
    name: `${sport} Player ${id}`,
    sport
  }))
  
  // Batch upsert players
  for (let i = 0; i < players.length; i += 100) {
    const batch = players.slice(i, i + 100)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  // Remove duplicates and save stats
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat)
    }
  })
  
  const uniqueStatsArray = Array.from(uniqueStats.values())
  
  // Batch save stats
  for (let i = 0; i < uniqueStatsArray.length; i += 50) {
    const batch = uniqueStatsArray.slice(i, i + 50)
    try {
      await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
    } catch (error: any) {
      // Continue on errors
    }
  }
}

// UNLEASH THE BEAST!
megaCollectionBlitz().catch(console.error)