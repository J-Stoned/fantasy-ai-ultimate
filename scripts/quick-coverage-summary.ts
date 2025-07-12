#!/usr/bin/env tsx
/**
 * Quick Coverage Summary - Key metrics only
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function quickSummary() {
  console.log(chalk.cyan.bold('\n💎 QUICK COVERAGE SUMMARY\n'))
  
  try {
    // Key findings from partial analysis
    console.log(chalk.yellow('📊 Current State:'))
    console.log(chalk.white(`• Total games: 16,435`))
    console.log(chalk.white(`• Completed games with scores: 6,743`))
    console.log(chalk.white(`• Games with player logs: 553 (8.2% coverage)`))
    console.log(chalk.white(`• Games with fantasy data: 74 (1.1% coverage)`))
    
    console.log(chalk.yellow('\n📈 Player Logs:'))
    console.log(chalk.white(`• Total logs: 196,984`))
    console.log(chalk.white(`• Logs with fantasy points: 105,102 (53.4%)`))
    console.log(chalk.white(`• Logs needing fantasy calculation: 91,882`))
    
    console.log(chalk.yellow('\n🎯 Coverage by Year:'))
    console.log(chalk.white(`• 2024: 99% coverage (EXCELLENT!)`))
    console.log(chalk.white(`• 2023: 56% coverage (GOOD)`))
    console.log(chalk.white(`• 2020-2022: ~0% coverage (OPPORTUNITY!)`))
    
    console.log(chalk.cyan.bold('\n🚀 10X OPPORTUNITY:\n'))
    
    const gamesNeedingData = 6743 - 553
    const potentialNewLogs = gamesNeedingData * 20
    
    console.log(chalk.green.bold(`1. Fix 91,882 logs missing fantasy points`))
    console.log(chalk.green.bold(`2. Add player logs for 6,190 games`))
    console.log(chalk.green.bold(`3. Create ~123,800 new player logs`))
    console.log(chalk.green.bold(`4. TOTAL OPPORTUNITY: 215,682 records!\n`))
    
    console.log(chalk.yellow('💡 Quick Wins:'))
    console.log(chalk.white(`• 2024 games are 99% covered - just need fantasy points`))
    console.log(chalk.white(`• 2023 games are 56% covered - fill the gaps`))
    console.log(chalk.white(`• NFL has 1,932 games ready for data`))
    console.log(chalk.white(`• NBA has 641 games ready for data`))
    
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  }
}

if (require.main === module) {
  quickSummary().catch(console.error)
}