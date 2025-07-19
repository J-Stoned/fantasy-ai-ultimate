#!/usr/bin/env tsx
/**
 * Check real stats coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealCoverage() {
  console.log(chalk.bold.cyan('📊 REAL STATS COVERAGE CHECK\n'));

  // First, let's check what columns player_game_logs has
  const { data: sampleLog } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);

  console.log('Sample player_game_log columns:', Object.keys(sampleLog?.[0] || {}));

  // Get games with stats by joining
  console.log(chalk.yellow('\n📈 Games with Stats by Sport:\n'));
  
  const { data: sports } = await supabase
    .from('games')
    .select('sport')
    .not('sport', 'is', null);

  const sportList = [...new Set(sports?.map(g => g.sport) || [])];
  const coverage: any[] = [];

  for (const sport of sportList) {
    // Get games for this sport
    const { data: games, count: gameCount } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .eq('sport', sport);

    if (!games || games.length === 0) continue;

    // Get game logs for these games
    const gameIds = games.map(g => g.id);
    
    // Process in batches due to query limits
    let totalLogs = 0;
    let gamesWithStats = new Set<number>();
    
    const batchSize = 500;
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      
      const { data: logs } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', batch);

      if (logs) {
        totalLogs += logs.length;
        logs.forEach(log => gamesWithStats.add(log.game_id));
      }
    }

    coverage.push({
      sport,
      total_games: gameCount || 0,
      games_with_stats: gamesWithStats.size,
      total_logs: totalLogs,
      avg_logs_per_game: gameCount ? (totalLogs / gameCount).toFixed(1) : '0',
      coverage_pct: gameCount ? ((gamesWithStats.size / gameCount) * 100).toFixed(1) + '%' : '0%'
    });
  }

  console.table(coverage.sort((a, b) => b.total_logs - a.total_logs));

  // Total summary
  const totals = coverage.reduce((acc, s) => ({
    games: acc.games + s.total_games,
    games_with_stats: acc.games_with_stats + s.games_with_stats,
    logs: acc.logs + s.total_logs
  }), { games: 0, games_with_stats: 0, logs: 0 });

  console.log(chalk.yellow('\n📊 TOTAL SUMMARY:\n'));
  console.table({
    'Total Games': totals.games.toLocaleString(),
    'Games with Stats': totals.games_with_stats.toLocaleString(),
    'Total Game Logs': totals.logs.toLocaleString(),
    'Average Logs per Game': (totals.logs / totals.games).toFixed(1),
    'Overall Coverage': ((totals.games_with_stats / totals.games) * 100).toFixed(1) + '%'
  });

  // Check MLB specifically since it should have the most
  console.log(chalk.yellow('\n⚾ MLB Deep Dive:\n'));
  
  const { data: mlbGames } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, start_time')
    .eq('sport', 'MLB')
    .limit(10);

  if (mlbGames && mlbGames.length > 0) {
    console.log('Sample MLB games:');
    for (const game of mlbGames.slice(0, 3)) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      console.log(`  Game ${game.id}: ${count || 0} player logs`);
    }
  }

  // Check player_stats table too
  console.log(chalk.yellow('\n📊 Player Stats Table:\n'));
  
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total player_stats records: ${totalStats?.toLocaleString() || 0}`);
}

checkRealCoverage().catch(console.error);