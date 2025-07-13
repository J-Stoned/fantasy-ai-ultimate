#!/usr/bin/env tsx
/**
 * DEBUG ESPN NBA API RESPONSE
 */

import axios from 'axios'
import chalk from 'chalk'

async function debugEspnApi() {
  // Try a known NBA game ID
  const gameIds = [
    '401705009', // Dec 30, 2024
    '401584768', // From our DB
    '401468208', // 2022-23 season
  ]
  
  for (const gameId of gameIds) {
    console.log(chalk.yellow(`\nTesting ESPN Game ID: ${gameId}`))
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`
      console.log(chalk.gray(`URL: ${url}`))
      
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      console.log(chalk.green(`✅ Status: ${response.status}`))
      
      if (response.data) {
        console.log(chalk.cyan('Response structure:'))
        console.log(`  Has boxscore: ${!!response.data.boxscore}`)
        
        if (response.data.boxscore) {
          const boxscore = response.data.boxscore
          console.log(`  Teams: ${boxscore.teams?.length || 0}`)
          
          if (boxscore.teams && boxscore.teams[0]) {
            const team = boxscore.teams[0]
            console.log(`  First team: ${team.team?.displayName}`)
            console.log(`  Statistics groups: ${team.statistics?.length || 0}`)
            
            if (team.statistics) {
              team.statistics.forEach((stat: any, i: number) => {
                console.log(`    Group ${i}: ${stat.type} (${stat.athletes?.length || 0} athletes)`)
                
                if (stat.type === 'players' && stat.athletes && stat.athletes[0]) {
                  const athlete = stat.athletes[0]
                  console.log(`      First player: ${athlete.athlete?.displayName}`)
                  console.log(`      Stats array length: ${athlete.stats?.length || 0}`)
                  
                  if (athlete.stats && athlete.stats.length > 0) {
                    console.log(`      Sample stats: [${athlete.stats.slice(0, 5).join(', ')}...]`)
                  }
                }
              })
            }
          }
        }
        
        // Check if game is completed
        if (response.data.header) {
          console.log(`  Game state: ${response.data.header.competitions?.[0]?.status?.type?.name}`)
        }
      }
      
    } catch (error: any) {
      console.log(chalk.red(`❌ Error: ${error.message}`))
      if (error.response) {
        console.log(chalk.red(`   Status: ${error.response.status}`))
      }
    }
  }
  
  // Try the scoreboard endpoint
  console.log(chalk.yellow('\n\nTesting Scoreboard Endpoint:'))
  
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20240101'
    console.log(chalk.gray(`URL: ${url}`))
    
    const response = await axios.get(url, { timeout: 10000 })
    
    console.log(chalk.green(`✅ Status: ${response.status}`))
    console.log(`Events: ${response.data.events?.length || 0}`)
    
    if (response.data.events && response.data.events[0]) {
      const event = response.data.events[0]
      console.log(`First event ID: ${event.id}`)
      console.log(`Status: ${event.competitions?.[0]?.status?.type?.name}`)
    }
    
  } catch (error: any) {
    console.log(chalk.red(`❌ Error: ${error.message}`))
  }
}

debugEspnApi().catch(console.error)