#!/usr/bin/env tsx
/**
 * SCRAPE ONLY MISSING STATS - NO DUPLICATES!
 */

import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import { enhancedDb } from '../lib/services/enhanced-database-service'
import * as os from 'os'

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 3) // 3x CPU cores for I/O

console.log(chalk.bold.red(`🔥 SCRAPING MISSING STATS ONLY - ${cpuCount * 3} CONCURRENT!`))

interface GameToProcess {
  id: number
  external_id: string
  sport: string
  home_team_id: number
  away_team_id: number
}

async function scrapeMissingStats() {
  // First, get games that ALREADY have stats
  console.log(chalk.yellow('Finding games that already have stats...'))
  
  const gamesWithStats = await enhancedDb.batchQuery<{ game_id: number }>(
    'player_game_logs',
    'DISTINCT game_id'
  )
  
  const hasStatsSet = new Set(gamesWithStats.map(g => g.game_id))
  console.log(chalk.green(`✅ Found ${hasStatsSet.size} games with existing stats`))

  // Get ALL ESPN games
  const allEspnGames = await enhancedDb.batchQuery<GameToProcess>(
    'games',
    'id, external_id, sport, home_team_id, away_team_id',
    {
      filter: (query) => query
        .like('external_id', 'espn_%')
        .not('home_score', 'is', null)
        .gte('start_time', '2023-01-01')
    }
  )

  // Filter to ONLY games without stats
  const gamesToProcess = allEspnGames.filter(g => !hasStatsSet.has(g.id))
  
  console.log(chalk.bold.red(`\n🎯 GAMES TO SCRAPE: ${gamesToProcess.length}`))
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'))
    return
  }

  // Process by sport
  const bySport: Record<string, GameToProcess[]> = {}
  gamesToProcess.forEach(g => {
    bySport[g.sport] = bySport[g.sport] || []
    bySport[g.sport].push(g)
  })

  console.log(chalk.cyan('\nBreakdown by sport:'))
  Object.entries(bySport).forEach(([sport, games]) => {
    console.log(chalk.white(`  ${sport}: ${games.length} games`))
  })

  // Start scraping!
  let totalProcessed = 0
  let totalStats = 0
  const startTime = Date.now()

  for (const [sport, games] of Object.entries(bySport)) {
    console.log(chalk.yellow(`\n🏃 Scraping ${sport} games...`))
    
    const promises = games.map((game, idx) => 
      limit(async () => {
        try {
          const stats = await scrapeGameStats(game)
          if (stats && stats.length > 0) {
            await saveStats(stats)
            totalStats += stats.length
          }
          totalProcessed++
          
          if (totalProcessed % 100 === 0) {
            const elapsed = (Date.now() - startTime) / 1000
            const rate = totalProcessed / elapsed
            console.log(chalk.cyan(`Progress: ${totalProcessed}/${gamesToProcess.length} games (${rate.toFixed(1)} games/sec)`))
          }
        } catch (error: any) {
          console.error(chalk.red(`Error scraping ${game.external_id}: ${error.message}`))
        }
      })
    )

    await Promise.all(promises)
  }

  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  console.log(chalk.bold.green(`\n✅ SCRAPING COMPLETE!`))
  console.log(chalk.white(`  Games processed: ${totalProcessed}`))
  console.log(chalk.white(`  Player stats added: ${totalStats}`))
  console.log(chalk.white(`  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`))
  console.log(chalk.white(`  Rate: ${(totalProcessed / elapsed).toFixed(1)} games/sec`))
}

async function scrapeGameStats(game: GameToProcess): Promise<any[] | null> {
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
  if (!endpoint) return null

  const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${espnId}`
  
  try {
    const response = await axios.get(url, { timeout: 5000 })
    const boxscore = response.data.boxscore
    
    if (!boxscore) return null

    const stats: any[] = []

    // Extract based on sport
    if (sport === 'nba' || sport === 'ncaab') {
      boxscore.teams?.forEach((team: any) => {
        const teamId = parseInt(team.team.id)
        const isHome = team.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'players' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length > 0) {
                stats.push({
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  stats: parseBasketballStats(athlete)
                })
              }
            })
          }
        })
      })
    } else if (sport === 'nfl' || sport === 'ncaaf') {
      boxscore.players?.forEach((teamPlayers: any) => {
        const teamId = parseInt(teamPlayers.team.id)
        const isHome = teamPlayers.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        Object.values(teamPlayers.statistics || {}).forEach((category: any) => {
          (category as any).athletes?.forEach((athlete: any) => {
            if (athlete.stats && athlete.stats.length > 0) {
              stats.push({
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: parseFootballStats(athlete, (category as any).name)
              })
            }
          })
        })
      })
    }

    return stats
  } catch (error) {
    return null
  }
}

function parseBasketballStats(athlete: any): any {
  const stats = athlete.stats
  return {
    minutes: parseInt(stats[0]) || 0,
    field_goals_made: parseInt(stats[1]) || 0,
    field_goals_attempted: parseInt(stats[2]) || 0,
    three_pointers_made: parseInt(stats[4]) || 0,
    three_pointers_attempted: parseInt(stats[5]) || 0,
    free_throws_made: parseInt(stats[7]) || 0,
    free_throws_attempted: parseInt(stats[8]) || 0,
    offensive_rebounds: parseInt(stats[10]) || 0,
    defensive_rebounds: parseInt(stats[11]) || 0,
    rebounds: parseInt(stats[12]) || 0,
    assists: parseInt(stats[13]) || 0,
    steals: parseInt(stats[14]) || 0,
    blocks: parseInt(stats[15]) || 0,
    turnovers: parseInt(stats[16]) || 0,
    personal_fouls: parseInt(stats[17]) || 0,
    points: parseInt(stats[19]) || 0
  }
}

function parseFootballStats(athlete: any, category: string): any {
  const stats: any = {}
  
  if (category === 'passing') {
    stats.completions = parseInt(athlete.stats[0]) || 0
    stats.attempts = parseInt(athlete.stats[1]) || 0
    stats.passing_yards = parseInt(athlete.stats[2]) || 0
    stats.passing_touchdowns = parseInt(athlete.stats[4]) || 0
    stats.interceptions = parseInt(athlete.stats[5]) || 0
  } else if (category === 'rushing') {
    stats.carries = parseInt(athlete.stats[0]) || 0
    stats.rushing_yards = parseInt(athlete.stats[1]) || 0
    stats.rushing_touchdowns = parseInt(athlete.stats[3]) || 0
  } else if (category === 'receiving') {
    stats.receptions = parseInt(athlete.stats[0]) || 0
    stats.receiving_yards = parseInt(athlete.stats[1]) || 0
    stats.receiving_touchdowns = parseInt(athlete.stats[3]) || 0
  }
  
  return stats
}

async function saveStats(stats: any[]) {
  // Create players if needed
  const uniquePlayerIds = Array.from(new Set(stats.map(s => s.player_id)))
  
  for (const playerId of uniquePlayerIds) {
    await enhancedDb.getClient()
      .from('players')
      .upsert({
        id: playerId,
        external_id: `espn_${playerId}`,
        name: `Player ${playerId}`,
        sport: 'unknown'
      }, { onConflict: 'id', ignoreDuplicates: true })
  }

  // Insert stats
  const { error } = await enhancedDb.getClient()
    .from('player_game_logs')
    .upsert(stats, { 
      onConflict: 'player_id,game_id',
      ignoreDuplicates: false 
    })

  if (error) {
    console.error(chalk.red('Database error:'), error.message)
  }
}

// RUN IT!
scrapeMissingStats().catch(console.error)