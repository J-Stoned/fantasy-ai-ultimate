#\!/usr/bin/env tsx
/**
 * DEBUG NCAAB API
 * Figure out why NCAAB stats aren't working
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import axios from 'axios'
import * as dotenv from 'dotenv'
import { buildEspnApiUrl } from '../lib/utils/espn-id-validator'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL\!,
  process.env.SUPABASE_SERVICE_ROLE_KEY\!
)

async function debugNCAABAPI() {
  console.log(chalk.bold.yellow('🏀 DEBUG NCAAB API\\n'))
  
  // Get a few NCAAB games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, sport, start_time, home_score, away_score')
    .eq('sport', 'NCAAB')
    .not('home_score', 'is', null)
    .gte('start_time', '2023-01-01')
    .lte('start_time', '2024-12-31')
    .order('start_time', { ascending: false })
    .limit(5)
    
  if (\!games || games.length === 0) {
    console.log('No NCAAB games found')
    return
  }
  
  console.log(`Found ${games.length} NCAAB games to test\\n`)
  
  for (const game of games) {
    console.log(chalk.cyan(`Testing: ${game.external_id}`))
    console.log(`  Date: ${new Date(game.start_time).toLocaleDateString()}`)
    console.log(`  Score: ${game.home_score}-${game.away_score}`)
    
    try {
      // Build API URL
      const apiUrl = buildEspnApiUrl(game.external_id)
      if (\!apiUrl) {
        console.log(chalk.red('  ❌ Could not build API URL'))
        continue
      }
      
      console.log(`  API: ${apiUrl}`)
      
      // Try different URL patterns
      const urls = [
        apiUrl,
        // Try mens-college-basketball
        apiUrl.replace('/college-basketball/', '/mens-college-basketball/'),
        // Try without sport path
        `https://site.api.espn.com/apis/site/v2/sports/basketball/summary?event=${game.external_id.split('_').pop()}`
      ]
      
      let success = false
      
      for (const url of urls) {
        try {
          const response = await axios.get(url, {
            timeout: 10000,
            validateStatus: (status) => status < 500,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          })
          
          if (response.status === 200) {
            console.log(chalk.green(`  ✅ Success with: ${url.includes('mens-') ? 'mens-college-basketball' : 'standard'}`))
            
            // Check data structure
            const hasBoxscore = \!\!response.data.boxscore
            const hasPlayers = \!\!response.data.boxscore?.players
            const playerCount = response.data.boxscore?.players?.length || 0
            
            console.log(`  Has boxscore: ${hasBoxscore}`)
            console.log(`  Has players: ${hasPlayers}`)
            console.log(`  Player teams: ${playerCount}`)
            
            if (hasPlayers && playerCount > 0) {
              const firstTeam = response.data.boxscore.players[0]
              console.log(`  First team: ${firstTeam.team?.displayName || 'Unknown'}`)
              console.log(`  Has statistics: ${\!\!firstTeam.statistics}`)
              
              if (firstTeam.statistics && firstTeam.statistics.length > 0) {
                const statGroup = firstTeam.statistics[0]
                console.log(`  Stat group: ${statGroup.name || 'unnamed'}`)
                console.log(`  Athletes: ${statGroup.athletes?.length || 0}`)
                
                if (statGroup.athletes?.length > 0) {
                  const firstAthlete = statGroup.athletes[0]
                  console.log(`  First athlete: ${firstAthlete.athlete?.displayName || 'Unknown'}`)
                  console.log(`  Stats array: ${firstAthlete.stats?.length || 0} values`)
                  console.log(chalk.green('  📊 VALID GAME WITH STATS\!'))
                }
              }
            }
            
            success = true
            break
          }
        } catch (error: any) {
          // Silent continue to try next URL
        }
      }
      
      if (\!success) {
        console.log(chalk.red('  ❌ All URL patterns failed'))
      }
      
    } catch (error: any) {
      console.log(chalk.red(`  ❌ Error: ${error.message}`))
    }
    
    console.log()
  }
  
  console.log(chalk.bold.yellow('💡 DEBUGGING SUMMARY:'))
  console.log('1. NCAAB might need "mens-college-basketball" in URL')
  console.log('2. Check if external_id format is correct')
  console.log('3. May need different API endpoint structure')
}

debugNCAABAPI().catch(console.error)
EOF < /dev/null
