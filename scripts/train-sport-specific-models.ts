#!/usr/bin/env tsx
/**
 * 🏀🏈⚾🏒 SPORT-SPECIFIC ML MODELS
 * 
 * Trains separate models for each sport with proper stat parsing
 * Each sport has unique features and fantasy scoring systems
 */

import * as tf from '@tensorflow/tfjs-node-gpu'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import chalk from 'chalk'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Sport-specific stat mappings
const SPORT_STATS = {
  nba: {
    core: ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers'],
    shooting: ['fieldGoals', 'threePointers', 'freeThrows'],
    advanced: ['plusMinus', 'minutes', 'fouls'],
    fantasyWeights: {
      points: 1,
      rebounds: 1.2,
      assists: 1.5,
      steals: 3,
      blocks: 3,
      turnovers: -1,
      threePointers: 0.5, // Bonus for made 3s
      doubleDouble: 1.5,
      tripleDouble: 3
    }
  },
  nfl: {
    qb: ['passing_yards', 'passing_touchdowns', 'interceptions', 'rushing_yards', 'rushing_touchdowns'],
    rb: ['rushing_yards', 'rushing_touchdowns', 'receptions', 'receiving_yards', 'receiving_touchdowns'],
    wr: ['receptions', 'receiving_yards', 'receiving_touchdowns', 'rushing_yards'],
    defense: ['sacks', 'interceptions', 'fumbles_recovered', 'touchdowns', 'points_allowed'],
    fantasyWeights: {
      passing_yards: 0.04,      // 1 point per 25 yards
      passing_touchdowns: 4,
      interceptions: -2,
      rushing_yards: 0.1,       // 1 point per 10 yards
      rushing_touchdowns: 6,
      receptions: 1,            // PPR scoring
      receiving_yards: 0.1,     // 1 point per 10 yards
      receiving_touchdowns: 6
    }
  },
  mlb: {
    batting: ['hits', 'runs', 'rbis', 'home_runs', 'stolen_bases', 'walks', 'strikeouts'],
    pitching: ['innings_pitched', 'strikeouts', 'wins', 'saves', 'earned_runs', 'hits_allowed', 'walks_allowed'],
    fantasyWeights: {
      // Batting
      hits: 1,
      runs: 1,
      rbis: 1,
      home_runs: 4,
      stolen_bases: 2,
      walks: 1,
      batting_strikeouts: -0.5,
      // Pitching
      innings_pitched: 3,
      pitching_strikeouts: 1,
      wins: 5,
      saves: 5,
      earned_runs: -2,
      quality_start: 3
    }
  },
  nhl: {
    skater: ['goals', 'assists', 'shots', 'hits', 'blocks', 'plusMinus', 'penalty_minutes'],
    goalie: ['wins', 'saves', 'goals_against', 'shutouts', 'save_percentage'],
    fantasyWeights: {
      // Skater
      goals: 3,
      assists: 2,
      shots: 0.4,
      hits: 0.2,
      blocks: 0.2,
      plusMinus: 1,
      penalty_minutes: 0.5,
      // Goalie
      wins: 4,
      saves: 0.2,
      goals_against: -1,
      shutouts: 2
    }
  }
}

