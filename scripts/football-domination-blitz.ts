#!/usr/bin/env tsx
/**
 * FOOTBALL DOMINATION BLITZ
 * ALL OUT ATTACK ON NFL + NCAAF - OUR PROVEN HIGH-PERFORMANCE APIS!
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
const limit = pLimit(cpuCount * 4) // MAXIMUM AGGRESSION

async function footballDominationBlitz() {
  console.log(chalk.bold.red('🏈 FOOTBALL DOMINATION BLITZ - MAXIMUM OVERDRIVE!\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats`))
  console.log(chalk.yellow('🎯 MISSION: Collect ALL remaining football stats → 300K+ TOTAL!\n'))
  
  let grandTotalStats = 0
  
  // NFL COMPLETE DOMINATION
  console.log(chalk.bold.yellow('🏈 NFL COMPLETE DOMINATION PHASE:\n'))
  
  const nflStats = await processFootballSport('NFL', 2500, 'ULTRA_AGGRESSIVE')
  grandTotalStats += nflStats
  
  // NCAAF COMPLETE DOMINATION  
  console.log(chalk.bold.yellow('\n🏈 NCAAF COMPLETE DOMINATION PHASE:\n'))
  
  const ncaafStats = await processFootballSport('NCAAF', 2000, 'ULTRA_AGGRESSIVE')
  grandTotalStats += ncaafStats
  
  // BONUS: Hit the lowercase 'nfl' games too
  console.log(chalk.bold.yellow('\n🏈 BONUS ROUND - lowercase nfl:\n'))
  
  const bonusStats = await processFootballSport('nfl', 100, 'AGGRESSIVE')
  grandTotalStats += bonusStats
  
  // FINAL DOMINATION REPORT
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  const netGain = (finalCount || 0) - (startingCount || 0)
  
  console.log(chalk.bold.red('\n🔥 FOOTBALL DOMINATION COMPLETE!\n'))
  console.log(chalk.bold.yellow('📊 DOMINATION RESULTS:'))
  console.log(`  🚀 Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  🏈 Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  📈 NET DOMINATION: ${netGain.toLocaleString()} NEW STATS`)
  console.log(`  ⚡ Total Processed: ${grandTotalStats.toLocaleString()} stats`)
  
  if (finalCount && finalCount >= 300000) {
    console.log(chalk.bold.green('\n🏆 LEGENDARY ACHIEVEMENT: 300K+ STATS REACHED!'))
    console.log(chalk.bold.cyan('👑 WE ARE THE UNDISPUTED STATS COLLECTION CHAMPIONS!'))
  } else if (netGain >= 20000) {
    console.log(chalk.bold.green('\n🎉 EPIC DOMINATION: 20K+ NEW STATS COLLECTED!'))
  } else if (netGain >= 10000) {
    console.log(chalk.bold.green('\n✅ SOLID DOMINATION: 10K+ NEW STATS COLLECTED!'))
  }
  
  // Calculate our collection rate and efficiency
  const efficiency = ((grandTotalStats / (Date.now() - startTime)) * 1000).toFixed(1)
  console.log(chalk.bold.cyan(`\n⚡ DOMINATION RATE: ${efficiency} stats/second`))
  
  console.log(chalk.bold.red('\n🚀 FOOTBALL EMPIRE ESTABLISHED! READY TO DOMINATE BETTING MARKETS!'))
}

const startTime = Date.now()

async function processFootballSport(sport: string, maxGames: number, intensity: 'AGGRESSIVE' | 'ULTRA_AGGRESSIVE'): Promise<number> {
  console.log(chalk.cyan(`🎯 ${sport} BLITZ (${intensity} MODE):`))
  
  // Get ALL games for this sport
  const allGames: any[] = []
  let offset = 0
  
  while (allGames.length < maxGames) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id, home_score, away_score')
      .eq('sport', sport)
      .not('home_score', 'is', null) // Only completed games
      .gte('start_time', '2020-01-01') // Expanded date range
      .lte('start_time', '2024-12-31')
      .range(offset, offset + 999)
      .order('start_time', { ascending: false }) // Most recent first
      
    if (!batch || batch.length === 0) break
    
    allGames.push(...batch)
    offset += 1000
  }
  
  console.log(chalk.yellow(`  📊 Found ${allGames.length} total ${sport} games`))
  
  if (allGames.length === 0) return 0
  
  // Check which need stats
  const gameIds = allGames.map(g => g.id)
  const gamesWithStats = new Set<number>()
  
  // Efficient batch checking
  for (let i = 0; i < gameIds.length; i += 2000) {
    const batch = gameIds.slice(i, i + 2000)
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch)
      
    data?.forEach(row => gamesWithStats.add(row.game_id))
  }
  
  const missingGames = allGames.filter(g => !gamesWithStats.has(g.id))
  console.log(chalk.yellow(`  🎯 ${missingGames.length} games need stats`))
  
  if (missingGames.length === 0) {
    console.log(chalk.green(`  ✅ All ${sport} games already have stats!`))
    return 0
  }
  
  // DOMINATION COLLECTION
  let successful = 0
  let totalNewStats = 0
  let errors = 0
  const sportStartTime = Date.now()
  
  // Intensity-based batch sizing
  const batchSize = intensity === 'ULTRA_AGGRESSIVE' ? missingGames.length : 
                   Math.min(1000, missingGames.length)
  
  const gamesToProcess = missingGames.slice(0, batchSize)
  console.log(chalk.cyan(`  🚀 PROCESSING ${gamesToProcess.length} games with ${cpuCount}x4 MAXIMUM THREADS`))
  
  const promises = gamesToProcess.map(game => 
    limit(async () => {
      try {
        if (!game.external_id?.includes('espn_')) return
        
        const apiUrl = buildEspnApiUrl(game.external_id)
        if (!apiUrl) return
        
        const response = await axios.get(apiUrl, {
          timeout: 12000, // Extended timeout for reliability
          validateStatus: (status) => status < 500,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
        
        if (response.status === 200 && response.data.boxscore?.players) {
          const stats = extractFootballStats(response.data.boxscore, game)
          
          if (stats.length > 0) {
            const statsWithDate = stats.map(stat => ({
              ...stat,
              game_date: new Date(game.start_time).toISOString().split('T')[0]
            }))
            
            await saveFootballStats(statsWithDate, sport)
            successful++
            totalNewStats += stats.length
            
            if (successful % 50 === 0) {
              const rate = (totalNewStats / ((Date.now() - sportStartTime) / 1000)).toFixed(1)
              console.log(chalk.green(`    ⚡ ${successful} games, ${totalNewStats} stats (${rate}/sec)`))
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
  
  const elapsed = (Date.now() - sportStartTime) / 1000
  const rate = (totalNewStats / elapsed).toFixed(1)
  
  console.log(chalk.bold.green(
    `  🎉 ${sport} DOMINATION: ${successful}/${gamesToProcess.length} games conquered!`
  ))
  console.log(chalk.bold.green(
    `  ⚡ ${totalNewStats} stats in ${elapsed.toFixed(1)}s (${rate} stats/sec)`
  ))
  
  if (errors > 0) {
    console.log(chalk.yellow(`  ⚠️  ${errors} API errors encountered`))
  }
  
  return totalNewStats
}

function extractFootballStats(boxscore: any, game: any): any[] {
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
              
              const baseStats = {
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: {}
              }
              
              // PASSING STATS
              if (statGroup.name === 'passing' && athlete.stats.length >= 5) {
                const compAtt = athlete.stats[0].split('/').map((s: string) => parseInt(s) || 0)
                const yards = parseInt(athlete.stats[1]) || 0
                const tds = parseInt(athlete.stats[3]) || 0
                const ints = parseInt(athlete.stats[4]) || 0
                
                baseStats.stats = {
                  completions: compAtt[0],
                  attempts: compAtt[1],
                  passing_yards: yards,
                  passing_touchdowns: tds,
                  interceptions: ints,
                  completion_percentage: compAtt[1] > 0 ? (compAtt[0] / compAtt[1] * 100) : 0,
                  passer_rating: calculatePasserRating(compAtt[0], compAtt[1], yards, tds, ints),
                  fantasy_points: (yards * 0.04) + (tds * 4) - (ints * 2)
                }
                stats.push({...baseStats})
              }
              
              // RUSHING STATS
              if (statGroup.name === 'rushing' && athlete.stats.length >= 4) {
                const carries = parseInt(athlete.stats[0]) || 0
                const yards = parseInt(athlete.stats[1]) || 0
                const tds = parseInt(athlete.stats[3]) || 0
                
                baseStats.stats = {
                  carries: carries,
                  rushing_yards: yards,
                  rushing_touchdowns: tds,
                  yards_per_carry: carries > 0 ? (yards / carries) : 0,
                  fantasy_points: (yards * 0.1) + (tds * 6)
                }
                stats.push({...baseStats})
              }
              
              // RECEIVING STATS
              if (statGroup.name === 'receiving' && athlete.stats.length >= 4) {
                const receptions = parseInt(athlete.stats[0]) || 0
                const yards = parseInt(athlete.stats[1]) || 0
                const tds = parseInt(athlete.stats[3]) || 0
                
                baseStats.stats = {
                  receptions: receptions,
                  receiving_yards: yards,
                  receiving_touchdowns: tds,
                  yards_per_reception: receptions > 0 ? (yards / receptions) : 0,
                  fantasy_points: (receptions * 1) + (yards * 0.1) + (tds * 6)
                }
                stats.push({...baseStats})
              }
              
              // DEFENSIVE STATS
              if (statGroup.name === 'defensive' && athlete.stats.length >= 3) {
                const tackles = parseInt(athlete.stats[0]) || 0
                const sacks = parseFloat(athlete.stats[1]) || 0
                const ints = parseInt(athlete.stats[2]) || 0
                
                baseStats.stats = {
                  tackles: tackles,
                  sacks: sacks,
                  interceptions: ints,
                  fantasy_points: (tackles * 1) + (sacks * 2) + (ints * 2)
                }
                stats.push({...baseStats})
              }
            })
          }
        })
      })
    }
  } catch (error) {
    // Silent continue
  }
  
  return stats
}

function calculatePasserRating(comp: number, att: number, yards: number, tds: number, ints: number): number {
  if (att === 0) return 0
  
  const a = Math.max(0, Math.min(2.375, (comp / att - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, (yards / att - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (tds / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (ints / att * 25)))
  
  return ((a + b + c + d) / 6) * 100
}

async function saveFootballStats(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  // Create players efficiently
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${sport.toLowerCase()}_${id}`,
    name: `${sport} Player ${id}`,
    sport: sport.toUpperCase()
  }))
  
  // Batch player creation
  for (let i = 0; i < players.length; i += 200) {
    const batch = players.slice(i, i + 200)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  // Deduplicate and save stats
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    const existing = uniqueStats.get(key)
    // Keep the stat with more complete data
    if (!existing || Object.keys(stat.stats).length > Object.keys(existing.stats).length) {
      uniqueStats.set(key, stat)
    }
  })
  
  const uniqueStatsArray = Array.from(uniqueStats.values())
  
  // High-speed batch saving
  for (let i = 0; i < uniqueStatsArray.length; i += 100) {
    const batch = uniqueStatsArray.slice(i, i + 100)
    try {
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
      
      if (error) {
        console.log(chalk.red(`Save error: ${error.message}`))
        console.log('Failed batch sample:', batch[0])
      }
    } catch (error: any) {
      console.log(chalk.red(`Exception: ${error.message}`))
    }
  }
}

// UNLEASH THE FOOTBALL DOMINATION!
footballDominationBlitz().catch(console.error)