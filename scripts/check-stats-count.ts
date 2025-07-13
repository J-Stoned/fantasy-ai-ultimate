#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import chalk from 'chalk'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkStats() {
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })

  console.log(chalk.bold.yellow(`📊 Total player stats: ${count?.toLocaleString() || 0}`))
}

checkStats()