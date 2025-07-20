#!/usr/bin/env tsx
/**
 * 🔍 COMPREHENSIVE 2021 DATA DIAGNOSTIC
 * 
 * Checks ALL aspects of our 2021-2022 season data:
 * - All sports (including NCAA)
 * - Games, stats, betting lines, weather, injuries
 * - ML enrichment tables
 * - Data quality issues
 */

import { queryMany, queryOne } from '../utils/local-db-pool.js';
import chalk from 'chalk';

// Define all expected sports and their 2021 seasons
const SEASONS_2021 = {
  NFL: { name: 'NFL 2021', start: '2021-09-01', end: '2022-02-15', sport: 'NFL' },
  NBA: { name: 'NBA 2021-22', start: '2021-10-01', end: '2022-07-01', sport: 'NBA' },
  NHL: { name: 'NHL 2021-22', start: '2021-10-01', end: '2022-07-01', sport: 'NHL' },
  MLB: { name: 'MLB 2021', start: '2021-03-01', end: '2021-11-30', sport: 'MLB' },
  MILB: { name: 'MiLB 2021', start: '2021-05-01', end: '2021-10-01', sport: 'MILB' },
  NCAA_FB: { name: 'NCAA Football 2021', start: '2021-08-01', end: '2022-01-15', sport: 'NCAA_FB' },
  NCAA_BB: { name: 'NCAA Basketball 2021-22', start: '2021-11-01', end: '2022-04-15', sport: 'NCAA_BB' },
  NCAA_BASEBALL: { name: 'NCAA Baseball 2021', start: '2021-02-01', end: '2021-07-01', sport: 'NCAA_BASEBALL' },
  NCAA_HKY: { name: 'NCAA Hockey 2021-22', start: '2021-10-01', end: '2022-04-15', sport: 'NCAA_HKY' }
};

