#!/usr/bin/env tsx
/**
 * COMPLETE NFL DOMINATION
 * Target the 526 remaining NFL games to achieve 100% coverage!
 * Modeled after our NCAAF perfection
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import axios from 'axios'
import pLimit from 'p-limit'
import * as dotenv from 'dotenv'
import * as os from 'os'
import { buildEspnApiUrl } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 4) // MAXIMUM POWER

async function completeNFLDomination() {
  console.log(chalk.bold.red('🏈 COMPLETE NFL DOMINATION - 100% COVERAGE MISSION!\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats`))
  console.log(chalk.yellow('🎯 MISSION: Achieve 100% NFL coverage like NCAAF!\n'))
  
  // Get ONLY NFL games (not 'nfl' lowercase)
  console.log(chalk.yellow('🔍 Finding ALL NFL games...\n'))
  
  const allNFLGames: any[] = []
  let offset = 0
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id, home_score, away_score')
      .eq('sport', 'NFL') // ONLY uppercase NFL
      .not('home_score', 'is', null) // Only completed games
      .gte('start_time', '2020-01-01') // Extended range
      .lte('start_time', '2024-12-31')
      .range(offset, offset + 999)
      .order('start_time', { ascending: false })
      
    if (!batch || batch.length === 0) break
    
    allNFLGames.push(...batch)
    offset += 1000
  }
  
  console.log(chalk.bold.cyan(`📊 Found ${allNFLGames.length} total NFL games`))
  
  // Check which need stats
  const gameIds = allNFLGames.map(g => g.id)
  const gamesWithStats = new Set<number>()
  
  console.log(chalk.yellow('🔍 Checking which games need stats...\n'))
  
  // Efficient batch checking
  for (let i = 0; i < gameIds.length; i += 2000) {
    const batch = gameIds.slice(i, i + 2000)
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch)
      
    data?.forEach(row => gamesWithStats.add(row.game_id))
  }
  
  const missingGames = allNFLGames.filter(g => !gamesWithStats.has(g.id))
  const currentCoverage = ((allNFLGames.length - missingGames.length) / allNFLGames.length * 100).toFixed(1)
  
  console.log(chalk.bold.yellow(`📈 Current NFL Coverage: ${currentCoverage}%`))
  console.log(chalk.bold.red(`🎯 ${missingGames.length} games need stats for 100% coverage!\n`))
  
  if (missingGames.length === 0) {
    console.log(chalk.bold.green('✅ NFL ALREADY AT 100% COVERAGE! 🏆'))
    return
  }
  
  // Group by season for organized attack
  const seasonGroups = new Map<number, typeof missingGames>()
  missingGames.forEach(game => {
    const year = new Date(game.start_time).getFullYear()
    if (!seasonGroups.has(year)) {
      seasonGroups.set(year, [])
    }
    seasonGroups.get(year)!.push(game)
  })
  
  console.log(chalk.cyan('Missing games by season:'))
  Array.from(seasonGroups.entries())
    .sort(([a], [b]) => b - a)
    .forEach(([year, games]) => {
      console.log(`  ${year}: ${games.length} games`)
    })
  
  console.log(chalk.bold.red('\n🚀 LAUNCHING FULL-SCALE NFL ATTACK!\n'))
  
  // Process ALL missing games
  let successful = 0
  let totalNewStats = 0
  let errors = 0
  const startTime = Date.now()
  
  const promises = missingGames.map(game => 
    limit(async () => {
      try {
        if (!game.external_id?.includes('espn_')) return
        
        const apiUrl = buildEspnApiUrl(game.external_id)
        if (!apiUrl) return
        
        const response = await axios.get(apiUrl, {
          timeout: 15000, // Extended timeout
          validateStatus: (status) => status < 500,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        })
        
        if (response.status === 200 && response.data.boxscore?.players) {
          const stats = extractNFLStats(response.data.boxscore, game)
          
          if (stats.length > 0) {
            const statsWithDate = stats.map(stat => ({
              ...stat,
              game_date: new Date(game.start_time).toISOString().split('T')[0]
            }))
            
            await saveNFLStats(statsWithDate)
            successful++
            totalNewStats += stats.length
            
            if (successful % 25 === 0) {
              const rate = (totalNewStats / ((Date.now() - startTime) / 1000)).toFixed(1)
              const progress = (successful / missingGames.length * 100).toFixed(1)
              console.log(chalk.green(`    ⚡ Progress: ${progress}% | ${successful} games | ${totalNewStats} stats (${rate}/sec)`))
            }
          }
        } else if (response.status === 404) {
          errors++
        }
      } catch (error: any) {
        if (!error.message?.includes('ECONNRESET') && !error.message?.includes('timeout')) {
          errors++
        }
      }
    })
  )
  
  await Promise.all(promises)
  
  const elapsed = (Date.now() - startTime) / 1000
  const rate = (totalNewStats / elapsed).toFixed(1)
  
  // Final coverage check
  const { data: finalCheck } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', gameIds)
    
  const finalGamesWithStats = new Set(finalCheck?.map(row => row.game_id) || [])
  const finalCoverage = (finalGamesWithStats.size / allNFLGames.length * 100).toFixed(1)
  
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  const netGain = (finalCount || 0) - (startingCount || 0)
  
  console.log(chalk.bold.red('\n🏈 NFL DOMINATION COMPLETE!\n'))
  console.log(chalk.bold.yellow('📊 FINAL NFL RESULTS:'))
  console.log(`  🚀 Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  🏈 Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  📈 NET GAIN: ${netGain.toLocaleString()} NEW STATS`)
  console.log(`  ⚡ Collection: ${successful}/${missingGames.length} games conquered`)
  console.log(`  🎯 NFL Coverage: ${currentCoverage}% → ${finalCoverage}%`)
  console.log(`  ⏱️  Speed: ${rate} stats/second`)
  
  if (finalCoverage === '100.0') {
    console.log(chalk.bold.green('\n🏆 LEGENDARY ACHIEVEMENT: 100% NFL COVERAGE ACHIEVED!'))
    console.log(chalk.bold.cyan('👑 NFL DOMINATION COMPLETE - MATCHING NCAAF PERFECTION!'))
  } else if (parseFloat(finalCoverage) >= 90) {
    console.log(chalk.bold.green('\n🎉 ELITE STATUS: 90%+ NFL COVERAGE!'))
  } else if (parseFloat(finalCoverage) >= 80) {
    console.log(chalk.bold.green('\n✅ STRONG COVERAGE: 80%+ NFL GAMES!'))
  }
  
  if (errors > 0) {
    console.log(chalk.yellow(`\n⚠️  ${errors} API errors encountered`))
  }
  
  console.log(chalk.bold.cyan('\n🚀 READY FOR NEXT SPORT DOMINATION!'))
}

function extractNFLStats(boxscore: any, game: any): any[] {
  const stats: any[] = []
  
  try {
    if (boxscore.players) {
      boxscore.players.forEach((teamData: any) => {
        const isHome = teamData.homeAway === 'home'
        const teamId = isHome ? game.home_team_id : game.away_team_id
        const opponentId = isHome ? game.away_team_id : game.home_team_id
        
        Object.values(teamData.statistics || {}).forEach((statGroup: any) => {
          if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
            statGroup.athletes.forEach((athlete: any) => {
              if (!athlete.stats || athlete.stats.length === 0) return
              
              const baseStats = {
                player_id: parseInt(athlete.athlete.id),
                game_id: game.id,
                team_id: teamId,
                opponent_id: opponentId,
                is_home: isHome,
                stats: {}
              }
              
              // PASSING STATS
              if (statGroup.name === 'passing' && athlete.stats.length >= 5) {
                const compAtt = athlete.stats[0].split('/').map((s: string) => parseInt(s) || 0)
                const yards = parseInt(athlete.stats[1]) || 0
                const tds = parseInt(athlete.stats[3]) || 0
                const ints = parseInt(athlete.stats[4]) || 0
                
                baseStats.stats = {
                  completions: compAtt[0],
                  attempts: compAtt[1],
                  passing_yards: yards,
                  passing_touchdowns: tds,
                  interceptions: ints,
                  completion_percentage: compAtt[1] > 0 ? (compAtt[0] / compAtt[1] * 100) : 0,
                  passer_rating: calculatePasserRating(compAtt[0], compAtt[1], yards, tds, ints),
                  fantasy_points: (yards * 0.04) + (tds * 4) - (ints * 2)
                }
                stats.push({...baseStats})
              }
              
              // RUSHING STATS
              if (statGroup.name === 'rushing' && athlete.stats.length >= 4) {
                const carries = parseInt(athlete.stats[0]) || 0
                const yards = parseInt(athlete.stats[1]) || 0
                const tds = parseInt(athlete.stats[3]) || 0
                
                baseStats.stats = {
                  carries: carries,
                  rushing_yards: yards,
                  rushing_touchdowns: tds,
                  yards_per_carry: carries > 0 ? (yards / carries) : 0,
                  fantasy_points: (yards * 0.1) + (tds * 6)
                }
                stats.push({...baseStats})
              }
              
              // RECEIVING STATS
              if (statGroup.name === 'receiving' && athlete.stats.length >= 4) {
                const receptions = parseInt(athlete.stats[0]) || 0
                const yards = parseInt(athlete.stats[1]) || 0
                const tds = parseInt(athlete.stats[3]) || 0
                
                baseStats.stats = {
                  receptions: receptions,
                  receiving_yards: yards,
                  receiving_touchdowns: tds,
                  yards_per_reception: receptions > 0 ? (yards / receptions) : 0,
                  fantasy_points: (receptions * 1) + (yards * 0.1) + (tds * 6)
                }
                stats.push({...baseStats})
              }
              
              // DEFENSIVE STATS
              if (statGroup.name === 'defensive' && athlete.stats.length >= 3) {
                const tackles = parseInt(athlete.stats[0]) || 0
                const sacks = parseFloat(athlete.stats[1]) || 0
                const ints = parseInt(athlete.stats[2]) || 0
                
                baseStats.stats = {
                  tackles: tackles,
                  sacks: sacks,
                  interceptions: ints,
                  fantasy_points: (tackles * 1) + (sacks * 2) + (ints * 2)
                }
                stats.push({...baseStats})
              }
              
              // KICKING STATS
              if (statGroup.name === 'kicking' && athlete.stats.length >= 5) {
                const fgMade = parseInt(athlete.stats[0]?.split('/')[0]) || 0
                const fgAtt = parseInt(athlete.stats[0]?.split('/')[1]) || 0
                const xpMade = parseInt(athlete.stats[2]?.split('/')[0]) || 0
                
                baseStats.stats = {
                  field_goals_made: fgMade,
                  field_goals_attempted: fgAtt,
                  extra_points_made: xpMade,
                  fantasy_points: (fgMade * 3) + (xpMade * 1)
                }
                stats.push({...baseStats})
              }
            })
          }
        })
      })
    }
  } catch (error) {
    // Silent continue
  }
  
  return stats
}

function calculatePasserRating(comp: number, att: number, yards: number, tds: number, ints: number): number {
  if (att === 0) return 0
  
  const a = Math.max(0, Math.min(2.375, (comp / att - 0.3) * 5))
  const b = Math.max(0, Math.min(2.375, (yards / att - 3) * 0.25))
  const c = Math.max(0, Math.min(2.375, (tds / att) * 20))
  const d = Math.max(0, Math.min(2.375, 2.375 - (ints / att * 25)))
  
  return ((a + b + c + d) / 6) * 100
}

async function saveNFLStats(stats: any[]) {
  if (stats.length === 0) return
  
  // Create players efficiently
  const playerIds = [...new Set(stats.map(s => s.player_id))]
  const players = playerIds.map(id => ({
    id,
    external_id: `espn_nfl_${id}`,
    name: `NFL Player ${id}`,
    sport: 'NFL'
  }))
  
  // Batch player creation
  for (let i = 0; i < players.length; i += 200) {
    const batch = players.slice(i, i + 200)
    await supabase
      .from('players')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
  }
  
  // Deduplicate and save stats
  const uniqueStats = new Map()
  stats.forEach(stat => {
    const key = `${stat.player_id}_${stat.game_id}`
    const existing = uniqueStats.get(key)
    // Keep the stat with more complete data
    if (!existing || Object.keys(stat.stats).length > Object.keys(existing.stats).length) {
      uniqueStats.set(key, stat)
    }
  })
  
  const uniqueStatsArray = Array.from(uniqueStats.values())
  
  // High-speed batch saving
  for (let i = 0; i < uniqueStatsArray.length; i += 100) {
    const batch = uniqueStatsArray.slice(i, i + 100)
    try {
      await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
    } catch (error: any) {
      // Continue on errors to maintain speed
    }
  }
}

// EXECUTE NFL DOMINATION!
completeNFLDomination().catch(console.error)