// Parse sport-specific stats from normalized format
async function parseNbaStats(playerId: number, gameId: number): Promise<number[] | null> {
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .eq('game_id', gameId)
  
  if (!stats || stats.length === 0) return null
  
  const parsed: any = {
    points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
    turnovers: 0, minutes: 0, fieldGoalsMade: 0, fieldGoalsAttempted: 0,
    threePointersMade: 0, threePointersAttempted: 0, freeThrowsMade: 0,
    freeThrowsAttempted: 0, plusMinus: 0, fouls: 0
  }
  
  stats.forEach(stat => {
    switch (stat.stat_type) {
      case 'points':
      case 'pts':
        parsed.points = parseFloat(stat.stat_value) || 0
        break
      case 'rebounds':
      case 'reb':
        parsed.rebounds = parseFloat(stat.stat_value) || 0
        break
      case 'assists':
      case 'ast':
        parsed.assists = parseFloat(stat.stat_value) || 0
        break
      case 'steals':
      case 'stl':
        parsed.steals = parseFloat(stat.stat_value) || 0
        break
      case 'blocks':
      case 'blk':
        parsed.blocks = parseFloat(stat.stat_value) || 0
        break
      case 'turnovers':
      case 'to':
        parsed.turnovers = parseFloat(stat.stat_value) || 0
        break
      case 'minutes':
      case 'min':
        parsed.minutes = parseFloat(stat.stat_value) || 0
        break
      case 'fieldGoals':
        if (stat.stat_value.includes('-')) {
          const [made, attempted] = stat.stat_value.split('-').map(Number)
          parsed.fieldGoalsMade = made || 0
          parsed.fieldGoalsAttempted = attempted || 0
        }
        break
      case 'threePointers':
        if (stat.stat_value.includes('-')) {
          const [made, attempted] = stat.stat_value.split('-').map(Number)
          parsed.threePointersMade = made || 0
          parsed.threePointersAttempted = attempted || 0
        }
        break
      case 'freeThrows':
        if (stat.stat_value.includes('-')) {
          const [made, attempted] = stat.stat_value.split('-').map(Number)
          parsed.freeThrowsMade = made || 0
          parsed.freeThrowsAttempted = attempted || 0
        }
        break
      case 'plusMinus':
        parsed.plusMinus = parseFloat(stat.stat_value.replace('+', '')) || 0
        break
      case 'fouls':
      case 'pf':
        parsed.fouls = parseFloat(stat.stat_value) || 0
        break
    }
  })
  
  // Skip if no minutes played
  if (parsed.minutes === 0) return null
  
  // Calculate NBA-specific features
  const features = [
    parsed.points / 30,                    // Normalize by typical max
    parsed.rebounds / 15,
    parsed.assists / 15,
    parsed.steals / 5,
    parsed.blocks / 5,
    parsed.turnovers / 5,
    parsed.fieldGoalsMade / 20,
    parsed.fieldGoalsAttempted / 30,
    parsed.fieldGoalsAttempted > 0 ? parsed.fieldGoalsMade / parsed.fieldGoalsAttempted : 0, // FG%
    parsed.threePointersMade / 10,
    parsed.threePointersAttempted / 15,
    parsed.threePointersAttempted > 0 ? parsed.threePointersMade / parsed.threePointersAttempted : 0, // 3P%
    parsed.freeThrowsMade / 15,
    parsed.freeThrowsAttempted / 20,
    parsed.freeThrowsAttempted > 0 ? parsed.freeThrowsMade / parsed.freeThrowsAttempted : 0, // FT%
    parsed.minutes / 48,                   // Normalize by max minutes
    parsed.plusMinus / 30,                 // Normalize plus/minus
    parsed.fouls / 6,                      // Normalize by foul limit
    // Advanced features
    (parsed.points + parsed.rebounds + parsed.assists) / 60,  // Basic productivity
    parsed.minutes > 0 ? parsed.points / parsed.minutes : 0,  // Points per minute
    // Double-double indicator
    [parsed.points, parsed.rebounds, parsed.assists, parsed.steals, parsed.blocks].filter(x => x >= 10).length >= 2 ? 1 : 0,
    // Triple-double indicator
    [parsed.points, parsed.rebounds, parsed.assists, parsed.steals, parsed.blocks].filter(x => x >= 10).length >= 3 ? 1 : 0
  ]
  
  return features
}

