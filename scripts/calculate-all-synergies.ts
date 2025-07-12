#!/usr/bin/env tsx
/**
 * Calculate Player Synergies for ALL Games
 * Processes all 6,743 completed games to find player synergies
 */

import { db } from '../lib/services/database-service'
import chalk from 'chalk'

async function calculateAllSynergies() {
  console.log(chalk.cyan.bold('\n🤝 Calculating Player Synergies for ALL Games\n'))
  
  const startTime = Date.now()
  
  try {
    // Get ALL completed games - batch to bypass 1000 row limit
    let allGames: any[] = []
    const batchSize = 1000
    let offset = 0
    
    console.log(chalk.cyan('Fetching all completed games...'))
    
    while (true) {
      const { data: batch, error } = await db.getClient()
        .from('games')
        .select('id, sport, home_team_id, away_team_id')
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + batchSize - 1)
      
      if (error) throw error
      if (!batch || batch.length === 0) break
      
      allGames = allGames.concat(batch)
      console.log(chalk.dim(`  Fetched ${allGames.length} games...`))
      
      if (batch.length < batchSize) break
      offset += batchSize
    }
    
    console.log(chalk.green(`\n✅ Found ${allGames.length} completed games to analyze\n`))
    
    const synergyMap = new Map<string, any>()
    let processedGames = 0
    let gamesWithData = 0
    
    // Process games in smaller batches for better progress tracking
    const processBatchSize = 50
    
    for (let i = 0; i < allGames.length; i += processBatchSize) {
      const gameBatch = allGames.slice(i, i + processBatchSize)
      
      // Process games in parallel within batch
      await Promise.all(gameBatch.map(async (game) => {
        // Get player logs for this game
        const { data: gameLogs } = await db.getClient()
          .from('player_game_logs')
          .select('player_id, team_id, fantasy_points')
          .eq('game_id', game.id)
          .gt('fantasy_points', 0)
        
        if (!gameLogs || gameLogs.length < 2) return
        
        gamesWithData++
        
        // Group by team
        const teams = new Map<number, any[]>()
        gameLogs.forEach(log => {
          if (!teams.has(log.team_id)) teams.set(log.team_id, [])
          teams.get(log.team_id)!.push(log)
        })
        
        // Calculate synergies within each team
        teams.forEach((teamPlayers) => {
          for (let i = 0; i < teamPlayers.length - 1; i++) {
            for (let j = i + 1; j < teamPlayers.length; j++) {
              const p1 = teamPlayers[i]
              const p2 = teamPlayers[j]
              
              const key = [p1.player_id, p2.player_id].sort().join('-')
              
              if (!synergyMap.has(key)) {
                synergyMap.set(key, {
                  player1_id: Math.min(p1.player_id, p2.player_id),
                  player2_id: Math.max(p1.player_id, p2.player_id),
                  games_together: 0,
                  total_fantasy_points: 0,
                  synergy_type: 'offensive'
                })
              }
              
              const synergy = synergyMap.get(key)
              synergy.games_together++
              synergy.total_fantasy_points += (p1.fantasy_points || 0) + (p2.fantasy_points || 0)
            }
          }
        })
      }))
      
      processedGames += gameBatch.length
      
      // Show progress every 250 games
      if (processedGames % 250 === 0 || processedGames === allGames.length) {
        const elapsed = (Date.now() - startTime) / 1000 / 60
        const rate = processedGames / elapsed
        const remaining = (allGames.length - processedGames) / rate
        
        console.log(chalk.cyan(
          `Progress: ${processedGames}/${allGames.length} games (${(processedGames/allGames.length*100).toFixed(1)}%) | ` +
          `${gamesWithData} with data | ${synergyMap.size} pairs | ` +
          `${elapsed.toFixed(1)}m elapsed | ${remaining.toFixed(1)}m remaining`
        ))
      }
    }
    
    console.log(chalk.green(`\n✅ Processed all ${processedGames} games!`))
    console.log(chalk.cyan(`Found ${gamesWithData} games with player data`))
    console.log(chalk.cyan(`Discovered ${synergyMap.size} unique player pairs`))
    
    // Convert to array and calculate scores
    const synergies: any[] = []
    synergyMap.forEach((synergy) => {
      if (synergy.games_together >= 5) {
        synergy.synergy_score = synergy.total_fantasy_points / synergy.games_together / 2
        synergy.sample_size = synergy.games_together
        synergy.season = 2024
        synergies.push(synergy)
      }
    })
    
    console.log(chalk.yellow(`\n📊 Found ${synergies.length} synergies with 5+ games together`))
    
    // Sort by synergy score
    synergies.sort((a, b) => b.synergy_score - a.synergy_score)
    
    // Show top synergies
    console.log(chalk.green('\n🏆 Top 10 Player Synergies:'))
    synergies.slice(0, 10).forEach((s, i) => {
      console.log(chalk.white(
        `  ${i + 1}. Players ${s.player1_id} & ${s.player2_id}: ` +
        `${s.synergy_score.toFixed(1)} avg FP (${s.games_together} games)`
      ))
    })
    
    // Clear existing synergies for this season
    console.log(chalk.yellow('\n🗑️  Clearing existing synergies...'))
    await db.getClient()
      .from('player_synergies')
      .delete()
      .eq('season', 2024)
    
    // Insert all synergies
    console.log(chalk.yellow(`\n💾 Inserting ${synergies.length} player synergies...`))
    await db.upsertBatch('player_synergies', synergies, {
      batchSize: 500
    })
    
    const totalTime = (Date.now() - startTime) / 1000 / 60
    console.log(chalk.green.bold(`\n✅ COMPLETE! Processed ${allGames.length} games in ${totalTime.toFixed(1)} minutes`))
    console.log(chalk.green(`Created ${synergies.length} player synergies`))
    
  } catch (error) {
    console.error(chalk.red('Error:'), error)
  }
}

// Run the calculation
calculateAllSynergies().catch(console.error)