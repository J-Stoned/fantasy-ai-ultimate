#!/usr/bin/env tsx
/**
 * REAL STATS SCRAPER - Using our PROVEN unlimited query methods!
 */

import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import { enhancedDb } from '../lib/services/enhanced-database-service'
import * as os from 'os'

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 4) // 4x oversubscription

console.log(chalk.bold.red(`🔥 REAL STATS SCRAPER - ${cpuCount * 4} CONCURRENT REQUESTS!`))

interface GameToProcess {
  id: number
  external_id: string
  sport: string
  home_team_id: number
  away_team_id: number
}

async function findGamesWithoutStats() {
  console.log(chalk.yellow('Finding games without stats using UNLIMITED queries...\n'))
  
  // Get ALL ESPN games using our unlimited method
  const allEspnGames = await enhancedDb.unlimitedQuery<GameToProcess>(
    'games',
    'id, external_id, sport, home_team_id, away_team_id',
    (query) => query
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)
      .gte('start_time', '2023-01-01')
  )
  
  console.log(chalk.cyan(`Total ESPN games: ${allEspnGames.length}`))
  
  // Get ALL game IDs that have stats
  const gamesWithStatsData = await enhancedDb.unlimitedQuery<{ game_id: number }>(
    'player_game_logs',
    'game_id'
  )
  
  // Create a Set for fast lookup
  const gamesWithStats = new Set(gamesWithStatsData.map(g => g.game_id))
  
  console.log(chalk.cyan(`Games with stats: ${gamesWithStats.size}`))
  
  // Filter to games without stats
  const gamesWithoutStats = allEspnGames.filter(g => !gamesWithStats.has(g.id))
  
  console.log(chalk.bold.red(`\n🎯 GAMES NEEDING STATS: ${gamesWithoutStats.length}\n`))
  
  // Show breakdown by sport
  const bySport: Record<string, number> = {}
  gamesWithoutStats.forEach(g => {
    bySport[g.sport] = (bySport[g.sport] || 0) + 1
  })
  
  console.log(chalk.cyan('Games needing stats by sport:'))
  Object.entries(bySport).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport}: ${count} games`))
  })
  
  return gamesWithoutStats
}

async function scrapeGameStats(game: GameToProcess): Promise<any[]> {
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

    // Basketball stats extraction
    if (sport === 'nba' || sport === 'ncaab') {
      boxscore.teams?.forEach((team: any) => {
        const teamId = parseInt(team.team.id)
        const isHome = team.homeAway === 'home'
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'players' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length > 0 && parseInt(athlete.stats[0]) > 0) { // Has minutes
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
  } catch (error) {
    return []
  }
}

async function saveStatsUnlimited(allStats: any[]) {
  if (allStats.length === 0) return
  
  console.log(chalk.yellow(`\n💾 Saving ${allStats.length} player stats...`))
  
  // First, ensure all players exist
  const uniquePlayerIds = Array.from(new Set(allStats.map(s => s.player_id)))
  console.log(chalk.cyan(`Creating ${uniquePlayerIds.length} players if needed...`))
  
  // Use our enhanced upsert for players
  const players = uniquePlayerIds.map(id => ({
    id,
    external_id: `espn_${id}`,
    name: `Player ${id}`,
    sport: 'basketball'
  }))
  
  await enhancedDb.unlimitedUpsert('players', players, {
    onConflict: 'id',
    batchSize: 500
  })
  
  // Now save all stats using our enhanced upsert
  console.log(chalk.cyan(`Saving player game logs...`))
  
  const result = await enhancedDb.enhancedPlayerStatsUpsert(allStats, {
    batchSize: 500
  })
  
  console.log(chalk.green(`✅ Saved ${result.successful} player stats!`))
  if (result.failed > 0) {
    console.log(chalk.red(`❌ Failed: ${result.failed}`))
  }
  
  return result
}

async function scrapeAllMissingStats() {
  const startTime = Date.now()
  
  // Find games without stats
  const gamesWithoutStats = await findGamesWithoutStats()
  
  if (gamesWithoutStats.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'))
    return
  }
  
  // Process in batches for progress tracking
  const BATCH_SIZE = 500
  let totalProcessed = 0
  let totalStats = 0
  let allStats: any[] = []
  
  for (let i = 0; i < gamesWithoutStats.length; i += BATCH_SIZE) {
    const batch = gamesWithoutStats.slice(i, i + BATCH_SIZE)
    console.log(chalk.yellow(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(gamesWithoutStats.length / BATCH_SIZE)}...`))
    
    const promises = batch.map(game => 
      limit(async () => {
        const stats = await scrapeGameStats(game)
        if (stats.length > 0) {
          allStats.push(...stats)
          totalStats += stats.length
        }
        totalProcessed++
        
        if (totalProcessed % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = totalProcessed / elapsed
          process.stdout.write(`\r  Progress: ${totalProcessed}/${gamesWithoutStats.length} games (${rate.toFixed(1)} games/sec) - ${totalStats} stats found`)
        }
      })
    )
    
    await Promise.all(promises)
    
    // Save stats every batch
    if (allStats.length > 0) {
      await saveStatsUnlimited(allStats)
      allStats = []
    }
  }
  
  // Final save if any remaining
  if (allStats.length > 0) {
    await saveStatsUnlimited(allStats)
  }
  
  // Final report
  const elapsed = (Date.now() - startTime) / 1000
  const minutes = Math.floor(elapsed / 60)
  const seconds = Math.floor(elapsed % 60)
  
  console.log(chalk.bold.green('\n\n✅ SCRAPING COMPLETE!'))
  console.log(chalk.white(`  Games processed: ${totalProcessed}`))
  console.log(chalk.white(`  Player stats found: ${totalStats}`))
  console.log(chalk.white(`  Time: ${minutes}m ${seconds}s`))
  console.log(chalk.white(`  Rate: ${(totalProcessed / elapsed).toFixed(1)} games/sec`))
  
  // Check new total
  const { count } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.bold.yellow(`\n📊 NEW TOTAL: ${count?.toLocaleString() || 0} player_game_logs!`))
}

// RUN IT!
scrapeAllMissingStats().catch(console.error)