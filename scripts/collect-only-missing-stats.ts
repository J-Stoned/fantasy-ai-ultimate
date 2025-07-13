#!/usr/bin/env tsx
/**
 * COLLECT ONLY MISSING STATS
 * Only process games that don't have any stats yet
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

async function collectOnlyMissingStats() {
  console.log(chalk.bold.red('🎯 COLLECT ONLY MISSING STATS\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats\n`))
  
  // Get ALL completed games
  console.log(chalk.yellow('📊 Finding games WITHOUT stats...\n'))
  
  const allGames: any[] = []
  let offset = 0
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id')
      .not('home_score', 'is', null)
      .not('sport', 'is', null)
      .in('sport', ['NFL', 'NBA', 'NHL', 'MLB', 'NCAAF', 'NCAAB'])
      .gte('start_time', '2023-01-01')
      .lte('start_time', new Date().toISOString())
      .range(offset, offset + 999)
      
    if (!batch || batch.length === 0) break
    allGames.push(...batch)
    offset += 1000
  }
  
  console.log(`Total completed games: ${allGames.length}`)
  
  // Get ALL games that already have stats
  const gamesWithStats = new Set<number>()
  
  offset = 0
  while (true) {
    const { data: batch } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .range(offset, offset + 9999)
      
    if (!batch || batch.length === 0) break
    batch.forEach(row => gamesWithStats.add(row.game_id))
    offset += 10000
  }
  
  console.log(`Games with stats: ${gamesWithStats.size}`)
  
  // Filter to only games without stats
  const gamesWithoutStats = allGames.filter(g => !gamesWithStats.has(g.id))
  
  console.log(chalk.bold.yellow(`\n🎯 Found ${gamesWithoutStats.length} games WITHOUT stats!\n`))
  
  if (gamesWithoutStats.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'))
    return
  }
  
  // Group by sport
  const sportGroups = new Map<string, typeof gamesWithoutStats>()
  gamesWithoutStats.forEach(game => {
    if (!sportGroups.has(game.sport)) {
      sportGroups.set(game.sport, [])
    }
    sportGroups.get(game.sport)!.push(game)
  })
  
  console.log('Games without stats by sport:')
  sportGroups.forEach((games, sport) => {
    console.log(`  ${sport}: ${games.length} games`)
  })
  
  let totalNewStats = 0
  
  // Process each sport
  for (const [sport, games] of sportGroups.entries()) {
    if (games.length === 0) continue
    
    console.log(chalk.bold.yellow(`\n🏆 Processing ${sport} (${games.length} games):`))
    
    let successful = 0
    let newStats = 0
    let errors = 0
    const startTime = Date.now()
    
    // Process in reasonable batches
    const batchSize = Math.min(200, games.length)
    const gamesToProcess = games.slice(0, batchSize)
    
    const promises = gamesToProcess.map(game => 
      limit(async () => {
        try {
          if (!game.external_id?.includes('espn_')) return
          
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
            const stats = extractStats(response.data.boxscore, game, sport)
            
            if (stats.length > 0) {
              const saved = await saveStats(stats, game, sport)
              if (saved > 0) {
                successful++
                newStats += saved
                
                if (successful % 10 === 0) {
                  console.log(chalk.green(`    ✅ ${successful} games, ${newStats} new stats`))
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
    console.log(chalk.green(
      `  ${sport} complete: ${successful}/${gamesToProcess.length} games, ` +
      `${newStats} new stats in ${elapsed.toFixed(1)}s`
    ))
    
    totalNewStats += newStats
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.bold.yellow(`\n📊 FINAL RESULTS:`))
  console.log(`  Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  NET GAIN: ${((finalCount || 0) - (startingCount || 0)).toLocaleString()} NEW STATS`)
  
  if (totalNewStats > 0) {
    console.log(chalk.bold.green(`\n🎉 SUCCESS: Collected ${totalNewStats} new player stats!`))
  }
}

function extractStats(boxscore: any, game: any, sport: string): any[] {
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
                game_date: new Date(game.start_time).toISOString().split('T')[0],
                stats: {}
              }
              
              // Sport-specific extraction
              if (sport === 'NBA' || sport === 'NCAAB') {
                // Basketball stats
                if (athlete.stats.length >= 14) {
                  const minutesStr = athlete.stats[0]
                  if (typeof minutesStr === 'string' && minutesStr !== 'DNP' && minutesStr.match(/\d+/)) {
                    const minutes = parseInt(minutesStr)
                    if (minutes >= 0) {
                      playerStats.stats = {
                        minutes_played: minutes,
                        points: parseInt(athlete.stats[13]) || 0,
                        rebounds: parseInt(athlete.stats[6]) || 0,
                        assists: parseInt(athlete.stats[7]) || 0,
                        fantasy_points: 0 // Calculate later
                      }
                      stats.push(playerStats)
                    }
                  }
                }
              } else if (sport === 'NFL' || sport === 'NCAAF') {
                // Football stats
                if (statGroup.name === 'passing' && athlete.stats.length >= 5) {
                  playerStats.stats = {
                    passing_yards: parseInt(athlete.stats[1]) || 0,
                    passing_touchdowns: parseInt(athlete.stats[3]) || 0,
                    fantasy_points: 0
                  }
                  stats.push(playerStats)
                } else if (statGroup.name === 'rushing' && athlete.stats.length >= 4) {
                  playerStats.stats = {
                    rushing_yards: parseInt(athlete.stats[1]) || 0,
                    rushing_touchdowns: parseInt(athlete.stats[3]) || 0,
                    fantasy_points: 0
                  }
                  stats.push(playerStats)
                }
              }
            })
          }
        })
      })
    }
  } catch (error) {
    // Silent fail
  }
  
  return stats
}

async function saveStats(stats: any[], game: any, sport: string): Promise<number> {
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
  
  // Save stats
  try {
    const { data, error } = await supabase
      .from('player_game_logs')
      .insert(stats) // Use INSERT not UPSERT to ensure we're adding new records
      .select()
      
    if (error) {
      console.log(chalk.red(`    Error for game ${game.external_id}: ${error.message}`))
      return 0
    }
    
    return data?.length || 0
  } catch (error: any) {
    console.log(chalk.red(`    Exception: ${error.message}`))
    return 0
  }
}

// Run it!
collectOnlyMissingStats().catch(console.error)