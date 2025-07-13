#!/usr/bin/env tsx
/**
 * DEBUG ESPN API STRUCTURE IN DETAIL
 */

import axios from 'axios'
import chalk from 'chalk'
import * as fs from 'fs'

async function debugStructure() {
  const gameId = '401705009' // Recent game
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`
  
  console.log(chalk.yellow(`Fetching game ${gameId}...\n`))
  
  try {
    const response = await axios.get(url, { timeout: 10000 })
    
    // Save full response for inspection
    fs.writeFileSync('espn-response.json', JSON.stringify(response.data, null, 2))
    console.log(chalk.green('✅ Response saved to espn-response.json'))
    
    if (response.data.boxscore) {
      const boxscore = response.data.boxscore
      
      // Check players structure
      if (boxscore.players) {
        console.log(chalk.cyan('\nFound boxscore.players!'))
        console.log(`Number of teams: ${boxscore.players.length}`)
        
        if (boxscore.players[0]) {
          const teamPlayers = boxscore.players[0]
          console.log(`\nFirst team: ${teamPlayers.team?.displayName}`)
          console.log(`Statistics keys: ${Object.keys(teamPlayers.statistics || {}).join(', ')}`)
          
          // Check each stat category
          Object.entries(teamPlayers.statistics || {}).forEach(([key, value]: [string, any]) => {
            console.log(`\n${key}:`)
            console.log(`  Name: ${value.name}`)
            console.log(`  Athletes: ${value.athletes?.length || 0}`)
            
            if (value.athletes && value.athletes[0]) {
              const athlete = value.athletes[0]
              console.log(`  First athlete: ${athlete.athlete?.displayName}`)
              console.log(`  Stats length: ${athlete.stats?.length || 0}`)
              if (athlete.stats) {
                console.log(`  Stats: [${athlete.stats.join(', ')}]`)
              }
            }
          })
        }
      }
      
      // Alternative structure check
      if (boxscore.teams) {
        console.log(chalk.cyan('\n\nAlternative: boxscore.teams'))
        const team = boxscore.teams[0]
        
        // Deep inspect the structure
        console.log('\nTeam keys:', Object.keys(team).join(', '))
        
        if (team.statistics) {
          console.log('Statistics is array:', Array.isArray(team.statistics))
          console.log('Statistics length:', team.statistics.length)
          
          // Look for the actual data
          const playerStats = team.statistics.find((s: any) => 
            s && (s.name === 'starters' || s.name === 'bench' || s.athletes)
          )
          
          if (playerStats) {
            console.log('\nFound player stats!')
            console.log('Type:', playerStats.name)
            console.log('Athletes:', playerStats.athletes?.length)
          }
        }
      }
    }
    
  } catch (error: any) {
    console.log(chalk.red(`Error: ${error.message}`))
  }
}

debugStructure().catch(console.error)