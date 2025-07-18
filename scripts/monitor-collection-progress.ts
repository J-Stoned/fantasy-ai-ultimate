#!/usr/bin/env tsx
/**
 * 🔥 REAL-TIME COLLECTION PROGRESS MONITOR
 * Shows live updates of stats being added
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function monitorProgress() {
  console.clear();
  console.log(chalk.bold.cyan('🔥 LIVE COLLECTION MONITOR\n'));

  // Get 2021 game IDs
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  if (!games) return;
  const gameIds = games.map(g => g.id);

  let previousCount = 0;
  let startTime = Date.now();

  // Monitor every 2 seconds
  setInterval(async () => {
    const { count: currentCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds);

    const totalStats = currentCount || 0;
    const newStats = totalStats - previousCount;
    const avgPerGame = Math.round(totalStats / games.length);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const speed = previousCount > 0 ? Math.round((newStats / 2)) : 0; // per second

    // Clear and redraw
    console.clear();
    console.log(chalk.bold.cyan('🔥 LIVE COLLECTION MONITOR\n'));
    
    console.log(chalk.green(`Total 2021 Stats: ${totalStats.toLocaleString()}`));
    console.log(chalk.yellow(`Average per game: ${avgPerGame} / 78`));
    console.log(chalk.blue(`Games: ${games.length}`));
    console.log(chalk.cyan(`Time elapsed: ${elapsed}s`));
    
    if (newStats > 0) {
      console.log(chalk.bold.green(`\n✨ +${newStats} new stats! (${speed}/sec)`));
    }

    // Progress bar
    const progress = Math.round((avgPerGame / 78) * 100);
    const barLength = 40;
    const filled = Math.round((progress / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    console.log(chalk.cyan(`\nProgress: [${bar}] ${progress}%`));

    // Check recent stats
    const { data: recentStats } = await supabase
      .from('player_game_logs')
      .select('metadata')
      .in('game_id', gameIds)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentStats && recentStats.length > 0) {
      console.log(chalk.gray('\nRecent stat groups:'));
      recentStats.forEach(s => {
        if (s.metadata?.stat_group) {
          console.log(chalk.gray(`  • ${s.metadata.stat_group}`));
        }
      });
    }

    if (avgPerGame >= 78) {
      console.log(chalk.bold.green('\n🎉 TARGET ACHIEVED! 78 stats per game!'));
      process.exit(0);
    }

    previousCount = totalStats;
  }, 2000); // Every 2 seconds
}

monitorProgress().catch(console.error);