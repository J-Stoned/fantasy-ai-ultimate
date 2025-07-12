#!/usr/bin/env tsx
/**
 * Synergy Insights Report
 * Analyzes player combinations and generates actionable insights
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function generateSynergyReport() {
  console.log(chalk.cyan.bold('\n🔮 PLAYER SYNERGY INSIGHTS REPORT\n'))
  
  try {
    // Get sample of games to analyze synergies
    console.log(chalk.yellow('Analyzing player combinations from recent games...\n'))
    
    const { data: recentGames, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, home_score, away_score')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100)
    
    if (gamesError) throw gamesError
    
    console.log(chalk.green(`✓ Analyzing ${recentGames?.length || 0} recent games\n`))
    
    // Track player combinations
    const playerCombos = new Map<string, {
      games: number
      totalPoints: number
      wins: number
      players: { id: number; name: string }[]
    }>()
    
    // Analyze each game
    for (const game of recentGames || []) {
      const { data: gameLogs } = await supabase
        .from('player_game_logs')
        .select(`
          player_id,
          team_id,
          fantasy_points,
          players!inner(name)
        `)
        .eq('game_id', game.id)
        .not('fantasy_points', 'is', null)
        .gte('fantasy_points', 10) // Focus on impactful performances
      
      if (!gameLogs || gameLogs.length < 2) continue
      
      // Group by team
      const teams = new Map<number, any[]>()
      gameLogs.forEach(log => {
        if (!teams.has(log.team_id)) teams.set(log.team_id, [])
        teams.get(log.team_id)!.push(log)
      })
      
      // Analyze team combinations
      teams.forEach((teamPlayers, teamId) => {
        const won = (teamId === game.home_team_id && game.home_score > game.away_score) ||
                    (teamId === game.away_team_id && game.away_score > game.home_score)
        
        // Look at 2-player and 3-player combos
        // 2-player combos
        for (let i = 0; i < teamPlayers.length - 1; i++) {
          for (let j = i + 1; j < teamPlayers.length; j++) {
            const combo = [teamPlayers[i], teamPlayers[j]]
              .sort((a, b) => a.player_id - b.player_id)
              .map(p => `${p.player_id}:${p.players.name}`)
              .join('|')
            
            if (!playerCombos.has(combo)) {
              playerCombos.set(combo, {
                games: 0,
                totalPoints: 0,
                wins: 0,
                players: combo.split('|').map(p => {
                  const [id, name] = p.split(':')
                  return { id: parseInt(id), name }
                })
              })
            }
            
            const stats = playerCombos.get(combo)!
            stats.games++
            stats.totalPoints += teamPlayers[i].fantasy_points + teamPlayers[j].fantasy_points
            if (won) stats.wins++
          }
        }
      })
    }
    
    // Convert to array and sort by average points
    const combosArray = Array.from(playerCombos.entries())
      .map(([key, value]) => ({
        ...value,
        avgPoints: value.totalPoints / value.games,
        winRate: value.wins / value.games
      }))
      .filter(c => c.games >= 3) // Minimum 3 games together
      .sort((a, b) => b.avgPoints - a.avgPoints)
    
    // Display insights
    console.log(chalk.cyan.bold('🏆 TOP PLAYER COMBINATIONS:\n'))
    
    console.log(chalk.yellow('Based on Average Fantasy Points:\n'))
    combosArray.slice(0, 15).forEach((combo, i) => {
      console.log(chalk.white(
        `${i + 1}. ${combo.players.map(p => p.name).join(' + ')}`
      ))
      console.log(chalk.dim(
        `   ${combo.avgPoints.toFixed(1)} avg pts | ${combo.games} games | ` +
        `${(combo.winRate * 100).toFixed(0)}% win rate\n`
      ))
    })
    
    // High win rate combos
    console.log(chalk.yellow('\nHigh Win Rate Combinations (min 5 games):\n'))
    const highWinRate = combosArray
      .filter(c => c.games >= 5)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 10)
    
    highWinRate.forEach((combo, i) => {
      console.log(chalk.white(
        `${i + 1}. ${combo.players.map(p => p.name).join(' + ')} - ` +
        `${(combo.winRate * 100).toFixed(0)}% wins (${combo.wins}/${combo.games})`
      ))
    })
    
    // Summary statistics
    console.log(chalk.cyan.bold('\n📊 SYNERGY STATISTICS:\n'))
    console.log(chalk.white(`• Total unique combinations analyzed: ${combosArray.length}`))
    console.log(chalk.white(`• Average points for top 10 combos: ${
      combosArray.slice(0, 10).reduce((sum, c) => sum + c.avgPoints, 0) / 10
    .toFixed(1)}`))
    console.log(chalk.white(`• Highest single combo average: ${combosArray[0]?.avgPoints.toFixed(1) || 'N/A'}`))
    
    // Actionable insights
    console.log(chalk.cyan.bold('\n💡 ACTIONABLE INSIGHTS:\n'))
    console.log(chalk.green('1. Stack These Players:'))
    combosArray.slice(0, 5).forEach(combo => {
      console.log(chalk.white(`   • ${combo.players.map(p => p.name).join(' + ')}`))
    })
    
    console.log(chalk.green('\n2. High-Confidence Plays (10+ games):'))
    const highConfidence = combosArray.filter(c => c.games >= 10).slice(0, 5)
    highConfidence.forEach(combo => {
      console.log(chalk.white(
        `   • ${combo.players.map(p => p.name).join(' + ')} ` +
        `(${combo.games} games, ${combo.avgPoints.toFixed(1)} avg)`
      ))
    })
    
    console.log(chalk.green('\n3. Tournament Plays (High Ceiling):'))
    const highCeiling = combosArray
      .filter(c => c.games >= 3)
      .sort((a, b) => b.totalPoints / b.games - a.totalPoints / a.games)
      .slice(0, 5)
    
    highCeiling.forEach(combo => {
      console.log(chalk.white(
        `   • ${combo.players.map(p => p.name).join(' + ')} ` +
        `(${combo.avgPoints.toFixed(1)} avg ceiling)`
      ))
    })
    
  } catch (error) {
    console.error(chalk.red('Error generating synergy report:'), error)
  }
}

// Run the report
if (require.main === module) {
  generateSynergyReport()
    .then(() => {
      console.log(chalk.cyan.bold('\n✅ Synergy report complete!\n'))
    })
    .catch(console.error)
}