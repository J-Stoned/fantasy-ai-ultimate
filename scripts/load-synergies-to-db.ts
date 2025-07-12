#!/usr/bin/env tsx
/**
 * Load Player Synergies to Database
 * Re-runs the enhanced synergy analyzer and ensures data is properly inserted
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import { EnhancedSynergyAnalyzer } from './enhanced-synergy-analyzer'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log(chalk.cyan.bold('\n🔄 Loading Player Synergies to Database\n'))
  
  // Step 1: Verify table exists
  console.log(chalk.yellow('1. Verifying player_synergies table...'))
  const { count, error: countError } = await supabase
    .from('player_synergies')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error(chalk.red('❌ Table check failed:'), countError)
    console.log(chalk.yellow('\n⚠️  Please run the migration file in Supabase SQL Editor:'))
    console.log(chalk.white('   supabase/migrations/20250112_create_player_synergies.sql'))
    console.log(chalk.yellow('\nThen re-run this script.'))
    return
  }
  
  console.log(chalk.green(`✓ Table exists with ${count || 0} records`))
  
  // Step 2: Run synergy analysis
  console.log(chalk.yellow('\n2. Running synergy analysis...'))
  const analyzer = new EnhancedSynergyAnalyzer()
  const synergyCount = await analyzer.analyze()
  
  // Step 3: Verify data was loaded
  console.log(chalk.yellow('\n3. Verifying data load...'))
  const { count: newCount } = await supabase
    .from('player_synergies')
    .select('*', { count: 'exact', head: true })
  
  console.log(chalk.green(`✓ Total synergies in database: ${newCount || 0}`))
  
  // Step 4: Show sample of top synergies
  const { data: topSynergies } = await supabase
    .from('player_synergies')
    .select('*')
    .order('synergy_score', { ascending: false })
    .limit(5)
  
  if (topSynergies && topSynergies.length > 0) {
    console.log(chalk.yellow('\n🏆 Top 5 synergies loaded:'))
    topSynergies.forEach((s, i) => {
      console.log(chalk.white(
        `${i+1}. Players ${s.player1_id} + ${s.player2_id}: ` +
        `Score ${s.synergy_score.toFixed(1)}, Games: ${s.games_together}`
      ))
    })
  }
  
  console.log(chalk.green.bold('\n✅ Synergy data loading complete!\n'))
  console.log(chalk.yellow('Next steps:'))
  console.log('1. View synergies in spatial analytics dashboard')
  console.log('2. Use synergy data in lineup optimizer')
  console.log('3. Analyze more games for additional synergies')
}

main().catch(console.error)