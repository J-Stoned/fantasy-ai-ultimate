#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugPaginationIssue() {
  console.log(chalk.bold.cyan('🔍 Debugging Pagination Issue'));
  console.log(chalk.gray('='.repeat(60)));

  let offset = 0;
  let totalGamesQueried = 0;
  let batchCount = 0;
  
  while (true) {
    batchCount++;
    console.log(chalk.cyan(`\nBatch ${batchCount}: offset ${offset}`));
    
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        id,
        sport,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        start_time
      `)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .range(offset, offset + 10000);
    
    if (error) {
      console.log(chalk.red(`Error: ${error.message}`));
      break;
    }
    
    if (!games || games.length === 0) {
      console.log(chalk.yellow('No games returned, breaking loop'));
      break;
    }
    
    totalGamesQueried += games.length;
    
    console.log(chalk.white(`  Games returned: ${games.length}`));
    console.log(chalk.white(`  Total queried so far: ${totalGamesQueried}`));
    console.log(chalk.white(`  Sample game IDs: ${games.slice(0, 3).map(g => g.id).join(', ')}`));
    
    // Check if we're getting less than expected
    if (games.length < 10000) {
      console.log(chalk.yellow(`  Partial batch: ${games.length} < 10000`));
    }
    
    offset += 10000;
    
    // Safety break to prevent infinite loop
    if (batchCount > 10) {
      console.log(chalk.yellow('\nSafety break after 10 batches'));
      break;
    }
  }
  
  console.log(chalk.bold.yellow('\n📊 PAGINATION RESULTS:'));
  console.log(chalk.white(`Total batches: ${batchCount}`));
  console.log(chalk.white(`Total games queried: ${totalGamesQueried.toLocaleString()}`));
  
  // Now check the actual total count
  const { count: actualTotal } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.white(`Expected total games: ${actualTotal?.toLocaleString()}`));
  
  if (totalGamesQueried < (actualTotal || 0)) {
    console.log(chalk.red(`\n🚨 PAGINATION STOPPED EARLY!`));
    console.log(chalk.red(`Missing ${((actualTotal || 0) - totalGamesQueried).toLocaleString()} games`));
  }
}

debugPaginationIssue().catch(console.error);