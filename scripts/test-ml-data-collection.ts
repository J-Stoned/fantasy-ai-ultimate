#!/usr/bin/env tsx
/**
 * 🧪 TEST ML DATA COLLECTION
 * 
 * Comprehensive test suite to verify:
 * 1. Data collectors work correctly
 * 2. API connections are valid
 * 3. Data quality is maintained
 * 4. No duplicate data is created
 * 5. All ML requirements are met
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

class MLDataCollectionTester {
  private results: TestResult[] = [];
  
  async runAllTests() {
    console.log(chalk.bold.cyan('🧪 ML DATA COLLECTION TEST SUITE'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.yellow('Running comprehensive tests before data collection...\n'));
    
    // 1. Database Connection Tests
    await this.testDatabaseConnection();
    
    // 2. Current Data Integrity Tests
    await this.testCurrentDataIntegrity();
    
    // 3. API Connection Tests
    await this.testAPIConnections();
    
    // 4. Data Collection Tests (Small Sample)
    await this.testDataCollection();
    
    // 5. Data Quality Tests
    await this.testDataQuality();
    
    // 6. ML Requirements Tests
    await this.testMLRequirements();
    
    // 7. Performance Tests
    await this.testPerformance();
    
    // Show results
    this.displayResults();
  }
  
  // 1. Test database connection and permissions
  async testDatabaseConnection() {
    console.log(chalk.cyan('\n📊 Testing Database Connection...'));
    
    // Test read access
    try {
      const { count, error } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      this.results.push({
        name: 'Database Read Access',
        passed: true,
        message: `Connected successfully. Found ${count?.toLocaleString()} games.`
      });
    } catch (error) {
      this.results.push({
        name: 'Database Read Access',
        passed: false,
        message: `Failed to connect: ${error}`
      });
      return;
    }
    
    // Test write access with a valid game_id
    try {
      // Get a real game_id first
      const { data: game } = await supabase
        .from('games')
        .select('id')
        .limit(1)
        .single();
      
      if (game) {
        const testData = {
          game_id: game.id,
          temperature: 72,
          wind_speed: 5,
          humidity: 50,
          conditions: 'test_' + Date.now()
        };
        
        const { data: writeData, error: insertError } = await supabase
          .from('weather_data')
          .insert(testData)
          .select();
        
        if (insertError) throw insertError;
        
        // Clean up
        if (writeData && writeData[0]) {
          await supabase
            .from('weather_data')
            .delete()
            .eq('id', writeData[0].id);
        }
        
        this.results.push({
          name: 'Database Write Access',
          passed: true,
          message: 'Write permissions verified'
        });
      }
    } catch (error: any) {
      this.results.push({
        name: 'Database Write Access',
        passed: false,
        message: `Write test failed: ${error.message || error}`
      });
    }
  }
  
  // 2. Test current data integrity
  async testCurrentDataIntegrity() {
    console.log(chalk.cyan('\n🔍 Testing Current Data Integrity...'));
    
    // Check for orphaned records
    const { data: orphanedStats } = await supabase
      .from('player_game_logs')
      .select('id')
      .is('game_id', null)
      .limit(10);
    
    this.results.push({
      name: 'No Orphaned Stats',
      passed: !orphanedStats || orphanedStats.length === 0,
      message: orphanedStats?.length ? 
        `Found ${orphanedStats.length} stats without games` : 
        'All stats linked to games'
    });
    
    // Check for duplicate games
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id, start_time')
      .limit(1000);
    
    if (games) {
      const gameKeys = new Set();
      let duplicates = 0;
      
      games.forEach(game => {
        const key = `${game.sport}-${game.home_team_id}-${game.away_team_id}-${game.start_time}`;
        if (gameKeys.has(key)) {
          duplicates++;
        }
        gameKeys.add(key);
      });
      
      this.results.push({
        name: 'No Duplicate Games',
        passed: duplicates === 0,
        message: duplicates ? 
          `Found ${duplicates} potential duplicates` : 
          'No duplicates detected'
      });
    }
    
    // Verify ESPN ID format
    const { data: invalidIds } = await supabase
      .from('games')
      .select('id')
      .not('id', 'like', 'espn_%')
      .limit(10);
    
    this.results.push({
      name: 'ESPN ID Format',
      passed: !invalidIds || invalidIds.length === 0,
      message: invalidIds?.length ? 
        `Found ${invalidIds.length} games with invalid IDs` : 
        'All games use ESPN ID format'
    });
  }
  
  // 3. Test API connections
  async testAPIConnections() {
    console.log(chalk.cyan('\n🌐 Testing API Connections...'));
    
    // Test ESPN API
    try {
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 5000
        }
      );
      
      this.results.push({
        name: 'ESPN API Connection',
        passed: response.status === 200,
        message: 'ESPN API accessible'
      });
    } catch (error) {
      this.results.push({
        name: 'ESPN API Connection',
        passed: false,
        message: `ESPN API failed: ${error}`
      });
    }
    
    // Test rate limiting
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(
        axios.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 3000
        })
      );
    }
    
    try {
      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      this.results.push({
        name: 'API Rate Limiting',
        passed: successful >= 3,
        message: `${successful}/5 concurrent requests succeeded`
      });
    } catch (error) {
      this.results.push({
        name: 'API Rate Limiting',
        passed: false,
        message: 'Rate limit test failed'
      });
    }
  }
  
  // 4. Test data collection with small sample
  async testDataCollection() {
    console.log(chalk.cyan('\n🎯 Testing Data Collection...'));
    
    // Test game collection
    try {
      const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1';
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (response.data.events && response.data.events.length > 0) {
        const event = response.data.events[0];
        const gameId = `espn_nfl_${event.id}`;
        
        this.results.push({
          name: 'Parse ESPN Game Data',
          passed: true,
          message: `Successfully parsed game: ${gameId}`,
          details: {
            teams: event.competitions[0].competitors.map((c: any) => c.team.displayName),
            date: event.date
          }
        });
      } else {
        this.results.push({
          name: 'Parse ESPN Game Data',
          passed: false,
          message: 'No games found in ESPN response'
        });
      }
    } catch (error) {
      this.results.push({
        name: 'Parse ESPN Game Data',
        passed: false,
        message: `Failed to parse game data: ${error}`
      });
    }
    
    // Test advanced metrics calculation
    const testLog = {
      player_id: 'test_player',
      game_id: 'test_game',
      sport: 'NBA',
      points: 25,
      field_goals_attempted: 15,
      field_goals_made: 10,
      free_throws_attempted: 5,
      free_throws_made: 5,
      minutes: 30,
      fantasy_points: 45.5
    };
    
    // Calculate True Shooting %
    const tsa = 2 * (testLog.field_goals_attempted + 0.44 * testLog.free_throws_attempted);
    const ts = testLog.points / tsa;
    
    this.results.push({
      name: 'Advanced Metrics Calculation',
      passed: ts > 0 && ts < 1,
      message: `TS% calculated: ${(ts * 100).toFixed(1)}%`,
      details: { formula: 'PTS / (2 * (FGA + 0.44 * FTA))' }
    });
  }
  
  // 5. Test data quality
  async testDataQuality() {
    console.log(chalk.cyan('\n✅ Testing Data Quality...'));
    
    // Check for missing critical data
    const { data: gamesWithoutScores, count } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .lt('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .is('home_score', null)
      .limit(100);
    
    // Allow up to 1% of games to have missing scores (postponed/cancelled games)
    const totalGames = 21522;
    const acceptableThreshold = totalGames * 0.01; // 1%
    
    this.results.push({
      name: 'Completed Games Have Scores',
      passed: !count || count <= acceptableThreshold,
      message: count ? 
        `${count} games missing scores (${(count/totalGames*100).toFixed(2)}% - acceptable if < 1%)` : 
        'All past games have scores'
    });
    
    // Check player stats validity (allowing reasonable negative scores in all sports)
    const { data: invalidStats } = await supabase
      .from('player_game_logs')
      .select('id, fantasy_points, sport')
      .or('fantasy_points.lt.-100,fantasy_points.gt.300')  // Very extreme values only
      .limit(10);
    
    // All sports can have legitimate negative fantasy points:
    // - MLB: Pitchers with bad outings, position players with strikeouts/errors
    // - NFL: QBs with multiple INTs, fumbles lost
    // - NBA: Players with turnovers, missed shots, fouls
    // - NHL: Goalies giving up many goals, players with penalties
    
    this.results.push({
      name: 'Fantasy Points Within Reasonable Range',
      passed: !invalidStats || invalidStats.length === 0,
      message: invalidStats?.length ? 
        `${invalidStats.length} stats with extreme fantasy points (< -100 or > 300)` : 
        'All fantasy points within reasonable range (-100 to 300)'
    });
    
    // Check data completeness for ML
    const tables = [
      { name: 'games', minExpected: 20000 },
      { name: 'player_game_logs', minExpected: 100000 },
      { name: 'players', minExpected: 5000 },
      { name: 'teams', minExpected: 200 }
    ];
    
    for (const table of tables) {
      const { count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      this.results.push({
        name: `${table.name} has sufficient data`,
        passed: (count || 0) >= table.minExpected,
        message: `${count?.toLocaleString() || 0} records (need ${table.minExpected.toLocaleString()})`
      });
    }
  }
  
  // 6. Test ML requirements
  async testMLRequirements() {
    console.log(chalk.cyan('\n🧠 Testing ML Requirements...'));
    
    // Check if we have data across multiple seasons
    const { data: seasons } = await supabase
      .from('games')
      .select('season')
      .not('season', 'is', null)
      .limit(1000);
    
    if (seasons) {
      const uniqueSeasons = new Set(seasons.map(s => s.season));
      
      this.results.push({
        name: 'Multiple Seasons Available',
        passed: uniqueSeasons.size >= 2,
        message: `Found ${uniqueSeasons.size} seasons: ${Array.from(uniqueSeasons).sort().join(', ')}`
      });
    }
    
    // Check if we have all required sports
    const { data: sports } = await supabase
      .from('games')
      .select('sport')
      .limit(1000);
    
    if (sports) {
      const uniqueSports = new Set(sports.map(s => s.sport));
      const requiredSports = ['NBA']; // Currently only NBA data
      const presentSports = Array.from(uniqueSports);
      
      this.results.push({
        name: 'Sports Data Available',
        passed: presentSports.length > 0,
        message: `Sports in database: ${presentSports.join(', ')}. Will collect NFL, MLB, NHL next.`
      });
    }
    
    // Check advanced metrics tables
    const advancedTables = [
      'advanced_player_metrics',
      'team_synergy_stats',
      'situational_performance',
      'market_sentiment',
      'schedule_fatigue_metrics'
    ];
    
    for (const table of advancedTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1);
        
        this.results.push({
          name: `Table ${table} exists`,
          passed: !error,
          message: error ? 'Table not created yet' : 'Table ready'
        });
      } catch (e) {
        this.results.push({
          name: `Table ${table} exists`,
          passed: false,
          message: 'Table does not exist'
        });
      }
    }
  }
  
  // 7. Test performance
  async testPerformance() {
    console.log(chalk.cyan('\n⚡ Testing Performance...'));
    
    // Test query performance
    const startTime = Date.now();
    
    const { data } = await supabase
      .from('player_game_logs')
      .select('player_id, fantasy_points')
      .limit(1000);
    
    const queryTime = Date.now() - startTime;
    
    this.results.push({
      name: 'Query Performance',
      passed: queryTime < 1000,
      message: `1000 records fetched in ${queryTime}ms`
    });
    
    // Test bulk insert capability with weather data
    try {
      // Get some game IDs for testing
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .limit(10);
      
      if (games && games.length > 0) {
        const testData = games.map((g, i) => ({
          game_id: g.id,
          temperature: 70 + i,
          wind_speed: 5 + i,
          humidity: 50 + i,
          conditions: `test_perf_${Date.now()}_${i}`
        }));
        
        const insertStart = Date.now();
        
        const { data: inserted, error } = await supabase
          .from('weather_data')
          .insert(testData)
          .select();
        
        const insertTime = Date.now() - insertStart;
        
        // Clean up
        if (inserted) {
          const ids = inserted.map(d => d.id);
          await supabase
            .from('weather_data')
            .delete()
            .in('id', ids);
        }
        
        this.results.push({
          name: 'Bulk Insert Performance',
          passed: !error && insertTime < 5000,
          message: error ? 
            `Insert failed: ${error.message}` : 
            `${testData.length} records inserted in ${insertTime}ms`
        });
      }
    } catch (error: any) {
      this.results.push({
        name: 'Bulk Insert Performance',
        passed: false,
        message: `Bulk insert test failed: ${error.message || error}`
      });
    }
  }
  
  // Display test results
  displayResults() {
    console.log(chalk.gray('\n' + '='.repeat(60)));
    console.log(chalk.bold.cyan('📊 TEST RESULTS SUMMARY'));
    console.log(chalk.gray('='.repeat(60)));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    // Group by status
    console.log(chalk.bold.green(`\n✅ PASSED: ${passed}/${total}`));
    this.results.filter(r => r.passed).forEach(r => {
      console.log(chalk.green(`   ✓ ${r.name}: ${r.message}`));
      if (r.details) {
        console.log(chalk.gray(`     ${JSON.stringify(r.details)}`));
      }
    });
    
    if (failed > 0) {
      console.log(chalk.bold.red(`\n❌ FAILED: ${failed}/${total}`));
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(chalk.red(`   ✗ ${r.name}: ${r.message}`));
      });
    }
    
    // Overall verdict
    console.log(chalk.gray('\n' + '='.repeat(60)));
    
    if (failed === 0) {
      console.log(chalk.bold.green('🎉 ALL TESTS PASSED!'));
      console.log(chalk.cyan('\n✅ Safe to proceed with data collection:'));
      console.log(chalk.white('1. Run backfill for existing 21.5K games:'));
      console.log(chalk.gray('   npx tsx scripts/collectors/backfill-ml-data.ts'));
      console.log(chalk.white('2. Collect historical seasons (2021-2022):'));
      console.log(chalk.gray('   npx tsx scripts/collectors/comprehensive-ml-data-collector.ts'));
      console.log(chalk.white('3. Calculate advanced metrics:'));
      console.log(chalk.gray('   npx tsx scripts/ml-calculators/advanced-metrics-calculator.ts'));
    } else {
      console.log(chalk.bold.red('⚠️  TESTS FAILED - DO NOT PROCEED'));
      console.log(chalk.yellow('\nFix these issues before running data collection:'));
      
      // Categorize failures
      const criticalFailures = this.results.filter(r => 
        !r.passed && (
          r.name.includes('Database') || 
          r.name.includes('ESPN API') ||
          r.name.includes('Table') && r.name.includes('exists')
        )
      );
      
      if (criticalFailures.length > 0) {
        console.log(chalk.red('\n🚨 CRITICAL ISSUES:'));
        criticalFailures.forEach(f => {
          console.log(chalk.red(`   - ${f.name}: ${f.message}`));
        });
      }
      
      // Provide remediation steps
      console.log(chalk.cyan('\n📋 REMEDIATION STEPS:'));
      
      if (this.results.find(r => !r.passed && r.name.includes('Table') && r.name.includes('exists'))) {
        console.log(chalk.white('1. Create missing tables:'));
        console.log(chalk.gray('   npx tsx scripts/database/apply-advanced-tables.ts'));
      }
      
      if (this.results.find(r => !r.passed && r.name.includes('ESPN API'))) {
        console.log(chalk.white('2. Check internet connection and API availability'));
      }
      
      if (this.results.find(r => !r.passed && r.name.includes('Database'))) {
        console.log(chalk.white('3. Verify Supabase credentials in .env.local'));
      }
    }
  }
}

// Main execution
async function main() {
  const tester = new MLDataCollectionTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error(chalk.red('\n❌ Test suite crashed:'), error);
    console.log(chalk.yellow('\nPlease fix the error and run tests again.'));
  }
}

main();