#!/usr/bin/env tsx
/**
 * 🔥 FORCE ALL GAMES - NO LIMITS!
 * 
 * What's standing in our way: Supabase pagination limits!
 * 
 * SOLUTION: Force-query ALL games with explicit count verification!
 * NO MORE PAGINATION BUGS!
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function forceAllGames() {
  console.log(chalk.bold.red('🔥 FORCING ALL GAMES - NO LIMITS!'));
  console.log(chalk.yellow('Debugging Supabase pagination limits...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // First, get the ACTUAL total count
  console.log(chalk.cyan('1. Getting ACTUAL total count...'));
  const { count: actualTotal } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  console.log(chalk.green(`Total games in DB: ${actualTotal?.toLocaleString()}`));
  
  // Test different pagination approaches
  console.log(chalk.cyan('\n2. Testing pagination approaches...'));
  
  // Approach 1: Default query
  const { data: test1 } = await supabase
    .from('games')
    .select('id')
    .not('home_score', 'is', null);
    
  console.log(chalk.yellow(`Default query returns: ${test1?.length} games`));
  
  // Approach 2: With explicit limit
  const { data: test2 } = await supabase
    .from('games')
    .select('id')
    .not('home_score', 'is', null)
    .limit(100000);
    
  console.log(chalk.yellow(`With limit(100000): ${test2?.length} games`));
  
  // Approach 3: With range
  const { data: test3 } = await supabase
    .from('games')
    .select('id')
    .not('home_score', 'is', null)
    .range(0, 99999);
    
  console.log(chalk.yellow(`With range(0, 99999): ${test3?.length} games`));
  
  // Get actual games with stats count
  console.log(chalk.cyan('\n3. Checking player_stats coverage...'));
  
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.green(`Total player stats: ${totalStats?.toLocaleString()}`));
  
  // Get unique game IDs from stats
  const uniqueGamesWithStats = new Set<number>();
  let statOffset = 0;
  let statBatches = 0;
  
  while (true && statBatches < 20) { // Limit to prevent infinite loop
    const { data: stats } = await supabase
      .from('player_stats')
      .select('game_id')
      .range(statOffset, statOffset + 9999);
      
    if (!stats || stats.length === 0) break;
    
    stats.forEach(s => {
      if (s.game_id) uniqueGamesWithStats.add(s.game_id);
    });
    
    statOffset += 10000;
    statBatches++;
    
    console.log(chalk.gray(`Stats batch ${statBatches}: ${stats.length} records, unique games so far: ${uniqueGamesWithStats.size}`));
    
    if (stats.length < 10000) break;
  }
  
  console.log(chalk.green(`Unique games with stats: ${uniqueGamesWithStats.size}`));
  
  // Now try to get all games systematically
  console.log(chalk.cyan('\n4. Systematic game collection...'));
  
  const allGameIds: number[] = [];
  let gameOffset = 0;
  let gameBatches = 0;
  const maxBatches = 100; // Safety limit
  
  while (gameBatches < maxBatches) {
    console.log(chalk.gray(`Fetching games batch ${gameBatches + 1}...`));
    
    const { data: games, error } = await supabase
      .from('games')
      .select('id, home_score, away_score')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .range(gameOffset, gameOffset + 4999) // Smaller batches for safety
      .order('id', { ascending: true });
      
    if (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      break;
    }
    
    if (!games || games.length === 0) {
      console.log(chalk.yellow('No more games found'));
      break;
    }
    
    games.forEach(g => allGameIds.push(g.id));
    
    console.log(chalk.green(`Batch ${gameBatches + 1}: Got ${games.length} games, total: ${allGameIds.length}`));
    
    gameOffset += 5000;
    gameBatches++;
    
    // If we got less than requested, we're at the end
    if (games.length < 5000) {
      console.log(chalk.yellow('Reached end of games'));
      break;
    }
  }
  
  // Calculate what we're missing
  const gamesWithoutStats = allGameIds.filter(id => !uniqueGamesWithStats.has(id));
  
  console.log(chalk.bold.yellow('\n📊 FINAL ANALYSIS:'));
  console.log(chalk.white(`Total games found: ${chalk.bold(allGameIds.length.toLocaleString())}`));
  console.log(chalk.white(`Games with stats: ${chalk.bold(uniqueGamesWithStats.size.toLocaleString())}`));
  console.log(chalk.white(`Games WITHOUT stats: ${chalk.bold(gamesWithoutStats.length.toLocaleString())}`));
  console.log(chalk.white(`Expected total: ${chalk.bold(actualTotal?.toLocaleString() || 'unknown')}`));
  
  const coverage = (uniqueGamesWithStats.size / allGameIds.length) * 100;
  console.log(chalk.white(`Current coverage: ${chalk.bold.green(coverage.toFixed(1) + '%')}`));
  
  if (allGameIds.length < (actualTotal || 50000)) {
    console.log(chalk.bold.red('\n🚨 PAGINATION LIMIT CONFIRMED!'));
    console.log(chalk.red(`We're only getting ${allGameIds.length} out of ${actualTotal} games!`));
    console.log(chalk.yellow('This is what\'s standing in our way!'));
    
    // Calculate what we can achieve with current data
    if (gamesWithoutStats.length > 0) {
      console.log(chalk.cyan(`\nWe can still process ${gamesWithoutStats.length.toLocaleString()} more games!`));
      
      const potentialCoverage = ((uniqueGamesWithStats.size + gamesWithoutStats.length) / allGameIds.length) * 100;
      const potentialAccuracy = 68.6 + (potentialCoverage / 100 * 7.8);
      
      console.log(chalk.yellow(`Potential coverage: ${potentialCoverage.toFixed(1)}%`));
      console.log(chalk.yellow(`Potential accuracy: ${potentialAccuracy.toFixed(1)}%`));
    }
  } else {
    console.log(chalk.bold.green('\n✅ WE HAVE ALL GAMES!'));
    console.log(chalk.green('No pagination issues detected!'));
  }
  
  // Show specific games we can process
  if (gamesWithoutStats.length > 0) {
    console.log(chalk.bold.cyan(`\n🎯 NEXT STEPS:`));
    console.log(chalk.white(`Process ${Math.min(gamesWithoutStats.length, 10000)} games in next batch`));
    console.log(chalk.white(`This will add ${(Math.min(gamesWithoutStats.length, 10000) / allGameIds.length * 100).toFixed(1)}% coverage`));
  }
}

forceAllGames().catch(console.error);