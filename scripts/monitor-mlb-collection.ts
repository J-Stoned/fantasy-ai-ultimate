#!/usr/bin/env tsx
/**
 * Real-time MLB stats collection monitor
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const startTime = Date.now();
let lastStats = 0;
let lastCheck = Date.now();

async function getMLBStats() {
  // Get total MLB games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb')
    .eq('status', 'completed')
    .not('home_score', 'is', null);
    
  // Get games with stats (more efficient query)
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', (await supabase
      .from('games')
      .select('id')
      .eq('sport_id', 'mlb')
      .then(res => res.data?.map(g => g.id) || [])));
      
  const uniqueGamesWithStats = new Set(gamesWithStats?.map(g => g.game_id) || []).size;
  
  // Get total stats count
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  return {
    totalGames: totalGames || 0,
    gamesWithStats: uniqueGamesWithStats,
    totalStats: totalStats || 0
  };
}

async function monitor() {
  console.clear();
  console.log(chalk.bold.yellow('⚾ MLB STATS COLLECTION MONITOR\n'));
  
  try {
    const stats = await getMLBStats();
    const currentTime = Date.now();
    const elapsedMinutes = (currentTime - startTime) / 60000;
    const statsGained = stats.totalStats - lastStats;
    const timeSinceLastCheck = (currentTime - lastCheck) / 1000;
    const statsPerSecond = statsGained / timeSinceLastCheck;
    const statsPerMinute = statsPerSecond * 60;
    
    const coverage = (stats.gamesWithStats / stats.totalGames * 100).toFixed(1);
    const remaining = stats.totalGames - stats.gamesWithStats;
    const eta = remaining > 0 && statsPerMinute > 0 ? (remaining * 25) / statsPerMinute : 0; // ~25 stats per game
    
    console.log(chalk.cyan('📊 DATABASE STATUS:'));
    console.log(`Total MLB Games: ${chalk.green(stats.totalGames.toLocaleString())}`);
    console.log(`Games with Stats: ${chalk.green(stats.gamesWithStats.toLocaleString())} (${chalk.yellow(coverage + '%')})`);
    console.log(`Total Stats in DB: ${chalk.green(stats.totalStats.toLocaleString())}`);
    
    console.log(chalk.cyan('\n⚡ COLLECTION SPEED:'));
    console.log(`Stats/minute: ${chalk.yellow(Math.round(statsPerMinute).toLocaleString())}`);
    console.log(`Games remaining: ${chalk.red(remaining.toLocaleString())}`);
    if (eta > 0) {
      console.log(`ETA: ${chalk.magenta(Math.round(eta) + ' minutes')}`);
    }
    
    console.log(chalk.cyan('\n🎯 PROGRESS BAR:'));
    const progressWidth = 40;
    const progress = Math.round((stats.gamesWithStats / stats.totalGames) * progressWidth);
    const progressBar = '█'.repeat(progress) + '░'.repeat(progressWidth - progress);
    console.log(`[${progressBar}] ${coverage}%`);
    
    console.log(chalk.cyan('\n⏱️  TIMING:'));
    console.log(`Elapsed: ${chalk.yellow(elapsedMinutes.toFixed(1) + ' minutes')}`);
    console.log(`Started: ${chalk.gray(new Date(startTime).toLocaleTimeString())}`);
    
    // MLB specific target
    const mlbTarget = 100000;
    const mlbStatsEstimate = stats.gamesWithStats * 25; // ~25 stats per game
    console.log(chalk.cyan('\n🎯 MLB 10X TARGET:'));
    console.log(`Estimated MLB Stats: ${chalk.green(mlbStatsEstimate.toLocaleString())} / ${chalk.yellow(mlbTarget.toLocaleString())}`);
    console.log(`Progress to 10x: ${chalk.yellow(((mlbStatsEstimate / mlbTarget) * 100).toFixed(1) + '%')}`);
    
    lastStats = stats.totalStats;
    lastCheck = currentTime;
    
  } catch (error) {
    console.error(chalk.red('Error fetching stats:'), error);
  }
  
  console.log(chalk.dim('\nRefreshing every 10 seconds... (Ctrl+C to stop)'));
}

// Run immediately then every 10 seconds
monitor();
setInterval(monitor, 10000);