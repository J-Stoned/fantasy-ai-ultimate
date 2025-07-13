#!/usr/bin/env tsx
/**
 * Test REAL ESPN games that actually work
 */

import axios from 'axios'
import chalk from 'chalk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testRealGames() {
  console.log(chalk.bold.red('🔍 TESTING REAL ESPN GAMES\n'))
  
  // Get games from last 7 days
  const dates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString().split('T')[0].replace(/-/g, ''))
  }
  
  console.log(chalk.cyan('Checking dates:', dates.join(', ')))
  
  for (const dateStr of dates) {
    console.log(chalk.yellow(`\n📅 Checking ${dateStr}...`))
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`
    
    try {
      const response = await axios.get(url)
      const events = response.data.events || []
      
      if (events.length === 0) {
        console.log(chalk.gray('  No games'))
        continue
      }
      
      console.log(chalk.green(`  Found ${events.length} games`))
      
      // Test first completed game
      const completedGame = events.find(e => e.status.type.completed)
      if (!completedGame) {
        console.log(chalk.gray('  No completed games'))
        continue
      }
      
      console.log(chalk.cyan(`\n  Testing game ${completedGame.id}: ${completedGame.name}`))
      
      // Get boxscore
      const boxUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${completedGame.id}`
      const boxResponse = await axios.get(boxUrl)
      
      if (!boxResponse.data.boxscore) {
        console.log(chalk.red('  ❌ No boxscore'))
        continue
      }
      
      // Count players with stats
      let playersWithStats = 0
      const boxscore = boxResponse.data.boxscore
      
      boxscore.teams?.forEach((team: any) => {
        team.statistics?.forEach((stat: any) => {
          if (stat.type === 'players' && stat.athletes) {
            stat.athletes.forEach((athlete: any) => {
              if (athlete.stats && athlete.stats.length > 0 && parseInt(athlete.stats[0]) > 0) {
                playersWithStats++
              }
            })
          }
        })
      })
      
      console.log(chalk.bold.green(`  ✅ Found ${playersWithStats} players with stats!`))
      
      // Check if this game exists in our database
      const { data: dbGame } = await supabase
        .from('games')
        .select('id, external_id')
        .eq('external_id', `espn_nba_${completedGame.id}`)
        .single()
      
      if (dbGame) {
        console.log(chalk.yellow(`  📊 Game exists in DB: ${dbGame.external_id}`))
        
        // Check if it has stats
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', dbGame.id)
        
        console.log(chalk.cyan(`  Player stats in DB: ${count || 0}`))
      } else {
        console.log(chalk.red(`  ❌ Game NOT in database`))
      }
      
      // We found a working game!
      return completedGame.id
    } catch (error: any) {
      console.error(chalk.red(`  Error: ${error.message}`))
    }
  }
}

testRealGames().catch(console.error)