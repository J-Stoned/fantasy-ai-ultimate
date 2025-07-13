#!/usr/bin/env tsx
/**
 * 📊 MONITOR COLLECTION PROGRESS - Real-time stats
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
  console.log(chalk.bold.cyan('📊 COLLECTION PROGRESS MONITOR\n'));
  
  // Get baseline before collection
  const baseline = {
    nba: { games: 405, logs: 0 },
    mlb: { games: 672, logs: 0 },
    nhl: { games: 608, logs: 0 },
    totalLogs: 105785
  };
  
  // Current stats
  const { count: currentTotalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: nbaGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nba');
  
  const { count: mlbGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
  
  const { count: nhlGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl');
  
  // Calculate progress
  const newLogs = (currentTotalLogs || 0) - baseline.totalLogs;
  const nbaNewGames = (nbaGames || 0) - baseline.nba.games;
  const mlbNewGames = (mlbGames || 0) - baseline.mlb.games;
  const nhlNewGames = (nhlGames || 0) - baseline.nhl.games;
  
  console.log(chalk.yellow('BASELINE (Before Collection):'));
  console.log(`Total logs: ${baseline.totalLogs.toLocaleString()}`);
  console.log(`NBA games: ${baseline.nba.games}`);
  console.log(`MLB games: ${baseline.mlb.games}`);
  console.log(`NHL games: ${baseline.nhl.games}\n`);
  
  console.log(chalk.green('CURRENT STATUS:'));
  console.log(`Total logs: ${currentTotalLogs?.toLocaleString()} (+${newLogs.toLocaleString()})`);
  console.log(`NBA games: ${nbaGames} (+${nbaNewGames})`);
  console.log(`MLB games: ${mlbGames} (+${mlbNewGames})`);
  console.log(`NHL games: ${nhlGames} (+${nhlNewGames})\n`);
  
  // Recent activity
  const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
  const { count: recentLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', fiveMinutesAgo);
  
  console.log(chalk.cyan('COLLECTION RATE:'));
  console.log(`Logs in last 5 min: ${recentLogs || 0}`);
  console.log(`Rate: ${((recentLogs || 0) * 12).toLocaleString()} logs/hour`);
  
  // Estimate time remaining
  const targetLogs = 600000; // Our goal
  const logsNeeded = targetLogs - (currentTotalLogs || 0);
  const rate = (recentLogs || 0) * 12; // per hour
  const hoursRemaining = rate > 0 ? (logsNeeded / rate).toFixed(1) : '∞';
  
  console.log(chalk.yellow(`\nPROJECTION:`));
  console.log(`Target: 600K logs`);
  console.log(`Need: ${logsNeeded.toLocaleString()} more logs`);
  console.log(`ETA: ${hoursRemaining} hours at current rate`);
  
  // Check if collector is running
  const { data: lastLog } = await supabase
    .from('player_game_logs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (lastLog) {
    const lastUpdate = new Date(lastLog.created_at);
    const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
    console.log(chalk.gray(`\nLast update: ${minutesAgo} minutes ago`));
  }
}

// Run every 30 seconds
setInterval(monitorProgress, 30000);
monitorProgress();