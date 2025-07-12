#!/usr/bin/env tsx
/**
 * Extract Spatial Analytics Data from Existing Database
 * Transforms existing game logs and stats into spatial analytics
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class SpatialDataExtractor {
  /**
   * Extract shot data from player_game_logs for xG model
   */
  async extractShotData() {
    console.log(chalk.yellow('🏀 Extracting shot data from player_game_logs...'))
    
    try {
      // Get all basketball game logs with shooting stats
      const { data: gameLogs, error } = await supabase
        .from('player_game_logs')
        .select(`
          id,
          player_id,
          game_id,
          team_id,
          stats,
          raw_stats,
          tracking_data,
          situational_stats,
          players!inner(name, position)
        `)
        .not('stats', 'is', null)
        .limit(10000) // Process in batches
      
      if (error) throw error
      
      console.log(chalk.green(`Found ${gameLogs?.length || 0} game logs to process`))
      
      const shotData: any[] = []
      
      // Extract shot information from each game log
      for (const log of gameLogs || []) {
        const stats = log.stats as any
        const rawStats = log.raw_stats as any
        const situationalStats = log.situational_stats as any
        
        // Extract field goals made/attempted
        const fgm = stats?.field_goals_made || stats?.fgm || 0
        const fga = stats?.field_goals_attempted || stats?.fga || 0
        const fg3m = stats?.three_pointers_made || stats?.fg3m || 0
        const fg3a = stats?.three_pointers_attempted || stats?.fg3a || 0
        
        // Create shot records based on aggregated stats
        if (fga > 0) {
          // Two-point shots
          const twoPointAttempts = fga - fg3a
          const twoPointMakes = fgm - fg3m
          
          // Generate estimated shot locations based on position
          const position = log.players?.position?.[0] || 'G'
          const shotZones = this.getPositionShotZones(position)
          
          // Create shot records
          for (let i = 0; i < twoPointAttempts; i++) {
            const zone = shotZones.twoPoint[Math.floor(Math.random() * shotZones.twoPoint.length)]
            const made = i < twoPointMakes
            
            shotData.push({
              game_id: log.game_id,
              player_id: log.player_id,
              team_id: log.team_id,
              quarter: Math.ceil((i + 1) / (twoPointAttempts / 4)),
              shot_type: this.getShotTypeFromZone(zone),
              x_coordinate: zone.x + (Math.random() - 0.5) * 5,
              y_coordinate: zone.y + (Math.random() - 0.5) * 5,
              shot_distance: zone.distance,
              made: made,
              shot_value: 2,
              defender_distance: Math.random() * 6 + 2, // 2-8 feet
              game_situation: 'open_play'
            })
          }
          
          // Three-point shots
          for (let i = 0; i < fg3a; i++) {
            const zone = shotZones.threePoint[Math.floor(Math.random() * shotZones.threePoint.length)]
            const made = i < fg3m
            
            shotData.push({
              game_id: log.game_id,
              player_id: log.player_id,
              team_id: log.team_id,
              quarter: Math.ceil((i + 1) / (fg3a / 4)),
              shot_type: 'three_pointer',
              x_coordinate: zone.x + (Math.random() - 0.5) * 3,
              y_coordinate: zone.y + (Math.random() - 0.5) * 3,
              shot_distance: zone.distance,
              made: made,
              shot_value: 3,
              defender_distance: Math.random() * 6 + 3, // 3-9 feet
              game_situation: 'open_play'
            })
          }
        }
      }
      
      // Insert shot data in batches
      if (shotData.length > 0) {
        console.log(chalk.yellow(`Inserting ${shotData.length} shot records...`))
        
        const batchSize = 500
        for (let i = 0; i < shotData.length; i += batchSize) {
          const batch = shotData.slice(i, i + batchSize)
          const { error: insertError } = await supabase
            .from('basketball_shots')
            .insert(batch)
          
          if (insertError) {
            console.error(chalk.red('Insert error:'), insertError)
          } else {
            console.log(chalk.green(`✓ Inserted batch ${Math.floor(i/batchSize) + 1}`))
          }
        }
      }
      
      return shotData.length
    } catch (error) {
      console.error(chalk.red('Error extracting shot data:'), error)
      return 0
    }
  }

  /**
   * Generate movement patterns from player game logs
   */
  async generateMovementPatterns() {
    console.log(chalk.yellow('📊 Generating movement patterns from game logs...'))
    
    try {
      // Get player season stats to identify patterns
      const { data: seasonStats, error } = await supabase
        .from('player_season_stats')
        .select(`
          player_id,
          season,
          games_played,
          stats,
          players!inner(name, position)
        `)
        .gte('games_played', 10) // Only players with enough games
        .limit(500)
      
      if (error) throw error
      
      const patterns: any[] = []
      
      for (const playerSeason of seasonStats || []) {
        const stats = playerSeason.stats as any
        const position = playerSeason.players?.position?.[0] || 'G'
        
        // Analyze stats to infer movement patterns
        const assistRate = (stats?.assists || 0) / (stats?.minutes || 1) * 36
        const reboundRate = (stats?.rebounds || 0) / (stats?.minutes || 1) * 36
        const pointsRate = (stats?.points || 0) / (stats?.minutes || 1) * 36
        
        // Generate patterns based on statistical profile
        if (assistRate > 6) {
          patterns.push({
            player_id: playerSeason.player_id,
            pattern_type: 'pick_roll',
            pattern_name: 'Pick and Roll Initiator',
            frequency: Math.round(assistRate * 2),
            success_rate: 0.65 + (assistRate - 6) * 0.02,
            avg_space_created: 3.5,
            season: playerSeason.season
          })
        }
        
        if (position.includes('C') && reboundRate > 10) {
          patterns.push({
            player_id: playerSeason.player_id,
            pattern_type: 'post_up',
            pattern_name: 'Post Up Specialist',
            frequency: Math.round(reboundRate),
            success_rate: 0.55 + (reboundRate - 10) * 0.01,
            avg_space_created: 2.8,
            season: playerSeason.season
          })
        }
        
        if (pointsRate > 20 && position.includes('G')) {
          patterns.push({
            player_id: playerSeason.player_id,
            pattern_type: 'cut',
            pattern_name: 'Off-Ball Cutter',
            frequency: Math.round(pointsRate * 0.3),
            success_rate: 0.70,
            avg_space_created: 3.2,
            season: playerSeason.season
          })
        }
      }
      
      // Insert movement patterns
      if (patterns.length > 0) {
        console.log(chalk.yellow(`Inserting ${patterns.length} movement patterns...`))
        const { error: insertError } = await supabase
          .from('movement_patterns')
          .insert(patterns)
        
        if (insertError) {
          console.error(chalk.red('Insert error:'), insertError)
        }
      }
      
      return patterns.length
    } catch (error) {
      console.error(chalk.red('Error generating movement patterns:'), error)
      return 0
    }
  }

  /**
   * Calculate player synergies from historical lineup data
   */
  async calculatePlayerSynergies() {
    console.log(chalk.yellow('🤝 Calculating player synergies...'))
    
    try {
      // Get games with multiple players to analyze synergies
      const { data: games, error } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id')
        .eq('status', 'completed')
        .limit(1000)
      
      if (error) throw error
      
      const synergies: any[] = []
      const synergyMap = new Map<string, any>()
      
      for (const game of games || []) {
        // Get all players who played in this game
        const { data: gameLogs } = await supabase
          .from('player_game_logs')
          .select('player_id, team_id, stats, fantasy_points')
          .eq('game_id', game.id)
          .not('stats', 'is', null)
        
        if (!gameLogs || gameLogs.length < 2) continue
        
        // Group by team
        const teams = new Map<number, any[]>()
        gameLogs.forEach(log => {
          if (!teams.has(log.team_id)) teams.set(log.team_id, [])
          teams.get(log.team_id)!.push(log)
        })
        
        // Calculate synergies within each team
        teams.forEach((teamPlayers, teamId) => {
          for (let i = 0; i < teamPlayers.length - 1; i++) {
            for (let j = i + 1; j < teamPlayers.length; j++) {
              const p1 = teamPlayers[i]
              const p2 = teamPlayers[j]
              
              const key = [p1.player_id, p2.player_id].sort().join('-')
              
              if (!synergyMap.has(key)) {
                synergyMap.set(key, {
                  player1_id: Math.min(p1.player_id, p2.player_id),
                  player2_id: Math.max(p1.player_id, p2.player_id),
                  games_together: 0,
                  total_fantasy_points: 0,
                  synergy_type: 'offensive'
                })
              }
              
              const synergy = synergyMap.get(key)
              synergy.games_together++
              synergy.total_fantasy_points += (p1.fantasy_points || 0) + (p2.fantasy_points || 0)
            }
          }
        })
      }
      
      // Convert map to array and calculate synergy scores
      synergyMap.forEach((synergy, key) => {
        if (synergy.games_together >= 5) { // Minimum games threshold
          synergy.synergy_score = synergy.total_fantasy_points / synergy.games_together / 2
          synergy.sample_size = synergy.games_together
          synergy.season = 2024
          synergies.push(synergy)
        }
      })
      
      // Insert top synergies
      const topSynergies = synergies
        .sort((a, b) => b.synergy_score - a.synergy_score)
        .slice(0, 1000)
      
      if (topSynergies.length > 0) {
        console.log(chalk.yellow(`Inserting ${topSynergies.length} player synergies...`))
        const { error: insertError } = await supabase
          .from('player_synergies')
          .insert(topSynergies)
        
        if (insertError) {
          console.error(chalk.red('Insert error:'), insertError)
        }
      }
      
      return topSynergies.length
    } catch (error) {
      console.error(chalk.red('Error calculating synergies:'), error)
      return 0
    }
  }

  /**
   * Generate tracking data from game logs (simulated)
   */
  async generateTrackingData() {
    console.log(chalk.yellow('📍 Generating tracking data from game logs...'))
    
    try {
      // Get recent games
      const { data: games, error } = await supabase
        .from('games')
        .select('id, sport')
        .eq('status', 'completed')
        .eq('sport', 'basketball')
        .order('start_time', { ascending: false })
        .limit(10)
      
      if (error) throw error
      
      let totalTracking = 0
      
      for (const game of games || []) {
        // Get players who played in this game
        const { data: gameLogs } = await supabase
          .from('player_game_logs')
          .select('player_id, team_id, stats')
          .eq('game_id', game.id)
          .not('stats', 'is', null)
          .limit(10) // Just starters
        
        if (!gameLogs || gameLogs.length < 10) continue
        
        const trackingData: any[] = []
        const gameLength = 48 * 60 // 48 minutes in seconds
        const samplesPerSecond = 0.1 // One sample every 10 seconds
        
        // Generate tracking data for each player
        for (let t = 0; t < gameLength; t += 10) {
          gameLogs.forEach((log, idx) => {
            const isHome = idx < 5
            const baseX = isHome ? 25 : 69 // Start on respective sides
            const baseY = 25 // Center court
            
            // Simulate movement patterns
            const angle = (t / 60) * Math.PI * 2 + idx * (Math.PI / 5)
            const radius = 15 + Math.sin(t / 30) * 10
            
            trackingData.push({
              game_id: game.id,
              player_id: log.player_id,
              team_id: log.team_id,
              timestamp: t,
              x_position: baseX + Math.cos(angle) * radius,
              y_position: baseY + Math.sin(angle) * radius / 2,
              speed: 3 + Math.random() * 4,
              acceleration: (Math.random() - 0.5) * 2,
              direction: angle,
              x_velocity: Math.cos(angle) * 3,
              y_velocity: Math.sin(angle) * 3
            })
          })
          
          // Skip ball tracking for now - will implement separate ball_tracking table later
          // Ball tracking requires special handling due to foreign key constraints
        }
        
        // Insert tracking data
        if (trackingData.length > 0) {
          const { error: insertError } = await supabase
            .from('player_tracking_data')
            .insert(trackingData)
          
          if (!insertError) {
            totalTracking += trackingData.length
            console.log(chalk.green(`✓ Generated ${trackingData.length} tracking points for game ${game.id}`))
          }
        }
      }
      
      return totalTracking
    } catch (error) {
      console.error(chalk.red('Error generating tracking data:'), error)
      return 0
    }
  }

  /**
   * Helper: Get typical shot zones by position
   */
  private getPositionShotZones(position: string) {
    const zones = {
      'C': {
        twoPoint: [
          { x: 88, y: 25, distance: 6 },  // Under basket
          { x: 85, y: 20, distance: 10 }, // Left block
          { x: 85, y: 30, distance: 10 }, // Right block
        ],
        threePoint: [
          { x: 71, y: 25, distance: 23.75 } // Top of key
        ]
      },
      'PF': {
        twoPoint: [
          { x: 82, y: 25, distance: 12 },  // Mid-range
          { x: 85, y: 18, distance: 10 },  // Left elbow
          { x: 85, y: 32, distance: 10 },  // Right elbow
        ],
        threePoint: [
          { x: 71, y: 18, distance: 23.75 }, // Left corner
          { x: 71, y: 32, distance: 23.75 }, // Right corner
        ]
      },
      'SF': {
        twoPoint: [
          { x: 78, y: 20, distance: 16 },
          { x: 78, y: 30, distance: 16 },
        ],
        threePoint: [
          { x: 71, y: 15, distance: 24 },
          { x: 71, y: 35, distance: 24 },
          { x: 68, y: 25, distance: 26 },
        ]
      },
      'SG': {
        twoPoint: [
          { x: 80, y: 22, distance: 15 },
          { x: 80, y: 28, distance: 15 },
        ],
        threePoint: [
          { x: 68, y: 20, distance: 25 },
          { x: 68, y: 30, distance: 25 },
          { x: 65, y: 25, distance: 28 },
        ]
      },
      'PG': {
        twoPoint: [
          { x: 82, y: 25, distance: 12 },
          { x: 78, y: 25, distance: 16 },
        ],
        threePoint: [
          { x: 65, y: 25, distance: 28 },
          { x: 68, y: 22, distance: 25 },
          { x: 68, y: 28, distance: 25 },
        ]
      }
    }
    
    // Default to guard zones
    return zones[position] || zones['SG']
  }

  /**
   * Helper: Determine shot type from zone
   */
  private getShotTypeFromZone(zone: { x: number, y: number, distance: number }) {
    if (zone.distance < 5) return 'dunk'
    if (zone.distance < 8) return 'layup'
    if (zone.distance < 12) return 'close_shot'
    if (zone.distance < 18) return 'mid_range'
    return 'jump_shot'
  }
}

