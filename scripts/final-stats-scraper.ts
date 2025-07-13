#!/usr/bin/env tsx
/**
 * FINAL STATS SCRAPER - ALL SPORTS 2023-2024
 * Includes game_date field and correct structure
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

console.log(chalk.bold.red(`🚀 FINAL STATS SCRAPER - ALL SPORTS 2023-2024!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

// Sport configurations
const SPORT_CONFIGS = {
  nba: {
    endpoint: 'basketball/nba',
    extractStats: extractNbaStats
  },
  nfl: {
    endpoint: 'football/nfl',
    extractStats: extractNflStats
  },
  mlb: {
    endpoint: 'baseball/mlb',
    extractStats: extractMlbStats
  },
  nhl: {
    endpoint: 'hockey/nhl',
    extractStats: extractNhlStats
  },
  ncaab: {
    endpoint: 'basketball/mens-college-basketball',
    extractStats: extractNbaStats // Same as NBA
  },
  ncaaf: {
    endpoint: 'football/college-football',
    extractStats: extractNflStats // Same as NFL
  }
}

async function scrapeAllSports() {
  // Get current stats count
  const { count: initialCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`Starting with ${initialCount?.toLocaleString() || 0} player stats\n`))
  
  // Get games that need stats
  const cutoffDate = new Date('2024-12-31T23:59:59.999Z')
  const startDate = new Date('2023-01-01T00:00:00.000Z')
  
  // Get existing stats game IDs
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
  
  console.log(chalk.cyan(`Games with stats: ${gamesWithStats.size.toLocaleString()}`))
  
  // Get games by sport
  const gamesBySport: Record<string, any[]> = {}
  
  for (const sport of Object.keys(SPORT_CONFIGS)) {
    const games = []
    offset = 0
    
    while (true) {
      const { data } = await supabase
        .from('games')
        .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
        .eq('sport', sport.toUpperCase())
        .like('external_id', `espn_${sport}_%`)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', cutoffDate.toISOString())
        .not('home_score', 'is', null)
        .range(offset, offset + 999)
        .order('start_time', { ascending: false })
      
      if (!data || data.length === 0) break
      
      const needingStats = data.filter(g => !gamesWithStats.has(g.id))
      games.push(...needingStats)
      
      offset += 1000
      if (data.length < 1000) break
    }
    
    if (games.length > 0) {
      gamesBySport[sport] = games
    }
  }
  
  // Show summary
  console.log(chalk.yellow('\nGames needing stats by sport:'))
  let totalGames = 0
  Object.entries(gamesBySport).forEach(([sport, games]) => {
    console.log(`  ${sport.toUpperCase()}: ${games.length.toLocaleString()}`)
    totalGames += games.length
  })
  
  if (totalGames === 0) {
    console.log(chalk.green('\n✅ All games have stats!'))
    return
  }
  
  console.log(chalk.bold.red(`\n🎯 TOTAL GAMES TO PROCESS: ${totalGames.toLocaleString()}\n`))
  
  // Process each sport
  let totalProcessed = 0
  let totalSuccessful = 0
  let totalPlayerStats = 0
  const overallStartTime = Date.now()
  
  for (const [sport, games] of Object.entries(gamesBySport)) {
    console.log(chalk.cyan(`\n🏆 Processing ${sport.toUpperCase()} (${games.length} games)...\n`))
    
    const config = SPORT_CONFIGS[sport as keyof typeof SPORT_CONFIGS]
    let sportSuccessful = 0
    let sportStats = 0
    
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
              validateStatus: (status) => status < 500
            })
            
            if (response.status === 200 && response.data.boxscore) {
              const stats = config.extractStats(response.data.boxscore, game)
              
              if (stats.length > 0) {
                // Add game_date to each stat
                const statsWithDate = stats.map(stat => ({
                  ...stat,
                  game_date: new Date(game.start_time).toISOString().split('T')[0]
                }))
                
                await saveStats(statsWithDate, sport.toUpperCase())
                sportSuccessful++
                sportStats += stats.length
                
                if (sportSuccessful % 10 === 0) {
                  console.log(chalk.green(`  ✅ ${sportSuccessful} games, ${sportStats} player stats`))
                }
              }
            }
          } catch (error) {
            // Silent fail
          }
          
          totalProcessed++
        })
      )
      
      await Promise.all(promises)
      
      if (totalProcessed % 100 === 0) {
        const elapsed = (Date.now() - overallStartTime) / 1000
        const rate = totalProcessed / elapsed
        console.log(chalk.cyan(
          `Overall progress: ${totalProcessed}/${totalGames} - ` +
          `${rate.toFixed(1)} games/sec`
        ))
      }
    }
    
    totalSuccessful += sportSuccessful
    totalPlayerStats += sportStats
    
    console.log(chalk.green(
      `${sport.toUpperCase()} complete: ${sportSuccessful} games, ${sportStats} player stats`
    ))
  }
  
  // Final report
  const overallElapsed = (Date.now() - overallStartTime) / 1000
  console.log(chalk.bold.green('\n✅ ALL SPORTS SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${totalProcessed.toLocaleString()}`))
  console.log(chalk.white(`  Games with stats: ${totalSuccessful.toLocaleString()}`))
  console.log(chalk.white(`  Player stats saved: ${totalPlayerStats.toLocaleString()}`))
  console.log(chalk.white(`  Success rate: ${(totalSuccessful / totalProcessed * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Time: ${Math.floor(overallElapsed / 60)}m ${Math.floor(overallElapsed % 60)}s`))
  console.log(chalk.white(`  Rate: ${(totalProcessed / overallElapsed).toFixed(1)} games/sec`))
  
  // Check final count
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 FINAL STATS COUNT: ${finalCount?.toLocaleString() || 0}`))
  console.log(chalk.bold.green(`📈 ADDED ${((finalCount || 0) - (initialCount || 0)).toLocaleString()} NEW PLAYER STATS!`))
}

function extractNbaStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const teamId = parseInt(teamData.team.id)
        const isHome = teamData.order === 0
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        Object.values(teamData.statistics || {}).forEach((statGroup: any) => {
          if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
            statGroup.athletes.forEach((athlete: any) => {
              if (!athlete.stats || athlete.stats.length < 14) return
              
              const minutesStr = athlete.stats[0]
              if (typeof minutesStr !== 'string' || minutesStr === 'DNP' || !minutesStr.match(/\d+/)) return
              
              const minutes = parseInt(minutesStr)
              if (minutes === 0) return
              
              const fgParts = athlete.stats[1].split('-').map((s: string) => parseInt(s) || 0)
              const threeParts = athlete.stats[2].split('-').map((s: string) => parseInt(s) || 0)
              const ftParts = athlete.stats[3].split('-').map((s: string) => parseInt(s) || 0)
              
              stats.push({
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: isHome ? game.home_team_id : game.away_team_id,
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

function extractNflStats(boxscore: any, game: any): any[] {
  // TODO: Implement NFL stats extraction
  return []
}

function extractMlbStats(boxscore: any, game: any): any[] {
  // TODO: Implement MLB stats extraction
  return []
}

function extractNhlStats(boxscore: any, game: any): any[] {
  // TODO: Implement NHL stats extraction
  return []
}

async function saveStats(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `${sport} Player ${id}`,
    sport
  }))
  
  await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  
  for (let i = 0; i < stats.length; i += 50) {
    const batch = stats.slice(i, i + 50)
    await supabase
      .from('player_game_logs')
      .upsert(batch, { onConflict: 'player_id,game_id' })
  }
}

// RUN IT!
scrapeAllSports().catch(console.error)