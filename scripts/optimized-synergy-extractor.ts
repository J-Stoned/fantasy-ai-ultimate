#!/usr/bin/env tsx
/**
 * OPTIMIZED SYNERGY EXTRACTOR
 * Fast and efficient extraction of player synergies
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

interface Synergy {
  player1_id: number
  player1_name: string
  player2_id: number
  player2_name: string
  games_together: number
  total_points: number
  avg_points: number
  wins: number
  win_rate: number
  best_game: number
  synergy_score: number
}

class OptimizedSynergyExtractor {
  private synergies = new Map<string, Synergy>()
  private playerNames = new Map<number, string>()
  private processedGames = 0
  
  async extract() {
    console.log(chalk.cyan.bold('\n⚡ OPTIMIZED SYNERGY EXTRACTION\n'))
    
    try {
      // First load player names for better output
      await this.loadPlayerNames()
      
      // Get all games with fantasy data
      console.log(chalk.yellow('📊 Loading games with fantasy data...\n'))
      
      const { data: games, error } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id, home_score, away_score')
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(2000) // Process top 2000 games for speed
      
      if (error) throw error
      
      console.log(chalk.green(`✓ Found ${games?.length || 0} games to analyze\n`))
      
      // Process games in batches
      const batchSize = 50
      for (let i = 0; i < (games?.length || 0); i += batchSize) {
        const batch = games!.slice(i, i + batchSize)
        await Promise.all(batch.map(game => this.processGame(game)))
        
        this.processedGames += batch.length
        console.log(chalk.dim(`  Processed ${this.processedGames} games...`))
      }
      
      // Generate report
      await this.generateReport()
      
    } catch (error) {
      console.error(chalk.red('Error:'), error)
    }
  }
  
  private async loadPlayerNames() {
    console.log(chalk.yellow('Loading player names...\n'))
    
    const { data: players } = await supabase
      .from('players')
      .select('id, name')
      .limit(10000)
    
    players?.forEach(p => {
      if (p.name) this.playerNames.set(p.id, p.name)
    })
    
    console.log(chalk.green(`✓ Loaded ${this.playerNames.size} player names\n`))
  }
  
  private async processGame(game: any) {
    // Get all players who scored fantasy points in this game
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select('player_id, team_id, fantasy_points')
      .eq('game_id', game.id)
      .gt('fantasy_points', 5) // Only meaningful performances
    
    if (!logs || logs.length < 2) return
    
    // Group by team
    const teams = new Map<number, any[]>()
    logs.forEach(log => {
      if (!teams.has(log.team_id)) teams.set(log.team_id, [])
      teams.get(log.team_id)!.push(log)
    })
    
    // Process each team
    teams.forEach((players, teamId) => {
      if (players.length < 2) return
      
      const won = (teamId === game.home_team_id && game.home_score > game.away_score) ||
                  (teamId === game.away_team_id && game.away_score > game.home_score)
      
      // Calculate synergies for all pairs
      for (let i = 0; i < players.length - 1; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const p1 = players[i]
          const p2 = players[j]
          const key = [p1.player_id, p2.player_id].sort().join('-')
          
          if (!this.synergies.has(key)) {
            this.synergies.set(key, {
              player1_id: Math.min(p1.player_id, p2.player_id),
              player1_name: this.playerNames.get(Math.min(p1.player_id, p2.player_id)) || `Player ${Math.min(p1.player_id, p2.player_id)}`,
              player2_id: Math.max(p1.player_id, p2.player_id),
              player2_name: this.playerNames.get(Math.max(p1.player_id, p2.player_id)) || `Player ${Math.max(p1.player_id, p2.player_id)}`,
              games_together: 0,
              total_points: 0,
              avg_points: 0,
              wins: 0,
              win_rate: 0,
              best_game: 0,
              synergy_score: 0
            })
          }
          
          const synergy = this.synergies.get(key)!
          const combinedPoints = p1.fantasy_points + p2.fantasy_points
          
          synergy.games_together++
          synergy.total_points += combinedPoints
          synergy.avg_points = synergy.total_points / synergy.games_together
          if (won) synergy.wins++
          synergy.win_rate = synergy.wins / synergy.games_together
          
          if (combinedPoints > synergy.best_game) {
            synergy.best_game = combinedPoints
          }
        }
      }
    })
  }
  
  private async generateReport() {
    console.log(chalk.cyan.bold('\n📊 SYNERGY ANALYSIS COMPLETE!\n'))
    
    // Calculate synergy scores
    this.synergies.forEach(synergy => {
      // Simple scoring: combination of average points, win rate, and games played
      const avgScore = Math.min(100, synergy.avg_points / 2) // 50+ avg = 100
      const winScore = synergy.win_rate * 100
      const sampleScore = Math.min(100, synergy.games_together * 10) // 10+ games = 100
      
      synergy.synergy_score = (avgScore * 0.5) + (winScore * 0.3) + (sampleScore * 0.2)
    })
    
    // Convert to array and sort
    const allSynergies = Array.from(this.synergies.values())
    const qualitySynergies = allSynergies.filter(s => s.games_together >= 3)
    const topSynergies = [...qualitySynergies].sort((a, b) => b.synergy_score - a.synergy_score)
    
    // Display top synergies
    console.log(chalk.yellow('🏆 TOP 25 PLAYER SYNERGIES:\n'))
    
    topSynergies.slice(0, 25).forEach((s, i) => {
      console.log(chalk.white(
        `${i + 1}. ${s.player1_name} + ${s.player2_name}`
      ))
      console.log(chalk.dim(
        `   Score: ${s.synergy_score.toFixed(1)}/100 | ` +
        `${s.avg_points.toFixed(1)} avg pts | ` +
        `${s.games_together} games | ` +
        `${(s.win_rate * 100).toFixed(0)}% wins\n`
      ))
    })
    
    // High-scoring combos
    const highScoring = [...qualitySynergies].sort((a, b) => b.avg_points - a.avg_points)
    
    console.log(chalk.yellow('💰 HIGHEST SCORING COMBOS:\n'))
    highScoring.slice(0, 15).forEach((s, i) => {
      console.log(chalk.white(
        `${i + 1}. ${s.player1_name} + ${s.player2_name}: ` +
        chalk.green(`${s.avg_points.toFixed(1)} avg fantasy pts`) +
        ` (${s.games_together} games)`
      ))
    })
    
    // Most frequent pairs
    const frequent = [...qualitySynergies].sort((a, b) => b.games_together - a.games_together)
    
    console.log(chalk.yellow('\n🤝 MOST FREQUENT TEAMMATES:\n'))
    frequent.slice(0, 10).forEach((s, i) => {
      console.log(chalk.white(
        `${i + 1}. ${s.player1_name} + ${s.player2_name}: ` +
        `${s.games_together} games together`
      ))
    })
    
    // Summary stats
    console.log(chalk.cyan.bold('\n📈 SYNERGY SUMMARY:\n'))
    console.log(chalk.white(`• Total unique synergies: ${this.synergies.size.toLocaleString()}`))
    console.log(chalk.white(`• Quality synergies (3+ games): ${qualitySynergies.length.toLocaleString()}`))
    console.log(chalk.white(`• Games analyzed: ${this.processedGames.toLocaleString()}`))
    console.log(chalk.white(`• Average synergy score: ${(qualitySynergies.reduce((sum, s) => sum + s.synergy_score, 0) / qualitySynergies.length).toFixed(1)}/100`))
    
    // Save report
    const report = {
      metadata: {
        generated: new Date().toISOString(),
        gamesAnalyzed: this.processedGames,
        totalSynergies: this.synergies.size,
        qualitySynergies: qualitySynergies.length
      },
      topSynergies: topSynergies.slice(0, 100),
      highScoring: highScoring.slice(0, 50),
      frequent: frequent.slice(0, 50)
    }
    
    fs.writeFileSync('synergy-report.json', JSON.stringify(report, null, 2))
    console.log(chalk.green('\n✅ Full report saved to synergy-report.json'))
    
    // DFS recommendations
    console.log(chalk.cyan.bold('\n💎 DFS STACKING RECOMMENDATIONS:\n'))
    console.log(chalk.green('Cash Games (High Floor):'))
    topSynergies.filter(s => s.games_together >= 5 && s.win_rate >= 0.6).slice(0, 5).forEach(s => {
      console.log(chalk.white(`  • ${s.player1_name} + ${s.player2_name} (${(s.win_rate * 100).toFixed(0)}% wins)`))
    })
    
    console.log(chalk.green('\nGPP Tournaments (High Ceiling):'))
    highScoring.filter(s => s.best_game >= 100).slice(0, 5).forEach(s => {
      console.log(chalk.white(`  • ${s.player1_name} + ${s.player2_name} (${s.best_game.toFixed(0)} pts ceiling)`))
    })
  }
}

// Run extraction
async function main() {
  const extractor = new OptimizedSynergyExtractor()
  await extractor.extract()
}

if (require.main === module) {
  main().catch(console.error)
}