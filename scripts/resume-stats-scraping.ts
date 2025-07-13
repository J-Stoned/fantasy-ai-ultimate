#!/usr/bin/env tsx
/**
 * RESUME STATS SCRAPING - Continue from where we left off
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

console.log(chalk.bold.red(`🔥 RESUMING STATS SCRAPING!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

async function resumeStatsScraping() {
  // Check current stats count
  const { count: initialCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`Starting with ${initialCount?.toLocaleString() || 0} player stats\n`))
  
  // Use ACTUAL cutoff date
  const cutoffDate = new Date('2024-12-31T23:59:59.999Z')
  const startDate = new Date('2023-01-01T00:00:00.000Z')
  
  // Get games with existing stats
  const gamesWithStats = new Set<number>()
  let offset = 0
  
  console.log(chalk.yellow('Loading games with existing stats...'))
  
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
  
  console.log(chalk.cyan(`Games with stats: ${gamesWithStats.size.toLocaleString()}\n`))
  
  // Get remaining games
  const gamesToProcess = []
  offset = 0
  
  console.log(chalk.yellow('Finding games that need stats...'))
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
      .like('external_id', 'espn_%')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', cutoffDate.toISOString())
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .not('sport', 'is', null)
      .range(offset, offset + 999)
      .order('id', { ascending: true }) // Process in order
    
    if (!data || data.length === 0) break
    
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
  
  console.log(chalk.bold.red(`\n🎯 GAMES REMAINING: ${gamesToProcess.length.toLocaleString()}\n`))
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('✅ All games have stats!'))
    return
  }
  
  // Process in batches
  const batchSize = 5000
  let totalProcessed = 0
  let totalSuccessful = 0
  let totalStats = 0
  const overallStartTime = Date.now()
  
  for (let batchStart = 0; batchStart < gamesToProcess.length; batchStart += batchSize) {
    const batch = gamesToProcess.slice(batchStart, Math.min(batchStart + batchSize, gamesToProcess.length))
    console.log(chalk.yellow(`\n📦 Processing batch ${Math.floor(batchStart / batchSize) + 1} (${batch.length} games)...\n`))
    
    let processed = 0
    let successful = 0
    let statsInBatch = 0
    const batchStartTime = Date.now()
    
    const promises = batch.map(game => 
      limit(async () => {
        try {
          const parts = game.external_id.split('_')
          if (parts.length !== 3 || parts[0] !== 'espn') {
            processed++
            totalProcessed++
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
            totalProcessed++
            return
          }
          
          const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${espnId}`
          
          const response = await axios.get(url, { 
            timeout: 5000,
            validateStatus: (status) => status < 500
          })
          
          if (response.status === 200 && response.data.boxscore) {
            const stats = extractStats(response.data.boxscore, game, sport)
            
            if (stats.length > 0) {
              await saveStats(stats, sport)
              successful++
              totalSuccessful++
              statsInBatch += stats.length
              totalStats += stats.length
              
              if (totalSuccessful % 100 === 0) {
                console.log(chalk.green(`✅ ${totalSuccessful} total games with stats, ${totalStats.toLocaleString()} player stats`))
              }
            }
          }
        } catch (error) {
          // Silent fail
        }
        
        processed++
        totalProcessed++
        
        if (processed % 100 === 0) {
          const elapsed = (Date.now() - batchStartTime) / 1000
          const rate = processed / elapsed
          console.log(chalk.cyan(
            `Batch progress: ${processed}/${batch.length} - ` +
            `${successful} with stats - ${rate.toFixed(1)} games/sec`
          ))
        }
      })
    )
    
    await Promise.all(promises)
    
    const batchElapsed = (Date.now() - batchStartTime) / 1000
    console.log(chalk.green(
      `\n✅ Batch complete: ${successful} games with stats, ` +
      `${statsInBatch.toLocaleString()} player stats in ${batchElapsed.toFixed(1)}s`
    ))
    
    // Check if we should continue
    if (totalProcessed >= gamesToProcess.length) break
  }
  
  // Final report
  const overallElapsed = (Date.now() - overallStartTime) / 1000
  console.log(chalk.bold.green('\n✅ SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${totalProcessed.toLocaleString()}`))
  console.log(chalk.white(`  Games with stats: ${totalSuccessful.toLocaleString()}`))
  console.log(chalk.white(`  Player stats saved: ${totalStats.toLocaleString()}`))
  console.log(chalk.white(`  Success rate: ${(totalSuccessful / totalProcessed * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Time: ${Math.floor(overallElapsed / 60)}m ${Math.floor(overallElapsed % 60)}s`))
  
  // Check final count
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 FINAL STATS COUNT: ${finalCount?.toLocaleString() || 0}`))
  console.log(chalk.bold.green(`📈 Added ${((finalCount || 0) - (initialCount || 0)).toLocaleString()} new player stats!`))
}

function extractStats(boxscore: any, game: any, sport: string): any[] {
  const stats: any[] = []
  
  try {
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
    // Add other sports as needed
  } catch (error) {
    // Silent fail
  }
  
  return stats
}

async function saveStats(stats: any[], sport: string) {
  if (stats.length === 0) return
  
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
  
  for (let i = 0; i < stats.length; i += 100) {
    const batch = stats.slice(i, i + 100)
    await supabase
      .from('player_game_logs')
      .upsert(batch, { onConflict: 'player_id,game_id' })
  }
}

// RUN IT!
resumeStatsScraping().catch(console.error)