async function runComprehensiveDiagnostic() {
  console.log(chalk.cyan('🔍 COMPREHENSIVE 2021-2022 DATA DIAGNOSTIC\n'));
  console.log(chalk.cyan('=' .repeat(60) + '\n'));

  try {
    // 1. Check what sports exist in our database
    console.log(chalk.yellow('1️⃣ SPORTS IN DATABASE:'));
    const sportsResult = await queryMany(`
      SELECT sport, COUNT(*) as total_games
      FROM games
      WHERE sport IS NOT NULL
      GROUP BY sport
      ORDER BY sport
    `);
    
    const existingSports = new Set(sportsResult.map(s => s.sport));
    console.log(chalk.green('Found sports:'), sportsResult.map(s => `${s.sport} (${s.total_games} games)`).join(', '));
    
    // Check for NULL sports
    const nullSports = await queryOne('SELECT COUNT(*) as count FROM games WHERE sport IS NULL');
    if (parseInt(nullSports.count) > 0) {
      console.log(chalk.red(`⚠️  Games with NULL sport: ${nullSports.count}`));
    }
    
    // Check for missing expected sports
    const missingSports = Object.keys(SEASONS_2021).filter(sport => !existingSports.has(sport));
    if (missingSports.length > 0) {
      console.log(chalk.red('❌ Missing expected sports:'), missingSports.join(', '));
    }
    
    // 2. Check each sport's 2021 data
    console.log(chalk.yellow('\n2️⃣ 2021-2022 SEASON DATA BY SPORT:'));
    console.log(chalk.gray('-'.repeat(60)));
    
    const detailedStats = {};
    
    for (const [key, season] of Object.entries(SEASONS_2021)) {
      console.log(chalk.cyan(`\n📊 ${season.name}:`));
      console.log(chalk.gray(`Expected dates: ${season.start} to ${season.end}`));
      
      // Check if sport exists
      if (!existingSports.has(season.sport)) {
        console.log(chalk.red(`❌ Sport '${season.sport}' not found in database!`));
        continue;
      }
      
      // Games in season
      const gamesResult = await queryOne(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status IN ('Final', 'STATUS_FINAL', 'completed') THEN 1 END) as completed,
          MIN(start_time) as first_game,
          MAX(start_time) as last_game
        FROM games
        WHERE sport = $1
          AND start_time >= $2
          AND start_time <= $3
      `, [season.sport, season.start, season.end]);
      
      // Player stats
      const statsResult = await queryOne(`
        SELECT COUNT(*) as count, COUNT(DISTINCT pgl.player_id) as unique_players
        FROM player_game_logs pgl
        JOIN games g ON pgl.game_id = g.id
        WHERE g.sport = $1
          AND g.start_time >= $2
          AND g.start_time <= $3
      `, [season.sport, season.start, season.end]);
      
      // Betting lines
      const bettingResult = await queryOne(`
        SELECT COUNT(DISTINCT g.id) as games_with_lines
        FROM games g
        JOIN betting_lines bl ON bl.game_id = g.id
        WHERE g.sport = $1
          AND g.start_time >= $2
          AND g.start_time <= $3
      `, [season.sport, season.start, season.end]);
      
      // Weather data
      const weatherResult = await queryOne(`
        SELECT COUNT(DISTINCT g.id) as games_with_weather
        FROM games g
        JOIN weather_data w ON w.game_id = g.id
        WHERE g.sport = $1
          AND g.start_time >= $2
          AND g.start_time <= $3
      `, [season.sport, season.start, season.end]);
      
      // Injuries
      const injuryResult = await queryOne(`
        SELECT COUNT(*) as total_injuries
        FROM player_injuries pi
        WHERE pi.injury_date >= $2
          AND pi.injury_date <= $3
      `, [season.sport, season.start, season.end]);
      
      detailedStats[season.sport] = {
        games: parseInt(gamesResult.total),
        completed: parseInt(gamesResult.completed),
        firstGame: gamesResult.first_game,
        lastGame: gamesResult.last_game,
        playerStats: parseInt(statsResult.count),
        uniquePlayers: parseInt(statsResult.unique_players),
        gamesWithBetting: parseInt(bettingResult.games_with_lines),
        gamesWithWeather: parseInt(weatherResult.games_with_weather),
        injuries: parseInt(injuryResult.total_injuries)
      };
      
      // Display results
      console.log(chalk.green(`✅ Games: ${gamesResult.total} (${gamesResult.completed} completed)`));
      if (parseInt(gamesResult.total) > 0) {
        console.log(chalk.gray(`   Date range: ${gamesResult.first_game} to ${gamesResult.last_game}`));
      }
      console.log(chalk.green(`✅ Player Stats: ${statsResult.count} (${statsResult.unique_players} unique players)`));
      console.log(chalk.green(`✅ Betting Lines: ${bettingResult.games_with_lines} games`));
      console.log(chalk.green(`✅ Weather Data: ${weatherResult.games_with_weather} games`));
      console.log(chalk.green(`✅ Injuries: ${injuryResult.total_injuries}`));
      
      // Check for data issues
      if (parseInt(statsResult.count) > 0 && parseInt(gamesResult.total) === 0) {
        console.log(chalk.red(`⚠️  ISSUE: ${statsResult.count} player stats but 0 games!`));
      }
    }
    
    // 3. Check ML Enrichment Tables
    console.log(chalk.yellow('\n3️⃣ ML ENRICHMENT TABLES:'));
    
    const enrichmentTables = [
      { name: 'enhanced_synergies', query: 'SELECT COUNT(*) as count FROM enhanced_synergies' },
      { name: 'betting_lines', query: 'SELECT COUNT(*) as count FROM betting_lines' },
      { name: 'weather_data', query: 'SELECT COUNT(*) as count FROM weather_data' },
      { name: 'advanced_metrics', query: 'SELECT COUNT(*) as count FROM advanced_metrics' },
      { name: 'team_synergies', query: 'SELECT COUNT(*) as count FROM team_synergies' },
      { name: 'player_injuries', query: 'SELECT COUNT(*) as count FROM player_injuries' }
    ];
    
    for (const table of enrichmentTables) {
      try {
        const result = await queryOne(table.query);
        console.log(chalk.green(`✅ ${table.name}: ${result.count} records`));
      } catch (error) {
        console.log(chalk.red(`❌ ${table.name}: Error - ${error.message}`));
      }
    }
    
    // 4. Data Quality Issues
    console.log(chalk.yellow('\n4️⃣ DATA QUALITY ANALYSIS:'));
    
    // Check different date formats
    const dateFormats = await queryMany(`
      SELECT 
        COUNT(*) as count,
        LENGTH(start_time::text) as date_length,
        LEFT(start_time::text, 10) as sample_date
      FROM games
      WHERE start_time IS NOT NULL
      GROUP BY LENGTH(start_time::text), LEFT(start_time::text, 10)
      ORDER BY count DESC
      LIMIT 5
    `);
    
    console.log(chalk.cyan('\nDate format samples:'));
    dateFormats.forEach(df => {
      console.log(chalk.gray(`  ${df.sample_date} (length: ${df.date_length}, count: ${df.count})`));
    });
    
    // Check status values
    const statusValues = await queryMany(`
      SELECT status, COUNT(*) as count
      FROM games
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log(chalk.cyan('\nGame status values:'));
    statusValues.forEach(sv => {
      console.log(chalk.gray(`  ${sv.status || 'NULL'}: ${sv.count} games`));
    });
    
    // 5. Summary and Recommendations
    console.log(chalk.yellow('\n5️⃣ SUMMARY & RECOMMENDATIONS:'));
    console.log(chalk.gray('-'.repeat(60)));
    
    // Identify critical issues
    const issues = [];
    
    for (const [sport, stats] of Object.entries(detailedStats)) {
      if (stats.games === 0 && stats.playerStats > 0) {
        issues.push(`${sport}: Has ${stats.playerStats} player stats but 0 games`);
      }
      if (stats.games > 0 && stats.gamesWithBetting === 0) {
        issues.push(`${sport}: Has ${stats.games} games but no betting lines`);
      }
    }
    
    if (issues.length > 0) {
      console.log(chalk.red('\n🚨 CRITICAL ISSUES:'));
      issues.forEach(issue => console.log(chalk.red(`  - ${issue}`)));
    }
    
    // Calculate totals
    let totalGames = 0;
    let totalStats = 0;
    let totalBetting = 0;
    
    for (const stats of Object.values(detailedStats)) {
      totalGames += stats.games;
      totalStats += stats.playerStats;
      totalBetting += stats.gamesWithBetting;
    }
    
    console.log(chalk.cyan('\n📊 2021-2022 TOTALS:'));
    console.log(chalk.green(`  Total Games: ${totalGames}`));
    console.log(chalk.green(`  Total Player Stats: ${totalStats}`));
    console.log(chalk.green(`  Games with Betting Lines: ${totalBetting}`));
    
    // Save diagnostic results
    const fs = await import('fs/promises');
    await fs.writeFile(
      'scripts/diagnostic/2021-diagnostic-results.json',
      JSON.stringify({
        runDate: new Date().toISOString(),
        seasons: SEASONS_2021,
        detailedStats,
        issues,
        totals: { totalGames, totalStats, totalBetting }
      }, null, 2)
    );
    
    console.log(chalk.green('\n✅ Diagnostic results saved to 2021-diagnostic-results.json'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
  }
}

// Run diagnostic
runComprehensiveDiagnostic()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });