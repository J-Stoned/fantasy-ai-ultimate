#!/usr/bin/env tsx
/**
 * Check available games for historical training
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTrainingData() {
  console.log(chalk.cyan.bold('\n📊 Checking Available Training Data\n'));
  
  // Count completed games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .eq('status', 'completed')
    .not('home_score', 'is', null);
    
  console.log(chalk.white(`Total completed MLB games: ${totalGames}`));
  
  // Get date range
  const { data: dateRange } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'MLB')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: true })
    .limit(1);
    
  const { data: latestGame } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'MLB')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1);
    
  if (dateRange?.[0] && latestGame?.[0]) {
    console.log(chalk.white(`Date range: ${dateRange[0].start_time.split('T')[0]} to ${latestGame[0].start_time.split('T')[0]}`));
  }
  
  // Count games by year
  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 1; year <= currentYear; year++) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .gte('start_time', `${year}-03-01`)
      .lte('start_time', `${year}-11-01`);
      
    if (count && count > 0) {
      console.log(chalk.gray(`  ${year} season: ${count} games`));
    }
  }
  
  // Count games with patterns
  const { count: patternCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .not('metadata->pattern_types', 'is', null);
    
  console.log(chalk.yellow(`\nGames with patterns detected: ${patternCount}`));
  
  // Check 2025 games specifically
  const { count: games2025 } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .gte('start_time', '2025-03-27')
    .lte('start_time', '2025-07-13');
    
  console.log(chalk.green(`\n2025 First Half (Mar 27 - Jul 13): ${games2025} games`));
  
  if (games2025 === 0) {
    console.log(chalk.yellow('\n⚠️  No 2025 games found. Training will use 2024 data.'));
    
    // Check 2024 first half
    const { count: games2024 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .gte('start_time', '2024-03-28')
      .lte('start_time', '2024-07-16');
      
    console.log(chalk.green(`2024 First Half (Mar 28 - Jul 16): ${games2024} games`));
    
    if (games2024 && games2024 > 0) {
      console.log(chalk.white('\nYou can run historical training on 2024 data:'));
      console.log(chalk.cyan('npx tsx scripts/historical-season-replay.ts --start-date=2024-03-28 --end-date=2024-07-16'));
    }
  } else {
    console.log(chalk.white('\nReady to run historical training:'));
    console.log(chalk.cyan('npx tsx scripts/historical-season-replay.ts --start-date=2025-03-27 --end-date=2025-07-13'));
  }
  
  // Quick pattern detection test
  console.log(chalk.yellow('\n\n🎯 Quick Pattern Detection Test:'));
  
  // Look for Coors Field games (altitude advantage)
  const { count: coorsGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .ilike('venue', '%coors%');
    
  console.log(chalk.white(`  Coors Field games: ${coorsGames} (altitude_advantage pattern)`));
  
  console.log(chalk.gray('\n─'.repeat(70)));
  console.log(chalk.green('\n✅ System ready for training!\n'));
}

checkTrainingData().catch(console.error);