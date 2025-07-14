#!/usr/bin/env tsx
/**
 * 🚀 DUAL-FORMAT ESPN SCRAPER
 * 
 * Maintains BOTH formats for maximum compatibility:
 * 1. player_game_logs.stats (JSON format) - for quick queries
 * 2. player_stats (normalized format) - for ML training
 * 
 * Uses standardized ESPN IDs: espn_{sport}_{numeric_id}
 */

import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import * as cheerio from 'cheerio'
import chalk from 'chalk'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ESPN game IDs to scrape
const GAME_IDS = {
  nba: [401584715, 401584716, 401584717, 401584718, 401584719, 401584720],
  nfl: [401547354, 401547355, 401547356, 401547357, 401547358, 401547359],
  mlb: [401570899, 401570900, 401570901, 401570902, 401570903, 401570904],
  nhl: [401546298, 401546299, 401546300, 401546301, 401546302, 401546303]
}

// Generate standardized ESPN ID
function generateEspnId(sport: string, numericId: number): string {
  return `espn_${sport}_${numericId}`
}

// Parse ESPN stats table
function parseStatsTable($: cheerio.CheerioAPI, tableSelector: string, sport: string) {
  const stats: any[] = []
  const $table = $(tableSelector).first()
  
  if (!$table.length) {
    console.log(chalk.yellow(`No stats table found for selector: ${tableSelector}`))
    return stats
  }
  
  // Get headers
  const headers: string[] = []
  $table.find('thead th').each((_, th) => {
    headers.push($(th).text().trim().toLowerCase())
  })
  
  // Parse rows
  $table.find('tbody tr').each((_, row) => {
    const $row = $(row)
    const playerData: any = {}
    
    $row.find('td').each((idx, td) => {
      const $td = $(td)
      const header = headers[idx]
      
      if (header === 'player' || header === 'name') {
        // Extract player ID from link
        const $link = $td.find('a')
        if ($link.length) {
          const href = $link.attr('href')
          const idMatch = href?.match(/\/id\/(\d+)\//)
          if (idMatch) {
            playerData.player_id = parseInt(idMatch[1])
            playerData.external_id = generateEspnId(sport, parseInt(idMatch[1]))
          }
          playerData.name = $link.text().trim()
        }
      } else if (header) {
        playerData[header] = $td.text().trim()
      }
    })
    
    if (playerData.player_id && Object.keys(playerData).length > 2) {
      stats.push(playerData)
    }
  })
  
  return stats
}

// Map ESPN stats to our schema - returns both JSON and normalized formats
function mapStatsToSchema(espnStats: any, gameId: number, teamId: number) {
  // JSON format for player_game_logs
  const jsonStats: any = {
    minutes: parseFloat(espnStats.min || espnStats.mins || '0') || 0,
    points: parseInt(espnStats.pts || espnStats.points || '0') || 0,
    rebounds: parseInt(espnStats.reb || espnStats.rebounds || '0') || 0,
    assists: parseInt(espnStats.ast || espnStats.assists || '0') || 0,
    steals: parseInt(espnStats.stl || espnStats.steals || '0') || 0,
    blocks: parseInt(espnStats.blk || espnStats.blocks || '0') || 0,
    turnovers: parseInt(espnStats.to || espnStats.turnovers || '0') || 0,
    fouls: parseInt(espnStats.pf || espnStats.fouls || '0') || 0
  }
  
  // Parse shooting stats
  if (espnStats['fg']) {
    const [made, attempted] = espnStats['fg'].split('-').map(Number)
    jsonStats.field_goals_made = made || 0
    jsonStats.field_goals_attempted = attempted || 0
    jsonStats.fieldGoals = espnStats['fg'] // ESPN format
  }
  
  if (espnStats['3pt']) {
    const [made, attempted] = espnStats['3pt'].split('-').map(Number)
    jsonStats.three_pointers_made = made || 0
    jsonStats.three_pointers_attempted = attempted || 0
    jsonStats.threePointers = espnStats['3pt'] // ESPN format
  }
  
  if (espnStats['ft']) {
    const [made, attempted] = espnStats['ft'].split('-').map(Number)
    jsonStats.free_throws_made = made || 0
    jsonStats.free_throws_attempted = attempted || 0
    jsonStats.freeThrows = espnStats['ft'] // ESPN format
  }
  
  // Plus/minus
  if (espnStats['+/-']) {
    jsonStats.plus_minus = parseFloat(espnStats['+/-']) || 0
    jsonStats.plusMinus = espnStats['+/-'] // ESPN format
  }
  
  // Calculate fantasy points
  jsonStats.fantasy_points = 
    jsonStats.points + 
    (jsonStats.rebounds * 1.2) + 
    (jsonStats.assists * 1.5) + 
    (jsonStats.steals * 3) + 
    (jsonStats.blocks * 3) - 
    (jsonStats.turnovers * 1)
  
  // Normalized format for player_stats table
  const normalizedStats: any[] = []
  
  // Core stats
  if (jsonStats.points > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'points',
      stat_value: jsonStats.points.toString(),
      fantasy_points: jsonStats.points
    })
  }
  
  if (jsonStats.rebounds > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'rebounds',
      stat_value: jsonStats.rebounds.toString(),
      fantasy_points: jsonStats.rebounds * 1.2
    })
  }
  
  if (jsonStats.assists > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'assists',
      stat_value: jsonStats.assists.toString(),
      fantasy_points: jsonStats.assists * 1.5
    })
  }
  
  if (jsonStats.steals > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'steals',
      stat_value: jsonStats.steals.toString(),
      fantasy_points: jsonStats.steals * 3
    })
  }
  
  if (jsonStats.blocks > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'blocks',
      stat_value: jsonStats.blocks.toString(),
      fantasy_points: jsonStats.blocks * 3
    })
  }
  
  if (jsonStats.turnovers > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'turnovers',
      stat_value: jsonStats.turnovers.toString(),
      fantasy_points: -jsonStats.turnovers
    })
  }
  
  // Shooting stats in ESPN format
  if (espnStats['fg']) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'fieldGoals',
      stat_value: espnStats['fg'],
      fantasy_points: 0
    })
  }
  
  if (espnStats['3pt']) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'threePointers',
      stat_value: espnStats['3pt'],
      fantasy_points: 0
    })
  }
  
  if (espnStats['ft']) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'freeThrows',
      stat_value: espnStats['ft'],
      fantasy_points: 0
    })
  }
  
  // Other stats
  if (jsonStats.minutes > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'minutes',
      stat_value: jsonStats.minutes.toString(),
      fantasy_points: 0
    })
  }
  
  if (jsonStats.fouls > 0) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'fouls',
      stat_value: jsonStats.fouls.toString(),
      fantasy_points: 0
    })
  }
  
  if (jsonStats.plusMinus) {
    normalizedStats.push({
      player_id: espnStats.player_id,
      game_id: gameId,
      stat_type: 'plusMinus',
      stat_value: jsonStats.plusMinus,
      fantasy_points: 0
    })
  }
  
  // Return both formats
  return {
    gameLog: {
      player_id: espnStats.player_id,
      game_id: gameId,
      team_id: teamId,
      stats: jsonStats,
      fantasy_points: jsonStats.fantasy_points,
      minutes_played: jsonStats.minutes
    },
    normalizedStats
  }
}

