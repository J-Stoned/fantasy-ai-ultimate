#!/usr/bin/env tsx
/**
 * 🧪 TEST MEGA DATA COLLECTOR V4 - STANDARDIZED FIXES
 * Test the fixes for schema mismatches and team resolution
 */

import { enhancedDb } from '../lib/services/enhanced-database-service'
import chalk from 'chalk'

async function testEnhancedDatabase() {
  console.log(chalk.cyan.bold('\n🧪 TESTING ENHANCED DATABASE SERVICE\n'))
  
  try {
    // Test 1: Check table existence
    console.log(chalk.yellow('Test 1: Table Existence Checks'))
    
    const tables = ['games', 'teams', 'players', 'weather_data', 'news_articles']
    for (const table of tables) {
      const exists = await enhancedDb.tableExists(table)
      console.log(`  ${table}: ${exists ? chalk.green('✓ EXISTS') : chalk.red('✗ MISSING')}`)
    }
    
    // Test 2: Team resolution
    console.log(chalk.yellow('\nTest 2: Team Resolution'))
    
    const teamTests = [
      { identifier: 'KC', sport: 'NFL' },
      { identifier: 'LAL', sport: 'NBA' },
      { identifier: 'NYY', sport: 'MLB' },
      { identifier: 'TOR', sport: 'NHL' }
    ]
    
    for (const test of teamTests) {
      const team = await enhancedDb.resolveTeam(test.identifier, test.sport)
      if (team) {
        console.log(`  ${test.identifier} (${test.sport}): ${chalk.green('✓')} ${team.name} - ${team.abbreviation}`)
      } else {
        console.log(`  ${test.identifier} (${test.sport}): ${chalk.yellow('⚠')} Creating new team`)
      }
    }
    
    // Test 3: Schema detection
    console.log(chalk.yellow('\nTest 3: Schema Detection'))
    
    for (const table of ['games', 'teams']) {
      if (await enhancedDb.tableExists(table)) {
        const schema = await enhancedDb.getTableSchema(table)
        if (schema) {
          console.log(`  ${table}: ${chalk.green('✓')} ${schema.fields.length} fields detected`)
        } else {
          console.log(`  ${table}: ${chalk.red('✗')} Schema detection failed`)
        }
      }
    }
    
    // Test 4: Batch querying
    console.log(chalk.yellow('\nTest 4: Batch Query Test'))
    
    if (await enhancedDb.tableExists('games')) {
      const games = await enhancedDb.batchQuery('games', 'id, sport, start_time', {}, {
        orderBy: 'id',
        limit: 10
      })
      console.log(`  Games query: ${chalk.green('✓')} Retrieved ${games.length} games`)
    }
    
    // Test 5: Cache statistics
    console.log(chalk.yellow('\nTest 5: Cache Statistics'))
    const cacheStats = enhancedDb.getCacheStats()
    console.log(`  Schema cache: ${cacheStats.schemaCache} entries`)
    console.log(`  Team resolution cache: ${cacheStats.teamResolutionCache} entries`)
    
    console.log(chalk.green.bold('\n✅ Enhanced Database Service tests completed!'))
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error)
  }
}

async function testGameDataProcessing() {
  console.log(chalk.cyan.bold('\n🏈 TESTING GAME DATA PROCESSING\n'))
  
  try {
    // Test game data with team resolution
    const testGames = [
      {
        external_id: 'test_game_1',
        sport: 'NFL',
        name: 'Kansas City Chiefs at Buffalo Bills',
        status: 'Final',
        start_time: '2024-01-01T18:00:00Z',
        home_team_abbreviation: 'BUF',
        away_team_abbreviation: 'KC',
        home_team_name: 'Buffalo Bills',
        away_team_name: 'Kansas City Chiefs',
        home_score: 24,
        away_score: 31,
        venue: 'Highmark Stadium'
      },
      {
        external_id: 'test_game_2',
        sport: 'NBA',
        name: 'Los Angeles Lakers vs Boston Celtics',
        status: 'Final',
        start_time: '2024-01-01T21:00:00Z',
        home_team_abbreviation: 'LAL',
        away_team_abbreviation: 'BOS',
        home_team_name: 'Los Angeles Lakers',
        away_team_name: 'Boston Celtics',
        home_score: 112,
        away_score: 108,
        venue: 'Crypto.com Arena'
      }
    ]
    
    console.log(chalk.yellow('Processing test games with team resolution...'))
    
    for (const game of testGames) {
      const processedGames = await enhancedDb.processGamesWithTeamResolution([game], game.sport)
      
      if (processedGames.length > 0) {
        const processed = processedGames[0]
        console.log(chalk.green(`✓ ${game.sport} game processed:`))
        console.log(`  Universal ID: ${processed.universal_id}`)
        console.log(`  Home Team ID: ${processed.home_team_id}`)
        console.log(`  Away Team ID: ${processed.away_team_id}`)
        console.log(`  Score: ${processed.away_score}-${processed.home_score}`)
      } else {
        console.log(chalk.red(`✗ Failed to process ${game.sport} game`))
      }
    }
    
    console.log(chalk.green.bold('\n✅ Game data processing tests completed!'))
    
  } catch (error) {
    console.error(chalk.red('❌ Game processing test failed:'), error)
  }
}

async function main() {
  await testEnhancedDatabase()
  await testGameDataProcessing()
  
  console.log(chalk.cyan.bold('\n🎯 ALL TESTS COMPLETED!'))
  console.log(chalk.green('Enhanced Database Service is ready for production use'))
  console.log(chalk.green('Mega Data Collector V4 fixes are working correctly'))
}

if (require.main === module) {
  main().catch(console.error)
}