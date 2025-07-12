#!/usr/bin/env tsx
/**
 * BATCH FANTASY POINTS CALCULATOR
 * Calculates fantasy points for existing logs with stats
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DFS Scoring Systems
const SCORING = {
  NBA: {
    DraftKings: {
      points: 1,
      rebounds: 1.25,
      assists: 1.5,
      steals: 2,
      blocks: 2,
      turnovers: -0.5,
      threePointers: 0.5,
      doubleDouble: 1.5,
      tripleDouble: 3
    },
    FanDuel: {
      points: 1,
      rebounds: 1.2,
      assists: 1.5,
      steals: 3,
      blocks: 3,
      turnovers: -1,
      threePointers: 0,
      doubleDouble: 0,
      tripleDouble: 0
    }
  },
  NFL: {
    DraftKings: {
      passingYards: 0.04,
      passingTDs: 4,
      interceptions: -1,
      rushingYards: 0.1,
      rushingTDs: 6,
      receptions: 1, // PPR
      receivingYards: 0.1,
      receivingTDs: 6,
      fumbles: -1,
      twoPointConversions: 2,
      kickReturnTDs: 6,
      puntReturnTDs: 6
    }
  },
  MLB: {
    DraftKings: {
      // Hitters
      single: 3,
      double: 5,
      triple: 8,
      homeRun: 10,
      rbi: 2,
      run: 2,
      walk: 2,
      hbp: 2,
      stolenBase: 5,
      caughtStealing: -2,
      // Pitchers
      win: 4,
      earnedRun: -2,
      strikeout: 2,
      inningPitched: 2.25,
      hit: -0.6,
      walk_allowed: -0.6,
      hitBatsman: -0.6,
      completeGame: 2.5,
      cgShutout: 2.5,
      noHitter: 5
    }
  }
}

class FantasyPointsCalculator {
  private processed = 0
  private updated = 0
  private errors = 0
  
  async calculate() {
    console.log(chalk.cyan.bold('\n💰 BATCH FANTASY POINTS CALCULATOR\n'))
    
    try {
      // Get logs with stats but no fantasy points
      console.log(chalk.yellow('Finding logs needing fantasy points...\n'))
      
      const batchSize = 1000
      let hasMore = true
      let offset = 0
      
      while (hasMore) {
        const { data: logs, error } = await supabase
          .from('player_game_logs')
          .select(`
            id,
            player_id,
            game_id,
            stats,
            sport,
            fantasy_points
          `)
          .not('stats', 'is', null)
          .or('fantasy_points.is.null,fantasy_points.eq.0')
          .range(offset, offset + batchSize - 1)
        
        if (error || !logs || logs.length === 0) {
          hasMore = false
          break
        }
        
        console.log(chalk.dim(`Processing batch ${Math.floor(offset / batchSize) + 1}...`))
        
        // Calculate fantasy points for each log
        const updates = []
        for (const log of logs) {
          const points = this.calculateFantasyPoints(log.stats, log.sport)
          if (points > 0) {
            updates.push({
              id: log.id,
              fantasy_points: points
            })
          }
        }
        
        // Batch update
        if (updates.length > 0) {
          for (let i = 0; i < updates.length; i += 100) {
            const batch = updates.slice(i, i + 100)
            
            for (const update of batch) {
              const { error: updateError } = await supabase
                .from('player_game_logs')
                .update({ fantasy_points: update.fantasy_points })
                .eq('id', update.id)
              
              if (updateError) {
                this.errors++
              } else {
                this.updated++
              }
            }
          }
        }
        
        this.processed += logs.length
        console.log(chalk.green(`✓ Processed: ${this.processed} | Updated: ${this.updated}`))
        
        offset += batchSize
        hasMore = logs.length === batchSize
      }
      
      // Summary
      console.log(chalk.cyan.bold('\n✅ CALCULATION COMPLETE!\n'))
      console.log(chalk.white(`• Logs processed: ${this.processed.toLocaleString()}`))
      console.log(chalk.green(`• Fantasy points added: ${this.updated.toLocaleString()}`))
      console.log(chalk.red(`• Errors: ${this.errors}`))
      
      const successRate = this.processed > 0 ? (this.updated / this.processed * 100).toFixed(1) : 0
      console.log(chalk.yellow(`• Success rate: ${successRate}%`))
      
    } catch (error) {
      console.error(chalk.red('Error:'), error)
    }
  }
  
  private calculateFantasyPoints(stats: any, sport?: string): number {
    if (!stats || typeof stats !== 'object') return 0
    
    // Detect sport from stats structure if not provided
    const detectedSport = sport || this.detectSport(stats)
    
    switch (detectedSport) {
      case 'NBA':
      case 'basketball':
        return this.calculateNBAPoints(stats)
      
      case 'NFL':
      case 'football':
        return this.calculateNFLPoints(stats)
      
      case 'MLB':
      case 'baseball':
        return this.calculateMLBPoints(stats)
      
      default:
        // Generic calculation
        return this.calculateGenericPoints(stats)
    }
  }
  
  private detectSport(stats: any): string {
    // NBA indicators
    if ('rebounds' in stats || 'assists' in stats || 'blocks' in stats) {
      return 'NBA'
    }
    
    // NFL indicators
    if ('passing_yards' in stats || 'rushing_yards' in stats || 'receiving_yards' in stats) {
      return 'NFL'
    }
    
    // MLB indicators
    if ('at_bats' in stats || 'hits' in stats || 'innings_pitched' in stats) {
      return 'MLB'
    }
    
    return 'unknown'
  }
  
  private calculateNBAPoints(stats: any): number {
    const scoring = SCORING.NBA.DraftKings
    
    let points = 0
    points += (stats.points || 0) * scoring.points
    points += (stats.rebounds || stats.total_rebounds || 0) * scoring.rebounds
    points += (stats.assists || 0) * scoring.assists
    points += (stats.steals || 0) * scoring.steals
    points += (stats.blocks || 0) * scoring.blocks
    points += (stats.turnovers || 0) * scoring.turnovers
    points += (stats.three_pointers_made || stats.fg3m || 0) * scoring.threePointers
    
    // Bonus for double-double/triple-double
    const doubleCount = [
      stats.points >= 10,
      (stats.rebounds || stats.total_rebounds || 0) >= 10,
      stats.assists >= 10,
      stats.steals >= 10,
      stats.blocks >= 10
    ].filter(Boolean).length
    
    if (doubleCount >= 3) {
      points += scoring.tripleDouble
    } else if (doubleCount >= 2) {
      points += scoring.doubleDouble
    }
    
    return Math.round(points * 100) / 100
  }
  
  private calculateNFLPoints(stats: any): number {
    const scoring = SCORING.NFL.DraftKings
    
    let points = 0
    
    // Passing
    points += (stats.passing_yards || 0) * scoring.passingYards
    points += (stats.passing_touchdowns || stats.passing_tds || 0) * scoring.passingTDs
    points += (stats.interceptions || 0) * scoring.interceptions
    
    // Rushing
    points += (stats.rushing_yards || 0) * scoring.rushingYards
    points += (stats.rushing_touchdowns || stats.rushing_tds || 0) * scoring.rushingTDs
    
    // Receiving
    points += (stats.receptions || stats.catches || 0) * scoring.receptions
    points += (stats.receiving_yards || 0) * scoring.receivingYards
    points += (stats.receiving_touchdowns || stats.receiving_tds || 0) * scoring.receivingTDs
    
    // Other
    points += (stats.fumbles_lost || 0) * scoring.fumbles
    points += (stats.two_point_conversions || 0) * scoring.twoPointConversions
    
    return Math.round(points * 100) / 100
  }
  
  private calculateMLBPoints(stats: any): number {
    const scoring = SCORING.MLB.DraftKings
    
    let points = 0
    
    // Hitting stats
    if (stats.at_bats > 0) {
      const hits = stats.hits || 0
      const doubles = stats.doubles || 0
      const triples = stats.triples || 0
      const homers = stats.home_runs || 0
      const singles = hits - doubles - triples - homers
      
      points += singles * scoring.single
      points += doubles * scoring.double
      points += triples * scoring.triple
      points += homers * scoring.homeRun
      points += (stats.rbis || stats.rbi || 0) * scoring.rbi
      points += (stats.runs || 0) * scoring.run
      points += (stats.walks || stats.bb || 0) * scoring.walk
      points += (stats.hit_by_pitch || stats.hbp || 0) * scoring.hbp
      points += (stats.stolen_bases || stats.sb || 0) * scoring.stolenBase
      points += (stats.caught_stealing || stats.cs || 0) * scoring.caughtStealing
    }
    
    // Pitching stats
    if (stats.innings_pitched > 0) {
      points += (stats.wins || 0) * scoring.win
      points += (stats.earned_runs || 0) * scoring.earnedRun
      points += (stats.strikeouts || stats.so || 0) * scoring.strikeout
      points += (stats.innings_pitched || 0) * scoring.inningPitched
      points += (stats.hits_allowed || 0) * scoring.hit
      points += (stats.walks_allowed || stats.bb_allowed || 0) * scoring.walk_allowed
    }
    
    return Math.round(points * 100) / 100
  }
  
  private calculateGenericPoints(stats: any): number {
    // Generic scoring based on common stats
    let points = 0
    
    // Use existing fantasy_points if available
    if (stats.fantasy_points) {
      return stats.fantasy_points
    }
    
    // Otherwise try to calculate from common fields
    points += (stats.points || 0) * 1
    points += (stats.goals || 0) * 3
    points += (stats.assists || 0) * 2
    points += (stats.saves || 0) * 0.5
    points += (stats.tackles || 0) * 1
    points += (stats.sacks || 0) * 2
    
    return Math.round(points * 100) / 100
  }
}

// Run calculator
async function main() {
  const calculator = new FantasyPointsCalculator()
  await calculator.calculate()
}

if (require.main === module) {
  main().catch(console.error)
}