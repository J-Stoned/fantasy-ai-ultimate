#!/usr/bin/env tsx
/**
 * Check stats coverage per game
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsCoverage() {
  console.log(chalk.bold.cyan('📊 CHECKING STATS COVERAGE\n'));

  // Get total games and stats by sport
  console.log(chalk.yellow('Games and Stats by Sport:\n'));
  
  const { data: sports } = await supabase
    .from('games')
    .select('sport')
    .not('sport', 'is', null);

  const sportList = [...new Set(sports?.map(g => g.sport) || [])];
  const coverage: any[] = [];

  for (const sport of sportList) {
    const [games, logs, stats] = await Promise.all([
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('sport', sport),
      supabase.from('player_game_logs').select('game_id', { count: 'exact' }).eq('sport', sport),
      supabase.from('player_stats').select('*', { count: 'exact', head: true }).eq('sport', sport)
    ]);

    // Count unique games with logs
    const uniqueGamesWithLogs = new Set(logs.data?.map(l => l.game_id)).size;
    
    coverage.push({
      sport,
      total_games: games.count || 0,
      games_with_logs: uniqueGamesWithLogs,
      total_logs: logs.count || 0,
      total_stats: stats.count || 0,
      avg_logs_per_game: games.count ? ((logs.count || 0) / games.count).toFixed(1) : '0',
      coverage_pct: games.count ? ((uniqueGamesWithLogs / games.count) * 100).toFixed(1) + '%' : '0%'
    });
  }

  console.table(coverage.sort((a, b) => b.total_games - a.total_games));

  // Overall stats
  console.log(chalk.yellow('\n📈 Overall Statistics:\n'));
  
  const totals = coverage.reduce((acc, sport) => ({
    games: acc.games + sport.total_games,
    logs: acc.logs + sport.total_logs,
    stats: acc.stats + sport.total_stats,
    games_with_logs: acc.games_with_logs + sport.games_with_logs
  }), { games: 0, logs: 0, stats: 0, games_with_logs: 0 });

  console.table({
    'Total Games': totals.games.toLocaleString(),
    'Games with Logs': totals.games_with_logs.toLocaleString(),
    'Total Game Logs': totals.logs.toLocaleString(),
    'Total Player Stats': totals.stats.toLocaleString(),
    'Avg Logs per Game': (totals.logs / totals.games).toFixed(1),
    'Overall Coverage': ((totals.games_with_logs / totals.games) * 100).toFixed(1) + '%'
  });

  // Check games without any stats
  console.log(chalk.yellow('\n🔍 Checking games without stats...\n'));
  
  const { count: gamesWithoutLogs } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .not('id', 'in', 
      `(SELECT DISTINCT game_id FROM player_game_logs WHERE game_id IS NOT NULL)`
    );

  console.log(`Games without any player logs: ${gamesWithoutLogs?.toLocaleString() || 0}`);

  // Sample games without stats
  const { data: sampleEmpty } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id, start_time')
    .not('id', 'in', 
      `(SELECT DISTINCT game_id FROM player_game_logs WHERE game_id IS NOT NULL LIMIT 1000)`
    )
    .limit(10);

  if (sampleEmpty && sampleEmpty.length > 0) {
    console.log('\nSample games without stats:');
    console.table(sampleEmpty);
  }

  // Expected stats calculation
  console.log(chalk.yellow('\n📐 Expected vs Actual Stats:\n'));
  console.log('Expected stats calculation:');
  console.log('- NFL: ~50 players per game (25 per team with stats)');
  console.log('- NBA: ~20 players per game (10 per team)');
  console.log('- MLB: ~30 players per game (15 per team)');
  console.log('- NHL: ~40 players per game (20 per team)');
  
  const expected = coverage.map(s => {
    let playersPerGame = 30; // default
    if (s.sport === 'NFL') playersPerGame = 50;
    else if (s.sport === 'NBA') playersPerGame = 20;
    else if (s.sport === 'MLB') playersPerGame = 30;
    else if (s.sport === 'NHL') playersPerGame = 40;
    
    return {
      sport: s.sport,
      expected_logs: s.total_games * playersPerGame,
      actual_logs: s.total_logs,
      difference: s.total_logs - (s.total_games * playersPerGame),
      percent_of_expected: ((s.total_logs / (s.total_games * playersPerGame)) * 100).toFixed(1) + '%'
    };
  }).filter(s => s.expected_logs > 0);

  console.table(expected);
}

checkStatsCoverage().catch(console.error);