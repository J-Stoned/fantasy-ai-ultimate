#!/usr/bin/env tsx
/**
 * SCRAPE DECEMBER 2024 NBA STATS
 * Target recent games we know exist
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
const limit = pLimit(cpuCount * 2)

console.log(chalk.bold.red(`🏀 SCRAPING DECEMBER 2024 NBA STATS!`))

async function scrapeDecember2024() {
  // Get December 2024 NBA games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, sport, home_team_id, away_team_id, start_time, home_score, away_score')
    .like('external_id', 'espn_nba_%')
    .gte('start_time', '2024-12-01')
    .lte('start_time', '2024-12-31')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(50)
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No December 2024 NBA games found!'))
    return
  }
  
  console.log(chalk.cyan(`Found ${games.length} December 2024 NBA games\n`))
  
  // Show sample
  console.log(chalk.yellow('Sample games:'))
  games.slice(0, 5).forEach(g => {
    console.log(`  ${g.external_id} - ${new Date(g.start_time).toLocaleDateString()} - Score: ${g.home_score}-${g.away_score}`)
  })
  
  // Check which have stats already
  const gameIds = games.map(g => g.id)
  const { data: existingStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', gameIds)
    
  const gamesWithStats = new Set(existingStats?.map(s => s.game_id) || [])
  const gamesToProcess = games.filter(g => !gamesWithStats.has(g.id))
  
  console.log(chalk.cyan(`\n${gamesToProcess.length} games need stats\n`))
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('All games have stats!'))
    return
  }
  
  // Process games
  let successCount = 0
  let totalStats = 0
  const startTime = Date.now()
  
  for (const game of gamesToProcess) {
    try {
      const espnId = game.external_id.split('_')[2]
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
      
      console.log(chalk.gray(`Fetching ${game.external_id}...`))
      
      const response = await axios.get(url, { timeout: 10000 })
      
      if (response.data.boxscore) {
        const stats = extractDetailedNbaStats(response.data.boxscore, game)
        
        if (stats.length > 0) {
          console.log(chalk.green(`  ✅ Found ${stats.length} player stats`))
          
          // Save stats
          await saveDetailedStats(stats)
          successCount++
          totalStats += stats.length
        } else {
          console.log(chalk.yellow(`  ⚠️ No stats found`))
        }
      } else {
        console.log(chalk.yellow(`  ⚠️ No boxscore`))
      }
      
    } catch (error: any) {
      console.log(chalk.red(`  ❌ Error: ${error.message}`))
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green(`\n✅ COMPLETE!`))
  console.log(chalk.white(`  Games processed: ${gamesToProcess.length}`))
  console.log(chalk.white(`  Games with stats: ${successCount}`))
  console.log(chalk.white(`  Player stats saved: ${totalStats}`))
  console.log(chalk.white(`  Time: ${elapsed.toFixed(1)}s`))
  
  // Check total
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.bold.yellow(`\n📊 TOTAL PLAYER STATS: ${count?.toLocaleString() || 0}!`))
}

function extractDetailedNbaStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  console.log(chalk.gray(`  Extracting stats from boxscore...`))
  
  try {
    // Check structure
    if (!boxscore.teams || boxscore.teams.length === 0) {
      console.log(chalk.yellow(`  No teams in boxscore`))
      return stats
    }
    
    boxscore.teams.forEach((team: any, teamIndex: number) => {
      console.log(chalk.gray(`  Processing team ${teamIndex + 1}: ${team.team?.displayName || 'Unknown'}`))
      
      const teamId = parseInt(team.team.id)
      const isHome = team.homeAway === 'home'
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      if (!team.statistics) {
        console.log(chalk.yellow(`    No statistics for team`))
        return
      }
      
      team.statistics.forEach((statGroup: any) => {
        if (statGroup.type === 'players' && statGroup.athletes) {
          console.log(chalk.gray(`    Found ${statGroup.athletes.length} players`))
          
          statGroup.athletes.forEach((athlete: any) => {
            if (!athlete.stats || athlete.stats.length < 20) {
              return
            }
            
            // Check if player actually played
            const minutes = parseInt(athlete.stats[0]) || 0
            if (minutes === 0) {
              return
            }
            
            const playerStat = {
              player_id: parseInt(athlete.athlete.id),
              game_id: game.id,
              team_id: isHome ? game.home_team_id : game.away_team_id,
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
            }
            
            stats.push(playerStat)
          })
        }
      })
    })
    
    console.log(chalk.gray(`  Total stats extracted: ${stats.length}`))
    
  } catch (error: any) {
    console.error(chalk.red(`  Error extracting stats: ${error.message}`))
  }
  
  return stats
}

async function saveDetailedStats(stats: any[]) {
  if (stats.length === 0) return
  
  // Create players
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `NBA Player ${id}`,
    sport: 'NBA'
  }))
  
  const { error: playerError } = await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
    
  if (playerError) {
    console.error(chalk.red(`  Error creating players: ${playerError.message}`))
  }
  
  // Save stats
  const { error: statsError } = await supabase
    .from('player_game_logs')
    .upsert(stats, { onConflict: 'player_id,game_id' })
    
  if (statsError) {
    console.error(chalk.red(`  Error saving stats: ${statsError.message}`))
  }
}

// RUN IT!
scrapeDecember2024().catch(console.error)