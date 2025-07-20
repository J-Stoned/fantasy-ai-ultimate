#!/usr/bin/env tsx
/**
 * 🔍 VERIFY 2021 DATA COMPLETENESS - NO LIMITS VERSION
 * 
 * Gets EXACT counts using pagination, no 1000 row limits
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 1000;

// Get exact count with pagination
async function getExactCount(
  table: string, 
  filters: { column: string, operator: string, value: any }[]
): Promise<number> {
  let count = 0;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase.from(table).select('id', { count: 'exact' });
    
    // Apply filters
    for (const filter of filters) {
      if (filter.operator === 'eq') {
        query = query.eq(filter.column, filter.value);
      } else if (filter.operator === 'gte') {
        query = query.gte(filter.column, filter.value);
      } else if (filter.operator === 'lte') {
        query = query.lte(filter.column, filter.value);
      } else if (filter.operator === 'in') {
        query = query.in(filter.column, filter.value);
      }
    }
    
    query = query.range(offset, offset + BATCH_SIZE - 1);
    
    const { data, error } = await query;
    
    if (error) {
      console.error(chalk.red(`Error counting ${table}:`, error));
      return count;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }
    
    count += data.length;
    offset += BATCH_SIZE;
    hasMore = data.length === BATCH_SIZE;
  }
  
  return count;
}

async function verify2021CompleteData() {
  console.log(chalk.bold.cyan('🔍 VERIFYING 2021 DATA COMPLETENESS - NO LIMITS\n'));
  
  // Season date ranges
  const seasons = {
    NFL: {
      name: 'NFL 2021',
      filters: [
        { column: 'sport', operator: 'eq', value: 'NFL' },
        { column: 'start_time', operator: 'gte', value: '2021-09-01' },
        { column: 'start_time', operator: 'lte', value: '2022-02-28' }
      ],
      expected: 285
    },
    NBA: {
      name: 'NBA 2021-22',
      filters: [
        { column: 'sport', operator: 'eq', value: 'NBA' },
        { column: 'start_time', operator: 'gte', value: '2021-10-19' },
        { column: 'start_time', operator: 'lte', value: '2022-06-16' }
      ],
      expected: 1310
    },
    MLB: {
      name: 'MLB 2021',
      filters: [
        { column: 'sport', operator: 'eq', value: 'MLB' },
        { column: 'start_time', operator: 'gte', value: '2021-04-01' },
        { column: 'start_time', operator: 'lte', value: '2021-11-30' }
      ],
      expected: 2500
    },
    NHL: {
      name: 'NHL 2021-22',
      filters: [
        { column: 'sport', operator: 'eq', value: 'NHL' },
        { column: 'start_time', operator: 'gte', value: '2021-10-12' },
        { column: 'start_time', operator: 'lte', value: '2022-06-26' }
      ],
      expected: 1400
    }
  };
  
  console.log(chalk.yellow('📋 TEAMS:'));
  
  // Count teams for each sport
  for (const sport of ['NFL', 'NBA', 'MLB', 'NHL']) {
    const count = await getExactCount('teams', [
      { column: 'sport', operator: 'eq', value: sport }
    ]);
    
    const expected = sport === 'NFL' ? 32 : sport === 'NBA' ? 30 : sport === 'MLB' ? 30 : 32;
    const status = count === expected ? '✅' : '❌';
    console.log(chalk[count === expected ? 'green' : 'red'](`  ${sport}: ${count}/${expected} ${status}`));
  }
  
  console.log(chalk.yellow('\n🎮 GAMES (2021 seasons):'));
  
  // Create progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '  Counting |{bar}| {percentage}% | {sport}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  
  progressBar.start(4, 0, { sport: 'Starting...' });
  
  const gameResults = [];
  let progressIndex = 0;
  
  for (const [key, season] of Object.entries(seasons)) {
    progressBar.update(progressIndex++, { sport: season.name });
    
    const totalCount = await getExactCount('games', season.filters);
    
    // Count Final games
    const finalCount = await getExactCount('games', [
      ...season.filters,
      { column: 'status', operator: 'eq', value: 'Final' }
    ]);
    
    const percentage = Math.round((totalCount / season.expected) * 100);
    const status = percentage >= 95 ? '✅' : percentage >= 80 ? '⚠️' : '❌';
    
    gameResults.push({
      sport: season.name,
      total: totalCount,
      final: finalCount,
      expected: season.expected,
      percentage,
      status
    });
  }
  
  progressBar.stop();
  
  // Display game results
  gameResults.forEach(result => {
    const color = result.percentage >= 95 ? 'green' : result.percentage >= 80 ? 'yellow' : 'red';
    console.log(chalk[color](
      `  ${result.sport}: ${result.total}/${result.expected} games (${result.percentage}%) ${result.status} - ${result.final} Final`
    ));
  });
  
  console.log(chalk.yellow('\n📊 STATS (2021 seasons):'));
  
  // Count stats for each sport
  progressBar.start(4, 0, { sport: 'Counting stats...' });
  progressIndex = 0;
  
  const statsResults = [];
  
  for (const [key, season] of Object.entries(seasons)) {
    progressBar.update(progressIndex++, { sport: season.name });
    
    // First get team IDs for the sport
    const sport = key;
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('sport', sport);
    
    const teamIds = teams?.map(t => t.id) || [];
    
    if (teamIds.length > 0) {
      // Get game IDs for the season
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport)
        .gte('start_time', season.filters[1].value)
        .lte('start_time', season.filters[2].value);
      
      const gameIds = games?.map(g => g.id) || [];
      
      // Count stats
      let statsCount = 0;
      let offset = 0;
      let hasMore = true;
      
      while (hasMore && gameIds.length > 0) {
        const { data, error } = await supabase
          .from('player_game_logs')
          .select('id')
          .in('game_id', gameIds.slice(0, 500)) // Limit to 500 game IDs at a time
          .range(offset, offset + BATCH_SIZE - 1);
        
        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }
        
        statsCount += data.length;
        offset += BATCH_SIZE;
        hasMore = data.length === BATCH_SIZE;
      }
      
      const expectedStats = key === 'NFL' ? 25000 : key === 'NBA' ? 50000 : key === 'MLB' ? 150000 : 40000;
      const percentage = Math.round((statsCount / expectedStats) * 100);
      const status = statsCount > 1000 ? '✅' : '❌';
      
      statsResults.push({
        sport: season.name,
        count: statsCount,
        expected: expectedStats,
        percentage,
        status
      });
    }
  }
  
  progressBar.stop();
  
  // Display stats results
  statsResults.forEach(result => {
    const color = result.count > 1000 ? 'green' : 'red';
    console.log(chalk[color](
      `  ${result.sport}: ${result.count.toLocaleString()} stats ${result.status}`
    ));
  });
  
  console.log(chalk.yellow('\n💰 BETTING LINES (2021 seasons):'));
  
  // Count betting lines
  let totalBettingLines = 0;
  for (const [key, season] of Object.entries(seasons)) {
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('sport', key)
      .gte('start_time', season.filters[1].value)
      .lte('start_time', season.filters[2].value);
    
    const gameIds = games?.map(g => g.id) || [];
    
    if (gameIds.length > 0) {
      const count = await getExactCount('betting_lines', [
        { column: 'game_id', operator: 'in', value: gameIds.slice(0, 500) }
      ]);
      
      console.log(chalk.gray(`  ${season.name}: ${count} betting lines`));
      totalBettingLines += count;
    }
  }
  
  console.log(chalk.green(`  Total: ${totalBettingLines.toLocaleString()} betting lines`));
  
  // Final summary
  console.log(chalk.bold.cyan('\n📊 COMPLETENESS SUMMARY:'));
  
  const totalGames = gameResults.reduce((sum, r) => sum + r.total, 0);
  const expectedGames = gameResults.reduce((sum, r) => sum + r.expected, 0);
  const overallPercentage = Math.round((totalGames / expectedGames) * 100);
  
  console.log(chalk.white(`  Total games: ${totalGames.toLocaleString()}/${expectedGames.toLocaleString()} (${overallPercentage}%)`));
  
  // Determine overall status
  const allComplete = gameResults.every(r => r.percentage >= 95);
  const mostlyComplete = gameResults.every(r => r.percentage >= 80);
  
  if (allComplete) {
    console.log(chalk.bold.green('\n🎯 ALL 2021 SEASONS COMPLETE!'));
    console.log(chalk.green('Ready for pattern validation!'));
  } else if (mostlyComplete) {
    console.log(chalk.bold.yellow('\n⚠️  2021 SEASONS MOSTLY COMPLETE'));
    console.log(chalk.yellow('Some data still missing, but sufficient for testing'));
  } else {
    console.log(chalk.bold.red('\n❌ 2021 SEASONS INCOMPLETE'));
    console.log(chalk.red('Run 10x-complete-2021-seasons.ts to collect missing data'));
  }
  
  // Show what's missing
  const missing = gameResults.filter(r => r.percentage < 95);
  if (missing.length > 0) {
    console.log(chalk.yellow('\nMissing data:'));
    missing.forEach(m => {
      const needed = m.expected - m.total;
      console.log(chalk.yellow(`  ${m.sport}: ${needed} more games needed`));
    });
  }
}

verify2021CompleteData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });