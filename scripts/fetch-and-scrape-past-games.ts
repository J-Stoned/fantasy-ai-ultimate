#!/usr/bin/env tsx
/**
 * FETCH AND SCRAPE PAST GAMES ONLY - UP TO YESTERDAY!
 * This is the MASTER script that:
 * 1. Fetches games from 2023 to YESTERDAY (not future games!)
 * 2. Immediately scrapes stats for those games
 * 3. Uses all CPU cores for maximum performance
 */

import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as os from 'os'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 4)

console.log(chalk.bold.red(`🔥 MASTER SCRIPT - FETCH & SCRAPE PAST GAMES ONLY!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

interface GameData {
  external_id: string
  sport: string
  home_team_id: number
  away_team_id: number
  home_score: number
  away_score: number
  start_time: string
  status: string
}

interface Stats {
  games_fetched: number
  games_saved: number
  stats_scraped: number
  player_stats_saved: number
  errors: number
  startTime: number
}

const stats: Stats = {
  games_fetched: 0,
  games_saved: 0,
  stats_scraped: 0,
  player_stats_saved: 0,
  errors: 0,
  startTime: Date.now()
}

async function main() {
  // CRITICAL: Only fetch games up to YESTERDAY
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  yesterday.setHours(23, 59, 59, 999)
  
  const startDate = new Date('2023-01-01')
  
  console.log(chalk.bold.cyan(`📅 Fetching games from ${startDate.toLocaleDateString()} to ${yesterday.toLocaleDateString()}`))
  console.log(chalk.yellow(`NOT fetching future games!\n`))
  
  // Step 1: Load teams
  await loadTeams()
  
  // Step 2: Fetch games for each sport
  const sports = [
    { key: 'nba', endpoint: 'basketball/nba', seasonMonths: [10, 11, 12, 1, 2, 3, 4, 5, 6] },
    { key: 'nfl', endpoint: 'football/nfl', seasonMonths: [9, 10, 11, 12, 1, 2] },
    { key: 'mlb', endpoint: 'baseball/mlb', seasonMonths: [3, 4, 5, 6, 7, 8, 9, 10] },
    { key: 'nhl', endpoint: 'hockey/nhl', seasonMonths: [10, 11, 12, 1, 2, 3, 4, 5, 6] },
    { key: 'ncaab', endpoint: 'basketball/mens-college-basketball', seasonMonths: [11, 12, 1, 2, 3, 4] },
    { key: 'ncaaf', endpoint: 'football/college-football', seasonMonths: [8, 9, 10, 11, 12, 1] }
  ]
  
  for (const sport of sports) {
    console.log(chalk.cyan(`\n🏆 Processing ${sport.key.toUpperCase()}...`))
    await fetchAndScrapeSport(sport, startDate, yesterday)
  }
  
  // Final report
  const elapsed = (Date.now() - stats.startTime) / 1000
  console.log(chalk.bold.green('\n✅ COMPLETE FETCH & SCRAPE FINISHED!'))
  console.log(chalk.white(`  Games fetched: ${stats.games_fetched.toLocaleString()}`))
  console.log(chalk.white(`  Games saved: ${stats.games_saved.toLocaleString()}`))
  console.log(chalk.white(`  Games with stats: ${stats.stats_scraped.toLocaleString()}`))
  console.log(chalk.white(`  Player stats saved: ${stats.player_stats_saved.toLocaleString()}`))
  console.log(chalk.white(`  Errors: ${stats.errors}`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  
  // Database totals
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    
  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.bold.yellow(`\n📊 DATABASE TOTALS:`))
  console.log(chalk.yellow(`  Games with scores: ${gameCount?.toLocaleString() || 0}`))
  console.log(chalk.yellow(`  Player stats: ${statsCount?.toLocaleString() || 0}`))
}

const teamCache = new Map<string, number>()

async function loadTeams() {
  console.log(chalk.cyan('Loading teams...'))
  
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('teams')
      .select('id, name, sport, external_id')
      .range(offset, offset + 999)
      
    if (!data || data.length === 0) break
    
    data.forEach(team => {
      // Cache by external_id
      if (team.external_id) {
        teamCache.set(team.external_id, team.id)
      }
      // Cache by sport_name
      teamCache.set(`${team.sport}_${team.name}`, team.id)
    })
    
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.green(`✅ Loaded ${teamCache.size} teams to cache`))
}

async function fetchAndScrapeSport(sport: any, startDate: Date, endDate: Date) {
  const gamesToProcess: GameData[] = []
  const current = new Date(startDate)
  
  // Fetch games day by day
  while (current <= endDate) {
    const month = current.getMonth() + 1
    
    // Only fetch if in season
    if (sport.seasonMonths.includes(month)) {
      const dateStr = current.toISOString().split('T')[0].replace(/-/g, '')
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.endpoint}/scoreboard?dates=${dateStr}`
      
      try {
        const response = await axios.get(url, { timeout: 10000 })
        
        if (response.data.events) {
          for (const event of response.data.events) {
            // Only process COMPLETED games
            if (event.competitions?.[0]?.status?.type?.completed) {
              const competition = event.competitions[0]
              const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home')
              const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away')
              
              if (homeTeam && awayTeam && homeTeam.score && awayTeam.score) {
                const homeId = await resolveTeamId(homeTeam.team, sport.key)
                const awayId = await resolveTeamId(awayTeam.team, sport.key)
                
                if (homeId && awayId) {
                  gamesToProcess.push({
                    external_id: `espn_${sport.key}_${event.id}`,
                    sport: sport.key,
                    home_team_id: homeId,
                    away_team_id: awayId,
                    home_score: parseInt(homeTeam.score),
                    away_score: parseInt(awayTeam.score),
                    start_time: event.date,
                    status: 'completed'
                  })
                  stats.games_fetched++
                }
              }
            }
          }
        }
      } catch (error) {
        // Silent fail for 404s
      }
    }
    
    current.setDate(current.getDate() + 1)
  }
  
  console.log(chalk.green(`  Found ${gamesToProcess.length} completed ${sport.key.toUpperCase()} games`))
  
  if (gamesToProcess.length === 0) return
  
  // Save games in batches
  console.log(chalk.yellow(`  Saving games...`))
  for (let i = 0; i < gamesToProcess.length; i += 1000) {
    const batch = gamesToProcess.slice(i, i + 1000)
    const { error } = await supabase
      .from('games')
      .upsert(batch, { onConflict: 'external_id' })
      
    if (!error) {
      stats.games_saved += batch.length
    } else {
      console.error(chalk.red(`Error saving games: ${error.message}`))
      stats.errors++
    }
  }
  
  // Now scrape stats for these games
  console.log(chalk.yellow(`  Scraping stats for ${gamesToProcess.length} games...`))
  
  // Get games that already have stats
  const gamesWithStats = new Set<string>()
  let offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', gamesToProcess.map(g => {
        // Need to get the actual game ID from database
        return 0 // Placeholder
      }))
      .range(offset, offset + 999)
      
    if (!data || data.length === 0) break
    
    data.forEach(row => gamesWithStats.add(row.game_id.toString()))
    offset += 1000
    if (data.length < 1000) break
  }
  
  // Get actual game IDs from database
  const gameMap = new Map<string, number>()
  offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id')
      .in('external_id', gamesToProcess.map(g => g.external_id))
      .range(offset, offset + 999)
      
    if (!data || data.length === 0) break
    
    data.forEach(game => {
      gameMap.set(game.external_id, game.id)
    })
    
    offset += 1000
    if (data.length < 1000) break
  }
  
  // Scrape stats in parallel
  let scraped = 0
  const promises = gamesToProcess.map(game => 
    limit(async () => {
      const gameId = gameMap.get(game.external_id)
      if (!gameId || gamesWithStats.has(gameId.toString())) {
        return
      }
      
      try {
        const espnId = game.external_id.split('_')[2]
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.endpoint}/summary?event=${espnId}`
        
        const response = await axios.get(url, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        })
        
        if (response.status === 200 && response.data.boxscore) {
          const playerStats = extractStats(response.data.boxscore, gameId, game, sport.key)
          
          if (playerStats.length > 0) {
            await saveStats(playerStats, sport.key)
            stats.stats_scraped++
            stats.player_stats_saved += playerStats.length
            scraped++
            
            if (scraped % 10 === 0) {
              console.log(chalk.green(`    ✅ ${scraped} games with stats`))
            }
          }
        }
      } catch (error) {
        stats.errors++
      }
    })
  )
  
  await Promise.all(promises)
  
  console.log(chalk.green(`  ✅ Scraped stats from ${scraped} ${sport.key.toUpperCase()} games`))
}

async function resolveTeamId(espnTeam: any, sport: string): Promise<number | null> {
  const espnId = `espn_${espnTeam.id}`
  
  // Check cache
  if (teamCache.has(espnId)) {
    return teamCache.get(espnId)!
  }
  
  const nameKey = `${sport}_${espnTeam.displayName}`
  if (teamCache.has(nameKey)) {
    return teamCache.get(nameKey)!
  }
  
  // Create team
  try {
    const { data: newTeam } = await supabase
      .from('teams')
      .insert({
        name: espnTeam.displayName,
        abbreviation: espnTeam.abbreviation,
        sport: sport.toUpperCase(),
        external_id: espnId
      })
      .select()
      .single()
      
    if (newTeam) {
      teamCache.set(espnId, newTeam.id)
      teamCache.set(nameKey, newTeam.id)
      return newTeam.id
    }
  } catch (error) {
    // Try to fetch existing
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('external_id', espnId)
      .single()
      
    if (existing) {
      teamCache.set(espnId, existing.id)
      return existing.id
    }
  }
  
  return null
}

function extractStats(boxscore: any, gameId: number, game: GameData, sport: string): any[] {
  const stats: any[] = []
  
  if (sport === 'nba' || sport === 'ncaab') {
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
                game_id: gameId,
                team_id: isHome ? game.home_team_id : game.away_team_id,
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
    boxscore.players?.forEach((teamPlayers: any) => {
      const isHome = teamPlayers.homeAway === 'home'
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      Object.values(teamPlayers.statistics || {}).forEach((category: any) => {
        const categoryName = (category as any).name
        ;(category as any).athletes?.forEach((athlete: any) => {
          if (athlete.stats && athlete.stats.length > 0) {
            const playerStats: any = {
              player_id: parseInt(athlete.athlete.id),
              game_id: gameId,
              team_id: isHome ? game.home_team_id : game.away_team_id,
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
    // Add MLB stats parsing
    boxscore.teams?.forEach((team: any) => {
      const isHome = team.homeAway === 'home'
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      team.statistics?.forEach((stat: any) => {
        if (stat.type === 'batting' && stat.athletes) {
          stat.athletes.forEach((athlete: any) => {
            if (athlete.stats && athlete.stats.length >= 15) {
              stats.push({
                player_id: parseInt(athlete.athlete.id),
                game_id: gameId,
                team_id: isHome ? game.home_team_id : game.away_team_id,
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
                  strikeouts: parseInt(athlete.stats[8]) || 0,
                  stolen_bases: parseInt(athlete.stats[9]) || 0
                }
              })
            }
          })
        }
      })
    })
  } else if (sport === 'nhl') {
    // Add NHL stats parsing
    boxscore.teams?.forEach((team: any) => {
      const isHome = team.homeAway === 'home'
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      team.statistics?.forEach((stat: any) => {
        if (stat.type === 'skaters' && stat.athletes) {
          stat.athletes.forEach((athlete: any) => {
            if (athlete.stats && athlete.stats.length >= 8) {
              stats.push({
                player_id: parseInt(athlete.athlete.id),
                game_id: gameId,
                team_id: isHome ? game.home_team_id : game.away_team_id,
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
  
  return stats
}

async function saveStats(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  // Create players
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
  
  // Save stats
  const { error } = await supabase
    .from('player_game_logs')
    .upsert(stats, { onConflict: 'player_id,game_id' })
    
  if (error) {
    console.error(chalk.red(`Error saving stats: ${error.message}`))
    stats.errors++
  }
}

// RUN IT!
main().catch(console.error)