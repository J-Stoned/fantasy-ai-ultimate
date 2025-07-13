#!/usr/bin/env tsx
/**
 * Check current player synergies in database
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSynergies() {
  console.log(chalk.cyan.bold('\n🔍 Checking Player Synergies Database\n'))
  
  // Count total synergies
  const { count, error: countError } = await supabase
    .from('player_synergies')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error(chalk.red('Error counting synergies:'), countError)
    return
  }
  
  console.log(chalk.yellow('Total synergies in database:'), chalk.green(count || 0))
  
  // Get sample of top synergies (without joins for now)
  const { data: topSynergies, error } = await supabase
    .from('player_synergies')
    .select('*')
    .order('synergy_score', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error(chalk.red('Error fetching synergies:'), error)
    return
  }
  
  if (topSynergies && topSynergies.length > 0) {
    console.log(chalk.yellow('\n🏆 Top 10 synergies by score:'))
    topSynergies.forEach((s, i) => {
      console.log(chalk.white(
        `${i+1}. Player ${s.player1_id} + Player ${s.player2_id}: ` +
        `Score ${s.synergy_score?.toFixed(2)}, ` +
        `Games: ${s.sample_size || 0}, ` +
        `Type: ${s.synergy_type}`
      ))
    })
  }
  
  // Check synergy types distribution
  const { data: types } = await supabase
    .from('player_synergies')
    .select('synergy_type')
  
  if (types && types.length > 0) {
    const typeCounts = types.reduce((acc, curr) => {
      acc[curr.synergy_type] = (acc[curr.synergy_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(chalk.yellow('\n📊 Synergy type distribution:'))
    Object.entries(typeCounts).forEach(([type, count]) => {
      const percentage = ((count / types.length) * 100).toFixed(1)
      console.log(chalk.white(`• ${type}: ${count} (${percentage}%)`))
    })
  }
  
  // Check games coverage
  const { data: synergiesWithGames } = await supabase
    .from('player_synergies')
    .select('sample_size')
    .not('sample_size', 'is', null)
  
  if (synergiesWithGames && synergiesWithGames.length > 0) {
    const totalGames = synergiesWithGames.reduce((sum, s) => sum + (s.sample_size || 0), 0)
    const avgGamesPerSynergy = totalGames / synergiesWithGames.length
    
    console.log(chalk.yellow('\n📈 Games coverage:'))
    console.log(chalk.white(`• Total games analyzed: ${totalGames}`))
    console.log(chalk.white(`• Average games per synergy: ${avgGamesPerSynergy.toFixed(1)}`))
  }
  
  // Check for recent updates
  const { data: recentSynergies } = await supabase
    .from('player_synergies')
    .select('last_calculated')
    .order('last_calculated', { ascending: false })
    .limit(1)
  
  if (recentSynergies && recentSynergies.length > 0) {
    console.log(chalk.yellow('\n⏰ Last update:'), chalk.white(new Date(recentSynergies[0].last_calculated).toLocaleString()))
  }
}

checkSynergies().catch(console.error)