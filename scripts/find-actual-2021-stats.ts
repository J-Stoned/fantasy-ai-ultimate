#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findActual2021Stats() {
  console.log(chalk.bold.cyan('🔍 FINDING ACTUAL 2021 NFL STATS\n'));
  
  // 1. First, let's see all NFL stats regardless of date
  console.log(chalk.yellow('1. Checking all NFL stats in player_game_logs:'));
  
  const { data: allStats, count: totalCount } = await supabase
    .from('player_game_logs')
    .select('game_date, game_id', { count: 'exact' })
    .eq('sport', 'NFL')
    .order('game_date')
    .limit(20);
    
  console.log(chalk.white(`Total NFL stats: ${totalCount || 0}`));
  
  if (allStats && allStats.length > 0) {
    console.log(chalk.white('\nFirst 20 NFL stats:'));
    allStats.forEach(stat => {
      console.log(chalk.gray(`  Date: ${stat.game_date}, Game ID: ${stat.game_id}`));
    });
    
    // Get date range
    const { data: dateRange } = await supabase
      .from('player_game_logs')
      .select('game_date')
      .eq('sport', 'NFL')
      .order('game_date', { ascending: true })
      .limit(1);
      
    const { data: dateRangeEnd } = await supabase
      .from('player_game_logs')
      .select('game_date')
      .eq('sport', 'NFL')
      .order('game_date', { ascending: false })
      .limit(1);
      
    if (dateRange && dateRange[0] && dateRangeEnd && dateRangeEnd[0]) {
      console.log(chalk.white(`\nDate range: ${dateRange[0].game_date} to ${dateRangeEnd[0].game_date}`));
    }
  }
  
  // 2. Check if there are any stats with NULL game_date
  console.log(chalk.yellow('\n\n2. Checking for NULL game_dates:'));
  
  const { count: nullDateCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .is('game_date', null);
    
  console.log(chalk.white(`Stats with NULL game_date: ${nullDateCount || 0}`));
  
  // 3. Check if stats are linked to games properly
  console.log(chalk.yellow('\n\n3. Checking game linkage:'));
  
  // Get a 2021 game we know has stats
  const { data: game2021 } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('external_id', 'espn_nfl_401326308')
    .single();
    
  if (game2021) {
    console.log(chalk.white(`\nChecking game ${game2021.external_id} (ID: ${game2021.id}):`));
    
    // Try different ways to find stats
    const { count: count1 } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game2021.id);
      
    const { count: count2 } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game2021.id.toString());
      
    console.log(chalk.white(`  Stats with game_id = ${game2021.id}: ${count1 || 0}`));
    console.log(chalk.white(`  Stats with game_id = '${game2021.id}': ${count2 || 0}`));
  }
  
  // 4. Let's check the actual structure of the data
  console.log(chalk.yellow('\n\n4. Sample player_game_logs structure:'));
  
  const { data: sampleLog } = await supabase
    .from('player_game_logs')
    .select('*')
    .eq('sport', 'NFL')
    .limit(1)
    .single();
    
  if (sampleLog) {
    console.log(chalk.white('Sample stat record:'));
    console.log(chalk.gray(JSON.stringify(sampleLog, null, 2).substring(0, 500) + '...'));
  }
  
  // 5. Check year extraction from game_date
  console.log(chalk.yellow('\n\n5. Stats by year (extracted from game_date):'));
  
  const { data: yearStats } = await supabase
    .from('player_game_logs')
    .select('game_date')
    .eq('sport', 'NFL')
    .limit(1000);
    
  if (yearStats && yearStats.length > 0) {
    const yearCounts: Record<number, number> = {};
    yearStats.forEach(stat => {
      if (stat.game_date) {
        const year = new Date(stat.game_date).getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      }
    });
    
    Object.entries(yearCounts).sort().forEach(([year, count]) => {
      console.log(chalk.white(`  ${year}: ${count} stats (from sample of 1000)`));
    });
  }
}

findActual2021Stats().catch(console.error);