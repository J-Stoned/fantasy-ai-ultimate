#!/usr/bin/env tsx
/**
 * 🔥 MOMENTUM TRACKER - Watch the database GROW!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import readline from 'readline';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let previousCount = 0;
const baseline = 105785;
const target = 600000;

async function trackMomentum() {
  console.clear();
  console.log(chalk.bold.red('🔥 MOMENTUM TRACKER - 10X DEVELOPMENT MODE 🔥\n'));
  
  // Get current stats
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: recentLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 60000).toISOString());
  
  const currentCount = totalLogs || 0;
  const added = currentCount - baseline;
  const progress = (currentCount / target * 100).toFixed(1);
  const rate = recentLogs ? recentLogs * 60 : 0;
  
  // Momentum indicator
  const momentum = currentCount > previousCount ? '🚀 ACCELERATING!' : '⏸️  Paused';
  previousCount = currentCount;
  
  // Progress bar
  const filled = Math.floor(parseFloat(progress) / 2);
  const progressBar = '█'.repeat(filled) + '░'.repeat(50 - filled);
  
  // Display
  console.log(chalk.yellow(`BASELINE: ${baseline.toLocaleString()}`));
  console.log(chalk.green(`CURRENT:  ${currentCount.toLocaleString()} (+${added.toLocaleString()})`));
  console.log(chalk.cyan(`TARGET:   ${target.toLocaleString()}\n`));
  
  console.log(`Progress: [${progressBar}] ${progress}%`);
  console.log(`Status: ${momentum}`);
  console.log(`Rate: ${rate.toLocaleString()} logs/hour\n`);
  
  // Current activity
  const { data: lastLog } = await supabase
    .from('player_game_logs')
    .select('player:players(name, sport), created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (lastLog && lastLog.player) {
    const sport = lastLog.player.sport?.toUpperCase() || 'UNKNOWN';
    console.log(chalk.bold.magenta(`NOW COLLECTING: ${sport}`));
    console.log(`Last player: ${lastLog.player.name}`);
    console.log(`Last update: ${new Date(lastLog.created_at).toLocaleTimeString()}`);
  }
  
  // Milestones
  console.log(chalk.bold.yellow('\n🏆 MILESTONES:'));
  const milestones = [
    { count: 150000, label: '25% - Quarter way!' },
    { count: 300000, label: '50% - Halfway there!' },
    { count: 450000, label: '75% - Final stretch!' },
    { count: 600000, label: '100% - PATTERN EMPIRE!' }
  ];
  
  for (const milestone of milestones) {
    if (currentCount >= milestone.count) {
      console.log(chalk.green(`✅ ${milestone.label}`));
    } else {
      const eta = rate > 0 ? ((milestone.count - currentCount) / rate).toFixed(1) : '∞';
      console.log(chalk.gray(`⏳ ${milestone.label} (ETA: ${eta}h)`));
    }
  }
  
  // Pattern accuracy projection
  const coverage = currentCount / target;
  const projectedAccuracy = 51 + (coverage * 25.4);
  console.log(chalk.bold.cyan(`\n🎯 PATTERN ACCURACY: ${projectedAccuracy.toFixed(1)}%`));
  console.log(chalk.bold.green(`💰 REVENUE POTENTIAL: $${Math.floor(coverage * 1150000).toLocaleString()}`));
  
  console.log(chalk.gray('\nRefreshing every 10 seconds... (Ctrl+C to exit)'));
}

// Run immediately
trackMomentum();

// Update every 10 seconds
setInterval(trackMomentum, 10000);