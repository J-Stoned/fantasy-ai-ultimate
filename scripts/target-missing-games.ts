#!/usr/bin/env tsx
/**
 * TARGET MISSING GAMES COLLECTOR
 * Focus on the 628 completed games without stats
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
const limit = pLimit(cpuCount * 2) // Moderate concurrency

async function targetMissingGames() {
  console.log(chalk.bold.red('🎯 TARGET MISSING GAMES COLLECTOR\n'))
  
  // Get starting count
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`Starting with ${startingCount?.toLocaleString() || 0} player stats\n`))
  
  // Find completed games without stats
  console.log(chalk.yellow('🔍 Finding completed games without stats...'))
  
  const { data: completedGames } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_team_id, away_team_id')
    .not('sport', 'is', null)
    .not('home_score', 'is', null)
    .gte('start_time', '2023-01-01')
    .lte('start_time', '2024-12-31')
    .limit(2000)
    
  if (!completedGames) {
    console.log(chalk.red('❌ No completed games found'))
    return
  }
  
  console.log(chalk.cyan(`Found ${completedGames.length} completed games`))
  
  // Check which ones already have stats
  const gameIds = completedGames.map(g => g.id)
  const gamesWithStats = new Set<number>()
  
  // Check in batches
  for (let i = 0; i < gameIds.length; i += 1000) {
    const batch = gameIds.slice(i, i + 1000)
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch)
      
    data?.forEach(row => gamesWithStats.add(row.game_id))
  }
  
  const missingGames = completedGames.filter(g => !gamesWithStats.has(g.id))
  
  console.log(chalk.yellow(`🎯 Found ${missingGames.length} games WITHOUT stats!\n`))
  
  if (missingGames.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'))
    return
  }
  
  // Group by sport
  const sportGroups = new Map<string, typeof missingGames>()
  missingGames.forEach(game => {
    if (!sportGroups.has(game.sport)) {
      sportGroups.set(game.sport, [])
    }
    sportGroups.get(game.sport)!.push(game)
  })
  
  console.log(chalk.cyan('Missing stats by sport:'))
  Array.from(sportGroups.entries()).forEach(([sport, games]) => {
    console.log(`  ${sport}: ${games.length} games`)
  })
  
  // Process each sport
  let totalNewStats = 0
  
  for (const [sport, games] of sportGroups.entries()) {
    if (games.length === 0) continue
    
    console.log(chalk.yellow(`\n🏆 Processing ${sport} (${games.length} games):`))
    
    let successful = 0
    let newStats = 0
    let errors = 0
    const startTime = Date.now()
    
    // Limit to reasonable batch size
    const gamesToProcess = games.slice(0, 200)
    
    const promises = gamesToProcess.map(game => 
      limit(async () => {
        try {
          if (!game.external_id.includes('espn_')) {
            return // Skip non-ESPN games
          }
          
          const apiUrl = buildEspnApiUrl(game.external_id)
          if (!apiUrl) return
          
          const response = await axios.get(apiUrl, {
            timeout: 8000,
            validateStatus: (status) => status < 500,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })
          
          if (response.status === 200 && response.data.boxscore?.players) {
            const stats = extractStatsForSport(response.data.boxscore, game, sport)
            
            if (stats.length > 0) {
              const statsWithDate = stats.map(stat => ({
                ...stat,
                game_date: new Date(game.start_time).toISOString().split('T')[0]
              }))
              
              await saveStats(statsWithDate, sport)
              successful++
              newStats += stats.length
              
              if (successful % 10 === 0) {
                console.log(chalk.green(`  ✅ ${successful} games, ${newStats} stats`))
              }
            }
          } else if (response.status === 404) {
            errors++
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
      `${sport} complete: ${successful}/${gamesToProcess.length} games, ` +
      `${newStats} stats in ${elapsed.toFixed(1)}s` +
      (errors > 0 ? ` (${errors} errors)` : '')
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
  console.log(`  Added: ${((finalCount || 0) - (startingCount || 0)).toLocaleString()} new stats`)
  
  if (totalNewStats > 0) {
    console.log(chalk.bold.green(`\n🎉 SUCCESS: Collected ${totalNewStats} new player stats!`))
  } else {
    console.log(chalk.yellow('\n⚠️  No new stats collected - check API connectivity'))
  }
}

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
              
              // Extract stats based on sport
              if (sport === 'NBA' || sport === 'NCAAB') {
                if (athlete.stats.length >= 14) {
                  const minutesStr = athlete.stats[0]
                  if (typeof minutesStr === 'string' && minutesStr !== 'DNP' && minutesStr.match(/\d+/)) {
                    const minutes = parseInt(minutesStr)
                    if (minutes > 0) {
                      const fgParts = typeof athlete.stats[1] === 'string' ? 
                        athlete.stats[1].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                      const threeParts = typeof athlete.stats[2] === 'string' ? 
                        athlete.stats[2].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                      const ftParts = typeof athlete.stats[3] === 'string' ? 
                        athlete.stats[3].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
                      
                      playerStats.stats = {
                        minutes: minutes,
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
                        points: parseInt(athlete.stats[13]) || 0
                      }
                    }
                  }
                }
              } else if (sport === 'NFL' || sport === 'NCAAF') {
                // NFL/NCAAF stats parsing
                if (statGroup.name === 'passing' && athlete.stats.length >= 9) {
                  const compAtt = athlete.stats[0].split('/')
                  playerStats.stats = {
                    completions: parseInt(compAtt[0]) || 0,
                    attempts: parseInt(compAtt[1]) || 0,
                    passing_yards: parseInt(athlete.stats[1]) || 0,
                    passing_touchdowns: parseInt(athlete.stats[3]) || 0,
                    interceptions: parseInt(athlete.stats[4]) || 0
                  }
                } else if (statGroup.name === 'rushing' && athlete.stats.length >= 5) {
                  playerStats.stats = {
                    carries: parseInt(athlete.stats[0]) || 0,
                    rushing_yards: parseInt(athlete.stats[1]) || 0,
                    rushing_touchdowns: parseInt(athlete.stats[3]) || 0
                  }
                } else if (statGroup.name === 'receiving' && athlete.stats.length >= 6) {
                  playerStats.stats = {
                    receptions: parseInt(athlete.stats[0]) || 0,
                    receiving_yards: parseInt(athlete.stats[1]) || 0,
                    receiving_touchdowns: parseInt(athlete.stats[3]) || 0
                  }
                }
              } else if (sport === 'MLB') {
                // MLB stats
                if (statGroup.name === 'batting' && athlete.stats.length >= 8) {
                  playerStats.stats = {
                    at_bats: parseInt(athlete.stats[0]) || 0,
                    runs: parseInt(athlete.stats[1]) || 0,
                    hits: parseInt(athlete.stats[2]) || 0,
                    rbi: parseInt(athlete.stats[3]) || 0,
                    walks: parseInt(athlete.stats[4]) || 0,
                    strikeouts: parseInt(athlete.stats[5]) || 0
                  }
                } else if (statGroup.name === 'pitching' && athlete.stats.length >= 7) {
                  playerStats.stats = {
                    innings_pitched: parseFloat(athlete.stats[0]) || 0,
                    hits_allowed: parseInt(athlete.stats[1]) || 0,
                    runs_allowed: parseInt(athlete.stats[2]) || 0,
                    earned_runs: parseInt(athlete.stats[3]) || 0,
                    walks_allowed: parseInt(athlete.stats[4]) || 0,
                    strikeouts_pitched: parseInt(athlete.stats[5]) || 0
                  }
                }
              } else if (sport === 'NHL') {
                // NHL stats
                if (statGroup.name === 'skaters' && athlete.stats.length >= 8) {
                  const plusMinus = typeof athlete.stats[3] === 'string' ? 
                    parseInt(athlete.stats[3].replace('+', '')) : parseInt(athlete.stats[3])
                  
                  playerStats.stats = {
                    goals: parseInt(athlete.stats[0]) || 0,
                    assists: parseInt(athlete.stats[1]) || 0,
                    points: parseInt(athlete.stats[2]) || 0,
                    plus_minus: plusMinus || 0,
                    penalty_minutes: parseInt(athlete.stats[4]) || 0,
                    shots: parseInt(athlete.stats[5]) || 0,
                    hits: parseInt(athlete.stats[6]) || 0,
                    blocks: parseInt(athlete.stats[7]) || 0
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
    // Silent fail
  }
  
  return stats
}

async function saveStats(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  // Create players
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
  
  // Remove duplicates within batch
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat)
    }
  })
  
  // Save stats in small batches
  const uniqueStatsArray = Array.from(uniqueStats.values())
  for (let i = 0; i < uniqueStatsArray.length; i += 20) {
    const batch = uniqueStatsArray.slice(i, i + 20)
    try {
      await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
    } catch (error: any) {
      if (!error.message?.includes('duplicate')) {
        console.error(chalk.red(`Save error: ${error.message}`))
      }
    }
  }
}

// Run it
targetMissingGames().catch(console.error)