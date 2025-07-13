#!/usr/bin/env tsx
/**
 * UPDATE SCRAPERS TO USE STANDARDIZED ESPN IDs
 * This creates a new scraper that uses the standardized format
 */

import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import * as dotenv from 'dotenv'
import * as os from 'os'
import { generateEspnId, buildEspnApiUrl, getEspnApiEndpoint, SportCode, VALID_SPORT_CODES } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 4)

console.log(chalk.bold.red(`🚀 STANDARDIZED ESPN SCRAPER!`))
console.log(chalk.yellow(`Using standardized ESPN ID format: espn_{sport}_{numeric_id}\n`))

async function scrapeWithStandardIds() {
  const { count: initialCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`Starting with ${initialCount?.toLocaleString() || 0} player stats\n`))
  
  // Process each sport
  for (const sport of VALID_SPORT_CODES) {
    if (sport === 'mls') continue // Skip MLS for now
    
    console.log(chalk.cyan(`\n🏆 Processing ${sport.toUpperCase()}...\n`))
    
    // Get games needing stats with standardized IDs
    const games = []
    let offset = 0
    
    while (true) {
      const { data } = await supabase
        .from('games')
        .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
        .like('external_id', `espn_${sport}_%`)
        .not('external_id', 'like', '%_dup%')
        .not('external_id', 'like', '%_alt%')
        .gte('start_time', '2023-01-01')
        .lte('start_time', '2024-12-31')
        .not('home_score', 'is', null)
        .range(offset, offset + 999)
        .order('start_time', { ascending: false })
      
      if (!data || data.length === 0) break
      
      games.push(...data)
      offset += 1000
      if (data.length < 1000) break
    }
    
    if (games.length === 0) {
      console.log(chalk.yellow(`No ${sport.toUpperCase()} games found with standardized IDs`))
      continue
    }
    
    // Check which games already have stats
    const gamesWithStats = new Set<number>()
    const gameIds = games.map(g => g.id)
    
    for (let i = 0; i < gameIds.length; i += 1000) {
      const batch = gameIds.slice(i, i + 1000)
      const { data } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', batch)
        
      data?.forEach(row => gamesWithStats.add(row.game_id))
    }
    
    const needingStats = games.filter(g => !gamesWithStats.has(g.id))
    
    console.log(chalk.yellow(`${sport.toUpperCase()}: ${games.length} total, ${needingStats.length} need stats`))
    
    if (needingStats.length === 0) {
      console.log(chalk.green(`✅ All ${sport.toUpperCase()} games have stats!`))
      continue
    }
    
    // Process games
    let successful = 0
    let totalStats = 0
    let errors = 0
    const startTime = Date.now()
    
    const promises = needingStats.slice(0, 500).map(game => // Limit to 500 for testing
      limit(async () => {
        try {
          // Extract numeric ID from standardized format
          const numericId = game.external_id.split('_')[2]
          if (!numericId) return
          
          // Build API URL using utility
          const apiUrl = buildEspnApiUrl(game.external_id)
          if (!apiUrl) return
          
          const response = await axios.get(apiUrl, { 
            timeout: 5000,
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
              
              await saveStats(statsWithDate, sport.toUpperCase())
              successful++
              totalStats += stats.length
              
              if (successful % 10 === 0) {
                console.log(chalk.green(`  ✅ ${successful} games, ${totalStats} stats`))
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
      `${sport.toUpperCase()} complete: ${successful}/${needingStats.slice(0, 500).length} games, ` +
      `${totalStats} stats in ${elapsed.toFixed(1)}s` +
      (errors > 0 ? ` (${errors} errors)` : '')
    ))
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 FINAL STATS COUNT: ${finalCount?.toLocaleString() || 0}`))
  console.log(chalk.bold.green(`📈 ADDED ${((finalCount || 0) - (initialCount || 0)).toLocaleString()} NEW PLAYER STATS!`))
  
  console.log(chalk.bold.cyan('\n🎯 All future scrapers will use standardized ESPN IDs!'))
}

function extractStatsForSport(boxscore: any, game: any, sport: SportCode): any[] {
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
              if (sport === 'nba' || sport === 'ncaab') {
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
              } else if (sport === 'nfl' || sport === 'ncaaf') {
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
              } else if (sport === 'mlb') {
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
              } else if (sport === 'nhl') {
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
  
  // Create players with standardized IDs
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: generateEspnId(sport.toLowerCase(), id), // Use standardized format
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
  
  // Save stats
  const uniqueStatsArray = Array.from(uniqueStats.values())
  for (let i = 0; i < uniqueStatsArray.length; i += 25) {
    const batch = uniqueStatsArray.slice(i, i + 25)
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
scrapeWithStandardIds().catch(console.error)