async function saveStatsDualFormat(stats: any[], sport: string) {
  if (stats.length === 0) return
  
  console.log(chalk.cyan(`\n💾 Saving ${stats.length} player stats in DUAL format...`))
  
  // Create players with standardized IDs
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: generateEspnId(sport.toLowerCase(), id),
    name: `${sport} Player ${id}`,
    sport
  }))
  
  await supabase
    .from('players')
    .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
  
  // Remove duplicates within batch
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat)
    }
  })
  
  // Process and save in both formats
  const gameLogs: any[] = []
  const normalizedStats: any[] = []
  let jsonCount = 0
  let normalizedCount = 0
  
  Array.from(uniqueStats.values()).forEach(stat => {
    const { gameLog, normalizedStats: normalized } = stat
    gameLogs.push(gameLog)
    normalizedStats.push(...normalized)
    jsonCount++
    normalizedCount += normalized.length
  })
  
  // Save to player_game_logs (JSON format)
  for (let i = 0; i < gameLogs.length; i += 25) {
    const batch = gameLogs.slice(i, i + 25)
    try {
      await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
    } catch (error: any) {
      if (!error.message?.includes('duplicate')) {
        console.error(chalk.red(`Game logs save error: ${error.message}`))
      }
    }
  }
  
  // Save to player_stats (normalized format)
  for (let i = 0; i < normalizedStats.length; i += 100) {
    const batch = normalizedStats.slice(i, i + 100)
    try {
      await supabase
        .from('player_stats')
        .upsert(batch, { onConflict: 'player_id,game_id,stat_type' })
    } catch (error: any) {
      if (!error.message?.includes('duplicate')) {
        console.error(chalk.red(`Player stats save error: ${error.message}`))
      }
    }
  }
  
  console.log(chalk.green(`✅ Saved ${jsonCount} game logs (JSON format)`))
  console.log(chalk.green(`✅ Saved ${normalizedCount} individual stats (normalized format)`))
}

async function scrapeGameStats(sport: string, gameId: number) {
  const url = `https://www.espn.com/${sport}/boxscore/_/gameId/${gameId}`
  console.log(chalk.cyan(`\n🏀 Scraping ${sport.toUpperCase()} game ${gameId}...`))
  
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    
    // Different selectors for different sports
    const selectors = {
      nba: '.Boxscore__Team .Table__Scroller table',
      nfl: '.Boxscore__Team .Table__Scroller table',
      mlb: '.Boxscore__Team .Table__Scroller table',
      nhl: '.Boxscore__Team .Table__Scroller table'
    }
    
    const allStats: any[] = []
    const tables = $(selectors[sport as keyof typeof selectors])
    
    tables.each((idx, table) => {
      const teamId = 100 + idx // Simple team ID assignment
      const stats = parseStatsTable($, table, sport)
      
      stats.forEach(stat => {
        const mapped = mapStatsToSchema(stat, gameId, teamId)
        allStats.push(mapped)
      })
    })
    
    console.log(chalk.green(`✅ Found ${allStats.length} player performances`))
    return allStats
    
  } catch (error) {
    console.error(chalk.red(`❌ Error scraping game ${gameId}:`), error)
    return []
  }
}

async function scrapeDualFormat() {
  console.log(chalk.bold.cyan('\n🚀 DUAL-FORMAT ESPN STATS SCRAPER'))
  console.log(chalk.cyan('=================================='))
  console.log(chalk.yellow('Maintains both JSON and normalized formats\n'))
  
  for (const [sport, gameIds] of Object.entries(GAME_IDS)) {
    console.log(chalk.bold.yellow(`\n📊 Processing ${sport.toUpperCase()} games...`))
    
    const allStats: any[] = []
    
    for (const gameId of gameIds) {
      const stats = await scrapeGameStats(sport, gameId)
      allStats.push(...stats)
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    await saveStatsDualFormat(allStats, sport)
  }
  
  console.log(chalk.bold.green('\n✅ DUAL-FORMAT SCRAPING COMPLETE!'))
  console.log(chalk.gray('Both player_game_logs (JSON) and player_stats (normalized) updated'))
}

// Run it
scrapeDualFormat().catch(console.error)