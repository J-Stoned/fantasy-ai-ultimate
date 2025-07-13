#!/usr/bin/env tsx
/**
 * DEBUG NHL AND MLB API ISSUES
 * Figure out why these sports aren't collecting properly
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import axios from 'axios'
import * as dotenv from 'dotenv'
import { buildEspnApiUrl } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debugNHLMLBAPIs() {
  console.log(chalk.bold.red('🏒⚾ DEBUG NHL AND MLB APIS\n'))
  
  const sports = ['NHL', 'MLB']
  
  for (const sport of sports) {
    console.log(chalk.bold.yellow(`\n🔍 Testing ${sport} API:\n`))
    
    // Get recent completed games
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, sport, start_time, home_score, away_score')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .gte('start_time', '2023-01-01')
      .lte('start_time', '2024-12-31')
      .order('start_time', { ascending: false })
      .limit(5)
      
    if (!games || games.length === 0) {
      console.log(chalk.red(`  ❌ No ${sport} games found`))
      continue
    }
    
    console.log(chalk.cyan(`  Found ${games.length} recent ${sport} games to test`))
    
    // Test each game
    for (const game of games) {
      console.log(chalk.gray(`\n  Testing game: ${game.external_id}`))
      console.log(`  Date: ${new Date(game.start_time).toLocaleDateString()}`)
      console.log(`  Score: ${game.home_score}-${game.away_score}`)
      
      try {
        const apiUrl = buildEspnApiUrl(game.external_id)
        if (!apiUrl) {
          console.log(chalk.red(`    ❌ Could not build API URL`))
          continue
        }
        
        console.log(`  API URL: ${apiUrl}`)
        
        const response = await axios.get(apiUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        })
        
        console.log(`  Response status: ${response.status}`)
        
        if (response.status === 200) {
          // Check data structure
          const hasBoxscore = !!response.data.boxscore
          const hasPlayers = !!response.data.boxscore?.players
          const playerCount = response.data.boxscore?.players?.length || 0
          
          console.log(chalk.green(`  ✅ API Success!`))
          console.log(`  Has boxscore: ${hasBoxscore}`)
          console.log(`  Has players: ${hasPlayers}`)
          console.log(`  Player teams: ${playerCount}`)
          
          if (hasPlayers && playerCount > 0) {
            // Check player data structure
            const firstTeam = response.data.boxscore.players[0]
            console.log(`  First team: ${firstTeam.team?.displayName || 'Unknown'}`)
            console.log(`  Has statistics: ${!!firstTeam.statistics}`)
            
            if (firstTeam.statistics) {
              console.log(`  Statistics is array: ${Array.isArray(firstTeam.statistics)}`)
              console.log(`  Statistics keys: ${Object.keys(firstTeam.statistics).slice(0, 5).join(', ')}`)
              
              // NHL specific check
              if (sport === 'NHL') {
                console.log(chalk.cyan('\n  NHL Structure:'))
                const statGroups = Object.entries(firstTeam.statistics || {})
                statGroups.forEach(([key, value]: [string, any]) => {
                  if (value && value.athletes) {
                    console.log(`    ${key}: ${value.athletes.length} athletes`)
                    if (value.athletes.length > 0) {
                      const firstAthlete = value.athletes[0]
                      console.log(`      First athlete: ${firstAthlete.athlete?.displayName || 'Unknown'}`)
                      console.log(`      Stats array: ${firstAthlete.stats?.length || 0} values`)
                      if (firstAthlete.stats?.length > 0) {
                        console.log(`      Sample stats: ${firstAthlete.stats.slice(0, 5).join(', ')}`)
                      }
                    }
                  }
                })
              }
              
              // MLB specific check
              if (sport === 'MLB') {
                console.log(chalk.cyan('\n  MLB Structure:'))
                const statGroups = Object.entries(firstTeam.statistics || {})
                statGroups.forEach(([key, value]: [string, any]) => {
                  if (value && value.athletes) {
                    console.log(`    ${key}: ${value.athletes.length} athletes`)
                    if (value.athletes.length > 0) {
                      const firstAthlete = value.athletes[0]
                      console.log(`      First athlete: ${firstAthlete.athlete?.displayName || 'Unknown'}`)
                      console.log(`      Stats array: ${firstAthlete.stats?.length || 0} values`)
                      if (firstAthlete.stats?.length > 0) {
                        console.log(`      Sample stats: ${firstAthlete.stats.slice(0, 5).join(', ')}`)
                      }
                    }
                  }
                })
              }
            }
          }
        } else {
          console.log(chalk.red(`  ❌ HTTP ${response.status}`))
        }
      } catch (error: any) {
        console.log(chalk.red(`  ❌ Error: ${error.message}`))
      }
    }
  }
  
  console.log(chalk.bold.yellow('\n📋 DEBUGGING SUMMARY:\n'))
  console.log('1. Check if API URLs are correct for each sport')
  console.log('2. Verify data structure differs between sports')
  console.log('3. NHL/MLB may use different stat group names')
  console.log('4. Update extraction logic for sport-specific structures')
}

debugNHLMLBAPIs().catch(console.error)