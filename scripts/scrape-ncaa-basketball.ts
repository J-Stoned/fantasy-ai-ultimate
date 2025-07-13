#!/usr/bin/env tsx
/**
 * NCAA BASKETBALL SCRAPER - Focus on college basketball
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

console.log(chalk.bold.red(`🏀 NCAA BASKETBALL SCRAPER!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

async function scrapeNcaaBasketball() {
  const { count: initialCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`Starting with ${initialCount?.toLocaleString() || 0} player stats\n`))
  
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
  
  // Get NCAAB games
  const games = []
  offset = 0
  const cutoffDate = new Date('2024-12-31T23:59:59.999Z')
  const startDate = new Date('2023-01-01T00:00:00.000Z')
  
  console.log(chalk.yellow('Loading NCAAB games...'))
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
      .or('sport.eq.NCAAB,sport.eq.ncaab')
      .like('external_id', 'espn_ncaab_%')
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
  
  console.log(chalk.bold.red(`\n🎯 NCAAB GAMES NEEDING STATS: ${games.length}\n`))
  
  if (games.length === 0) {
    console.log(chalk.green('✅ All NCAAB games have stats!'))
    return
  }
  
  // Show sample games
  console.log(chalk.cyan('Sample games:'))
  games.slice(0, 5).forEach(g => {
    console.log(`  ${g.external_id} - ${new Date(g.start_time).toLocaleDateString()}`)
  })
  
  let successful = 0
  let totalStats = 0
  let errors = 0
  const startTime = Date.now()
  
  console.log(chalk.yellow('\n🚀 Starting NCAAB scrape...\n'))
  
  // Process in batches
  const batchSize = 100
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, Math.min(i + batchSize, games.length))
    
    const promises = batch.map(game => 
      limit(async () => {
        try {
          const espnId = game.external_id.split('_')[2]
          const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${espnId}`
          
          const response = await axios.get(url, { 
            timeout: 5000,
            validateStatus: (status) => status < 500,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })
          
          if (response.status === 200 && response.data.boxscore?.players) {
            const stats = extractNcaabStats(response.data.boxscore, game)
            
            if (stats.length > 0) {
              const statsWithDate = stats.map(stat => ({
                ...stat,
                game_date: new Date(game.start_time).toISOString().split('T')[0]
              }))
              
              await saveStats(statsWithDate)
              successful++
              totalStats += stats.length
              
              if (successful === 1 || successful % 50 === 0) {
                const elapsed = (Date.now() - startTime) / 1000
                const rate = successful / elapsed
                console.log(chalk.green(
                  `✅ ${successful} games, ${totalStats.toLocaleString()} stats (${rate.toFixed(1)} games/sec)`
                ))
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
    
    // Progress update
    const processed = i + batch.length
    if (processed % 200 === 0 || processed === games.length) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processed / elapsed
      const remaining = (games.length - processed) / rate
      console.log(chalk.cyan(
        `Progress: ${processed}/${games.length} - ` +
        `${successful} successful - ` +
        `ETA: ${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s`
      ))
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green('\n✅ NCAAB SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${games.length}`))
  console.log(chalk.white(`  Games with stats: ${successful}`))
  console.log(chalk.white(`  Player stats saved: ${totalStats.toLocaleString()}`))
  console.log(chalk.white(`  Success rate: ${(successful / games.length * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Errors: ${errors}`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  console.log(chalk.white(`  Rate: ${(successful / elapsed).toFixed(1)} games/sec`))
  
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 FINAL STATS COUNT: ${finalCount?.toLocaleString() || 0}`))
  console.log(chalk.bold.green(`📈 ADDED ${((finalCount || 0) - (initialCount || 0)).toLocaleString()} NEW PLAYER STATS!`))
}

function extractNcaabStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any, index: number) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        // NCAAB uses same structure as NBA
        Object.values(teamData.statistics || {}).forEach((statGroup: any) => {
          if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
            statGroup.athletes.forEach((athlete: any) => {
              if (!athlete.stats || athlete.stats.length < 14) return
              
              const minutesStr = athlete.stats[0]
              if (typeof minutesStr !== 'string' || minutesStr === 'DNP' || !minutesStr.match(/\d+/)) return
              
              const minutes = parseInt(minutesStr)
              if (minutes === 0) return
              
              // Parse shooting stats
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

async function saveStats(stats: any[]) {
  if (stats.length === 0) return
  
  // Create unique players
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `NCAAB Player ${id}`,
    sport: 'NCAAB'
  }))
  
  // Insert players
  for (let i = 0; i < players.length; i += 100) {
    const batch = players.slice(i, i + 100)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  // Remove duplicates
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

// RUN IT!
scrapeNcaaBasketball().catch(console.error)