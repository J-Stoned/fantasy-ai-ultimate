#!/usr/bin/env tsx
/**
 * SCRAPE STATS FOR REAL - NO BS, JUST RESULTS!
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

console.log(chalk.bold.red(`🔥 SCRAPING STATS FOR REAL - ${cpuCount * 4} CONCURRENT!\n`))

async function getAllGamesNeedingStats() {
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
  const gamesNeedingStats = []
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
    
    // Only add games that DON'T have stats
    const needingStats = data.filter(g => !gamesWithStats.has(g.id))
    gamesNeedingStats.push(...needingStats)
    
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.bold.red(`\n🎯 GAMES NEEDING STATS: ${gamesNeedingStats.length}\n`))
  
  return gamesNeedingStats
}

async function scrapeAndSaveGame(game: any) {
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
  if (!endpoint) return 0

  const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${espnId}`
  
  try {
    const response = await axios.get(url, { timeout: 5000 })
    
    if (!response.data.boxscore) return 0
    
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
              if (athlete.stats && athlete.stats.length > 0 && parseInt(athlete.stats[0]) > 0) {
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
    }
    
    // Save immediately if we have stats
    if (stats.length > 0) {
      // Create players first
      const playerIds = [...new Set(stats.map(s => s.player_id))]
      for (const id of playerIds) {
        await supabase.from('players').upsert({
          id,
          external_id: `espn_${id}`,
          name: `Player ${id}`,
          sport: sport === 'ncaab' ? 'basketball' : sport
        }, { onConflict: 'id', ignoreDuplicates: true })
      }
      
      // Save stats
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(stats, { onConflict: 'player_id,game_id' })
      
      if (!error) {
        return stats.length
      }
    }
    
    return 0
  } catch (error) {
    return 0
  }
}

async function scrapeEverything() {
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
    bySport[g.sport] = (bySport[g.sport] || 0) + 1
  })
  
  console.log(chalk.cyan('Games by sport:'))
  Object.entries(bySport).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count}`))
  })
  
  // Process all games
  let processed = 0
  let totalStats = 0
  
  console.log(chalk.yellow('\n🚀 Starting scrape...\n'))
  
  const promises = games.map((game, idx) => 
    limit(async () => {
      const statsCount = await scrapeAndSaveGame(game)
      processed++
      totalStats += statsCount
      
      if (processed % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = processed / elapsed
        const remaining = (games.length - processed) / rate
        console.log(chalk.cyan(
          `Progress: ${processed}/${games.length} (${(processed/games.length*100).toFixed(1)}%) - ` +
          `${rate.toFixed(1)} games/sec - ${totalStats} stats - ` +
          `ETA: ${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s`
        ))
      }
    })
  )
  
  await Promise.all(promises)
  
  // Final stats
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green('\n\n✅ SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${processed}`))
  console.log(chalk.white(`  Stats collected: ${totalStats}`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  console.log(chalk.white(`  Rate: ${(processed / elapsed).toFixed(1)} games/sec`))
  
  // Check new total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 TOTAL PLAYER STATS: ${count?.toLocaleString() || 0}!`))
}

// DO IT!
scrapeEverything().catch(console.error)