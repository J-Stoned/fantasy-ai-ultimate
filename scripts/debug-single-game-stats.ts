#!/usr/bin/env tsx
/**
 * DEBUG: Test single game stats collection
 */

import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debugSingleGame() {
  console.log(chalk.bold.red('🔍 DEBUGGING SINGLE GAME STATS\n'))
  
  // Get a sample NBA game
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, sport, home_team_id, away_team_id')
    .eq('sport', 'NBA')
    .like('external_id', 'espn_%')
    .limit(5)
  
  if (!games || games.length === 0) {
    console.log(chalk.red('No NBA games found!'))
    return
  }
  
  console.log(chalk.cyan('Testing these games:'))
  games.forEach(g => console.log(`  ${g.external_id} (${g.sport})`))
  
  for (const game of games) {
    console.log(chalk.yellow(`\n📊 Testing ${game.external_id}...`))
    
    const espnId = game.external_id.split('_')[2]
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
    
    console.log(chalk.gray(`URL: ${url}`))
    
    try {
      const response = await axios.get(url, { timeout: 5000 })
      
      console.log(chalk.cyan('Response status:', response.status))
      console.log(chalk.cyan('Has boxscore:', !!response.data.boxscore))
      
      if (response.data.boxscore) {
        const boxscore = response.data.boxscore
        console.log(chalk.cyan('Teams:', boxscore.teams?.length || 0))
        
        let playerCount = 0
        boxscore.teams?.forEach((team: any, idx: number) => {
          console.log(chalk.gray(`  Team ${idx}: ${team.team.displayName}`))
          
          team.statistics?.forEach((stat: any) => {
            if (stat.type === 'players' && stat.athletes) {
              console.log(chalk.gray(`    Players: ${stat.athletes.length}`))
              
              // Check first player
              if (stat.athletes[0]) {
                const player = stat.athletes[0]
                console.log(chalk.yellow(`    Sample player: ${player.athlete.displayName}`))
                console.log(chalk.yellow(`    Stats array length: ${player.stats?.length || 0}`))
                if (player.stats && player.stats.length > 0) {
                  console.log(chalk.green(`    Minutes: ${player.stats[0]}`))
                  console.log(chalk.green(`    Points: ${player.stats[19]}`))
                  playerCount++
                }
              }
            }
          })
        })
        
        console.log(chalk.bold.green(`✅ Found ${playerCount} players with stats`))
        
        // Try to save one player
        if (playerCount > 0) {
          const testStat = {
            player_id: 12345,
            game_id: game.id,
            team_id: game.home_team_id,
            opponent_id: game.away_team_id,
            is_home: true,
            stats: { points: 25, rebounds: 10, assists: 5 }
          }
          
          console.log(chalk.yellow('\n💾 Testing save...'))
          
          // Create player first
          await supabase.from('players').upsert({
            id: 12345,
            external_id: 'espn_12345',
            name: 'Test Player',
            sport: 'nba'
          }, { onConflict: 'id' })
          
          // Save stat
          const { data, error } = await supabase
            .from('player_game_logs')
            .upsert(testStat, { onConflict: 'player_id,game_id' })
            .select()
          
          if (error) {
            console.log(chalk.red('❌ Save error:', error.message))
          } else {
            console.log(chalk.green('✅ Save successful!', data))
          }
        }
        
      } else {
        console.log(chalk.red('❌ No boxscore in response'))
      }
      
    } catch (error: any) {
      console.log(chalk.red('❌ Error:', error.message))
      if (error.response) {
        console.log(chalk.red('Response status:', error.response.status))
      }
    }
  }
}

debugSingleGame().catch(console.error)