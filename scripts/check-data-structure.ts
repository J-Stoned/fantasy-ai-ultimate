#!/usr/bin/env tsx
/**
 * Check data structure
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkData() {
  console.log(chalk.cyan.bold('\n🔍 CHECKING DATA STRUCTURE\n'))
  
  try {
    // Get sample logs
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(5)
    
    if (logs && logs.length > 0) {
      console.log(chalk.yellow('Sample log structure:'))
      console.log(chalk.white(JSON.stringify(logs[0], null, 2)))
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  }
}

if (require.main === module) {
  checkData().catch(console.error)
}