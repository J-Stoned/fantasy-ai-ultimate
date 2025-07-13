#!/usr/bin/env tsx
/**
 * FETCH PAST GAMES ONLY - NO FUTURE GAMES!
 */

import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import chalk from 'chalk'
import pLimit from 'p-limit'
import * as dotenv from 'dotenv'
import * as os from 'os'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const cpuCount = os.cpus().length
const limit = pLimit(cpuCount * 4)

console.log(chalk.bold.red(`🔥 FETCHING PAST GAMES ONLY - ${cpuCount * 4} CONCURRENT!\n`))

async function fetchPastGamesOnly() {
  // Get YESTERDAY as the end date (to ensure games are complete)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  
  const startDate = new Date('2023-01-01')
  const endDate = yesterday // NOT THE FUTURE!
  
  console.log(chalk.yellow(`Fetching games from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`))
  
  // Define sports
  const sports = [
    { key: 'NBA', endpoint: 'basketball/nba', seasonMonths: [10, 11, 12, 1, 2, 3, 4, 5, 6] },
    { key: 'NFL', endpoint: 'football/nfl', seasonMonths: [9, 10, 11, 12, 1, 2] },
    { key: 'MLB', endpoint: 'baseball/mlb', seasonMonths: [3, 4, 5, 6, 7, 8, 9, 10] },
    { key: 'NHL', endpoint: 'hockey/nhl', seasonMonths: [10, 11, 12, 1, 2, 3, 4, 5, 6] },
    { key: 'NCAAB', endpoint: 'basketball/mens-college-basketball', seasonMonths: [11, 12, 1, 2, 3, 4] },
    { key: 'NCAAF', endpoint: 'football/college-football', seasonMonths: [8, 9, 10, 11, 12, 1] }
  ]
  
  let totalGames = 0
  let gamesWithScores = 0
  
  for (const sport of sports) {
    console.log(chalk.cyan(`\n📊 Fetching ${sport.key} games...`))
    
    let sportGames = 0
    let sportCompleted = 0
    const current = new Date(startDate)
    
    while (current <= endDate) {
      const month = current.getMonth() + 1
      
      // Only fetch if in season
      if (sport.seasonMonths.includes(month)) {
        const dateStr = current.toISOString().split('T')[0].replace(/-/g, '')
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.endpoint}/scoreboard?dates=${dateStr}`
        
        try {
          const response = await axios.get(url, { timeout: 5000 })
          
          if (response.data.events) {
            for (const event of response.data.events) {
              // Only save COMPLETED games
              if (event.competitions?.[0]?.status?.type?.completed) {
                const competition = event.competitions[0]
                const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home')
                const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away')
                
                if (homeTeam && awayTeam && homeTeam.score && awayTeam.score) {
                  // This is a completed game with scores!
                  sportGames++
                  sportCompleted++
                  
                  // Save to database
                  await saveGame({
                    external_id: `espn_${sport.key.toLowerCase()}_${event.id}`,
                    sport: sport.key,
                    home_team_name: homeTeam.team.displayName,
                    away_team_name: awayTeam.team.displayName,
                    home_score: parseInt(homeTeam.score),
                    away_score: parseInt(awayTeam.score),
                    start_time: event.date,
                    status: 'completed'
                  })
                }
              }
            }
          }
        } catch (error) {
          // Silent fail for 404s
        }
      }
      
      current.setDate(current.getDate() + 1)
    }
    
    console.log(chalk.green(`  ✅ ${sport.key}: ${sportCompleted} completed games`))
    totalGames += sportGames
    gamesWithScores += sportCompleted
  }
  
  console.log(chalk.bold.green(`\n✅ DONE! Found ${gamesWithScores} COMPLETED games (out of ${totalGames} total)`))
  
  // Check database
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    
  console.log(chalk.bold.yellow(`\n📊 Database now has ${count?.toLocaleString() || 0} games with scores!`))
}

async function saveGame(gameData: any) {
  // Resolve team IDs (simplified for now)
  const { data: homeTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('name', gameData.home_team_name)
    .eq('sport', gameData.sport)
    .single()
    
  const { data: awayTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('name', gameData.away_team_name)
    .eq('sport', gameData.sport)
    .single()
    
  if (!homeTeam || !awayTeam) {
    // Create teams if needed
    return
  }
  
  await supabase
    .from('games')
    .upsert({
      external_id: gameData.external_id,
      sport: gameData.sport,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      home_score: gameData.home_score,
      away_score: gameData.away_score,
      start_time: gameData.start_time,
      status: gameData.status
    }, { onConflict: 'external_id' })
}

// RUN IT!
fetchPastGamesOnly().catch(console.error)