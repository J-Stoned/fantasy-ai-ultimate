#!/usr/bin/env tsx
/**
 * NCAAB GOLDMINE ATTACK
 * 7,311 games with 0% coverage - MASSIVE opportunity!
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
const limit = pLimit(cpuCount * 4) // MAXIMUM POWER

async function ncaabGoldmineAttack() {
  console.log(chalk.bold.red('🏀 NCAAB GOLDMINE ATTACK - 7,311 UNTAPPED GAMES!\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats`))
  console.log(chalk.yellow('💰 TARGET: 7,311 NCAAB games = ~220K potential stats!\n'))
  
  // Get ALL NCAAB games
  console.log(chalk.yellow('🔍 Finding ALL NCAAB games...\n'))
  
  const allNCAABGames: any[] = []
  let offset = 0
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id, home_score, away_score')
      .eq('sport', 'NCAAB')
      .not('home_score', 'is', null)
      .gte('start_time', '2020-01-01')
      .lte('start_time', '2024-12-31')
      .range(offset, offset + 999)
      .order('start_time', { ascending: false })
      
    if (!batch || batch.length === 0) break
    
    allNCAABGames.push(...batch)
    offset += 1000
  }
  
  console.log(chalk.bold.cyan(`📊 Found ${allNCAABGames.length} total NCAAB games`))
  
  // Check coverage (should be ~0%)
  const gameIds = allNCAABGames.map(g => g.id)
  const gamesWithStats = new Set<number>()
  
  for (let i = 0; i < gameIds.length; i += 2000) {
    const batch = gameIds.slice(i, i + 2000)
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch)
      
    data?.forEach(row => gamesWithStats.add(row.game_id))
  }
  
  const missingGames = allNCAABGames.filter(g => !gamesWithStats.has(g.id))
  const currentCoverage = ((allNCAABGames.length - missingGames.length) / allNCAABGames.length * 100).toFixed(1)
  
  console.log(chalk.bold.yellow(`📈 Current NCAAB Coverage: ${currentCoverage}%`))
  console.log(chalk.bold.red(`💰 ${missingGames.length} games = GOLDMINE OPPORTUNITY!\n`))
  
  // Group by season
  const seasonGroups = new Map<number, typeof missingGames>()
  missingGames.forEach(game => {
    const year = new Date(game.start_time).getFullYear()
    if (!seasonGroups.has(year)) {
      seasonGroups.set(year, [])
    }
    seasonGroups.get(year)!.push(game)
  })
  
  console.log(chalk.cyan('NCAAB games by season:'))
  Array.from(seasonGroups.entries())
    .sort(([a], [b]) => b - a)
    .forEach(([year, games]) => {
      console.log(`  ${year}: ${games.length} games`)
    })
  
  // Start with most recent season
  const recentSeasons = Array.from(seasonGroups.entries())
    .sort(([a], [b]) => b - a)
    .slice(0, 2) // 2023 and 2024 seasons
  
  console.log(chalk.bold.red('\n🚀 ATTACKING RECENT SEASONS FIRST!\n'))
  
  let totalSuccessful = 0
  let totalNewStats = 0
  let totalErrors = 0
  
  for (const [year, seasonGames] of recentSeasons) {
    console.log(chalk.bold.yellow(`\n🏀 ${year} SEASON ATTACK (${seasonGames.length} games):`))
    
    const startTime = Date.now()
    let successful = 0
    let newStats = 0
    let errors = 0
    
    // Process in batches of 500
    const batchSize = 500
    const gameBatch = seasonGames.slice(0, batchSize)
    
    const promises = gameBatch.map(game => 
      limit(async () => {
        try {
          if (!game.external_id?.includes('espn_')) return
          
          const apiUrl = buildEspnApiUrl(game.external_id)
          if (!apiUrl) return
          
          const response = await axios.get(apiUrl, {
            timeout: 15000,
            validateStatus: (status) => status < 500,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache'
            }
          })
          
          if (response.status === 200 && response.data.boxscore?.players) {
            const stats = extractNCAABStats(response.data.boxscore, game)
            
            if (stats.length > 0) {
              const statsWithDate = stats.map(stat => ({
                ...stat,
                game_date: new Date(game.start_time).toISOString().split('T')[0]
              }))
              
              await saveNCAABStats(statsWithDate)
              successful++
              newStats += stats.length
              
              if (successful % 20 === 0) {
                const rate = (newStats / ((Date.now() - startTime) / 1000)).toFixed(1)
                console.log(chalk.green(`    ⚡ ${successful} games | ${newStats} stats (${rate}/sec)`))
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
      `  🎉 ${year} Complete: ${successful}/${gameBatch.length} games | ${newStats} stats in ${elapsed.toFixed(1)}s (${rate}/sec)`
    ))
    
    if (errors > 0) {
      console.log(chalk.yellow(`  ⚠️  ${errors} API errors`))
    }
    
    totalSuccessful += successful
    totalNewStats += newStats
    totalErrors += errors
  }
  
  // Final results
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  const netGain = (finalCount || 0) - (startingCount || 0)
  
  // Check new coverage
  const { data: finalCheck } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', gameIds)
    
  const finalGamesWithStats = new Set(finalCheck?.map(row => row.game_id) || [])
  const finalCoverage = (finalGamesWithStats.size / allNCAABGames.length * 100).toFixed(1)
  
  console.log(chalk.bold.red('\n🏀 NCAAB GOLDMINE RESULTS!\n'))
  console.log(chalk.bold.yellow('📊 FINAL STATS:'))
  console.log(`  🚀 Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  🏀 Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  📈 NET GAIN: ${netGain.toLocaleString()} NEW STATS`)
  console.log(`  ⚡ Collection: ${totalSuccessful} games conquered`)
  console.log(`  🎯 NCAAB Coverage: ${currentCoverage}% → ${finalCoverage}%`)
  console.log(`  💰 Stats Collected: ${totalNewStats.toLocaleString()}`)
  
  if (totalNewStats >= 50000) {
    console.log(chalk.bold.green('\n🏆 LEGENDARY GOLDMINE: 50K+ NCAAB STATS COLLECTED!'))
  } else if (totalNewStats >= 25000) {
    console.log(chalk.bold.green('\n💎 MAJOR GOLDMINE: 25K+ NCAAB STATS COLLECTED!'))
  } else if (totalNewStats >= 10000) {
    console.log(chalk.bold.green('\n✅ SOLID GOLDMINE: 10K+ NCAAB STATS COLLECTED!'))
  }
  
  const remainingGames = allNCAABGames.length - finalGamesWithStats.size
  if (remainingGames > 0) {
    console.log(chalk.yellow(`\n💰 ${remainingGames} more NCAAB games still available!`))
  }
  
  console.log(chalk.bold.cyan('\n🚀 NCAAB GOLDMINE TAPPED - READY FOR MORE!'))
}

function extractNCAABStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        // Basketball stats are in statistics array
        if (teamData.statistics && teamData.statistics.length > 0) {
          const playerStats = teamData.statistics[0] // Usually first item has player stats
          
          if (playerStats.athletes && Array.isArray(playerStats.athletes)) {
            playerStats.athletes.forEach((athlete: any) => {
              if (!athlete.stats || athlete.stats.length === 0) return
              
              // Basketball stats array
              if (athlete.stats.length >= 14) {
                const minutesStr = athlete.stats[0]
                if (typeof minutesStr === 'string' && minutesStr !== 'DNP' && minutesStr.match(/\d+/)) {
                  const minutes = parseInt(minutesStr)
                  if (minutes >= 0) { // Include 0 minute players
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
              }
            })
          }
        }
      })
    }
  } catch (error) {
    // Silent continue
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

async function saveNCAABStats(stats: any[]) {
  if (stats.length === 0) return
  
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_ncaab_${id}`,
    name: `NCAAB Player ${id}`,
    sport: 'NCAAB'
  }))
  
  for (let i = 0; i < players.length; i += 200) {
    const batch = players.slice(i, i + 200)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat)
    }
  })
  
  const uniqueStatsArray = Array.from(uniqueStats.values())
  
  for (let i = 0; i < uniqueStatsArray.length; i += 100) {
    const batch = uniqueStatsArray.slice(i, i + 100)
    try {
      await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
    } catch (error: any) {
      // Continue on errors
    }
  }
}

// ATTACK THE GOLDMINE!
ncaabGoldmineAttack().catch(console.error)