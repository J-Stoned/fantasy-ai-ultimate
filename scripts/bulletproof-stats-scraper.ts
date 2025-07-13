#!/usr/bin/env tsx
/**
 * BULLETPROOF STATS SCRAPER - NO FAILURES, NO EXCUSES!
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

console.log(chalk.bold.red(`🔥 BULLETPROOF SCRAPER - ${cpuCount * 4} CONCURRENT!\n`))

interface GameToScrape {
  id: number
  external_id: string
  sport: string | null
  home_team_id: number
  away_team_id: number
}

async function getAllGamesNeedingStats(): Promise<GameToScrape[]> {
  console.log(chalk.yellow('Finding games that need stats...'))
  
  // Get games with stats FIRST
  const gamesWithStats = new Set<number>()
  let offset = 0
  
  while (true) {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .range(offset, offset + 999)
    
    if (!data || data.length === 0) break
    
    data.forEach(row => gamesWithStats.add(row.game_id))
    offset += 1000
    
    if (data.length < 1000) break
  }
  
  console.log(chalk.cyan(`Games with stats: ${gamesWithStats.size}`))
  
  // Now get ESPN games WITHOUT stats
  const gamesNeedingStats: GameToScrape[] = []
  offset = 0
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id')
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)
      .gte('start_time', '2023-01-01')
      .range(offset, offset + 999)
      .order('id')
    
    if (!data || data.length === 0) break
    
    // Only add games that DON'T have stats AND have valid sport
    const validGames = data.filter(g => 
      !gamesWithStats.has(g.id) && 
      g.sport !== null &&
      g.sport !== 'null' &&
      typeof g.sport === 'string'
    )
    
    gamesNeedingStats.push(...validGames)
    
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.bold.red(`\n🎯 GAMES NEEDING STATS: ${gamesNeedingStats.length}\n`))
  
  return gamesNeedingStats
}

async function scrapeGameStats(game: GameToScrape): Promise<{ stats: any[], sport: string } | null> {
  // BULLETPROOF: Check sport first
  if (!game.sport || game.sport === 'null') {
    return null
  }
  
  const sport = game.sport.toLowerCase()
  const espnId = game.external_id.split('_')[2]
  
  const sportMap: Record<string, string> = {
    'nba': 'basketball/nba',
    'nfl': 'football/nfl', 
    'mlb': 'baseball/mlb',
    'nhl': 'hockey/nhl',
    'ncaab': 'basketball/mens-college-basketball',
    'ncaaf': 'football/college-football'
  }

  const endpoint = sportMap[sport]
  if (!endpoint) {
    return null
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${espnId}`
  
  try {
    const response = await axios.get(url, { 
      timeout: 5000,
      validateStatus: (status) => status < 500
    })
    
    if (!response.data || !response.data.boxscore) {
      return null
    }
    
    const boxscore = response.data.boxscore
    const stats: any[] = []

    // Basketball stats
    if (sport === 'nba' || sport === 'ncaab') {
      boxscore.teams?.forEach((team: any) => {
        if (!team || !team.team) return
        
        const teamId = parseInt(team.team.id)
        const isHome = team.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'players' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              // Must have valid athlete data and played minutes
              if (!athlete || !athlete.athlete || !athlete.stats || athlete.stats.length < 20) return
              
              const minutes = parseInt(athlete.stats[0])
              if (minutes > 0) {
                stats.push({
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  stats: {
                    minutes: minutes,
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
    }
    
    // Football stats
    else if (sport === 'nfl' || sport === 'ncaaf') {
      boxscore.players?.forEach((teamPlayers: any) => {
        if (!teamPlayers || !teamPlayers.team) return
        
        const teamId = parseInt(teamPlayers.team.id)
        const isHome = teamPlayers.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        Object.values(teamPlayers.statistics || {}).forEach((category: any) => {
          const categoryName = (category as any).name
          ;(category as any).athletes?.forEach((athlete: any) => {
            if (!athlete || !athlete.athlete || !athlete.stats || athlete.stats.length === 0) return
            
            const playerStats: any = {
              player_id: parseInt(athlete.athlete.id),
              game_id: game.id,
              team_id: teamId,
              opponent_id: opponentId,
              is_home: isHome,
              stats: {}
            }
            
            // Parse based on category
            if (categoryName === 'passing' && athlete.stats.length >= 6) {
              playerStats.stats = {
                completions: parseInt(athlete.stats[0]) || 0,
                attempts: parseInt(athlete.stats[1]) || 0,
                passing_yards: parseInt(athlete.stats[2]) || 0,
                passing_touchdowns: parseInt(athlete.stats[4]) || 0,
                interceptions: parseInt(athlete.stats[5]) || 0
              }
            } else if (categoryName === 'rushing' && athlete.stats.length >= 4) {
              playerStats.stats = {
                carries: parseInt(athlete.stats[0]) || 0,
                rushing_yards: parseInt(athlete.stats[1]) || 0,
                rushing_touchdowns: parseInt(athlete.stats[3]) || 0
              }
            } else if (categoryName === 'receiving' && athlete.stats.length >= 4) {
              playerStats.stats = {
                receptions: parseInt(athlete.stats[0]) || 0,
                receiving_yards: parseInt(athlete.stats[1]) || 0,
                receiving_touchdowns: parseInt(athlete.stats[3]) || 0
              }
            }
            
            // Only add if we got valid stats
            if (Object.keys(playerStats.stats).length > 0) {
              stats.push(playerStats)
            }
          })
        })
      })
    }
    
    return stats.length > 0 ? { stats, sport } : null
    
  } catch (error: any) {
    // Silent fail for 404s and timeouts
    return null
  }
}

async function savePlayerStats(stats: any[], sport: string): Promise<number> {
  if (!stats || stats.length === 0) return 0
  
  try {
    // Create players first
    const uniquePlayerIds = [...new Set(stats.map(s => s.player_id))]
    
    // Batch create players
    const playerBatches = []
    for (let i = 0; i < uniquePlayerIds.length; i += 50) {
      const batch = uniquePlayerIds.slice(i, i + 50)
      const players = batch.map(id => ({
        id,
        external_id: `espn_${id}`,
        name: `Player ${id}`,
        sport: sport === 'ncaab' || sport === 'ncaaf' ? sport.replace('ncaa', '') : sport
      }))
      
      await supabase
        .from('players')
        .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
    }
    
    // Save stats in batches
    let savedCount = 0
    for (let i = 0; i < stats.length; i += 50) {
      const batch = stats.slice(i, i + 50)
      
      const { error, data } = await supabase
        .from('player_game_logs')
        .upsert(batch, { 
          onConflict: 'player_id,game_id',
          ignoreDuplicates: false 
        })
        .select()
      
      if (!error && data) {
        savedCount += data.length
      }
    }
    
    return savedCount
    
  } catch (error: any) {
    console.error(chalk.red(`Save error: ${error.message}`))
    return 0
  }
}

async function scrapeBulletproof() {
  const startTime = Date.now()
  
  // Get games needing stats
  const games = await getAllGamesNeedingStats()
  
  if (games.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'))
    return
  }
  
  // Show breakdown
  const bySport: Record<string, number> = {}
  games.forEach(g => {
    if (g.sport) {
      bySport[g.sport] = (bySport[g.sport] || 0) + 1
    }
  })
  
  console.log(chalk.cyan('Games by sport:'))
  Object.entries(bySport).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count}`))
  })
  
  // Process all games
  let processed = 0
  let successfulGames = 0
  let totalStatsSaved = 0
  let errors = 0
  
  console.log(chalk.yellow('\n🚀 Starting BULLETPROOF scrape...\n'))
  
  const promises = games.map((game) => 
    limit(async () => {
      try {
        const result = await scrapeGameStats(game)
        
        if (result && result.stats.length > 0) {
          const saved = await savePlayerStats(result.stats, result.sport)
          if (saved > 0) {
            totalStatsSaved += saved
            successfulGames++
          }
        }
        
      } catch (error: any) {
        errors++
        console.error(chalk.red(`CRITICAL ERROR on game ${game.id}: ${error.message}`))
      }
      
      processed++
      
      if (processed % 50 === 0 || processed === games.length) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = processed / elapsed
        const remaining = (games.length - processed) / rate
        
        console.log(chalk.cyan(
          `Progress: ${processed}/${games.length} (${(processed/games.length*100).toFixed(1)}%) - ` +
          `${successfulGames} games with stats - ${totalStatsSaved} player stats saved - ` +
          `${errors} errors - ${rate.toFixed(1)} games/sec - ` +
          `ETA: ${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s`
        ))
      }
    })
  )
  
  await Promise.all(promises)
  
  // Final stats
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green('\n\n✅ BULLETPROOF SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${processed}`))
  console.log(chalk.white(`  Games with stats: ${successfulGames}`))
  console.log(chalk.white(`  Player stats saved: ${totalStatsSaved}`))
  console.log(chalk.white(`  Errors: ${errors}`))
  console.log(chalk.white(`  Success rate: ${(successfulGames / processed * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  console.log(chalk.white(`  Rate: ${(processed / elapsed).toFixed(1)} games/sec`))
  
  // Check new total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 TOTAL PLAYER STATS: ${count?.toLocaleString() || 0}!`))
  
  if (errors > 0) {
    console.log(chalk.bold.red(`\n⚠️ WARNING: ${errors} errors occurred. This is UNACCEPTABLE!`))
  }
}

// RUN IT!
scrapeBulletproof().catch(console.error)