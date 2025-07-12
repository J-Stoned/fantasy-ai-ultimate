#!/usr/bin/env tsx
/**
 * MASSIVE SYNERGY EXTRACTION
 * Analyzes ALL available games for comprehensive player synergies
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import * as fs from 'fs'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PlayerSynergy {
  player1_id: number
  player1_name?: string
  player2_id: number  
  player2_name?: string
  games_together: number
  total_fantasy_points: number
  avg_combined_points: number
  wins_together: number
  win_rate: number
  point_boost: number
  consistency_score: number
  best_game: number
  worst_game: number
  synergy_rating: number
}

class MassiveSynergyExtractor {
  private synergies = new Map<string, PlayerSynergy>()
  private playerBaselines = new Map<number, { games: number; total: number; avg: number; name?: string }>()
  private processedGames = 0
  private totalPairs = 0
  
  async extract() {
    console.log(chalk.cyan.bold('\n🚀 MASSIVE SYNERGY EXTRACTION INITIATED!\n'))
    
    try {
      // First, let's see EXACTLY how much data we have
      await this.analyzeDataScope()
      
      // Calculate player baselines
      await this.calculatePlayerBaselines()
      
      // Extract synergies from ALL games
      await this.extractAllSynergies()
      
      // Calculate synergy scores
      await this.calculateSynergyScores()
      
      // Generate comprehensive report
      await this.generateMegaReport()
      
    } catch (error) {
      console.error(chalk.red('Error in massive extraction:'), error)
    }
  }
  
  private async analyzeDataScope() {
    console.log(chalk.yellow('📊 ANALYZING DATA SCOPE...\n'))
    
    // Total games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
    
    const { count: completedGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
    
    // Games with scores (truly analyzable)
    const { count: scoredGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
    
    // Player game logs
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
    
    const { count: logsWithPoints } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('fantasy_points', 'is', null)
    
    // Unique players
    const { count: totalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
    
    console.log(chalk.white('📈 DATABASE STATISTICS:'))
    console.log(chalk.green(`  • Total games: ${totalGames?.toLocaleString()}`))
    console.log(chalk.green(`  • Completed games: ${completedGames?.toLocaleString()}`))
    console.log(chalk.green(`  • Games with scores: ${scoredGames?.toLocaleString()}`))
    console.log(chalk.green(`  • Total player logs: ${totalLogs?.toLocaleString()}`))
    console.log(chalk.green(`  • Logs with fantasy points: ${logsWithPoints?.toLocaleString()}`))
    console.log(chalk.green(`  • Total players: ${totalPlayers?.toLocaleString()}`))
    
    // Estimate potential synergies
    const avgPlayersPerGame = 20 // Approximate
    const potentialPairs = (avgPlayersPerGame * (avgPlayersPerGame - 1)) / 2
    const estimatedTotalPairs = (scoredGames || 0) * potentialPairs
    
    console.log(chalk.yellow(`\n  💎 POTENTIAL SYNERGIES: ${estimatedTotalPairs.toLocaleString()}`))
    console.log(chalk.dim(`     (Based on ~${avgPlayersPerGame} players per game)\n`))
  }
  
  private async calculatePlayerBaselines() {
    console.log(chalk.yellow('🎯 CALCULATING PLAYER BASELINES...\n'))
    
    // Get all player performances
    const batchSize = 10000
    let offset = 0
    let hasMore = true
    
    while (hasMore) {
      const { data: logs, error } = await supabase
        .from('player_game_logs')
        .select(`
          player_id,
          fantasy_points,
          players!inner(name)
        `)
        .not('fantasy_points', 'is', null)
        .range(offset, offset + batchSize - 1)
      
      if (error) {
        console.error(chalk.red('Error fetching logs:'), error)
        break
      }
      
      if (!logs || logs.length === 0) {
        hasMore = false
        break
      }
      
      // Process this batch
      logs.forEach(log => {
        const current = this.playerBaselines.get(log.player_id) || {
          games: 0,
          total: 0,
          avg: 0,
          name: log.players?.name
        }
        
        current.games++
        current.total += log.fantasy_points || 0
        current.avg = current.total / current.games
        current.name = log.players?.name || current.name
        
        this.playerBaselines.set(log.player_id, current)
      })
      
      offset += batchSize
      console.log(chalk.dim(`  Processed ${offset.toLocaleString()} performances...`))
      
      hasMore = logs.length === batchSize
    }
    
    console.log(chalk.green(`✓ Calculated baselines for ${this.playerBaselines.size.toLocaleString()} players\n`))
  }
  
  private async extractAllSynergies() {
    console.log(chalk.yellow('🔥 EXTRACTING SYNERGIES FROM ALL GAMES...\n'))
    
    const batchSize = 100
    let offset = 0
    let hasMore = true
    
    while (hasMore) {
      // Get batch of games
      const { data: games, error } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id, home_score, away_score')
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .range(offset, offset + batchSize - 1)
        .order('start_time', { ascending: false })
      
      if (error || !games || games.length === 0) {
        hasMore = false
        break
      }
      
      // Process each game
      for (const game of games) {
        await this.processGameSynergies(game)
      }
      
      offset += batchSize
      this.processedGames += games.length
      
      if (this.processedGames % 500 === 0) {
        console.log(chalk.green(
          `  ✓ Processed ${this.processedGames.toLocaleString()} games | ` +
          `Found ${this.synergies.size.toLocaleString()} unique pairs | ` +
          `${this.totalPairs.toLocaleString()} total combinations`
        ))
      }
      
      hasMore = games.length === batchSize
    }
    
    console.log(chalk.green.bold(
      `\n✅ EXTRACTION COMPLETE!\n` +
      `   • Games analyzed: ${this.processedGames.toLocaleString()}\n` +
      `   • Unique synergies: ${this.synergies.size.toLocaleString()}\n` +
      `   • Total pair occurrences: ${this.totalPairs.toLocaleString()}\n`
    ))
  }
  
  private async processGameSynergies(game: any) {
    // Get all players from this game
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select(`
        player_id,
        team_id,
        fantasy_points,
        minutes_played,
        players!inner(name)
      `)
      .eq('game_id', game.id)
      .not('fantasy_points', 'is', null)
      .gte('minutes_played', 15) // Only significant playing time
    
    if (!logs || logs.length < 2) return
    
    // Group by team
    const teams = new Map<number, any[]>()
    logs.forEach(log => {
      if (!teams.has(log.team_id)) teams.set(log.team_id, [])
      teams.get(log.team_id)!.push(log)
    })
    
    // Process each team's synergies
    teams.forEach((players, teamId) => {
      const won = (teamId === game.home_team_id && game.home_score > game.away_score) ||
                  (teamId === game.away_team_id && game.away_score > game.home_score)
      
      // Calculate all pairwise synergies
      for (let i = 0; i < players.length - 1; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const p1 = players[i]
          const p2 = players[j]
          const key = [p1.player_id, p2.player_id].sort().join('-')
          
          if (!this.synergies.has(key)) {
            this.synergies.set(key, {
              player1_id: Math.min(p1.player_id, p2.player_id),
              player1_name: p1.player_id < p2.player_id ? p1.players?.name : p2.players?.name,
              player2_id: Math.max(p1.player_id, p2.player_id),
              player2_name: p1.player_id > p2.player_id ? p1.players?.name : p2.players?.name,
              games_together: 0,
              total_fantasy_points: 0,
              avg_combined_points: 0,
              wins_together: 0,
              win_rate: 0,
              point_boost: 0,
              consistency_score: 0,
              best_game: 0,
              worst_game: 999,
              synergy_rating: 0
            })
          }
          
          const synergy = this.synergies.get(key)!
          const combinedPoints = (p1.fantasy_points || 0) + (p2.fantasy_points || 0)
          
          synergy.games_together++
          synergy.total_fantasy_points += combinedPoints
          synergy.avg_combined_points = synergy.total_fantasy_points / synergy.games_together
          
          if (won) synergy.wins_together++
          synergy.win_rate = synergy.wins_together / synergy.games_together
          
          if (combinedPoints > synergy.best_game) synergy.best_game = combinedPoints
          if (combinedPoints < synergy.worst_game) synergy.worst_game = combinedPoints
          
          this.totalPairs++
        }
      }
    })
  }
  
  private calculateSynergyScores() {
    console.log(chalk.yellow('💯 CALCULATING SYNERGY SCORES...\n'))
    
    this.synergies.forEach(synergy => {
      // Get individual baselines
      const p1Baseline = this.playerBaselines.get(synergy.player1_id)
      const p2Baseline = this.playerBaselines.get(synergy.player2_id)
      
      if (!p1Baseline || !p2Baseline) return
      
      // Expected vs actual performance
      const expectedCombined = p1Baseline.avg + p2Baseline.avg
      const actualCombined = synergy.avg_combined_points
      
      // Point boost when playing together
      synergy.point_boost = ((actualCombined - expectedCombined) / expectedCombined) * 100
      
      // Consistency (lower variance is better)
      const range = synergy.best_game - synergy.worst_game
      const avgRange = synergy.avg_combined_points
      synergy.consistency_score = Math.max(0, 100 - (range / avgRange * 50))
      
      // Overall synergy rating (0-100)
      const weights = {
        boost: 0.4,      // 40% - how much better they play together
        winRate: 0.3,    // 30% - winning percentage
        consistency: 0.2, // 20% - consistency of performance
        sample: 0.1      // 10% - sample size confidence
      }
      
      const sampleScore = Math.min(100, synergy.games_together * 5) // Max at 20 games
      
      synergy.synergy_rating = 
        (Math.max(0, Math.min(100, synergy.point_boost + 50)) * weights.boost) +
        (synergy.win_rate * 100 * weights.winRate) +
        (synergy.consistency_score * weights.consistency) +
        (sampleScore * weights.sample)
    })
    
    console.log(chalk.green('✓ Calculated scores for all synergies\n'))
  }
  
  private async generateMegaReport() {
    console.log(chalk.cyan.bold('📊 GENERATING MEGA SYNERGY REPORT...\n'))
    
    // Convert to array and sort
    const allSynergies = Array.from(this.synergies.values())
    const qualitySynergies = allSynergies.filter(s => s.games_together >= 5)
    const eliteSynergies = allSynergies.filter(s => s.games_together >= 10 && s.synergy_rating >= 70)
    
    // Top synergies by rating
    const topByRating = [...qualitySynergies].sort((a, b) => b.synergy_rating - a.synergy_rating).slice(0, 25)
    
    // Top synergies by point boost
    const topByBoost = [...qualitySynergies].sort((a, b) => b.point_boost - a.point_boost).slice(0, 25)
    
    // Most consistent synergies
    const topByConsistency = [...qualitySynergies]
      .filter(s => s.games_together >= 10)
      .sort((a, b) => b.consistency_score - a.consistency_score)
      .slice(0, 25)
    
    // Save detailed report
    const report = {
      metadata: {
        generated: new Date().toISOString(),
        gamesAnalyzed: this.processedGames,
        uniqueSynergies: this.synergies.size,
        totalPairOccurrences: this.totalPairs,
        playersAnalyzed: this.playerBaselines.size,
        qualitySynergies: qualitySynergies.length,
        eliteSynergies: eliteSynergies.length
      },
      topByRating,
      topByBoost,
      topByConsistency,
      eliteSynergies
    }
    
    fs.writeFileSync('synergy-mega-report.json', JSON.stringify(report, null, 2))
    
    // Display highlights
    console.log(chalk.yellow('🏆 TOP 15 SYNERGIES BY RATING:\n'))
    topByRating.slice(0, 15).forEach((s, i) => {
      console.log(chalk.white(
        `${i + 1}. ${s.player1_name || `Player ${s.player1_id}`} + ` +
        `${s.player2_name || `Player ${s.player2_id}`}`
      ))
      console.log(chalk.dim(
        `   Rating: ${s.synergy_rating.toFixed(1)}/100 | ` +
        `${s.games_together} games | ` +
        `${s.win_rate > 0 ? (s.win_rate * 100).toFixed(0) : 0}% wins | ` +
        `+${s.point_boost.toFixed(1)}% boost\n`
      ))
    })
    
    console.log(chalk.yellow('🚀 TOP 10 BY POINT BOOST:\n'))
    topByBoost.slice(0, 10).forEach((s, i) => {
      console.log(chalk.white(
        `${i + 1}. ${s.player1_name || `Player ${s.player1_id}`} + ` +
        `${s.player2_name || `Player ${s.player2_id}`}: ` +
        chalk.green(`+${s.point_boost.toFixed(1)}% boost`) +
        ` (${s.avg_combined_points.toFixed(1)} avg)`
      ))
    })
    
    // Summary statistics
    console.log(chalk.cyan.bold('\n📈 SYNERGY STATISTICS:\n'))
    console.log(chalk.white(`• Total unique synergies: ${this.synergies.size.toLocaleString()}`))
    console.log(chalk.white(`• Quality synergies (5+ games): ${qualitySynergies.length.toLocaleString()}`))
    console.log(chalk.white(`• Elite synergies (10+ games, 70+ rating): ${eliteSynergies.length.toLocaleString()}`))
    console.log(chalk.white(`• Average synergy rating: ${(qualitySynergies.reduce((sum, s) => sum + s.synergy_rating, 0) / qualitySynergies.length).toFixed(1)}`))
    console.log(chalk.white(`• Positive synergies: ${qualitySynergies.filter(s => s.point_boost > 0).length.toLocaleString()} (${(qualitySynergies.filter(s => s.point_boost > 0).length / qualitySynergies.length * 100).toFixed(1)}%)`))
    
    console.log(chalk.green.bold('\n✅ Full report saved to: synergy-mega-report.json\n'))
  }
}

// Run the extraction
async function main() {
  const extractor = new MassiveSynergyExtractor()
  await extractor.extract()
}

if (require.main === module) {
  main().catch(console.error)
}