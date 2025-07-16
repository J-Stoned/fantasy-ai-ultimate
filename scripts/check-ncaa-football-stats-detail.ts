#!/usr/bin/env tsx
/**
 * 🔍 CHECK NCAA FOOTBALL GAME STATISTICS DETAIL
 * Verify what actual game stats we have stored
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAAFootballStats() {
  console.log(chalk.bold.blue('🔍 CHECKING NCAA FOOTBALL GAME STATISTICS DETAIL'));
  console.log(chalk.blue('=================================================\n'));
  
  // Get NCAA Football game IDs
  const { data: ncaaGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_FB')
    .limit(10);
  
  if (!ncaaGames || ncaaGames.length === 0) {
    console.log(chalk.red('❌ No NCAA Football games found!'));
    return;
  }
  
  console.log(`Found ${ncaaGames.length} NCAA Football games`);
  
  // Get player game logs for NCAA Football games
  const { data: ncaaStats } = await supabase
    .from('player_game_logs')
    .select('*')
    .in('game_id', ncaaGames.map(g => g.id))
    .limit(10);
  
  if (!ncaaStats || ncaaStats.length === 0) {
    console.log(chalk.red('❌ No NCAA Football stats found!'));
    return;
  }
  
  console.log(`Found ${ncaaStats.length} NCAA Football player stats`);
  
  console.log('\n📊 SAMPLE NCAA FOOTBALL STATS STRUCTURE:');
  if (ncaaStats.length > 0) {
    const firstStat = ncaaStats[0];
    console.log('Available fields:', Object.keys(firstStat));
    console.log('\nStats field content:');
    console.log(JSON.stringify(firstStat.stats, null, 2));
    console.log(`\nFantasy points: ${firstStat.fantasy_points}`);
  }
  
  console.log('\n📈 DETAILED BREAKDOWN OF FIRST 5 NCAA FOOTBALL STATS:');
  ncaaStats.slice(0, 5).forEach((stat, i) => {
    console.log(`\n--- NCAA FOOTBALL STAT ${i + 1} ---`);
    console.log(`Player ID: ${stat.player_id}`);
    console.log(`Game ID: ${stat.game_id}`);
    console.log(`Fantasy Points: ${stat.fantasy_points}`);
    console.log(`Game Date: ${stat.game_date}`);
    console.log(`Is Home: ${stat.is_home}`);
    console.log('Raw Stats:');
    console.log(JSON.stringify(stat.stats, null, 2));
  });
  
  // Check for different types of stats
  console.log('\n🔍 ANALYZING STAT TYPES:');
  const statTypes = new Set();
  ncaaStats.forEach(stat => {
    if (stat.stats) {
      Object.keys(stat.stats).forEach(key => {
        statTypes.add(key);
      });
    }
  });
  
  console.log('Stat categories found:', Array.from(statTypes));
  
  // Look for passing, rushing, receiving stats specifically
  const passingStats = ncaaStats.filter(stat => stat.stats?.passing);
  const rushingStats = ncaaStats.filter(stat => stat.stats?.rushing);
  const receivingStats = ncaaStats.filter(stat => stat.stats?.receiving);
  
  console.log(`\n📊 STAT BREAKDOWN:`);
  console.log(`Passing stats: ${passingStats.length}`);
  console.log(`Rushing stats: ${rushingStats.length}`);
  console.log(`Receiving stats: ${receivingStats.length}`);
  
  if (passingStats.length > 0) {
    console.log('\n🏈 SAMPLE PASSING STATS:');
    console.log(JSON.stringify(passingStats[0].stats.passing, null, 2));
  }
  
  if (rushingStats.length > 0) {
    console.log('\n🏃 SAMPLE RUSHING STATS:');
    console.log(JSON.stringify(rushingStats[0].stats.rushing, null, 2));
  }
  
  if (receivingStats.length > 0) {
    console.log('\n🙌 SAMPLE RECEIVING STATS:');
    console.log(JSON.stringify(receivingStats[0].stats.receiving, null, 2));
  }
}

checkNCAAFootballStats().catch(console.error);