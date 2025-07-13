#!/usr/bin/env tsx
/**
 * SCRAPE ALL MISSING STATS - FOR REAL THIS TIME!
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

console.log(chalk.bold.red(`🔥 SCRAPING ALL MISSING STATS - ${cpuCount * 4} CONCURRENT REQUESTS!\n`))

interface GameNeedingStats {
  id: number
  external_id: string
  sport: string
  home_team_id: number
  away_team_id: number
}

async function findGamesWithoutStats(): Promise<GameNeedingStats[]> {
  console.log(chalk.yellow('Finding games without stats...'))
  
  // Get all ESPN games
  const allGames: GameNeedingStats[] = []
  let offset = 0
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id')
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)
      .range(offset, offset + 999)
      .order('id')
    
    if (error || !data || data.length === 0) break
    
    allGames.push(...data)
    offset += 1000
    
    if (data.length < 1000) break
  }
  
  console.log(chalk.cyan(`Total ESPN games: ${allGames.length}`))
  
  // Get games that have stats
  const gamesWithStats = new Set<number>()
  offset = 0
  
  while (true) {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .range(offset, offset + 999)
    
    if (error || !data || data.length === 0) break
    
    data.forEach(row => gamesWithStats.add(row.game_id))
    offset += 1000
    
    if (data.length < 1000) break
  }
  
  console.log(chalk.cyan(`Games with stats: ${gamesWithStats.size}`))
  
  // Filter to games without stats
  const gamesWithoutStats = allGames.filter(g => !gamesWithStats.has(g.id))
  
  console.log(chalk.bold.red(`\n🎯 GAMES NEEDING STATS: ${gamesWithoutStats.length}\n`))
  
  return gamesWithoutStats
}

async function scrapeGameStats(game: GameNeedingStats): Promise<any[]> {
  const espnId = game.external_id.split('_')[2]
  const sport = game.sport.toLowerCase()
  
  const sportMap: Record<string, string> = {
    'nba': 'basketball/nba',
    'nfl': 'football/nfl',
    'mlb': 'baseball/mlb',
    'nhl': 'hockey/nhl',
    'ncaab': 'basketball/mens-college-basketball',
    'ncaaf': 'football/college-football'
  }

  const endpoint = sportMap[sport]
  if (!endpoint) return []

  const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${espnId}`
  
  try {
    const response = await axios.get(url, { 
      timeout: 5000,
      validateStatus: (status) => status < 500
    })
    
    if (!response.data.boxscore) return []
    
    const boxscore = response.data.boxscore
    const stats: any[] = []

    // Basketball
    if (sport === 'nba' || sport === 'ncaab') {
      boxscore.teams?.forEach((team: any) => {
        const teamId = parseInt(team.team.id)
        const isHome = team.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'players' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length > 0) {
                const playerStats = {
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
                }
                stats.push(playerStats)
              }
            })
          }
        })
      })
    }
    
    // Football
    else if (sport === 'nfl' || sport === 'ncaaf') {
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
              
              if (categoryName === 'passing') {
                playerStats.stats.completions = parseInt(athlete.stats[0]) || 0
                playerStats.stats.attempts = parseInt(athlete.stats[1]) || 0
                playerStats.stats.passing_yards = parseInt(athlete.stats[2]) || 0
                playerStats.stats.passing_touchdowns = parseInt(athlete.stats[4]) || 0
                playerStats.stats.interceptions = parseInt(athlete.stats[5]) || 0
              } else if (categoryName === 'rushing') {
                playerStats.stats.carries = parseInt(athlete.stats[0]) || 0
                playerStats.stats.rushing_yards = parseInt(athlete.stats[1]) || 0
                playerStats.stats.rushing_touchdowns = parseInt(athlete.stats[3]) || 0
              } else if (categoryName === 'receiving') {
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
    }
    
    return stats
  } catch (error) {
    return []
  }
}

async function savePlayerStats(stats: any[]) {
  if (stats.length === 0) return
  
  // Create players if needed
  const uniquePlayerIds = Array.from(new Set(stats.map(s => s.player_id)))
  
  for (const batch of chunk(uniquePlayerIds, 100)) {
    const players = batch.map(id => ({
      id,
      external_id: `espn_${id}`,
      name: `Player ${id}`,
      sport: 'unknown'
    }))
    
    await supabase
      .from('players')
      .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  // Save stats in batches
  for (const batch of chunk(stats, 100)) {
    const { error } = await supabase
      .from('player_game_logs')
      .upsert(batch, { 
        onConflict: 'player_id,game_id',
        ignoreDuplicates: false 
      })
    
    if (error) {
      console.error(chalk.red('Error saving stats:'), error.message)
    }
  }
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

async function scrapeAllMissingStats() {
  const startTime = Date.now()
  
  // Find games without stats
  const gamesWithoutStats = await findGamesWithoutStats()
  
  if (gamesWithoutStats.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'))
    return
  }
  
  // Group by sport
  const bySport: Record<string, GameNeedingStats[]> = {}
  gamesWithoutStats.forEach(g => {
    bySport[g.sport] = bySport[g.sport] || []
    bySport[g.sport].push(g)
  })
  
  console.log(chalk.cyan('Breakdown by sport:'))
  Object.entries(bySport).forEach(([sport, games]) => {
    console.log(chalk.white(`  ${sport}: ${games.length} games`))
  })
  
  // Process all games
  let totalProcessed = 0
  let totalStats = 0
  let gamesWithData = 0
  
  for (const [sport, games] of Object.entries(bySport)) {
    console.log(chalk.yellow(`\n🏃 Processing ${sport} games...`))
    
    const promises = games.map(game => 
      limit(async () => {
        const stats = await scrapeGameStats(game)
        if (stats.length > 0) {
          await savePlayerStats(stats)
          totalStats += stats.length
          gamesWithData++
        }
        totalProcessed++
        
        if (totalProcessed % 100 === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = totalProcessed / elapsed
          console.log(chalk.cyan(`Progress: ${totalProcessed}/${gamesWithoutStats.length} (${rate.toFixed(1)} games/sec) - ${totalStats} stats found`))
        }
      })
    )
    
    await Promise.all(promises)
  }
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  const minutes = Math.floor(elapsed / 60)
  const seconds = Math.floor(elapsed % 60)
  
  console.log(chalk.bold.green('\n✅ SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${totalProcessed}`))
  console.log(chalk.white(`  Games with data: ${gamesWithData}`))
  console.log(chalk.white(`  Player stats added: ${totalStats}`))
  console.log(chalk.white(`  Time: ${minutes}m ${seconds}s`))
  console.log(chalk.white(`  Rate: ${(totalProcessed / elapsed).toFixed(1)} games/sec`))
  
  // Check new total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.bold.yellow(`\n📊 NEW TOTAL: ${count?.toLocaleString() || 0} player_game_logs!`))
}

// RUN IT!
scrapeAllMissingStats().catch(console.error)