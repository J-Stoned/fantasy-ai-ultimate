#!/usr/bin/env tsx
/**
 * TURBO SCRAPER - Maximum performance stats collection
 * Focuses on sports that need the most work
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

console.log(chalk.bold.red(`🚀 TURBO SCRAPER - MAXIMUM PERFORMANCE MODE!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

// Sport configurations with priority order
const SPORT_CONFIGS = {
  nhl: {
    endpoint: 'hockey/nhl',
    extractStats: extractNhlStats,
    priority: 1 // Lowest coverage
  },
  ncaab: {
    endpoint: 'basketball/mens-college-basketball',
    extractStats: extractNcaabStats,
    priority: 2
  },
  ncaaf: {
    endpoint: 'football/college-football',
    extractStats: extractNcaafStats,
    priority: 3
  },
  mlb: {
    endpoint: 'baseball/mlb',
    extractStats: extractMlbStats,
    priority: 4
  },
  nba: {
    endpoint: 'basketball/nba',
    extractStats: extractNbaStats,
    priority: 5
  },
  nfl: {
    endpoint: 'football/nfl',
    extractStats: extractNflStats,
    priority: 6 // Already high coverage
  }
}

async function turboScrape() {
  const { count: initialCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`Starting with ${initialCount?.toLocaleString() || 0} player stats\n`))
  
  const cutoffDate = new Date('2024-12-31T23:59:59.999Z')
  const startDate = new Date('2023-01-01T00:00:00.000Z')
  
  // Get existing stats
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
  
  // Get games by sport in priority order
  const sportsList = Object.entries(SPORT_CONFIGS)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([sport]) => sport)
  
  let totalProcessed = 0
  let totalSuccessful = 0
  let totalPlayerStats = 0
  const overallStartTime = Date.now()
  
  for (const sport of sportsList) {
    console.log(chalk.cyan(`\n🏆 Processing ${sport.toUpperCase()}...\n`))
    
    // Get games needing stats
    const games = []
    offset = 0
    
    while (true) {
      const { data } = await supabase
        .from('games')
        .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
        .or(`sport.eq.${sport.toUpperCase()},sport.eq.${sport}`)
        .like('external_id', `espn_${sport}_%`)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', cutoffDate.toISOString())
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .range(offset, offset + 999)
        .order('start_time', { ascending: false })
      
      if (!data || data.length === 0) break
      
      const needingStats = data.filter(g => !gamesWithStats.has(g.id))
      games.push(...needingStats)
      
      offset += 1000
      if (data.length < 1000) break
    }
    
    if (games.length === 0) {
      console.log(chalk.green(`✅ All ${sport.toUpperCase()} games have stats!`))
      continue
    }
    
    console.log(chalk.yellow(`Found ${games.length} ${sport.toUpperCase()} games needing stats`))
    
    const config = SPORT_CONFIGS[sport as keyof typeof SPORT_CONFIGS]
    let sportSuccessful = 0
    let sportStats = 0
    let sportErrors = 0
    const sportStartTime = Date.now()
    
    // Process in batches
    const batchSize = 100
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, Math.min(i + batchSize, games.length))
      
      const promises = batch.map(game => 
        limit(async () => {
          try {
            const espnId = game.external_id.split('_')[2]
            const url = `https://site.api.espn.com/apis/site/v2/sports/${config.endpoint}/summary?event=${espnId}`
            
            const response = await axios.get(url, { 
              timeout: 5000,
              validateStatus: (status) => status < 500,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            })
            
            if (response.status === 200 && response.data.boxscore) {
              const stats = config.extractStats(response.data.boxscore, game)
              
              if (stats.length > 0) {
                const statsWithDate = stats.map(stat => ({
                  ...stat,
                  game_date: new Date(game.start_time).toISOString().split('T')[0]
                }))
                
                await saveStatsCarefully(statsWithDate, sport.toUpperCase())
                sportSuccessful++
                sportStats += stats.length
                gamesWithStats.add(game.id) // Mark as complete
                
                if (sportSuccessful % 25 === 0) {
                  const elapsed = (Date.now() - sportStartTime) / 1000
                  const rate = sportSuccessful / elapsed
                  console.log(chalk.green(
                    `  ✅ ${sportSuccessful} games, ${sportStats.toLocaleString()} stats (${rate.toFixed(1)} games/sec)`
                  ))
                }
              }
            } else if (response.status === 404) {
              sportErrors++
            }
          } catch (error: any) {
            if (!error.message?.includes('ECONNRESET')) {
              sportErrors++
            }
          }
          
          totalProcessed++
        })
      )
      
      await Promise.all(promises)
      
      // Progress update
      if (totalProcessed % 200 === 0) {
        const elapsed = (Date.now() - overallStartTime) / 1000
        const rate = totalProcessed / elapsed
        console.log(chalk.cyan(
          `Overall: ${totalProcessed} processed, ${totalSuccessful} successful (${rate.toFixed(1)} games/sec)`
        ))
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    totalSuccessful += sportSuccessful
    totalPlayerStats += sportStats
    
    const sportElapsed = (Date.now() - sportStartTime) / 1000
    console.log(chalk.green(
      `\n${sport.toUpperCase()} complete: ${sportSuccessful}/${games.length} games, ` +
      `${sportStats.toLocaleString()} stats in ${sportElapsed.toFixed(1)}s` +
      (sportErrors > 0 ? ` (${sportErrors} errors)` : '')
    ))
  }
  
  // Final report
  const overallElapsed = (Date.now() - overallStartTime) / 1000
  console.log(chalk.bold.green('\n✅ TURBO SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${totalProcessed.toLocaleString()}`))
  console.log(chalk.white(`  Games with stats: ${totalSuccessful.toLocaleString()}`))
  console.log(chalk.white(`  Player stats saved: ${totalPlayerStats.toLocaleString()}`))
  console.log(chalk.white(`  Time: ${Math.floor(overallElapsed / 60)}m ${Math.floor(overallElapsed % 60)}s`))
  console.log(chalk.white(`  Rate: ${(totalProcessed / overallElapsed).toFixed(1)} games/sec`))
  
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 FINAL STATS COUNT: ${finalCount?.toLocaleString() || 0}`))
  console.log(chalk.bold.green(`📈 ADDED ${((finalCount || 0) - (initialCount || 0)).toLocaleString()} NEW PLAYER STATS!`))
}

// Extract functions for each sport
function extractNbaStats(boxscore: any, game: any): any[] {
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
              if (!athlete.stats || athlete.stats.length < 14) return
              
              const minutesStr = athlete.stats[0]
              if (typeof minutesStr !== 'string' || minutesStr === 'DNP' || !minutesStr.match(/\d+/)) return
              
              const minutes = parseInt(minutesStr)
              if (minutes === 0) return
              
              const fgParts = typeof athlete.stats[1] === 'string' ? 
                athlete.stats[1].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
              const threeParts = typeof athlete.stats[2] === 'string' ? 
                athlete.stats[2].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
              const ftParts = typeof athlete.stats[3] === 'string' ? 
                athlete.stats[3].split('-').map((s: string) => parseInt(s) || 0) : [0, 0]
              
              stats.push({
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: {
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
              })
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

function extractNcaabStats(boxscore: any, game: any): any[] {
  // Same as NBA
  return extractNbaStats(boxscore, game)
}

function extractNflStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        Object.entries(teamData.statistics || {}).forEach(([category, data]: [string, any]) => {
          if (data.athletes && Array.isArray(data.athletes)) {
            data.athletes.forEach((athlete: any) => {
              if (!athlete.stats || athlete.stats.length === 0) return
              
              const playerStats: any = {
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: {}
              }
              
              if (data.name === 'passing' && athlete.stats.length >= 9) {
                const compAtt = athlete.stats[0].split('/')
                playerStats.stats = {
                  completions: parseInt(compAtt[0]) || 0,
                  attempts: parseInt(compAtt[1]) || 0,
                  passing_yards: parseInt(athlete.stats[1]) || 0,
                  passing_touchdowns: parseInt(athlete.stats[3]) || 0,
                  interceptions: parseInt(athlete.stats[4]) || 0,
                  passer_rating: parseFloat(athlete.stats[7]) || 0
                }
              } else if (data.name === 'rushing' && athlete.stats.length >= 5) {
                playerStats.stats = {
                  carries: parseInt(athlete.stats[0]) || 0,
                  rushing_yards: parseInt(athlete.stats[1]) || 0,
                  rushing_touchdowns: parseInt(athlete.stats[3]) || 0
                }
              } else if (data.name === 'receiving' && athlete.stats.length >= 6) {
                playerStats.stats = {
                  receptions: parseInt(athlete.stats[0]) || 0,
                  receiving_yards: parseInt(athlete.stats[1]) || 0,
                  receiving_touchdowns: parseInt(athlete.stats[3]) || 0,
                  targets: parseInt(athlete.stats[5]) || 0
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

function extractNcaafStats(boxscore: any, game: any): any[] {
  // Same as NFL
  return extractNflStats(boxscore, game)
}

function extractMlbStats(boxscore: any, game: any): any[] {
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
              
              if (statGroup.name === 'batting' && athlete.stats.length >= 8) {
                // AB, R, H, RBI, BB, K, AVG, OPS
                playerStats.stats = {
                  at_bats: parseInt(athlete.stats[0]) || 0,
                  runs: parseInt(athlete.stats[1]) || 0,
                  hits: parseInt(athlete.stats[2]) || 0,
                  rbi: parseInt(athlete.stats[3]) || 0,
                  walks: parseInt(athlete.stats[4]) || 0,
                  strikeouts: parseInt(athlete.stats[5]) || 0
                }
              } else if (statGroup.name === 'pitching' && athlete.stats.length >= 7) {
                // IP, H, R, ER, BB, K, PC-ST
                playerStats.stats = {
                  innings_pitched: parseFloat(athlete.stats[0]) || 0,
                  hits_allowed: parseInt(athlete.stats[1]) || 0,
                  runs_allowed: parseInt(athlete.stats[2]) || 0,
                  earned_runs: parseInt(athlete.stats[3]) || 0,
                  walks_allowed: parseInt(athlete.stats[4]) || 0,
                  strikeouts_pitched: parseInt(athlete.stats[5]) || 0
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

function extractNhlStats(boxscore: any, game: any): any[] {
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
              
              if (statGroup.name === 'skaters' && athlete.stats.length >= 8) {
                // Handle +/- which might have + prefix
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
              } else if (statGroup.name === 'goalies' && athlete.stats.length >= 5) {
                playerStats.stats = {
                  shots_against: parseInt(athlete.stats[0]) || 0,
                  goals_against: parseInt(athlete.stats[1]) || 0,
                  saves: parseInt(athlete.stats[2]) || 0,
                  save_percentage: parseFloat(athlete.stats[3]) || 0
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

async function saveStatsCarefully(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  // Create unique players
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `${sport} Player ${id}`,
    sport
  }))
  
  // Insert players, ignoring conflicts
  for (let i = 0; i < players.length; i += 100) {
    const batch = players.slice(i, i + 100)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  // Remove any duplicate stats within the batch
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat)
    }
  })
  
  // Save unique stats in smaller batches
  const uniqueStatsArray = Array.from(uniqueStats.values())
  for (let i = 0; i < uniqueStatsArray.length; i += 25) {
    const batch = uniqueStatsArray.slice(i, i + 25)
    try {
      await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
    } catch (error: any) {
      // Ignore duplicate errors
      if (!error.message?.includes('duplicate') && !error.message?.includes('CONFLICT')) {
        console.error(chalk.red(`Save error: ${error.message}`))
      }
    }
  }
}

// RUN IT!
turboScrape().catch(console.error)