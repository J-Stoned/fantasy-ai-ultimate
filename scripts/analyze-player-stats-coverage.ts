#!/usr/bin/env tsx
/**
 * Analyze player stats coverage and format
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStatsFormat() {
  console.log(chalk.blue('\n=== PLAYER STATS FORMAT ANALYSIS ===\n'));
  
  // 1. Get sample stats for a recent game
  const { data: recentGame } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .single();
  
  if (!recentGame) {
    console.log('No recent games found');
    return;
  }
  
  console.log(chalk.cyan(`Analyzing game ${recentGame.id} (${recentGame.external_id})`));
  
  // 2. Get all stats for this game
  const { data: gameStats, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('game_id', recentGame.id);
  
  if (error) {
    console.log(chalk.red('Error fetching stats:'), error.message);
    return;
  }
  
  console.log(chalk.green(`\nFound ${gameStats?.length || 0} stat entries`));
  
  // 3. Analyze the format
  if (gameStats && gameStats.length > 0) {
    // Group by player
    const playerStatsMap = new Map();
    
    gameStats.forEach(stat => {
      if (!playerStatsMap.has(stat.player_id)) {
        playerStatsMap.set(stat.player_id, []);
      }
      playerStatsMap.get(stat.player_id).push({
        type: stat.stat_type,
        value: stat.stat_value
      });
    });
    
    console.log(chalk.cyan(`\nStats for ${playerStatsMap.size} unique players`));
    
    // Show example for first player
    const [firstPlayerId, firstPlayerStats] = Array.from(playerStatsMap.entries())[0];
    console.log(chalk.yellow(`\nExample - Player ${firstPlayerId}:`));
    firstPlayerStats.forEach(stat => {
      console.log(`  ${stat.type}: ${stat.value}`);
    });
    
    // 4. Analyze stat types
    const statTypes = new Set();
    gameStats.forEach(stat => statTypes.add(stat.stat_type));
    
    console.log(chalk.cyan('\nUnique stat types found:'));
    Array.from(statTypes).sort().forEach(type => {
      console.log(`  - ${type}`);
    });
  }
  
  // 5. Check games without stats
  console.log(chalk.cyan('\n=== COVERAGE ANALYSIS ==='));
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .not('home_score', 'is', null);
  
  const { count: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id', { count: 'exact', head: true })
    .not('game_id', 'is', null);
  
  const totalGames = allGames?.length || 0;
  const coverage = ((gamesWithStats || 0) / totalGames * 100).toFixed(1);
  
  console.log(`\nTotal completed games: ${totalGames}`);
  console.log(`Games with stats: ${gamesWithStats || 0}`);
  console.log(`Coverage: ${coverage}%`);
  
  // 6. Find games missing stats
  console.log(chalk.cyan('\n=== RECENT GAMES WITHOUT STATS ==='));
  
  const { data: gamesWithoutStats } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(100);
  
  if (gamesWithoutStats) {
    let missingCount = 0;
    for (const game of gamesWithoutStats) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count === 0) {
        missingCount++;
        if (missingCount <= 5) {
          console.log(`\nGame ${game.id} (${game.external_id}):`);
          console.log(`  Date: ${new Date(game.start_time).toLocaleDateString()}`);
          console.log(`  Teams: ${game.home_team_id} vs ${game.away_team_id}`);
        }
      }
    }
    console.log(chalk.yellow(`\nTotal games missing stats: ${missingCount} out of last 100`));
  }
}

analyzeStatsFormat().catch(console.error);