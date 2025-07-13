#!/usr/bin/env tsx
/**
 * TARGETED STATS COLLECTOR
 * Collect stats for specific games we know need them
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import axios from 'axios'
import pLimit from 'p-limit'
import * as dotenv from 'dotenv'
import * as os from 'os'
import { buildEspnApiUrl, extractStatsBySport } from './smart-stats-collector'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 2)

async function targetedStatsCollector() {
  console.log(chalk.bold.red('🎯 TARGETED STATS COLLECTOR\n'))
  
  const { count: startingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.cyan(`🚀 Starting: ${startingCount?.toLocaleString() || 0} player stats\n`))
  
  // Target specific games we know need stats
  const targetGames = [
    // NBA
    { external_id: 'espn_nba_401732290', sport: 'NBA' },
    { external_id: 'espn_nba_401722185', sport: 'NBA' },
    { external_id: 'espn_nba_401721066', sport: 'NBA' },
    { external_id: 'espn_nba_401721058', sport: 'NBA' },
    { external_id: 'espn_nba_401715386', sport: 'NBA' },
    // NHL
    { external_id: 'espn_nhl_401677101', sport: 'NHL' },
    { external_id: 'espn_nhl_401677100', sport: 'NHL' },
    { external_id: 'espn_nhl_401677099', sport: 'NHL' },
    // MLB
    { external_id: 'espn_mlb_401701054', sport: 'MLB' },
    { external_id: 'espn_mlb_401701053', sport: 'MLB' },
    // NCAAB
    { external_id: 'espn_ncaab_401725630', sport: 'NCAAB' },
    { external_id: 'espn_ncaab_401732290', sport: 'NCAAB' }
  ]
  
  console.log(chalk.yellow(`🎯 Targeting ${targetGames.length} specific games\n`))
  
  let totalNewStats = 0
  let successful = 0
  
  for (const target of targetGames) {
    console.log(chalk.cyan(`\nProcessing ${target.sport} game: ${target.external_id}`))
    
    // Get the game from DB
    const { data: game } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_team_id, away_team_id')
      .eq('external_id', target.external_id)
      .single()
      
    if (!game) {
      console.log(chalk.red('  Game not found in database'))
      continue
    }
    
    // Double check it needs stats
    const { count: existingStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)
      
    if (existingStats && existingStats > 0) {
      console.log(chalk.yellow(`  Already has ${existingStats} stats`))
      continue
    }
    
    // Fetch from API
    try {
      const apiUrl = buildEspnApiUrl(game.external_id)
      if (!apiUrl) {
        console.log(chalk.red('  Could not build API URL'))
        continue
      }
      
      console.log(`  Fetching: ${apiUrl}`)
      
      const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (response.status === 200 && response.data.boxscore?.players) {
        console.log(chalk.green('  ✅ API success, extracting stats...'))
        
        const stats = extractStatsBySport(response.data.boxscore, game, target.sport)
        console.log(`  Found ${stats.length} player stats`)
        
        if (stats.length > 0) {
          // Create players first
          const playerIds = [...new Set(stats.map(s => s.player_id))]
          const players = playerIds.map(id => ({
            id,
            external_id: `espn_${target.sport.toLowerCase()}_${id}`,
            name: `${target.sport} Player ${id}`,
            sport: target.sport
          }))
          
          await supabase
            .from('players')
            .upsert(players, { onConflict: 'id', ignoreDuplicates: true })
          
          // Save stats
          const { data, error } = await supabase
            .from('player_game_logs')
            .insert(stats)
            .select()
            
          if (error) {
            console.log(chalk.red(`  Error: ${error.message}`))
          } else if (data) {
            console.log(chalk.green(`  ✅ Saved ${data.length} stats!`))
            totalNewStats += data.length
            successful++
          }
        }
      } else {
        console.log(chalk.red(`  API returned status ${response.status}`))
      }
    } catch (error: any) {
      console.log(chalk.red(`  Error: ${error.message}`))
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    
  console.log(chalk.bold.red('\n📊 FINAL RESULTS:'))
  console.log(`  🚀 Starting: ${startingCount?.toLocaleString() || 0} stats`)
  console.log(`  🏆 Final: ${finalCount?.toLocaleString() || 0} stats`)
  console.log(`  📈 NET GAIN: ${((finalCount || 0) - (startingCount || 0)).toLocaleString()} NEW STATS`)
  console.log(`  ✅ Successfully processed: ${successful}/${targetGames.length} games`)
}

// Copy the extraction function from smart-stats-collector
function extractStatsBySport(boxscore: any, game: any, sport: string): any[] {
  const stats: any[] = []
  
  try {
    if (!boxscore.players) return stats
    
    boxscore.players.forEach((teamData: any) => {
      const isHome = teamData.homeAway === 'home'
      const teamId = isHome ? game.home_team_id : game.away_team_id
      const opponentId = isHome ? game.away_team_id : game.home_team_id
      
      if (sport === 'NBA' || sport === 'NCAAB') {
        // Basketball - look for first statistics array
        if (teamData.statistics && teamData.statistics.length > 0) {
          const playerStats = teamData.statistics[0]
          if (playerStats.athletes) {
            playerStats.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length >= 14) {
                const minutesStr = athlete.stats[0]
                if (typeof minutesStr === 'string' && minutesStr !== 'DNP') {
                  const statObj = {
                    player_id: parseInt(athlete.athlete.id),
                    game_id: game.id,
                    team_id: teamId,
                    opponent_id: opponentId,
                    is_home: isHome,
                    game_date: new Date(game.start_time).toISOString().split('T')[0],
                    stats: {
                      minutes_played: parseInt(minutesStr) || 0,
                      points: parseInt(athlete.stats[13]) || 0,
                      rebounds: parseInt(athlete.stats[6]) || 0,
                      assists: parseInt(athlete.stats[7]) || 0,
                      steals: parseInt(athlete.stats[8]) || 0,
                      blocks: parseInt(athlete.stats[9]) || 0,
                      turnovers: parseInt(athlete.stats[10]) || 0,
                      field_goals_made: parseInt(athlete.stats[1]?.split('-')[0]) || 0,
                      field_goals_attempted: parseInt(athlete.stats[1]?.split('-')[1]) || 0,
                      fantasy_points: 0
                    }
                  }
                  // Calculate fantasy points
                  statObj.stats.fantasy_points = 
                    statObj.stats.points + 
                    (statObj.stats.rebounds * 1.25) + 
                    (statObj.stats.assists * 1.5) + 
                    (statObj.stats.steals * 2) + 
                    (statObj.stats.blocks * 2) - 
                    (statObj.stats.turnovers * 0.5)
                  
                  stats.push(statObj)
                }
              }
            })
          }
        }
      } else if (sport === 'NHL') {
        // NHL - array-based statistics
        if (teamData.statistics && Array.isArray(teamData.statistics)) {
          teamData.statistics.forEach((statGroup: any, index: number) => {
            if (statGroup.athletes) {
              statGroup.athletes.forEach((athlete: any) => {
                if (!athlete.stats || athlete.stats.length === 0) return
                
                const playerStat: any = {
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  stats: {}
                }
                
                if (index === 2 && athlete.stats.length >= 12) {
                  // Goalie stats
                  playerStat.stats = {
                    goals_against: parseInt(athlete.stats[0]) || 0,
                    saves: parseInt(athlete.stats[1]) || 0,
                    save_percentage: parseFloat(athlete.stats[6]) || 0,
                    is_goalie: true,
                    fantasy_points: (parseInt(athlete.stats[1]) || 0) * 0.2 - 
                                   (parseInt(athlete.stats[0]) || 0)
                  }
                  stats.push(playerStat)
                } else if (athlete.stats.length >= 21) {
                  // Skater stats
                  playerStat.stats = {
                    goals: parseInt(athlete.stats[0]) || 0,
                    assists: parseInt(athlete.stats[1]) || 0,
                    points: parseInt(athlete.stats[2]) || 0,
                    shots: parseInt(athlete.stats[8]) || 0,
                    blocks: parseInt(athlete.stats[17]) || 0,
                    fantasy_points: (parseInt(athlete.stats[0]) || 0) * 3 + 
                                   (parseInt(athlete.stats[1]) || 0) * 2 +
                                   (parseInt(athlete.stats[8]) || 0) * 0.4 +
                                   (parseInt(athlete.stats[17]) || 0) * 0.4
                  }
                  stats.push(playerStat)
                }
              })
            }
          })
        }
      } else if (sport === 'MLB') {
        // MLB - array-based statistics
        if (teamData.statistics && Array.isArray(teamData.statistics)) {
          teamData.statistics.forEach((statGroup: any, index: number) => {
            if (statGroup.athletes) {
              statGroup.athletes.forEach((athlete: any) => {
                if (!athlete.stats || athlete.stats.length === 0) return
                
                const playerStat: any = {
                  player_id: parseInt(athlete.athlete.id),
                  game_id: game.id,
                  team_id: teamId,
                  opponent_id: opponentId,
                  is_home: isHome,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  stats: {}
                }
                
                if (index === 0 && athlete.stats.length >= 12) {
                  // Batting stats
                  const abStr = athlete.stats[0]
                  const [hits, atBats] = abStr.split('-').map((s: string) => parseInt(s) || 0)
                  
                  playerStat.stats = {
                    at_bats: atBats,
                    hits: hits,
                    runs: parseInt(athlete.stats[2]) || 0,
                    rbi: parseInt(athlete.stats[3]) || 0,
                    walks: parseInt(athlete.stats[4]) || 0,
                    strikeouts: parseInt(athlete.stats[5]) || 0,
                    is_pitcher: false,
                    fantasy_points: hits + 
                                   (parseInt(athlete.stats[2]) || 0) +
                                   (parseInt(athlete.stats[3]) || 0) +
                                   (parseInt(athlete.stats[4]) || 0)
                  }
                  stats.push(playerStat)
                } else if (index === 1 && athlete.stats.length >= 10) {
                  // Pitching stats
                  playerStat.stats = {
                    innings_pitched: parseFloat(athlete.stats[0]) || 0,
                    strikeouts_pitched: parseInt(athlete.stats[5]) || 0,
                    earned_runs: parseInt(athlete.stats[3]) || 0,
                    is_pitcher: true,
                    fantasy_points: (parseFloat(athlete.stats[0]) || 0) * 3 +
                                   (parseInt(athlete.stats[5]) || 0) -
                                   (parseInt(athlete.stats[3]) || 0)
                  }
                  stats.push(playerStat)
                }
              })
            }
          })
        }
      }
    })
  } catch (error) {
    // Silent fail
  }
  
  return stats
}

targetedStatsCollector().catch(console.error)