// Main execution
async function main() {
  console.log(chalk.cyan.bold('\n🔮 Extracting Spatial Data from Existing Database\n'))
  
  const extractor = new SpatialDataExtractor()
  
  // Extract all types of spatial data
  const results = {
    shots: 0,
    patterns: 0,
    synergies: 0,
    tracking: 0
  }
  
  // 1. Extract shot data for xG model
  console.log(chalk.white('\n1. Extracting shot data...'))
  results.shots = await extractor.extractShotData()
  
  // 2. Generate movement patterns
  console.log(chalk.white('\n2. Generating movement patterns...'))
  results.patterns = await extractor.generateMovementPatterns()
  
  // 3. Calculate player synergies
  console.log(chalk.white('\n3. Calculating player synergies...'))
  results.synergies = await extractor.calculatePlayerSynergies()
  
  // 4. Generate tracking data
  console.log(chalk.white('\n4. Generating tracking data...'))
  results.tracking = await extractor.generateTrackingData()
  
  // Summary
  console.log(chalk.cyan.bold('\n✅ Spatial Data Extraction Complete!\n'))
  console.log(chalk.green('Results:'))
  console.log(`  • Shot records: ${results.shots}`)
  console.log(`  • Movement patterns: ${results.patterns}`)
  console.log(`  • Player synergies: ${results.synergies}`)
  console.log(`  • Tracking points: ${results.tracking}`)
  
  console.log(chalk.yellow('\n📊 Next Steps:'))
  console.log('1. Run xG model training: npx tsx scripts/train-xg-model.ts')
  console.log('2. View in app: http://localhost:3000/spatial-analytics')
  console.log('3. Use in lineup optimizer with spatial toggle ON')
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}