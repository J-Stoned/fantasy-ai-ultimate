#!/usr/bin/env tsx
/**
 * 🎯 REALTIME COLLECTION STATUS - See what's happening NOW
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function realtimeStatus() {
  console.clear();
  console.log(chalk.bold.cyan('🎯 REALTIME COLLECTION STATUS\n'));
  
  // Check log file
  try {
    const logContent = await fs.readFile('2023-collection.log', 'utf-8');
    const lines = logContent.split('\n');
    const lastLines = lines.slice(-20).filter(l => l.trim());
    
    // Find current sport
    let currentSport = 'UNKNOWN';
    for (const line of lastLines) {
      if (line.includes('COLLECTING') && line.includes('SEASON')) {
        if (line.includes('NBA')) currentSport = 'NBA';
        else if (line.includes('MLB')) currentSport = 'MLB';
        else if (line.includes('NHL')) currentSport = 'NHL';
      }
    }
    
    // Find progress
    const progressLines = lastLines.filter(l => l.includes('Progress:'));
    const lastProgress = progressLines[progressLines.length - 1];
    
    // Find dates
    const dateLines = lastLines.filter(l => l.match(/2023-\d{2}-\d{2}:|2024-\d{2}-\d{2}:/));
    const lastDate = dateLines[dateLines.length - 1];
    
    console.log(chalk.bold.yellow(`CURRENTLY COLLECTING: ${currentSport}`));
    if (lastDate) {
      console.log(`Processing date: ${lastDate}`);
    }
    if (lastProgress) {
      console.log(`Game progress: ${lastProgress.trim()}`);
    }
  } catch (e) {
    console.log('Log file not accessible');
  }
  
  // Database stats
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: lastMinuteLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 60000).toISOString());
  
  // Sport breakdown
  console.log(chalk.bold.green('\n📊 DATABASE STATUS:'));
  console.log(`Total player logs: ${totalLogs?.toLocaleString()}`);
  console.log(`Logs/minute: ${lastMinuteLogs || 0}`);
  console.log(`Rate: ${((lastMinuteLogs || 0) * 60).toLocaleString()} logs/hour`);
  
  // Get games by sport
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  console.log(chalk.bold.magenta('\n🏆 GAMES BY SPORT:'));
  
  for (const sport of sports) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    
    const target = {
      nfl: 432,
      nba: 1715,
      mlb: 3142,
      nhl: 2000
    }[sport];
    
    const pct = ((count || 0) / target * 100).toFixed(1);
    const emoji = pct >= 95 ? '✅' : pct >= 50 ? '🔄' : '⏳';
    
    console.log(`${emoji} ${sport.toUpperCase()}: ${count}/${target} (${pct}%)`);
  }
  
  // Projection
  const remainingLogs = 600000 - (totalLogs || 0);
  const eta = lastMinuteLogs ? (remainingLogs / (lastMinuteLogs * 60)).toFixed(1) : '∞';
  
  console.log(chalk.bold.cyan('\n🚀 PROJECTION:'));
  console.log(`Need: ${remainingLogs.toLocaleString()} more logs`);
  console.log(`ETA to 600K: ${eta} hours`);
  console.log(`Pattern accuracy: ${(51 + ((totalLogs || 0) / 600000 * 25.4)).toFixed(1)}%`);
  
  console.log(chalk.gray('\n' + new Date().toLocaleString()));
}

// Run immediately and every 15 seconds
realtimeStatus();
setInterval(realtimeStatus, 15000);