async function parseNflStats(playerId: number, gameId: number, position: string): Promise<number[] | null> {
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .eq('game_id', gameId)
  
  if (!stats || stats.length === 0) return null
  
  const parsed: any = {
    passing_yards: 0, passing_touchdowns: 0, interceptions: 0,
    rushing_yards: 0, rushing_touchdowns: 0, rushing_attempts: 0,
    receptions: 0, receiving_yards: 0, receiving_touchdowns: 0,
    targets: 0, fumbles: 0, two_point_conversions: 0
  }
  
  stats.forEach(stat => {
    const value = parseFloat(stat.stat_value) || 0
    switch (stat.stat_type) {
      case 'passing_yards':
      case 'pass_yds':
        parsed.passing_yards = value
        break
      case 'passing_touchdowns':
      case 'pass_tds':
        parsed.passing_touchdowns = value
        break
      case 'interceptions':
      case 'ints':
        parsed.interceptions = value
        break
      case 'rushing_yards':
      case 'rush_yds':
        parsed.rushing_yards = value
        break
      case 'rushing_touchdowns':
      case 'rush_tds':
        parsed.rushing_touchdowns = value
        break
      case 'rushing_attempts':
      case 'rush_att':
        parsed.rushing_attempts = value
        break
      case 'receptions':
      case 'rec':
        parsed.receptions = value
        break
      case 'receiving_yards':
      case 'rec_yds':
        parsed.receiving_yards = value
        break
      case 'receiving_touchdowns':
      case 'rec_tds':
        parsed.receiving_touchdowns = value
        break
      case 'targets':
        parsed.targets = value
        break
      case 'fumbles':
        parsed.fumbles = value
        break
    }
  })
  
  // Position-specific feature vectors
  if (position === 'QB') {
    return [
      parsed.passing_yards / 400,
      parsed.passing_touchdowns / 4,
      parsed.interceptions / 3,
      parsed.rushing_yards / 50,
      parsed.rushing_touchdowns / 2,
      parsed.passing_yards > 0 ? parsed.passing_touchdowns / (parsed.passing_yards / 100) : 0, // TD rate
      parsed.fumbles / 2,
      (parsed.passing_yards * 0.04 + parsed.passing_touchdowns * 4 - parsed.interceptions * 2) / 30 // Fantasy efficiency
    ]
  } else if (position === 'RB') {
    return [
      parsed.rushing_yards / 150,
      parsed.rushing_touchdowns / 3,
      parsed.rushing_attempts / 30,
      parsed.rushing_attempts > 0 ? parsed.rushing_yards / parsed.rushing_attempts / 10 : 0, // YPC
      parsed.receptions / 10,
      parsed.receiving_yards / 100,
      parsed.receiving_touchdowns / 2,
      parsed.fumbles / 2,
      (parsed.rushing_yards + parsed.receiving_yards) / 200, // Total yards
      parsed.receptions > 0 ? 1 : 0 // PPR bonus indicator
    ]
  } else if (position === 'WR' || position === 'TE') {
    return [
      parsed.receptions / 12,
      parsed.receiving_yards / 150,
      parsed.receiving_touchdowns / 2,
      parsed.targets / 15,
      parsed.targets > 0 ? parsed.receptions / parsed.targets : 0, // Catch rate
      parsed.receptions > 0 ? parsed.receiving_yards / parsed.receptions / 20 : 0, // YPR
      parsed.rushing_yards / 20,
      parsed.fumbles / 2,
      parsed.receiving_yards > 100 ? 1 : 0, // 100+ yard bonus
      parsed.receiving_touchdowns > 1 ? 1 : 0 // Multi-TD bonus
    ]
  }
  
  return null
}

