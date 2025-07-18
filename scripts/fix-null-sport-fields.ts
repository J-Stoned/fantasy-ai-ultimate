#!/usr/bin/env tsx
/**
 * Fix NULL sport fields in player_game_logs table
 * This script updates all NFL stats that have NULL sport field
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNullSportFields() {
  console.log(chalk.blue('\n🔍 Checking for NULL sport fields in player_game_logs...\n'));

  // First, let's see the scope of the problem
  const { data: nflGames, error: gamesError } = await supabase
    .from('games')
    .select('id, start_time, sport')
    .eq('sport', 'NFL')
    .order('start_time', { ascending: true });

  if (gamesError || !nflGames) {
    console.error(chalk.red('Error fetching NFL games:'), gamesError);
    return;
  }

  console.log(chalk.green(`Found ${nflGames.length} NFL games total`));

  // Group games by year
  const gamesByYear: Record<number, number[]> = {};
  nflGames.forEach(game => {
    const year = new Date(game.start_time).getFullYear();
    if (!gamesByYear[year]) gamesByYear[year] = [];
    gamesByYear[year].push(game.id);
  });

  console.log(chalk.cyan('\nNFL games by year:'));
  Object.entries(gamesByYear).forEach(([year, games]) => {
    console.log(`  ${year}: ${games.length} games`);
  });

  // Check how many stats have NULL sport for these games
  let totalNullStats = 0;
  for (const [year, gameIds] of Object.entries(gamesByYear)) {
    const { count, error } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds)
      .is('sport', null);

    if (!error && count) {
      console.log(chalk.yellow(`\n${year}: ${count} stats with NULL sport field`));
      totalNullStats += count;
    }
  }

  if (totalNullStats === 0) {
    console.log(chalk.green('\n✅ No NULL sport fields found! All NFL stats are properly tagged.'));
    
    // Show current stats count
    const { count: nflStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NFL');
    
    console.log(chalk.blue(`\nTotal NFL stats in database: ${nflStats}`));
    return;
  }

  console.log(chalk.red(`\n⚠️  Found ${totalNullStats} total stats with NULL sport field`));
  console.log(chalk.cyan('\n🔧 Fixing NULL sport fields...'));

  // Update in batches by year
  let totalFixed = 0;
  for (const [year, gameIds] of Object.entries(gamesByYear)) {
    // Process in chunks of 100 games
    const chunkSize = 100;
    for (let i = 0; i < gameIds.length; i += chunkSize) {
      const chunk = gameIds.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('player_game_logs')
        .update({ sport: 'NFL' })
        .in('game_id', chunk)
        .is('sport', null);

      if (error) {
        console.error(chalk.red(`Error updating ${year} batch ${Math.floor(i/chunkSize) + 1}:`), error);
      } else {
        process.stdout.write('.');
      }
    }
    
    // Verify the fix for this year
    const { count: fixedCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds)
      .eq('sport', 'NFL');
    
    console.log(chalk.green(`\n✅ ${year}: Fixed! Now has ${fixedCount} NFL stats`));
    totalFixed += fixedCount || 0;
  }

  console.log(chalk.green(`\n🎉 Fix complete! Total NFL stats now: ${totalFixed}`));

  // Final verification - show stats by year
  console.log(chalk.blue('\n📊 Final NFL stats count by year:'));
  
  for (const [year, gameIds] of Object.entries(gamesByYear)) {
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds)
      .eq('sport', 'NFL');
    
    console.log(`  ${year}: ${count} stats`);
  }
}

// Run the fix
fixNullSportFields().catch(console.error);