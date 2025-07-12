#!/usr/bin/env tsx

import axios from 'axios'
import chalk from 'chalk'

async function testMLBEndpoint() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=401696222'
  
  try {
    console.log(chalk.yellow('Testing URL:'), url)
    const response = await axios.get(url, { timeout: 10000 })
    
    console.log(chalk.green('\nResponse received!'))
    console.log('Status:', response.status)
    console.log('Has boxscore?', !!response.data.boxscore)
    console.log('Has players?', !!response.data.boxscore?.players)
    
    if (response.data.boxscore?.players) {
      const team = response.data.boxscore.players[0]
      console.log('\nFirst team:', team.team.displayName)
      console.log('Team object keys:', Object.keys(team))
      console.log('Statistics array:', team.statistics)
      
      // Debug the structure
      const batting = team.statistics?.find(s => s.type === 'batting')
      if (batting?.athletes?.length > 0) {
        console.log('\nFirst batter:')
        console.log(JSON.stringify(batting.athletes[0], null, 2))
      }
    }
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message)
    if (error.response) {
      console.log('Response status:', error.response.status)
      console.log('Response data:', error.response.data)
    }
  }
}

testMLBEndpoint()