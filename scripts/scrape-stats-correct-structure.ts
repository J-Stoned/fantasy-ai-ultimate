#!/usr/bin/env tsx
/**
 * SCRAPE STATS WITH CORRECT ESPN STRUCTURE
 * Uses boxscore.players instead of boxscore.teams.statistics
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

console.log(chalk.bold.red(`🔥 SCRAPING STATS WITH CORRECT STRUCTURE!`))
console.log(chalk.yellow(`Using ${cpuCount * 4} concurrent connections\n`))

async function scrapeWithCorrectStructure() {
  // Get recent games to test
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
    .like('external_id', 'espn_%')
    .gte('start_time', '2024-01-01')
    .lte('start_time', '2024-12-31')
    .not('home_score', 'is', null)
    .limit(100)
    .order('start_time', { ascending: false })
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No games found!'))
    return
  }
  
  console.log(chalk.cyan(`Found ${games.length} completed games\n`))
  
  // Filter by sport
  const sportGroups: Record<string, typeof games> = {}
  games.forEach(game => {
    const sport = game.sport?.toLowerCase() || 'unknown'
    if (!sportGroups[sport]) sportGroups[sport] = []
    sportGroups[sport].push(game)
  })
  
  console.log(chalk.cyan('Games by sport:'))
  Object.entries(sportGroups).forEach(([sport, games]) => {
    console.log(`  ${sport}: ${games.length}`)
  })
  
  // Process NBA games first
  const nbaGames = sportGroups['nba'] || []
  if (nbaGames.length === 0) {
    console.log(chalk.red('\nNo NBA games found!'))
    return
  }
  
  console.log(chalk.yellow(`\n🏀 Processing ${nbaGames.length} NBA games...\n`))
  
  let processed = 0
  let successful = 0
  let totalStats = 0
  const startTime = Date.now()
  
  // Process games one by one for debugging
  for (const game of nbaGames.slice(0, 10)) { // Test with first 10
    try {
      processed++
      const espnId = game.external_id.split('_')[2]
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
      
      console.log(chalk.gray(`[${processed}/${nbaGames.length}] Fetching ${game.external_id}...`))
      
      const response = await axios.get(url, { timeout: 10000 })
      
      if (response.data.boxscore?.players) {
        const stats = extractStatsFromPlayers(response.data.boxscore.players, game)
        
        if (stats.length > 0) {
          await saveStats(stats)
          successful++
          totalStats += stats.length
          console.log(chalk.green(`  ✅ Saved ${stats.length} player stats`))
        } else {
          console.log(chalk.yellow(`  ⚠️ No stats extracted`))
        }
      } else {
        console.log(chalk.yellow(`  ⚠️ No boxscore.players found`))
      }
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(chalk.red(`  ❌ 404 Not Found`))
      } else {
        console.log(chalk.red(`  ❌ Error: ${error.message}`))
      }
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green('\n✅ SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${processed}`))
  console.log(chalk.white(`  Games with stats: ${successful}`))
  console.log(chalk.white(`  Player stats saved: ${totalStats}`))
  console.log(chalk.white(`  Success rate: ${(successful / processed * 100).toFixed(1)}%`))
  console.log(chalk.white(`  Time: ${elapsed.toFixed(1)}s`))
  
  // Check total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 TOTAL PLAYER STATS: ${count?.toLocaleString() || 0}!`))
}

function extractStatsFromPlayers(players: any[], game: any): any[] {
  const stats: any[] = []
  
  try {
    // Players array has one entry per team
    players.forEach((teamData: any) => {
      const teamId = parseInt(teamData.team.id)
      const isHome = teamData.order === 0 // First team is usually away
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      // Statistics is an object with keys like "0", "1", etc.
      Object.values(teamData.statistics || {}).forEach((statGroup: any) => {
        if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
          statGroup.athletes.forEach((athlete: any) => {
            if (!athlete.stats || athlete.stats.length < 14) {
              return
            }
            
            // NBA stats array (based on the debug output):
            // [minutes, FGM-FGA, 3PM-3PA, FTM-FTA, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS]
            const statLine = athlete.stats
            
            // Parse minutes (can be "36" or "DNP")
            const minutesStr = statLine[0]
            if (typeof minutesStr !== 'string' || minutesStr === 'DNP' || !minutesStr.match(/\d+/)) {
              return
            }
            
            const minutes = parseInt(minutesStr)
            if (minutes === 0) return
            
            // Parse shooting stats
            const fgParts = statLine[1].split('-').map((s: string) => parseInt(s) || 0)
            const threeParts = statLine[2].split('-').map((s: string) => parseInt(s) || 0)
            const ftParts = statLine[3].split('-').map((s: string) => parseInt(s) || 0)
            
            const playerStat = {
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
                offensive_rebounds: parseInt(statLine[4]) || 0,
                defensive_rebounds: parseInt(statLine[5]) || 0,
                rebounds: parseInt(statLine[6]) || 0,
                assists: parseInt(statLine[7]) || 0,
                steals: parseInt(statLine[8]) || 0,
                blocks: parseInt(statLine[9]) || 0,
                turnovers: parseInt(statLine[10]) || 0,
                personal_fouls: parseInt(statLine[11]) || 0,
                plus_minus: parseInt(statLine[12].replace('+', '')) || 0,
                points: parseInt(statLine[13]) || 0
              }
            }
            
            stats.push(playerStat)
          })
        }
      })
    })
    
  } catch (error: any) {
    console.error(chalk.red(`  Error extracting stats: ${error.message}`))
  }
  
  return stats
}

async function saveStats(stats: any[]) {
  if (stats.length === 0) return
  
  // Create players
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `NBA Player ${id}`,
    sport: 'NBA'
  }))
  
  await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  
  // Save stats
  const { error } = await supabase
    .from('player_game_logs')
    .upsert(stats, { onConflict: 'player_id,game_id' })
    
  if (error) {
    console.error(chalk.red(`  Error saving stats: ${error.message}`))
  }
}

// RUN IT!
scrapeWithCorrectStructure().catch(console.error)