#!/usr/bin/env tsx
/**
 * BASKETBALL GOLDMINE COLLECTION
 * NBA + NCAAB = Massive stats potential!
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
const limit = pLimit(cpuCount * 4) // MAX POWER!

async function collectBasketballGoldmine() {
  console.log(chalk.bold.red('🏀 BASKETBALL GOLDMINE COLLECTION\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats`))
  console.log(chalk.yellow('🎯 TARGET: NBA (6,221 games) + NCAAB (8,279 games) = 14,500 games!\n'))
  
  let totalNewStats = 0
  
  // Process NBA
  console.log(chalk.bold.yellow('🏀 NBA COLLECTION PHASE:\n'))
  const nbaStats = await processBasketball('NBA', 1000)
  totalNewStats += nbaStats
  
  // Process NCAAB
  console.log(chalk.bold.yellow('\n🏀 NCAAB GOLDMINE PHASE:\n'))
  const ncaabStats = await processBasketball('NCAAB', 2000)
  totalNewStats += ncaabStats
  
  // Final count
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  const netGain = (finalCount || 0) - (startingCount || 0)
  
  console.log(chalk.bold.red('\n🏀 BASKETBALL GOLDMINE RESULTS!\n'))
  console.log(chalk.bold.yellow('📊 FINAL STATS:'))
  console.log(`  🚀 Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  🏀 Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  📈 NET GAIN: ${netGain.toLocaleString()} NEW STATS`)
  console.log(`  ⚡ Processed: ${totalNewStats.toLocaleString()} total stats`)
  
  if (netGain >= 50000) {
    console.log(chalk.bold.green('\n🏆 LEGENDARY GOLDMINE: 50K+ STATS COLLECTED!'))
  } else if (netGain >= 25000) {
    console.log(chalk.bold.green('\n💎 MAJOR GOLDMINE: 25K+ STATS COLLECTED!'))
  } else if (netGain >= 10000) {
    console.log(chalk.bold.green('\n✅ SOLID GOLDMINE: 10K+ STATS COLLECTED!'))
  } else if (netGain > 0) {
    console.log(chalk.bold.green('\n✅ SUCCESS: New stats collected!'))
  }
  
  if (finalCount && finalCount >= 400000) {
    console.log(chalk.bold.cyan('\n🎯 400K MILESTONE REACHED! Next target: 500K!'))
  }
}

async function processBasketball(sport: string, maxGames: number): Promise<number> {
  console.log(chalk.cyan(`🎯 ${sport} ATTACK (${maxGames} games max):`))
  
  // Get completed games
  const allGames: any[] = []
  let offset = 0
  
  while (allGames.length < maxGames) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .gte('start_time', '2023-01-01')
      .lte('start_time', new Date().toISOString())
      .order('start_time', { ascending: false })
      .range(offset, offset + 999)
      
    if (!batch || batch.length === 0) break
    
    allGames.push(...batch)
    offset += 1000
  }
  
  console.log(`  Found ${allGames.length} total ${sport} games`)
  
  if (allGames.length === 0) return 0
  
  // Check which games need stats (quick sample check)
  const sampleSize = Math.min(100, allGames.length)
  const sampleGames = allGames.slice(0, sampleSize)
  let sampleMissing = 0
  
  for (const game of sampleGames) {
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)
      
    if (!count || count === 0) sampleMissing++
  }
  
  const estimatedMissingRate = sampleMissing / sampleSize
  const estimatedMissing = Math.round(allGames.length * estimatedMissingRate)
  
  console.log(`  Sample coverage: ${((1 - estimatedMissingRate) * 100).toFixed(1)}%`)
  console.log(`  Estimated games needing stats: ~${estimatedMissing}`)
  
  if (estimatedMissing === 0) {
    console.log(chalk.green(`  ✅ ${sport} appears to have full coverage!`))
    return 0
  }
  
  // Process games
  let successful = 0
  let newStats = 0
  let errors = 0
  const startTime = Date.now()
  
  // Process a reasonable batch
  const gamesToProcess = allGames.slice(0, Math.min(500, estimatedMissing * 2))
  console.log(chalk.cyan(`  🚀 Processing ${gamesToProcess.length} games with ${cpuCount}x4 threads...`))
  
  const promises = gamesToProcess.map(game => 
    limit(async () => {
      try {
        if (!game.external_id?.includes('espn_')) return
        
        // Check if game already has stats
        const { count: existingStats } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id)
          
        if (existingStats && existingStats > 0) return
        
        const apiUrl = buildEspnApiUrl(game.external_id)
        if (!apiUrl) return
        
        const response = await axios.get(apiUrl, {
          timeout: 12000,
          validateStatus: (status) => status < 500,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        
        if (response.status === 200 && response.data.boxscore?.players) {
          const stats = extractBasketballStats(response.data.boxscore, game)
          
          if (stats.length > 0) {
            const saved = await saveBasketballStats(stats, sport)
            if (saved > 0) {
              successful++
              newStats += saved
              
              if (successful % 20 === 0) {
                const rate = (newStats / ((Date.now() - startTime) / 1000)).toFixed(1)
                console.log(chalk.green(`    ⚡ ${successful} games, ${newStats} stats (${rate}/sec)`))
              }
            }
          }
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
    `  🎉 ${sport} COMPLETE: ${successful}/${gamesToProcess.length} games, ` +
    `${newStats} stats in ${elapsed.toFixed(1)}s (${rate} stats/sec)`
  ))
  
  if (errors > 0) {
    console.log(chalk.yellow(`  ⚠️  ${errors} errors encountered`))
  }
  
  return newStats
}

function extractBasketballStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        // Basketball stats are usually in first statistics array
        if (teamData.statistics && teamData.statistics.length > 0) {
          const playerStats = teamData.statistics[0]
          
          if (playerStats.athletes && Array.isArray(playerStats.athletes)) {
            playerStats.athletes.forEach((athlete: any) => {
              if (!athlete.stats || athlete.stats.length === 0) return
              
              // Basketball stats array (14+ values)
              if (athlete.stats.length >= 14) {
                const minutesStr = athlete.stats[0]
                if (typeof minutesStr === 'string' && minutesStr !== 'DNP' && minutesStr.match(/\d+/)) {
                  const minutes = parseInt(minutesStr)
                  
                  const fgParts = typeof athlete.stats[1] === 'string' ? 
                    athlete.stats[1].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                  const threeParts = typeof athlete.stats[2] === 'string' ? 
                    athlete.stats[2].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                  const ftParts = typeof athlete.stats[3] === 'string' ? 
                    athlete.stats[3].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                  
                  const playerStat = {
                    player_id: parseInt(athlete.athlete.id),
                    game_id: game.id,
                    team_id: teamId,
                    opponent_id: opponentId,
                    is_home: isHome,
                    game_date: new Date(game.start_time).toISOString().split('T')[0],
                    stats: {
                      minutes_played: minutes,
                      field_goals_made: fgParts[0] || 0,
                      field_goals_attempted: fgParts[1] || 0,
                      three_pointers_made: threeParts[0] || 0,
                      three_pointers_attempted: threeParts[1] || 0,
                      free_throws_made: ftParts[0] || 0,
                      free_throws_attempted: ftParts[1] || 0,
                      offensive_rebounds: parseInt(athlete.stats[4]) || 0,
                      defensive_rebounds: parseInt(athlete.stats[5]) || 0,
                      rebounds: parseInt(athlete.stats[6]) || 0,
                      assists: parseInt(athlete.stats[7]) || 0,
                      steals: parseInt(athlete.stats[8]) || 0,
                      blocks: parseInt(athlete.stats[9]) || 0,
                      turnovers: parseInt(athlete.stats[10]) || 0,
                      personal_fouls: parseInt(athlete.stats[11]) || 0,
                      points: parseInt(athlete.stats[13]) || 0,
                      fantasy_points: calculateBasketballFantasy(athlete.stats)
                    }
                  }
                  
                  stats.push(playerStat)
                }
              }
            })
          }
        }
      })
    }
  } catch (error) {
    // Silent fail
  }
  
  return stats
}

function calculateBasketballFantasy(stats: string[]): number {
  try {
    const points = parseInt(stats[13]) || 0
    const rebounds = parseInt(stats[6]) || 0
    const assists = parseInt(stats[7]) || 0
    const steals = parseInt(stats[8]) || 0
    const blocks = parseInt(stats[9]) || 0
    const turnovers = parseInt(stats[10]) || 0
    
    // DraftKings scoring
    return points + (rebounds * 1.25) + (assists * 1.5) + (steals * 2) + (blocks * 2) - (turnovers * 0.5)
  } catch {
    return 0
  }
}

async function saveBasketballStats(stats: any[], sport: string): Promise<number> {
  if (stats.length === 0) return 0
  
  // Create players
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${sport.toLowerCase()}_${id}`,
    name: `${sport} Player ${id}`,
    sport
  }))
  
  for (let i = 0; i < players.length; i += 200) {
    const batch = players.slice(i, i + 200)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
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
  for (let i = 0; i < uniqueStatsArray.length; i += 100) {
    const batch = uniqueStatsArray.slice(i, i + 100)
    try {
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
        .select()
        
      if (!error && data) {
        saved += data.length
      }
    } catch (error) {
      // Continue
    }
  }
  
  return saved
}

// UNLEASH THE BASKETBALL GOLDMINE!
collectBasketballGoldmine().catch(console.error)