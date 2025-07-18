#!/usr/bin/env tsx
/**
 * Check which games have fewer stats than expected (78 per game)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsPerGame() {
  console.log(chalk.blue('\n🏈 Analyzing Stats Per Game (Expected: 78)\n'));

  // Get all 2021 season games
  const { data: games, error } = await supabase
    .from('games')
    .select('id, start_time, home_team_id, away_team_id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .order('start_time');

  if (error || !games) {
    console.error('Error:', error);
    return;
  }

  console.log(chalk.green(`Analyzing ${games.length} games...\n`));

  // Check stats for each game
  const gameStats: { gameId: number; date: string; statCount: number }[] = [];
  
  // Process in batches to avoid timeout
  const batchSize = 20;
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    
    for (const game of batch) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      gameStats.push({
        gameId: game.id,
        date: new Date(game.start_time).toLocaleDateString(),
        statCount: count || 0
      });
    }
    
    process.stdout.write('.');
  }
  
  console.log('\n');

  // Analyze distribution
  const statsDistribution: Record<string, number> = {
    '0': 0,
    '1-20': 0,
    '21-40': 0,
    '41-60': 0,
    '61-78': 0,
    '79+': 0
  };

  gameStats.forEach(({ statCount }) => {
    if (statCount === 0) statsDistribution['0']++;
    else if (statCount <= 20) statsDistribution['1-20']++;
    else if (statCount <= 40) statsDistribution['21-40']++;
    else if (statCount <= 60) statsDistribution['41-60']++;
    else if (statCount <= 78) statsDistribution['61-78']++;
    else statsDistribution['79+']++;
  });

  console.log(chalk.cyan('Stats Distribution:'));
  Object.entries(statsDistribution).forEach(([range, count]) => {
    const percentage = ((count / games.length) * 100).toFixed(1);
    console.log(`  ${range} stats: ${count} games (${percentage}%)`);
  });

  // Find games with low stats
  const lowStatGames = gameStats.filter(g => g.statCount < 50).sort((a, b) => a.statCount - b.statCount);
  
  if (lowStatGames.length > 0) {
    console.log(chalk.red(`\n⚠️  ${lowStatGames.length} games have < 50 stats:`));
    lowStatGames.slice(0, 10).forEach(game => {
      console.log(`  Game ${game.gameId} (${game.date}): ${game.statCount} stats`);
    });
    if (lowStatGames.length > 10) {
      console.log(`  ... and ${lowStatGames.length - 10} more`);
    }
  }

  // Calculate totals
  const totalStats = gameStats.reduce((sum, g) => sum + g.statCount, 0);
  const avgStats = Math.round(totalStats / games.length);
  const expectedTotal = games.length * 78;
  const missingStats = expectedTotal - totalStats;

  console.log(chalk.blue('\n📊 Summary:'));
  console.log(`  Total games: ${games.length}`);
  console.log(`  Total stats: ${totalStats.toLocaleString()}`);
  console.log(`  Average per game: ${avgStats}`);
  console.log(`  Expected per game: 78`);
  console.log(`  Missing stats: ${missingStats.toLocaleString()} (${Math.round((missingStats / expectedTotal) * 100)}%)`);

  // Check specific months
  const monthlyStats: Record<string, { games: number; stats: number }> = {};
  
  gameStats.forEach((game, idx) => {
    const month = new Date(games[idx].start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!monthlyStats[month]) monthlyStats[month] = { games: 0, stats: 0 };
    monthlyStats[month].games++;
    monthlyStats[month].stats += game.statCount;
  });

  console.log(chalk.cyan('\nMonthly Averages:'));
  Object.entries(monthlyStats).sort().forEach(([month, data]) => {
    const avg = Math.round(data.stats / data.games);
    console.log(`  ${month}: ${avg} stats/game (${data.games} games)`);
  });
}

checkStatsPerGame().catch(console.error);