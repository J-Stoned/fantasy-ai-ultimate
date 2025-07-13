#!/usr/bin/env tsx
/**
 * SCRAPE ALL PAST STATS - ONLY GAMES THAT HAVE BEEN PLAYED!
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

console.log(chalk.bold.red(`🔥 SCRAPING PAST GAME STATS - ${cpuCount * 4} CONCURRENT!\n`))

async function scrapePastStats() {
  // Get YESTERDAY as cutoff
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(23, 59, 59, 999)
  
  console.log(chalk.yellow(`Only processing games before ${yesterday.toLocaleDateString()}`))
  
  // Get games with stats first
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
  
  console.log(chalk.cyan(`Games already with stats: ${gamesWithStats.size}`))
  
  // Get PAST games only
  const gamesToProcess = []
  offset = 0
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null) // Must have scores
      .not('away_score', 'is', null)
      .lte('start_time', yesterday.toISOString()) // ONLY PAST GAMES!
      .range(offset, offset + 999)
      .order('start_time', { ascending: false })
    
    if (!data || data.length === 0) break
    
    // Only add games without stats
    const needingStats = data.filter(g => !gamesWithStats.has(g.id))
    gamesToProcess.push(...needingStats)
    
    offset += 1000
    if (data.length < 1000) break
  }
  
  console.log(chalk.bold.red(`\n🎯 PAST GAMES NEEDING STATS: ${gamesToProcess.length}\n`))
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('✅ All past games have stats!'))
    return
  }
  
  // Show breakdown
  const sportBreakdown: Record<string, number> = {}
  gamesToProcess.forEach(g => {
    sportBreakdown[g.sport] = (sportBreakdown[g.sport] || 0) + 1
  })
  
  console.log(chalk.cyan('Games by sport:'))
  Object.entries(sportBreakdown).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count}`))
  })
  
  // Process games
  let processed = 0
  let successCount = 0
  let totalStats = 0
  const startTime = Date.now()
  
  console.log(chalk.yellow('\n🚀 Starting scrape of PAST games...\n'))
  
  const promises = gamesToProcess.map(game => 
    limit(async () => {
      try {
        const parts = game.external_id.split('_')
        if (parts.length !== 3) {
          processed++
          return
        }
        
        const sport = parts[1]
        const espnId = parts[2]
        
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
          processed++
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
            successCount++
            totalStats += stats.length
            
            if (successCount % 10 === 0) {
              console.log(chalk.green(`✅ ${successCount} games processed, ${totalStats} stats collected`))
            }
          }
        }
        
      } catch (error) {
        // Silent fail
      }
      
      processed++
      
      if (processed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = processed / elapsed
        const remaining = (gamesToProcess.length - processed) / rate
        console.log(chalk.cyan(
          `Progress: ${processed}/${gamesToProcess.length} - ` +
          `${rate.toFixed(1)} games/sec - ` +
          `ETA: ${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s`
        ))
      }
    })
  )
  
  await Promise.all(promises)
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green('\n✅ PAST GAMES SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${processed}`))
  console.log(chalk.white(`  Games with stats: ${successCount}`))
  console.log(chalk.white(`  Player stats saved: ${totalStats}`))
  console.log(chalk.white(`  Success rate: ${(successCount / processed * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  
  // Check new total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 TOTAL PLAYER STATS: ${count?.toLocaleString() || 0}!`))
}

function extractStats(boxscore: any, game: any, sport: string): any[] {
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
    sport: sport
  }))
  
  await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  
  // Save stats
  await supabase
    .from('player_game_logs')
    .upsert(stats, { onConflict: 'player_id,game_id' })
}

// RUN IT!
scrapePastStats().catch(console.error)