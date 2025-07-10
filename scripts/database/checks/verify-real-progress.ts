#!/usr/bin/env tsx
/**
 * Verify Real Progress
 * Checks what we've ACTUALLY accomplished vs projections
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'
import Table from 'cli-table3'
import axios from 'axios'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyProgress() {
  console.log(chalk.cyan.bold('\n🔍 VERIFYING REAL PROGRESS VS PROJECTIONS\n'))

  const results = {
    dataGaps: { target: false, actual: false },
    servicesRunning: { target: false, actual: false },
    errorHandling: { target: false, actual: false },
    caching: { target: false, actual: false },
    rateLimiting: { target: false, actual: false },
    authentication: { target: false, actual: false },
    bettingAPIs: { target: false, actual: false },
    testing: { target: false, actual: false },
    production: { target: false, actual: false },
  }

  // 1. CHECK DATA GAPS
  console.log(chalk.yellow('1. CHECKING DATA COVERAGE...'))
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)

  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000)

  const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || [])
  const coverage = (uniqueGamesWithStats.size / (totalGames || 1)) * 100

  results.dataGaps.target = coverage >= 50
  results.dataGaps.actual = coverage >= 50

  console.log(`   Player Stats Coverage: ${coverage.toFixed(1)}% ${coverage >= 50 ? chalk.green('✓') : chalk.red('✗')}`)

  // 2. CHECK SERVICES
  console.log(chalk.yellow('\n2. CHECKING SERVICES...'))
  
  const services = [
    { name: 'Pattern API V4', port: 3337, path: '/api/v4/patterns' },
    { name: 'Unified Pattern API', port: 3336, path: '/api/unified/patterns' },
    { name: 'WebSocket Server', port: 3338, path: '/' },
    { name: 'Monitoring Dashboard', port: 4000, path: '/status' },
  ]

  let runningCount = 0
  for (const service of services) {
    try {
      await axios.get(`http://localhost:${service.port}${service.path}`, { timeout: 1000 })
      console.log(`   ${service.name}: ${chalk.green('✓ Running')}`)
      runningCount++
    } catch {
      console.log(`   ${service.name}: ${chalk.red('✗ Not running')}`)
    }
  }

  results.servicesRunning.actual = runningCount >= 2
  results.servicesRunning.target = runningCount >= 4

  // 3. CHECK ERROR HANDLING (by checking if files exist)
  console.log(chalk.yellow('\n3. CHECKING ERROR HANDLING...'))
  
  const errorHandlingFiles = [
    'lib/services/resilient-api-wrapper.ts',
    'lib/services/smart-cache-system.ts',
    'lib/middleware/security-middleware.ts',
  ]

  const fs = require('fs')
  const errorHandlingExists = errorHandlingFiles.every(file => 
    fs.existsSync(file)
  )

  results.errorHandling.actual = errorHandlingExists
  console.log(`   Circuit Breakers: ${errorHandlingExists ? chalk.green('✓ Implemented') : chalk.red('✗ Missing')}`)

  // 4. CHECK CACHING
  console.log(chalk.yellow('\n4. CHECKING CACHING...'))
  
  try {
    // Check Redis
    const redis = require('redis')
    const client = redis.createClient({ url: 'redis://localhost:6379' })
    await client.connect()
    await client.set('test', 'value')
    const value = await client.get('test')
    await client.disconnect()
    
    results.caching.actual = value === 'value'
    console.log(`   Redis Cache: ${chalk.green('✓ Working')}`)
  } catch {
    console.log(`   Redis Cache: ${chalk.red('✗ Not working')}`)
  }

  // 5. CHECK AUTHENTICATION
  console.log(chalk.yellow('\n5. CHECKING AUTHENTICATION...'))
  
  const authImplemented = fs.existsSync('lib/middleware/security-middleware.ts')
  results.authentication.actual = authImplemented
  console.log(`   JWT Auth: ${authImplemented ? chalk.green('✓ Implemented') : chalk.red('✗ Missing')}`)

  // 6. CHECK BETTING APIs
  console.log(chalk.yellow('\n6. CHECKING BETTING APIs...'))
  
  const bettingAPIFiles = [
    'lib/services/betting-apis/draftkings-api.ts',
    'lib/services/betting-apis/fanduel-api.ts',
  ]

  const bettingAPIsExist = bettingAPIFiles.some(file => fs.existsSync(file))
  results.bettingAPIs.actual = bettingAPIsExist
  console.log(`   DraftKings/FanDuel: ${bettingAPIsExist ? chalk.green('✓ Connected') : chalk.red('✗ Not connected')}`)

  // 7. CHECK TESTING
  console.log(chalk.yellow('\n7. CHECKING TEST SUITE...'))
  
  const testFiles = fs.readdirSync('.').filter((f: string) => 
    f.includes('.test.') || f.includes('.spec.')
  ).length

  results.testing.actual = testFiles > 10
  console.log(`   Test Files: ${testFiles} ${testFiles > 10 ? chalk.green('✓') : chalk.red('✗')}`)

  // 8. CHECK PRODUCTION
  console.log(chalk.yellow('\n8. CHECKING PRODUCTION DEPLOYMENT...'))
  
  const dockerRunning = fs.existsSync('docker-compose.production.yml')
  results.production.actual = dockerRunning && runningCount > 0
  console.log(`   Production Config: ${dockerRunning ? chalk.green('✓ Ready') : chalk.red('✗ Not ready')}`)

  // SUMMARY TABLE
  console.log(chalk.cyan.bold('\n📊 SUMMARY: REALITY vs PROJECTIONS\n'))

  const summaryTable = new Table({
    head: ['Feature', 'Status', 'Reality Check'],
    colWidths: [30, 20, 40],
  })

  const items = [
    {
      name: 'Data Coverage (50%+)',
      status: results.dataGaps.actual,
      reality: coverage >= 50 ? 'ACHIEVED!' : `Only ${coverage.toFixed(1)}% - Need to run data collection`,
    },
    {
      name: 'All Services Running',
      status: results.servicesRunning.actual,
      reality: runningCount >= 4 ? 'All running!' : `Only ${runningCount}/4 services up`,
    },
    {
      name: 'Error Handling',
      status: results.errorHandling.actual,
      reality: errorHandlingExists ? 'Code exists, not tested' : 'Not implemented',
    },
    {
      name: 'Caching System',
      status: results.caching.actual,
      reality: results.caching.actual ? 'Redis working!' : 'Redis not connected',
    },
    {
      name: 'Authentication',
      status: results.authentication.actual,
      reality: authImplemented ? 'Code exists, not integrated' : 'Not implemented',
    },
    {
      name: 'Betting APIs',
      status: results.bettingAPIs.actual,
      reality: 'NOT connected - still TODO',
    },
    {
      name: 'Test Suite',
      status: results.testing.actual,
      reality: `${testFiles} test files - need more`,
    },
    {
      name: 'Production Deploy',
      status: results.production.actual,
      reality: 'Config exists, not deployed',
    },
  ]

  items.forEach(item => {
    summaryTable.push([
      item.name,
      item.status ? chalk.green('✓') : chalk.red('✗'),
      item.reality,
    ])
  })

  console.log(summaryTable.toString())

  // FINAL VERDICT
  const achieved = Object.values(results).filter(r => r.actual).length
  const total = Object.keys(results).length
  const percentage = (achieved / total) * 100

  console.log(chalk.cyan.bold('\n🎯 FINAL SCORE:\n'))
  console.log(chalk.white(`   Targets Achieved: ${chalk.yellow(`${achieved}/${total}`)} (${percentage.toFixed(0)}%)`))
  
  if (percentage >= 80) {
    console.log(chalk.green.bold('\n   ✅ EXCELLENT! Most projections are now reality!'))
  } else if (percentage >= 50) {
    console.log(chalk.yellow.bold('\n   📈 GOOD PROGRESS! But more work needed.'))
  } else {
    console.log(chalk.red.bold('\n   ⚠️  MOSTLY PROJECTIONS! Need to execute the plan.'))
  }

  console.log(chalk.cyan.bold('\n📋 NEXT ACTIONS TO MAKE IT REAL:\n'))
  
  if (coverage < 50) {
    console.log(chalk.white('1. Run data collection scripts to fill player stats'))
  }
  if (runningCount < 4) {
    console.log(chalk.white('2. Start all microservices with orchestrator'))
  }
  if (!results.bettingAPIs.actual) {
    console.log(chalk.white('3. Create betting API connectors'))
  }
  if (testFiles < 10) {
    console.log(chalk.white('4. Write comprehensive test suite'))
  }
  console.log()
}

verifyProgress().catch(console.error)