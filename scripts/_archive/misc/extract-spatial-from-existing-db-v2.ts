#!/usr/bin/env tsx
/**
 * Extract Spatial Analytics Data from Existing Database V2
 * Refactored to use standardized database service
 */

import { BaseCollector } from '../lib/collectors/base-collector'
import { db } from '../lib/services/database-service'
import chalk from 'chalk'

interface SpatialExtractionStats {
  shots: number
  patterns: number
  synergies: number
  tracking: number
}

class SpatialDataExtractorV2 extends BaseCollector {
  private extractionStats: SpatialExtractionStats = {
    shots: 0,
    patterns: 0,
    synergies: 0,
    tracking: 0
  }
  
  constructor() {
    super({
      name: 'SPATIAL DATA EXTRACTOR V2',
      concurrencyLimit: 5,
      batchSize: 100,
      retryAttempts: 3,
      enableDetailedLogging: true
    })
  }
  
  async run() {
    console.log(chalk.cyan.bold('\n🔮 Extracting Spatial Data from Existing Database V2\n'))
    
    try {
      // 1. Extract shot data for xG model
      console.log(chalk.white('\n1. Extracting shot data...'))
      this.extractionStats.shots = await this.extractShotData()
      
      // 2. Generate movement patterns
      console.log(chalk.white('\n2. Generating movement patterns...'))
      this.extractionStats.patterns = await this.generateMovementPatterns()
      
      // 3. Calculate player synergies
      console.log(chalk.white('\n3. Calculating player synergies...'))
      this.extractionStats.synergies = await this.calculatePlayerSynergies()
      
      // 4. Generate tracking data
      console.log(chalk.white('\n4. Generating tracking data...'))
      this.extractionStats.tracking = await this.generateTrackingData()
      
      // Show results
      this.showSpatialReport()
      
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error)
      throw error
    }
  }
  
  // Override base methods since we're not processing games
  async getGamesToProcess() {
    return [] // Not used in spatial extraction
  }
  
  async processGame(game: any) {
    // Not used in spatial extraction
  }
  
  /**
   * Extract shot data from player_game_logs for xG model
   */
  private async extractShotData(): Promise<number> {
    console.log(chalk.yellow('🏀 Extracting shot data from player_game_logs...'))
    
    try {
      // Get all basketball game logs with shooting stats
      const { data: gameLogs, error } = await this.db.getClient()
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
        .limit(10000)
      
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
              defender_distance: Math.random() * 6 + 2,
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
              defender_distance: Math.random() * 6 + 3,
              game_situation: 'open_play'
            })
          }
        }
      }
      
      // Insert shot data using standardized batch processing
      if (shotData.length > 0) {
        console.log(chalk.yellow(`Inserting ${shotData.length} shot records...`))
        await this.db.upsertBatch('basketball_shots', shotData, {
          batchSize: 500
        })
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
  private async generateMovementPatterns(): Promise<number> {
    console.log(chalk.yellow('📊 Generating movement patterns from game logs...'))
    
    try {
      // Get player season stats to identify patterns
      const { data: seasonStats, error } = await this.db.getClient()
        .from('player_season_stats')
        .select(`
          player_id,
          season,
          games_played,
          stats,
          players!inner(name, position)
        `)
        .gte('games_played', 10)
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
        await this.db.upsertBatch('movement_patterns', patterns)
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
  private async calculatePlayerSynergies(): Promise<number> {
    console.log(chalk.yellow('🤝 Calculating player synergies...'))
    
    try {
      // Get ALL completed games with data - batch to bypass 1000 row limit
      let allGames: any[] = []
      const batchSize = 1000
      let offset = 0
      
      console.log(chalk.cyan('Fetching all completed games...'))
      
      while (true) {
        const { data: batch, error } = await this.db.getClient()
          .from('games')
          .select('id, sport, home_team_id, away_team_id')
          .eq('status', 'completed')
          .not('home_score', 'is', null)
          .not('away_score', 'is', null)
          .order('id', { ascending: true })
          .range(offset, offset + batchSize - 1)
        
        if (error) throw error
        if (!batch || batch.length === 0) break
        
        allGames = allGames.concat(batch)
        console.log(chalk.dim(`  Fetched ${allGames.length} games...`))
        
        if (batch.length < batchSize) break
        offset += batchSize
      }
      
      const games = allGames
      console.log(chalk.green(`Found ${games.length} completed games to analyze`))
      
      const synergyMap = new Map<string, any>()
      let processedGames = 0
      
      // Process games in batches of 100
      const gameBatchSize = 100
      for (let i = 0; i < (games?.length || 0); i += gameBatchSize) {
        const gameBatch = games!.slice(i, i + gameBatchSize)
        console.log(chalk.dim(`Processing games ${i + 1}-${Math.min(i + gameBatchSize, games!.length)}...`))
        
        for (const game of gameBatch) {
          // Get all players who played in this game
          const { data: gameLogs } = await this.db.getClient()
            .from('player_game_logs')
            .select('player_id, team_id, fantasy_points')
            .eq('game_id', game.id)
            .gt('fantasy_points', 0)
        
          if (!gameLogs || gameLogs.length < 2) continue
          
          processedGames++
        
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
        
        // Show progress
        if ((i + gameBatchSize) % 500 === 0) {
          console.log(chalk.cyan(`Processed ${processedGames} games with data...`))
        }
      }
      
      console.log(chalk.green(`\nProcessed ${processedGames} games with player data`))
      console.log(chalk.cyan(`Found ${synergyMap.size} unique player pairs`))
      
      // Convert map to array and calculate synergy scores
      const synergies: any[] = []
      synergyMap.forEach((synergy, key) => {
        if (synergy.games_together >= 5) {
          synergy.synergy_score = synergy.total_fantasy_points / synergy.games_together / 2
          synergy.sample_size = synergy.games_together
          synergy.season = 2024
          synergies.push(synergy)
        }
      })
      
      // Sort and take top synergies
      const sortedSynergies = synergies
        .sort((a, b) => b.synergy_score - a.synergy_score)
      
      console.log(chalk.yellow(`\nFound ${synergies.length} synergies with 5+ games together`))
      
      if (sortedSynergies.length > 0) {
        // Show top synergies
        console.log(chalk.green('\nTop 5 synergies:'))
        sortedSynergies.slice(0, 5).forEach((s, i) => {
          console.log(chalk.white(`  ${i + 1}. Players ${s.player1_id} & ${s.player2_id}: ${s.synergy_score.toFixed(1)} avg FP (${s.games_together} games)`))
        })
        
        // Insert all synergies in batches
        console.log(chalk.yellow(`\nInserting ${sortedSynergies.length} player synergies...`))
        
        try {
          await this.db.upsertBatch('player_synergies', sortedSynergies, {
            batchSize: 500,
            onConflict: 'player1_id,player2_id,season'
          })
        } catch (err) {
          console.error(chalk.red('Error inserting synergies:'), err)
          // Try without onConflict
          await this.db.upsertBatch('player_synergies', sortedSynergies, {
            batchSize: 500
          })
        }
      }
      
      return sortedSynergies.length
    } catch (error) {
      console.error(chalk.red('Error calculating synergies:'), error)
      return 0
    }
  }
  
  /**
   * Generate tracking data from game logs (simulated)
   */
  private async generateTrackingData(): Promise<number> {
    console.log(chalk.yellow('📍 Generating tracking data from game logs...'))
    
    try {
      // Get recent basketball games
      const games = await this.db.getGames({
        sport: 'basketball',
        status: 'completed',
        limit: 10
      })
      
      let totalTracking = 0
      
      for (const game of games) {
        // Get players who played in this game
        const gameLogs = await this.db.getPlayerGameLogs({
          gameId: game.id,
          limit: 10
        })
        
        if (gameLogs.length < 10) continue
        
        const trackingData: any[] = []
        const gameLength = 48 * 60 // 48 minutes in seconds
        
        // Generate tracking data for each player
        for (let t = 0; t < gameLength; t += 10) {
          gameLogs.forEach((log, idx) => {
            const isHome = idx < 5
            const baseX = isHome ? 25 : 69
            const baseY = 25
            
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
        }
        
        // Insert tracking data
        if (trackingData.length > 0) {
          await this.db.upsertBatch('player_tracking_data', trackingData)
          totalTracking += trackingData.length
          console.log(chalk.green(`✓ Generated ${trackingData.length} tracking points for game ${game.id}`))
        }
      }
      
      return totalTracking
    } catch (error) {
      console.error(chalk.red('Error generating tracking data:'), error)
      return 0
    }
  }
  
  /**
   * Show spatial extraction report
   */
  private showSpatialReport() {
    console.log(chalk.cyan.bold('\n✅ Spatial Data Extraction Complete!\n'))
    console.log(chalk.green('Results:'))
    console.log(`  • Shot records: ${this.extractionStats.shots.toLocaleString()}`)
    console.log(`  • Movement patterns: ${this.extractionStats.patterns}`)
    console.log(`  • Player synergies: ${this.extractionStats.synergies}`)
    console.log(`  • Tracking points: ${this.extractionStats.tracking.toLocaleString()}`)
    
    console.log(chalk.yellow('\n📊 Next Steps:'))
    console.log('1. Run xG model training: npx tsx scripts/train-xg-model.ts')
    console.log('2. View in app: http://localhost:3000/spatial-analytics')
    console.log('3. Use in lineup optimizer with spatial toggle ON')
  }
  
  /**
   * Helper: Get typical shot zones by position
   */
  private getPositionShotZones(position: string) {
    const zones = {
      'C': {
        twoPoint: [
          { x: 88, y: 25, distance: 6 },
          { x: 85, y: 20, distance: 10 },
          { x: 85, y: 30, distance: 10 },
        ],
        threePoint: [
          { x: 71, y: 25, distance: 23.75 }
        ]
      },
      'PF': {
        twoPoint: [
          { x: 82, y: 25, distance: 12 },
          { x: 85, y: 18, distance: 10 },
          { x: 85, y: 32, distance: 10 },
        ],
        threePoint: [
          { x: 71, y: 18, distance: 23.75 },
          { x: 71, y: 32, distance: 23.75 },
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

// Run extractor
async function main() {
  const extractor = new SpatialDataExtractorV2()
  await extractor.run()
}

if (require.main === module) {
  main().catch(console.error)
}