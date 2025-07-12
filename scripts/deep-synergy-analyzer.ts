#!/usr/bin/env tsx
/**
 * Deep Player Synergy Analyzer
 * Extracts comprehensive player synergies from entire database
 * Analyzes ALL games for maximum insight
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

export class DeepSynergyAnalyzer {
  private synergyMap = new Map<string, SynergyData>()
  private playerPerformance = new Map<number, { games: number; totalPoints: number; avgPoints: number }>()
  
  async analyze() {
    console.log(chalk.cyan.bold('\n🔮 DEEP PLAYER SYNERGY ANALYSIS\n'))
    console.log(chalk.yellow('Analyzing ENTIRE database for player synergies...\n'))
    
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
      const batchSize = 100
      
      for (let i = 0; i < (games?.length || 0); i += batchSize) {
        const batch = games!.slice(i, i + batchSize)
        
        for (const game of batch) {
          await this.analyzeGameSynergies(game)
          processedGames++
          
          if (processedGames % 500 === 0) {
            console.log(chalk.dim(`  Processed ${processedGames}/${games?.length} games...`))
          }
        }
      }
      
      // Step 4: Calculate synergy scores
      console.log(chalk.yellow('\n4. Calculating synergy scores...'))
      this.calculateSynergyScores()
      
      // Step 5: Filter and rank synergies
      console.log(chalk.yellow('\n5. Filtering high-value synergies...'))
      const topSynergies = this.getTopSynergies()
      
      // Step 6: Insert synergies into database
      console.log(chalk.yellow(`\n6. Inserting ${topSynergies.length} synergies into database...`))
      await this.insertSynergies(topSynergies)
      
      // Step 7: Generate insights
      console.log(chalk.cyan.bold('\n✨ SYNERGY ANALYSIS COMPLETE!\n'))
      this.generateInsights(topSynergies)
      
      return topSynergies.length
      
    } catch (error) {
      console.error(chalk.red('Error in deep synergy analysis:'), error)
      return 0
    }
  }
  
  private async calculatePlayerBaselines() {
    const { data: playerStats } = await supabase
      .from('player_game_logs')
      .select('player_id, fantasy_points')
      .not('fantasy_points', 'is', null)
    
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
  
  private async analyzeGameSynergies(game: any) {
    // Get all players who played in this game
    const { data: gameLogs } = await supabase
      .from('player_game_logs')
      .select(`
        player_id,
        team_id,
        fantasy_points,
        stats,
        minutes_played,
        players!inner(name, position)
      `)
      .eq('game_id', game.id)
      .not('fantasy_points', 'is', null)
      .gte('minutes_played', 10) // Only players who played significant minutes
    
    if (!gameLogs || gameLogs.length < 2) return
    
    // Group by team
    const teams = new Map<number, any[]>()
    gameLogs.forEach(log => {
      if (!teams.has(log.team_id)) teams.set(log.team_id, [])
      teams.get(log.team_id)!.push(log)
    })
    
    // Analyze synergies within each team
    teams.forEach((teamPlayers, teamId) => {
      const won = (teamId === game.home_team_id && game.home_score > game.away_score) ||
                  (teamId === game.away_team_id && game.away_score > game.home_score)
      
      // Calculate pairwise synergies
      for (let i = 0; i < teamPlayers.length - 1; i++) {
        for (let j = i + 1; j < teamPlayers.length; j++) {
          const p1 = teamPlayers[i]
          const p2 = teamPlayers[j]
          
          // Skip if same position (less likely to have synergy)
          if (p1.players?.position === p2.players?.position) continue
          
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
                                   (p1Stats.blocks || 0) + (p2Stats.blocks || 0)
            
            if (defensiveStats > offensiveStats * 0.3) {
              synergy.synergy_type = 'defensive'
            } else if (offensiveStats > 0 && defensiveStats > 0) {
              synergy.synergy_type = 'balanced'
            }
          }
        }
      }
    })
  }
  
  private calculateSynergyScores() {
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
      const performanceBoost = synergy.point_differential / expectedCombined
      const winRate = synergy.wins_together / synergy.games_together
      const consistency = 1 - ((synergy.best_game_together - synergy.worst_game_together) / actualCombined)
      
      synergy.synergy_score = Math.min(100, Math.max(0,
        (performanceBoost * 40) +     // 40% weight on performance boost
        (winRate * 30) +              // 30% weight on win rate
        (consistency * 20) +          // 20% weight on consistency
        (Math.min(synergy.games_together / 20, 1) * 10) // 10% weight on sample size
      ))
      
      // Confidence based on sample size
      synergy.confidence = Math.min(1, synergy.games_together / 30)
      synergy.sample_size = synergy.games_together
    })
  }
  
  private getTopSynergies(): SynergyData[] {
    // Convert map to array and filter
    const allSynergies = Array.from(this.synergyMap.values())
    
    return allSynergies
      .filter(s => 
        s.games_together >= 5 &&              // Minimum 5 games together
        s.synergy_score > 50 &&               // Above average synergy
        s.confidence > 0.2                    // Decent confidence level
      )
      .sort((a, b) => b.synergy_score - a.synergy_score)
      .slice(0, 10000) // Top 10,000 synergies
  }
  
  private async insertSynergies(synergies: SynergyData[]) {
    // Clear existing synergies first
    const { error: deleteError } = await supabase
      .from('player_synergies')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')
    
    if (deleteError) {
      console.error(chalk.red('Error clearing old synergies:'), deleteError)
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
        console.error(chalk.red(`Error inserting batch ${i / batchSize}:`), error)
      } else {
        inserted += batch.length
        console.log(chalk.green(`✓ Inserted ${inserted}/${synergies.length} synergies`))
      }
    }
  }
  
  private generateInsights(synergies: SynergyData[]) {
    console.log(chalk.white('📊 SYNERGY INSIGHTS:\n'))
    
    // Top 10 synergies
    console.log(chalk.yellow('🏆 TOP 10 PLAYER SYNERGIES:'))
    synergies.slice(0, 10).forEach((s, i) => {
      console.log(chalk.white(
        `${i + 1}. Players ${s.player1_id} + ${s.player2_id}: ` +
        `${s.synergy_score.toFixed(1)}/100 (${s.games_together} games, ` +
        `+${s.point_differential.toFixed(1)} pts/game)`
      ))
    })
    
    // Summary stats
    const avgSynergyScore = synergies.reduce((sum, s) => sum + s.synergy_score, 0) / synergies.length
    const totalGamesAnalyzed = synergies.reduce((sum, s) => sum + s.games_together, 0)
    
    console.log(chalk.cyan('\n📈 SUMMARY STATISTICS:'))
    console.log(chalk.white(`• Total synergies found: ${synergies.length}`))
    console.log(chalk.white(`• Average synergy score: ${avgSynergyScore.toFixed(1)}/100`))
    console.log(chalk.white(`• Total games analyzed: ${totalGamesAnalyzed}`))
    console.log(chalk.white(`• Players analyzed: ${this.playerPerformance.size}`))
    
    // Synergy type breakdown
    const typeBreakdown = {
      offensive: synergies.filter(s => s.synergy_type === 'offensive').length,
      defensive: synergies.filter(s => s.synergy_type === 'defensive').length,
      balanced: synergies.filter(s => s.synergy_type === 'balanced').length
    }
    
    console.log(chalk.cyan('\n🎯 SYNERGY TYPES:'))
    console.log(chalk.white(`• Offensive synergies: ${typeBreakdown.offensive} (${(typeBreakdown.offensive / synergies.length * 100).toFixed(1)}%)`))
    console.log(chalk.white(`• Defensive synergies: ${typeBreakdown.defensive} (${(typeBreakdown.defensive / synergies.length * 100).toFixed(1)}%)`))
    console.log(chalk.white(`• Balanced synergies: ${typeBreakdown.balanced} (${(typeBreakdown.balanced / synergies.length * 100).toFixed(1)}%)`))
  }
}

// Main execution
async function main() {
  const analyzer = new DeepSynergyAnalyzer()
  const synergyCount = await analyzer.analyze()
  
  console.log(chalk.green.bold(`\n✅ Analysis complete! ${synergyCount} high-value synergies identified.\n`))
  console.log(chalk.yellow('Next steps:'))
  console.log('1. View synergies in the spatial analytics dashboard')
  console.log('2. Use synergy data in lineup optimizer')
  console.log('3. Create synergy-based player stacks')
}

if (require.main === module) {
  main().catch(console.error)
}