#!/usr/bin/env tsx

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function checkCoverage() {
  console.log(chalk.bold.yellow('📊 STATS COLLECTION COVERAGE REPORT'));
  console.log(chalk.gray('='.repeat(50)));

  // Count total completed games (past games with scores)
  const { count: totalGames } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .lt('start_time', new Date().toISOString());

  // Count games with ESPN IDs
  const { count: gamesWithESPN } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null)
    .lt('start_time', new Date().toISOString());

  // Count games with valid sports
  const { count: gamesWithValidSport } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .in('sport', ['NBA', 'NFL', 'MLB', 'NHL'])
    .not('home_score', 'is', null)
    .lt('start_time', new Date().toISOString());

  // Count games with player stats - need to count unique games
  const { data: uniqueGames } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('game_id')
    .not('stats', 'is', null);
    
  const allGameIds = new Set(uniqueGames?.map(g => g.game_id) || []);
  
  // For games with real stats, we need to check if stats object has content
  // Sample a subset to check
  const { data: sampleStats } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('game_id, stats')
    .not('stats', 'is', null)
    .limit(50000);

  const gamesWithStats = allGameIds;
  const gamesWithRealStats = new Set(
    sampleStats?.filter(s => s.stats && Object.keys(s.stats).length > 0)
      .map(s => s.game_id) || []
  );

  // Count player game logs
  const { count: totalPlayerLogs } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });

  // Count by sport
  const sports = ['NBA', 'NFL', 'MLB'];
  console.log(chalk.cyan('\nGames by Sport:'));
  
  for (const sport of sports) {
    const { count: sportGames } = await enhancedDb.getClient()
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .lt('start_time', new Date().toISOString());

    const { count: sportGamesWithESPN } = await enhancedDb.getClient()
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)
      .lt('start_time', new Date().toISOString());

    console.log(`  ${sport}: ${sportGames?.toLocaleString()} games (${sportGamesWithESPN?.toLocaleString()} with ESPN IDs)`);
  }

  console.log(chalk.cyan('\n📈 Overall Coverage:'));
  console.log(`Total completed games: ${totalGames?.toLocaleString()}`);
  console.log(`Games with valid sport: ${gamesWithValidSport?.toLocaleString()}`);
  console.log(`Games with ESPN IDs: ${gamesWithESPN?.toLocaleString()}`);
  console.log(`Games with player stats: ${gamesWithStats.size.toLocaleString()}`);
  console.log(`Games with real stats data: ${gamesWithRealStats.size.toLocaleString()}`);
  console.log(`Total player game logs: ${totalPlayerLogs?.toLocaleString()}`);
  
  console.log(chalk.cyan('\n📊 Coverage Percentages:'));
  console.log(`ESPN ID coverage: ${((gamesWithESPN || 0) / (totalGames || 1) * 100).toFixed(1)}%`);
  console.log(`Stats coverage (all games): ${(gamesWithRealStats.size / (totalGames || 1) * 100).toFixed(1)}%`);
  console.log(`Stats coverage (ESPN games): ${(gamesWithRealStats.size / (gamesWithESPN || 1) * 100).toFixed(1)}%`);

  // Calculate target
  const currentCoverage = (gamesWithRealStats.size / (totalGames || 1) * 100);
  const targetCoverage = 100;
  const gamesNeeded = Math.round((targetCoverage / 100) * (gamesWithESPN || 0) - gamesWithRealStats.size);

  console.log(chalk.yellow('\n🎯 Path to 100% Coverage:'));
  console.log(`Current: ${currentCoverage.toFixed(1)}% (${gamesWithRealStats.size.toLocaleString()} games)`);
  console.log(`Target: 100% of ESPN games (${gamesWithESPN?.toLocaleString()} games)`);
  console.log(`Games to collect: ${gamesNeeded.toLocaleString()}`);
  
  if (gamesNeeded > 0) {
    const estimatedTime = (gamesNeeded / 2.8) / 60; // Based on 2.8 games/second
    console.log(`Estimated collection time: ${estimatedTime.toFixed(1)} minutes`);
  }
}

checkCoverage().catch(console.error);