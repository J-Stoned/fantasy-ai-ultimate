#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugGameStatsCount() {
  console.log(chalk.bold.cyan('🔍 Debugging Game Stats Count'));
  console.log(chalk.gray('='.repeat(60)));

  // 1. Count total games with scores
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  console.log(chalk.yellow(`Total games with scores: ${totalGames?.toLocaleString()}`));

  // 2. Get all unique game IDs from player_stats
  console.log(chalk.cyan('\nFetching all game IDs from player_stats...'));
  
  const gameIdsWithStats = new Set<number>();
  let offset = 0;
  let totalStatsRecords = 0;
  
  while (true) {
    const { data, count } = await supabase
      .from('player_stats')
      .select('game_id', { count: 'exact' })
      .range(offset, offset + 50000);
    
    if (!data || data.length === 0) break;
    
    data.forEach(s => gameIdsWithStats.add(s.game_id));
    totalStatsRecords += data.length;
    offset += 50000;
    
    console.log(chalk.gray(`  Fetched ${offset} records...`));
  }
  
  console.log(chalk.green(`Total player_stats records: ${totalStatsRecords.toLocaleString()}`));
  console.log(chalk.green(`Unique games with stats: ${gameIdsWithStats.size.toLocaleString()}`));
  console.log(chalk.red(`Games WITHOUT stats: ${((totalGames || 0) - gameIdsWithStats.size).toLocaleString()}`));

  // 3. Now simulate the turbo collector's query
  console.log(chalk.cyan('\n🔍 Simulating turbo collector query...'));
  
  const allGames: any[] = [];
  offset = 0;
  let totalGamesQueried = 0;
  
  while (true) {
    const { data: games } = await supabase
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
    
    if (!games || games.length === 0) break;
    
    totalGamesQueried += games.length;
    
    // Filter games without stats
    const needStats = games.filter(g => !gameIdsWithStats.has(g.id));
    allGames.push(...needStats);
    
    console.log(chalk.gray(`  Queried ${totalGamesQueried} games, found ${allGames.length} needing stats...`));
    
    offset += 10000;
  }
  
  console.log(chalk.bold.yellow('\n📊 FINAL RESULTS:'));
  console.log(chalk.white(`Total games queried: ${totalGamesQueried.toLocaleString()}`));
  console.log(chalk.white(`Games found needing stats: ${allGames.length.toLocaleString()}`));
  console.log(chalk.white(`Expected games without stats: ${((totalGames || 0) - gameIdsWithStats.size).toLocaleString()}`));
  
  if (allGames.length < ((totalGames || 0) - gameIdsWithStats.size)) {
    const missing = ((totalGames || 0) - gameIdsWithStats.size) - allGames.length;
    console.log(chalk.red(`\n⚠️  MISSING ${missing.toLocaleString()} games!`));
    
    // Check if there's a limit issue
    if (totalGamesQueried < (totalGames || 0)) {
      console.log(chalk.red(`\n🚨 QUERY LIMIT ISSUE: Only queried ${totalGamesQueried} out of ${totalGames} total games!`));
    }
  }
  
  // 4. Sample some game IDs to verify
  console.log(chalk.cyan('\n🔍 Sampling game IDs...'));
  
  // Get first 10 games that supposedly need stats
  const sampleGames = allGames.slice(0, 10);
  
  for (const game of sampleGames) {
    // Check if this game really has no stats
    const { count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id);
    
    console.log(chalk.gray(`Game ${game.id}: ${count} stats (should be 0)`));
  }
}

debugGameStatsCount().catch(console.error);