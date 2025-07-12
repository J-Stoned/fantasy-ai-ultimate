#!/usr/bin/env tsx
/**
 * Enhanced Player Synergy Analyzer
 * Analyzes player synergies from all available game data
 * Works with current database structure
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SynergyData {
  player1_id: number
  player2_id: number
  games_together: number
  wins_together: number
  total_fantasy_points: number
  avg_fantasy_points: number
  point_differential: number
  synergy_score: number
  synergy_type: 'offensive' | 'defensive' | 'balanced'
  season: number
  sample_size: number
  confidence: number
  best_game_together: number
  worst_game_together: number
}

export class EnhancedSynergyAnalyzer {
  private synergyMap = new Map<string, SynergyData>()
  private playerPerformance = new Map<number, { games: number; totalPoints: number; avgPoints: number }>()
  
  async analyze() {
    console.log(chalk.cyan.bold('\n🔮 ENHANCED PLAYER SYNERGY ANALYSIS\n'))
    console.log(chalk.yellow('Analyzing ALL games for player synergies...\n'))
    
    try {
      // Step 1: Get all completed games
      console.log(chalk.yellow('1. Loading all completed games...'))
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id, home_score, away_score, sport, start_time')
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false })
      
      if (gamesError) throw gamesError
      
      console.log(chalk.green(`✓ Found ${games?.length || 0} completed games to analyze`))
      
      // Step 2: Calculate individual player baselines
      console.log(chalk.yellow('\n2. Calculating player baselines...'))
      await this.calculatePlayerBaselines()
      
      // Step 3: Analyze synergies game by game
      console.log(chalk.yellow('\n3. Analyzing player synergies...'))
      let processedGames = 0
      let totalSynergiesFound = 0
      const batchSize = 50
      
      for (let i = 0; i < (games?.length || 0); i += batchSize) {
        const batch = games!.slice(i, i + batchSize)
        
        for (const game of batch) {
          const synergiesInGame = await this.analyzeGameSynergies(game)
          totalSynergiesFound += synergiesInGame
          processedGames++
          
          if (processedGames % 100 === 0) {
            console.log(chalk.dim(`  Processed ${processedGames}/${games?.length} games... (${totalSynergiesFound} synergy pairs found)`))
          }
        }
      }
      
      console.log(chalk.green(`✓ Total synergy pairs analyzed: ${totalSynergiesFound}`))
      
      // Step 4: Calculate synergy scores
      console.log(chalk.yellow('\n4. Calculating synergy scores...'))
      this.calculateSynergyScores()
      
      // Step 5: Filter and rank synergies
      console.log(chalk.yellow('\n5. Filtering high-value synergies...'))
      const topSynergies = this.getTopSynergies()
      
      // Step 6: Clear existing and insert new synergies
      console.log(chalk.yellow(`\n6. Updating database with ${topSynergies.length} synergies...`))
      await this.updateSynergies(topSynergies)
      
      // Step 7: Generate insights
      console.log(chalk.cyan.bold('\n✨ SYNERGY ANALYSIS COMPLETE!\n'))
      this.generateInsights(topSynergies)
      
      return topSynergies.length
      
    } catch (error) {
      console.error(chalk.red('Error in synergy analysis:'), error)
      return 0
    }
  }
  
  private async calculatePlayerBaselines() {
    const { data: playerStats, error } = await supabase
      .from('player_game_logs')
      .select('player_id, fantasy_points')
      .not('fantasy_points', 'is', null)
      .gt('fantasy_points', 0) // Only positive fantasy points
    
    if (error) {
      console.error(chalk.red('Error fetching player stats:'), error)
      return
    }
    
    if (!playerStats) return
    
    // Calculate each player's average performance
    playerStats.forEach(stat => {
      const current = this.playerPerformance.get(stat.player_id) || { games: 0, totalPoints: 0, avgPoints: 0 }
      current.games++
      current.totalPoints += stat.fantasy_points || 0
      current.avgPoints = current.totalPoints / current.games
      this.playerPerformance.set(stat.player_id, current)
    })
    
    console.log(chalk.green(`✓ Calculated baselines for ${this.playerPerformance.size} players`))
  }
  
  private async analyzeGameSynergies(game: any): Promise<number> {
    // Get all players who played in this game with positive fantasy points
    const { data: gameLogs, error } = await supabase
      .from('player_game_logs')
      .select(`
        player_id,
        team_id,
        fantasy_points,
        stats,
        players!inner(name, position)
      `)
      .eq('game_id', game.id)
      .not('fantasy_points', 'is', null)
      .gt('fantasy_points', 0) // Only players with positive contribution
    
    if (error || !gameLogs || gameLogs.length < 2) return 0
    
    // Group by team (handle null team_id)
    const teams = new Map<string, any[]>()
    
    gameLogs.forEach(log => {
      // If team_id is null, try to determine from game
      let teamKey = log.team_id?.toString() || 'unknown'
      
      if (!teams.has(teamKey)) teams.set(teamKey, [])
      teams.get(teamKey)!.push(log)
    })
    
    let synergiesFound = 0
    
    // Analyze synergies within each team
    teams.forEach((teamPlayers, teamKey) => {
      if (teamPlayers.length < 2) return
      
      // Determine if team won (handle unknown teams conservatively)
      const teamId = parseInt(teamKey)
      const won = !isNaN(teamId) && (
        (teamId === game.home_team_id && game.home_score > game.away_score) ||
        (teamId === game.away_team_id && game.away_score > game.home_score)
      )
      
      // Calculate pairwise synergies
      for (let i = 0; i < teamPlayers.length - 1; i++) {
        for (let j = i + 1; j < teamPlayers.length; j++) {
          const p1 = teamPlayers[i]
          const p2 = teamPlayers[j]
          
          // Create a unique key for this player pair
          const key = [p1.player_id, p2.player_id].sort().join('-')
          
          if (!this.synergyMap.has(key)) {
            this.synergyMap.set(key, {
              player1_id: Math.min(p1.player_id, p2.player_id),
              player2_id: Math.max(p1.player_id, p2.player_id),
              games_together: 0,
              wins_together: 0,
              total_fantasy_points: 0,
              avg_fantasy_points: 0,
              point_differential: 0,
              synergy_score: 0,
              synergy_type: 'offensive',
              season: new Date(game.start_time).getFullYear(),
              sample_size: 0,
              confidence: 0,
              best_game_together: 0,
              worst_game_together: 999
            })
          }
          
          const synergy = this.synergyMap.get(key)!
          synergy.games_together++
          if (won) synergy.wins_together++
          
          const combinedPoints = (p1.fantasy_points || 0) + (p2.fantasy_points || 0)
          synergy.total_fantasy_points += combinedPoints
          synergy.avg_fantasy_points = synergy.total_fantasy_points / synergy.games_together
          
          // Track best/worst performances
          if (combinedPoints > synergy.best_game_together) {
            synergy.best_game_together = combinedPoints
          }
          if (combinedPoints < synergy.worst_game_together) {
            synergy.worst_game_together = combinedPoints
          }
          
          // Determine synergy type based on stats
          const p1Stats = p1.stats as any
          const p2Stats = p2.stats as any
          
          if (p1Stats && p2Stats) {
            const offensiveStats = (p1Stats.points || 0) + (p2Stats.points || 0) + 
                                   (p1Stats.assists || 0) + (p2Stats.assists || 0)
            const defensiveStats = (p1Stats.steals || 0) + (p2Stats.steals || 0) + 
                                   (p1Stats.blocks || 0) + (p2Stats.blocks || 0) +
                                   (p1Stats.rebounds || 0) + (p2Stats.rebounds || 0)
            
            if (defensiveStats > offensiveStats * 0.4) {
              synergy.synergy_type = 'defensive'
            } else if (offensiveStats > 0 && defensiveStats > 0) {
              synergy.synergy_type = 'balanced'
            }
          }
          
          synergiesFound++
        }
      }
    })
    
    return synergiesFound
  }
  
  private calculateSynergyScores() {
    let calculated = 0
    
    this.synergyMap.forEach((synergy, key) => {
      // Get individual player baselines
      const p1Baseline = this.playerPerformance.get(synergy.player1_id)
      const p2Baseline = this.playerPerformance.get(synergy.player2_id)
      
      if (!p1Baseline || !p2Baseline) return
      
      // Expected combined performance
      const expectedCombined = p1Baseline.avgPoints + p2Baseline.avgPoints
      
      // Actual performance together
      const actualCombined = synergy.avg_fantasy_points
      
      // Synergy differential (positive = they perform better together)
      synergy.point_differential = actualCombined - expectedCombined
      
      // Calculate synergy score (0-100 scale)
      const performanceBoost = expectedCombined > 0 ? synergy.point_differential / expectedCombined : 0
      const winRate = synergy.games_together > 0 ? synergy.wins_together / synergy.games_together : 0
      const consistency = synergy.best_game_together > synergy.worst_game_together ? 
        1 - ((synergy.best_game_together - synergy.worst_game_together) / (actualCombined + 1)) : 0
      
      synergy.synergy_score = Math.min(100, Math.max(0,
        50 + // Base score
        (performanceBoost * 100) +     // Performance boost can add/subtract significantly
        (winRate * 20) +               // Win rate adds up to 20 points
        (consistency * 10) +           // Consistency adds up to 10 points
        (Math.min(synergy.games_together / 10, 1) * 20) // Sample size adds up to 20 points
      ))
      
      // Confidence based on sample size
      synergy.confidence = Math.min(1, synergy.games_together / 20)
      synergy.sample_size = synergy.games_together
      
      calculated++
    })
    
    console.log(chalk.green(`✓ Calculated scores for ${calculated} synergy pairs`))
  }
  
  private getTopSynergies(): SynergyData[] {
    // Convert map to array and filter
    const allSynergies = Array.from(this.synergyMap.values())
    
    return allSynergies
      .filter(s => 
        s.games_together >= 3 &&              // Minimum 3 games together
        s.synergy_score > 40 &&               // Above minimum threshold
        s.avg_fantasy_points > 10             // Meaningful fantasy production
      )
      .sort((a, b) => b.synergy_score - a.synergy_score)
      .slice(0, 50000) // Top 50,000 synergies
  }
  
  private async updateSynergies(synergies: SynergyData[]) {
    try {
      // First, clear existing synergies
      const { error: deleteError } = await supabase
        .from('player_synergies')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000')
      
      if (deleteError) {
        console.log(chalk.yellow('Note: Could not clear old synergies (table might be empty)'))
      }
      
      // Insert in batches
      const batchSize = 500
      let inserted = 0
      
      for (let i = 0; i < synergies.length; i += batchSize) {
        const batch = synergies.slice(i, i + batchSize)
        
        const { error } = await supabase
          .from('player_synergies')
          .insert(batch)
        
        if (error) {
          console.error(chalk.red(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`), error)
        } else {
          inserted += batch.length
          if (inserted % 2000 === 0 || inserted === synergies.length) {
            console.log(chalk.green(`✓ Inserted ${inserted}/${synergies.length} synergies`))
          }
        }
      }
      
      return inserted
    } catch (error) {
      console.error(chalk.red('Error updating synergies:'), error)
      return 0
    }
  }
  
  private generateInsights(synergies: SynergyData[]) {
    console.log(chalk.white('📊 SYNERGY INSIGHTS:\n'))
    
    if (synergies.length === 0) {
      console.log(chalk.yellow('No synergies found. This might indicate:'))
      console.log('- Not enough games with multiple players on same team')
      console.log('- Missing fantasy_points data')
      console.log('- Data quality issues')
      return
    }
    
    // Top 20 synergies
    console.log(chalk.yellow('🏆 TOP 20 PLAYER SYNERGIES:'))
    synergies.slice(0, 20).forEach((s, i) => {
      console.log(chalk.white(
        `${i + 1}. Players ${s.player1_id} + ${s.player2_id}: ` +
        `Score: ${s.synergy_score.toFixed(1)}/100, ` +
        `Games: ${s.games_together}, ` +
        `Avg: ${s.avg_fantasy_points.toFixed(1)} pts, ` +
        `Boost: ${s.point_differential > 0 ? '+' : ''}${s.point_differential.toFixed(1)} pts`
      ))
    })
    
    // Summary stats
    const avgSynergyScore = synergies.reduce((sum, s) => sum + s.synergy_score, 0) / synergies.length
    const totalGamesAnalyzed = synergies.reduce((sum, s) => sum + s.games_together, 0)
    const positiveSynergies = synergies.filter(s => s.point_differential > 0).length
    
    console.log(chalk.cyan('\n📈 SUMMARY STATISTICS:'))
    console.log(chalk.white(`• Total synergies found: ${synergies.length.toLocaleString()}`))
    console.log(chalk.white(`• Average synergy score: ${avgSynergyScore.toFixed(1)}/100`))
    console.log(chalk.white(`• Total synergy games: ${totalGamesAnalyzed.toLocaleString()}`))
    console.log(chalk.white(`• Positive synergies: ${positiveSynergies.toLocaleString()} (${(positiveSynergies / synergies.length * 100).toFixed(1)}%)`))
    console.log(chalk.white(`• Players analyzed: ${this.playerPerformance.size.toLocaleString()}`))
    
    // Synergy type breakdown
    const typeBreakdown = {
      offensive: synergies.filter(s => s.synergy_type === 'offensive').length,
      defensive: synergies.filter(s => s.synergy_type === 'defensive').length,
      balanced: synergies.filter(s => s.synergy_type === 'balanced').length
    }
    
    console.log(chalk.cyan('\n🎯 SYNERGY TYPES:'))
    console.log(chalk.white(`• Offensive synergies: ${typeBreakdown.offensive.toLocaleString()} (${(typeBreakdown.offensive / synergies.length * 100).toFixed(1)}%)`))
    console.log(chalk.white(`• Defensive synergies: ${typeBreakdown.defensive.toLocaleString()} (${(typeBreakdown.defensive / synergies.length * 100).toFixed(1)}%)`))
    console.log(chalk.white(`• Balanced synergies: ${typeBreakdown.balanced.toLocaleString()} (${(typeBreakdown.balanced / synergies.length * 100).toFixed(1)}%)`))
    
    // High-confidence synergies
    const highConfidence = synergies.filter(s => s.confidence > 0.8).length
    console.log(chalk.cyan('\n🎯 CONFIDENCE LEVELS:'))
    console.log(chalk.white(`• High confidence (80%+): ${highConfidence.toLocaleString()} synergies`))
    console.log(chalk.white(`• Based on 16+ games together`))
  }
}

// Main execution
async function main() {
  const analyzer = new EnhancedSynergyAnalyzer()
  const synergyCount = await analyzer.analyze()
  
  console.log(chalk.green.bold(`\n✅ Analysis complete! ${synergyCount.toLocaleString()} high-value synergies identified.\n`))
  
  if (synergyCount > 0) {
    console.log(chalk.yellow('Next steps:'))
    console.log('1. Run: npx tsx scripts/check-synergies.ts to verify data')
    console.log('2. View synergies in the spatial analytics dashboard')
    console.log('3. Use synergy data in lineup optimizer')
    console.log('4. Create synergy-based player stacks')
  }
}

if (require.main === module) {
  main().catch(console.error)
}