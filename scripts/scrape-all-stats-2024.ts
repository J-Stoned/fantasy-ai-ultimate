#!/usr/bin/env tsx
/**
 * SCRAPE ALL STATS - 2023 TO DEC 2024 ONLY!
 * Uses REAL date cutoff to avoid future games
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

console.log(chalk.bold.red(`🔥 SCRAPING ALL STATS - 2023 TO DEC 2024!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

async function scrapeAllStats2024() {
  // Use ACTUAL cutoff date - December 2024
  const cutoffDate = new Date('2024-12-31T23:59:59.999Z')
  const startDate = new Date('2023-01-01T00:00:00.000Z')
  
  console.log(chalk.bold.cyan(`📅 Processing games from ${startDate.toLocaleDateString()} to ${cutoffDate.toLocaleDateString()}`))
  console.log(chalk.yellow(`This ensures we only get games that have actually been played!\n`))
  
  // Get games with existing stats
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
  
  console.log(chalk.cyan(`Games already with stats: ${gamesWithStats.size.toLocaleString()}`))
  
  // Get all games from 2023-2024 period
  const gamesToProcess = []
  offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
      .like('external_id', 'espn_%')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', cutoffDate.toISOString())
      .not('home_score', 'is', null) // Only completed games
      .not('away_score', 'is', null)
      .not('sport', 'is', null) // Exclude null sports
      .range(offset, offset + 999)
      .order('start_time', { ascending: false })
    
    if (!data || data.length === 0) break
    
    // Filter out games with stats and validate data
    const validGames = data.filter(g => 
      !gamesWithStats.has(g.id) && 
      g.sport && 
      g.external_id && 
      g.external_id.includes('_')
    )
    
    gamesToProcess.push(...validGames)
    
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.bold.red(`\n🎯 GAMES NEEDING STATS: ${gamesToProcess.length.toLocaleString()}\n`))
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'))
    return
  }
  
  // Show breakdown by sport
  const sportBreakdown: Record<string, number> = {}
  const dateBreakdown: Record<string, number> = {}
  
  gamesToProcess.forEach(g => {
    const sport = g.sport.toLowerCase()
    sportBreakdown[sport] = (sportBreakdown[sport] || 0) + 1
    
    const yearMonth = new Date(g.start_time).toISOString().substring(0, 7)
    dateBreakdown[yearMonth] = (dateBreakdown[yearMonth] || 0) + 1
  })
  
  console.log(chalk.cyan('Games by sport:'))
  Object.entries(sportBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(chalk.white(`  ${sport}: ${count.toLocaleString()}`))
    })
  
  console.log(chalk.cyan('\nGames by month:'))
  Object.entries(dateBreakdown)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 10)
    .forEach(([month, count]) => {
      console.log(chalk.white(`  ${month}: ${count.toLocaleString()}`))
    })
  
  // Process games
  let processed = 0
  let successCount = 0
  let totalStats = 0
  let apiErrors = 0
  const startTime = Date.now()
  
  console.log(chalk.yellow('\n🚀 Starting stats scrape...\n'))
  
  const promises = gamesToProcess.map(game => 
    limit(async () => {
      try {
        const parts = game.external_id.split('_')
        if (parts.length !== 3 || parts[0] !== 'espn') {
          processed++
          return
        }
        
        const sport = parts[1].toLowerCase()
        const espnId = parts[2]
        
        const sportMap: Record<string, string> = {
          'nba': 'basketball/nba',
          'nfl': 'football/nfl',
          'mlb': 'baseball/mlb',
          'nhl': 'hockey/nhl',
          'mls': 'soccer/usa.1',
          'ncaab': 'basketball/mens-college-basketball',
          'ncaaf': 'football/college-football'
        }
        
        const endpoint = sportMap[sport]
        if (!endpoint) {
          processed++
          return
        }
        
        const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${espnId}`
        
        const response = await axios.get(url, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        })
        
        if (response.status === 404) {
          apiErrors++
        } else if (response.status === 200 && response.data.boxscore) {
          const stats = extractStats(response.data.boxscore, game, sport)
          
          if (stats.length > 0) {
            await saveStats(stats, sport)
            successCount++
            totalStats += stats.length
            
            if (successCount === 1 || successCount % 50 === 0) {
              console.log(chalk.green(`✅ ${successCount} games with stats, ${totalStats.toLocaleString()} player stats collected`))
            }
          }
        }
        
      } catch (error: any) {
        apiErrors++
      }
      
      processed++
      
      if (processed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = processed / elapsed
        const remaining = (gamesToProcess.length - processed) / rate
        console.log(chalk.cyan(
          `Progress: ${processed}/${gamesToProcess.length} - ` +
          `${successCount} games with stats - ` +
          `${rate.toFixed(1)} games/sec - ` +
          `ETA: ${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s`
        ))
      }
    })
  )
  
  await Promise.all(promises)
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green('\n✅ STATS SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${processed.toLocaleString()}`))
  console.log(chalk.white(`  Games with stats: ${successCount.toLocaleString()}`))
  console.log(chalk.white(`  Player stats saved: ${totalStats.toLocaleString()}`))
  console.log(chalk.white(`  API errors: ${apiErrors.toLocaleString()}`))
  console.log(chalk.white(`  Success rate: ${(successCount / processed * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  console.log(chalk.white(`  Rate: ${(processed / elapsed).toFixed(1)} games/sec`))
  
  // Check new total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 TOTAL PLAYER STATS IN DATABASE: ${count?.toLocaleString() || 0}!`))
}

function extractStats(boxscore: any, game: any, sport: string): any[] {
  const stats: any[] = []
  
  try {
    if (sport === 'nba' || sport === 'ncaab') {
      // Basketball stats
      boxscore.teams?.forEach((team: any) => {
        const teamId = parseInt(team.team.id)
        const isHome = team.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'players' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length >= 20 && parseInt(athlete.stats[0]) > 0) {
                stats.push({
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  stats: {
                    minutes: parseInt(athlete.stats[0]) || 0,
                    field_goals_made: parseInt(athlete.stats[1]) || 0,
                    field_goals_attempted: parseInt(athlete.stats[2]) || 0,
                    three_pointers_made: parseInt(athlete.stats[4]) || 0,
                    three_pointers_attempted: parseInt(athlete.stats[5]) || 0,
                    free_throws_made: parseInt(athlete.stats[7]) || 0,
                    free_throws_attempted: parseInt(athlete.stats[8]) || 0,
                    offensive_rebounds: parseInt(athlete.stats[10]) || 0,
                    defensive_rebounds: parseInt(athlete.stats[11]) || 0,
                    rebounds: parseInt(athlete.stats[12]) || 0,
                    assists: parseInt(athlete.stats[13]) || 0,
                    steals: parseInt(athlete.stats[14]) || 0,
                    blocks: parseInt(athlete.stats[15]) || 0,
                    turnovers: parseInt(athlete.stats[16]) || 0,
                    personal_fouls: parseInt(athlete.stats[17]) || 0,
                    points: parseInt(athlete.stats[19]) || 0
                  }
                })
              }
            })
          }
        })
      })
    } else if (sport === 'nfl' || sport === 'ncaaf') {
      // Football stats
      boxscore.players?.forEach((teamPlayers: any) => {
        const teamId = parseInt(teamPlayers.team.id)
        const isHome = teamPlayers.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        Object.values(teamPlayers.statistics || {}).forEach((category: any) => {
          const categoryName = (category as any).name
          ;(category as any).athletes?.forEach((athlete: any) => {
            if (athlete.stats && athlete.stats.length > 0) {
              const playerStats: any = {
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: {}
              }
              
              if (categoryName === 'passing' && athlete.stats.length >= 6) {
                playerStats.stats.completions = parseInt(athlete.stats[0]) || 0
                playerStats.stats.attempts = parseInt(athlete.stats[1]) || 0
                playerStats.stats.passing_yards = parseInt(athlete.stats[2]) || 0
                playerStats.stats.passing_touchdowns = parseInt(athlete.stats[4]) || 0
                playerStats.stats.interceptions = parseInt(athlete.stats[5]) || 0
              } else if (categoryName === 'rushing' && athlete.stats.length >= 4) {
                playerStats.stats.carries = parseInt(athlete.stats[0]) || 0
                playerStats.stats.rushing_yards = parseInt(athlete.stats[1]) || 0
                playerStats.stats.rushing_touchdowns = parseInt(athlete.stats[3]) || 0
              } else if (categoryName === 'receiving' && athlete.stats.length >= 4) {
                playerStats.stats.receptions = parseInt(athlete.stats[0]) || 0
                playerStats.stats.receiving_yards = parseInt(athlete.stats[1]) || 0
                playerStats.stats.receiving_touchdowns = parseInt(athlete.stats[3]) || 0
              }
              
              if (Object.keys(playerStats.stats).length > 0) {
                stats.push(playerStats)
              }
            }
          })
        })
      })
    } else if (sport === 'mlb') {
      // Baseball stats
      boxscore.teams?.forEach((team: any) => {
        const teamId = parseInt(team.team.id)
        const isHome = team.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'batting' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length >= 10) {
                stats.push({
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  stats: {
                    at_bats: parseInt(athlete.stats[0]) || 0,
                    runs: parseInt(athlete.stats[1]) || 0,
                    hits: parseInt(athlete.stats[2]) || 0,
                    doubles: parseInt(athlete.stats[3]) || 0,
                    triples: parseInt(athlete.stats[4]) || 0,
                    home_runs: parseInt(athlete.stats[5]) || 0,
                    rbi: parseInt(athlete.stats[6]) || 0,
                    walks: parseInt(athlete.stats[7]) || 0,
                    strikeouts: parseInt(athlete.stats[8]) || 0
                  }
                })
              }
            })
          }
        })
      })
    } else if (sport === 'nhl') {
      // Hockey stats
      boxscore.teams?.forEach((team: any) => {
        const teamId = parseInt(team.team.id)
        const isHome = team.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'skaters' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length >= 8) {
                stats.push({
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  stats: {
                    goals: parseInt(athlete.stats[0]) || 0,
                    assists: parseInt(athlete.stats[1]) || 0,
                    points: parseInt(athlete.stats[2]) || 0,
                    plus_minus: parseInt(athlete.stats[3]) || 0,
                    penalty_minutes: parseInt(athlete.stats[4]) || 0,
                    shots: parseInt(athlete.stats[5]) || 0,
                    blocks: parseInt(athlete.stats[6]) || 0,
                    hits: parseInt(athlete.stats[7]) || 0
                  }
                })
              }
            })
          }
        })
      })
    }
  } catch (error) {
    // Silently skip malformed data
  }
  
  return stats
}

async function saveStats(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  // Create players first
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `Player ${id}`,
    sport: sport.toUpperCase()
  }))
  
  await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  
  // Save stats in batches
  for (let i = 0; i < stats.length; i += 100) {
    const batch = stats.slice(i, i + 100)
    await supabase
      .from('player_game_logs')
      .upsert(batch, { onConflict: 'player_id,game_id' })
  }
}

// RUN IT!
scrapeAllStats2024().catch(console.error)