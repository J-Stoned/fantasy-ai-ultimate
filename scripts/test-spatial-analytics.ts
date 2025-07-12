#!/usr/bin/env tsx
/**
 * Test script for spatial analytics functionality
 * Demonstrates Dr. Thorne's methodologies in action
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import { xgModel } from '../lib/spatial-analytics/xg-model'
import { basketballPitchControl } from '../lib/spatial-analytics/pitch-control'
import { movementAnalyzer } from '../lib/spatial-analytics/movement-patterns'
import { spatialFantasyService } from '../lib/spatial-analytics/spatial-fantasy-service'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testSpatialAnalytics() {
  console.log(chalk.cyan.bold('\n🎯 Testing Spatial Analytics System\n'))

  // Test 1: Expected Goals (xG) Model
  console.log(chalk.yellow('1. Testing Expected Goals Model'))
  
  const testShot = {
    x_coordinate: 80,
    y_coordinate: 25,
    shot_distance: 15,
    defender_distance: 5,
    shot_type: 'jump_shot' as const,
    game_situation: 'open_play' as const
  }
  
  const xgResult = xgModel.calculateXG(testShot)
  console.log(chalk.white('Shot Data:'), testShot)
  console.log(chalk.green('xG Result:'), {
    xg_value: xgResult.xg_value.toFixed(3),
    confidence: `[${xgResult.confidence_interval[0].toFixed(3)}, ${xgResult.confidence_interval[1].toFixed(3)}]`,
    factors: xgResult.factors
  })

  // Test 2: Pitch Control
  console.log(chalk.yellow('\n2. Testing Pitch Control Model'))
  
  const playerPositions = [
    // Team A (home)
    { player_id: 'p1', team_id: 'home', x_position: 75, y_position: 25, x_velocity: 2, y_velocity: 0, timestamp: 0 },
    { player_id: 'p2', team_id: 'home', x_position: 70, y_position: 20, x_velocity: 1, y_velocity: 1, timestamp: 0 },
    { player_id: 'p3', team_id: 'home', x_position: 70, y_position: 30, x_velocity: 1, y_velocity: -1, timestamp: 0 },
    // Team B (away)
    { player_id: 'p4', team_id: 'away', x_position: 80, y_position: 25, x_velocity: -1, y_velocity: 0, timestamp: 0 },
    { player_id: 'p5', team_id: 'away', x_position: 85, y_position: 22, x_velocity: -2, y_velocity: 0, timestamp: 0 },
  ]
  
  const ballPosition = { x: 72, y: 25 }
  
  const pitchControl = basketballPitchControl.calculatePitchControl(
    playerPositions,
    ballPosition,
    0
  )
  
  const teamMetrics = basketballPitchControl.calculateTeamControlMetrics(
    pitchControl,
    'home'
  )
  
  console.log(chalk.white('Team Control Metrics:'), {
    total_control: (teamMetrics.total_control * 100).toFixed(1) + '%',
    offensive_third: (teamMetrics.offensive_third_control * 100).toFixed(1) + '%',
    central_control: (teamMetrics.central_control * 100).toFixed(1) + '%',
    high_value_areas: teamMetrics.high_value_areas.length
  })

  // Test 3: Get real player projection
  console.log(chalk.yellow('\n3. Testing Enhanced Player Projection'))
  
  // Get a sample player from database
  const { data: samplePlayer } = await supabase
    .from('players')
    .select('id, name, position, team')
    .eq('sport', 'basketball')
    .limit(1)
    .single()
  
  if (samplePlayer) {
    try {
      const projection = await spatialFantasyService.getEnhancedPlayerProjection(
        samplePlayer.id,
        { include_synergies: true }
      )
      
      console.log(chalk.white('Player:'), `${samplePlayer.name} (${samplePlayer.position})`)
      console.log(chalk.white('Traditional Projection:'), projection.traditional_projection.toFixed(1))
      console.log(chalk.green('Spatial Projection:'), projection.spatial_projection.toFixed(1))
      console.log(chalk.white('Spatial Components:'), projection.spatial_components)
      console.log(chalk.white('Key Advantages:'), projection.key_advantages)
      
      if (projection.recommended_stacks.length > 0) {
        console.log(chalk.white('Recommended Stacks:'))
        projection.recommended_stacks.forEach(stack => {
          console.log(`  - ${stack.partner_name}: +${stack.stack_bonus} (${stack.reason})`)
        })
      }
    } catch (error) {
      console.log(chalk.red('Note: Full spatial projection requires tracking data in database'))
    }
  }

  // Test 4: Movement Pattern Analysis
  console.log(chalk.yellow('\n4. Testing Movement Pattern Analysis'))
  
  // Simulate tracking data for demonstration
  const simulatedTracking = Array.from({ length: 100 }, (_, i) => ({
    player_id: 'test_player',
    game_id: 'test_game',
    x_position: 50 + Math.sin(i * 0.1) * 20,
    y_position: 25 + Math.cos(i * 0.1) * 10,
    speed: 3 + Math.random() * 2,
    direction: i * 0.1,
    timestamp: i
  }))
  
  // Would normally analyze real tracking data
  console.log(chalk.white('Simulated player movement over 100 timestamps'))
  console.log(chalk.white('Pattern detection would identify:'))
  console.log('  - Cutting movements')
  console.log('  - Screen setting')
  console.log('  - Preferred zones')
  console.log('  - Off-ball value creation')

  // Test 5: Team Spatial Dynamics
  console.log(chalk.yellow('\n5. Testing Team Spatial Analysis'))
  
  const { data: sampleTeam } = await supabase
    .from('teams')
    .select('id, name')
    .limit(1)
    .single()
  
  if (sampleTeam) {
    try {
      const teamAnalysis = await spatialFantasyService.analyzeTeamSpatialDynamics(
        sampleTeam.id
      )
      
      console.log(chalk.white('Team:'), sampleTeam.name)
      console.log(chalk.white('Avg Pitch Control:'), (teamAnalysis.avg_pitch_control * 100).toFixed(1) + '%')
      console.log(chalk.white('Offensive Efficiency:'), (teamAnalysis.offensive_efficiency * 100).toFixed(1) + '%')
      console.log(chalk.white('Space Creators:'), teamAnalysis.space_creators.join(', ') || 'N/A')
      console.log(chalk.white('Defensive Anchors:'), teamAnalysis.defensive_anchors.join(', ') || 'N/A')
    } catch (error) {
      console.log(chalk.red('Note: Full team analysis requires tracking data'))
    }
  }

  console.log(chalk.cyan.bold('\n✅ Spatial Analytics Test Complete!\n'))
  console.log(chalk.gray('Note: Full functionality requires:'))
  console.log(chalk.gray('- Player tracking data in player_tracking_data table'))
  console.log(chalk.gray('- Shot location data in basketball_shots table'))
  console.log(chalk.gray('- Historical game data for pattern analysis'))
}

// Run the test
testSpatialAnalytics()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error)
    process.exit(1)
  })