#!/usr/bin/env tsx
/**
 * DEBUG API ISSUES
 * Figure out why NBA, NHL, MLB APIs aren't working as well
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

async function debugAPIIssues() {
  console.log(chalk.bold.red('🔍 DEBUG API ISSUES - NBA, NHL, MLB\n'))
  
  const sports = ['NBA', 'NHL', 'MLB']
  
  for (const sport of sports) {
    console.log(chalk.bold.yellow(`\n🏆 Testing ${sport} API:\n`))
    
    // Get a few recent games
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
      
      try {
        const apiUrl = buildEspnApiUrl(game.external_id)
        if (!apiUrl) {
          console.log(chalk.red(`    ❌ Could not build API URL`))
          continue
        }
        
        console.log(chalk.gray(`    API URL: ${apiUrl}`))
        
        const response = await axios.get(apiUrl, {
          timeout: 10000,
          validateStatus: (status) => status < 500,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        })
        
        console.log(chalk.cyan(`    Response status: ${response.status}`))
        
        if (response.status === 200) {
          // Check data structure
          const hasBoxscore = !!response.data.boxscore
          const hasPlayers = !!response.data.boxscore?.players
          const playerCount = response.data.boxscore?.players?.length || 0
          
          console.log(chalk.green(`    ✅ Success!`))
          console.log(`    Has boxscore: ${hasBoxscore}`))
          console.log(`    Has players: ${hasPlayers}`))
          console.log(`    Player teams: ${playerCount}`))
          
          if (hasPlayers && playerCount > 0) {
            // Check player data structure
            const firstTeam = response.data.boxscore.players[0]
            const hasStatistics = !!firstTeam.statistics
            const statGroups = firstTeam.statistics?.length || 0
            
            console.log(`    Has statistics: ${hasStatistics}`))
            console.log(`    Stat groups: ${statGroups}`))
            
            if (hasStatistics && statGroups > 0) {
              const firstStatGroup = firstTeam.statistics[0]
              console.log(`    First stat group: ${firstStatGroup.name || 'unnamed'}`))
              console.log(`    Athletes count: ${firstStatGroup.athletes?.length || 0}`))
              
              if (firstStatGroup.athletes?.length > 0) {
                const firstAthlete = firstStatGroup.athletes[0]
                console.log(`    First athlete: ${firstAthlete.athlete?.displayName || 'Unknown'}`))
                console.log(`    Stats array length: ${firstAthlete.stats?.length || 0}`))
                
                if (firstAthlete.stats?.length > 0) {
                  console.log(chalk.green(`    📊 VALID GAME WITH STATS!`))
                }
              }
            }
          }
        } else {
          console.log(chalk.red(`    ❌ HTTP ${response.status}`))
        }
      } catch (error: any) {
        console.log(chalk.red(`    ❌ Error: ${error.message}`))
      }
    }
  }
  
  console.log(chalk.bold.yellow('\n📋 DEBUGGING SUMMARY:\n'))
  console.log('1. Check if API URLs are correct for each sport')
  console.log('2. Verify data structure differs between sports')
  console.log('3. May need sport-specific parsing logic')
  console.log('4. Consider rate limiting or API restrictions')
  console.log('5. Test with different date ranges')
}

// Run debug
debugAPIIssues().catch(console.error)