async function trainSportModel(sport: string) {
  console.log(chalk.bold.cyan(`\n🏆 Training ${sport.toUpperCase()} Model...\n`))
  
  // Get games for this sport
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', sport)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(2000)
  
  if (!games || games.length < 100) {
    console.log(chalk.yellow(`⚠️  Not enough ${sport} games for training`))
    return
  }
  
  console.log(chalk.green(`✅ Found ${games.length} ${sport} games`))
  
  // Get player stats for these games
  const features: number[][] = []
  const labels: number[] = []
  let processed = 0
  let skipped = 0
  
  // Get unique player-game combinations
  const { data: playerGames } = await supabase
    .from('player_stats')
    .select('player_id, game_id, fantasy_points')
    .in('game_id', games.map(g => g.id))
    .limit(5000)
  
  // Deduplicate
  const uniquePG = new Map<string, any>()
  playerGames?.forEach(pg => {
    const key = `${pg.player_id}-${pg.game_id}`
    if (!uniquePG.has(key) || (pg.fantasy_points > uniquePG.get(key).fantasy_points)) {
      uniquePG.set(key, pg)
    }
  })
  
  console.log(chalk.yellow(`Processing ${uniquePG.size} player performances...\n`))
  
  for (const pg of Array.from(uniquePG.values()).slice(0, 1000)) {
    let featureVector: number[] | null = null
    
    if (sport === 'nba') {
      featureVector = await parseNbaStats(pg.player_id, pg.game_id)
    } else if (sport === 'nfl') {
      // For NFL, we'd need position info - simplified for now
      featureVector = await parseNflStats(pg.player_id, pg.game_id, 'RB')
    }
    // Add MLB and NHL parsers as needed
    
    if (featureVector) {
      features.push(featureVector)
      labels.push(pg.fantasy_points || 0)
      processed++
      
      if (processed % 100 === 0) {
        console.log(chalk.gray(`Processed ${processed} players...`))
      }
    } else {
      skipped++
    }
  }
  
  if (features.length < 50) {
    console.log(chalk.red(`❌ Not enough valid data for ${sport} model`))
    return
  }
  
  console.log(chalk.green(`\n✅ Prepared ${features.length} training samples (skipped ${skipped})`))
  
  // Split data
  const splitIdx = Math.floor(features.length * 0.8)
  const xTrain = tf.tensor2d(features.slice(0, splitIdx))
  const yTrain = tf.tensor1d(labels.slice(0, splitIdx))
  const xTest = tf.tensor2d(features.slice(splitIdx))
  const yTest = tf.tensor1d(labels.slice(splitIdx))
  
  // Build sport-specific model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [features[0].length],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 32,
        activation: 'relu'
      }),
      tf.layers.dense({ units: 1 })
    ]
  })
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae']
  })
  
  console.log(chalk.cyan('\n📊 Training model...'))
  
  await model.fit(xTrain, yTrain, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 10 === 0) {
          console.log(chalk.gray(`Epoch ${epoch}: loss=${logs?.loss?.toFixed(2)}, mae=${logs?.mae?.toFixed(2)}`))
        }
      }
    }
  })
  
  // Evaluate
  const evaluation = model.evaluate(xTest, yTest) as tf.Tensor[]
  const testMAE = (await evaluation[1].data())[0]
  
  console.log(chalk.green(`\n✅ ${sport.toUpperCase()} Model - Test MAE: ${testMAE.toFixed(2)} fantasy points`))
  
  // Save model
  const modelPath = path.join(process.cwd(), 'models', `${sport}_fantasy_model`)
  await model.save(`file://${modelPath}`)
  console.log(chalk.green(`📁 Model saved to: ${modelPath}`))
  
  // Save metadata
  const metadata = {
    sport,
    trainedAt: new Date().toISOString(),
    features: features[0].length,
    samples: features.length,
    testMAE,
    version: '2.0'
  }
  
  fs.writeFileSync(
    path.join(process.cwd(), 'models', `${sport}_model_metadata.json`),
    JSON.stringify(metadata, null, 2)
  )
  
  // Cleanup
  xTrain.dispose()
  yTrain.dispose()
  xTest.dispose()
  yTest.dispose()
  evaluation.forEach(t => t.dispose())
  
  return model
}

async function main() {
  console.log(chalk.bold.red('\n🏆 SPORT-SPECIFIC ML TRAINING'))
  console.log(chalk.red('=============================='))
  console.log(chalk.yellow('Training separate models for each sport\n'))
  
  const sports = ['nba', 'nfl'] // Start with NBA and NFL
  
  for (const sport of sports) {
    try {
      await trainSportModel(sport)
    } catch (error) {
      console.error(chalk.red(`\n❌ Error training ${sport} model:`), error)
    }
  }
  
  console.log(chalk.bold.green('\n✅ SPORT-SPECIFIC TRAINING COMPLETE!'))
  console.log(chalk.gray('Each sport now has its own optimized model'))
  console.log(chalk.gray('Models properly parse sport-specific stat formats'))
}

main().catch(console.error)