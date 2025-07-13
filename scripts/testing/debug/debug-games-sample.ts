#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import chalk from 'chalk'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debugGames() {
  // Get sample games from different time periods
  console.log(chalk.yellow('Checking games from different periods...\n'))
  
  // 2024 games
  const { data: games2024 } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_score, away_score')
    .like('external_id', 'espn_%')
    .gte('start_time', '2024-01-01')
    .lte('start_time', '2024-12-31')
    .not('home_score', 'is', null)
    .limit(10)
    .order('start_time', { ascending: false })
    
  console.log(chalk.cyan('2024 Games (with scores):'))
  games2024?.forEach(g => {
    console.log(`  ${g.external_id} - ${g.sport} - ${new Date(g.start_time).toLocaleDateString()} - Score: ${g.home_score}-${g.away_score}`)
  })
  
  // 2025 games (future)
  const { data: games2025 } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_score, away_score')
    .like('external_id', 'espn_%')
    .gte('start_time', '2025-01-01')
    .limit(10)
    .order('start_time', { ascending: true })
    
  console.log(chalk.cyan('\n2025 Games (future):'))
  games2025?.forEach(g => {
    console.log(`  ${g.external_id} - ${g.sport} - ${new Date(g.start_time).toLocaleDateString()} - Score: ${g.home_score || 'null'}-${g.away_score || 'null'}`)
  })
  
  // Games with stats
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id, game:games(external_id, sport, start_time)')
    .limit(10)
    .order('game_id', { ascending: false })
    
  console.log(chalk.cyan('\nGames that have stats:'))
  gamesWithStats?.forEach(g => {
    if (g.game) {
      console.log(`  ${g.game.external_id} - ${g.game.sport} - ${new Date(g.game.start_time).toLocaleDateString()}`)
    }
  })
  
  // Count by sport
  const { data: sportCounts } = await supabase
    .rpc('get_game_counts_by_sport', {
      start_date: '2023-01-01',
      end_date: '2024-12-31'
    })
    .not('home_score', 'is', null)
    
  console.log(chalk.cyan('\nGames by sport (2023-2024):'))
  console.log(sportCounts)
}

debugGames()