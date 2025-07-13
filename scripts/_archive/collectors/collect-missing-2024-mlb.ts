#!/usr/bin/env tsx
/**
 * ⚾ COLLECT MISSING 2024 MLB GAMES - Fill the massive gap
 * We only have 117 MLB games but there should be ~2,430!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectMLB2024() {
  console.log(chalk.bold.red('\n⚾ COLLECTING MLB 2024 SEASON\n'));
  
  // MLB runs from late March to October
  const startDate = '2024-03-20';
  const endDate = '2024-10-31';
  
  console.log(`Collecting games from ${startDate} to ${endDate}`);
  console.log(chalk.yellow('Expected: ~2,430 games\n'));
  
  // Use the same collector logic as the 2023 collector
  const { CollectorClass } = await import('./collect-all-2023-seasons-FINAL.js');
  
  // For now, let's just check what we're missing
  const { data: existingGames, count } = await supabase
    .from('games')
    .select('start_time', { count: 'exact' })
    .eq('sport_id', 'mlb')
    .gte('start_time', '2024-01-01')
    .lt('start_time', '2025-01-01');
  
  console.log(`Current MLB 2024 games in database: ${count}`);
  
  if (existingGames && count) {
    // Find date ranges
    const dates = existingGames.map(g => g.start_time.split('T')[0]);
    const uniqueDates = [...new Set(dates)].sort();
    
    console.log(`Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);
    console.log(`Unique dates with games: ${uniqueDates.length}`);
  }
  
  console.log(chalk.yellow(`\nNeed to collect: ~${2430 - (count || 0)} more games`));
  console.log(chalk.cyan('\nRun the main collector with MLB date range to fill this gap!'));
}

collectMLB2024();